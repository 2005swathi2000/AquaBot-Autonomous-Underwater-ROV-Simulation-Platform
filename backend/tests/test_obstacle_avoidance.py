"""
Unit tests for Reactive Artificial Potential Field Obstacle Avoidance.
"""

import math
from backend.navigation.obstacle_avoidance import ObstacleAvoidanceSystem


def test_obstacle_avoidance_clear():
    avoid = ObstacleAvoidanceSystem()
    sonar_clear = {
        "min_distance_m": 25.0,
        "closest_angle_deg": 0.0,
        "beams": []
    }
    # Goal is directly East (0 deg)
    heading, speed_factor, status = avoid.compute_avoidance_vector(
        rov_x=0.0, rov_y=0.0, rov_yaw=0.0,
        target_x=10.0, target_y=0.0,
        sonar_readings=sonar_clear
    )
    assert status == "CLEAR"
    assert speed_factor == 1.0
    assert abs(heading - 0.0) < 0.01


def test_obstacle_avoidance_repulsion():
    avoid = ObstacleAvoidanceSystem()
    # Obstacle is directly in front at 2.5 meters (relative angle 0 deg)
    sonar_hazard = {
        "min_distance_m": 2.5,
        "closest_angle_deg": 0.0,
        "beams": [
            {"relative_angle_deg": 0.0, "distance_m": 2.5, "detected": True}
        ]
    }
    heading, speed_factor, status = avoid.compute_avoidance_vector(
        rov_x=0.0, rov_y=0.0, rov_yaw=0.0,
        target_x=10.0, target_y=0.0,
        sonar_readings=sonar_hazard
    )
    assert status == "AVOIDING"
    assert speed_factor < 1.0
    # Headings must be deflected away from 0 rad (straight into obstacle)
    assert abs(heading) > 0.1


def test_emergency_reverse_critical_zone():
    avoid = ObstacleAvoidanceSystem(critical_distance=1.6)
    sonar_critical = {
        "min_distance_m": 1.2,
        "closest_angle_deg": 10.0,
        "beams": [
            {"relative_angle_deg": 10.0, "distance_m": 1.2, "detected": True}
        ]
    }
    heading, speed_factor, status = avoid.compute_avoidance_vector(
        rov_x=0.0, rov_y=0.0, rov_yaw=0.0,
        target_x=10.0, target_y=0.0,
        sonar_readings=sonar_critical
    )
    assert status == "EMERGENCY_REVERSE"
    assert speed_factor < 0.0  # Must reverse drive
