import React from 'react';
import { ROVMode } from '../../types';
import { Activity, AlertOctagon, RotateCcw, Wifi, WifiOff, Battery, ShieldAlert, Waves } from 'lucide-react';

interface Props {
  mode?: ROVMode;
  isConnected: boolean;
  ping: number;
  batteryPct?: number;
  simTime?: number;
  onEmergencyStop: () => void;
  onClearEmergencyStop: () => void;
  onReset: () => void;
}

export const Header: React.FC<Props> = ({
  mode = 'MANUAL',
  isConnected,
  ping,
  batteryPct = 100,
  simTime = 0,
  onEmergencyStop,
  onClearEmergencyStop,
  onReset
}) => {
  const isEStop = mode === 'EMERGENCY_STOP';

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <header className="h-16 bg-navy-900 border-b border-cyan-500/20 px-4 flex items-center justify-between select-none">
      {/* Brand Title */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-[0_0_15px_rgba(0,229,255,0.4)]">
          <Waves className="w-6 h-6 text-navy-950 font-bold" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-white tracking-wide">AQUABOT</h1>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-400 border border-cyan-500/30">
              ROV v1.0
            </span>
          </div>
          <p className="text-[11px] text-slate-400 hidden sm:block">
            Autonomous Underwater ROV Simulation & Telemetry System
          </p>
        </div>
      </div>

      {/* Center Status Indicators */}
      <div className="flex items-center gap-3">
        {/* Connection Status Pill */}
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-navy-950 border border-slate-700/60 text-xs font-mono">
          {isConnected ? (
            <>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <Wifi className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-400 font-semibold">LIVE</span>
              <span className="text-slate-400 text-[10px]">({ping}ms)</span>
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              <WifiOff className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-amber-400 font-semibold">CONNECTING</span>
            </>
          )}
        </div>

        {/* Operating Mode Pill */}
        <div
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold tracking-wider border shadow-sm ${
            isEStop
              ? 'bg-red-950/80 border-red-500 text-red-300 animate-pulse shadow-[0_0_12px_rgba(239,68,68,0.5)]'
              : mode === 'AUTONOMOUS'
              ? 'bg-emerald-950/80 border-emerald-500 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
              : 'bg-cyan-950/80 border-cyan-500 text-cyan-300'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>{mode}</span>
        </div>

        {/* Sim Clock */}
        <div className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full bg-navy-950 border border-slate-700/60 text-xs font-mono text-slate-300">
          <span className="text-slate-400 text-[10px]">MET:</span>
          <span className="font-bold text-cyan-300">{formatTime(simTime)}</span>
        </div>

        {/* Quick Battery Gauge */}
        <div className="hidden lg:flex items-center gap-2 px-3 py-1 rounded-full bg-navy-950 border border-slate-700/60 text-xs font-mono">
          <Battery className={`w-3.5 h-3.5 ${batteryPct > 25 ? 'text-cyan-400' : 'text-red-400'}`} />
          <div className="w-16 bg-slate-800 rounded-full h-1.5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                batteryPct > 50 ? 'bg-cyan-400' : batteryPct > 20 ? 'bg-amber-400' : 'bg-red-500'
              }`}
              style={{ width: `${Math.min(100, Math.max(0, batteryPct))}%` }}
            />
          </div>
          <span className="text-[11px] font-bold text-slate-200">{batteryPct.toFixed(0)}%</span>
        </div>
      </div>

      {/* Right Action Buttons */}
      <div className="flex items-center gap-2">
        <button
          onClick={onReset}
          className="px-3 py-1.5 rounded-lg bg-navy-800 hover:bg-navy-700 border border-slate-600/60 text-slate-200 hover:text-white text-xs font-medium flex items-center gap-1.5 transition-all shadow-sm"
          title="Reset simulation to initial surface mooring state"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Reset</span>
        </button>

        {isEStop ? (
          <button
            onClick={onClearEmergencyStop}
            className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-navy-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-md animate-bounce"
            title="Clear emergency lockout and restore manual control"
          >
            <ShieldAlert className="w-4 h-4" />
            Clear E-Stop
          </button>
        ) : (
          <button
            onClick={onEmergencyStop}
            className="px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-[0_0_15px_rgba(239,68,68,0.5)] active:scale-95"
            title="Instant thruster cutoff and emergency hold"
          >
            <AlertOctagon className="w-4 h-4" />
            <span>E-STOP</span>
          </button>
        )}
      </div>
    </header>
  );
};
