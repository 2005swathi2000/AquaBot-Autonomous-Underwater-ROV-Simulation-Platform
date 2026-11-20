"""
AquaBot - ROS 2 Obstacle Detector & Safety Node
Monitors forward sonar and depth sensor readings, runs real-time collision hazard evaluation,
and can trigger failsafe emergency stops over ROS 2 service when an imminent collision is detected.
"""

import rclpy
from rclpy.node import Node
from aquabot_interfaces.msg import SonarScan
from aquabot_interfaces.srv import EmergencyStop


class ObstacleDetectorNode(Node):
    def __init__(self):
        super().__init__("aquabot_obstacle_detector")
        self.get_logger().info("Starting AquaBot Obstacle Detector & Safety Node...")

        self.declare_parameter("emergency_distance_threshold_m", 1.2)
        self.estop_threshold = self.get_parameter("emergency_distance_threshold_m").value

        # Subscriber
        self.sonar_sub = self.create_subscription(SonarScan, "/aquabot/sonar", self.on_sonar_scan, 10)

        # Service Client to trigger emergency stop
        self.estop_client = self.create_client(EmergencyStop, "/aquabot/emergency_stop")

    def on_sonar_scan(self, msg: SonarScan):
        if msg.min_distance_meters <= self.estop_threshold:
            self.get_logger().error(
                f"COLLISION IMMINENT! Obstacle '{msg.closest_target_label}' at {msg.min_distance_meters:.2f} m. Triggering E-STOP!"
            )
            self.call_estop(f"Proximity hazard: {msg.closest_target_label} at {msg.min_distance_meters:.2f}m")

    def call_estop(self, reason: str):
        if not self.estop_client.service_is_ready():
            return
        req = EmergencyStop.Request()
        req.engage = True
        req.reason = reason
        self.estop_client.call_async(req)


def main(args=None):
    rclpy.init(args=args)
    node = ObstacleDetectorNode()
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()


if __name__ == "__main__":
    main()
