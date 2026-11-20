cmake_minimum_required(VERSION 3.8)
project(aquabot_sensors)

find_package(ament_cmake REQUIRED)
find_package(rclpy REQUIRED)
find_package(sensor_msgs REQUIRED)
find_package(nav_msgs REQUIRED)
find_package(aquabot_interfaces REQUIRED)

install(PROGRAMS
  aquabot_sensors/sensor_publisher_node.py
  DESTINATION lib/${PROJECT_NAME}
)

ament_package()
