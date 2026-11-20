"""
AquaBot - Python ROS 2 ROV Controller Node
Subscribes to /cmd_vel, /aquabot/depth, and /aquabot/imu.
Publishes /aquabot/thruster_forces and /aquabot/status.
Provides /aquabot/emergency_stop service.
"""

import math
import rclpy
from rclpy.node import Node
from geometry_msgs.msg import Twist
from sensor_msgs.msg import Imu
from std_msgs.msg import Float32MultiArray
from aquabot_interfaces.msg import DepthReading, ROVStatus
from aquabot_interfaces.srv import EmergencyStop


class ROVControllerNode(Node):
    def __init__(self):
        super().__init__("aquabot_controller")
        self.get_logger().info("Starting AquaBot Python ROV Controller Node...")

        # Parameters
        self.declare_parameter("max_thrust_n", 32.0)
        self.max_thrust = self.get_parameter("max_thrust_n").value

        # Publishers
        self.thruster_pub = self.create_publisher(Float32MultiArray, "/aquabot/thruster_forces", 10)
        self.status_pub = self.create_publisher(ROVStatus, "/aquabot/status", 10)

        # Subscribers
        self.cmd_vel_sub = self.create_subscription(Twist, "/cmd_vel", self.cmd_vel_callback, 10)
        self.depth_sub = self.create_subscription(DepthReading, "/aquabot/depth", self.depth_callback, 10)
        self.imu_sub = self.create_subscription(Imu, "/aquabot/imu", self.imu_callback, 10)

        # Service
        self.estop_srv = self.create_service(EmergencyStop, "/aquabot/emergency_stop", self.handle_estop)

        # State
        self.mode = "MANUAL"
        self.cmd_surge = 0.0
        self.cmd_sway = 0.0
        self.cmd_heave = 0.0
        self.cmd_yaw = 0.0
        self.current_depth = 2.0
        self.target_depth = 2.0
        self.current_yaw = 0.0
        self.target_yaw = 0.0

        # 20 Hz loop
        self.timer = self.create_timer(0.05, self.control_loop)

    def cmd_vel_callback(self, msg: Twist):
        if self.mode == "EMERGENCY_STOP":
            return
        self.cmd_surge = max(-1.0, min(1.0, msg.linear.x))
        self.cmd_sway = max(-1.0, min(1.0, msg.linear.y))
        self.cmd_heave = max(-1.0, min(1.0, msg.linear.z))
        self.cmd_yaw = max(-1.0, min(1.0, msg.angular.z))

    def depth_callback(self, msg: DepthReading):
        self.current_depth = msg.depth_meters

    def imu_callback(self, msg: Imu):
        qx = msg.orientation.x
        qy = msg.orientation.y
        qz = msg.orientation.z
        qw = msg.orientation.w
        siny_cosp = 2.0 * (qw * qz + qx * qy)
        cosy_cosp = 1.0 - 2.0 * (qy * qy + qz * qz)
        self.current_yaw = math.atan2(siny_cosp, cosy_cosp)

    def handle_estop(self, request, response):
        if request.engage:
            self.mode = "EMERGENCY_STOP"
            self.cmd_surge = 0.0
            self.cmd_sway = 0.0
            self.cmd_heave = 0.0
            self.cmd_yaw = 0.0
            response.success = True
            response.current_mode = self.mode
            response.message = "E-STOP engaged. Thrusters disabled."
            self.get_logger().warn(f"Emergency stop engaged: {request.reason}")
        else:
            self.mode = "MANUAL"
            self.target_depth = self.current_depth
            self.target_yaw = self.current_yaw
            response.success = True
            response.current_mode = self.mode
            response.message = "E-STOP cleared. Returning to MANUAL."
        return response

    def control_loop(self):
        if self.mode == "EMERGENCY_STOP":
            msg = Float32MultiArray()
            msg.data = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0]
            self.thruster_pub.publish(msg)
            return

        # 6-Thruster Allocation
        t1 = (self.cmd_surge - self.cmd_sway - self.cmd_yaw) * self.max_thrust
        t2 = (self.cmd_surge + self.cmd_sway + self.cmd_yaw) * self.max_thrust
        t3 = (self.cmd_surge + self.cmd_sway - self.cmd_yaw) * self.max_thrust
        t4 = (self.cmd_surge - self.cmd_sway + self.cmd_yaw) * self.max_thrust
        t5 = self.cmd_heave * self.max_thrust
        t6 = self.cmd_heave * self.max_thrust

        msg = Float32MultiArray()
        msg.data = [float(t1), float(t2), float(t3), float(t4), float(t5), float(t6)]
        self.thruster_pub.publish(msg)


def main(args=None):
    rclpy.init(args=args)
    node = ROVControllerNode()
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()


if __name__ == "__main__":
    main()
