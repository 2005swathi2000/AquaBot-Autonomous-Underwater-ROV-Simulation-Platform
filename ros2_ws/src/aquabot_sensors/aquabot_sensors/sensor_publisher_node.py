"""
AquaBot - ROS 2 Sensor Publisher Node
Periodically publishes simulated marine sensors on standard ROS 2 topics:
- /aquabot/depth (aquabot_interfaces/DepthReading)
- /aquabot/sonar (aquabot_interfaces/SonarScan)
- /aquabot/imu (sensor_msgs/Imu)
- /aquabot/odom (nav_msgs/Odometry)
- /aquabot/battery (sensor_msgs/BatteryState)
"""

import math
import random
import rclpy
from rclpy.node import Node
from sensor_msgs.msg import Imu, BatteryState, FluidPressure
from nav_msgs.msg import Odometry
from aquabot_interfaces.msg import DepthReading, SonarScan


class SensorPublisherNode(Node):
    def __init__(self):
        super().__init__("aquabot_sensor_publisher")
        self.get_logger().info("Starting AquaBot Sensor Publisher Node...")

        # Publishers
        self.depth_pub = self.create_publisher(DepthReading, "/aquabot/depth", 10)
        self.sonar_pub = self.create_publisher(SonarScan, "/aquabot/sonar", 10)
        self.imu_pub = self.create_publisher(Imu, "/aquabot/imu", 10)
        self.odom_pub = self.create_publisher(Odometry, "/aquabot/odom", 10)
        self.battery_pub = self.create_publisher(BatteryState, "/aquabot/battery", 10)

        # Simulation states
        self.depth_m = 2.0
        self.yaw_rad = 0.0
        self.battery_pct = 98.5

        # 20 Hz timer
        self.timer = self.create_timer(0.05, self.publish_sensors)

    def publish_sensors(self):
        now = self.get_clock().now().to_msg()

        # 1. Depth Sensor
        depth_msg = DepthReading()
        depth_msg.header.stamp = now
        depth_msg.header.frame_id = "depth_sensor_link"
        noise_depth = random.gauss(0.0, 0.02)
        depth_msg.depth_meters = float(self.depth_m + noise_depth)
        depth_msg.pressure_bar = float(1.013 + (1025.0 * 9.81 * depth_msg.depth_meters) / 100000.0)
        depth_msg.pressure_kpa = depth_msg.pressure_bar * 100.0
        depth_msg.water_density = 1025.0
        depth_msg.sensor_healthy = True
        self.depth_pub.publish(depth_msg)

        # 2. Sonar Scan
        sonar_msg = SonarScan()
        sonar_msg.header.stamp = now
        sonar_msg.header.frame_id = "sonar_link"
        sonar_msg.fov_degrees = 90.0
        sonar_msg.beam_angles_deg = [-45.0, -30.0, -15.0, 0.0, 15.0, 30.0, 45.0]
        # Simulate acoustic distance with safe default
        sonar_msg.beam_ranges_m = [20.0, 18.5, 12.0, 8.5, 14.0, 22.0, 25.0]
        sonar_msg.beam_contacts = [False, False, True, True, False, False, False]
        sonar_msg.min_distance_meters = 8.5
        sonar_msg.closest_angle_degrees = 0.0
        sonar_msg.closest_target_label = "Pillar Alpha"
        sonar_msg.threat_level = "CLEAR" if sonar_msg.min_distance_meters > 5.0 else "CAUTION"
        self.sonar_pub.publish(sonar_msg)

        # 3. IMU
        imu_msg = Imu()
        imu_msg.header.stamp = now
        imu_msg.header.frame_id = "imu_link"
        # Orientation from yaw
        imu_msg.orientation.w = math.cos(self.yaw_rad * 0.5)
        imu_msg.orientation.z = math.sin(self.yaw_rad * 0.5)
        imu_msg.linear_acceleration.z = 9.81
        self.imu_pub.publish(imu_msg)

        # 4. Battery State
        batt_msg = BatteryState()
        batt_msg.header.stamp = now
        batt_msg.voltage = 15.2
        batt_msg.current = -3.8
        batt_msg.percentage = float(self.battery_pct / 100.0)
        batt_msg.power_supply_status = BatteryState.POWER_SUPPLY_STATUS_DISCHARGING
        self.battery_pub.publish(batt_msg)


def main(args=None):
    rclpy.init(args=args)
    node = SensorPublisherNode()
    rclpy.spin(node)
    node.destroy_node()
    rclpy.shutdown()


if __name__ == "__main__":
    main()
