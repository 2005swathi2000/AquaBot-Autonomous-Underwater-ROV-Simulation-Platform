"""
AquaBot - Complete ROS 2 Simulation Stack Bringup Launch File
Launches:
1. aquabot_controller (C++ or Python ROV Movement Controller)
2. aquabot_sensor_publisher (Acoustic Sonar, IMU, Depth, Battery)
3. aquabot_waypoint_navigator (Autonomous Navigation & Obstacle Avoidance)
4. aquabot_obstacle_detector (Collision Safety Monitor)
"""

import os
from launch import LaunchDescription
from launch_ros.actions import Node
from ament_index_python.packages import get_package_share_directory


def generate_launch_description():
    params_file = os.path.join(
        get_package_share_directory('aquabot_navigation'),
        'config',
        'aquabot_params.yaml'
    )

    return LaunchDescription([
        # 1. Controller Node (C++ executable)
        Node(
            package='aquabot_controller',
            executable='rov_controller_node_cpp',
            name='aquabot_controller',
            output='screen',
            parameters=[params_file]
        ),

        # 2. Sensor Publisher Node
        Node(
            package='aquabot_sensors',
            executable='sensor_publisher_node.py',
            name='aquabot_sensor_publisher',
            output='screen'
        ),

        # 3. Autonomous Waypoint Navigator Node
        Node(
            package='aquabot_navigation',
            executable='waypoint_navigator_node.py',
            name='aquabot_waypoint_navigator',
            output='screen',
            parameters=[params_file]
        ),

        # 4. Obstacle Detector Safety Node
        Node(
            package='aquabot_navigation',
            executable='obstacle_detector_node.py',
            name='aquabot_obstacle_detector',
            output='screen'
        ),
    ])
