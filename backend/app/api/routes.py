"""
AquaBot - REST API Endpoints
"""

from fastapi import APIRouter, HTTPException
from ..models.schemas import TeleopCommand, WaypointListRequest, PresetMissionRequest, HoldConfig
from ...simulation.engine import SimulationEngine

router = APIRouter(prefix="/api/v1")

# Reference to singleton engine, injected in main.py
sim_engine: SimulationEngine = None  # type: ignore


def set_engine(engine: SimulationEngine):
    global sim_engine
    sim_engine = engine


@router.get("/status")
def get_status():
    if not sim_engine:
        raise HTTPException(status_code=503, detail="Simulation engine not initialized")
    return sim_engine.get_telemetry()


@router.get("/world/obstacles")
def get_world_obstacles():
    if not sim_engine:
        raise HTTPException(status_code=503, detail="Simulation engine not initialized")
    return {
        "bounds": {
            "x": sim_engine.world.bounds_x,
            "y": sim_engine.world.bounds_y,
            "z": sim_engine.world.bounds_z
        },
        "obstacles": sim_engine.world.get_obstacles_dict()
    }


@router.post("/control/teleop")
def post_teleop(cmd: TeleopCommand):
    if not sim_engine:
        raise HTTPException(status_code=503, detail="Simulation engine not initialized")
    sim_engine.teleop(cmd.surge, cmd.sway, cmd.heave, cmd.yaw)
    return {"status": "OK", "command": cmd.model_dump()}


@router.post("/control/stop")
def post_stop():
    if not sim_engine:
        raise HTTPException(status_code=503, detail="Simulation engine not initialized")
    sim_engine.teleop(0.0, 0.0, 0.0, 0.0)
    return {"status": "OK", "message": "Thruster zeroed"}


@router.post("/control/emergency-stop")
def post_emergency_stop():
    if not sim_engine:
        raise HTTPException(status_code=503, detail="Simulation engine not initialized")
    sim_engine.emergency_stop()
    return {"status": "OK", "message": "Emergency Stop Engaged"}


@router.post("/control/clear-emergency-stop")
def post_clear_emergency_stop():
    if not sim_engine:
        raise HTTPException(status_code=503, detail="Simulation engine not initialized")
    sim_engine.clear_emergency_stop()
    return {"status": "OK", "message": "Emergency Stop Cleared"}


@router.post("/control/reset")
def post_reset():
    if not sim_engine:
        raise HTTPException(status_code=503, detail="Simulation engine not initialized")
    sim_engine.reset()
    return {"status": "OK", "message": "Simulation Reset"}


@router.post("/control/depth-hold")
def set_depth_hold(config: HoldConfig):
    if not sim_engine:
        raise HTTPException(status_code=503, detail="Simulation engine not initialized")
    sim_engine.controller.depth_hold_enabled = config.enabled
    if config.target_value is not None:
        sim_engine.controller.target_depth_m = max(0.2, float(config.target_value))
    else:
        sim_engine.controller.target_depth_m = sim_engine.state["z"]
    return {
        "status": "OK",
        "depth_hold_enabled": sim_engine.controller.depth_hold_enabled,
        "target_depth_m": sim_engine.controller.target_depth_m
    }


@router.post("/control/heading-hold")
def set_heading_hold(config: HoldConfig):
    if not sim_engine:
        raise HTTPException(status_code=503, detail="Simulation engine not initialized")
    sim_engine.controller.heading_hold_enabled = config.enabled
    if config.target_value is not None:
        import math
        sim_engine.controller.target_heading_rad = math.radians(float(config.target_value))
    else:
        sim_engine.controller.target_heading_rad = sim_engine.state["yaw"]
    return {
        "status": "OK",
        "heading_hold_enabled": sim_engine.controller.heading_hold_enabled
    }


@router.post("/mission/waypoints")
def set_waypoints(req: WaypointListRequest):
    if not sim_engine:
        raise HTTPException(status_code=503, detail="Simulation engine not initialized")
    sim_engine.navigator.set_waypoints([wp.model_dump() for wp in req.waypoints])
    sim_engine.log_event("INFO", f"Updated mission plan: {len(req.waypoints)} waypoints configured.")
    return {"status": "OK", "waypoints_count": len(req.waypoints)}


@router.post("/mission/start")
def start_mission():
    if not sim_engine:
        raise HTTPException(status_code=503, detail="Simulation engine not initialized")
    success = sim_engine.start_mission()
    if not success:
        raise HTTPException(status_code=400, detail="Cannot start mission: no waypoints loaded")
    return {"status": "OK", "message": "Mission Started"}


@router.post("/mission/pause")
def pause_mission():
    if not sim_engine:
        raise HTTPException(status_code=503, detail="Simulation engine not initialized")
    sim_engine.pause_mission()
    return {"status": "OK", "message": "Mission Paused"}


@router.post("/mission/resume")
def resume_mission():
    if not sim_engine:
        raise HTTPException(status_code=503, detail="Simulation engine not initialized")
    sim_engine.resume_mission()
    return {"status": "OK", "message": "Mission Resumed"}


@router.post("/mission/cancel")
def cancel_mission():
    if not sim_engine:
        raise HTTPException(status_code=503, detail="Simulation engine not initialized")
    sim_engine.cancel_mission()
    return {"status": "OK", "message": "Mission Cancelled"}


@router.post("/mission/preset")
def load_preset(req: PresetMissionRequest):
    if not sim_engine:
        raise HTTPException(status_code=503, detail="Simulation engine not initialized")
    sim_engine.load_preset_mission(req.preset_name)
    return {"status": "OK", "preset_loaded": req.preset_name}
