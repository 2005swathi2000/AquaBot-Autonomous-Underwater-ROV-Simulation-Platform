"""
AquaBot - ROS 2 Waypoint Navigation Node
Calculates desired heading, surge velocity, and depth to track 3D waypoints.
Applies Artificial Potential Field (APF) obstacle avoidance based on /aquabot/sonar.
Publishes /cmd_vel velocity commands.
"""

import math
import rclpy
from rclpy.node import Node
from geometry_msgs.msg import Twist, Point
from nav_msgs.msg import Odometry
from aquabot_interfaces.msg import SonarScan, DepthReading
from aquabot_interfaces.srv import SetMission


class WaypointNavigatorNode(Node):
    def __init__(self):
        super().__init__("aquabot_waypoint_navigator")
        self.get_logger().info("Starting AquaBot ROS 2 Waypoint Navigator Node...")

        # Parameters
        self.declare_parameter("acceptance_radius_m", 1.5)
        self.declare_parameter("nominal_surge_speed", 0.6)
        self.declare_parameter("repulsive_gain", 3.5)

        self.acceptance_radius = self.get_parameter("acceptance_radius_m").value
        self.nominal_surge = self.get_parameter("nominal_surge_speed").value
        self.repulsive_gain = self.get_parameter("repulsive_gain").value

        # Publisher
        self.cmd_vel_pub = self.create_publisher(Twist, "/cmd_vel", 10)

        # Subscribers
        self.odom_sub = self.create_subscription(Odometry, "/aquabot/odom", self.odom_callback, 10)
        self.sonar_sub = self.create_subscription(SonarScan, "/aquabot/sonar", self.sonar_callback, 10)
        self.depth_sub = self.create_subscription(DepthReading, "/aquabot/depth", self.depth_callback, 10)

        # Service
        self.mission_srv = self.create_service(SetMission, "/aquabot/set_mission", self.handle_set_mission)

        # Navigation State
        self.waypoints = [
            Point(x=10.0, y=10.0, z=8.0),
            Point(x=20.0, y=0.0, z=12.0),
            Point(x=0.0, y=0.0, z=2.0),
        ]
        self.current_wp_idx = 0
        self.is_navigating = False

        self.current_x = 0.0
        self.current_y = 0.0
        self.current_depth = 2.0
        self.current_yaw = 0.0
        self.latest_sonar = None

        # 10 Hz guidance loop
        self.timer = self.create_timer(0.1, self.guidance_loop)

    def odom_callback(self, msg: Odometry):
        self.current_x = msg.pose.pose.position.x
        self.current_y = msg.pose.pose.position.y
        # Convert quaternion to yaw
        q = msg.pose.pose.orientation
        siny_cosp = 2.0 * (q.w * q.z + q.x * q.y)
        cosy_cosp = 1.0 - 2.0 * (q.y * q.y + q.z * q.z)
        self.current_yaw = math.atan2(siny_cosp, cosy_cosp)

    def depth_callback(self, msg: DepthReading):
        self.current_depth = msg.depth_meters

    def sonar_callback(self, msg: SonarScan):
        self.latest_sonar = msg

    def handle_set_mission(self, request, response):
        self.waypoints = request.waypoints
        self.current_wp_idx = 0
        self.is_navigating = len(self.waypoints) > 0
        response.success = True
        response.waypoints_loaded = len(self.waypoints)
        response.message = f"Loaded mission '{request.mission_name}' with {len(self.waypoints)} waypoints."
        self.get_logger().info(response.message)
        return response

    def guidance_loop(self):
        if not self.is_navigating or self.current_wp_idx >= len(self.waypoints):
            return

        target = self.waypoints[self.current_wp_idx]
        dx = target.x - self.current_x
        dy = target.y - self.current_y
        dist_xy = math.hypot(dx, dy)

        # Check waypoint arrival
        if dist_xy < self.acceptance_radius:
            self.get_logger().info(f"Waypoint {self.current_wp_idx + 1} reached!")
            self.current_wp_idx += 1
            if self.current_wp_idx >= len(self.waypoints):
                self.is_navigating = False
                self.get_logger().info("Mission Completed successfully!")
                self.cmd_vel_pub.publish(Twist())
                return
            target = self.waypoints[self.current_wp_idx]
            dx = target.x - self.current_x
            dy = target.y - self.current_y

        # Attractive heading to waypoint
        target_heading = math.atan2(dy, dx)

        # Repulsive avoidance if obstacle detected within 5 meters
        if self.latest_sonar and self.latest_sonar.min_distance_meters < 5.0:
            if self.latest_sonar.threat_level == "CRITICAL":
                # Emergency reverse
                cmd = Twist()
                cmd.linear.x = -0.4
                cmd.angular.z = 0.5
                self.cmd_vel_pub.publish(cmd)
                return
            # Potential field deflection
            avoid_bias = -0.6 if self.latest_sonar.closest_angle_degrees >= 0 else 0.6
            target_heading = (target_heading + avoid_bias + math.pi) % (2.0 * math.pi) - math.pi

        # Angular error
        heading_err = (target_heading - self.current_yaw + math.pi) % (2.0 * math.pi) - math.pi
        yaw_cmd = max(-1.0, min(1.0, 1.2 * heading_err))

        # Heave command to track depth
        depth_err = target.z - self.current_depth
        heave_cmd = max(-0.8, min(0.8, 0.6 * depth_err))

        # Forward surge modulated by heading alignment
        surge_cmd = self.nominal_surge * max(0.2, math.cos(heading_err))

        cmd = Twist()
        cmd.linear.x = float(surge_cmd)
        cmd.linear.z = float(heave_cmd)
        cmd.angular.z = float(yaw_cmd)
        self.cmd_vel_pub.publish(cmd)


def main(args=None):
    rclpy.init(args=args)
    node = WaypointNavigatorNode()
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()


if __name__ == "__main__":
    main()
