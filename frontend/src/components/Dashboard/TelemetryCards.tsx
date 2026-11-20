import React from 'react';
import { TelemetryPayload } from '../../types';
import { Gauge, Navigation, Compass, BatteryCharging, Zap, MapPin } from 'lucide-react';

interface Props {
  telemetry: TelemetryPayload | null;
}

export const TelemetryCards: React.FC<Props> = ({ telemetry }) => {
  const pos = telemetry?.position || { x: 0, y: 0, z: 2.0 };
  const vel = telemetry?.velocity || { u_surge: 0, v_sway: 0, w_heave: 0, r_yaw_rate: 0, speed_total: 0 };
  const ori = telemetry?.orientation || { roll_deg: 0, pitch_deg: 0, yaw_deg: 0, heading_deg: 0 };
  const sensors = telemetry?.sensors;
  const thrusters = telemetry?.thrusters;

  const battery = sensors?.battery || {
    battery_pct: 100,
    voltage_v: 16.2,
    current_a: 1.2,
    power_w: 18.0,
    remaining_minutes: 240
  };

  const depth = sensors?.depth || { depth_m: 2.0, pressure_bar: 1.21, pressure_kpa: 121.0 };
  const compass = sensors?.compass || { heading_deg: 0, cardinal: 'N' };

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 select-none">
      {/* 1. Depth & Hydrostatic Pressure */}
      <div className="bg-navy-900 border border-cyan-500/20 rounded-xl p-3 flex flex-col justify-between shadow-md">
        <div className="flex items-center justify-between text-slate-400">
          <span className="text-[11px] font-mono uppercase tracking-wider flex items-center gap-1.5">
            <Gauge className="w-3.5 h-3.5 text-cyan-400" /> Depth (Z)
          </span>
          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-500/20">
            SIMULATED
          </span>
        </div>
        <div className="my-1.5 flex items-baseline gap-1.5">
          <span className="text-2xl font-bold font-mono text-cyan-300">
            {depth.depth_m.toFixed(2)}
          </span>
          <span className="text-xs font-mono text-slate-400">meters</span>
        </div>
        <div className="text-[10px] font-mono text-slate-400 flex justify-between border-t border-slate-800/80 pt-1">
          <span>Pres: {depth.pressure_bar.toFixed(2)} bar</span>
          <span>{depth.pressure_kpa.toFixed(0)} kPa</span>
        </div>
      </div>

      {/* 2. Heading & Compass */}
      <div className="bg-navy-900 border border-cyan-500/20 rounded-xl p-3 flex flex-col justify-between shadow-md">
        <div className="flex items-center justify-between text-slate-400">
          <span className="text-[11px] font-mono uppercase tracking-wider flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5 text-cyan-400" /> Heading
          </span>
          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-500/20">
            SIMULATED
          </span>
        </div>
        <div className="my-1.5 flex items-baseline gap-1.5">
          <span className="text-2xl font-bold font-mono text-cyan-300">
            {compass.heading_deg.toFixed(1)}°
          </span>
          <span className="text-sm font-bold font-mono text-amber-400">{compass.cardinal}</span>
        </div>
        <div className="text-[10px] font-mono text-slate-400 flex justify-between border-t border-slate-800/80 pt-1">
          <span>Roll: {ori.roll_deg.toFixed(1)}°</span>
          <span>Pitch: {ori.pitch_deg.toFixed(1)}°</span>
        </div>
      </div>

      {/* 3. Speed & Kinematics */}
      <div className="bg-navy-900 border border-cyan-500/20 rounded-xl p-3 flex flex-col justify-between shadow-md">
        <div className="flex items-center justify-between text-slate-400">
          <span className="text-[11px] font-mono uppercase tracking-wider flex items-center gap-1.5">
            <Navigation className="w-3.5 h-3.5 text-cyan-400" /> Speed (Surge)
          </span>
          <span className="text-[9px] font-mono text-slate-500">6-DOF</span>
        </div>
        <div className="my-1.5 flex items-baseline gap-1.5">
          <span className="text-2xl font-bold font-mono text-cyan-300">
            {vel.speed_total.toFixed(2)}
          </span>
          <span className="text-xs font-mono text-slate-400">m/s</span>
        </div>
        <div className="text-[10px] font-mono text-slate-400 flex justify-between border-t border-slate-800/80 pt-1">
          <span>u: {vel.u_surge.toFixed(2)}</span>
          <span>v: {vel.v_sway.toFixed(2)}</span>
          <span>w: {vel.w_heave.toFixed(2)}</span>
        </div>
      </div>

      {/* 4. 3D Position Coordinates */}
      <div className="bg-navy-900 border border-cyan-500/20 rounded-xl p-3 flex flex-col justify-between shadow-md">
        <div className="flex items-center justify-between text-slate-400">
          <span className="text-[11px] font-mono uppercase tracking-wider flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-cyan-400" /> Position (X,Y)
          </span>
          <span className="text-[9px] font-mono text-slate-500">NED World</span>
        </div>
        <div className="my-1.5 flex items-baseline gap-2 font-mono">
          <span className="text-sm font-bold text-slate-300">
            X: <span className="text-cyan-300">{pos.x.toFixed(1)}</span>
          </span>
          <span className="text-sm font-bold text-slate-300">
            Y: <span className="text-cyan-300">{pos.y.toFixed(1)}</span>
          </span>
        </div>
        <div className="text-[10px] font-mono text-slate-400 flex justify-between border-t border-slate-800/80 pt-1">
          <span>Boundary: ±35.0m</span>
          <span>Sea: -35.0m</span>
        </div>
      </div>

      {/* 5. Battery & Power Consumption */}
      <div className="bg-navy-900 border border-cyan-500/20 rounded-xl p-3 flex flex-col justify-between shadow-md col-span-2 md:col-span-4 lg:col-span-1">
        <div className="flex items-center justify-between text-slate-400">
          <span className="text-[11px] font-mono uppercase tracking-wider flex items-center gap-1.5">
            <BatteryCharging className="w-3.5 h-3.5 text-cyan-400" /> Battery (4S LiPo)
          </span>
          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-500/20">
            SIMULATED
          </span>
        </div>
        <div className="my-1.5 flex items-baseline gap-2">
          <span
            className={`text-2xl font-bold font-mono ${
              battery.battery_pct > 25 ? 'text-cyan-300' : 'text-red-400 animate-pulse'
            }`}
          >
            {battery.battery_pct.toFixed(1)}%
          </span>
          <span className="text-xs font-mono text-slate-400">
            {battery.remaining_minutes.toFixed(0)} min
          </span>
        </div>
        <div className="text-[10px] font-mono text-slate-400 flex justify-between border-t border-slate-800/80 pt-1">
          <span>{battery.voltage_v.toFixed(2)} V</span>
          <span>{battery.current_a.toFixed(1)} A</span>
          <span className="text-cyan-400 flex items-center gap-0.5">
            <Zap className="w-2.5 h-2.5" />
            {battery.power_w.toFixed(0)}W
          </span>
        </div>
      </div>
    </div>
  );
};
