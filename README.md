# AquaBot – Autonomous Underwater ROV Simulation Platform

[![Build & Test](https://img.shields.io/badge/pytest-24%20passed-10b981.svg?style=flat-square)](backend/tests/)
[![ROS 2](https://img.shields.io/badge/ROS%202-Humble%20Ready-38bdf8.svg?style=flat-square&logo=ros)](ros2_ws/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-059669.svg?style=flat-square&logo=fastapi)](backend/)
[![React 18](https://img.shields.io/badge/React-18.3-61dafb.svg?style=flat-square&logo=react)](frontend/)
[![Three.js](https://img.shields.io/badge/Three.js-WebGL%203D-000000.svg?style=flat-square&logo=three.js)](frontend/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4-38bdf8.svg?style=flat-square&logo=tailwindcss)](frontend/)
[![Python](https://img.shields.io/badge/Python-3.12-3776ab.svg?style=flat-square&logo=python)](backend/)
[![C++](https://img.shields.io/badge/C++-17-00599c.svg?style=flat-square&logo=c%2B%2B)](ros2_ws/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)

AquaBot is an open-source, full-stack **Autonomous Underwater Vehicle (AUV / ROV) Simulation & Telemetry System**. Designed as a portfolio-quality robotics software engineering platform, it demonstrates 6-DOF marine vehicle hydrodynamics, 6-thruster vectored allocation, simulated acoustic sonar & piezoresistive depth sensing, reactive Artificial Potential Field (APF) obstacle avoidance, and a high-performance 3D WebGL digital twin.

---

## 1. Problem Statement & Motivation
Underwater robotics presents unique multidisciplinary challenges:
- **GPS-Denied Navigation**: Subsea RF signal attenuation requires dead-reckoning (IMU), acoustic sonar ranging, and hydrostatic pressure depth estimation.
- **Complex Hydrodynamics**: Entrained water creates significant virtual added mass ($\mathbf{M}_A$), while linear skin friction and quadratic form drag resist motion.
- **Safety Interlocks & Obstacle Hazards**: Limited optical visibility necessitates acoustic beam obstacle detection and fail-safe reactive collision avoidance before thruster or hull impact.
- **Real-Time Telemetry & Teleoperation**: Operators require low-latency digital twin cockpits with attitude horizons, thruster diagnostic feedback, and waypoint mission controls.

---

## 2. Core Features

### A. Underwater Hydrodynamics & Physics Engine
- **Decoupled 4-DOF Active Dynamics & 6-DOF Kinematics** based on standard Fossen marine vehicle formulations.
- **Added Mass Effects**: Formulated entrained fluid inertia ($m_{a,x} = 6.0\text{ kg}$, $m_{a,y} = 9.0\text{ kg}$, $m_{a,z} = 9.0\text{ kg}$, $I_{a,z} = 0.25\text{ kg}\cdot\text{m}^2$).
- **Linear & Quadratic Damping**: Dissipates kinetic energy naturally according to $- (D_l \boldsymbol{\nu} + D_q |\boldsymbol{\nu}|\boldsymbol{\nu})$.
- **Hydrostatic Stability**: Self-righting pendulum ballast restores vehicle roll ($\phi$) and pitch ($\theta$).
- **6-Thruster Allocation**: 4 horizontal vectored thrusters mounted at $45^\circ$ angles and 2 vertical heave thrusters with first-order motor lag ($\tau = 0.12\text{ s}$).

### B. Comprehensive Simulated Sensor Suite
- **Digital Depth Sensor**: Models piezoresistive pressure cells with Gaussian measurement noise ($\sigma = 0.02\text{ m}$) and converts depth to hydrostatic pressure in bar/kPa ($P = P_{\text{atm}} + \rho g z$).
- **Forward-Looking Acoustic Sonar**: 7-beam forward acoustic fan ($\text{FOV} = 90^\circ$, range $25\text{ m}$) detecting seabed geological pillars, submerged pipes, and obstacles.
- **6-DOF MEMS IMU**: Body-frame accelerometers (incorporating gravity vector projections based on Euler attitude) and gyroscopes with bias drift.
- **Digital Compass**: Magnetic heading in degrees with cardinal orientation output.
- **Battery Management System (BMS)**: 4S LiPo battery pack ($15.6\text{ Ah}$, $230\text{ Wh}$) with non-linear voltage discharge curves, internal resistance voltage sag under load, and runtime estimation.

### C. Autonomous Guidance & Obstacle Avoidance
- **3D Waypoint Navigation**: Sequential waypoint guidance with acceptance threshold evaluation and cross-track alignment.
- **Reactive Artificial Potential Field (APF)**: Synthesizes attractive forces toward active waypoints and inverse-quadratic repulsive forces away from sonar obstacle detections.
- **Collinear Symmetry Breaking**: Resolves deadlock when obstacles are directly dead ahead by injecting a maritime starboard-turn bias.
- **Critical Emergency Reverse**: Automatically triggers negative surge thrust ($u = -0.4\text{ m/s}$) when obstacle clearance drops below $1.6\text{ m}$.

### D. Interactive 3D WebGL Digital Twin & Dashboard
- **Three.js 3D Viewport**: Ocean fog, dynamic caustic lighting, detailed 3D ROV model with spinning thruster propellers, seabed sand grid, and procedural geological obstacles.
- **Visualized Sonar Beams**: 7 colored acoustic laser rays that dynamically change color: **Cyan** (> 5m), **Yellow** (2.5m - 5m), **Red** (< 1.6m).
- **Multiple Camera Perspectives**: Smooth Chase Camera, 360° Free Orbit Navigation, First-Person (FPV) Nose Camera, and Top-Down Tactical Sonar Map.
- **Avionics HUD Overlay**: Fighter-cockpit style Pitch & Roll Artificial Horizon reticle and Heading tape.
- **Telemetry Performance Charts**: Real-time Recharts graphs for Depth profile, Velocity, Sonar obstacle distance, and Battery state of charge.

---

## 3. System Architecture

```
+-----------------------------------------------------------------------------------+
|                         AQUABOT 3D WEB DASHBOARD (REACT / TS)                     |
|  - Three.js 60 FPS Digital Twin      - Avionics Horizon HUD                       |
|  - Recharts Telemetry Charts         - Directional Flight Controls & Keyboard     |
|  - Mission Waypoint Planner          - System Event Audit Terminal                |
+------------------------------------------+----------------------------------------+
                                           |
                              WebSocket (20 Hz) / REST API
                                           |
+------------------------------------------v----------------------------------------+
|                          FASTAPI & PYTHON 3.12 BACKEND ENGINE                     |
|  - Deterministic 20 Hz Simulation Loop (asyncio)                                  |
|  - Hydrodynamics (Fossen Drag & Added Mass)                                       |
|  - 6-Thruster Allocation Matrix & Power Model                                     |
|  - Sensor Suite (Depth, Acoustic Sonar, IMU, Compass, BMS)                        |
|  - Autonomous Navigation Executive & Potential Field Obstacle Avoidance           |
+------------------------------------------+----------------------------------------+
                                           |
+------------------------------------------v----------------------------------------+
|                      ROS 2 HUMBLE ROBOTICS WORKSPACE (ros2_ws)                    |
|  - aquabot_controller: C++17 & Python Nodes with closed-loop PID depth/heading    |
|  - aquabot_sensors: Publishes /aquabot/depth, /aquabot/sonar, /aquabot/imu, etc.  |
|  - aquabot_navigation: Waypoint follower & reactive obstacle detector node       |
|  - aquabot_interfaces: Custom ROS 2 msgs (ROVStatus, DepthReading, SonarScan)     |
+-----------------------------------------------------------------------------------+
```

---

## 4. Technical Stack

| Layer | Technologies |
|---|---|
| **Backend & Robotics** | Python 3.12, C++17, NumPy, ROS 2 Humble, Uvicorn |
| **API & Streaming** | FastAPI, WebSockets (20 Hz push), Pydantic v2 |
| **Frontend UI/UX** | React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons |
| **3D Simulation** | Three.js (WebGL), Canvas, Procedural Geometry Shaders |
| **Telemetry Charting** | Recharts (Depth, Velocity, Battery, Sonar Clearance) |
| **Testing** | PyTest (24 unit & integration tests), HTTPX |
| **DevOps & Containers** | Docker, Docker Compose, Vercel, Render Blueprint |

---

## 5. Mathematical Modeling & Hydrodynamics

The decoupled equations of motion for the 4 active degrees of freedom are:

$$M_x \dot{u} = T_x - D_{l,x} u - D_{q,x} |u| u$$
$$M_y \dot{v} = T_y - D_{l,y} v - D_{q,y} |v| v$$
$$M_z \dot{w} = T_z - D_{l,z} w - D_{q,z} |w| w + (B - W)$$
$$I_z \dot{r} = \tau_z - D_{l,\psi} r - D_{q,\psi} |r| r$$

Where:
- $M_x = m + m_{a,x} = 12.5 + 6.0 = 18.5\text{ kg}$
- $M_y = m + m_{a,y} = 12.5 + 9.0 = 21.5\text{ kg}$
- $M_z = m + m_{a,z} = 12.5 + 9.0 = 21.5\text{ kg}$
- $I_z = I_{zz} + I_{a,z} = 0.45 + 0.25 = 0.70\text{ kg}\cdot\text{m}^2$
- Net buoyancy $(B - W) = +0.8\text{ N}$ (failsafe positive buoyancy)

### 6-Thruster Allocation Matrix:
$$\begin{bmatrix} T_x \\ T_y \\ T_z \\ \tau_z \end{bmatrix} = \begin{bmatrix}
\frac{\sqrt{2}}{2} & \frac{\sqrt{2}}{2} & \frac{\sqrt{2}}{2} & \frac{\sqrt{2}}{2} & 0 & 0 \\
-\frac{\sqrt{2}}{2} & \frac{\sqrt{2}}{2} & \frac{\sqrt{2}}{2} & -\frac{\sqrt{2}}{2} & 0 & 0 \\
0 & 0 & 0 & 0 & 1 & 1 \\
-L & L & -L & L & 0 & 0
\end{bmatrix} \begin{bmatrix} T_1 \\ T_2 \\ T_3 \\ T_4 \\ T_5 \\ T_6 \end{bmatrix}$$

### Artificial Potential Field (APF):
$$\mathbf{F}_{\text{total}} = k_{\text{att}} \cdot \hat{\mathbf{u}}_{\text{goal}} - \sum_{i} k_{\text{rep}} \left( \frac{1}{d_i} - \frac{1}{D_{\text{inf}}} \right) \frac{1}{d_i^2} \hat{\mathbf{u}}_{\text{beam}, i}$$

---

## 6. Quick Start & Local Installation

### Prerequisites
- Python 3.10+ (tested on Python 3.12.4)
- Node.js 18+ (tested on v22.19.0)
- Git

### 1. Clone Repository
```bash
git clone https://github.com/<username>/aquabot.git
cd aquabot
```

### 2. Launch FastAPI Backend
```bash
# Install Python dependencies
pip install -r backend/requirements.txt

# Run backend simulation server (port 8000)
python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 3. Launch React 3D Dashboard
In a second terminal:
```bash
cd frontend
npm install
npm run dev
```
Open **`http://localhost:5173`** in your browser.

---

## 7. ROS 2 Humble Integration Guide

AquaBot provides a clean, standalone ROS 2 workspace in `ros2_ws/`.

### Topic Dictionary
- `/cmd_vel` (`geometry_msgs/msg/Twist`): Commanded velocities (surge, sway, heave, yaw rate)
- `/aquabot/thruster_forces` (`std_msgs/msg/Float32MultiArray`): 6-thruster output forces
- `/aquabot/depth` (`aquabot_interfaces/msg/DepthReading`): Piezoresistive depth and pressure
- `/aquabot/sonar` (`aquabot_interfaces/msg/SonarScan`): Multi-beam acoustic sonar ranges
- `/aquabot/imu` (`sensor_msgs/msg/Imu`): Accelerometer, Gyroscope, Orientation quaternion
- `/aquabot/status` (`aquabot_interfaces/msg/ROVStatus`): ROV operating state and battery

### Services
- `/aquabot/emergency_stop` (`aquabot_interfaces/srv/EmergencyStop`): Trigger or clear thruster cutoff
- `/aquabot/set_mission` (`aquabot_interfaces/srv/SetMission`): Upload waypoint mission list

### Building on Ubuntu 22.04 LTS (ROS 2 Humble)
```bash
cd ros2_ws
source /opt/ros/humble/setup.bash
colcon build --symlink-install
source install/setup.bash
ros2 launch aquabot_navigation aquabot_bringup.launch.py
```

### Running with Docker
```bash
cd ros2_ws
docker build -t aquabot-ros2:humble .
docker run -it --rm aquabot-ros2:humble
```

---

## 8. Automated Test Suite & Verification Results

The automated test suite verifies physics kinematics, drag limits, sensor data generation, collision detection, and API endpoints.

```bash
python -m pytest backend/tests -v
```

### Actual Test Execution Output:
```
============================= test session starts =============================
platform win32 -- Python 3.12.4, pytest-7.4.4
rootdir: C:\Users\CHARAN\.gemini\antigravity\scratch\aquabot
collected 24 items

backend/tests/test_api.py::test_health_check_endpoint PASSED             [  4%]
backend/tests/test_api.py::test_get_status_endpoint PASSED               [  8%]
backend/tests/test_api.py::test_teleop_endpoint PASSED                   [ 12%]
backend/tests/test_api.py::test_emergency_stop_and_reset_endpoints PASSED [ 16%]
backend/tests/test_api.py::test_mission_endpoints PASSED                 [ 20%]
backend/tests/test_api.py::test_world_obstacles_endpoint PASSED          [ 25%]
backend/tests/test_engine.py::test_simulation_engine_step PASSED         [ 29%]
backend/tests/test_engine.py::test_emergency_stop_and_reset PASSED       [ 33%]
backend/tests/test_hydrodynamics.py::test_hydrodynamics_drag_deceleration PASSED [ 37%]
backend/tests/test_hydrodynamics.py::test_hydrodynamics_depth_limits PASSED [ 41%]
backend/tests/test_hydrodynamics.py::test_hydrodynamics_velocity_limits PASSED [ 45%]
backend/tests/test_live_e2e.py::test_live_rest_and_websocket PASSED      [ 50%]
backend/tests/test_navigation.py::test_waypoint_sequencing PASSED        [ 54%]
backend/tests/test_navigation.py::test_mission_pause_resume_cancel PASSED [ 58%]
backend/tests/test_obstacle_avoidance.py::test_obstacle_avoidance_clear PASSED [ 62%]
backend/tests/test_obstacle_avoidance.py::test_obstacle_avoidance_repulsion PASSED [ 66%]
backend/tests/test_obstacle_avoidance.py::test_emergency_reverse_critical_zone PASSED [ 70%]
backend/tests/test_sensors.py::test_depth_sensor_readings PASSED         [ 75%]
backend/tests/test_sensors.py::test_sonar_sensor_obstacle_detection PASSED [ 79%]
backend/tests/test_sensors.py::test_compass_cardinal_and_noise PASSED    [ 83%]
backend/tests/test_sensors.py::test_battery_drain PASSED                 [ 87%]
backend/tests/test_thruster_model.py::test_thruster_allocation_forward PASSED [ 91%]
backend/tests/test_thruster_model.py::test_thruster_heave_allocation PASSED [ 95%]
backend/tests/test_thruster_model.py::test_thruster_first_order_lag PASSED [100%]

============================= 24 passed in 2.38s ==============================
```

---

## 9. Deployment Architecture

AquaBot is architected for dual-target zero-configuration deployment:
- **Frontend**: Deploys statically to **Vercel** (`vercel.json`) with sub-second asset delivery and client-side fallback simulation capability.
- **Backend**: Deploys as a containerized web service to **Render** or **Railway** (`render.yaml` & `Dockerfile`) supporting continuous 20 Hz WebSockets and REST APIs.

---

## 10. Design Decisions & Interview Talking Points

1. **Why decouple the Simulation Engine from ROS 2?**
   In web production and portfolio reviews, evaluators frequently lack an active Ubuntu ROS 2 Humble installation on their host. Decoupling the deterministic Python simulation engine allows immediate, frictionless evaluation via web browser, while providing complete, compilable ROS 2 packages (`ros2_ws/`) demonstrating standard middleware expertise.
2. **How is collinear symmetry broken in Potential Fields?**
   Standard APF algorithms suffer from local minima when an obstacle lies precisely on the line of sight between the vehicle and target ($F_{\text{rep}}$ directly cancels $F_{\text{att}}$). AquaBot resolves this by injecting a lateral clearance torque proportional to obstacle proximity following maritime starboard-turn conventions.
3. **Why use both Linear and Quadratic Drag?**
   Underwater vehicles operate in intermediate Reynolds number regimes ($10^3 < Re < 10^5$). Linear drag accounts for viscous boundary layer skin friction at low velocities, while quadratic drag accounts for turbulent pressure wake separation at cruise speeds.

---

## 11. Known Limitations & Future Roadmap
- **Ocean Currents & Wave Spectrum**: Adding Pierson-Moskowitz wave spectrums and stochastic subsea cross-current vectors.
- **Doppler Velocity Log (DVL)**: Adding 4-beam acoustic Janus DVL sensor models for bottom-tracking velocity estimation.
- **Gazebo / SITL Bridge**: Bridging the Python simulation directly with Gazebo Fortress/Garden over `ros_gz_bridge`.

---

## 12. Author & License
- Developed by: **B.Tech Information Technology - Robotics Software Intern Candidate**
- License: **MIT License**
