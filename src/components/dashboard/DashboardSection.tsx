import { useState } from 'react';
import { Activity, ShieldCheck, Clock, FileText, Settings2 } from 'lucide-react';
import type { DashboardTab } from '../../types/pulseguard';

import { LiveMonitorTab } from './LiveMonitorTab';
import { PersonalBaselineTab } from './PersonalBaselineTab';
import { AnomalyTimelineTab } from './AnomalyTimelineTab';
import { ResponseCenterTab } from './ResponseCenterTab';
import { DataSettingsTab } from './DataSettingsTab';

export const DashboardSection: React.FC = () => {
  const [activeTab, setActiveTab] = useState<DashboardTab>('live-monitor');

  const tabs: { id: DashboardTab; label: string; icon: React.ReactNode }[] = [
    { id: 'live-monitor', label: 'Live Monitor', icon: <Activity className="w-4 h-4" /> },
    { id: 'personal-baseline', label: 'Personal Baseline', icon: <ShieldCheck className="w-4 h-4" /> },
    { id: 'anomaly-timeline', label: 'Anomaly Timeline', icon: <Clock className="w-4 h-4" /> },
    { id: 'response-center', label: 'Response Center', icon: <FileText className="w-4 h-4" /> },
    { id: 'data-settings', label: 'Data & Settings', icon: <Settings2 className="w-4 h-4" /> },
  ];

  return (
    <section id="dashboard" className="relative z-30 pointer-events-auto w-full bg-[#F7F5EF] py-24 px-6 lg:px-16 border-t border-[#294638]/10">

      <div className="max-w-7xl mx-auto space-y-10">
        {/* Dashboard Title & Introduction */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-[#294638]/10 pb-8">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono tracking-widest uppercase text-[#294638] font-semibold mb-2">
              <span className="w-2 h-2 rounded-full bg-[#294638]" />
              <span>Section 05 · Functional Telemetry Console</span>
            </div>
            <h2 className="font-editorial text-4xl sm:text-5xl font-bold text-[#242923] tracking-tight">
              PulseGuard Radar Station
            </h2>
            <p className="text-base text-[#242923]/70 max-w-2xl mt-2 font-light leading-relaxed">
              Real-time physiological surveillance correlating instantaneous biometrics with calibrated baseline distributions.
            </p>
          </div>

          {/* 5-Area Navigation Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 p-1.5 rounded-2xl bg-[#E6E8DC]/80 border border-[#294638]/10">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-mono font-medium transition-all cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-[#294638] text-[#F7F5EF] shadow-sm font-semibold'
                    : 'text-[#242923]/70 hover:text-[#242923] hover:bg-white/40'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content Display */}
        <div className="transition-opacity duration-200">
          {activeTab === 'live-monitor' && <LiveMonitorTab />}
          {activeTab === 'personal-baseline' && <PersonalBaselineTab />}
          {activeTab === 'anomaly-timeline' && <AnomalyTimelineTab />}
          {activeTab === 'response-center' && <ResponseCenterTab />}
          {activeTab === 'data-settings' && <DataSettingsTab />}
        </div>
      </div>
    </section>
  );
};
