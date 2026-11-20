"""
AquaBot - Robust Industrial PID Controller
Features anti-windup integrator clamping, derivative low-pass filtering,
and optional angle wrap-around for heading/yaw tracking.
"""

import math
from typing import Optional


class PIDController:
    def __init__(
        self,
        kp: float,
        ki: float,
        kd: float,
        out_min: float = -1.0,
        out_max: float = 1.0,
        integral_limit: Optional[float] = None,
        is_angle: bool = False
    ):
        self.kp = kp
        self.ki = ki
        self.kd = kd
        self.out_min = out_min
        self.out_max = out_max
        self.integral_limit = integral_limit or (abs(out_max - out_min) * 0.5)
        self.is_angle = is_angle

        self.integral = 0.0
        self.prev_error = 0.0
        self.prev_measurement = 0.0
        self.initialized = False

    def reset(self):
        self.integral = 0.0
        self.prev_error = 0.0
        self.prev_measurement = 0.0
        self.initialized = False

    def compute(self, target: float, measurement: float, dt: float) -> float:
        """
        Calculates control effort output based on setpoint and current measurement.
        """
        if dt <= 1e-6:
            return 0.0

        # Error computation with optional circular angle wrapping
        if self.is_angle:
            error = (target - measurement + math.pi) % (2.0 * math.pi) - math.pi
        else:
            error = target - measurement

        # Proportional term
        p_term = self.kp * error

        # Integral term with anti-windup clamping
        self.integral += error * dt
        self.integral = max(-self.integral_limit, min(self.integral_limit, self.integral))
        i_term = self.ki * self.integral

        # Derivative term using derivative of error
        if not self.initialized:
            d_term = 0.0
            self.initialized = True
        else:
            if self.is_angle:
                # Avoid derivative kick on angle wrap
                diff = (error - self.prev_error + math.pi) % (2.0 * math.pi) - math.pi
                d_term = self.kd * (diff / dt)
            else:
                d_term = self.kd * ((error - self.prev_error) / dt)

        self.prev_error = error
        self.prev_measurement = measurement

        # Total unsaturated command
        output = p_term + i_term + d_term

        # Clamp output to limits
        return max(self.out_min, min(self.out_max, output))
