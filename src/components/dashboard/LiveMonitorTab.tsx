import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceArea,
  ReferenceLine,
} from 'recharts';
import { Heart, Wind, Thermometer, Activity, AlertTriangle, Database } from 'lucide-react';

import { usePulseGuard } from '../../context/PulseGuardContext';

export const LiveMonitorTab: React.FC = () => {
  const { currentReading, readingsHistory, baselineRanges, activeAnomaly, dataSource, backendConnected, backendModelLoaded } = usePulseGuard();

  const chartData = readingsHistory.map((r) => ({
    time: r.timestamp,
    hr: r.heartRate,
    spo2: r.spO2,
    temp: r.skinTemp,
    isAnomaly: r.isAnomaly,
  }));

  const hrDelta = currentReading.heartRate - baselineRanges.heartRate.typical;
  const isHrElevated = currentReading.heartRate > baselineRanges.heartRate.restingMax;

  return (
    <div className="space-y-8">
      {/* Active Anomaly Banner if present */}
      {activeAnomaly && (
        <div className="p-5 rounded-2xl bg-[#E76F51]/10 border border-[#E76F51]/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-[#E76F51] text-white shrink-0 mt-0.5">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-editorial text-lg font-bold text-[#242923]">
                  {activeAnomaly.title}
                </h4>
                <span className="px-2 py-0.5 rounded-full bg-[#E76F51] text-white text-[10px] font-mono uppercase tracking-wider font-semibold">
                  {activeAnomaly.severity}
                </span>
                {currentReading.isMlAnomaly && (
                  <span className="px-2 py-0.5 rounded-full bg-[#294638] text-white text-[10px] font-mono uppercase tracking-wider font-semibold">
                    ML Flagged
                  </span>
                )}
              </div>
              <p className="text-sm text-[#242923]/80 mt-1 max-w-2xl leading-relaxed">
                {activeAnomaly.explanation}
              </p>
            </div>
          </div>
          <div className="shrink-0 font-mono text-xs text-[#242923]/70 bg-white/70 px-3 py-2 rounded-xl border border-[#294638]/10">
            Detected: {activeAnomaly.timestamp} (Duration: {activeAnomaly.durationSeconds}s)
          </div>
        </div>
      )}

      {/* 4 Telemetry Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Heart Rate */}
        <div className={`p-5 rounded-2xl bg-white border transition-all ${
          isHrElevated ? 'border-[#E76F51] shadow-md shadow-[#E76F51]/10' : 'border-[#294638]/12'
        }`}>
          <div className="flex items-center justify-between text-xs font-mono text-[#242923]/60 mb-2">
            <span className="flex items-center gap-1.5 uppercase font-medium">
              <Heart className={`w-4 h-4 ${isHrElevated ? 'text-[#E76F51] animate-pulse' : 'text-[#294638]'}`} />
              Heart Rate
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
              isHrElevated ? 'bg-[#E76F51]/15 text-[#E76F51]' : 'bg-[#294638]/10 text-[#294638]'
            }`}>
              {isHrElevated ? 'Elevated' : 'Nominal'}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-editorial text-4xl font-bold text-[#242923] font-mono-numbers">
              {currentReading.heartRate}
            </span>
            <span className="text-xs font-mono uppercase text-[#242923]/50">BPM</span>
          </div>
          <div className="mt-3 pt-3 border-t border-[#294638]/10 flex items-center justify-between text-xs font-mono">
            <span className="text-[#242923]/50">Baseline Delta:</span>
            <span className={`font-semibold ${hrDelta > 0 ? (hrDelta > 20 ? 'text-[#E76F51]' : 'text-[#D9A441]') : 'text-[#294638]'}`}>
              {hrDelta > 0 ? `+${hrDelta}` : hrDelta} BPM
            </span>
          </div>
        </div>

        {/* Oxygen Saturation */}
        <div className="p-5 rounded-2xl bg-white border border-[#294638]/12">
          <div className="flex items-center justify-between text-xs font-mono text-[#242923]/60 mb-2">
            <span className="flex items-center gap-1.5 uppercase font-medium">
              <Wind className="w-4 h-4 text-[#294638]" />
              SpO₂ Saturation
            </span>
            <span className="px-2 py-0.5 rounded-full bg-[#294638]/10 text-[#294638] text-[10px] font-semibold">
              Optimal
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-editorial text-4xl font-bold text-[#242923] font-mono-numbers">
              {currentReading.spO2}
            </span>
            <span className="text-xs font-mono uppercase text-[#242923]/50">%</span>
          </div>
          <div className="mt-3 pt-3 border-t border-[#294638]/10 flex items-center justify-between text-xs font-mono">
            <span className="text-[#242923]/50">Empirical Range:</span>
            <span className="text-[#294638] font-semibold">
              {baselineRanges.spO2.min}% – {baselineRanges.spO2.max}%
            </span>
          </div>
        </div>

        {/* Activity State */}
        <div className="p-5 rounded-2xl bg-white border border-[#294638]/12">
          <div className="flex items-center justify-between text-xs font-mono text-[#242923]/60 mb-2">
            <span className="flex items-center gap-1.5 uppercase font-medium">
              <Activity className="w-4 h-4 text-[#294638]" />
              Activity State
            </span>
            <span className="px-2 py-0.5 rounded-full bg-[#E6E8DC] text-[#294638] text-[10px] font-semibold">
              IMU Synced
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-editorial text-3xl font-bold text-[#242923] capitalize">
              {currentReading.activity}
            </span>
          </div>
          <div className="mt-3 pt-3 border-t border-[#294638]/10 flex items-center justify-between text-xs font-mono">
            <span className="text-[#242923]/50">Metabolic Mode:</span>
            <span className="text-[#242923]/80 font-medium">Sedentary Rest</span>
          </div>
        </div>

        {/* Skin Temperature */}
        <div className="p-5 rounded-2xl bg-white border border-[#294638]/12">
          <div className="flex items-center justify-between text-xs font-mono text-[#242923]/60 mb-2">
            <span className="flex items-center gap-1.5 uppercase font-medium">
              <Thermometer className="w-4 h-4 text-[#294638]" />
              Skin Temp
            </span>
            <span className="px-2 py-0.5 rounded-full bg-[#294638]/10 text-[#294638] text-[10px] font-semibold">
              Calibrated
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-editorial text-4xl font-bold text-[#242923] font-mono-numbers">
              {currentReading.skinTemp}
            </span>
            <span className="text-xs font-mono uppercase text-[#242923]/50">°C</span>
          </div>
          <div className="mt-3 pt-3 border-t border-[#294638]/10 flex items-center justify-between text-xs font-mono">
            <span className="text-[#242923]/50">Baseline Mean:</span>
            <span className="text-[#242923]/80 font-medium">36.6°C (±0.3)</span>
          </div>
        </div>
      </div>

      {/* Live Stream Telemetry Chart (Recharts) */}
      <div className="p-6 rounded-3xl bg-white border border-[#294638]/12 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-editorial text-xl font-bold text-[#242923]">
                Multi-Signal Chronological Telemetry
              </h3>
              <span className={`inline-flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-0.5 rounded-full font-medium ${
                backendConnected ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-amber-100 text-amber-800 border border-amber-300'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${backendConnected ? 'bg-emerald-600 animate-pulse' : 'bg-amber-600'}`} />
                {backendConnected ? (backendModelLoaded ? 'Python ML Backend (Active)' : 'Backend Connected') : 'Demo Simulation (Offline)'}
              </span>
              <span className="flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-md bg-[#294638]/10 text-[#294638] font-medium">
                <Database className="w-3 h-3" />
                {dataSource === 'simulated' ? (backendConnected ? 'Live Sensor Simulation' : 'Client Simulation Fallback') : 'Imported CSV'}
              </span>
              {currentReading.mlAnomalyScore !== undefined && currentReading.mlAnomalyScore !== null && (
                <span className={`text-[11px] font-mono px-2 py-0.5 rounded-md font-semibold ${
                  currentReading.mlAnomalyScore < 0 ? 'bg-[#E76F51]/15 text-[#E76F51] border border-[#E76F51]/30' : 'bg-[#294638]/10 text-[#294638]'
                }`}>
                  IF Score: {currentReading.mlAnomalyScore} {currentReading.mlAnomalyScore < 0 ? '(Outlier)' : '(Inlier)'}
                </span>
              )}
            </div>
            <p className="text-xs text-[#242923]/60 mt-0.5">
              Live moving 60-second window comparing instantaneous readings against the individual 14-day baseline confidence ribbon.
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-[#294638] inline-block" />
              <span>Heart Rate (BPM)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-3 bg-[#E6E8DC] inline-block rounded-xs border border-[#294638]/20" />
              <span>Baseline Envelope (58–76)</span>
            </div>
          </div>
        </div>

        <div className="h-72 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#294638" strokeOpacity={0.08} />
              <XAxis dataKey="time" stroke="#242923" opacity={0.4} tick={{ fontSize: 11, fontFamily: 'monospace' }} />
              <YAxis domain={[50, 130]} stroke="#242923" opacity={0.4} tick={{ fontSize: 11, fontFamily: 'monospace' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#F7F5EF',
                  border: '1px solid rgba(41, 70, 56, 0.2)',
                  borderRadius: '12px',
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
                }}
              />
              {/* Resting baseline safe envelope ribbon (58 - 76 BPM) */}
              <ReferenceArea
                y1={baselineRanges.heartRate.restingMin}
                y2={baselineRanges.heartRate.restingMax}
                fill="#E6E8DC"
                fillOpacity={0.55}
              />
              <ReferenceLine
                y={baselineRanges.heartRate.typical}
                stroke="#294638"
                strokeDasharray="2 2"
                strokeOpacity={0.4}
                label={{ value: 'Typical (68 BPM)', position: 'insideTopLeft', fill: '#294638', fontSize: 10, fontFamily: 'monospace' }}
              />
              <Line
                type="monotone"
                dataKey="hr"
                name="Heart Rate"
                stroke={activeAnomaly ? '#E76F51' : '#294638'}
                strokeWidth={2.5}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
