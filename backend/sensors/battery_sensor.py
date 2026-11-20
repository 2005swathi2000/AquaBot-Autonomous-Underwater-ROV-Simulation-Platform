"""
AquaBot - Intelligent Battery Management System (BMS) Simulation
Simulates a 4S LiPo battery pack (14.8V nominal, 16.8V max, 13.0V cutoff) with 15.6 Ah capacity (~230 Wh).
Models Coulomb counting, non-linear voltage discharge curve, internal resistance voltage sag under load,
and real-time estimated remaining operational mission endurance.
"""

from typing import Dict, Any


class BatterySensor:
    def __init__(self, capacity_ah: float = 15.6, initial_soc_pct: float = 100.0):
        self.capacity_ah = capacity_ah
        self.capacity_as = capacity_ah * 3600.0  # Ampere-seconds (Coulombs)
        self.charge_remaining_as = self.capacity_as * (initial_soc_pct / 100.0)
        
        # 4S LiPo Voltage parameters
        self.v_full = 16.8
        self.v_nominal = 14.8
        self.v_cutoff = 13.0
        self.internal_resistance_ohms = 0.045 # Pack IR
        
        self.is_healthy = True
        self.is_low_battery_warning = False
        self.is_critical_battery = False

    def reset(self, soc_pct: float = 100.0):
        self.charge_remaining_as = self.capacity_as * (soc_pct / 100.0)
        self.is_low_battery_warning = False
        self.is_critical_battery = False

    def step(self, power_watts: float, dt: float) -> Dict[str, Any]:
        """
        Integrates energy consumption over time step dt.
        Calculates instantaneous current draw and terminal voltage under load.
        """
        soc = max(0.0, min(1.0, self.charge_remaining_as / self.capacity_as))
        
        # Open Circuit Voltage (OCV) estimate based on typical LiPo discharge plateau
        ocv = self.v_cutoff + (self.v_full - self.v_cutoff) * (0.85 * (soc ** 0.5) + 0.15 * soc)
        
        # Instantaneous current: I = P / V
        # Avoid division by zero
        v_estimate = max(ocv, 12.0)
        current_amps = power_watts / v_estimate
        
        # Voltage drop under internal resistance load: V_term = OCV - I * R_int
        v_terminal = max(self.v_cutoff - 0.5, ocv - current_amps * self.internal_resistance_ohms)

        # Deplete charge
        coulombs_consumed = current_amps * dt
        self.charge_remaining_as = max(0.0, self.charge_remaining_as - coulombs_consumed)
        
        soc_pct = (self.charge_remaining_as / self.capacity_as) * 100.0

        # Safety alarms
        self.is_low_battery_warning = soc_pct < 25.0
        self.is_critical_battery = soc_pct < 10.0

        # Estimated remaining runtime in minutes
        if current_amps > 0.1:
            remaining_minutes = (self.charge_remaining_as / 3600.0) / current_amps * 60.0
        else:
            remaining_minutes = 999.0

        return {
            "battery_pct": round(float(soc_pct), 1),
            "voltage_v": round(float(v_terminal), 2),
            "current_a": round(float(current_amps), 2),
            "power_w": round(float(power_watts), 1),
            "remaining_minutes": round(float(min(remaining_minutes, 600.0)), 1),
            "low_battery_warning": self.is_low_battery_warning,
            "critical_battery": self.is_critical_battery,
            "healthy": self.is_healthy,
            "type": "SIMULATED_4S_LIPO_BMS"
        }
