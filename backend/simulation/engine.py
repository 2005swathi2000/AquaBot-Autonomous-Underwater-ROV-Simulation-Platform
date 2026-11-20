"""
AquaBot - Core Autonomous Underwater Simulation Engine
Glues Hydrodynamics, Thrusters, World Model, Sensors, Controllers, and Navigation.
Runs deterministic physics integration at 20 Hz with telemetry history and event auditing.
"""

import time
import math
from typing import Dict, Any, List, Optional
from collections import deque

from .hydrodynamics import ROVHydrodynamics
from .thruster_model import ThrusterModel
from .world import UnderwaterWorld, UnderwaterObstacle
from ..sensors.sensor_suite import SensorSuite
from ..controllers.rov_controller import ROVController
from ..navigation.waypoint_navigator import WaypointNavigator


class SimulationEngine:
    def __init__(self):
        # Physics components
        self.hydrodynamics = ROVHydrodynamics()
        self.thrusters = ThrusterModel()
        self.world = UnderwaterWorld()
        self.sensors = SensorSuite(world=self.world)
        self.controller = ROVController()
        self.navigator = WaypointNavigator()

        # Simulation Time and Rate
        self.dt: float = 0.05  # 20 Hz update loop
        self.sim_time: float = 0.0
        self.is_running: bool = True
        self.is_paused: bool = False

        # Vehicle State Dictionary
        self.state: Dict[str, float] = self._initial_state()

        # Telemetry History Ring Buffers (for live graphing)
        self.history_max_len = 120
        self.history_time = deque(maxlen=self.history_max_len)
        self.history_depth = deque(maxlen=self.history_max_len)
        self.history_speed = deque(maxlen=self.history_max_len)
        self.history_battery = deque(maxlen=self.history_max_len)
        self.history_obstacle_dist = deque(maxlen=self.history_max_len)

        # System Event Log Buffer
        self.system_logs = deque(maxlen=60)
        self.log_event("INFO", "AquaBot ROV Simulation Engine initialized successfully.")

        # Load default waypoints
        self.load_preset_mission("Pipeline Survey")

    def _initial_state(self) -> Dict[str, float]:
        return {
            "x": 0.0,
            "y": 0.0,
            "z": 2.0,      # Initial operating depth: 2 meters
            "roll": 0.0,
            "pitch": 0.0,
            "yaw": 0.0,    # Radians
            "u": 0.0,      # Surge (m/s)
            "v": 0.0,      # Sway (m/s)
            "w": 0.0,      # Heave (m/s)
            "r": 0.0,      # Yaw rate (rad/s)
            "vx_world": 0.0,
            "vy_world": 0.0,
            "vz_world": 0.0,
            "speed": 0.0,
            "accel_u": 0.0,
            "accel_v": 0.0,
            "accel_w": 0.0,
            "accel_r": 0.0,
        }

    def log_event(self, level: str, message: str):
        event = {
            "time": round(self.sim_time, 2),
            "timestamp": time.strftime("%H:%M:%S"),
            "level": level,  # "INFO", "WARN", "ERROR", "SUCCESS"
            "message": message
        }
        self.system_logs.appendleft(event)

    def reset(self):
        """Resets simulation back to initial home state."""
        self.state = self._initial_state()
        self.thrusters.reset()
        self.sensors.reset()
        self.controller.reset(initial_depth=2.0, initial_yaw=0.0)
        self.navigator.clear()
        self.load_preset_mission("Pipeline Survey")
        self.sim_time = 0.0
        self.history_time.clear()
        self.history_depth.clear()
        self.history_speed.clear()
        self.history_battery.clear()
        self.history_obstacle_dist.clear()
        self.log_event("INFO", "Simulation reset to surface mooring home state (0.0, 0.0, 2.0m).")

    def step(self, custom_dt: Optional[float] = None, dt: Optional[float] = None) -> Dict[str, Any]:
        """
        Executes one discrete simulation step:
        1. Evaluates autonomous navigation and reactive obstacle avoidance
        2. Computes PID and thruster control commands
        3. Integrates hydrodynamic forces and kinematics
        4. Updates simulated sensors
        5. Logs metrics
        """
        if self.is_paused:
            return self.get_telemetry()

        step_dt = custom_dt or dt or self.dt
        self.sim_time += step_dt

        # 1. Update Autonomous Navigation if active
        auto_surge = 0.0
        auto_heading = self.state["yaw"]
        auto_depth = self.state["z"]

        # Peek at sensor readings for guidance
        sonar_snapshot = self.sensors.sonar_sensor.read(
            self.state["x"], self.state["y"], self.state["z"], self.state["yaw"]
        )

        if self.controller.mode == "AUTONOMOUS":
            cmd_surge, cmd_head, cmd_dep, nav_event = self.navigator.compute_guidance(
                rov_x=self.state["x"],
                rov_y=self.state["y"],
                rov_z=self.state["z"],
                rov_yaw=self.state["yaw"],
                sonar_readings=sonar_snapshot
            )
            auto_surge = cmd_surge
            auto_heading = cmd_head
            auto_depth = cmd_dep

            if "MISSION_COMPLETED" in nav_event:
                self.log_event("SUCCESS", nav_event)
                self.controller.mode = "MANUAL"
            elif "WAYPOINT_REACHED" in nav_event:
                self.log_event("INFO", nav_event)
            elif "AVOIDING" in nav_event:
                self.log_event("WARN", f"Obstacle alert! Reactive potential field avoiding obstacle.")
            elif "EMERGENCY_REVERSE" in nav_event:
                self.log_event("ERROR", f"Critical proximity hazard! Emergency avoidance reversing.")

        # 2. Compute Thruster Commands through Controller
        c_surge, c_sway, c_heave, c_yaw = self.controller.compute_thruster_commands(
            current_depth=self.state["z"],
            current_yaw=self.state["yaw"],
            auto_surge=auto_surge,
            auto_heading=auto_heading,
            auto_depth=auto_depth,
            dt=step_dt
        )

        # 3. Thruster Actuator Dynamics & Power
        thrust_x, thrust_y, thrust_z, torque_z, thruster_diag = self.thrusters.step(
            cmd_surge=c_surge,
            cmd_sway=c_sway,
            cmd_heave=c_heave,
            cmd_yaw=c_yaw,
            dt=step_dt
        )

        # 4. Integrate Hydrodynamic Equations of Motion
        self.state = self.hydrodynamics.step(
            state=self.state,
            thrust_x=thrust_x,
            thrust_y=thrust_y,
            thrust_z=thrust_z,
            torque_z=torque_z,
            dt=step_dt
        )

        # 5. Update All Sensors
        sensor_data = self.sensors.update(
            rov_state=self.state,
            power_consumption_w=thruster_diag["power_consumption_w"],
            dt=step_dt
        )

        # 6. Safety Interlocks & History
        # If battery critical or emergency stop triggered
        if sensor_data["battery"]["critical_battery"] and self.controller.mode != "EMERGENCY_STOP":
            self.controller.trigger_emergency_stop()
            self.log_event("ERROR", "CRITICAL BATTERY DEPLETION! Autonomous failsafe emergency stop activated.")

        # Update History Ring Buffers
        self.history_time.append(round(self.sim_time, 2))
        self.history_depth.append(round(self.state["z"], 2))
        self.history_speed.append(round(self.state["speed"], 2))
        self.history_battery.append(sensor_data["battery"]["battery_pct"])
        self.history_obstacle_dist.append(sensor_data["sonar"]["min_distance_m"])

        return self.get_telemetry(sensor_data=sensor_data, thruster_diag=thruster_diag)

    def teleop(self, surge: float, sway: float, heave: float, yaw: float):
        """Processes operator manual control inputs."""
        self.controller.set_teleop(surge, sway, heave, yaw)

    def emergency_stop(self):
        """Instant thruster cutoff and emergency hold."""
        self.controller.trigger_emergency_stop()
        self.navigator.cancel_mission()
        self.log_event("ERROR", "EMERGENCY STOP manually triggered. Thrusters disengaged.")

    def clear_emergency_stop(self):
        self.controller.clear_emergency_stop(self.state["z"], self.state["yaw"])
        self.log_event("INFO", "Emergency stop cleared. ROV returned to Manual standby.")

    def start_mission(self) -> bool:
        success = self.navigator.start_mission()
        if success:
            self.controller.mode = "AUTONOMOUS"
            self.log_event("SUCCESS", f"Autonomous mission initiated with {len(self.navigator.waypoints)} waypoints.")
        else:
            self.log_event("WARN", "Cannot start mission: no waypoints defined.")
        return success

    def pause_mission(self):
        self.navigator.pause_mission()
        self.controller.mode = "MANUAL"
        self.log_event("INFO", "Autonomous mission paused. Switched to manual control.")

    def resume_mission(self):
        self.navigator.resume_mission()
        self.controller.mode = "AUTONOMOUS"
        self.log_event("INFO", "Autonomous mission resumed.")

    def cancel_mission(self):
        self.navigator.cancel_mission()
        self.controller.mode = "MANUAL"
        self.log_event("WARN", "Autonomous mission aborted.")

    def load_preset_mission(self, name: str):
        """Loads vetted standard underwater mission profiles."""
        presets = {
            "Pipeline Survey": [
                {"x": 6.0, "y": 6.0, "z": 8.0, "name": "Pipe Marker Alpha"},
                {"x": 12.0, "y": -4.0, "z": 12.0, "name": "Pipe Flange 02"},
                {"x": 18.0, "y": -12.0, "z": 14.0, "name": "Manifold Beta"},
                {"x": 4.0, "y": -16.0, "z": 10.0, "name": "Inspection Return"},
                {"x": 0.0, "y": 0.0, "z": 2.0, "name": "Home Mooring"},
            ],
            "Obstacle Slalom": [
                {"x": 4.0, "y": 14.0, "z": 12.0, "name": "Spire Gate 1"},
                {"x": -8.0, "y": 16.0, "z": 15.0, "name": "Thermal Vent Transit"},
                {"x": -16.0, "y": 8.0, "z": 18.0, "name": "Ridge Bypass"},
                {"x": -10.0, "y": -6.0, "z": 12.0, "name": "Sunken Column Recon"},
                {"x": 0.0, "y": 0.0, "z": 2.0, "name": "Base Return"},
            ],
            "Deep Trench Dive": [
                {"x": 5.0, "y": 5.0, "z": 10.0, "name": "Shallow Shelf"},
                {"x": 10.0, "y": 10.0, "z": 20.0, "name": "Abyssal Descent"},
                {"x": 12.0, "y": 12.0, "z": 28.0, "name": "Deep Vent Observation"},
                {"x": 0.0, "y": 0.0, "z": 5.0, "name": "Surface Ascend"},
            ]
        }
        if name in presets:
            self.navigator.set_waypoints(presets[name])
            self.log_event("INFO", f"Loaded mission preset: '{name}' ({len(presets[name])} waypoints).")

    def get_telemetry(
        self,
        sensor_data: Optional[Dict[str, Any]] = None,
        thruster_diag: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Assembles comprehensive telemetry payload for WebSocket / REST clients."""
        if sensor_data is None:
            sensor_data = self.sensors.update(self.state, power_consumption_w=14.0, dt=0.0)

        if thruster_diag is None:
            thruster_diag = {
                "thruster_powers_pct": [round(float(f / self.thrusters.max_thrust_fwd * 100), 1) for f in self.thrusters.thruster_forces],
                "thruster_forces_n": [round(float(f), 2) for f in self.thrusters.thruster_forces],
                "power_consumption_w": 14.0,
            }

        return {
            "sim_time": round(self.sim_time, 2),
            "mode": self.controller.mode,
            "status": "OPERATIONAL" if self.controller.mode != "EMERGENCY_STOP" else "EMERGENCY_STOP",
            "position": {
                "x": round(self.state["x"], 2),
                "y": round(self.state["y"], 2),
                "z": round(self.state["z"], 2), # Depth (positive down)
            },
            "orientation": {
                "roll_deg": round(math.degrees(self.state["roll"]), 1),
                "pitch_deg": round(math.degrees(self.state["pitch"]), 1),
                "yaw_deg": round(math.degrees(self.state["yaw"]) % 360.0, 1),
                "heading_deg": round(math.degrees(self.state["yaw"]) % 360.0, 1),
            },
            "velocity": {
                "u_surge": round(self.state["u"], 2),
                "v_sway": round(self.state["v"], 2),
                "w_heave": round(self.state["w"], 2),
                "r_yaw_rate": round(self.state["r"], 3),
                "speed_total": round(self.state["speed"], 2),
            },
            "sensors": sensor_data,
            "thrusters": thruster_diag,
            "navigation": self.navigator.get_status_dict(
                self.state["x"], self.state["y"], self.state["z"]
            ),
            "charts": {
                "time": list(self.history_time),
                "depth": list(self.history_depth),
                "speed": list(self.history_speed),
                "battery": list(self.history_battery),
                "obstacle_dist": list(self.history_obstacle_dist),
            },
            "system_logs": list(self.system_logs),
        }
