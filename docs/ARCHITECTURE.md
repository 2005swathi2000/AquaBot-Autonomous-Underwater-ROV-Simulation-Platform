# AquaBot – System Architecture Specification

## 1. Architectural Philosophy
Underwater robotic submersibles operate in complex, GPS-denied environments where RF communications attenuate rapidly, and acoustic or optical sensing dominates. **AquaBot** implements a dual-layer robotics simulation architecture:

1. **Deterministic Physics & Simulation Core**: A self-contained, high-performance Python simulation engine modeling 6-DOF kinematics, 4-DOF active dynamics, hydrodynamic drag, added mass, restoring forces, and simulated acoustic/piezoresistive/inertial sensors.
2. **Robotics Middleware Layer (ROS 2 Humble)**: Standard industrial robotics integration exposing `/cmd_vel`, `/aquabot/imu`, `/aquabot/depth`, and `/aquabot/sonar` topics with C++17 and Python nodes, custom ROS 2 messages, and launch files.
3. **Avionics & Digital Twin Web Interface**: A 60 FPS Three.js/React Three Fiber 3D simulation cockpit with an industrial dark-navy telemetry dashboard, artificial horizon HUD, real-time charts, and supervisory controls.

---

## 2. Block Diagram

```
+-----------------------------------------------------------------------------------+
|                                  USER / OPERATOR                                  |
|   - Directional D-pad & Keyboard Teleop (WASD / RF)                               |
|   - Mission Waypoint Planning & Preset Triggering                                 |
|   - Closed-Loop Depth & Heading Hold Stabilization Toggles                        |
|   - Emergency Stop Trigger & Clear                                                |
+------------------------------------------+----------------------------------------+
                                           |
                                  HTTP REST / WebSocket (20 Hz)
                                           |
+------------------------------------------v----------------------------------------+
|                            FASTAPI BACKEND TELEMETRY SERVER                       |
|   +-----------------------+     +-----------------------+     +-----------------+ |
|   | /ws/telemetry         |     | REST Endpoints        |     | Background Loop | |
|   | Bi-directional Stream |     | Teleop, Waypoints,    |     | 20 Hz Clock     | |
|   | Low-Latency Control   |     | Presets, E-Stop       |     | (dt = 0.05s)    | |
|   +-----------------------+     +-----------------------+     +-----------------+ |
+------------------------------------------+----------------------------------------+
                                           |
+------------------------------------------v----------------------------------------+
|                               SIMULATION ENGINE                                   |
|                                                                                   |
|  +------------------------+      +------------------------+      +--------------+ |
|  |   WAYPOINT NAVIGATOR   | ---> |     ROV CONTROLLER     | ---> |   THRUSTERS  | |
|  | - Waypoint Sequencing  |      | - PID Heading Hold     |      | - 6-Thruster | |
|  | - APF Obstacle Avoid   |      | - PID Depth Hold       |      |   Allocation | |
|  +------------------------+      | - Teleop Mixer         |      | - 1st-Order  | |
|              ^                   +------------------------+      |   Motor Lag  | |
|              |                                                   +-------+------+ |
|              |                                                           |        |
|  +-----------+------------+      +------------------------+              |        |
|  |      SENSOR SUITE      | <--- |      HYDRODYNAMICS     | <------------+        |
|  | - Depth Transducer     |      | - Fossen Equations     | (Thrust Forces &      |
|  | - Multi-beam Sonar     |      | - Added Mass Matrix    |  Yaw Torques)         |
|  | - 6-DOF MEMS IMU       |      | - Linear & Quad Drag   |                       |
|  | - Magnetic Compass     |      | - Restoring Torques    |                       |
|  | - 4S LiPo BMS Model    |      | - Depth/Sea Bounds     |                       |
|  +------------------------+      +------------------------+                       |
+------------------------------------------+----------------------------------------+
                                           |
+------------------------------------------v----------------------------------------+
|                         ROS 2 HUMBLE ROBOTICS WORKSPACE                           |
|  - aquabot_controller (C++17 Node & Python Node, PID Stability)                   |
|  - aquabot_sensors (Publishes /aquabot/depth, /aquabot/sonar, /aquabot/imu)       |
|  - aquabot_navigation (Waypoint guidance, APF reactive avoidance)                 |
|  - aquabot_interfaces (ROVStatus, DepthReading, SonarScan, SetMission, E-Stop)     |
+-----------------------------------------------------------------------------------+
```

---

## 3. Coordinate Frames

### World Frame (North-East-Down - NED)
- **$+X$**: East (meters)
- **$+Y$**: North (meters)
- **$+Z$**: Depth below water surface (meters, positive downwards; $0.2 \le z \le 35.0$)

### Body Frame
- **$+x$ (Surge)**: Longitudinal axis pointing forward
- **$+y$ (Sway)**: Transverse axis pointing to starboard (right)
- **$+z$ (Heave)**: Normal axis pointing down through the keel

### Euler Angles
- **$\phi$ (Roll)**: Rotation about body $+x$ (port up, starboard down)
- **$\theta$ (Pitch)**: Rotation about body $+y$ (bow up, stern down)
- **$\psi$ (Yaw / Heading)**: Rotation about body $+z$ ($0^\circ$ = North, $90^\circ$ = East)

### Three.js 3D Viewport Mapping
Three.js uses a right-handed system where $+Y$ is upwards:
- `Three.X = Robotics.X` (East)
- `Three.Y = -Robotics.Z` (Altitude = -Depth)
- `Three.Z = Robotics.Y` (North)
