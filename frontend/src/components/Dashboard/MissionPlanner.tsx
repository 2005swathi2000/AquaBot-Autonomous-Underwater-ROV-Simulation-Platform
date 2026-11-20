import React, { useState } from 'react';
import { NavigationTelemetry, Waypoint } from '../../types';
import {
  MapPin,
  Play,
  Pause,
  RotateCcw,
  Plus,
  Compass,
  AlertTriangle,
  CheckCircle2,
  ListOrdered
} from 'lucide-react';

interface Props {
  navigation?: NavigationTelemetry;
  onStartMission: () => void;
  onPauseMission: () => void;
  onResumeMission: () => void;
  onCancelMission: () => void;
  onLoadPreset: (presetName: string) => void;
  onAddWaypoint: (waypoints: Omit<Waypoint, 'id' | 'reached'>[]) => void;
}

export const MissionPlanner: React.FC<Props> = ({
  navigation,
  onStartMission,
  onPauseMission,
  onResumeMission,
  onCancelMission,
  onLoadPreset,
  onAddWaypoint
}) => {
  const [newX, setNewX] = useState<string>('12.0');
  const [newY, setNewY] = useState<string>('12.0');
  const [newZ, setNewZ] = useState<string>('10.0');
  const [newName, setNewName] = useState<string>('Custom Target');

  const state = navigation?.state || 'IDLE';
  const waypoints = navigation?.waypoints || [];
  const currentIdx = navigation?.current_wp_index || 0;
  const currentWp = navigation?.current_wp;
  const dist = navigation?.distance_to_wp_m || 0;
  const avoidStatus = navigation?.avoidance_status || 'CLEAR';

  const isNavigating = state === 'NAVIGATING' || state === 'AVOIDING';
  const isPaused = state === 'PAUSED';

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const x = parseFloat(newX);
    const y = parseFloat(newY);
    const z = parseFloat(newZ);
    if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
      const updated = waypoints.map((w) => ({ x: w.x, y: w.y, z: w.z, name: w.name }));
      updated.push({ x, y, z, name: newName || `WP-${updated.length + 1}` });
      onAddWaypoint(updated);
      setNewName('');
    }
  };

  return (
    <div className="bg-navy-900 border border-cyan-500/20 rounded-xl p-4 flex flex-col gap-3 select-none">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5 font-mono">
          <MapPin className="w-4 h-4" /> Autonomous Navigation & Mission Executive
        </h3>
        {/* Navigation State Badge */}
        <span
          className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
            state === 'AVOIDING'
              ? 'bg-amber-950 text-amber-400 border border-amber-500 animate-pulse'
              : isNavigating
              ? 'bg-emerald-950 text-emerald-300 border border-emerald-500'
              : isPaused
              ? 'bg-yellow-950 text-yellow-400 border border-yellow-500'
              : 'bg-slate-900 text-slate-400 border border-slate-700'
          }`}
        >
          {state}
        </span>
      </div>

      {/* Preset Mission Selectors */}
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-slate-400 font-mono">Presets:</span>
        <div className="flex gap-1.5 flex-1">
          {['Pipeline Survey', 'Obstacle Slalom', 'Deep Trench Dive'].map((preset) => (
            <button
              key={preset}
              onClick={() => onLoadPreset(preset)}
              className="flex-1 py-1 px-2 rounded bg-navy-800 hover:bg-cyan-950 hover:border-cyan-500/50 border border-slate-700/80 text-[10px] font-medium text-slate-300 hover:text-cyan-300 transition-all font-mono"
            >
              {preset}
            </button>
          ))}
        </div>
      </div>

      {/* Active Waypoint Progress Card */}
      {currentWp && (
        <div className="bg-navy-950 p-2.5 rounded-lg border border-slate-800 flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            <div>
              <div className="text-slate-300 font-bold">
                Target: {currentWp.name} (WP {currentIdx + 1}/{waypoints.length})
              </div>
              <div className="text-[10px] text-slate-400">
                Coords: [{currentWp.x}, {currentWp.y}] · Depth: {currentWp.z}m
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-cyan-300 font-bold text-sm">{dist.toFixed(1)} m</div>
            <div className="text-[9px] text-slate-400">Distance</div>
          </div>
        </div>
      )}

      {/* Obstacle Avoidance Advisory Banner */}
      {avoidStatus !== 'CLEAR' && (
        <div className="bg-amber-950/60 border border-amber-500/50 rounded-lg p-2 flex items-center gap-2 text-xs font-mono text-amber-300">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            {avoidStatus === 'EMERGENCY_REVERSE'
              ? 'CRITICAL HAZARD! Active obstacle repulsion & reverse maneuvers engaged.'
              : 'Artificial Potential Field active: Deflecting ROV around detected obstacle.'}
          </span>
        </div>
      )}

      {/* Waypoint Queue List */}
      <div className="max-h-32 overflow-y-auto space-y-1 pr-1 font-mono text-xs">
        {waypoints.map((wp, idx) => (
          <div
            key={wp.id}
            className={`p-1.5 rounded flex items-center justify-between border ${
              wp.reached
                ? 'bg-slate-900/60 border-slate-800 text-slate-500'
                : idx === currentIdx && isNavigating
                ? 'bg-cyan-950/70 border-cyan-500 text-cyan-200'
                : 'bg-navy-950 border-slate-800 text-slate-300'
            }`}
          >
            <div className="flex items-center gap-2">
              {wp.reached ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <span className="w-3.5 h-3.5 rounded-full border border-slate-600 flex items-center justify-center text-[9px]">
                  {idx + 1}
                </span>
              )}
              <span className="font-medium text-[11px]">{wp.name}</span>
            </div>
            <span className="text-[10px] text-slate-400">
              ({wp.x}, {wp.y}, {wp.z}m)
            </span>
          </div>
        ))}
      </div>

      {/* Mission Action Buttons */}
      <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-800">
        {!isNavigating && !isPaused ? (
          <button
            onClick={onStartMission}
            disabled={waypoints.length === 0}
            className="py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-navy-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md col-span-3 disabled:opacity-40"
          >
            <Play className="w-3.5 h-3.5 fill-current" /> Start Autonomous Mission
          </button>
        ) : isPaused ? (
          <>
            <button
              onClick={onResumeMission}
              className="py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-navy-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md col-span-2"
            >
              <Play className="w-3.5 h-3.5 fill-current" /> Resume Mission
            </button>
            <button
              onClick={onCancelMission}
              className="py-2 rounded-lg bg-red-950 hover:bg-red-900 border border-red-500/50 text-red-300 font-bold text-xs flex items-center justify-center gap-1 transition-all"
            >
              Abort
            </button>
          </>
        ) : (
          <>
            <button
              onClick={onPauseMission}
              className="py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-navy-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md col-span-2"
            >
              <Pause className="w-3.5 h-3.5 fill-current" /> Pause Mission
            </button>
            <button
              onClick={onCancelMission}
              className="py-2 rounded-lg bg-red-950 hover:bg-red-900 border border-red-500/50 text-red-300 font-bold text-xs flex items-center justify-center gap-1 transition-all"
            >
              Abort
            </button>
          </>
        )}
      </div>

      {/* Add Custom Waypoint Inline Form */}
      <form onSubmit={handleAdd} className="pt-2 border-t border-slate-800/80 flex items-center gap-1.5">
        <input
          type="text"
          placeholder="Name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className="w-24 px-2 py-1 bg-navy-950 border border-slate-700 rounded text-[11px] text-white focus:outline-none focus:border-cyan-400 font-mono"
        />
        <input
          type="number"
          step="0.5"
          placeholder="X"
          value={newX}
          onChange={(e) => setNewX(e.target.value)}
          className="w-14 px-1.5 py-1 bg-navy-950 border border-slate-700 rounded text-[11px] text-white focus:outline-none focus:border-cyan-400 font-mono text-center"
        />
        <input
          type="number"
          step="0.5"
          placeholder="Y"
          value={newY}
          onChange={(e) => setNewY(e.target.value)}
          className="w-14 px-1.5 py-1 bg-navy-950 border border-slate-700 rounded text-[11px] text-white focus:outline-none focus:border-cyan-400 font-mono text-center"
        />
        <input
          type="number"
          step="0.5"
          placeholder="Z"
          value={newZ}
          onChange={(e) => setNewZ(e.target.value)}
          className="w-14 px-1.5 py-1 bg-navy-950 border border-slate-700 rounded text-[11px] text-white focus:outline-none focus:border-cyan-400 font-mono text-center"
        />
        <button
          type="submit"
          className="px-2.5 py-1 bg-cyan-600 hover:bg-cyan-500 text-navy-950 rounded text-xs font-bold flex items-center gap-1 transition-all font-mono"
          title="Add Waypoint"
        >
          <Plus className="w-3.5 h-3.5" /> Add
        </button>
      </form>
    </div>
  );
};
