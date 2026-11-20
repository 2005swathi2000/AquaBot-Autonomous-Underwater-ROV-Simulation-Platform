# AquaBot – REST & WebSocket API Specification

## 1. Base URLs
- **REST Endpoints**: `http://localhost:8000/api/v1`
- **WebSocket Telemetry**: `ws://localhost:8000/ws/telemetry`

---

## 2. REST Endpoints

### Health Check
- **`GET /health`**
- **Response `200 OK`**:
```json
{
  "status": "HEALTHY",
  "service": "AquaBot-ROV-Simulation-Backend",
  "sim_time": 42.5,
  "rov_mode": "MANUAL",
  "active_ws_clients": 1
}
```

### Telemetry Status
- **`GET /api/v1/status`**
- Returns the complete synchronized state snapshot (kinematics, sensors, navigation, thrusters, and recent charts buffer).

### World Obstacles Map
- **`GET /api/v1/world/obstacles`**
- **Response `200 OK`**:
```json
{
  "bounds": {
    "x": [-35.0, 35.0],
    "y": [-35.0, 35.0],
    "z": [0.2, 35.0]
  },
  "obstacles": [
    {
      "id": "obs-1",
      "name": "Hydrothermal Spire A",
      "shape": "cylinder",
      "x": 8.0,
      "y": 10.0,
      "z": 15.0,
      "radius": 2.5,
      "height": 22.0,
      "color": "#d97706"
    }
  ]
}
```

### Teleoperation Command
- **`POST /api/v1/control/teleop`**
- **Request Body**:
```json
{
  "surge": 0.75,
  "sway": 0.0,
  "heave": -0.2,
  "yaw": 0.15
}
```

### Emergency Stop
- **`POST /api/v1/control/emergency-stop`**
- Instantly sets thruster commands to 0.0 and transitions system state to `EMERGENCY_STOP`.

### Clear Emergency Stop
- **`POST /api/v1/control/clear-emergency-stop`**
- Returns system state to `MANUAL` standby.

### Simulation Reset
- **`POST /api/v1/control/reset`**
- Restores vehicle coordinates to `(0.0, 0.0, 2.0m)`, resets sensor drift, and re-initializes telemetry history.

### Mission Waypoints Configuration
- **`POST /api/v1/mission/waypoints`**
- **Request Body**:
```json
{
  "waypoints": [
    {"x": 6.0, "y": 6.0, "z": 8.0, "name": "Pipe Marker Alpha"},
    {"x": 12.0, "y": -4.0, "z": 12.0, "name": "Pipe Flange 02"}
  ]
}
```

### Mission Lifecycle Actions
- **`POST /api/v1/mission/start`**
- **`POST /api/v1/mission/pause`**
- **`POST /api/v1/mission/resume`**
- **`POST /api/v1/mission/cancel`**
- **`POST /api/v1/mission/preset`** with `{"preset_name": "Pipeline Survey"}`

---

## 3. Real-Time WebSocket Streaming

### Connection
- Connect to `ws://localhost:8000/ws/telemetry`

### Initial Handshake Frame (Server -> Client)
Sent immediately upon connection:
```json
{
  "type": "INIT",
  "world": { "bounds_x": [-35, 35], "obstacles": [...] },
  "telemetry": { ... }
}
```

### 20 Hz Continuous Telemetry Stream (Server -> Client)
Broadcast to all connected clients at 20 frames per second:
```json
{
  "sim_time": 18.25,
  "mode": "AUTONOMOUS",
  "status": "OPERATIONAL",
  "position": { "x": 5.4, "y": 4.8, "z": 7.6 },
  "orientation": { "roll_deg": -1.2, "pitch_deg": 2.1, "yaw_deg": 41.5, "heading_deg": 41.5 },
  "velocity": { "u_surge": 0.62, "v_sway": 0.02, "w_heave": 0.15, "r_yaw_rate": 0.05, "speed_total": 0.64 },
  "sensors": {
    "depth": { "depth_m": 7.62, "pressure_bar": 1.77, "healthy": true },
    "sonar": { "min_distance_m": 4.8, "threat_level": "CAUTION", "closest_target": "Hydrothermal Spire A", "beams": [...] },
    "imu": { "linear_acceleration": { "ax": 0.12, "ay": -0.05, "az": 9.85 }, "angular_velocity": { "wx": 0, "wy": 0, "wz": 0.05 } },
    "compass": { "heading_deg": 41.5, "cardinal": "NE" },
    "battery": { "battery_pct": 98.2, "voltage_v": 15.8, "current_a": 3.4, "power_w": 53.7 }
  },
  "navigation": { "state": "NAVIGATING", "current_wp": { "name": "Pipe Marker Alpha" }, "distance_to_wp_m": 1.4 },
  "system_logs": [...]
}
```

### Client Commands over WebSocket (Client -> Server)
- Teleop: `{"action": "teleop", "surge": 0.7, "sway": 0.0, "heave": 0.0, "yaw": 0.2}`
- Stop: `{"action": "stop"}`
- Emergency Stop: `{"action": "emergency_stop"}`
- Ping: `{"action": "ping"}` -> receives `{"type": "PONG", "time": 18.25}`
