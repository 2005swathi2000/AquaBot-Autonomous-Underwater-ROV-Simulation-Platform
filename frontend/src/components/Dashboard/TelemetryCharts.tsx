import React, { useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine
} from 'recharts';
import { TelemetryChartsData } from '../../types';
import { LineChart as ChartIcon, Gauge, Battery, Radar, Activity } from 'lucide-react';

interface Props {
  charts?: TelemetryChartsData;
}

type ChartTab = 'DEPTH' | 'SPEED' | 'OBSTACLE' | 'BATTERY';

export const TelemetryCharts: React.FC<Props> = ({ charts }) => {
  const [activeTab, setActiveTab] = useState<ChartTab>('DEPTH');

  const times = charts?.time || [];
  const depths = charts?.depth || [];
  const speeds = charts?.speed || [];
  const obstacles = charts?.obstacle_dist || [];
  const batteries = charts?.battery || [];

  // Merge history buffers into Recharts array
  const data = times.map((t, idx) => ({
    time: t,
    depth: depths[idx] || 0,
    speed: speeds[idx] || 0,
    obstacle: obstacles[idx] !== undefined ? obstacles[idx] : 25,
    battery: batteries[idx] !== undefined ? batteries[idx] : 100
  }));

  return (
    <div className="bg-navy-900 border border-cyan-500/20 rounded-xl p-4 flex flex-col gap-3 select-none">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5 font-mono">
          <ChartIcon className="w-4 h-4" /> Real-Time Telemetry Performance Graphs
        </h3>

        {/* Tab Switcher */}
        <div className="flex items-center gap-1 bg-navy-950 p-1 rounded-lg border border-slate-800 text-[11px] font-mono">
          <button
            onClick={() => setActiveTab('DEPTH')}
            className={`px-2 py-0.5 rounded transition-all ${
              activeTab === 'DEPTH'
                ? 'bg-cyan-500 text-navy-950 font-bold'
                : 'text-slate-400 hover:text-cyan-300'
            }`}
          >
            Depth
          </button>
          <button
            onClick={() => setActiveTab('SPEED')}
            className={`px-2 py-0.5 rounded transition-all ${
              activeTab === 'SPEED'
                ? 'bg-cyan-500 text-navy-950 font-bold'
                : 'text-slate-400 hover:text-cyan-300'
            }`}
          >
            Velocity
          </button>
          <button
            onClick={() => setActiveTab('OBSTACLE')}
            className={`px-2 py-0.5 rounded transition-all ${
              activeTab === 'OBSTACLE'
                ? 'bg-cyan-500 text-navy-950 font-bold'
                : 'text-slate-400 hover:text-cyan-300'
            }`}
          >
            Obstacle
          </button>
          <button
            onClick={() => setActiveTab('BATTERY')}
            className={`px-2 py-0.5 rounded transition-all ${
              activeTab === 'BATTERY'
                ? 'bg-cyan-500 text-navy-950 font-bold'
                : 'text-slate-400 hover:text-cyan-300'
            }`}
          >
            Battery
          </button>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="h-44 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
            <XAxis
              dataKey="time"
              stroke="#64748b"
              fontSize={10}
              tickFormatter={(val) => `${val}s`}
            />
            <YAxis stroke="#64748b" fontSize={10} />
            <Tooltip
              contentStyle={{
                backgroundColor: '#080e1a',
                borderColor: '#06b6d4',
                borderRadius: '8px',
                fontSize: '11px',
                fontFamily: 'monospace'
              }}
            />

            {activeTab === 'DEPTH' && (
              <>
                <ReferenceLine y={0} stroke="#38bdf8" strokeDasharray="3 3" label="Surface" />
                <Line
                  type="monotone"
                  dataKey="depth"
                  name="Depth (m)"
                  stroke="#00e5ff"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </>
            )}

            {activeTab === 'SPEED' && (
              <Line
                type="monotone"
                dataKey="speed"
                name="Speed (m/s)"
                stroke="#10b981"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            )}

            {activeTab === 'OBSTACLE' && (
              <>
                <ReferenceLine y={1.6} stroke="#ef4444" strokeDasharray="3 3" label="Critical (1.6m)" />
                <ReferenceLine y={5.0} stroke="#eab308" strokeDasharray="3 3" label="Caution (5m)" />
                <Line
                  type="monotone"
                  dataKey="obstacle"
                  name="Sonar Clearance (m)"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </>
            )}

            {activeTab === 'BATTERY' && (
              <>
                <ReferenceLine y={25} stroke="#ef4444" strokeDasharray="3 3" label="Low Battery" />
                <Line
                  type="monotone"
                  dataKey="battery"
                  name="Battery SoC (%)"
                  stroke="#38bdf8"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              </>
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
