# ROV Operating Status Message
std_msgs/Header header

string mode              # "MANUAL", "AUTONOMOUS", "EMERGENCY_STOP"
string health_status     # "OPERATIONAL", "DEGRADED", "EMERGENCY"
float32 battery_percentage
float32 battery_voltage
float32 power_consumption_watts

# 6-DOF Kinematic State
geometry_msgs/Point position
geometry_msgs/Vector3 orientation_euler_deg
geometry_msgs/Twist velocity
geometry_msgs/Vector3 linear_acceleration
