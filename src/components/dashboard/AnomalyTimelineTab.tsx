import { CheckCircle, Clock, Check } from 'lucide-react';

import { usePulseGuard } from '../../context/PulseGuardContext';

export const AnomalyTimelineTab: React.FC = () => {
  const { anomalyEvents, acknowledgeEvent } = usePulseGuard();

  const getSeverityStyle = (severity: string) => {
    switch (severity) {
      case 'Critical':
        return 'bg-[#E76F51] text-white';
      case 'High':
        return 'bg-[#E76F51]/15 text-[#E76F51] border border-[#E76F51]/30';
      case 'Moderate':
        return 'bg-[#D9A441]/15 text-[#D9A441] border border-[#D9A441]/30';
      default:
        return 'bg-[#294638]/10 text-[#294638] border border-[#294638]/20';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="font-editorial text-2xl font-bold text-[#242923]">
            Historical Anomaly Timeline
          </h3>
          <p className="text-xs text-[#242923]/60 mt-0.5">
            Deterministic audit log of flagged multi-signal physiological deviations with explainable root signals.
          </p>
        </div>
        <div className="text-xs font-mono text-[#242923]/60 bg-white px-3 py-1.5 rounded-xl border border-[#294638]/10 w-fit">
          Total Logged Events: {anomalyEvents.length}
        </div>
      </div>

      <div className="space-y-4">
        {anomalyEvents.length === 0 ? (
          <div className="p-12 text-center bg-white rounded-3xl border border-[#294638]/10">
            <CheckCircle className="w-10 h-10 text-[#294638] mx-auto mb-3" />
            <p className="font-editorial text-lg font-bold text-[#242923]">No Anomalies Flagged</p>
            <p className="text-xs text-[#242923]/60 mt-1">All physiological telemetry conforms to empirical baseline bounds.</p>
          </div>
        ) : (
          anomalyEvents.map((evt) => (
            <div
              key={evt.id}
              className={`p-6 rounded-3xl bg-white border transition-all ${
                !evt.acknowledged ? 'border-[#E76F51]/40 shadow-md shadow-[#E76F51]/5' : 'border-[#294638]/12'
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#294638]/10 pb-4">
                <div className="flex items-center gap-3">
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-mono uppercase tracking-wider font-semibold ${getSeverityStyle(evt.severity)}`}>
                    {evt.severity}
                  </span>
                  <h4 className="font-editorial text-lg font-bold text-[#242923]">
                    {evt.title}
                  </h4>
                </div>

                <div className="flex items-center gap-4 text-xs font-mono text-[#242923]/70">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-[#242923]/50" />
                    <span>{evt.timestamp}</span>
                  </div>
                  <span>•</span>
                  <span>Duration: {evt.durationSeconds}s</span>
                  <span>•</span>
                  <span className={evt.recovered ? 'text-[#294638] font-semibold' : 'text-[#E76F51] font-semibold'}>
                    {evt.recovered ? 'Recovered' : 'Active Episode'}
                  </span>
                </div>
              </div>

              <div className="py-4 space-y-3">
                <p className="text-sm text-[#242923]/80 leading-relaxed">
                  {evt.explanation}
                </p>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="text-[11px] font-mono text-[#242923]/50 mr-1">Contributing Signals:</span>
                  {evt.contributingSignals.map((sig, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded-lg bg-[#F7F5EF] border border-[#294638]/10 text-xs font-mono text-[#242923]/80"
                    >
                      {sig}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-[#294638]/8">
                <div className="flex items-center gap-3 text-xs font-mono text-[#242923]/60">
                  <span>Logged at: {evt.heartRate} BPM</span>
                  <span>|</span>
                  <span>SpO₂: {evt.spO2}%</span>
                  <span>|</span>
                  <span>Activity: {evt.activity}</span>
                </div>

                <div>
                  {evt.acknowledged ? (
                    <div className="flex items-center gap-1.5 text-xs font-mono text-[#294638] font-semibold">
                      <Check className="w-3.5 h-3.5" />
                      <span>Acknowledged</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => acknowledgeEvent(evt.id)}
                      className="px-3.5 py-1.5 rounded-xl bg-[#294638] text-[#F7F5EF] text-xs font-mono hover:bg-[#1f362b] transition-colors cursor-pointer active:scale-95 shadow-sm"
                    >
                      Acknowledge Event
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
