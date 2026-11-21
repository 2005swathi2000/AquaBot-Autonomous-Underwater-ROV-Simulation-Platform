"""
End-to-End WebSocket and REST streaming test against AquaBot FastAPI backend.
Uses FastAPI TestClient for deterministic, in-process WebSocket and REST verification.
"""

from fastapi.testclient import TestClient
from backend.app.main import app


def test_live_rest_and_websocket():
    with TestClient(app) as client:
        # 1. Test REST health check
        res = client.get("/health")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "HEALTHY"
        assert data["service"] == "AquaBot-ROV-Simulation-Backend"

        # 2. Test World Obstacles REST endpoint
        res_obs = client.get("/api/v1/world/obstacles")
        assert res_obs.status_code == 200
        assert len(res_obs.json()["obstacles"]) == 7

        # 3. Test WebSocket connection and bi-directional telemetry streaming
        with client.websocket_connect("/ws/telemetry") as ws:
            # Verify Initial Handshake Frame
            init_frame = ws.receive_json()
            assert init_frame.get("type") == "INIT"
            assert "obstacles" in init_frame["world"]
            assert len(init_frame["world"]["obstacles"]) == 7

            # Test Ping / Pong latency check
            ws.send_json({"action": "ping"})
            pong_msg = ws.receive_json()
            assert pong_msg.get("type") == "PONG" or "position" in pong_msg

            # Test Teleop Command Transmission
            ws.send_json({"action": "teleop", "surge": 0.9, "sway": 0.0, "heave": 0.0, "yaw": 0.3})

            # Read streaming telemetry frames
            for _ in range(3):
                frame = ws.receive_json()
                if "position" in frame:
                    assert "sensors" in frame
                    assert "depth" in frame["sensors"]
                    assert "sonar" in frame["sensors"]
                    assert "battery" in frame["sensors"]
                    assert "thrusters" in frame

            # Test Simulation Reset via WebSocket
            ws.send_json({"action": "reset"})
