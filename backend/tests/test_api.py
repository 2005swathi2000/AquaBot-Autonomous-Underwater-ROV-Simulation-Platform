"""
REST API and integration tests for AquaBot FastAPI backend.
"""

from fastapi.testclient import TestClient
from backend.app.main import app, sim_engine

client = TestClient(app)


def test_health_check_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "HEALTHY"
    assert data["service"] == "AquaBot-ROV-Simulation-Backend"


def test_get_status_endpoint():
    response = client.get("/api/v1/status")
    assert response.status_code == 200
    data = response.json()
    assert "position" in data
    assert "sensors" in data
    assert "navigation" in data


def test_teleop_endpoint():
    cmd = {"surge": 0.5, "sway": 0.0, "heave": -0.2, "yaw": 0.1}
    response = client.post("/api/v1/control/teleop", json=cmd)
    assert response.status_code == 200
    assert sim_engine.controller.teleop_surge == 0.5


def test_emergency_stop_and_reset_endpoints():
    res_estop = client.post("/api/v1/control/emergency-stop")
    assert res_estop.status_code == 200
    assert sim_engine.controller.mode == "EMERGENCY_STOP"

    res_reset = client.post("/api/v1/control/reset")
    assert res_reset.status_code == 200
    assert sim_engine.controller.mode == "MANUAL"


def test_mission_endpoints():
    waypoints = {
        "waypoints": [
            {"x": 10.0, "y": 10.0, "z": 8.0, "name": "Survey 1"},
            {"x": 20.0, "y": 0.0, "z": 12.0, "name": "Survey 2"}
        ]
    }
    res_wp = client.post("/api/v1/mission/waypoints", json=waypoints)
    assert res_wp.status_code == 200

    res_start = client.post("/api/v1/mission/start")
    assert res_start.status_code == 200
    assert sim_engine.controller.mode == "AUTONOMOUS"

    res_pause = client.post("/api/v1/mission/pause")
    assert res_pause.status_code == 200

    res_resume = client.post("/api/v1/mission/resume")
    assert res_resume.status_code == 200

    res_cancel = client.post("/api/v1/mission/cancel")
    assert res_cancel.status_code == 200


def test_world_obstacles_endpoint():
    response = client.get("/api/v1/world/obstacles")
    assert response.status_code == 200
    data = response.json()
    assert "obstacles" in data
    assert len(data["obstacles"]) > 0
