# Forward Multi-Beam Acoustic Sonar Scan
std_msgs/Header header

float32 fov_degrees
float32 min_distance_meters
float32 closest_angle_degrees
string closest_target_label
string threat_level           # "CLEAR", "CAUTION", "WARNING", "CRITICAL"

float32[] beam_angles_deg
float32[] beam_ranges_m
bool[] beam_contacts
