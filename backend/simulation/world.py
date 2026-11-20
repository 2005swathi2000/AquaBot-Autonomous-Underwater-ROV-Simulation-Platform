"""
AquaBot - Underwater Environment & World Obstacle Model
Defines the underwater world geometry, obstacles, boundaries, and raycasting engine
used by the sonar sensor and obstacle avoidance system.
"""

import math
from typing import List, Dict, Any, Optional, Tuple


class UnderwaterObstacle:
    def __init__(
        self,
        id: str,
        name: str,
        shape: str, # "cylinder", "sphere", "box"
        x: float,
        y: float,
        z: float,   # Depth of center or base (m)
        radius: float,
        height: float = 10.0,
        width: float = 2.0,
        depth: float = 2.0,
        color: str = "#4a6984"
    ):
        self.id = id
        self.name = name
        self.shape = shape
        self.x = x
        self.y = y
        self.z = z
        self.radius = radius
        self.height = height
        self.width = width
        self.depth = depth
        self.color = color

    def distance_to_point_2d(self, px: float, py: float) -> float:
        """Distance from point to obstacle surface in horizontal plane."""
        dist_center = math.hypot(px - self.x, py - self.y)
        return max(0.0, dist_center - self.radius)

    def is_inside_3d(self, px: float, py: float, pz: float, margin: float = 0.0) -> bool:
        """Checks if a 3D point is inside the obstacle volume plus an optional safety margin."""
        r = self.radius + margin
        if math.hypot(px - self.x, py - self.y) > r:
            return False
        # Depth check: obstacle extends from z - height/2 to z + height/2
        z_min = self.z - self.height / 2.0 - margin
        z_max = self.z + self.height / 2.0 + margin
        return z_min <= pz <= z_max

    def ray_intersect_cylinder(
        self,
        rx: float, ry: float, rz: float,
        dx: float, dy: float, dz: float,
        max_dist: float
    ) -> Optional[float]:
        """
        Calculates ray-cylinder intersection distance in 3D.
        Ray: P(t) = (rx, ry, rz) + t * (dx, dy, dz), t > 0
        """
        # Horizontal intersection (2D circle)
        ox = rx - self.x
        oy = ry - self.y

        # Quadratic equation: a*t^2 + b*t + c = 0 in XY plane
        a = dx * dx + dy * dy
        if a < 1e-8:
            return None # Ray is purely vertical

        b = 2.0 * (ox * dx + oy * dy)
        c = ox * ox + oy * oy - self.radius * self.radius

        discriminant = b * b - 4.0 * a * c
        if discriminant < 0.0:
            return None # No intersection

        sqrt_disc = math.sqrt(discriminant)
        t1 = (-b - sqrt_disc) / (2.0 * a)
        t2 = (-b + sqrt_disc) / (2.0 * a)

        # Check candidate t values that are positive and within max_dist
        candidates = [t for t in (t1, t2) if t > 0.05 and t <= max_dist]
        for t in candidates:
            hit_z = rz + t * dz
            # Check if hit is within the cylinder's vertical height bounds
            z_min = self.z - self.height / 2.0
            z_max = self.z + self.height / 2.0
            if z_min <= hit_z <= z_max:
                return t

        return None


class UnderwaterWorld:
    def __init__(self):
        # Environmental boundaries
        self.bounds_x = (-35.0, 35.0)
        self.bounds_y = (-35.0, 35.0)
        self.bounds_z = (0.2, 35.0) # Depth 0.2m (surface) to 35m (seafloor)
        
        # Predefined underwater obstacles (structures, geological pillars, submerged pipes)
        self.obstacles: List[UnderwaterObstacle] = [
            UnderwaterObstacle(
                id="obs-1", name="Hydrothermal Spire A", shape="cylinder",
                x=8.0, y=10.0, z=15.0, radius=2.5, height=22.0, color="#d97706"
            ),
            UnderwaterObstacle(
                id="obs-2", name="Deep Rock Ridge", shape="cylinder",
                x=-12.0, y=14.0, z=18.0, radius=3.2, height=25.0, color="#64748b"
            ),
            UnderwaterObstacle(
                id="obs-3", name="Subsea Pipeline Manifold", shape="cylinder",
                x=15.0, y=-10.0, z=12.0, radius=2.8, height=18.0, color="#0284c7"
            ),
            UnderwaterObstacle(
                id="obs-4", name="Sunken Foundation Column", shape="cylinder",
                x=-10.0, y=-12.0, z=14.0, radius=2.0, height=20.0, color="#475569"
            ),
            UnderwaterObstacle(
                id="obs-5", name="Thermal Vent Tower", shape="cylinder",
                x=0.0, y=18.0, z=16.0, radius=2.2, height=24.0, color="#b45309"
            ),
            UnderwaterObstacle(
                id="obs-6", name="Exploration Mooring Pylon", shape="cylinder",
                x=-18.0, y=0.0, z=10.0, radius=1.8, height=18.0, color="#059669"
            ),
            UnderwaterObstacle(
                id="obs-7", name="Sonar Calibration Target", shape="cylinder",
                x=18.0, y=6.0, z=8.0, radius=1.5, height=14.0, color="#e11d48"
            ),
        ]

    def add_obstacle(self, obstacle: UnderwaterObstacle):
        self.obstacles.append(obstacle)

    def cast_ray(
        self,
        rx: float, ry: float, rz: float,
        angle_horizontal_rad: float,
        angle_vertical_rad: float = 0.0,
        max_range: float = 25.0
    ) -> Tuple[float, Optional[str]]:
        """
        Casts a ray from (rx, ry, rz) in the given direction.
        Returns (hit_distance, hit_obstacle_name_or_boundary).
        """
        dx = math.cos(angle_vertical_rad) * math.cos(angle_horizontal_rad)
        dy = math.cos(angle_vertical_rad) * math.sin(angle_horizontal_rad)
        dz = math.sin(angle_vertical_rad)

        min_hit = max_range
        hit_entity = None

        # 1. Test against all obstacles
        for obs in self.obstacles:
            hit = obs.ray_intersect_cylinder(rx, ry, rz, dx, dy, dz, min_hit)
            if hit is not None and hit < min_hit:
                min_hit = hit
                hit_entity = obs.name

        # 2. Test against environment boundaries (wall planes)
        # X boundary planes
        if abs(dx) > 1e-6:
            tx1 = (self.bounds_x[0] - rx) / dx
            tx2 = (self.bounds_x[1] - rx) / dx
            for tx in (tx1, tx2):
                if 0 < tx < min_hit:
                    min_hit = tx
                    hit_entity = "Perimeter Boundary"

        # Y boundary planes
        if abs(dy) > 1e-6:
            ty1 = (self.bounds_y[0] - ry) / dy
            ty2 = (self.bounds_y[1] - ry) / dy
            for ty in (ty1, ty2):
                if 0 < ty < min_hit:
                    min_hit = ty
                    hit_entity = "Perimeter Boundary"

        # Z boundary (seabed)
        if dz > 1e-6:
            tz = (self.bounds_z[1] - rz) / dz
            if 0 < tz < min_hit:
                min_hit = tz
                hit_entity = "Seafloor"

        return min_hit, hit_entity

    def get_obstacles_dict(self) -> List[Dict[str, Any]]:
        """Serializes obstacles for frontend 3D rendering and API response."""
        return [
            {
                "id": obs.id,
                "name": obs.name,
                "shape": obs.shape,
                "x": obs.x,
                "y": obs.y,
                "z": obs.z,
                "radius": obs.radius,
                "height": obs.height,
                "color": obs.color,
            }
            for obs in self.obstacles
        ]
