"""
AquaBot - Forward-Looking Acoustic Sonar Sensor
Simulates a multi-beam forward imaging/ranging sonar (e.g. Ping360 / Micron DST).
Casts multiple acoustic beams across a forward horizontal field of view (FOV) to detect
obstacles, compute distance, and calculate collision threat levels.
"""

import math
import random
from typing import Dict, Any, List
from ..simulation.world import UnderwaterWorld


class SonarSensor:
    def __init__(
        self,
        world: UnderwaterWorld,
        fov_deg: float = 90.0,
        num_beams: int = 7,
        max_range: float = 25.0,
        min_range: float = 0.3,
        noise_std: float = 0.05
    ):
        self.world = world
        self.fov_deg = fov_deg
        self.num_beams = num_beams
        self.max_range = max_range
        self.min_range = min_range
        self.noise_std = noise_std
        self.is_healthy = True

        # Beam angles relative to ROV forward heading
        # e.g., for 7 beams across 90 deg: -45, -30, -15, 0, 15, 30, 45
        self.beam_offsets_rad = [
            math.radians(-fov_deg / 2.0 + i * (fov_deg / (num_beams - 1)))
            for i in range(num_beams)
        ]

    def read(self, rov_x: float, rov_y: float, rov_z: float, rov_yaw: float) -> Dict[str, Any]:
        """
        Pings acoustic beams across the forward sector and measures distance to nearest surfaces.
        """
        beams_data: List[Dict[str, Any]] = []
        min_distance = self.max_range
        closest_hit_entity = None
        closest_beam_angle_deg = 0.0

        for idx, offset_rad in enumerate(self.beam_offsets_rad):
            angle_rad = rov_yaw + offset_rad
            angle_deg = round(math.degrees(offset_rad), 1)

            # Cast ray in underwater world
            raw_dist, entity = self.world.cast_ray(
                rx=rov_x, ry=rov_y, rz=rov_z,
                angle_horizontal_rad=angle_rad,
                angle_vertical_rad=0.0,
                max_range=self.max_range
            )

            # Add acoustic measurement noise
            noise = random.gauss(0.0, self.noise_std)
            measured_dist = max(self.min_range, min(self.max_range, raw_dist + noise))

            if measured_dist < min_distance:
                min_distance = measured_dist
                closest_hit_entity = entity
                closest_beam_angle_deg = angle_deg

            beams_data.append({
                "beam_id": idx,
                "relative_angle_deg": angle_deg,
                "distance_m": round(float(measured_dist), 2),
                "target": entity or "Open Water",
                "detected": raw_dist < self.max_range
            })

        # Collision Risk Assessment
        if min_distance < 1.5:
            threat_level = "CRITICAL"
        elif min_distance < 3.0:
            threat_level = "WARNING"
        elif min_distance < 5.0:
            threat_level = "CAUTION"
        else:
            threat_level = "CLEAR"

        return {
            "min_distance_m": round(float(min_distance), 2),
            "threat_level": threat_level,
            "closest_target": closest_hit_entity or "Clear",
            "closest_angle_deg": round(float(closest_beam_angle_deg), 1),
            "beams": beams_data,
            "max_range_m": self.max_range,
            "healthy": self.is_healthy,
            "type": "SIMULATED_FORWARD_ACOUSTIC_SONAR"
        }
