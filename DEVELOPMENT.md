# AquaBot – Autonomous Underwater ROV Simulation: Development Log

This document tracks the phased engineering implementation of the **AquaBot** simulation platform.

## Environment Assessment
- **Host OS**: Windows 11 Home Single Language (64-bit)
- **Memory**: ~8.25 GB Total RAM (~850 MB - 1 GB Free Physical Memory). *Note: System requires lightweight memory footprints, efficient Three.js mesh instances, and optimized backend async loops.*
- **Storage**: ~29 GB Free on C: drive
- **Python**: 3.12.4 (FastAPI 0.115.9, Uvicorn 0.51.0, NumPy 1.26.4, PyTest 7.4.4, WebSockets 15.0.1, Pydantic 2.14.1 available)
- **Node.js**: v22.19.0 / npm 10.9.3
- **Git**: 2.51.0
- **ROS 2 Status on Host**: No native Linux/WSL distribution installed on the Windows host.
  *Design Decision*: Adhering to the specification, the simulation engine is built as an independent, deterministic Python physics and robotics backend powering the live web demo, while a complete, compilable ROS 2 Humble workspace (C++ and Python nodes, messages, launch files, Dockerfile) is provided in `ros2_ws/` for Ubuntu/ROS 2 deployment and portfolio evaluation.

---

## Engineering Roadmap & Status

| Phase | Description | Status |
|---|---|---|
| **Phase 1** | Environment inspection, directory architecture, git repository setup | ✅ COMPLETE |
| **Phase 2** | Standalone simulation engine: hydrodynamics, drag, thrusters, and numerical integration | 🔄 IN PROGRESS |
| **Phase 3** | Sensor suite simulation: depth, sonar raycaster, IMU, compass, battery | ⏳ PENDING |
| **Phase 4** | Autonomous navigation & potential field obstacle avoidance | ⏳ PENDING |
| **Phase 5** | 3D Interactive Web Dashboard (Three.js/R3F, Tailwind CSS, Recharts) | ⏳ PENDING |
| **Phase 6** | Real-time WebSocket telemetry streaming and REST API integration | ⏳ PENDING |
| **Phase 7** | ROS 2 Humble workspace (C++ & Python nodes, msgs, srvs, launch, params) | ⏳ PENDING |
| **Phase 8** | Comprehensive automated test suite (Physics, Navigation, API, Controls) | ⏳ PENDING |
| **Phase 9** | Production deployment configurations (Docker, Vercel, Render) | ⏳ PENDING |
| **Phase 10** | Portfolio documentation, mathematical model, and interview guide | ⏳ PENDING |
