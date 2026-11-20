"""
AquaBot - 6-DOF Inertial Measurement Unit (IMU) Simulation
Simulates an industrial MEMS IMU (e.g. Bosch-Sensortec BMI088 / Analog Devices ADIS16480).
Computes tri-axial accelerations (including gravity vector projection), angular rates (gyroscope),
and estimated attitude roll/pitch with noise and drift.
"""

import math
import random
from typing import Dict, Any


class IMUSensor:
    def __init__(self, accel_noise_std: float = 0.05, gyro_noise_std: float = 0.01):
        self.accel_noise_std = accel_noise_std # m/s^2
        self.gyro_noise_std = gyro_noise_std   # rad/s
        self.gravity = 9.80665                 # m/s^2
        self.gyro_bias_z = 0.002               # Small systematic bias drift
        self.is_healthy = True

    def read(
        self,
        roll: float,
        pitch: float,
        yaw: float,
        accel_u: float,
        accel_v: float,
        accel_w: float,
        r: float
    ) -> Dict[str, Any]:
        """
        Calculates IMU accelerometer and gyroscope output in the vehicle body frame.
        Gravity vector in NED body frame:
        g_x = -g * sin(theta)
        g_y =  g * cos(theta) * sin(phi)
        g_z =  g * cos(theta) * cos(phi)
        """
        # Gravity projections onto body frame
        gx = -self.gravity * math.sin(pitch)
        gy = self.gravity * math.cos(pitch) * math.sin(roll)
        gz = self.gravity * math.cos(pitch) * math.cos(roll)

        # Measured proper acceleration = dynamic acceleration - gravity
        noise_ax = random.gauss(0.0, self.accel_noise_std)
        noise_ay = random.gauss(0.0, self.accel_noise_std)
        noise_az = random.gauss(0.0, self.accel_noise_std)

        ax_body = accel_u - gx + noise_ax
        ay_body = accel_v - gy + noise_ay
        az_body = accel_w - gz + noise_az

        # Gyroscope rates: p, q, r
        noise_p = random.gauss(0.0, self.gyro_noise_std)
        noise_q = random.gauss(0.0, self.gyro_noise_std)
        noise_r = random.gauss(0.0, self.gyro_noise_std) + self.gyro_bias_z

        # Pitch and roll rates approximated from attitude stabilization
        p = noise_p
        q = noise_q
        gyro_r = r + noise_r

        # Quaternion estimation [w, x, y, z] from Euler angles
        cy = math.cos(yaw * 0.5)
        sy = math.sin(yaw * 0.5)
        cp = math.cos(pitch * 0.5)
        sp = math.sin(pitch * 0.5)
        cr = math.cos(roll * 0.5)
        sr = math.sin(roll * 0.5)

        qw = cr * cp * cy + sr * sp * sy
        qx = sr * cp * cy - cr * sp * sy
        qy = cr * sp * cy + sr * cp * sy
        qz = cr * cp * sy - sr * sp * cy

        return {
            "linear_acceleration": {
                "ax": round(float(ax_body), 3),
                "ay": round(float(ay_body), 3),
                "az": round(float(az_body), 3),
            },
            "angular_velocity": {
                "wx": round(float(p), 4),
                "wy": round(float(q), 4),
                "wz": round(float(gyro_r), 4),
            },
            "orientation_euler_deg": {
                "roll": round(float(math.degrees(roll)), 2),
                "pitch": round(float(math.degrees(pitch)), 2),
                "yaw": round(float(math.degrees(yaw)), 2),
            },
            "orientation_quaternion": {
                "w": round(float(qw), 4),
                "x": round(float(qx), 4),
                "y": round(float(qy), 4),
                "z": round(float(qz), 4),
            },
            "healthy": self.is_healthy,
            "type": "SIMULATED_6DOF_MEMS_IMU"
        }
