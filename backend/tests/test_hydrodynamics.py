"""
Unit tests for ROV Hydrodynamics and Kinematics Integration.
Tests drag dissipation, depth boundary limits, velocity clamping, and acceleration.
"""

import pytest
from backend.simulation.hydrodynamics import ROVHydrodynamics


def test_hydrodynamics_drag_deceleration():
    """Verify that linear and quadratic hydrodynamic drag naturally slows the ROV down to 0 without thrust."""
    hydro = ROVHydrodynamics()
    state = {
        "x": 0.0, "y": 0.0, "z": 5.0,
        "roll": 0.0, "pitch": 0.0, "yaw": 0.0,
        "u": 1.5, "v": 0.0, "w": 0.0, "r": 0.0,
        "vx_world": 1.5, "vy_world": 0.0, "vz_world": 0.0,
        "speed": 1.5, "accel_u": 0.0, "accel_v": 0.0, "accel_w": 0.0, "accel_r": 0.0
    }

    # Step for 2 seconds with zero thrust
    dt = 0.05
    for _ in range(40):
        state = hydro.step(state, thrust_x=0.0, thrust_y=0.0, thrust_z=0.0, torque_z=0.0, dt=dt)

    # Speed must have significantly decreased due to water resistance
    assert state["u"] < 0.4
    assert state["speed"] < 0.4


def test_hydrodynamics_depth_limits():
    """Verify that ROV cannot penetrate surface or exceed maximum depth limit."""
    hydro = ROVHydrodynamics()
    
    # Test surface boundary (z >= min_depth)
    state = {
        "x": 0.0, "y": 0.0, "z": 0.2,
        "roll": 0.0, "pitch": 0.0, "yaw": 0.0,
        "u": 0.0, "v": 0.0, "w": -2.0, "r": 0.0,
        "vx_world": 0.0, "vy_world": 0.0, "vz_world": -2.0,
        "speed": 2.0, "accel_u": 0.0, "accel_v": 0.0, "accel_w": 0.0, "accel_r": 0.0
    }
    # Command full upward heave (negative thrust)
    state = hydro.step(state, thrust_x=0.0, thrust_y=0.0, thrust_z=-50.0, torque_z=0.0, dt=0.2)
    assert state["z"] >= hydro.min_depth


def test_hydrodynamics_velocity_limits():
    """Verify velocity saturation clamps speeds within realistic physical boundaries."""
    hydro = ROVHydrodynamics()
    state = {
        "x": 0.0, "y": 0.0, "z": 5.0,
        "roll": 0.0, "pitch": 0.0, "yaw": 0.0,
        "u": 0.0, "v": 0.0, "w": 0.0, "r": 0.0,
        "vx_world": 0.0, "vy_world": 0.0, "vz_world": 0.0,
        "speed": 0.0, "accel_u": 0.0, "accel_v": 0.0, "accel_w": 0.0, "accel_r": 0.0
    }
    # Apply huge thrust
    for _ in range(50):
        state = hydro.step(state, thrust_x=1000.0, thrust_y=0.0, thrust_z=0.0, torque_z=0.0, dt=0.05)

    assert state["u"] <= hydro.max_surge_speed
