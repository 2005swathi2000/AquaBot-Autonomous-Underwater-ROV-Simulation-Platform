/**
 * AquaBot - C++17 ROV Controller Node
 * Implements closed-loop PID depth-hold, heading stabilization, thruster allocation,
 * and safety interlocks for autonomous underwater vehicles.
 */

#include <chrono>
#include <cmath>
#include <memory>
#include <string>
#include <vector>
#include <algorithm>

#include "rclcpp/rclcpp.hpp"
#include "geometry_msgs/msg/twist.hpp"
#include "sensor_msgs/msg/imu.hpp"
#include "std_msgs/msg/float32_multi_array.hpp"
#include "aquabot_interfaces/msg/depth_reading.hpp"
#include "aquabot_interfaces/msg/rov_status.hpp"
#include "aquabot_interfaces/srv/emergency_stop.hpp"

using namespace std::chrono_literals;

class ROVControllerNode : public rclcpp::Node {
public:
    ROVControllerNode() : Node("aquabot_controller") {
        RCLCPP_INFO(this->get_logger(), "Initializing AquaBot C++17 ROV Controller Node...");

        // Declare ROS 2 Parameters
        this->declare_parameter<double>("pid_depth_kp", 1.2);
        this->declare_parameter<double>("pid_depth_ki", 0.12);
        this->declare_parameter<double>("pid_depth_kd", 0.55);
        this->declare_parameter<double>("pid_heading_kp", 1.6);
        this->declare_parameter<double>("pid_heading_ki", 0.15);
        this->declare_parameter<double>("pid_heading_kd", 0.45);
        this->declare_parameter<double>("max_thrust_n", 32.0);
        this->declare_parameter<double>("control_rate_hz", 20.0);

        // Fetch Parameters
        kp_depth_ = this->get_parameter("pid_depth_kp").as_double();
        ki_depth_ = this->get_parameter("pid_depth_ki").as_double();
        kd_depth_ = this->get_parameter("pid_depth_kd").as_double();
        kp_heading_ = this->get_parameter("pid_heading_kp").as_double();
        ki_heading_ = this->get_parameter("pid_heading_ki").as_double();
        kd_heading_ = this->get_parameter("pid_heading_kd").as_double();
        max_thrust_ = this->get_parameter("max_thrust_n").as_double();

        // Publishers
        thruster_pub_ = this->create_publisher<std_msgs::msg::Float32MultiArray>("/aquabot/thruster_forces", 10);
        status_pub_ = this->create_publisher<aquabot_interfaces::msg::ROVStatus>("/aquabot/status", 10);

        // Subscribers
        cmd_vel_sub_ = this->create_subscription<geometry_msgs::msg::Twist>(
            "/cmd_vel", 10,
            std::bind(&ROVControllerNode::on_cmd_vel, this, std::placeholders::_1));

        depth_sub_ = this->create_subscription<aquabot_interfaces::msg::DepthReading>(
            "/aquabot/depth", 10,
            std::bind(&ROVControllerNode::on_depth, this, std::placeholders::_1));

        imu_sub_ = this->create_subscription<sensor_msgs::msg::Imu>(
            "/aquabot/imu", 10,
            std::bind(&ROVControllerNode::on_imu, this, std::placeholders::_1));

        // Services
        estop_srv_ = this->create_service<aquabot_interfaces::srv::EmergencyStop>(
            "/aquabot/emergency_stop",
            std::bind(&ROVControllerNode::handle_emergency_stop, this, std::placeholders::_1, std::placeholders::_2));

        // 20 Hz Control Loop Timer
        timer_ = this->create_wall_timer(50ms, std::bind(&ROVControllerNode::control_loop, this));

        RCLCPP_INFO(this->get_logger(), "AquaBot ROV Controller Node successfully started.");
    }

private:
    void on_cmd_vel(const geometry_msgs::msg::Twist::SharedPtr msg) {
        if (mode_ == "EMERGENCY_STOP") return;
        cmd_surge_ = std::clamp(msg->linear.x, -1.0, 1.0);
        cmd_sway_  = std::clamp(msg->linear.y, -1.0, 1.0);
        cmd_heave_ = std::clamp(msg->linear.z, -1.0, 1.0);
        cmd_yaw_   = std::clamp(msg->angular.z, -1.0, 1.0);
    }

    void on_depth(const aquabot_interfaces::msg::DepthReading::SharedPtr msg) {
        current_depth_ = msg->depth_meters;
    }

    void on_imu(const sensor_msgs::msg::Imu::SharedPtr msg) {
        // Extract Yaw from Quaternion
        double qx = msg->orientation.x;
        double qy = msg->orientation.y;
        double qz = msg->orientation.z;
        double qw = msg->orientation.w;
        // Yaw (z-axis rotation) = atan2(2*(w*z + x*y), 1 - 2*(y^2 + z^2))
        double siny_cosp = 2.0 * (qw * qz + qx * qy);
        double cosy_cosp = 1.0 - 2.0 * (qy * qy + qz * qz);
        current_yaw_ = std::atan2(siny_cosp, cosy_cosp);
    }

    void handle_emergency_stop(
        const std::shared_ptr<aquabot_interfaces::srv::EmergencyStop::Request> request,
        std::shared_ptr<aquabot_interfaces::srv::EmergencyStop::Response> response) {
        if (request->engage) {
            mode_ = "EMERGENCY_STOP";
            cmd_surge_ = 0.0;
            cmd_sway_  = 0.0;
            cmd_heave_ = 0.0;
            cmd_yaw_   = 0.0;
            response->success = true;
            response->current_mode = mode_;
            response->message = "EMERGENCY STOP engaged. All thrusters disengaged.";
            RCLCPP_WARN(this->get_logger(), "E-STOP Engaged: %s", request->reason.c_str());
        } else {
            mode_ = "MANUAL";
            target_depth_ = current_depth_;
            target_heading_ = current_yaw_;
            response->success = true;
            response->current_mode = mode_;
            response->message = "Emergency stop cleared. ROV returned to MANUAL.";
            RCLCPP_INFO(this->get_logger(), "E-STOP Cleared.");
        }
    }

    void control_loop() {
        if (mode_ == "EMERGENCY_STOP") {
            publish_thrusters(0.0, 0.0, 0.0, 0.0, 0.0, 0.0);
            return;
        }

        // Closed-loop PID depth hold if no manual heave commanded
        double heave_output = cmd_heave_;
        if (std::abs(cmd_heave_) < 0.05) {
            double depth_err = target_depth_ - current_depth_;
            integral_depth_ = std::clamp(integral_depth_ + depth_err * 0.05, -2.0, 2.0);
            double deriv_depth = (depth_err - prev_depth_err_) / 0.05;
            prev_depth_err_ = depth_err;
            heave_output = std::clamp(kp_depth_ * depth_err + ki_depth_ * integral_depth_ + kd_depth_ * deriv_depth, -1.0, 1.0);
        } else {
            target_depth_ = current_depth_;
            integral_depth_ = 0.0;
        }

        // Closed-loop PID heading hold if no manual yaw commanded
        double yaw_output = cmd_yaw_;
        if (std::abs(cmd_yaw_) < 0.05) {
            double heading_err = std::fmod(target_heading_ - current_yaw_ + M_PI, 2.0 * M_PI) - M_PI;
            integral_heading_ = std::clamp(integral_heading_ + heading_err * 0.05, -1.5, 1.5);
            double deriv_heading = (heading_err - prev_heading_err_) / 0.05;
            prev_heading_err_ = heading_err;
            yaw_output = std::clamp(kp_heading_ * heading_err + ki_heading_ * integral_heading_ + kd_heading_ * deriv_heading, -1.0, 1.0);
        } else {
            target_heading_ = current_yaw_;
            integral_heading_ = 0.0;
        }

        // 6-Thruster Allocation
        double t1 = (cmd_surge_ - cmd_sway_ - yaw_output) * max_thrust_;
        double t2 = (cmd_surge_ + cmd_sway_ + yaw_output) * max_thrust_;
        double t3 = (cmd_surge_ + cmd_sway_ - yaw_output) * max_thrust_;
        double t4 = (cmd_surge_ - cmd_sway_ + yaw_output) * max_thrust_;
        double t5 = heave_output * max_thrust_;
        double t6 = heave_output * max_thrust_;

        publish_thrusters(t1, t2, t3, t4, t5, t6);
    }

    void publish_thrusters(double t1, double t2, double t3, double t4, double t5, double t6) {
        auto msg = std_msgs::msg::Float32MultiArray();
        msg.data = {static_cast<float>(t1), static_cast<float>(t2),
                    static_cast<float>(t3), static_cast<float>(t4),
                    static_cast<float>(t5), static_cast<float>(t6)};
        thruster_pub_->publish(msg);
    }

    // ROS handles
    rclcpp::Publisher<std_msgs::msg::Float32MultiArray>::SharedPtr thruster_pub_;
    rclcpp::Publisher<aquabot_interfaces::msg::ROVStatus>::SharedPtr status_pub_;
    rclcpp::Subscription<geometry_msgs::msg::Twist>::SharedPtr cmd_vel_sub_;
    rclcpp::Subscription<aquabot_interfaces::msg::DepthReading>::SharedPtr depth_sub_;
    rclcpp::Subscription<sensor_msgs::msg::Imu>::SharedPtr imu_sub_;
    rclcpp::Service<aquabot_interfaces::srv::EmergencyStop>::SharedPtr estop_srv_;
    rclcpp::TimerBase::SharedPtr timer_;

    // States & Commands
    std::string mode_ = "MANUAL";
    double cmd_surge_ = 0.0, cmd_sway_ = 0.0, cmd_heave_ = 0.0, cmd_yaw_ = 0.0;
    double current_depth_ = 2.0, target_depth_ = 2.0;
    double current_yaw_ = 0.0, target_heading_ = 0.0;
    double integral_depth_ = 0.0, prev_depth_err_ = 0.0;
    double integral_heading_ = 0.0, prev_heading_err_ = 0.0;

    // Parameters
    double kp_depth_, ki_depth_, kd_depth_;
    double kp_heading_, ki_heading_, kd_heading_;
    double max_thrust_;
};

int main(int argc, char **argv) {
    rclcpp::init(argc, argv);
    auto node = std::make_shared<ROVControllerNode>();
    rclcpp::spin(node);
    rclcpp::shutdown();
    return 0;
}
