"""
Unit tests for 6-Thruster Allocation and Actuator Dynamics.
"""

from backend.simulation.thruster_model import ThrusterModel


def test_thruster_allocation_forward():
    tm = ThrusterModel()
    targets = tm.allocate(cmd_surge=1.0, cmd_sway=0.0, cmd_heave=0.0, cmd_yaw=0.0)
    # All 4 horizontal thrusters should contribute positive forward thrust
    assert targets[0] > 0
    assert targets[1] > 0
    assert targets[2] > 0
    assert targets[3] > 0
    # Vertical thrusters should be 0
    assert targets[4] == 0.0
    assert targets[5] == 0.0


def test_thruster_heave_allocation():
    tm = ThrusterModel()
    targets = tm.allocate(cmd_surge=0.0, cmd_sway=0.0, cmd_heave=1.0, cmd_yaw=0.0)
    assert targets[4] > 0
    assert targets[5] > 0


def test_thruster_first_order_lag():
    tm = ThrusterModel()
    # Initial thruster forces should be zero
    assert tm.thruster_forces[0] == 0.0

    # Step with 1.0 surge for a small dt (less than tau)
    tm.step(cmd_surge=1.0, cmd_sway=0.0, cmd_heave=0.0, cmd_yaw=0.0, dt=0.05)
    # Force should rise gradually, not instantly reach max
    assert 0.0 < tm.thruster_forces[0] < tm.max_thrust_fwd
