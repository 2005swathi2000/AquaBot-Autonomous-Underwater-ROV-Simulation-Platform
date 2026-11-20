"""
Integration tests for AquaBot Simulation Engine.
"""

from backend.simulation.engine import SimulationEngine


def test_simulation_engine_step():
    engine = SimulationEngine()
    engine.teleop(surge=0.8, sway=0.0, heave=0.0, yaw=0.0)

    # Step simulation 20 times (1.0 second)
    for _ in range(20):
        telemetry = engine.step(dt=0.05)

    assert telemetry["sim_time"] > 0.95
    assert telemetry["position"]["x"] > 0.0 or telemetry["velocity"]["u_surge"] > 0.0
    assert len(telemetry["charts"]["depth"]) > 0


def test_emergency_stop_and_reset():
    engine = SimulationEngine()
    engine.teleop(surge=1.0, sway=0.0, heave=0.0, yaw=0.0)
    engine.step(0.05)

    engine.emergency_stop()
    assert engine.controller.mode == "EMERGENCY_STOP"

    # Step again, thrusters must be cut off
    telemetry = engine.step(0.05)
    assert telemetry["status"] == "EMERGENCY_STOP"

    # Reset
    engine.reset()
    assert engine.controller.mode == "MANUAL"
    assert engine.state["x"] == 0.0
    assert engine.state["y"] == 0.0
