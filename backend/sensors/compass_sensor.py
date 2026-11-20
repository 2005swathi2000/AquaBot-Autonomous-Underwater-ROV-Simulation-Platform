"""
AquaBot - Digital Magnetic Compass Simulation
Simulates a tilt-compensated triaxial digital magnetometer (e.g. Honeywell HMC5883L).
Provides filtered magnetic heading in 0-360 degrees and cardinal orientation labels.
"""

import math
import random
from typing import Dict, Any


class CompassSensor:
    def __init__(self, noise_std_deg: float = 0.8, magnetic_declination_deg: float = 1.2):
        self.noise_std_deg = noise_std_deg
        self.declination = magnetic_declination_deg
        self.is_healthy = True

    def get_cardinal_direction(self, heading_deg: float) -> str:
        """Returns 16-point cardinal direction string."""
        cardinals = [
            "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
            "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"
        ]
        idx = int((heading_deg + 11.25) / 22.5) % 16
        return cardinals[idx]

    def read(self, true_yaw_rad: float) -> Dict[str, Any]:
        """
        Reads heading from true vehicle yaw in radians.
        Converts to 0..360 degrees with Gaussian sensor jitter.
        """
        true_deg = math.degrees(true_yaw_rad) % 360.0
        noise = random.gauss(0.0, self.noise_std_deg)
        measured_deg = (true_deg + self.declination + noise) % 360.0

        return {
            "heading_deg": round(float(measured_deg), 1),
            "true_heading_deg": round(float(true_deg), 1),
            "cardinal": self.get_cardinal_direction(measured_deg),
            "declination_deg": self.declination,
            "healthy": self.is_healthy,
            "type": "SIMULATED_MAGNETIC_COMPASS"
        }
