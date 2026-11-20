"""
Unit tests for AquaBot simulated sensor suite.
"""

from backend.sensors.depth_sensor import DepthSensor
from backend.sensors.sonar_sensor import SonarSensor
from backend.sensors.imu_sensor import IMUSensor
from backend.sensors.compass_sensor import CompassSensor
from backend.sensors.battery_sensor import BatterySensor
from backend.simulation.world import UnderwaterWorld


def test_depth_sensor_readings():
    sensor = DepthSensor(noise_std=0.01)
    res = sensor.read(true_depth=10.0)
    assert abs(res["depth_m"] - 10.0) < 0.1
    # Hydrostatic pressure at 10m depth is ~201 kPa (~2.0 bar)
    assert 195.0 <= res["pressure_kpa"] <= 210.0
    assert 1.95 <= res["pressure_bar"] <= 2.10
    assert res["healthy"] is True


def test_sonar_sensor_obstacle_detection():
    world = UnderwaterWorld()
    sonar = SonarSensor(world=world, fov_deg=90.0, num_beams=7, max_range=25.0)
    # Put ROV near Hydrothermal Spire A at (8, 10, 15)
    # Place ROV at (8, 5, 15) facing North (yaw = pi/2)
    import math
    res = sonar.read(rov_x=8.0, rov_y=5.0, rov_z=15.0, rov_yaw=math.pi / 2.0)
    assert res["min_distance_m"] < 8.0
    assert res["threat_level"] in ["CAUTION", "WARNING", "CRITICAL"]


def test_compass_cardinal_and_noise():
    compass = CompassSensor(noise_std_deg=0.5)
    # Heading 0 deg = North
    res = compass.read(true_yaw_rad=0.0)
    assert "N" in res["cardinal"]


def test_battery_drain():
    batt = BatterySensor(capacity_ah=15.6, initial_soc_pct=100.0)
    res1 = batt.step(power_watts=100.0, dt=1.0)
    assert res1["battery_pct"] <= 100.0
    assert res1["power_w"] == 100.0
    # Step forward 1 hour at 150 Watts
    res2 = batt.step(power_watts=150.0, dt=3600.0)
    assert res2["battery_pct"] < 95.0
