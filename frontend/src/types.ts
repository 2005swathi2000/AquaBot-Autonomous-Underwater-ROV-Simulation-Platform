export type ROVMode = 'MANUAL' | 'AUTONOMOUS' | 'EMERGENCY_STOP';
export type ThreatLevel = 'CLEAR' | 'CAUTION' | 'WARNING' | 'CRITICAL';
export type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS';

export interface Position3D {
  x: number;
  y: number;
  z: number;
}

export interface OrientationEuler {
  roll_deg: number;
  pitch_deg: number;
  yaw_deg: number;
  heading_deg: number;
}

export interface Velocity {
  u_surge: number;
  v_sway: number;
  w_heave: number;
  r_yaw_rate: number;
  speed_total: number;
}

export interface SonarBeam {
  beam_id: number;
  relative_angle_deg: number;
  distance_m: number;
  target: string;
  detected: boolean;
}

export interface SonarData {
  min_distance_m: number;
  threat_level: ThreatLevel;
  closest_target: string;
  closest_angle_deg: number;
  beams: SonarBeam[];
  max_range_m: number;
  healthy: boolean;
  type: string;
}

export interface DepthData {
  depth_m: number;
  true_depth_m: number;
  pressure_kpa: number;
  pressure_bar: number;
  healthy: boolean;
  type: string;
}

export interface IMUData {
  linear_acceleration: {
    ax: number;
    ay: number;
    az: number;
  };
  angular_velocity: {
    wx: number;
    wy: number;
    wz: number;
  };
  orientation_euler_deg: {
    roll: number;
    pitch: number;
    yaw: number;
  };
  orientation_quaternion: {
    w: number;
    x: number;
    y: number;
    z: number;
  };
  healthy: boolean;
  type: string;
}

export interface CompassData {
  heading_deg: number;
  true_heading_deg: number;
  cardinal: string;
  declination_deg: number;
  healthy: boolean;
  type: string;
}

export interface BatteryData {
  battery_pct: number;
  voltage_v: number;
  current_a: number;
  power_w: number;
  remaining_minutes: number;
  low_battery_warning: boolean;
  critical_battery: boolean;
  healthy: boolean;
  type: string;
}

export interface SensorsTelemetry {
  depth: DepthData;
  sonar: SonarData;
  imu: IMUData;
  compass: CompassData;
  battery: BatteryData;
}

export interface Waypoint {
  id: number;
  x: number;
  y: number;
  z: number;
  name: string;
  reached: boolean;
}

export interface NavigationTelemetry {
  state: string;
  total_waypoints: number;
  current_wp_index: number;
  current_wp: Waypoint | null;
  distance_to_wp_m: number;
  waypoints: Waypoint[];
  avoidance_status: string;
}

export interface ThrusterDiagnostics {
  thruster_powers_pct: number[];
  thruster_forces_n: number[];
  power_consumption_w: number;
}

export interface TelemetryChartsData {
  time: number[];
  depth: number[];
  speed: number[];
  battery: number[];
  obstacle_dist: number[];
}

export interface SystemLogItem {
  time: number;
  timestamp: string;
  level: LogLevel;
  message: string;
}

export interface TelemetryPayload {
  sim_time: number;
  mode: ROVMode;
  status: string;
  position: Position3D;
  orientation: OrientationEuler;
  velocity: Velocity;
  sensors: SensorsTelemetry;
  thrusters: ThrusterDiagnostics;
  navigation: NavigationTelemetry;
  charts: TelemetryChartsData;
  system_logs: SystemLogItem[];
}

export interface WorldObstacle {
  id: string;
  name: string;
  shape: string;
  x: number;
  y: number;
  z: number;
  radius: number;
  height: number;
  color: string;
}

export interface WorldConfig {
  bounds_x: [number, number];
  bounds_y: [number, number];
  bounds_z: [number, number];
  obstacles: WorldObstacle[];
}
