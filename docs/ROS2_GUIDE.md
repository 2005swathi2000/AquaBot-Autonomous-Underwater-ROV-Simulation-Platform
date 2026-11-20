# AquaBot ROS 2 Humble Integration Guide

This guide describes the ROS 2 architecture, message interfaces, node topologies, and execution instructions for the **AquaBot** Autonomous Underwater ROV platform.

---

## 1. Node Topology & Communication Architecture

```
                                  +-----------------------------+
                                  |                             |
                                  |  aquabot_waypoint_navigator |
                                  |                             |
                                  +--------------+--------------+
                                                 |
                                         /cmd_vel| (geometry_msgs/Twist)
                                                 v
+--------------------------+       +-------------+---------------+       +--------------------------+
|                          |       |                             |       |                          |
| aquabot_sensor_publisher | ----> |      aquabot_controller     | ----> | /aquabot/thruster_forces |
|                          |       |     (C++17 / Python Node)   |       |                          |
+--------------------------+       +-------------+---------------+       +--------------------------+
      |        |        |                        ^
      |        |        | /aquabot/depth         |
      |        |        | /aquabot/imu           |
      |        |        v                        |
      |        |   +----+--------------------+   |
      |        +-> | aquabot_obstacle_detector|---+  /aquabot/emergency_stop
      |            +-------------------------+      (aquabot_interfaces/EmergencyStop)
      v
  /aquabot/sonar (aquabot_interfaces/SonarScan)
  /aquabot/odom  (nav_msgs/Odometry)
  /aquabot/battery (sensor_msgs/BatteryState)
```

---

## 2. Topic Dictionary

| Topic | Message Type | Frequency | Description |
|---|---|---|---|
| `/cmd_vel` | `geometry_msgs/msg/Twist` | 10–20 Hz | Commanded linear velocities (`x`: surge, `y`: sway, `z`: heave) and angular rates (`z`: yaw). |
| `/aquabot/thruster_forces` | `std_msgs/msg/Float32MultiArray` | 20 Hz | 6-element array `[T1, T2, T3, T4, T5, T6]` in Newtons computed by the thruster allocation matrix. |
| `/aquabot/depth` | `aquabot_interfaces/msg/DepthReading` | 20 Hz | Calibrated depth (m), hydrostatic pressure (bar, kPa), water density, and sensor health flags. |
| `/aquabot/sonar` | `aquabot_interfaces/msg/SonarScan` | 20 Hz | Multi-beam forward acoustic scan arrays, minimum distance, collision threat level. |
| `/aquabot/imu` | `sensor_msgs/msg/Imu` | 20 Hz | Linear accelerations, body angular rates, and fused orientation quaternion. |
| `/aquabot/odom` | `nav_msgs/msg/Odometry` | 20 Hz | 3D estimated dead-reckoning position, orientation, and twist in the world frame. |
| `/aquabot/battery` | `sensor_msgs/msg/BatteryState` | 1 Hz | Pack terminal voltage (V), current draw (A), state of charge percentage. |
| `/aquabot/status` | `aquabot_interfaces/msg/ROVStatus` | 10 Hz | High-level system operating mode (`MANUAL`, `AUTONOMOUS`, `EMERGENCY_STOP`). |

---

## 3. Services

| Service | Type | Description |
|---|---|---|
| `/aquabot/emergency_stop` | `aquabot_interfaces/srv/EmergencyStop` | Disengages all thrusters immediately and sets failsafe mode. Pass `engage=false` to reset. |
| `/aquabot/set_mission` | `aquabot_interfaces/srv/SetMission` | Uploads an array of 3D waypoint coordinates `(x, y, z)` and triggers autonomous navigation. |

---

## 4. Building the ROS 2 Workspace (Ubuntu 22.04 LTS / ROS 2 Humble)

### Prerequisites
```bash
sudo apt update && sudo apt install -y \
    build-essential \
    cmake \
    python3-colcon-common-extensions \
    ros-humble-geometry-msgs \
    ros-humble-sensor-msgs \
    ros-humble-nav-msgs \
    ros-humble-std-msgs
```

### Compilation
```bash
cd aquabot/ros2_ws
source /opt/ros/humble/setup.bash
colcon build --symlink-install
source install/setup.bash
```

### Launching the Full Stack
```bash
ros2 launch aquabot_navigation aquabot_bringup.launch.py
```

### Verifying Nodes and Topics
```bash
# List active nodes
ros2 node list

# Inspect live depth readings
ros2 topic echo /aquabot/depth

# Monitor sonar scan
ros2 topic echo /aquabot/sonar

# Trigger emergency stop via CLI service call
ros2 service call /aquabot/emergency_stop aquabot_interfaces/srv/EmergencyStop "{engage: true, reason: 'Manual operator failsafe'}"
```

---

## 5. Running with Docker

You can build and run the ROS 2 Humble container on any host with Docker installed:
```bash
cd aquabot/ros2_ws
docker build -t aquabot-ros2:humble .
docker run -it --rm aquabot-ros2:humble
```
