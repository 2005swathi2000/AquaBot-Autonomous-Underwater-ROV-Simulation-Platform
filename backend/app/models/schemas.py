"""
AquaBot - Pydantic Request & Response Data Models
"""

from typing import List, Optional
from pydantic import BaseModel, Field


class TeleopCommand(BaseModel):
    surge: float = Field(0.0, ge=-1.0, le=1.0, description="Forward (+1.0) / Backward (-1.0)")
    sway: float = Field(0.0, ge=-1.0, le=1.0, description="Right (+1.0) / Left (-1.0)")
    heave: float = Field(0.0, ge=-1.0, le=1.0, description="Descend (+1.0) / Ascend (-1.0)")
    yaw: float = Field(0.0, ge=-1.0, le=1.0, description="Turn Right (+1.0) / Turn Left (-1.0)")


class WaypointItem(BaseModel):
    x: float = Field(..., description="East coordinate (m)")
    y: float = Field(..., description="North coordinate (m)")
    z: float = Field(..., description="Target depth below surface (m)")
    name: Optional[str] = Field("", description="Waypoint descriptive label")


class WaypointListRequest(BaseModel):
    waypoints: List[WaypointItem]


class PresetMissionRequest(BaseModel):
    preset_name: str = Field(..., description="Name of the mission preset (e.g. 'Pipeline Survey')")


class HoldConfig(BaseModel):
    enabled: bool
    target_value: Optional[float] = None
