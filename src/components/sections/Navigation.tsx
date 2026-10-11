import { Shield, ChevronRight } from 'lucide-react';

import { usePulseGuard } from '../../context/PulseGuardContext';

interface NavigationProps {
  onJumpToDashboard: () => void;
  onJumpToStory: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({ onJumpToDashboard, onJumpToStory }) => {
  const { currentReading, activeAnomaly, backendConnected } = usePulseGuard();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[#F7F5EF]/85 backdrop-blur-md border-b border-[#294638]/10 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-6 h-18 flex items-center justify-between">
        {/* Logo / Wordmark */}
        <div className="flex items-center gap-2.5 cursor-pointer" onClick={onJumpToStory}>
          <Shield className="w-6 h-6 text-[#294638]" />
          <div className="flex flex-col">

            <span className="font-editorial text-xl font-bold tracking-tight text-[#242923]">
              PulseGuard
            </span>
            <span className="text-[10px] uppercase font-mono tracking-widest text-[#242923]/60 -mt-1">
              Physiological Radar
            </span>
          </div>
        </div>

        {/* Center Live Status Pill */}
        <div className="hidden md:flex items-center gap-6">
          <div className="flex items-center gap-2.5 px-3 py-1 rounded-full bg-[#E6E8DC]/80 border border-[#294638]/10 text-xs font-mono">
            <span className="relative flex h-2 w-2">
              <span
                className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  activeAnomaly ? 'bg-[#E76F51]' : 'bg-[#4E876B]'
                }`}
              />
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${
                  activeAnomaly ? 'bg-[#E76F51]' : 'bg-[#294638]'
                }`}
              />
            </span>
            <span className="text-[#242923]/80 font-medium">
              {activeAnomaly ? 'ANOMALY DETECTED' : (backendConnected ? 'PYTHON ML ACTIVE' : 'CALIBRATED & MONITORING')}
            </span>
            <span className="text-[#242923]/30">|</span>
            <span className="text-[#242923]/60">
              {currentReading.heartRate} BPM
            </span>
          </div>

          <nav className="flex items-center gap-5 text-sm font-medium text-[#242923]/70">
            <button
              onClick={onJumpToStory}
              className="hover:text-[#294638] transition-colors cursor-pointer"
            >
              The Story
            </button>
            <button
              onClick={onJumpToDashboard}
              className="hover:text-[#294638] transition-colors cursor-pointer"
            >
              Monitor
            </button>
            <button
              onClick={onJumpToDashboard}
              className="hover:text-[#294638] transition-colors cursor-pointer"
            >
              Baseline
            </button>
            <button
              onClick={onJumpToDashboard}
              className="hover:text-[#294638] transition-colors cursor-pointer"
            >
              Timeline
            </button>
          </nav>
        </div>

        {/* Right CTA */}
        <div className="flex items-center gap-3">
          <button
            onClick={onJumpToDashboard}
            className="flex items-center gap-2 px-4 py-2 rounded-md bg-[#294638] text-[#F7F5EF] text-xs uppercase tracking-wider font-semibold hover:bg-[#1f362b] transition-all cursor-pointer shadow-sm active:scale-95"
          >
            <span>Open Dashboard</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

      </div>
    </header>
  );
};
