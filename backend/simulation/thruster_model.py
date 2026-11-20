"""
AquaBot - 6-Thruster Dynamics & Allocation Model
Implements a 6-thruster vectored configuration typical of commercial underwater ROVs
(4 horizontal vectored thrusters at 45-degree angles, 2 vertical heave thrusters).
Includes first-order actuator lag and electrical power estimation.
"""

import numpy as np
from typing import Dict, List, Tuple, Any


class ThrusterModel:
    def __init__(self):
        # Maximum force per individual thruster (Newtons)
        self.max_thrust_fwd: float = 32.0  # Max forward thrust (N)
        self.max_thrust_rev: float = 24.0  # Max reverse thrust (N)
        
        # Actuator dynamics: First-order low pass filter time constant (seconds)
        self.tau: float = 0.12  # ~120 ms mechanical response time
        
        # State of 6 thruster forces: [T1, T2, T3, T4, T5, T6]
        # T1: Forward Starboard (45 deg)
        # T2: Forward Port (45 deg)
        # T3: Aft Starboard (45 deg)
        # T4: Aft Port (45 deg)
        # T5: Vertical Starboard
        # T6: Vertical Port
        self.thruster_forces = np.zeros(6, dtype=np.float64)
        
        # Moment arm distance from center of mass (m)
        self.arm_x: float = 0.22
        self.arm_y: float = 0.18
        
        # Base electrical power consumption (computer, electronics, sensors in Watts)
        self.p_base_electronics: float = 14.0  # Watts
        self.p_thrust_factor: float = 2.4     # W per N^1.5

    def reset(self):
        self.thruster_forces = np.zeros(6, dtype=np.float64)

    def allocate(
        self,
        cmd_surge: float,
        cmd_sway: float,
        cmd_heave: float,
        cmd_yaw: float
    ) -> np.ndarray:
        """
        Transforms normalized control commands [-1.0, 1.0] into target thrust forces for each thruster.
        """
        # Clamp commands to valid input ranges
        surge = np.clip(cmd_surge, -1.0, 1.0)
        sway = np.clip(cmd_sway, -1.0, 1.0)
        heave = np.clip(cmd_heave, -1.0, 1.0)
        yaw = np.clip(cmd_yaw, -1.0, 1.0)

        # Vectored 45-degree horizontal thruster allocation matrix
        # T1 (Front-Right): +surge -sway -yaw
        # T2 (Front-Left):  +surge +sway +yaw
        # T3 (Rear-Right):   +surge +sway -yaw
        # T4 (Rear-Left):    +surge -sway +yaw
        # T5 (Vert-Right):  +heave
        # T6 (Vert-Left):   +heave
        t1_norm = surge - sway - yaw
        t2_norm = surge + sway + yaw
        t3_norm = surge + sway - yaw
        t4_norm = surge - sway + yaw
        t5_norm = heave
        t6_norm = heave

        # Normalize horizontal thrusters if saturation occurs
        horiz_max = max(abs(t1_norm), abs(t2_norm), abs(t3_norm), abs(t4_norm), 1.0)
        t1_norm /= horiz_max
        t2_norm /= horiz_max
        t3_norm /= horiz_max
        t4_norm /= horiz_max

        targets = np.array([t1_norm, t2_norm, t3_norm, t4_norm, t5_norm, t6_norm], dtype=np.float64)

        # Scale by maximum forward/reverse thrust limits
        target_forces = np.zeros(6, dtype=np.float64)
        for i in range(6):
            if targets[i] >= 0.0:
                target_forces[i] = targets[i] * self.max_thrust_fwd
            else:
                target_forces[i] = targets[i] * self.max_thrust_rev

        return target_forces

    def step(
        self,
        cmd_surge: float,
        cmd_sway: float,
        cmd_heave: float,
        cmd_yaw: float,
        dt: float
    ) -> Tuple[float, float, float, float, Dict[str, Any]]:
        """
        Updates thruster dynamic forces with first-order mechanical lag, returns resulting
        body forces (Fx, Fy, Fz) and torque Tz, along with thruster diagnostics.
        """
        target_forces = self.allocate(cmd_surge, cmd_sway, cmd_heave, cmd_yaw)

        # First-order lag filter: dT = (T_target - T) * (dt / tau)
        alpha = 1.0 - np.exp(-dt / self.tau)
        self.thruster_forces += (target_forces - self.thruster_forces) * alpha

        # Compute resulting body forces from thruster geometry
        # Angle is 45 degrees: cos(45) = sin(45) = sqrt(2)/2 ~= 0.7071
        c45 = 0.70710678
        t1, t2, t3, t4, t5, t6 = self.thruster_forces

        thrust_x = (t1 + t2 + t3 + t4) * c45
        thrust_y = (-t1 + t2 + t3 - t4) * c45
        thrust_z = t5 + t6
        # Yaw torque about vertical axis: arm_lever * force
        lever = (self.arm_x + self.arm_y) * c45
        torque_z = (-t1 + t2 - t3 + t4) * lever

        # Electrical power calculation
        # Thruster power ~ factor * force^1.5
        thruster_power = float(np.sum(self.p_thrust_factor * (np.abs(self.thruster_forces) ** 1.5)))
        total_power_watts = self.p_base_electronics + thruster_power

        telemetry = {
            "thruster_powers_pct": [round(float(f / self.max_thrust_fwd * 100), 1) for f in self.thruster_forces],
            "thruster_forces_n": [round(float(f), 2) for f in self.thruster_forces],
            "total_thrust_x": float(thrust_x),
            "total_thrust_y": float(thrust_y),
            "total_thrust_z": float(thrust_z),
            "total_torque_z": float(torque_z),
            "power_consumption_w": round(total_power_watts, 1),
        }

        return thrust_x, thrust_y, thrust_z, torque_z, telemetry
