import { useState, useEffect, useRef, useCallback } from 'react';
import { TelemetryPayload, WorldConfig, Waypoint, SystemLogItem } from '../types';

const DEFAULT_WS_URL = import.meta.env.VITE_API_WS_URL || 'ws://localhost:8000/ws/telemetry';
const DEFAULT_HTTP_URL = import.meta.env.VITE_API_HTTP_URL || 'http://localhost:8000';

// Default World Model Configuration
const DEFAULT_WORLD: WorldConfig = {
  bounds_x: [-35.0, 35.0],
  bounds_y: [-35.0, 35.0],
  bounds_z: [0.2, 35.0],
  obstacles: [
    { id: 'obs-1', name: 'Hydrothermal Spire A', shape: 'cylinder', x: 8.0, y: 10.0, z: 15.0, radius: 2.5, height: 22.0, color: '#d97706' },
    { id: 'obs-2', name: 'Deep Rock Ridge', shape: 'cylinder', x: -12.0, y: 14.0, z: 18.0, radius: 3.2, height: 25.0, color: '#64748b' },
    { id: 'obs-3', name: 'Subsea Pipeline Manifold', shape: 'cylinder', x: 15.0, y: -10.0, z: 12.0, radius: 2.8, height: 18.0, color: '#0284c7' },
    { id: 'obs-4', name: 'Sunken Foundation Column', shape: 'cylinder', x: -10.0, y: -12.0, z: 14.0, radius: 2.0, height: 20.0, color: '#475569' },
    { id: 'obs-5', name: 'Thermal Vent Tower', shape: 'cylinder', x: 0.0, y: 18.0, z: 16.0, radius: 2.2, height: 24.0, color: '#b45309' },
    { id: 'obs-6', name: 'Exploration Mooring Pylon', shape: 'cylinder', x: -18.0, y: 0.0, z: 10.0, radius: 1.8, height: 18.0, color: '#059669' },
    { id: 'obs-7', name: 'Sonar Calibration Target', shape: 'cylinder', x: 18.0, y: 6.0, z: 8.0, radius: 1.5, height: 14.0, color: '#e11d48' },
  ]
};

const DEFAULT_WAYPOINTS: Waypoint[] = [
  { id: 1, x: 6.0, y: 6.0, z: 8.0, name: 'Pipe Marker Alpha', reached: false },
  { id: 2, x: 12.0, y: -4.0, z: 12.0, name: 'Pipe Flange 02', reached: false },
  { id: 3, x: 18.0, y: -12.0, z: 14.0, name: 'Manifold Beta', reached: false },
  { id: 4, x: 4.0, y: -16.0, z: 10.0, name: 'Inspection Return', reached: false },
  { id: 5, x: 0.0, y: 0.0, z: 2.0, name: 'Home Mooring', reached: false },
];

export function useAquaBotSocket() {
  const [telemetry, setTelemetry] = useState<TelemetryPayload | null>(null);
  const [world, setWorld] = useState<WorldConfig>(DEFAULT_WORLD);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [ping, setPing] = useState<number>(0);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  const pingStartRef = useRef<number>(0);
  const serverConnectedRef = useRef<boolean>(false);

  // Client-Side Deterministic Fallback Physics Engine State
  const localSimState = useRef({
    time: 0,
    mode: 'MANUAL' as 'MANUAL' | 'AUTONOMOUS' | 'EMERGENCY_STOP',
    x: 0,
    y: 0,
    z: 2.0,
    roll: 0,
    pitch: 0,
    yaw: 0,
    u: 0,
    v: 0,
    w: 0,
    r: 0,
    speed: 0,
    cmdSurge: 0,
    cmdSway: 0,
    cmdHeave: 0,
    cmdYaw: 0,
    depthHold: true,
    headingHold: false,
    targetDepth: 2.0,
    targetHeading: 0,
    battery: 99.8,
    voltage: 16.4,
    powerW: 14.0,
    waypoints: [...DEFAULT_WAYPOINTS],
    currentWpIdx: 0,
    historyTime: [] as number[],
    historyDepth: [] as number[],
    historySpeed: [] as number[],
    historyBattery: [] as number[],
    historyObstacle: [] as number[],
    logs: [
      { time: 0, timestamp: '12:00:00', level: 'INFO', message: 'AquaBot simulation system initialized.' }
    ] as SystemLogItem[]
  });

  // Client-Side 20 Hz Simulation Loop (Active when WebSocket is not connected)
  useEffect(() => {
    const dt = 0.05;
    const interval = setInterval(() => {
      if (serverConnectedRef.current) return; // Backend is authoritatively streaming

      const s = localSimState.current;
      s.time += dt;

      // 1. Autonomous Navigation & Potential Field Obstacle Avoidance
      let effectiveSurge = s.cmdSurge;
      let effectiveSway = s.cmdSway;
      let effectiveHeave = s.cmdHeave;
      let effectiveYaw = s.cmdYaw;
      let avoidStatus = 'CLEAR';

      // Raycast Sonar
      const numBeams = 7;
      const fovDeg = 90;
      let minObstacleDist = 25.0;
      let closestTarget = 'Clear Water';
      let closestAngle = 0;
      const beams = [];

      for (let i = 0; i < numBeams; i++) {
        const offsetDeg = -fovDeg / 2 + i * (fovDeg / (numBeams - 1));
        const angleRad = s.yaw + (offsetDeg * Math.PI) / 180;
        let beamDist = 25.0;
        let beamTarget = 'Clear Water';

        // Check against obstacles
        DEFAULT_WORLD.obstacles.forEach((obs) => {
          const dx = obs.x - s.x;
          const dy = obs.y - s.y;
          const dCenter = Math.hypot(dx, dy);
          const angleToObs = Math.atan2(dy, dx);
          const angleDiff = Math.abs(Math.atan2(Math.sin(angleToObs - angleRad), Math.cos(angleToObs - angleRad)));

          if (angleDiff < 0.25 && dCenter < 25.0) {
            const surfaceDist = Math.max(0.4, dCenter - obs.radius);
            if (surfaceDist < beamDist) {
              beamDist = surfaceDist;
              beamTarget = obs.name;
            }
          }
        });

        if (beamDist < minObstacleDist) {
          minObstacleDist = beamDist;
          closestTarget = beamTarget;
          closestAngle = offsetDeg;
        }

        beams.push({
          beam_id: i,
          relative_angle_deg: offsetDeg,
          distance_m: Number(beamDist.toFixed(2)),
          target: beamTarget,
          detected: beamDist < 25.0
        });
      }

      const threatLevel = minObstacleDist < 1.6 ? 'CRITICAL' : minObstacleDist < 3.5 ? 'WARNING' : minObstacleDist < 5.5 ? 'CAUTION' : 'CLEAR';

      // Navigation logic
      if (s.mode === 'AUTONOMOUS' && s.currentWpIdx < s.waypoints.length) {
        const target = s.waypoints[s.currentWpIdx];
        const dx = target.x - s.x;
        const dy = target.y - s.y;
        const distToWp = Math.hypot(dx, dy);

        if (distToWp < 1.4 && Math.abs(target.z - s.z) < 1.0) {
          target.reached = true;
          s.currentWpIdx++;
          s.logs.unshift({
            time: Math.round(s.time),
            timestamp: new Date().toLocaleTimeString(),
            level: 'SUCCESS',
            message: `Reached waypoint ${target.name}!`
          });
        } else {
          // Desired heading to waypoint
          let desiredHeading = Math.atan2(dy, dx);

          // Obstacle avoidance deflection
          if (minObstacleDist < 5.0) {
            avoidStatus = 'AVOIDING';
            const avoidBias = closestAngle >= 0 ? -0.8 : 0.8;
            desiredHeading += avoidBias;
            effectiveSurge = 0.35;
          } else {
            effectiveSurge = 0.65;
          }

          if (minObstacleDist < 1.6) {
            avoidStatus = 'EMERGENCY_REVERSE';
            effectiveSurge = -0.4;
          }

          // Heading tracking
          const headErr = Math.atan2(Math.sin(desiredHeading - s.yaw), Math.cos(desiredHeading - s.yaw));
          effectiveYaw = Math.max(-1.0, Math.min(1.0, 1.4 * headErr));

          // Depth tracking
          const depthErr = target.z - s.z;
          effectiveHeave = Math.max(-0.8, Math.min(0.8, 1.1 * depthErr));
        }
      } else if (s.mode === 'MANUAL') {
        if (s.depthHold && Math.abs(s.cmdHeave) < 0.05) {
          const depthErr = s.targetDepth - s.z;
          effectiveHeave = Math.max(-0.8, Math.min(0.8, 1.2 * depthErr));
        }
        if (s.headingHold && Math.abs(s.cmdYaw) < 0.05) {
          const headErr = Math.atan2(Math.sin(s.targetHeading - s.yaw), Math.cos(s.targetHeading - s.yaw));
          effectiveYaw = Math.max(-1.0, Math.min(1.0, 1.5 * headErr));
        }
      } else if (s.mode === 'EMERGENCY_STOP') {
        effectiveSurge = 0;
        effectiveSway = 0;
        effectiveHeave = 0;
        effectiveYaw = 0;
      }

      // 2. Fossen Simplified Hydrodynamics Integration
      // Drag acceleration: du = (thrust - drag_linear*u - drag_quad*|u|*u) / total_mass
      const massX = 18.5; // Dry + added mass
      const dragLinX = 8.0;
      const dragQuadX = 16.0;
      const thrustX = effectiveSurge * 40.0;
      const accelU = (thrustX - dragLinX * s.u - dragQuadX * Math.abs(s.u) * s.u) / massX;
      s.u = Math.max(-1.5, Math.min(2.2, s.u + accelU * dt));

      const massY = 21.5;
      const thrustY = effectiveSway * 30.0;
      const accelV = (thrustY - 14.0 * s.v - 28.0 * Math.abs(s.v) * s.v) / massY;
      s.v = Math.max(-1.2, Math.min(1.2, s.v + accelV * dt));

      const massZ = 21.5;
      const thrustZ = effectiveHeave * 35.0;
      const accelW = (thrustZ - 18.0 * s.w - 36.0 * Math.abs(s.w) * s.w - 0.8) / massZ;
      s.w = Math.max(-1.0, Math.min(1.0, s.w + accelW * dt));

      const inertiaZ = 0.70;
      const torqueZ = effectiveYaw * 8.0;
      const accelR = (torqueZ - 2.5 * s.r - 4.0 * Math.abs(s.r) * s.r) / inertiaZ;
      s.r = Math.max(-1.5, Math.min(1.5, s.r + accelR * dt));

      // Kinematics in World Coordinates
      const cosPsi = Math.cos(s.yaw);
      const sinPsi = Math.sin(s.yaw);
      const vxWorld = s.u * cosPsi - s.v * sinPsi;
      const vyWorld = s.u * sinPsi + s.v * cosPsi;
      const vzWorld = s.w;

      s.x = Math.max(-35, Math.min(35, s.x + vxWorld * dt));
      s.y = Math.max(-35, Math.min(35, s.y + vyWorld * dt));
      s.z = Math.max(0.2, Math.min(34.8, s.z + vzWorld * dt));
      s.yaw = Math.atan2(Math.sin(s.yaw + s.r * dt), Math.cos(s.yaw + s.r * dt));
      s.speed = Math.hypot(vxWorld, vyWorld, vzWorld);

      // Pitch & Roll dynamics
      s.pitch = s.pitch + (0.04 * s.u - s.pitch) * 0.15;
      s.roll = s.roll + (-0.05 * s.v - s.roll) * 0.15;

      // Battery drain
      s.powerW = 14.0 + Math.abs(effectiveSurge * 40) + Math.abs(effectiveHeave * 35) + Math.abs(effectiveYaw * 20);
      s.battery = Math.max(0, s.battery - (s.powerW / 230.0 / 3600.0) * dt * 100);
      s.voltage = 13.0 + 3.8 * (s.battery / 100);

      // Update History Buffers
      if (s.historyTime.length === 0 || s.time - s.historyTime[s.historyTime.length - 1] >= 0.5) {
        s.historyTime.push(Number(s.time.toFixed(1)));
        s.historyDepth.push(Number(s.z.toFixed(2)));
        s.historySpeed.push(Number(s.speed.toFixed(2)));
        s.historyBattery.push(Number(s.battery.toFixed(1)));
        s.historyObstacle.push(Number(minObstacleDist.toFixed(2)));
        if (s.historyTime.length > 80) {
          s.historyTime.shift();
          s.historyDepth.shift();
          s.historySpeed.shift();
          s.historyBattery.shift();
          s.historyObstacle.shift();
        }
      }

      // Generate Telemetry Frame
      const currentWp = s.waypoints[s.currentWpIdx] || null;
      const distToWp = currentWp ? Math.hypot(currentWp.x - s.x, currentWp.y - s.y) : 0;
      const headingDeg = ((s.yaw * 180) / Math.PI + 360) % 360;

      const cardinals = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
      const cardIdx = Math.round(headingDeg / 45) % 8;

      const frame: TelemetryPayload = {
        sim_time: Number(s.time.toFixed(2)),
        mode: s.mode,
        status: s.mode === 'EMERGENCY_STOP' ? 'EMERGENCY_STOP' : 'OPERATIONAL',
        position: { x: Number(s.x.toFixed(2)), y: Number(s.y.toFixed(2)), z: Number(s.z.toFixed(2)) },
        orientation: {
          roll_deg: Number(((s.roll * 180) / Math.PI).toFixed(1)),
          pitch_deg: Number(((s.pitch * 180) / Math.PI).toFixed(1)),
          yaw_deg: Number(headingDeg.toFixed(1)),
          heading_deg: Number(headingDeg.toFixed(1))
        },
        velocity: {
          u_surge: Number(s.u.toFixed(2)),
          v_sway: Number(s.v.toFixed(2)),
          w_heave: Number(s.w.toFixed(2)),
          r_yaw_rate: Number(s.r.toFixed(3)),
          speed_total: Number(s.speed.toFixed(2))
        },
        sensors: {
          depth: {
            depth_m: Number(s.z.toFixed(2)),
            true_depth_m: Number(s.z.toFixed(2)),
            pressure_kpa: Number((101.3 + 10.05 * s.z).toFixed(1)),
            pressure_bar: Number((1.013 + 0.1005 * s.z).toFixed(3)),
            healthy: true,
            type: 'SIMULATED_PIEZORESISTIVE_DEPTH'
          },
          sonar: {
            min_distance_m: Number(minObstacleDist.toFixed(2)),
            threat_level: threatLevel as any,
            closest_target: closestTarget,
            closest_angle_deg: closestAngle,
            beams: beams,
            max_range_m: 25.0,
            healthy: true,
            type: 'SIMULATED_FORWARD_ACOUSTIC_SONAR'
          },
          imu: {
            linear_acceleration: { ax: Number(accelU.toFixed(2)), ay: Number(accelV.toFixed(2)), az: Number((accelW + 9.81).toFixed(2)) },
            angular_velocity: { wx: 0, wy: 0, wz: Number(s.r.toFixed(3)) },
            orientation_euler_deg: { roll: Number(((s.roll * 180) / Math.PI).toFixed(1)), pitch: Number(((s.pitch * 180) / Math.PI).toFixed(1)), yaw: Number(headingDeg.toFixed(1)) },
            orientation_quaternion: { w: Math.cos(s.yaw / 2), x: 0, y: 0, z: Math.sin(s.yaw / 2) },
            healthy: true,
            type: 'SIMULATED_6DOF_MEMS_IMU'
          },
          compass: {
            heading_deg: Number(headingDeg.toFixed(1)),
            true_heading_deg: Number(headingDeg.toFixed(1)),
            cardinal: cardinals[cardIdx],
            declination_deg: 1.2,
            healthy: true,
            type: 'SIMULATED_MAGNETIC_COMPASS'
          },
          battery: {
            battery_pct: Number(s.battery.toFixed(1)),
            voltage_v: Number(s.voltage.toFixed(2)),
            current_a: Number((s.powerW / s.voltage).toFixed(1)),
            power_w: Number(s.powerW.toFixed(0)),
            remaining_minutes: Number(((s.battery / 100) * 180).toFixed(0)),
            low_battery_warning: s.battery < 25,
            critical_battery: s.battery < 10,
            healthy: true,
            type: 'SIMULATED_4S_LIPO_BMS'
          }
        },
        thrusters: {
          thruster_powers_pct: [
            Math.round(Math.abs(effectiveSurge - effectiveSway - effectiveYaw) * 100),
            Math.round(Math.abs(effectiveSurge + effectiveSway + effectiveYaw) * 100),
            Math.round(Math.abs(effectiveSurge + effectiveSway - effectiveYaw) * 100),
            Math.round(Math.abs(effectiveSurge - effectiveSway + effectiveYaw) * 100),
            Math.round(Math.abs(effectiveHeave) * 100),
            Math.round(Math.abs(effectiveHeave) * 100),
          ],
          thruster_forces_n: [
            Number(((effectiveSurge - effectiveSway - effectiveYaw) * 32).toFixed(1)),
            Number(((effectiveSurge + effectiveSway + effectiveYaw) * 32).toFixed(1)),
            Number(((effectiveSurge + effectiveSway - effectiveYaw) * 32).toFixed(1)),
            Number(((effectiveSurge - effectiveSway + effectiveYaw) * 32).toFixed(1)),
            Number((effectiveHeave * 32).toFixed(1)),
            Number((effectiveHeave * 32).toFixed(1)),
          ],
          power_consumption_w: Number(s.powerW.toFixed(0))
        },
        navigation: {
          state: s.mode === 'AUTONOMOUS' ? avoidStatus : 'IDLE',
          total_waypoints: s.waypoints.length,
          current_wp_index: s.currentWpIdx,
          current_wp: currentWp,
          distance_to_wp_m: Number(distToWp.toFixed(2)),
          waypoints: s.waypoints,
          avoidance_status: avoidStatus
        },
        charts: {
          time: [...s.historyTime],
          depth: [...s.historyDepth],
          speed: [...s.historySpeed],
          battery: [...s.historyBattery],
          obstacle_dist: [...s.historyObstacle]
        },
        system_logs: [...s.logs].slice(0, 40)
      };

      setTelemetry(frame);
    }, 50);

    return () => clearInterval(interval);
  }, []);

  // WebSocket Connection with Exponential Backoff and Fallback Logging
  const connect = useCallback(() => {
    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    try {
      const ws = new WebSocket(DEFAULT_WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        serverConnectedRef.current = true;
        reconnectAttemptsRef.current = 0;
        pingStartRef.current = performance.now();
        ws.send(JSON.stringify({ action: 'ping' }));

        localSimState.current.logs.unshift({
          time: Math.round(localSimState.current.time),
          timestamp: new Date().toLocaleTimeString(),
          level: 'INFO',
          message: 'Authoritative backend WebSocket connected (20 Hz telemetry).'
        });
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'INIT') {
            if (data.world) setWorld(data.world);
            if (data.telemetry) setTelemetry(data.telemetry);
          } else if (data.type === 'PONG') {
            setPing(Math.round(performance.now() - pingStartRef.current));
          } else if (data.position && data.sensors) {
            setTelemetry(data as TelemetryPayload);
          }
        } catch (e) {
          console.error('Failed to parse WebSocket message', e);
        }
      };

      ws.onclose = () => {
        const wasConnected = serverConnectedRef.current;
        setIsConnected(false);
        serverConnectedRef.current = false;
        wsRef.current = null;

        if (wasConnected) {
          localSimState.current.logs.unshift({
            time: Math.round(localSimState.current.time),
            timestamp: new Date().toLocaleTimeString(),
            level: 'WARN',
            message: 'Backend disconnected. Seamlessly switched to client-side autonomous physics fallback.'
          });
        }

        const delay = Math.min(10000, Math.round(1500 * Math.pow(1.35, reconnectAttemptsRef.current) + Math.random() * 400));
        reconnectAttemptsRef.current += 1;
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);
      };

      ws.onerror = () => {
        serverConnectedRef.current = false;
        try {
          ws.close();
        } catch {}
      };
    } catch {
      serverConnectedRef.current = false;
      const delay = Math.min(10000, Math.round(1500 * Math.pow(1.35, reconnectAttemptsRef.current) + Math.random() * 400));
      reconnectAttemptsRef.current += 1;
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, delay);
    }
  }, []);

  useEffect(() => {
    connect();

    const pingInterval = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        pingStartRef.current = performance.now();
        wsRef.current.send(JSON.stringify({ action: 'ping' }));
      }
    }, 5000);

    return () => {
      clearInterval(pingInterval);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [connect]);

  // Command dispatchers
  const sendCommand = useCallback((cmd: any) => {
    // 1. Update local client physics state
    const s = localSimState.current;
    if (cmd.action === 'teleop') {
      s.mode = 'MANUAL';
      s.cmdSurge = cmd.surge;
      s.cmdSway = cmd.sway;
      s.cmdHeave = cmd.heave;
      s.cmdYaw = cmd.yaw;
      if (Math.abs(cmd.heave) > 0.05) s.targetDepth = s.z;
      if (Math.abs(cmd.yaw) > 0.05) s.targetHeading = s.yaw;
    } else if (cmd.action === 'stop') {
      s.cmdSurge = 0;
      s.cmdSway = 0;
      s.cmdHeave = 0;
      s.cmdYaw = 0;
    } else if (cmd.action === 'emergency_stop') {
      s.mode = 'EMERGENCY_STOP';
      s.cmdSurge = 0;
      s.cmdSway = 0;
      s.cmdHeave = 0;
      s.cmdYaw = 0;
      s.logs.unshift({
        time: Math.round(s.time),
        timestamp: new Date().toLocaleTimeString(),
        level: 'ERROR',
        message: 'EMERGENCY STOP engaged! Thruster interlock activated.'
      });
    } else if (cmd.action === 'clear_emergency_stop') {
      s.mode = 'MANUAL';
      s.targetDepth = s.z;
      s.targetHeading = s.yaw;
      s.logs.unshift({
        time: Math.round(s.time),
        timestamp: new Date().toLocaleTimeString(),
        level: 'INFO',
        message: 'Emergency stop cleared. ROV returned to manual standby.'
      });
    } else if (cmd.action === 'reset') {
      s.x = 0;
      s.y = 0;
      s.z = 2.0;
      s.u = 0;
      s.v = 0;
      s.w = 0;
      s.r = 0;
      s.yaw = 0;
      s.pitch = 0;
      s.roll = 0;
      s.speed = 0;
      s.mode = 'MANUAL';
      s.currentWpIdx = 0;
      s.waypoints.forEach((w) => (w.reached = false));
      s.logs.unshift({
        time: Math.round(s.time),
        timestamp: new Date().toLocaleTimeString(),
        level: 'INFO',
        message: 'Simulation reset to mooring base (0.0, 0.0, 2.0m).'
      });
    } else if (cmd.action === 'start_mission') {
      s.mode = 'AUTONOMOUS';
      s.currentWpIdx = 0;
      s.waypoints.forEach((w) => (w.reached = false));
      s.logs.unshift({
        time: Math.round(s.time),
        timestamp: new Date().toLocaleTimeString(),
        level: 'SUCCESS',
        message: `Autonomous mission started (${s.waypoints.length} waypoints).`
      });
    } else if (cmd.action === 'pause_mission') {
      s.mode = 'MANUAL';
      s.cmdSurge = 0;
      s.logs.unshift({
        time: Math.round(s.time),
        timestamp: new Date().toLocaleTimeString(),
        level: 'WARN',
        message: 'Autonomous mission paused.'
      });
    } else if (cmd.action === 'resume_mission') {
      s.mode = 'AUTONOMOUS';
      s.logs.unshift({
        time: Math.round(s.time),
        timestamp: new Date().toLocaleTimeString(),
        level: 'INFO',
        message: 'Autonomous mission resumed.'
      });
    } else if (cmd.action === 'cancel_mission') {
      s.mode = 'MANUAL';
      s.cmdSurge = 0;
      s.logs.unshift({
        time: Math.round(s.time),
        timestamp: new Date().toLocaleTimeString(),
        level: 'WARN',
        message: 'Autonomous mission aborted.'
      });
    }

    // 2. Transmit to backend WebSocket if connected
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(cmd));
    } else {
      fetch(`${DEFAULT_HTTP_URL}/api/v1/control/teleop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cmd)
      }).catch(() => {});
    }
  }, []);

  const sendTeleop = useCallback((surge: number, sway: number, heave: number, yaw: number) => {
    sendCommand({ action: 'teleop', surge, sway, heave, yaw });
  }, [sendCommand]);

  const stopROV = useCallback(() => {
    sendCommand({ action: 'stop' });
  }, [sendCommand]);

  const emergencyStop = useCallback(async () => {
    sendCommand({ action: 'emergency_stop' });
    try {
      await fetch(`${DEFAULT_HTTP_URL}/api/v1/control/emergency-stop`, { method: 'POST' });
    } catch {}
  }, [sendCommand]);

  const clearEmergencyStop = useCallback(async () => {
    sendCommand({ action: 'clear_emergency_stop' });
    try {
      await fetch(`${DEFAULT_HTTP_URL}/api/v1/control/clear-emergency-stop`, { method: 'POST' });
    } catch {}
  }, [sendCommand]);

  const resetSimulation = useCallback(async () => {
    sendCommand({ action: 'reset' });
    try {
      await fetch(`${DEFAULT_HTTP_URL}/api/v1/control/reset`, { method: 'POST' });
    } catch {}
  }, [sendCommand]);

  const startMission = useCallback(async () => {
    sendCommand({ action: 'start_mission' });
    try {
      await fetch(`${DEFAULT_HTTP_URL}/api/v1/mission/start`, { method: 'POST' });
    } catch {}
  }, [sendCommand]);

  const pauseMission = useCallback(async () => {
    sendCommand({ action: 'pause_mission' });
    try {
      await fetch(`${DEFAULT_HTTP_URL}/api/v1/mission/pause`, { method: 'POST' });
    } catch {}
  }, [sendCommand]);

  const resumeMission = useCallback(async () => {
    sendCommand({ action: 'resume_mission' });
    try {
      await fetch(`${DEFAULT_HTTP_URL}/api/v1/mission/resume`, { method: 'POST' });
    } catch {}
  }, [sendCommand]);

  const cancelMission = useCallback(async () => {
    sendCommand({ action: 'cancel_mission' });
    try {
      await fetch(`${DEFAULT_HTTP_URL}/api/v1/mission/cancel`, { method: 'POST' });
    } catch {}
  }, [sendCommand]);

  const loadPresetMission = useCallback(async (preset_name: string) => {
    const presets: Record<string, Waypoint[]> = {
      'Pipeline Survey': DEFAULT_WAYPOINTS,
      'Obstacle Slalom': [
        { id: 1, x: 4.0, y: 14.0, z: 12.0, name: 'Spire Gate 1', reached: false },
        { id: 2, x: -8.0, y: 16.0, z: 15.0, name: 'Thermal Vent Transit', reached: false },
        { id: 3, x: -16.0, y: 8.0, z: 18.0, name: 'Ridge Bypass', reached: false },
        { id: 4, x: -10.0, y: -6.0, z: 12.0, name: 'Sunken Column Recon', reached: false },
        { id: 5, x: 0.0, y: 0.0, z: 2.0, name: 'Base Return', reached: false }
      ],
      'Deep Trench Dive': [
        { id: 1, x: 5.0, y: 5.0, z: 10.0, name: 'Shallow Shelf', reached: false },
        { id: 2, x: 10.0, y: 10.0, z: 20.0, name: 'Abyssal Descent', reached: false },
        { id: 3, x: 12.0, y: 12.0, z: 28.0, name: 'Deep Vent Observation', reached: false },
        { id: 4, x: 0.0, y: 0.0, z: 5.0, name: 'Surface Ascend', reached: false }
      ]
    };

    if (presets[preset_name]) {
      localSimState.current.waypoints = presets[preset_name];
      localSimState.current.currentWpIdx = 0;
      localSimState.current.logs.unshift({
        time: Math.round(localSimState.current.time),
        timestamp: new Date().toLocaleTimeString(),
        level: 'INFO',
        message: `Loaded mission preset: '${preset_name}'.`
      });
    }

    try {
      await fetch(`${DEFAULT_HTTP_URL}/api/v1/mission/preset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preset_name })
      });
    } catch {}
  }, []);

  const setWaypoints = useCallback(async (newWaypoints: Omit<Waypoint, 'id' | 'reached'>[]) => {
    const formatted: Waypoint[] = newWaypoints.map((w, idx) => ({
      id: idx + 1,
      x: w.x,
      y: w.y,
      z: w.z,
      name: w.name,
      reached: false
    }));
    localSimState.current.waypoints = formatted;
    localSimState.current.currentWpIdx = 0;

    try {
      await fetch(`${DEFAULT_HTTP_URL}/api/v1/mission/waypoints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ waypoints: newWaypoints })
      });
    } catch {}
  }, []);

  const setDepthHold = useCallback(async (enabled: boolean, target_value?: number) => {
    localSimState.current.depthHold = enabled;
    if (target_value !== undefined) localSimState.current.targetDepth = target_value;
    try {
      await fetch(`${DEFAULT_HTTP_URL}/api/v1/control/depth-hold`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled, target_value })
      });
    } catch {}
  }, []);

  const setHeadingHold = useCallback(async (enabled: boolean, target_value?: number) => {
    localSimState.current.headingHold = enabled;
    if (target_value !== undefined) localSimState.current.targetHeading = target_value;
    try {
      await fetch(`${DEFAULT_HTTP_URL}/api/v1/control/heading-hold`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled, target_value })
      });
    } catch {}
  }, []);

  return {
    telemetry,
    world,
    isConnected,
    ping,
    sendTeleop,
    stopROV,
    emergencyStop,
    clearEmergencyStop,
    resetSimulation,
    startMission,
    pauseMission,
    resumeMission,
    cancelMission,
    loadPresetMission,
    setWaypoints,
    setDepthHold,
    setHeadingHold
  };
}
