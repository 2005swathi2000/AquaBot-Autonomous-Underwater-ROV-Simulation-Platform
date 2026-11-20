cmake_minimum_required(VERSION 3.8)
project(aquabot_navigation)

find_package(ament_cmake REQUIRED)
find_package(rclpy REQUIRED)
find_package(geometry_msgs REQUIRED)
find_package(nav_msgs REQUIRED)
find_package(aquabot_interfaces REQUIRED)

# Install Python scripts
install(PROGRAMS
  aquabot_navigation/waypoint_navigator_node.py
  aquabot_navigation/obstacle_detector_node.py
  DESTINATION lib/${PROJECT_NAME}
)

# Install launch and config directories
install(DIRECTORY
  launch
  config
  DESTINATION share/${PROJECT_NAME}
)

ament_package()
