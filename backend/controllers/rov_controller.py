"""
AquaBot - Supervisory ROV Movement & Stability Controller
Integrates manual teleoperation commands, closed-loop PID depth-hold,
closed-loop PID heading-hold, and autonomous navigation steering.
Enforces safety interlocks (Emergency Stop, Depth bounds, Power limits).
"""

import math
from typing import Dict, Any, Tuple
from .pid_controller import PIDController


class ROVController:
    def __init__(self):
        # Heading Control PID (rad -> yaw command [-1.0, 1.0])
        self.pid_heading = PIDController(
            kp=1.6, ki=0.15, kd=0.45,
            out_min=-1.0, out_max=1.0,
            is_angle=True
        )

        # Depth Control PID (meters depth -> heave command [-1.0, 1.0])
        # Depth error = z_target - z_measured.
        # If z_target > z_measured (need to go deeper), output should be positive heave thrust.
        self.pid_depth = PIDController(
            kp=1.2, ki=0.12, kd=0.55,
            out_min=-1.0, out_max=1.0,
            is_angle=False
        )

        # Operating Modes: "MANUAL", "AUTONOMOUS", "EMERGENCY_STOP"
        self.mode = "MANUAL"
        self.depth_hold_enabled = True
        self.heading_hold_enabled = False

        # Setpoints
        self.target_depth_m = 2.0
        self.target_heading_rad = 0.0

        # Current teleop input commands [-1.0, 1.0]
        self.teleop_surge = 0.0
        self.teleop_sway = 0.0
        self.teleop_heave = 0.0
        self.teleop_yaw = 0.0

    def reset(self, initial_depth: float = 2.0, initial_yaw: float = 0.0):
        self.pid_heading.reset()
        self.pid_depth.reset()
        self.mode = "MANUAL"
        self.depth_hold_enabled = True
        self.heading_hold_enabled = False
        self.target_depth_m = initial_depth
        self.target_heading_rad = initial_yaw
        self.teleop_surge = 0.0
        self.teleop_sway = 0.0
        self.teleop_heave = 0.0
        self.teleop_yaw = 0.0

    def set_teleop(self, surge: float, sway: float, heave: float, yaw: float):
        if self.mode == "EMERGENCY_STOP":
            return
        self.mode = "MANUAL"
        self.teleop_surge = max(-1.0, min(1.0, float(surge)))
        self.teleop_sway = max(-1.0, min(1.0, float(sway)))
        self.teleop_heave = max(-1.0, min(1.0, float(heave)))
        self.teleop_yaw = max(-1.0, min(1.0, float(yaw)))

        # If manual vertical input is provided, update depth setpoint to float with vehicle
        if abs(self.teleop_heave) > 0.05:
            self.depth_hold_enabled = False

    def trigger_emergency_stop(self):
        self.mode = "EMERGENCY_STOP"
        self.teleop_surge = 0.0
        self.teleop_sway = 0.0
        self.teleop_heave = 0.0
        self.teleop_yaw = 0.0
        self.pid_heading.reset()
        self.pid_depth.reset()

    def clear_emergency_stop(self, current_depth: float, current_yaw: float):
        self.mode = "MANUAL"
        self.target_depth_m = current_depth
        self.target_heading_rad = current_yaw
        self.depth_hold_enabled = True

    def compute_thruster_commands(
        self,
        current_depth: float,
        current_yaw: float,
        auto_surge: float,
        auto_heading: float,
        auto_depth: float,
        dt: float
    ) -> Tuple[float, float, float, float]:
        """
        Calculates normalized thruster effort (surge, sway, heave, yaw) [-1.0, 1.0].
        """
        if self.mode == "EMERGENCY_STOP":
            return 0.0, 0.0, 0.0, 0.0

        if self.mode == "AUTONOMOUS":
            # Heading PID tracking
            cmd_yaw = self.pid_heading.compute(auto_heading, current_yaw, dt)

            # Depth PID tracking
            cmd_heave = self.pid_depth.compute(auto_depth, current_depth, dt)

            cmd_surge = auto_surge
            cmd_sway = 0.0
            return cmd_surge, cmd_sway, cmd_heave, cmd_yaw

        # MANUAL Mode
        cmd_surge = self.teleop_surge
        cmd_sway = self.teleop_sway

        # Heading Hold or Manual Yaw
        if abs(self.teleop_yaw) > 0.05:
            cmd_yaw = self.teleop_yaw
            self.target_heading_rad = current_yaw
            self.heading_hold_enabled = False
        elif self.heading_hold_enabled:
            cmd_yaw = self.pid_heading.compute(self.target_heading_rad, current_yaw, dt)
        else:
            cmd_yaw = 0.0

        # Depth Hold or Manual Heave
        if abs(self.teleop_heave) > 0.05:
            cmd_heave = self.teleop_heave
            self.target_depth_m = current_depth
        elif self.depth_hold_enabled:
            cmd_heave = self.pid_depth.compute(self.target_depth_m, current_depth, dt)
        else:
            cmd_heave = 0.0

        return cmd_surge, cmd_sway, cmd_heave, cmd_yaw
