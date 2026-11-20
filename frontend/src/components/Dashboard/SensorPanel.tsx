import React from 'react';
import { SensorsTelemetry, ThrusterDiagnostics } from '../../types';
import { Radar, Compass, Activity, ShieldAlert, Cpu } from 'lucide-react';

interface Props {
  sensors?: SensorsTelemetry;
  thrusters?: ThrusterDiagnostics;
}

export const SensorPanel: React.FC<Props> = ({ sensors, thrusters }) => {
  const sonar = sensors?.sonar || {
    min_distance_m: 25.0,
    threat_level: 'CLEAR',
    closest_target: 'Clear Water',
    closest_angle_deg: 0,
    beams: [],
    healthy: true
  };

  const imu = sensors?.imu || {
    linear_acceleration: { ax: 0, ay: 0, az: 9.81 },
    angular_velocity: { wx: 0, wy: 0, wz: 0 },
    orientation_euler_deg: { roll: 0, pitch: 0, yaw: 0 },
    healthy: true
  };

  const forces = thrusters?.thruster_forces_n || [0, 0, 0, 0, 0, 0];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 select-none">
      {/* 1. Multi-Beam Forward Acoustic Sonar */}
      <div className="bg-navy-900 border border-cyan-500/20 rounded-xl p-3 flex flex-col justify-between">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5 font-mono">
            <Radar className="w-4 h-4" /> Forward Acoustic Sonar
          </h3>
          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-500/20">
            SIMULATED
          </span>
        </div>

        {/* Sonar Beam Ranges Graphic */}
        <div className="my-2 flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-[11px] font-mono">
            <span className="text-slate-400">Min Obstacle Dist:</span>
            <span
              className={`font-bold ${
                sonar.min_distance_m < 2.0
                  ? 'text-red-400 font-extrabold'
                  : sonar.min_distance_m < 5.0
                  ? 'text-amber-400'
                  : 'text-cyan-300'
              }`}
            >
              {sonar.min_distance_m.toFixed(2)} m
            </span>
          </div>

          <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
            <span>Target: {sonar.closest_target}</span>
            <span>Angle: {sonar.closest_angle_deg}°</span>
          </div>

          {/* 7 Beams Horizontal Bar Visualizer */}
          <div className="h-14 bg-navy-950 rounded-lg p-2 flex items-end justify-between gap-1 border border-slate-800/80">
            {sonar.beams && sonar.beams.length > 0 ? (
              sonar.beams.map((b, idx) => {
                const distPct = Math.min(100, (b.distance_m / 25.0) * 100);
                const isClosest = Math.abs(b.distance_m - sonar.min_distance_m) < 0.1;
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                    <div
                      className={`w-full rounded-t transition-all ${
                        b.distance_m < 2.0
                          ? 'bg-red-500'
                          : b.distance_m < 5.0
                          ? 'bg-yellow-400'
                          : 'bg-cyan-500/70'
                      } ${isClosest ? 'ring-1 ring-white' : ''}`}
                      style={{ height: `${distPct}%` }}
                      title={`Beam ${idx} (${b.relative_angle_deg}°): ${b.distance_m}m`}
                    />
                    <span className="text-[8px] font-mono text-slate-500">
                      {b.relative_angle_deg > 0 ? `+${b.relative_angle_deg}` : b.relative_angle_deg}°
                    </span>
                  </div>
                );
              })
            ) : (
              <span className="text-xs text-slate-500 m-auto font-mono">Sonar Standby</span>
            )}
          </div>
        </div>

        {/* Threat Level status */}
        <div className="flex items-center justify-between pt-1 border-t border-slate-800 text-[10px] font-mono">
          <span className="text-slate-400">Collision Risk:</span>
          <span
            className={`font-bold px-2 py-0.5 rounded text-[10px] ${
              sonar.threat_level === 'CRITICAL'
                ? 'bg-red-950 text-red-400 border border-red-500'
                : sonar.threat_level === 'WARNING'
                ? 'bg-amber-950 text-amber-400 border border-amber-500'
                : 'bg-emerald-950 text-emerald-400 border border-emerald-500/40'
            }`}
          >
            {sonar.threat_level}
          </span>
        </div>
      </div>

      {/* 2. 6-DOF IMU Sensor */}
      <div className="bg-navy-900 border border-cyan-500/20 rounded-xl p-3 flex flex-col justify-between">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5 font-mono">
            <Cpu className="w-4 h-4" /> 6-DOF MEMS IMU
          </h3>
          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-500/20">
            SIMULATED
          </span>
        </div>

        <div className="my-2 flex flex-col gap-2 font-mono text-[11px]">
          {/* Accelerometer */}
          <div>
            <div className="text-[10px] text-slate-400 flex justify-between mb-0.5">
              <span>Linear Acceleration (m/s²):</span>
              <span className="text-slate-500">Body Frame</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5 bg-navy-950 p-1.5 rounded border border-slate-800 text-center">
              <div>
                <span className="text-slate-500 text-[9px]">Ax: </span>
                <span className="text-cyan-300 font-bold">{imu.linear_acceleration.ax.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-slate-500 text-[9px]">Ay: </span>
                <span className="text-cyan-300 font-bold">{imu.linear_acceleration.ay.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-slate-500 text-[9px]">Az: </span>
                <span className="text-cyan-300 font-bold">{imu.linear_acceleration.az.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Gyroscope Angular Velocity */}
          <div>
            <div className="text-[10px] text-slate-400 flex justify-between mb-0.5">
              <span>Angular Velocity (rad/s):</span>
              <span className="text-slate-500">Gyro Rates</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5 bg-navy-950 p-1.5 rounded border border-slate-800 text-center">
              <div>
                <span className="text-slate-500 text-[9px]">p: </span>
                <span className="text-cyan-300 font-bold">{imu.angular_velocity.wx.toFixed(3)}</span>
              </div>
              <div>
                <span className="text-slate-500 text-[9px]">q: </span>
                <span className="text-cyan-300 font-bold">{imu.angular_velocity.wy.toFixed(3)}</span>
              </div>
              <div>
                <span className="text-slate-500 text-[9px]">r: </span>
                <span className="text-cyan-300 font-bold">{imu.angular_velocity.wz.toFixed(3)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-slate-800 text-[10px] font-mono text-slate-400">
          <span>Sensor Health: OK</span>
          <span className="text-emerald-400">CALIBRATED</span>
        </div>
      </div>

      {/* 3. 6-Thruster Allocation Matrix Diagnostics */}
      <div className="bg-navy-900 border border-cyan-500/20 rounded-xl p-3 flex flex-col justify-between">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5 font-mono">
            <Activity className="w-4 h-4" /> 6-Thruster Thrust Allocation
          </h3>
          <span className="text-[9px] font-mono text-slate-500">Vectored</span>
        </div>

        {/* Individual Thruster Force Bars */}
        <div className="grid grid-cols-6 gap-1 my-2 h-20 items-end bg-navy-950 p-2 rounded border border-slate-800">
          {['T1', 'T2', 'T3', 'T4', 'T5', 'T6'].map((label, idx) => {
            const force = forces[idx] || 0;
            const pct = Math.min(100, Math.abs(force) / 32.0 * 100);
            return (
              <div key={label} className="flex flex-col items-center gap-1 h-full justify-end">
                <div
                  className={`w-full rounded-t transition-all ${
                    force >= 0 ? 'bg-cyan-500' : 'bg-amber-500'
                  }`}
                  style={{ height: `${Math.max(4, pct)}%` }}
                  title={`${label}: ${force.toFixed(1)} N`}
                />
                <span className="text-[9px] font-mono text-slate-400">{label}</span>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-slate-800 text-[10px] font-mono text-slate-400">
          <span>T1-T4: Horiz 45°</span>
          <span>T5-T6: Vertical</span>
        </div>
      </div>
    </div>
  );
};
