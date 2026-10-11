import { useRef, useEffect, useState } from 'react';
import { ArrowDown, Activity, Heart, Wind, Thermometer, AlertCircle } from 'lucide-react';


import { WristWatchScene } from '../3d/WristWatchScene';
import { usePulseGuard } from '../../context/PulseGuardContext';

interface HeroAndStorytellingProps {
  onScrollToDashboard: () => void;
}

export const HeroAndStorytelling: React.FC<HeroAndStorytellingProps> = ({ onScrollToDashboard }) => {
  const { currentReading, activeAnomaly, triggerTestAnomaly, restoreNormalReadings } = usePulseGuard();

  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = useState<number>(0);
  const [activeChapter, setActiveChapter] = useState<number>(0);

  // Scroll listener to compute active chapter and progress seamlessly
  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const totalHeight = containerRef.current.offsetHeight - window.innerHeight;
      if (totalHeight <= 0) return;

      const scrolled = -rect.top;
      const progress = Math.max(0, Math.min(1, scrolled / totalHeight));
      setScrollProgress(progress);

      // 5 Stages:
      // 0.0 - 0.18: Hero
      // 0.18 - 0.42: Chapter A ("Every second leaves a signal")
      // 0.42 - 0.68: Chapter B ("One reading never tells the whole story")
      // 0.68 - 0.88: Chapter C ("Notice what changes")
      // 0.88 - 1.00: Chapter D ("From raw readings to meaningful alerts")
      if (progress < 0.18) {
        setActiveChapter(0);
      } else if (progress < 0.42) {
        setActiveChapter(1);
      } else if (progress < 0.68) {
        setActiveChapter(2);
      } else if (progress < 0.88) {
        setActiveChapter(3);
      } else {
        setActiveChapter(4);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full bg-[#F7F5EF]">
      {/* ========================================================= */}
      {/* STICKY 3D VIEWPORT CONTAINER                              */}
      {/* Sticks to viewport while user scrolls through the 5 scenes */}
      {/* ========================================================= */}
      <div className="sticky top-0 h-screen w-full overflow-hidden pointer-events-none z-10">
        {/* Background Paper Texture / Fine Coordinate Grid Lines */}
        <div className="absolute inset-0 bg-grain pointer-events-none opacity-40" />

        {/* Dynamic Chapter Progress Bar on right margin */}
        <div className="hidden lg:flex flex-col items-center gap-3 absolute right-8 top-1/2 -translate-y-1/2 pointer-events-auto z-20">
          {[
            { id: 0, label: '01 / RHYTHM' },
            { id: 1, label: '02 / TELEMETRY' },
            { id: 2, label: '03 / MULTI-SIGNAL' },
            { id: 3, label: '04 / ANOMALY' },
            { id: 4, label: '05 / SYNTHESIS' },
          ].map((ch) => (
            <div key={ch.id} className="flex items-center gap-3 group">
              <span className={`text-[10px] font-mono tracking-widest transition-opacity duration-300 ${
                activeChapter === ch.id ? 'opacity-100 text-[#294638] font-bold' : 'opacity-0 text-[#242923]/40'
              }`}>
                {ch.label}
              </span>
              <div
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  activeChapter === ch.id
                    ? 'w-2.5 h-2.5 bg-[#294638] ring-4 ring-[#294638]/15'
                    : 'bg-[#294638]/20 group-hover:bg-[#294638]/50'
                }`}
              />
            </div>
          ))}
        </div>

        {/* 3D Wrist and Smartwatch Canvas Scene */}
        <div
          className="absolute inset-0 transition-opacity duration-300"
          style={{
            opacity: scrollProgress > 0.88 ? Math.max(0, 1 - (scrollProgress - 0.88) / 0.08) : 1,
          }}
        >

          <WristWatchScene
            heartRate={currentReading.heartRate}
            spO2={currentReading.spO2}
            isAnomaly={activeAnomaly !== null || activeChapter === 3}
            scrollProgress={scrollProgress}
            sectionIndex={activeChapter}
          />
        </div>
      </div>

      {/* ========================================================= */}
      {/* SCROLL-DRIVEN CONTENT SECTIONS (Scrollable overlay text)  */}
      {/* ========================================================= */}
      <div className="relative z-20 -mt-[100vh]">
        {/* ------------------------------------------------------- */}
        {/* HERO SECTION: "Your body has a rhythm. Know when it changes." */}
        {/* ------------------------------------------------------- */}
        <section className="h-screen w-full flex items-center px-6 lg:px-16 max-w-7xl mx-auto">
          <div className="w-full lg:w-1/2 flex flex-col justify-center space-y-6 pt-12">
            <div className="text-xs font-mono tracking-widest text-[#294638] font-medium">
              PULSEGUARD · WEARABLE HEALTH ANOMALY RADAR
            </div>


            <h1 className="font-editorial text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-[#242923] leading-[1.08]">
              Your body has a rhythm. <br />
              <span className="italic font-normal text-[#294638]">Know when it changes.</span>
            </h1>

            <p className="text-base sm:text-lg text-[#242923]/75 leading-relaxed max-w-xl font-light">
              Continuous multi-signal physiological telemetry calibrated against your empirical baseline. PulseGuard isolates subtle autonomic deviations before they escalate into acute clinical events.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <button
                onClick={onScrollToDashboard}
                className="px-6 py-3.5 rounded-full bg-[#294638] text-[#F7F5EF] text-xs uppercase tracking-widest font-semibold hover:bg-[#1e342a] transition-all shadow-md active:scale-95 cursor-pointer"
              >
                Explore Live Radar
              </button>
              <div className="flex items-center gap-3 px-4 py-3 rounded-full bg-white/70 border border-[#294638]/10 text-xs font-mono text-[#242923]/70">
                <span className="text-[#294638] font-bold">14-DAY</span>
                <span>CALIBRATED BASELINE</span>
              </div>
            </div>

            {/* Scroll indicator prompt */}
            <div className="pt-10 flex items-center gap-3 text-xs font-mono text-[#242923]/50">
              <div className="w-5 h-8 rounded-full border border-[#294638]/30 flex items-start justify-center p-1">
                <div className="w-1 h-2 rounded-full bg-[#294638] animate-bounce" />
              </div>
              <span className="tracking-wider uppercase">Scroll to inspect telemetry sequence</span>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------- */}
        {/* SECTION A: "Every second leaves a signal"               */}
        {/* Camera approaches wrist, watch turns forward            */}
        {/* ------------------------------------------------------- */}
        <section className="h-screen w-full flex items-center px-6 lg:px-16 max-w-7xl mx-auto">
          <div className="w-full lg:w-1/2 flex flex-col justify-center space-y-6">
            <span className="text-xs font-mono tracking-widest uppercase text-[#294638] font-semibold">
              01 / Continuous Signal Stream
            </span>

            <h2 className="font-editorial text-4xl sm:text-5xl lg:text-6xl font-bold text-[#242923] leading-tight">
              Every second <br />
              <span className="italic font-normal text-[#294638]">leaves a signal.</span>
            </h2>

            <p className="text-base text-[#242923]/75 leading-relaxed max-w-md">
              Medical grade photoplethysmography captures micro-vascular volume fluctuations at 50Hz. Every pulse wave is reconstructed into instantaneous beat-to-beat intervals, mapping vascular compliance and autonomic tone in real time.
            </p>

            <div className="grid grid-cols-2 gap-4 pt-2 max-w-md">
              <div className="p-4 rounded-2xl bg-white/80 border border-[#294638]/10">
                <span className="text-xs font-mono uppercase text-[#242923]/50 block">Sampling Frequency</span>
                <span className="text-xl font-editorial font-bold text-[#294638]">50 Hz</span>
                <span className="text-[11px] text-[#242923]/60 block mt-0.5">High-fidelity optical pulse</span>
              </div>
              <div className="p-4 rounded-2xl bg-white/80 border border-[#294638]/10">
                <span className="text-xs font-mono uppercase text-[#242923]/50 block">Instantaneous BPM</span>
                <span className="text-xl font-editorial font-bold text-[#242923] font-mono-numbers">
                  {currentReading.heartRate}
                </span>
                <span className="text-[11px] text-[#242923]/60 block mt-0.5">Live sensor packet</span>
              </div>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------- */}
        {/* SECTION B: "One reading never tells the whole story"    */}
        {/* Camera moves to 3/4 angle, fine line annotations appear */}
        {/* ------------------------------------------------------- */}
        <section className="h-screen w-full flex items-center px-6 lg:px-16 max-w-7xl mx-auto">
          <div className="w-full lg:w-1/2 ml-auto flex flex-col justify-center space-y-6">
            <span className="text-xs font-mono tracking-widest uppercase text-[#294638] font-semibold">
              02 / Contextual Multi-Signal Matrix
            </span>

            <h2 className="font-editorial text-4xl sm:text-5xl lg:text-6xl font-bold text-[#242923] leading-tight">
              One reading never tells <br />
              <span className="italic font-normal text-[#294638]">the whole story.</span>
            </h2>

            <p className="text-base text-[#242923]/75 leading-relaxed max-w-lg">
              A 115 BPM heart rate is healthy during an uphill stride, but concerning while sleeping. PulseGuard correlates cardiovascular cadence with kinetic accelerometry, peripheral oxygen saturation, and skin temperature.
            </p>

            {/* Restrained annotations with fine connecting lines */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="p-3.5 rounded-xl bg-white/90 border border-[#294638]/12 relative">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-mono uppercase text-[#242923]/60 flex items-center gap-1.5">
                    <Heart className="w-3.5 h-3.5 text-[#294638]" /> Heart Rate
                  </span>
                  <span className="text-xs font-mono font-bold text-[#294638]">{currentReading.heartRate} BPM</span>
                </div>
                <p className="text-[11px] text-[#242923]/60">Normal resting envelope: 58 – 76 BPM</p>
              </div>

              <div className="p-3.5 rounded-xl bg-white/90 border border-[#294638]/12 relative">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-mono uppercase text-[#242923]/60 flex items-center gap-1.5">
                    <Wind className="w-3.5 h-3.5 text-[#294638]" /> Blood Oxygen (SpO₂)
                  </span>
                  <span className="text-xs font-mono font-bold text-[#294638]">{currentReading.spO2}%</span>
                </div>
                <p className="text-[11px] text-[#242923]/60">Baseline saturation: 96.5% – 99.5%</p>
              </div>

              <div className="p-3.5 rounded-xl bg-white/90 border border-[#294638]/12 relative">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-mono uppercase text-[#242923]/60 flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-[#294638]" /> Activity State
                  </span>
                  <span className="text-xs font-mono font-bold text-[#294638]">{currentReading.activity}</span>
                </div>
                <p className="text-[11px] text-[#242923]/60">3-Axis IMU confirms zero physical exertion</p>
              </div>

              <div className="p-3.5 rounded-xl bg-white/90 border border-[#294638]/12 relative">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-mono uppercase text-[#242923]/60 flex items-center gap-1.5">
                    <Thermometer className="w-3.5 h-3.5 text-[#294638]" /> Skin Temperature
                  </span>
                  <span className="text-xs font-mono font-bold text-[#294638]">{currentReading.skinTemp}°C</span>
                </div>
                <p className="text-[11px] text-[#242923]/60">Calibrated circadian norm: 36.6°C</p>
              </div>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------- */}
        {/* SECTION C: "Notice what changes"                        */}
        {/* Waveform alters, screen glows tasteful coral            */}
        {/* ------------------------------------------------------- */}
        <section className="h-screen w-full flex items-center px-6 lg:px-16 max-w-7xl mx-auto">
          <div className="w-full lg:w-1/2 flex flex-col justify-center space-y-6">
            <span className="text-xs font-mono tracking-widest uppercase text-[#E76F51] font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4" /> 03 / Baseline Anomaly Recognition
            </span>

            <h2 className="font-editorial text-4xl sm:text-5xl lg:text-6xl font-bold text-[#242923] leading-tight">
              Notice what <br />
              <span className="italic font-normal text-[#E76F51]">changes.</span>
            </h2>

            <p className="text-base text-[#242923]/75 leading-relaxed max-w-lg">
              When heart rate surges to 114 BPM without physical movement, PulseGuard applies temporal persistence filters. Transient blips are discarded; sustained multi-signal shifts trigger a structured, explainable clinical alert.
            </p>

            {/* Interactive demo trigger buttons inside the narrative */}
            <div className="p-5 rounded-2xl bg-white/90 border border-[#E76F51]/30 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase text-[#242923]/70 font-semibold">
                  Live Anomaly Engine Sandbox
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-semibold ${
                  activeAnomaly ? 'bg-[#E76F51]/15 text-[#E76F51]' : 'bg-[#294638]/10 text-[#294638]'
                }`}>
                  {activeAnomaly ? 'STATE: ALERT FLAGGED' : 'STATE: NOMINAL'}
                </span>
              </div>

              <p className="text-xs text-[#242923]/60">
                Experience how the 3D watch dial, waveform frequency, and telemetry pipeline instantly respond to an injected physiological anomaly.
              </p>

              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={triggerTestAnomaly}
                  className="px-4 py-2 rounded-xl bg-[#E76F51] text-white text-xs font-semibold hover:bg-[#d65f42] transition-colors cursor-pointer active:scale-95 shadow-sm"
                >
                  Trigger Test Anomaly
                </button>
                <button
                  onClick={restoreNormalReadings}
                  className="px-4 py-2 rounded-xl bg-[#E6E8DC] text-[#294638] text-xs font-semibold hover:bg-[#d8dbcb] transition-colors cursor-pointer active:scale-95"
                >
                  Restore Baseline
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------- */}
        {/* SECTION D: "From raw readings to meaningful alerts"     */}
        {/* Camera pulls back, seamless transition to dashboard    */}
        {/* ------------------------------------------------------- */}
        <section className="h-screen w-full flex items-center px-6 lg:px-16 max-w-7xl mx-auto">
          <div className="w-full lg:w-1/2 flex flex-col justify-center space-y-6">
            <span className="text-xs font-mono tracking-widest uppercase text-[#294638] font-semibold">
              04 / Explainable Decision Support
            </span>

            <h2 className="font-editorial text-4xl sm:text-5xl lg:text-6xl font-bold text-[#242923] leading-tight">
              From raw readings to <br />
              <span className="italic font-normal text-[#294638]">meaningful alerts.</span>
            </h2>

            <p className="text-base text-[#242923]/75 leading-relaxed max-w-lg">
              PulseGuard transforms confusing raw sensor waveforms into actionable, medically grounded intelligence. No black boxes. Every flagged deviation includes its contributing signals, duration, and patient-ready triage summaries.
            </p>

            <div className="pt-2">
              <button
                onClick={onScrollToDashboard}
                className="inline-flex items-center gap-3 px-6 py-3.5 rounded-full bg-[#294638] text-[#F7F5EF] text-xs uppercase tracking-widest font-semibold hover:bg-[#1e342a] transition-all shadow-lg active:scale-95 cursor-pointer"
              >
                <span>Enter Monitoring Dashboard</span>
                <ArrowDown className="w-4 h-4 animate-bounce" />
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
