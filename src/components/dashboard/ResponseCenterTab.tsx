import { Send, Stethoscope, AlertTriangle } from 'lucide-react';

import { usePulseGuard } from '../../context/PulseGuardContext';

export const ResponseCenterTab: React.FC = () => {
  const { currentReading, activeAnomaly, anomalyEvents } = usePulseGuard();

  const latestEvent = activeAnomaly || anomalyEvents[0];

  return (
    <div className="space-y-8">
      {/* Simulation Warning Banner */}
      <div className="p-4 rounded-2xl bg-[#D9A441]/15 border border-[#D9A441]/30 flex items-center gap-3">
        <AlertTriangle className="w-5 h-5 text-[#D9A441] shrink-0" />
        <div className="text-xs text-[#242923]/80 leading-relaxed">
          <strong className="text-[#242923]">SIMULATION PREVIEW ONLY:</strong> This module illustrates how automated clinical decision-support reports are packaged for physician consultation. No external SMS, webhook, or emergency service is contacted.
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Clinician Notification Memo Card */}
        <div className="lg:col-span-2 p-8 rounded-3xl bg-white border border-[#294638]/12 shadow-sm space-y-6">
          <div className="flex items-start justify-between border-b border-[#294638]/10 pb-5">
            <div>
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#242923]/50 block">
                Automated Clinical Triage Memorandum
              </span>
              <h3 className="font-editorial text-2xl font-bold text-[#242923] mt-1">
                Physiological Anomaly Dossier
              </h3>
            </div>
            <div className="px-3 py-1 rounded-full bg-[#E76F51]/10 text-[#E76F51] border border-[#E76F51]/20 text-xs font-mono font-semibold">
              PREVIEW
            </div>
          </div>

          {/* Dossier Header Info */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-2xl bg-[#F7F5EF] border border-[#294638]/8 text-xs font-mono">
            <div>
              <span className="text-[#242923]/50 block text-[10px]">PATIENT ID</span>
              <span className="font-bold text-[#242923]">PG-8824-A</span>
            </div>
            <div>
              <span className="text-[#242923]/50 block text-[10px]">TIMESTAMP</span>
              <span className="font-bold text-[#242923]">{latestEvent ? latestEvent.timestamp : '10:14:02'}</span>
            </div>
            <div>
              <span className="text-[#242923]/50 block text-[10px]">SEVERITY</span>
              <span className="font-bold text-[#E76F51]">{latestEvent ? latestEvent.severity : 'Moderate'}</span>
            </div>
            <div>
              <span className="text-[#242923]/50 block text-[10px]">RADAR STATUS</span>
              <span className="font-bold text-[#294638]">Calibrated</span>
            </div>
          </div>

          {/* Clinical Findings Summary */}
          <div className="space-y-3">
            <h4 className="font-editorial text-lg font-bold text-[#242923]">
              Diagnostic Observation Summary
            </h4>
            <p className="text-sm text-[#242923]/80 leading-relaxed">
              {latestEvent
                ? latestEvent.explanation
                : 'Continuous telemetry reveals resting tachycardia episode with disproportionate heart rate elevation relative to zero kinetic movement.'}
            </p>
          </div>

          {/* Contributing Signal Matrix Breakdown */}
          <div className="space-y-3">
            <h5 className="text-xs font-mono uppercase tracking-wider text-[#242923]/60 font-semibold">
              Telemetry Parameters at Moment of Alert
            </h5>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-white border border-[#294638]/10 text-center">
                <span className="text-[10px] font-mono text-[#242923]/50 block">Peak Heart Rate</span>
                <span className="text-lg font-bold font-editorial text-[#E76F51]">
                  {latestEvent ? latestEvent.heartRate : currentReading.heartRate} BPM
                </span>
              </div>
              <div className="p-3 rounded-xl bg-white border border-[#294638]/10 text-center">
                <span className="text-[10px] font-mono text-[#242923]/50 block">SpO₂ Reading</span>
                <span className="text-lg font-bold font-editorial text-[#294638]">
                  {latestEvent ? latestEvent.spO2 : currentReading.spO2}%
                </span>
              </div>
              <div className="p-3 rounded-xl bg-white border border-[#294638]/10 text-center">
                <span className="text-[10px] font-mono text-[#242923]/50 block">Skin Temp</span>
                <span className="text-lg font-bold font-editorial text-[#242923]">
                  {latestEvent ? latestEvent.skinTemp : currentReading.skinTemp}°C
                </span>
              </div>
              <div className="p-3 rounded-xl bg-white border border-[#294638]/10 text-center">
                <span className="text-[10px] font-mono text-[#242923]/50 block">Kinetic State</span>
                <span className="text-lg font-bold font-editorial text-[#242923]">
                  {latestEvent ? latestEvent.activity : currentReading.activity}
                </span>
              </div>
            </div>
          </div>

          {/* Suggested Physician Next Steps */}
          <div className="p-4 rounded-2xl bg-[#E6E8DC]/60 border border-[#294638]/12 space-y-2">
            <span className="text-xs font-mono uppercase tracking-wider text-[#294638] font-bold block">
              Suggested Clinical Action Protocols
            </span>
            <ul className="text-xs text-[#242923]/80 space-y-1 list-disc list-inside">
              <li>Review 12-lead ECG telemetry to evaluate potential supraventricular tachycardia vs sinus tachycardia.</li>
              <li>Inquire about recent caffeine intake, acute psychological stressors, or prescription medication adjustments.</li>
              <li>Verify hydration status and confirm absence of orthostatic syncope symptoms.</li>
            </ul>
          </div>
        </div>

        {/* Right Sidebar: Physician Communication Preview */}
        <div className="space-y-6">
          <div className="p-6 rounded-3xl bg-white border border-[#294638]/12 shadow-sm space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#294638] text-white flex items-center justify-center font-bold">
                <Stethoscope className="w-5 h-5" />
              </div>
              <div>
                <h4 className="font-editorial text-base font-bold text-[#242923]">
                  Assigned Clinician
                </h4>
                <p className="text-xs text-[#242923]/60">Dr. Elena Vance, MD, FACC</p>
              </div>
            </div>

            <p className="text-xs text-[#242923]/70 leading-relaxed">
              Cardiology & Electrophysiology Clinic, Memorial Heart Institute. Telemetry alerts are batched into non-urgent daily briefings unless critical criteria are satisfied.
            </p>

            <div className="pt-2">
              <button
                disabled
                className="w-full py-3 rounded-2xl bg-[#294638]/10 text-[#294638] text-xs font-mono font-semibold flex items-center justify-center gap-2 cursor-not-allowed opacity-75"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Simulated Dispatch (Disabled)</span>
              </button>
            </div>
          </div>

          <div className="p-6 rounded-3xl bg-[#F7F5EF] border border-[#294638]/10 space-y-3">
            <h5 className="font-editorial text-sm font-bold text-[#242923]">
              About Clinical Decision Support
            </h5>
            <p className="text-xs text-[#242923]/70 leading-relaxed">
              PulseGuard is designed to bridge the gap between continuous wearable biometric tracking and actionable medical consultation, reducing patient anxiety while giving physicians structured context.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
