"""
AquaBot - Depth Sensor Simulation
Simulates a digital piezoresistive pressure/depth transducer (e.g., Keller / Bar30).
Converts true simulated depth into hydrostatic pressure and calibrated depth readings with Gaussian noise.
"""

import random
from typing import Dict, Any


class DepthSensor:
    def __init__(self, noise_std: float = 0.02, p_atm_kpa: float = 101.325, water_density: float = 1025.0):
        self.noise_std = noise_std          # Standard deviation in meters (~2 cm)
        self.p_atm_kpa = p_atm_kpa          # Atmospheric pressure (kPa)
        self.water_density = water_density  # Seawater density (kg/m^3)
        self.gravity = 9.80665              # m/s^2
        self.is_healthy = True

    def read(self, true_depth: float) -> Dict[str, Any]:
        """
        Reads depth with sensor noise and computes hydrostatic pressure.
        Hydrostatic pressure: P = P_atm + (rho * g * depth) / 1000  (kPa)
        """
        noise = random.gauss(0.0, self.noise_std)
        measured_depth = max(0.0, round(true_depth + noise, 3))
        
        # Hydrostatic pressure in kPa and Bar
        pressure_kpa = self.p_atm_kpa + (self.water_density * self.gravity * measured_depth) / 1000.0
        pressure_bar = pressure_kpa / 100.0

        return {
            "depth_m": float(measured_depth),
            "true_depth_m": round(float(true_depth), 3),
            "pressure_kpa": round(float(pressure_kpa), 2),
            "pressure_bar": round(float(pressure_bar), 3),
            "healthy": self.is_healthy,
            "type": "SIMULATED_PIEZORESISTIVE_DEPTH"
        }
