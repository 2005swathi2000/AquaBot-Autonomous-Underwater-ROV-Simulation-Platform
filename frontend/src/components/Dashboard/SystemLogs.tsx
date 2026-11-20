import React, { useState } from 'react';
import { SystemLogItem, LogLevel } from '../../types';
import { Terminal, Trash2, Filter } from 'lucide-react';

interface Props {
  logs?: SystemLogItem[];
}

export const SystemLogs: React.FC<Props> = ({ logs = [] }) => {
  const [filter, setFilter] = useState<string>('ALL');

  const filteredLogs = filter === 'ALL'
    ? logs
    : logs.filter((l) => l.level === filter);

  return (
    <div className="bg-navy-900 border border-cyan-500/20 rounded-xl p-4 flex flex-col gap-2 select-none h-full min-h-[180px]">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5 font-mono">
          <Terminal className="w-4 h-4" /> System Audit & Diagnostics Log
        </h3>

        {/* Filter dropdown */}
        <div className="flex items-center gap-1 text-[11px] font-mono">
          <Filter className="w-3 h-3 text-slate-400" />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="bg-navy-950 border border-slate-700 rounded px-1.5 py-0.5 text-slate-300 focus:outline-none focus:border-cyan-400"
          >
            <option value="ALL">All Events</option>
            <option value="INFO">INFO</option>
            <option value="WARN">WARN</option>
            <option value="ERROR">ERROR</option>
            <option value="SUCCESS">SUCCESS</option>
          </select>
        </div>
      </div>

      {/* Terminal Output Stream */}
      <div className="flex-1 overflow-y-auto space-y-1.5 font-mono text-[11px] pr-1 max-h-48">
        {filteredLogs.length > 0 ? (
          filteredLogs.map((log, idx) => {
            const isError = log.level === 'ERROR';
            const isWarn = log.level === 'WARN';
            const isSuccess = log.level === 'SUCCESS';

            return (
              <div
                key={idx}
                className="flex items-start gap-2 leading-relaxed hover:bg-navy-950/50 p-0.5 rounded transition-colors"
              >
                <span className="text-slate-500 text-[10px] shrink-0">{log.timestamp}</span>
                <span
                  className={`text-[9px] px-1 py-0.2 rounded font-bold uppercase shrink-0 ${
                    isError
                      ? 'bg-red-950 text-red-400 border border-red-500/40'
                      : isWarn
                      ? 'bg-amber-950 text-amber-400 border border-amber-500/40'
                      : isSuccess
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/40'
                      : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  {log.level}
                </span>
                <span
                  className={`${
                    isError
                      ? 'text-red-300 font-semibold'
                      : isWarn
                      ? 'text-amber-200'
                      : isSuccess
                      ? 'text-emerald-300 font-semibold'
                      : 'text-slate-300'
                  }`}
                >
                  {log.message}
                </span>
              </div>
            );
          })
        ) : (
          <div className="text-slate-500 text-center py-4 font-mono text-xs">
            No system log events recorded.
          </div>
        )}
      </div>
    </div>
  );
};
