"""
Live End-to-End WebSocket and REST streaming test against running AquaBot server.
"""

import json
import pytest
import httpx
import websockets


def test_live_rest_and_websocket():
    import asyncio
    async def run_test():
        # 1. Test REST health
        async with httpx.AsyncClient() as client:
            res = await client.get("http://127.0.0.1:8000/health")
            assert res.status_code == 200
            data = res.json()
            assert data["status"] == "HEALTHY"

            res_obs = await client.get("http://127.0.0.1:8000/api/v1/world/obstacles")
            assert res_obs.status_code == 200
            assert len(res_obs.json()["obstacles"]) == 7

        # 2. Test WebSocket connection and bi-directional telemetry streaming
        uri = "ws://127.0.0.1:8000/ws/telemetry"
        async with websockets.connect(uri) as ws:
            # Initial frame
            raw_init = await ws.recv()
            init_frame = json.loads(raw_init)
            assert init_frame.get("type") == "INIT"
            assert "obstacles" in init_frame["world"]

            # Send ping
            await ws.send(json.dumps({"action": "ping"}))
            pong_msg = json.loads(await ws.recv())
            assert pong_msg.get("type") == "PONG" or "position" in pong_msg

            # Send teleop drive command
            await ws.send(json.dumps({"action": "teleop", "surge": 0.9, "sway": 0.0, "heave": 0.0, "yaw": 0.3}))

            # Read streaming telemetry frames
            for _ in range(3):
                raw_frame = await ws.recv()
                frame = json.loads(raw_frame)
                if "position" in frame:
                    assert "sensors" in frame
                    assert "depth" in frame["sensors"]
                    assert "sonar" in frame["sensors"]
                    assert "battery" in frame["sensors"]

            # Reset simulation
            await ws.send(json.dumps({"action": "reset"}))

    asyncio.run(run_test())
