"""
AquaBot - Unified Sensor Suite
Aggregates Depth, Sonar, IMU, Compass, and Battery sensors into a single synchronized interface.
"""

from typing import Dict, Any
from .depth_sensor import DepthSensor
from .sonar_sensor import SonarSensor
from .imu_sensor import IMUSensor
from .compass_sensor import CompassSensor
from .battery_sensor import BatterySensor
from ..simulation.world import UnderwaterWorld


class SensorSuite:
    def __init__(self, world: UnderwaterWorld):
        self.depth_sensor = DepthSensor()
        self.sonar_sensor = SonarSensor(world=world)
        self.imu_sensor = IMUSensor()
        self.compass_sensor = CompassSensor()
        self.battery_sensor = BatterySensor()

    def reset(self):
        self.battery_sensor.reset(soc_pct=100.0)

    def update(
        self,
        rov_state: Dict[str, float],
        power_consumption_w: float,
        dt: float
    ) -> Dict[str, Any]:
        """
        Polls and returns readings from all sensors based on actual vehicle dynamic state.
        """
        depth_data = self.depth_sensor.read(rov_state["z"])
        sonar_data = self.sonar_sensor.read(
            rov_state["x"], rov_state["y"], rov_state["z"], rov_state["yaw"]
        )
        imu_data = self.imu_sensor.read(
            roll=rov_state["roll"],
            pitch=rov_state["pitch"],
            yaw=rov_state["yaw"],
            accel_u=rov_state.get("accel_u", 0.0),
            accel_v=rov_state.get("accel_v", 0.0),
            accel_w=rov_state.get("accel_w", 0.0),
            r=rov_state["r"]
        )
        compass_data = self.compass_sensor.read(rov_state["yaw"])
        battery_data = self.battery_sensor.step(power_consumption_w, dt)

        return {
            "depth": depth_data,
            "sonar": sonar_data,
            "imu": imu_data,
            "compass": compass_data,
            "battery": battery_data,
            "timestamp_iso": None,
        }
