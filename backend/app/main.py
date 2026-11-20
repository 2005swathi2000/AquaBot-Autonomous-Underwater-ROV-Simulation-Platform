"""
AquaBot - Autonomous Underwater ROV Simulation Backend
FastAPI server with WebSockets, deterministic 20 Hz simulation loop, and REST control API.
"""

import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from .api.routes import router, set_engine
from .api.websocket_manager import ws_manager
from ..simulation.engine import SimulationEngine

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("aquabot.main")

# Instantiate singleton simulation engine
sim_engine = SimulationEngine()
set_engine(sim_engine)

# Background simulation task handle
sim_task: asyncio.Task = None  # type: ignore


async def simulation_loop():
    """Deterministic 20 Hz (50 ms) simulation clock and telemetry streamer."""
    dt = 0.05
    logger.info("Simulation loop started at 20 Hz.")
    try:
        while True:
            start_time = asyncio.get_event_loop().time()
            
            # Step the simulation physics and sensors
            telemetry = sim_engine.step(custom_dt=dt)
            
            # Broadcast telemetry to connected WebSockets
            if ws_manager.active_connections:
                await ws_manager.broadcast_json(telemetry)

            # Precise rate sleep
            elapsed = asyncio.get_event_loop().time() - start_time
            sleep_time = max(0.001, dt - elapsed)
            await asyncio.sleep(sleep_time)
    except asyncio.CancelledError:
        logger.info("Simulation loop stopped.")
    except Exception as e:
        logger.error(f"Error in simulation loop: {e}", exc_info=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    global sim_task
    # Start background physics loop
    sim_task = asyncio.create_task(simulation_loop())
    yield
    # Shutdown
    if sim_task:
        sim_task.cancel()
        try:
            await sim_task
        except asyncio.CancelledError:
            pass


app = FastAPI(
    title="AquaBot Simulation API",
    description="Autonomous Underwater ROV Simulation Platform - Robotics Telemetry & Control Engine",
    version="1.0.0",
    lifespan=lifespan
)

# Enable CORS for frontend deployment (Vercel, localhost, Render)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount REST endpoints
app.include_router(router)


@app.get("/health")
def health_check():
    return {
        "status": "HEALTHY",
        "service": "AquaBot-ROV-Simulation-Backend",
        "sim_time": round(sim_engine.sim_time, 2),
        "rov_mode": sim_engine.controller.mode,
        "active_ws_clients": len(ws_manager.active_connections)
    }


@app.websocket("/ws/telemetry")
async def websocket_telemetry_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        # Send initial world config and obstacle map upon connection
        init_frame = {
            "type": "INIT",
            "world": {
                "bounds_x": sim_engine.world.bounds_x,
                "bounds_y": sim_engine.world.bounds_y,
                "bounds_z": sim_engine.world.bounds_z,
                "obstacles": sim_engine.world.get_obstacles_dict()
            },
            "telemetry": sim_engine.get_telemetry()
        }
        await websocket.send_json(init_frame)

        # Receive incoming client commands via WebSocket
        while True:
            data = await websocket.receive_json()
            action = data.get("action")
            if action == "teleop":
                sim_engine.teleop(
                    surge=data.get("surge", 0.0),
                    sway=data.get("sway", 0.0),
                    heave=data.get("heave", 0.0),
                    yaw=data.get("yaw", 0.0)
                )
            elif action == "stop":
                sim_engine.teleop(0.0, 0.0, 0.0, 0.0)
            elif action == "emergency_stop":
                sim_engine.emergency_stop()
            elif action == "clear_emergency_stop":
                sim_engine.clear_emergency_stop()
            elif action == "reset":
                sim_engine.reset()
            elif action == "start_mission":
                sim_engine.start_mission()
            elif action == "pause_mission":
                sim_engine.pause_mission()
            elif action == "resume_mission":
                sim_engine.resume_mission()
            elif action == "cancel_mission":
                sim_engine.cancel_mission()
            elif action == "ping":
                await websocket.send_json({"type": "PONG", "time": sim_engine.sim_time})
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception as e:
        logger.warning(f"WebSocket client error: {e}")
        ws_manager.disconnect(websocket)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=8000, reload=False)
