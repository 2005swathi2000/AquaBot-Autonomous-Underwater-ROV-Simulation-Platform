"""
AquaBot - Hydrodynamics & Underwater Kinematics Simulation Engine
Implements simplified 6-DOF kinematics and 4-DOF active dynamics for an underwater ROV
based on standard underwater vehicle physics (Fossen marine vehicle equations).
"""

import math
import numpy as np
from typing import Dict, Any, Tuple


class ROVHydrodynamics:
    def __init__(self):
        # Physical Vehicle Properties
        self.mass: float = 12.5  # Dry mass (kg)
        
        # Added Mass (water entrained by vehicle movement, kg & kg*m^2)
        self.added_mass_x: float = 6.0   # Surge added mass
        self.added_mass_y: float = 9.0   # Sway added mass
        self.added_mass_z: float = 9.0   # Heave added mass
        self.added_inertia_z: float = 0.25 # Yaw added inertia
        
        self.total_mass_x = self.mass + self.added_mass_x
        self.total_mass_y = self.mass + self.added_mass_y
        self.total_mass_z = self.mass + self.added_mass_z
        self.inertia_z: float = 0.45     # Dry yaw moment of inertia
        self.total_inertia_z = self.inertia_z + self.added_inertia_z
        
        # Linear & Quadratic Damping Coefficients
        self.drag_linear_x: float = 8.0    # Surge (N*s/m)
        self.drag_linear_y: float = 14.0   # Sway (N*s/m)
        self.drag_linear_z: float = 18.0   # Heave (N*s/m)
        self.drag_linear_yaw: float = 2.5  # Yaw (N*m*s/rad)
        
        self.drag_quad_x: float = 16.0     # Surge (N*s^2/m^2)
        self.drag_quad_y: float = 28.0     # Sway (N*s^2/m^2)
        self.drag_quad_z: float = 36.0     # Heave (N*s^2/m^2)
        self.drag_quad_yaw: float = 4.0    # Yaw (N*m^2*s^2/rad^2)
        
        # Buoyancy & Restoring Metacentric Properties
        # Buoyancy force slightly positive (+0.8N) for realistic failsafe self-surfacing
        self.net_buoyancy: float = 0.8 # Newtons upward
        self.restoring_stiffness_roll: float = 4.5  # Restores roll to 0
        self.restoring_stiffness_pitch: float = 5.0 # Restores pitch to 0
        self.pitch_roll_damping: float = 2.2
        
        # Velocity & Depth Constraints
        self.max_surge_speed: float = 2.2   # m/s
        self.max_sway_speed: float = 1.2    # m/s
        self.max_heave_speed: float = 1.0   # m/s
        self.max_yaw_rate: float = 1.5      # rad/s (~86 deg/s)
        
        self.min_depth: float = 0.1         # Surface boundary (m)
        self.max_depth: float = 35.0        # Seafloor boundary (m)
        self.world_bound_x: float = 35.0    # +/- X bounds (m)
        self.world_bound_y: float = 35.0    # +/- Y bounds (m)

    def compute_accelerations(
        self,
        u: float, v: float, w: float, r: float,
        phi: float, theta: float,
        thrust_x: float, thrust_y: float, thrust_z: float, torque_z: float
    ) -> Tuple[float, float, float, float]:
        """
        Calculates body-frame linear accelerations (du, dv, dw) and angular acceleration (dr).
        u: surge velocity (m/s)
        v: sway velocity (m/s)
        w: heave velocity (m/s, positive downwards)
        r: yaw rate (rad/s)
        """
        # Surge Hydrodynamic Drag: D(u) = Dl*u + Dq*|u|*u
        drag_x = -(self.drag_linear_x * u + self.drag_quad_x * abs(u) * u)
        accel_u = (thrust_x + drag_x) / self.total_mass_x

        # Sway Hydrodynamic Drag
        drag_y = -(self.drag_linear_y * v + self.drag_quad_y * abs(v) * v)
        accel_v = (thrust_y + drag_y) / self.total_mass_y

        # Heave Hydrodynamic Drag + Net Buoyancy (buoyancy acts upwards, so negative depth accel)
        drag_z = -(self.drag_linear_z * w + self.drag_quad_z * abs(w) * w)
        # thrust_z is positive downwards (descend), negative upwards (ascend)
        accel_w = (thrust_z + drag_z - self.net_buoyancy) / self.total_mass_z

        # Yaw Rotational Drag
        drag_yaw = -(self.drag_linear_yaw * r + self.drag_quad_yaw * abs(r) * r)
        accel_r = (torque_z + drag_yaw) / self.total_inertia_z

        return accel_u, accel_v, accel_w, accel_r

    def step(
        self,
        state: Dict[str, float],
        thrust_x: float, thrust_y: float, thrust_z: float, torque_z: float,
        dt: float
    ) -> Dict[str, float]:
        """
        Integrates kinematics and dynamics over time step dt using semi-implicit Euler integration.
        """
        # Current State
        x = state["x"]
        y = state["y"]
        z = state["z"] # Depth (positive downwards)
        roll = state["roll"]
        pitch = state["pitch"]
        yaw = state["yaw"] # Heading in radians

        u = state["u"] # Surge (body x)
        v = state["v"] # Sway (body y)
        w = state["w"] # Heave (body z)
        r = state["r"] # Yaw rate

        # Dynamic Accelerations
        du, dv, dw, dr = self.compute_accelerations(
            u, v, w, r, roll, pitch, thrust_x, thrust_y, thrust_z, torque_z
        )

        # Update body velocities
        u_next = np.clip(u + du * dt, -self.max_surge_speed, self.max_surge_speed)
        v_next = np.clip(v + dv * dt, -self.max_sway_speed, self.max_sway_speed)
        w_next = np.clip(w + dw * dt, -self.max_heave_speed, self.max_heave_speed)
        r_next = np.clip(r + dr * dt, -self.max_yaw_rate, self.max_yaw_rate)

        # Kinematic Transformation: Body velocities to World frame velocities
        # dx_world = u*cos(yaw) - v*sin(yaw)
        # dy_world = u*sin(yaw) + v*cos(yaw)
        # dz_world = w
        cos_psi = math.cos(yaw)
        sin_psi = math.sin(yaw)

        vx_world = u_next * cos_psi - v_next * sin_psi
        vy_world = u_next * sin_psi + v_next * cos_psi
        vz_world = w_next

        # Update position
        x_next = np.clip(x + vx_world * dt, -self.world_bound_x, self.world_bound_x)
        y_next = np.clip(y + vy_world * dt, -self.world_bound_y, self.world_bound_y)
        z_next = np.clip(z + vz_world * dt, self.min_depth, self.max_depth)

        # If hitting surface or seabed, damp heave velocity to 0
        if z_next <= self.min_depth and w_next < 0:
            w_next = 0.0
        elif z_next >= self.max_depth and w_next > 0:
            w_next = 0.0

        # Update heading (yaw) and normalize to [-pi, pi]
        yaw_next = (yaw + r_next * dt + math.pi) % (2 * math.pi) - math.pi

        # Roll and Pitch restoring dynamics (self-righting pendulum effect of ROV ballast)
        # Dynamic coupling: forward surge causes slight pitch down, turning causes slight roll
        roll_target = -0.05 * v_next - 0.08 * r_next
        pitch_target = 0.04 * u_next - 0.03 * w_next
        
        roll_next = roll + (roll_target - roll) * (1.0 - math.exp(-self.restoring_stiffness_roll * dt))
        pitch_next = pitch + (pitch_target - pitch) * (1.0 - math.exp(-self.restoring_stiffness_pitch * dt))

        # Calculate current total linear speed
        linear_speed = math.sqrt(vx_world**2 + vy_world**2 + vz_world**2)

        return {
            "x": float(x_next),
            "y": float(y_next),
            "z": float(z_next),
            "roll": float(roll_next),
            "pitch": float(pitch_next),
            "yaw": float(yaw_next),
            "u": float(u_next),
            "v": float(v_next),
            "w": float(w_next),
            "r": float(r_next),
            "vx_world": float(vx_world),
            "vy_world": float(vy_world),
            "vz_world": float(vz_world),
            "speed": float(linear_speed),
            "accel_u": float(du),
            "accel_v": float(dv),
            "accel_w": float(dw),
            "accel_r": float(dr),
        }
