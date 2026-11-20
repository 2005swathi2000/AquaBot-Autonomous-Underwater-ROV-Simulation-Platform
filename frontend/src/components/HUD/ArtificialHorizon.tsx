import React from 'react';
import { OrientationEuler, Velocity } from '../../types';

interface Props {
  orientation: OrientationEuler;
  depth: number;
  velocity: Velocity;
}

export const ArtificialHorizon: React.FC<Props> = ({ orientation, depth, velocity }) => {
  const roll = orientation.roll_deg || 0;
  const pitch = orientation.pitch_deg || 0;
  const heading = orientation.heading_deg || 0;
  const speed = velocity?.speed_total || 0;

  // Pitch translation (pixels per degree)
  const pitchOffset = Math.max(-50, Math.min(50, pitch * 2.5));

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-3 select-none text-cyan-400 font-mono text-xs">
      {/* Top Heading Tape */}
      <div className="self-center flex items-center gap-2 bg-navy-950/80 px-4 py-1 rounded-full border border-cyan-500/30 backdrop-blur-sm shadow-md">
        <span className="text-slate-400">HDG</span>
        <span className="text-sm font-bold text-cyan-300">{Math.round(heading).toString().padStart(3, '0')}°</span>
        <div className="w-16 h-2 overflow-hidden relative border-b border-cyan-500/50">
          <div
            className="absolute top-0 text-[10px] whitespace-nowrap transition-transform"
            style={{ transform: `translateX(${-((heading % 360) / 360) * 80}px)` }}
          >
            N · · · E · · · S · · · W · · · N
          </div>
        </div>
      </div>

      {/* Center Artificial Horizon Reticle */}
      <div className="self-center relative w-48 h-48 rounded-full border border-cyan-500/20 overflow-hidden flex items-center justify-center">
        {/* Dynamic Pitch & Roll Horizon Line */}
        <div
          className="absolute w-72 h-72 flex items-center justify-center transition-transform duration-75"
          style={{ transform: `rotate(${-roll}deg) translateY(${pitchOffset}px)` }}
        >
          {/* Sky / Water division line */}
          <div className="w-full h-0.5 bg-cyan-400 shadow-[0_0_8px_#00e5ff]" />
          
          {/* Pitch Ladder bars */}
          <div className="absolute -top-12 flex flex-col items-center gap-6 opacity-60">
            <div className="w-16 h-0.5 border-t border-cyan-300 flex justify-between text-[9px]"><span>10</span><span>10</span></div>
            <div className="w-24 h-0.5 border-t border-cyan-300 flex justify-between text-[9px]"><span>20</span><span>20</span></div>
          </div>
          <div className="absolute top-12 flex flex-col items-center gap-6 opacity-60">
            <div className="w-16 h-0.5 border-b border-cyan-300 flex justify-between text-[9px]"><span>-10</span><span>-10</span></div>
            <div className="w-24 h-0.5 border-b border-cyan-300 flex justify-between text-[9px]"><span>-20</span><span>-20</span></div>
          </div>
        </div>

        {/* Fixed Center Crosshair */}
        <div className="absolute w-8 h-8 flex items-center justify-center pointer-events-none">
          <div className="w-3 h-0.5 bg-yellow-400" />
          <div className="w-1.5 h-1.5 rounded-full border border-yellow-400" />
          <div className="w-3 h-0.5 bg-yellow-400" />
        </div>

        {/* Roll pointer at 12 o'clock */}
        <div
          className="absolute top-1 text-[10px] text-yellow-400 font-bold transition-transform"
          style={{ transform: `rotate(${-roll}deg)` }}
        >
          ▼
        </div>
      </div>

      {/* Bottom Tapes: Left is Speed, Right is Depth */}
      <div className="flex justify-between w-full px-2">
        {/* Speed Tape */}
        <div className="bg-navy-950/80 px-2 py-1.5 rounded border border-cyan-500/30 backdrop-blur-sm flex flex-col">
          <span className="text-[10px] text-slate-400">SURGE SPD</span>
          <span className="text-base font-bold text-cyan-300">{speed.toFixed(2)} <span className="text-[10px] font-normal text-slate-400">m/s</span></span>
        </div>

        {/* Depth Tape */}
        <div className="bg-navy-950/80 px-2 py-1.5 rounded border border-cyan-500/30 backdrop-blur-sm flex flex-col items-end">
          <span className="text-[10px] text-slate-400">DEPTH (Z)</span>
          <span className="text-base font-bold text-cyan-300">{depth.toFixed(2)} <span className="text-[10px] font-normal text-slate-400">m</span></span>
        </div>
      </div>
    </div>
  );
};
