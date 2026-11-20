import React, { useEffect, useState, useCallback } from 'react';
import { ROVMode } from '../../types';
import {
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  RotateCcw,
  RotateCw,
  Square,
  Anchor,
  Compass,
  Keyboard
} from 'lucide-react';

interface Props {
  mode?: ROVMode;
  onTeleop: (surge: number, sway: number, heave: number, yaw: number) => void;
  onStop: () => void;
  onDepthHold: (enabled: boolean) => void;
  onHeadingHold: (enabled: boolean) => void;
}

export const ControlPanel: React.FC<Props> = ({
  mode = 'MANUAL',
  onTeleop,
  onStop,
  onDepthHold,
  onHeadingHold
}) => {
  const [speedLevel, setSpeedLevel] = useState<number>(0.7);
  const [depthHoldActive, setDepthHoldActive] = useState<boolean>(true);
  const [headingHoldActive, setHeadingHoldActive] = useState<boolean>(false);
  const [activeKeys, setActiveKeys] = useState<Set<string>>(new Set());

  const isEStop = mode === 'EMERGENCY_STOP';

  // Keyboard control handler
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Avoid capturing inputs when typing in form inputs
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

    const key = e.key.toUpperCase();
    const validKeys = ['W', 'S', 'A', 'D', 'Q', 'E', 'R', 'F', ' '];
    if (validKeys.includes(key)) {
      e.preventDefault();
      setActiveKeys((prev) => new Set(prev).add(key));
    }
  }, []);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

    const key = e.key.toUpperCase();
    setActiveKeys((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleKeyDown, handleKeyUp]);

  // Translate active keys into teleop vector
  useEffect(() => {
    if (isEStop) return;

    let surge = 0;
    let sway = 0;
    let heave = 0;
    let yaw = 0;

    if (activeKeys.has('W')) surge += speedLevel;
    if (activeKeys.has('S')) surge -= speedLevel;
    if (activeKeys.has('A')) yaw -= speedLevel;
    if (activeKeys.has('D')) yaw += speedLevel;
    if (activeKeys.has('Q')) sway -= speedLevel;
    if (activeKeys.has('E')) sway += speedLevel;
    if (activeKeys.has('R')) heave -= speedLevel; // Ascend (negative depth)
    if (activeKeys.has('F')) heave += speedLevel; // Descend (positive depth)

    if (activeKeys.has(' ')) {
      onStop();
      return;
    }

    if (activeKeys.size > 0) {
      onTeleop(surge, sway, heave, yaw);
    }
  }, [activeKeys, speedLevel, isEStop, onTeleop, onStop]);

  const toggleDepthHold = () => {
    const next = !depthHoldActive;
    setDepthHoldActive(next);
    onDepthHold(next);
  };

  const toggleHeadingHold = () => {
    const next = !headingHoldActive;
    setHeadingHoldActive(next);
    onHeadingHold(next);
  };

  return (
    <div className="bg-navy-900 border border-cyan-500/20 rounded-xl p-4 flex flex-col gap-4 select-none">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5 font-mono">
          <Anchor className="w-4 h-4" /> ROV Flight & Thruster Control
        </h3>
        <span className="text-[10px] text-slate-400 font-mono">
          PWR: {(speedLevel * 100).toFixed(0)}%
        </span>
      </div>

      {/* Thruster Speed / Authority Slider */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-slate-400 font-mono">Thrust Limit:</span>
        <input
          type="range"
          min="0.2"
          max="1.0"
          step="0.05"
          value={speedLevel}
          onChange={(e) => setSpeedLevel(parseFloat(e.target.value))}
          disabled={isEStop}
          className="flex-1 accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
        />
        <span className="text-xs font-bold text-cyan-300 font-mono w-10 text-right">
          {(speedLevel * 100).toFixed(0)}%
        </span>
      </div>

      {/* Control Surface Grid */}
      <div className="grid grid-cols-3 gap-3 items-center">
        {/* Left: Heave (Vertical) & Sway Controls */}
        <div className="flex flex-col items-center gap-2">
          <span className="text-[10px] text-slate-400 font-mono uppercase">Depth (Heave)</span>
          <div className="flex flex-col gap-1.5 w-full">
            <button
              onMouseDown={() => onTeleop(0, 0, -speedLevel, 0)}
              onMouseUp={onStop}
              onTouchStart={() => onTeleop(0, 0, -speedLevel, 0)}
              onTouchEnd={onStop}
              disabled={isEStop}
              className="py-2.5 px-3 rounded-lg bg-navy-800 hover:bg-navy-700 active:bg-cyan-500 active:text-navy-950 border border-slate-700 text-xs font-bold font-mono flex items-center justify-center gap-1.5 text-cyan-300 transition-all disabled:opacity-40"
              title="Ascend / Surface (R)"
            >
              <ArrowUp className="w-3.5 h-3.5" /> Ascend [R]
            </button>
            <button
              onMouseDown={() => onTeleop(0, 0, speedLevel, 0)}
              onMouseUp={onStop}
              onTouchStart={() => onTeleop(0, 0, speedLevel, 0)}
              onTouchEnd={onStop}
              disabled={isEStop}
              className="py-2.5 px-3 rounded-lg bg-navy-800 hover:bg-navy-700 active:bg-cyan-500 active:text-navy-950 border border-slate-700 text-xs font-bold font-mono flex items-center justify-center gap-1.5 text-cyan-300 transition-all disabled:opacity-40"
              title="Descend / Dive (F)"
            >
              <ArrowDown className="w-3.5 h-3.5" /> Descend [F]
            </button>
          </div>
        </div>

        {/* Center: Surge D-Pad (Forward / Reverse / Stop) */}
        <div className="flex flex-col items-center gap-1.5">
          <span className="text-[10px] text-slate-400 font-mono uppercase">Surge / Sway</span>
          <button
            onMouseDown={() => onTeleop(speedLevel, 0, 0, 0)}
            onMouseUp={onStop}
            onTouchStart={() => onTeleop(speedLevel, 0, 0, 0)}
            onTouchEnd={onStop}
            disabled={isEStop}
            className={`w-12 h-12 rounded-lg bg-navy-800 hover:bg-navy-700 active:bg-cyan-500 active:text-navy-950 border border-cyan-500/30 flex items-center justify-center text-cyan-300 transition-all shadow-md disabled:opacity-40 ${
              activeKeys.has('W') ? 'bg-cyan-500 text-navy-950 font-bold' : ''
            }`}
            title="Forward Surge [W]"
          >
            <ArrowUp className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-1.5">
            <button
              onMouseDown={() => onTeleop(0, -speedLevel, 0, 0)}
              onMouseUp={onStop}
              onTouchStart={() => onTeleop(0, -speedLevel, 0, 0)}
              onTouchEnd={onStop}
              disabled={isEStop}
              className={`w-12 h-12 rounded-lg bg-navy-800 hover:bg-navy-700 active:bg-cyan-500 active:text-navy-950 border border-cyan-500/30 flex items-center justify-center text-cyan-300 transition-all shadow-md disabled:opacity-40 ${
                activeKeys.has('Q') ? 'bg-cyan-500 text-navy-950 font-bold' : ''
              }`}
              title="Sway Left [Q]"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            <button
              onClick={onStop}
              disabled={isEStop}
              className="w-12 h-12 rounded-lg bg-red-950/80 hover:bg-red-900 border border-red-500 text-red-400 flex items-center justify-center font-bold text-xs transition-all shadow-sm active:scale-95 disabled:opacity-40"
              title="Neutral Stop Thrusters [Space]"
            >
              <Square className="w-4 h-4 fill-current" />
            </button>

            <button
              onMouseDown={() => onTeleop(0, speedLevel, 0, 0)}
              onMouseUp={onStop}
              onTouchStart={() => onTeleop(0, speedLevel, 0, 0)}
              onTouchEnd={onStop}
              disabled={isEStop}
              className={`w-12 h-12 rounded-lg bg-navy-800 hover:bg-navy-700 active:bg-cyan-500 active:text-navy-950 border border-cyan-500/30 flex items-center justify-center text-cyan-300 transition-all shadow-md disabled:opacity-40 ${
                activeKeys.has('E') ? 'bg-cyan-500 text-navy-950 font-bold' : ''
              }`}
              title="Sway Right [E]"
            >
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>

          <button
            onMouseDown={() => onTeleop(-speedLevel, 0, 0, 0)}
            onMouseUp={onStop}
            onTouchStart={() => onTeleop(-speedLevel, 0, 0, 0)}
            onTouchEnd={onStop}
            disabled={isEStop}
            className={`w-12 h-12 rounded-lg bg-navy-800 hover:bg-navy-700 active:bg-cyan-500 active:text-navy-950 border border-cyan-500/30 flex items-center justify-center text-cyan-300 transition-all shadow-md disabled:opacity-40 ${
              activeKeys.has('S') ? 'bg-cyan-500 text-navy-950 font-bold' : ''
            }`}
            title="Reverse Surge [S]"
          >
            <ArrowDown className="w-5 h-5" />
          </button>
        </div>

        {/* Right: Yaw (Turn Port / Starboard) */}
        <div className="flex flex-col items-center gap-2">
          <span className="text-[10px] text-slate-400 font-mono uppercase">Heading (Yaw)</span>
          <div className="flex flex-col gap-1.5 w-full">
            <button
              onMouseDown={() => onTeleop(0, 0, 0, -speedLevel)}
              onMouseUp={onStop}
              onTouchStart={() => onTeleop(0, 0, 0, -speedLevel)}
              onTouchEnd={onStop}
              disabled={isEStop}
              className={`py-2.5 px-3 rounded-lg bg-navy-800 hover:bg-navy-700 active:bg-cyan-500 active:text-navy-950 border border-slate-700 text-xs font-bold font-mono flex items-center justify-center gap-1.5 text-cyan-300 transition-all disabled:opacity-40 ${
                activeKeys.has('A') ? 'bg-cyan-500 text-navy-950' : ''
              }`}
              title="Turn Left / Port [A]"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Port [A]
            </button>
            <button
              onMouseDown={() => onTeleop(0, 0, 0, speedLevel)}
              onMouseUp={onStop}
              onTouchStart={() => onTeleop(0, 0, 0, speedLevel)}
              onTouchEnd={onStop}
              disabled={isEStop}
              className={`py-2.5 px-3 rounded-lg bg-navy-800 hover:bg-navy-700 active:bg-cyan-500 active:text-navy-950 border border-slate-700 text-xs font-bold font-mono flex items-center justify-center gap-1.5 text-cyan-300 transition-all disabled:opacity-40 ${
                activeKeys.has('D') ? 'bg-cyan-500 text-navy-950' : ''
              }`}
              title="Turn Right / Starboard [D]"
            >
              <RotateCw className="w-3.5 h-3.5" /> Stbd [D]
            </button>
          </div>
        </div>
      </div>

      {/* Auto-Hold Closed Loop Stabilization Toggles */}
      <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800">
        <button
          onClick={toggleDepthHold}
          disabled={isEStop}
          className={`py-2 px-3 rounded-lg border text-xs font-mono font-bold flex items-center justify-center gap-2 transition-all ${
            depthHoldActive
              ? 'bg-cyan-950 border-cyan-400 text-cyan-300 shadow-[0_0_10px_rgba(0,229,255,0.25)]'
              : 'bg-navy-950 border-slate-800 text-slate-500 hover:text-slate-300'
          }`}
        >
          <Anchor className="w-3.5 h-3.5" />
          Depth Hold: {depthHoldActive ? 'ON' : 'OFF'}
        </button>

        <button
          onClick={toggleHeadingHold}
          disabled={isEStop}
          className={`py-2 px-3 rounded-lg border text-xs font-mono font-bold flex items-center justify-center gap-2 transition-all ${
            headingHoldActive
              ? 'bg-cyan-950 border-cyan-400 text-cyan-300 shadow-[0_0_10px_rgba(0,229,255,0.25)]'
              : 'bg-navy-950 border-slate-800 text-slate-500 hover:text-slate-300'
          }`}
        >
          <Compass className="w-3.5 h-3.5" />
          Heading Hold: {headingHoldActive ? 'ON' : 'OFF'}
        </button>
      </div>

      {/* Keyboard Shortcut Hints */}
      <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono px-1">
        <span className="flex items-center gap-1">
          <Keyboard className="w-3 h-3 text-cyan-400" /> W/A/S/D: Drive & Turn
        </span>
        <span>R/F: Depth</span>
        <span>Q/E: Sway</span>
        <span>Space: Stop</span>
      </div>
    </div>
  );
};
