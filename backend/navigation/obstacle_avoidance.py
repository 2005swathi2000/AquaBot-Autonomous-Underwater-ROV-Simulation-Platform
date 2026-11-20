"""
AquaBot - Reactive Artificial Potential Field (APF) Obstacle Avoidance
Implements hybrid APF and Vector Field Histogram reactive avoidance for underwater ROV navigation.
Generates repulsive forces from sonar beam contacts, dynamically re-orienting the vehicle around
obstacles while keeping progress towards the active waypoint.
"""

import math
from typing import Dict, Any, Tuple, List


class ObstacleAvoidanceSystem:
    def __init__(
        self,
        influence_radius: float = 6.0,    # Distance at which obstacles begin exerting repulsion (m)
        critical_distance: float = 1.6,   # Distance triggering emergency avoidance reverse (m)
        k_att: float = 1.0,               # Attractive gain
        k_rep: float = 4.5                # Repulsive gain
    ):
        self.influence_radius = influence_radius
        self.critical_distance = critical_distance
        self.k_att = k_att
        self.k_rep = k_rep
        
        self.avoidance_active = False
        self.emergency_reverse = False
        self.avoidance_status = "CLEAR"

    def compute_avoidance_vector(
        self,
        rov_x: float,
        rov_y: float,
        rov_yaw: float,
        target_x: float,
        target_y: float,
        sonar_readings: Dict[str, Any]
    ) -> Tuple[float, float, str]:
        """
        Calculates safe desired heading and surge speed factor using Artificial Potential Fields.
        Returns:
            desired_heading_rad: Adjusted heading for the ROV controller
            speed_factor: Multiplier [0.0 - 1.0] or negative [-0.6 to -0.2] if emergency reverse
            status: "CLEAR", "AVOIDING", "EMERGENCY_REVERSE"
        """
        # 1. Attractive force vector towards goal in world frame
        dx_goal = target_x - rov_x
        dy_goal = target_y - rov_y
        dist_goal = math.hypot(dx_goal, dy_goal)

        if dist_goal > 1e-4:
            f_att_x = (dx_goal / dist_goal) * self.k_att
            f_att_y = (dy_goal / dist_goal) * self.k_att
        else:
            f_att_x = 0.0
            f_att_y = 0.0

        # 2. Repulsive force vectors from sonar beams in world frame
        f_rep_x = 0.0
        f_rep_y = 0.0
        min_dist = sonar_readings.get("min_distance_m", 25.0)
        beams = sonar_readings.get("beams", [])

        num_repulsive_hits = 0

        for beam in beams:
            d = beam["distance_m"]
            if d < self.influence_radius and beam.get("detected", False):
                # Beam angle in world coordinates
                rel_angle_rad = math.radians(beam["relative_angle_deg"])
                beam_world_angle = rov_yaw + rel_angle_rad

                # Repulsive magnitude: inverse quadratic law
                rep_mag = self.k_rep * (1.0 / max(d, 0.4) - 1.0 / self.influence_radius) * (1.0 / (max(d, 0.4) ** 2))
                
                # Push opposite to beam direction
                f_rep_x += -math.cos(beam_world_angle) * rep_mag
                f_rep_y += -math.sin(beam_world_angle) * rep_mag
                
                # Collinear symmetry breaking: if obstacle is dead ahead, induce lateral clearance bias (standard marine maritime convention: turn starboard/right)
                if abs(rel_angle_rad) < 0.15:
                    f_rep_x += -math.sin(beam_world_angle) * rep_mag * 0.75
                    f_rep_y += math.cos(beam_world_angle) * rep_mag * 0.75

                num_repulsive_hits += 1

        # 3. Emergency Critical Distance Handling
        if min_dist <= self.critical_distance:
            self.emergency_reverse = True
            self.avoidance_active = True
            self.avoidance_status = "EMERGENCY_REVERSE"

            # Emergency action: Reverse back and turn away from closest beam
            closest_angle_deg = sonar_readings.get("closest_angle_deg", 0.0)
            # Turn opposite to closest obstacle
            turn_bias = -1.2 if closest_angle_deg >= 0.0 else 1.2
            escape_heading = (rov_yaw + turn_bias + math.pi) % (2.0 * math.pi) - math.pi
            
            # Negative surge speed factor (reverse)
            speed_factor = -0.5
            return escape_heading, speed_factor, self.avoidance_status

        # 4. Standard Potential Field Combination
        if num_repulsive_hits > 0:
            self.avoidance_active = True
            self.avoidance_status = "AVOIDING"
            self.emergency_reverse = False

            f_total_x = f_att_x + f_rep_x
            f_total_y = f_att_y + f_rep_y

            desired_heading_rad = math.atan2(f_total_y, f_total_x)
            
            # Modulate speed: slow down when obstacle is near
            speed_factor = max(0.25, min(1.0, (min_dist - self.critical_distance) / (self.influence_radius - self.critical_distance)))
        else:
            self.avoidance_active = False
            self.avoidance_status = "CLEAR"
            self.emergency_reverse = False

            desired_heading_rad = math.atan2(dy_goal, dx_goal)
            speed_factor = 1.0

        return desired_heading_rad, speed_factor, self.avoidance_status
