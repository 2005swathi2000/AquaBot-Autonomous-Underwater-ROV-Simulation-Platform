cmake_minimum_required(VERSION 3.8)
project(aquabot_controller)

if(CMAKE_COMPILER_IS_GNUCXX OR CMAKE_CXX_COMPILER_ID MATCHES "Clang")
  add_compile_options(-Wall -Wextra -Wpedantic -std=c++17)
endif()

find_package(ament_cmake REQUIRED)
find_package(rclcpp REQUIRED)
find_package(geometry_msgs REQUIRED)
find_package(sensor_msgs REQUIRED)
find_package(std_msgs REQUIRED)
find_package(aquabot_interfaces REQUIRED)

# C++ ROV Controller Executable
add_executable(rov_controller_node_cpp src/rov_controller_node.cpp)
ament_target_dependencies(rov_controller_node_cpp
  rclcpp
  geometry_msgs
  sensor_msgs
  std_msgs
  aquabot_interfaces
)

install(TARGETS
  rov_controller_node_cpp
  DESTINATION lib/${PROJECT_NAME}
)

# Install Python scripts
install(PROGRAMS
  aquabot_controller/rov_controller_node.py
  DESTINATION lib/${PROJECT_NAME}
)

ament_package()
