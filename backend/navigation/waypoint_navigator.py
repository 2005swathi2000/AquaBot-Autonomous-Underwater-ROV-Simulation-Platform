"""
AquaBot - 3D Waypoint Navigation & Mission Executive
Coordinates autonomous waypoint sequencing, acceptance radius evaluation,
cross-track error calculations, and integrates the obstacle avoidance system.
"""

import math
from typing import List, Dict, Any, Optional, Tuple
from .obstacle_avoidance import ObstacleAvoidanceSystem


class Waypoint:
    def __init__(self, id: int, x: float, y: float, z: float, name: str = ""):
        self.id = id
        self.x = float(x)
        self.y = float(y)
        self.z = float(z)  # Target depth (m)
        self.name = name or f"WP-{id}"
        self.reached = False

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "x": round(self.x, 2),
            "y": round(self.y, 2),
            "z": round(self.z, 2),
            "name": self.name,
            "reached": self.reached
        }


class WaypointNavigator:
    def __init__(self):
        self.waypoints: List[Waypoint] = []
        self.current_wp_index: int = 0
        self.state: str = "IDLE" # IDLE, NAVIGATING, PAUSED, AVOIDING, COMPLETED, CANCELLED
        
        # Acceptance tolerances
        self.acceptance_radius_xy: float = 1.4  # meters
        self.acceptance_depth_z: float = 0.8    # meters
        
        self.avoidance_system = ObstacleAvoidanceSystem()
        self.last_cross_track_error: float = 0.0

    def add_waypoint(self, x: float, y: float, z: float, name: str = "") -> Waypoint:
        new_id = len(self.waypoints) + 1
        wp = Waypoint(id=new_id, x=x, y=y, z=z, name=name)
        self.waypoints.append(wp)
        return wp

    def set_waypoints(self, points: List[Dict[str, Any]]):
        self.waypoints = [
            Waypoint(
                id=idx + 1,
                x=float(p.get("x", 0.0)),
                y=float(p.get("y", 0.0)),
                z=float(p.get("z", 5.0)),
                name=p.get("name", f"WP-{idx+1}")
            )
            for idx, p in enumerate(points)
        ]
        self.current_wp_index = 0
        self.state = "IDLE"

    def clear(self):
        self.waypoints = []
        self.current_wp_index = 0
        self.state = "IDLE"

    def start_mission(self) -> bool:
        if not self.waypoints:
            return False
        self.current_wp_index = 0
        for wp in self.waypoints:
            wp.reached = False
        self.state = "NAVIGATING"
        return True

    def pause_mission(self):
        if self.state in ["NAVIGATING", "AVOIDING"]:
            self.state = "PAUSED"

    def resume_mission(self):
        if self.state == "PAUSED":
            self.state = "NAVIGATING"

    def cancel_mission(self):
        self.state = "CANCELLED"

    def get_current_waypoint(self) -> Optional[Waypoint]:
        if 0 <= self.current_wp_index < len(self.waypoints):
            return self.waypoints[self.current_wp_index]
        return None

    def compute_guidance(
        self,
        rov_x: float,
        rov_y: float,
        rov_z: float,
        rov_yaw: float,
        sonar_readings: Dict[str, Any]
    ) -> Tuple[float, float, float, str]:
        """
        Calculates autonomous navigation guidance:
        Returns:
            cmd_surge_factor: [-1.0, 1.0] forward/reverse drive command
            target_heading_rad: Desired vehicle yaw
            target_depth_m: Desired vehicle depth
            mission_event: Event string or None (e.g. "WAYPOINT_REACHED", "MISSION_COMPLETED")
        """
        if self.state not in ["NAVIGATING", "AVOIDING"]:
            return 0.0, rov_yaw, rov_z, "NOT_ACTIVE"

        current_wp = self.get_current_waypoint()
        if not current_wp:
            self.state = "COMPLETED"
            return 0.0, rov_yaw, rov_z, "MISSION_COMPLETED"

        # Check waypoint arrival
        dist_xy = math.hypot(current_wp.x - rov_x, current_wp.y - rov_y)
        dist_z = abs(current_wp.z - rov_z)

        if dist_xy <= self.acceptance_radius_xy and dist_z <= self.acceptance_depth_z:
            current_wp.reached = True
            self.current_wp_index += 1
            if self.current_wp_index >= len(self.waypoints):
                self.state = "COMPLETED"
                return 0.0, rov_yaw, rov_z, f"MISSION_COMPLETED: Reached {current_wp.name}"
            else:
                next_wp = self.waypoints[self.current_wp_index]
                return 0.0, rov_yaw, next_wp.z, f"WAYPOINT_REACHED: Advancing to {next_wp.name}"

        # Evaluate Obstacle Avoidance Guidance
        avoid_heading, speed_factor, avoid_status = self.avoidance_system.compute_avoidance_vector(
            rov_x=rov_x,
            rov_y=rov_y,
            rov_yaw=rov_yaw,
            target_x=current_wp.x,
            target_y=current_wp.y,
            sonar_readings=sonar_readings
        )

        if avoid_status in ["AVOIDING", "EMERGENCY_REVERSE"]:
            self.state = "AVOIDING"
        else:
            self.state = "NAVIGATING"

        # Heading alignment factor: slow down surge drive if heading error is large
        heading_err = (avoid_heading - rov_yaw + math.pi) % (2.0 * math.pi) - math.pi
        alignment_factor = max(0.2, math.cos(heading_err))

        cmd_surge = speed_factor * alignment_factor
        return cmd_surge, avoid_heading, current_wp.z, avoid_status

    def get_status_dict(self, rov_x: float, rov_y: float, rov_z: float) -> Dict[str, Any]:
        current_wp = self.get_current_waypoint()
        dist_to_wp = 0.0
        if current_wp:
            dist_to_wp = math.hypot(current_wp.x - rov_x, current_wp.y - rov_y)

        return {
            "state": self.state,
            "total_waypoints": len(self.waypoints),
            "current_wp_index": self.current_wp_index,
            "current_wp": current_wp.to_dict() if current_wp else None,
            "distance_to_wp_m": round(float(dist_to_wp), 2),
            "waypoints": [wp.to_dict() for wp in self.waypoints],
            "avoidance_status": self.avoidance_system.avoidance_status
        }
