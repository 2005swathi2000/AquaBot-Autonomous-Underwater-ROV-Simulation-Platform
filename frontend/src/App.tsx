import React, { useCallback } from 'react';
import { useAquaBotSocket } from './hooks/useAquaBotSocket';
import { Header } from './components/Dashboard/Header';
import { TelemetryCards } from './components/Dashboard/TelemetryCards';
import { ControlPanel } from './components/Dashboard/ControlPanel';
import { SensorPanel } from './components/Dashboard/SensorPanel';
import { MissionPlanner } from './components/Dashboard/MissionPlanner';
import { TelemetryCharts } from './components/Dashboard/TelemetryCharts';
import { SystemLogs } from './components/Dashboard/SystemLogs';
import { ROVScene } from './components/3D/ROVScene';

export function App() {
  const {
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
  } = useAquaBotSocket();

  const handleAddWaypoint = useCallback(
    (x: number, y: number, z: number) => {
      const existing = telemetry?.navigation?.waypoints || [];
      const updated = existing.map((w) => ({ x: w.x, y: w.y, z: w.z, name: w.name }));
      updated.push({ x, y, z, name: `WP-${updated.length + 1}` });
      setWaypoints(updated);
    },
    [telemetry?.navigation?.waypoints, setWaypoints]
  );

  return (
    <div className="min-h-screen bg-navy-950 text-slate-100 flex flex-col font-sans select-none">
      {/* Top Navigation & Status Bar */}
      <Header
        mode={telemetry?.mode}
        isConnected={isConnected}
        ping={ping}
        batteryPct={telemetry?.sensors?.battery?.battery_pct}
        simTime={telemetry?.sim_time}
        onEmergencyStop={emergencyStop}
        onClearEmergencyStop={clearEmergencyStop}
        onReset={resetSimulation}
      />

      {/* Main Operating Surface */}
      <main className="flex-1 p-3 md:p-4 flex flex-col gap-3 overflow-y-auto max-w-[1920px] mx-auto w-full">
        {/* Real-time Telemetry Overview Cards */}
        <TelemetryCards telemetry={telemetry} />

        {/* Core Simulation & Control Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 flex-1">
          {/* Left / Center: 3D Ocean Simulation & Charts (7 cols on lg) */}
          <div className="lg:col-span-7 flex flex-col gap-3">
            {/* 3D Underwater Simulation Window */}
            <div className="h-[460px] xl:h-[520px] w-full">
              <ROVScene
                telemetry={telemetry}
                world={world}
                onAddWaypoint={handleAddWaypoint}
              />
            </div>

            {/* Performance & Hydrodynamics Telemetry Charts */}
            <TelemetryCharts charts={telemetry?.charts} />
          </div>

          {/* Right: Robotics Operations & Mission Controls (5 cols on lg) */}
          <div className="lg:col-span-5 flex flex-col gap-3">
            {/* Manual Flight & Directional Control Panel */}
            <ControlPanel
              mode={telemetry?.mode}
              onTeleop={sendTeleop}
              onStop={stopROV}
              onDepthHold={(enabled) => setDepthHold(enabled)}
              onHeadingHold={(enabled) => setHeadingHold(enabled)}
            />

            {/* Autonomous Waypoint Mission Executive */}
            <MissionPlanner
              navigation={telemetry?.navigation}
              onStartMission={startMission}
              onPauseMission={pauseMission}
              onResumeMission={resumeMission}
              onCancelMission={cancelMission}
              onLoadPreset={loadPresetMission}
              onAddWaypoint={setWaypoints}
            />

            {/* Simulated Acoustic Sonar & IMU Sensors */}
            <SensorPanel
              sensors={telemetry?.sensors}
              thrusters={telemetry?.thrusters}
            />

            {/* System Event Logs */}
            <SystemLogs logs={telemetry?.system_logs} />
          </div>
        </div>
      </main>

      {/* Footer / System Status Bar */}
      <footer className="h-8 bg-navy-950 border-t border-slate-800/80 px-4 flex items-center justify-between text-[11px] font-mono text-slate-400">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
            Backend: <span className="text-cyan-300">FastAPI & Python 3.12 (20 Hz)</span>
          </span>
          <span className="hidden sm:inline">
            Dynamics: <span className="text-slate-300">Fossen Hydrodynamic Model (6-DOF)</span>
          </span>
          <span className="hidden md:inline">
            Avoidance: <span className="text-slate-300">Artificial Potential Field (APF)</span>
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-cyan-400">ROS 2 Humble Ready</span>
          <span className="text-slate-500">|</span>
          <span className="text-slate-300">Underwater Robotics Portfolio</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
