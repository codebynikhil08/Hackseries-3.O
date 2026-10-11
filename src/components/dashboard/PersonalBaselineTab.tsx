import { ShieldCheck, Info } from 'lucide-react';

import { usePulseGuard } from '../../context/PulseGuardContext';

export const PersonalBaselineTab: React.FC = () => {
  const { baselineRanges } = usePulseGuard();

  return (
    <div className="space-y-8">
      {/* Top Baseline Calibration Status */}
      <div className="p-6 rounded-3xl bg-white border border-[#294638]/12 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-[#294638] text-white">
              <ShieldCheck className="w-4 h-4" />
            </span>
            <h3 className="font-editorial text-2xl font-bold text-[#242923]">
              Personal Calibration Window
            </h3>
          </div>
          <p className="text-sm text-[#242923]/70 max-w-xl">
            PulseGuard establishes individual norm bounds by tracking continuous circadian cycles across a 14-day rolling baseline rather than relying on generic population averages.
          </p>
        </div>

        <div className="flex items-center gap-4 bg-[#F7F5EF] p-4 rounded-2xl border border-[#294638]/10 shrink-0">
          <div>
            <span className="text-[10px] font-mono uppercase text-[#242923]/50 block">Calibration Window</span>
            <span className="text-xl font-editorial font-bold text-[#294638]">
              {baselineRanges.observationWindowDays} Days
            </span>
          </div>
          <div className="h-8 w-px bg-[#294638]/15" />
          <div>
            <span className="text-[10px] font-mono uppercase text-[#242923]/50 block">Data Density</span>
            <span className="text-xl font-editorial font-bold text-[#242923] font-mono-numbers">
              {baselineRanges.totalDataPoints.toLocaleString()} pts
            </span>
          </div>
          <div className="h-8 w-px bg-[#294638]/15" />
          <div>
            <span className="text-[10px] font-mono uppercase text-[#242923]/50 block">Confidence</span>
            <span className="text-xl font-editorial font-bold text-[#294638] font-mono-numbers">
              {baselineRanges.confidenceScore}%
            </span>
          </div>
        </div>
      </div>

      {/* Baseline Confidence Envelope Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Heart Rate Calibration */}
        <div className="p-6 rounded-3xl bg-white border border-[#294638]/12 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h4 className="font-editorial text-lg font-bold text-[#242923]">
              Cardiovascular Resting & Active Ranges
            </h4>
            <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-[#294638]/10 text-[#294638] font-semibold">
              Sufficient Data
            </span>
          </div>

          <p className="text-xs text-[#242923]/65 leading-relaxed">
            Empirically observed resting pulse bounds versus activity-adjusted zones. Readings beyond the resting envelope trigger verification of accelerometry state before flagging.
          </p>

          <div className="space-y-3 pt-2">
            <div>
              <div className="flex justify-between text-xs font-mono mb-1 text-[#242923]/70">
                <span>Resting Heart Rate Envelope</span>
                <span className="font-bold text-[#294638]">
                  {baselineRanges.heartRate.restingMin} – {baselineRanges.heartRate.restingMax} BPM (Typical: {baselineRanges.heartRate.typical})
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-[#E6E8DC] overflow-hidden flex">
                <div style={{ width: '45%' }} className="h-full bg-transparent" />
                <div style={{ width: '25%' }} className="h-full bg-[#294638] rounded-full" />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-mono mb-1 text-[#242923]/70">
                <span>Active Exertion Envelope</span>
                <span className="font-bold text-[#294638]">
                  {baselineRanges.heartRate.activeMin} – {baselineRanges.heartRate.activeMax} BPM
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-[#E6E8DC] overflow-hidden flex">
                <div style={{ width: '65%' }} className="h-full bg-transparent" />
                <div style={{ width: '30%' }} className="h-full bg-[#294638]/60 rounded-full" />
              </div>
            </div>
          </div>
        </div>

        {/* Respiratory & Thermal Envelopes */}
        <div className="p-6 rounded-3xl bg-white border border-[#294638]/12 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h4 className="font-editorial text-lg font-bold text-[#242923]">
              SpO₂ Saturation & Skin Thermometry
            </h4>
            <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-[#294638]/10 text-[#294638] font-semibold">
              Calibrated
            </span>
          </div>

          <p className="text-xs text-[#242923]/65 leading-relaxed">
            Personal blood oxygen saturation baseline establishes an individualized nocturnal floor. Temperature tracks skin thermoregulation across circadian day/night phases.
          </p>

          <div className="space-y-3 pt-2">
            <div>
              <div className="flex justify-between text-xs font-mono mb-1 text-[#242923]/70">
                <span>Personal SpO₂ Normal Range</span>
                <span className="font-bold text-[#294638]">
                  {baselineRanges.spO2.min}% – {baselineRanges.spO2.max}% (Floor: 94.0%)
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-[#E6E8DC] overflow-hidden flex">
                <div style={{ width: '85%' }} className="h-full bg-transparent" />
                <div style={{ width: '15%' }} className="h-full bg-[#294638] rounded-full" />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-mono mb-1 text-[#242923]/70">
                <span>Circadian Skin Temperature</span>
                <span className="font-bold text-[#294638]">
                  {baselineRanges.skinTemp.min}°C – {baselineRanges.skinTemp.max}°C (Mean: {baselineRanges.skinTemp.typical}°C)
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-[#E6E8DC] overflow-hidden flex">
                <div style={{ width: '50%' }} className="h-full bg-transparent" />
                <div style={{ width: '25%' }} className="h-full bg-[#294638] rounded-full" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Observed Values vs Illustrative Thresholds Distinction Box */}
      <div className="p-5 rounded-2xl bg-[#E6E8DC]/70 border border-[#294638]/15 flex items-start gap-4">
        <Info className="w-5 h-5 text-[#294638] shrink-0 mt-0.5" />
        <div className="space-y-1 text-xs text-[#242923]/80 leading-relaxed">
          <span className="font-bold uppercase tracking-wider font-mono text-[#294638] block">
            Important Clinical Distinction: Empirical vs Population Thresholds
          </span>
          <p>
            Observed values reflect your actual wearable telemetry recorded over the last 14 days. Illustrative thresholds (such as general population bradycardia &lt;50 BPM or tachycardia &gt;100 BPM) serve as secondary sanity bounds. PulseGuard triggers primarily when your readings diverge from your personal empirical baseline rather than arbitrary population norms.
          </p>
        </div>
      </div>
    </div>
  );
};
