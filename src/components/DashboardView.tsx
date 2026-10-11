import React, { useState, useEffect } from 'react';
import {
  Activity,
  Heart,
  ShieldAlert,
  Zap,
  TrendingUp,
  RotateCcw,
  AlertTriangle,
  Play,
  Pause,
  PhoneCall,
  MapPin,
  Clock,
  Sparkles
} from 'lucide-react';
import { audioEngine } from './AudioEngine';

interface DashboardViewProps {
  onReplayCinematic: () => void;
  isEmergencyOverride: boolean;
  onToggleEmergency: (isEmergency: boolean) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onReplayCinematic,
  isEmergencyOverride,
  onToggleEmergency,
}) => {
  const [simMode, setSimMode] = useState<'normal' | 'active' | 'critical'>('critical');
  const [isPlaying, setIsPlaying] = useState(true);
  const [historyPoints, setHistoryPoints] = useState<number[]>([]);
  const [lead2Points, setLead2Points] = useState<number[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date().toLocaleTimeString());

  // Simulation parameters based on simMode
  const isEmergency = isEmergencyOverride || simMode === 'critical';
  const bpm = isEmergency ? 168 : (simMode === 'active' ? 128 : 72);
  const spo2 = isEmergency ? 88 : (simMode === 'active' ? 97 : 99);
  const temp = isEmergency ? 38.6 : 36.8;
  const bp = isEmergency ? '164 / 102' : (simMode === 'active' ? '135 / 86' : '118 / 78');
  const hrv = isEmergency ? 18 : (simMode === 'active' ? 44 : 72);

  // Sync Audio Engine mode with dashboard
  useEffect(() => {
    audioEngine.setMode(bpm, isEmergency);
  }, [bpm, isEmergency]);

  // Keep time updated
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Multi-lead ECG waveform simulation loop
  useEffect(() => {
    if (!isPlaying) return;
    let phase = 0;
    const interval = setInterval(() => {
      phase += isEmergency ? 0.28 : (simMode === 'active' ? 0.22 : 0.14);

      // Lead 1 trace
      let p1 = 0;
      const mod = phase % (Math.PI * 2);
      if (mod < 0.25) p1 = Math.sin(mod * 12) * 6;
      else if (mod > 0.4 && mod < 0.5) p1 = -16;
      else if (mod >= 0.5 && mod < 0.7) p1 = isEmergency ? 58 : 44;
      else if (mod >= 0.7 && mod < 0.85) p1 = isEmergency ? -28 : -18;
      else if (mod > 1.1 && mod < 1.6) p1 = Math.sin((mod - 1.1) * 6) * (isEmergency ? 20 : 12);
      else p1 = (Math.random() - 0.5) * 3;

      // Lead 2 trace (inversion with phase offset)
      let p2 = 0;
      const mod2 = (phase + 0.4) % (Math.PI * 2);
      if (mod2 < 0.25) p2 = Math.sin(mod2 * 12) * 5;
      else if (mod2 > 0.4 && mod2 < 0.5) p2 = -12;
      else if (mod2 >= 0.5 && mod2 < 0.7) p2 = isEmergency ? 48 : 36;
      else if (mod2 >= 0.7 && mod2 < 0.85) p2 = -14;
      else if (mod2 > 1.1 && mod2 < 1.6) p2 = Math.sin((mod2 - 1.1) * 6) * 10;
      else p2 = (Math.random() - 0.5) * 2;

      setHistoryPoints((prev) => {
        const next = [...prev, p1];
        if (next.length > 100) next.shift();
        return next;
      });

      setLead2Points((prev) => {
        const next = [...prev, p2];
        if (next.length > 100) next.shift();
        return next;
      });
    }, 40);

    return () => clearInterval(interval);
  }, [isPlaying, isEmergency, simMode]);

  const handleSetSimMode = (mode: 'normal' | 'active' | 'critical') => {
    setSimMode(mode);
    onToggleEmergency(mode === 'critical');
  };

  return (
    <section className="dashboard-section" id="radar-dashboard">
      {/* Top Banner Alert Bar */}
      <div className={`dashboard-alert-banner ${isEmergency ? 'alert-critical' : 'alert-nominal'}`}>
        <div className="banner-content">
          {isEmergency ? (
            <>
              <ShieldAlert className="banner-icon-flash" size={20} />
              <span className="font-mono">
                [ALERT CODE RED]: VENTRICULAR TACHYCARDIA EPISODE CONFIRMED — AUTONOMOUS EMERGENCY DISPATCH PROTOCOL LEVEL 3 ENGAGED
              </span>
            </>
          ) : (
            <>
              <Zap className="text-cyan" size={18} />
              <span className="font-mono">
                SYSTEM NOMINAL // VITALRADAR AI SENTINEL RUNNING CONTINUOUS BIOMETRIC INFERENCE // LATENCY 1.2MS
              </span>
            </>
          )}
        </div>
        <div className="banner-actions">
          <span className="font-mono time-pill">{currentTime}</span>
        </div>
      </div>

      <div className="dashboard-grid-container">
        {/* Left Column: Multi-Lead Live ECG & Telemetry */}
        <div className="dashboard-main-col">
          {/* Main Oscilloscope Screen */}
          <div className="card dashboard-scope-card">
            <div className="card-header">
              <div className="card-title-group">
                <Activity size={18} className={isEmergency ? 'text-crimson' : 'text-cyan'} />
                <h3 className="card-title font-display">
                  MULTI-LEAD CARDIAC OSCILLOSCOPE <span className="text-muted font-mono">[LEAD I & LEAD II]</span>
                </h3>
              </div>
              <div className="scope-actions">
                <button
                  className="scope-btn"
                  onClick={() => setIsPlaying(!isPlaying)}
                  title={isPlaying ? 'Pause Feed' : 'Resume Feed'}
                >
                  {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                  <span className="font-mono">{isPlaying ? 'LIVE STREAM' : 'PAUSED'}</span>
                </button>
              </div>
            </div>

            {/* Scope Visualizer Area */}
            <div className="oscilloscope-viewport">
              <div className="oscilloscope-grid-bg" />

              {/* Lead I waveform */}
              <div className="lead-strip">
                <div className="lead-tag font-mono">LEAD I — HIGH FREQUENCY TRACE</div>
                <svg className="waveform-svg" viewBox="0 0 1000 120" preserveAspectRatio="none">
                  <path
                    d={
                      historyPoints.length > 1
                        ? historyPoints.reduce(
                            (acc, pt, idx) =>
                              `${acc} ${idx === 0 ? 'M' : 'L'} ${(idx / (historyPoints.length - 1)) * 1000} ${60 - pt}`,
                            ''
                          )
                        : 'M 0 60 L 1000 60'
                    }
                    className={`ecg-path ${isEmergency ? 'path-crimson' : 'path-cyan'}`}
                  />
                </svg>
              </div>

              {/* Lead II waveform */}
              <div className="lead-strip lead-strip-sub">
                <div className="lead-tag font-mono">LEAD II — OPTICAL PPG CONTINUOUS</div>
                <svg className="waveform-svg" viewBox="0 0 1000 100" preserveAspectRatio="none">
                  <path
                    d={
                      lead2Points.length > 1
                        ? lead2Points.reduce(
                            (acc, pt, idx) =>
                              `${acc} ${idx === 0 ? 'M' : 'L'} ${(idx / (lead2Points.length - 1)) * 1000} ${50 - pt}`,
                            ''
                          )
                        : 'M 0 50 L 1000 50'
                    }
                    className={`ecg-path ${isEmergency ? 'path-amber' : 'path-ice'}`}
                  />
                </svg>
              </div>

              {/* Scope Real-time Overlays */}
              <div className="scope-data-hud font-mono">
                <div className="hud-metric">
                  <span className="label">SAMPLING</span>
                  <span className="val">1,000 HZ</span>
                </div>
                <div className="hud-metric">
                  <span className="label">GAIN</span>
                  <span className="val">10 MM/MV</span>
                </div>
                <div className="hud-metric">
                  <span className="label">FILTER</span>
                  <span className="val">0.05-150 HZ</span>
                </div>
                <div className="hud-metric">
                  <span className="label">QTc INTERVAL</span>
                  <span className={`val ${isEmergency ? 'text-crimson' : 'text-cyan'}`}>
                    {isEmergency ? '488 MS (PROLONGED)' : '405 MS (NORMAL)'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Simulation Mode Controller Bar */}
          <div className="card sim-control-card">
            <div className="sim-control-header">
              <span className="font-mono text-muted">EXPERIENCE SIMULATION PRESETS:</span>
              <span className="font-mono status-pill-small">INTERACTIVE CONTROLS</span>
            </div>
            <div className="sim-button-group">
              <button
                className={`sim-btn ${simMode === 'normal' ? 'sim-active-btn' : ''}`}
                onClick={() => handleSetSimMode('normal')}
              >
                <div className="sim-dot dot-normal" />
                <div className="sim-text">
                  <span className="sim-title">RESTING HOMEOSTASIS</span>
                  <span className="sim-sub font-mono">72 BPM • 99% SpO2</span>
                </div>
              </button>

              <button
                className={`sim-btn ${simMode === 'active' ? 'sim-active-btn' : ''}`}
                onClick={() => handleSetSimMode('active')}
              >
                <div className="sim-dot dot-active" />
                <div className="sim-text">
                  <span className="sim-title">CARDIO WORKLOAD</span>
                  <span className="sim-sub font-mono">128 BPM • 97% SpO2</span>
                </div>
              </button>

              <button
                className={`sim-btn sim-btn-crit ${simMode === 'critical' ? 'sim-active-crit' : ''}`}
                onClick={() => handleSetSimMode('critical')}
              >
                <div className="sim-dot dot-crit" />
                <div className="sim-text">
                  <span className="sim-title">VENTRICULAR TACHYCARDIA</span>
                  <span className="sim-sub font-mono">168 BPM • 88% SpO2 (EMERGENCY)</span>
                </div>
              </button>
            </div>
          </div>

          {/* Biometrics Matrix 4-Grid */}
          <div className="biometrics-matrix-grid">
            <div className="card bio-card">
              <div className="bio-card-top">
                <Heart size={20} className={isEmergency ? 'text-crimson pulse-fast' : 'text-cyan pulse-normal'} />
                <span className="font-mono text-muted">CARDIAC VELOCITY</span>
              </div>
              <div className="bio-card-main">
                <span className={`bio-value font-display ${isEmergency ? 'text-crimson' : ''}`}>
                  {bpm}
                </span>
                <span className="bio-unit font-mono">BPM</span>
              </div>
              <div className="bio-card-bottom font-mono">
                <TrendingUp size={14} className={isEmergency ? 'text-crimson' : 'text-cyan'} />
                <span>{isEmergency ? '+96 BPM SPIKE' : 'STABLE BASELINE'}</span>
              </div>
            </div>

            <div className="card bio-card">
              <div className="bio-card-top">
                <Activity size={20} className={isEmergency ? 'text-crimson' : 'text-ice'} />
                <span className="font-mono text-muted">BLOOD OXYGEN (SpO2)</span>
              </div>
              <div className="bio-card-main">
                <span className={`bio-value font-display ${isEmergency ? 'text-crimson' : ''}`}>
                  {spo2}
                </span>
                <span className="bio-unit font-mono">%</span>
              </div>
              <div className="bio-card-bottom font-mono">
                <span>{isEmergency ? 'CRITICAL HYPOXIA DETECTED' : 'PERFUSION INDEX: 5.2%'}</span>
              </div>
            </div>

            <div className="card bio-card">
              <div className="bio-card-top">
                <Sparkles size={20} className="text-violet" />
                <span className="font-mono text-muted">ARTERIAL PRESSURE</span>
              </div>
              <div className="bio-card-main">
                <span className="bio-value font-display">{bp}</span>
                <span className="bio-unit font-mono">MMHG</span>
              </div>
              <div className="bio-card-bottom font-mono">
                <span>{isEmergency ? `HYPERTENSIVE CRISIS // TEMP: ${temp}°C` : `NORMATIVE // TEMP: ${temp}°C`}</span>
              </div>
            </div>

            <div className="card bio-card">
              <div className="bio-card-top">
                <Zap size={20} className="text-amber" />
                <span className="font-mono text-muted">HRV VARIABILITY</span>
              </div>
              <div className="bio-card-main">
                <span className="bio-value font-display">{hrv}</span>
                <span className="bio-unit font-mono">MS</span>
              </div>
              <div className="bio-card-bottom font-mono">
                <span>{isEmergency ? 'AUTONOMIC COLLAPSE' : 'HEALTHY PARASYMPATHETIC'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: AI Triage Diagnostics & Autonomous Protocol */}
        <div className="dashboard-side-col">
          {/* AI Neural Engine Card */}
          <div className="card neural-engine-card">
            <div className="card-header">
              <div className="card-title-group">
                <Zap size={18} className="text-cyan" />
                <h3 className="card-title font-display">AI INFERENCE ENGINE</h3>
              </div>
              <span className="neural-tag font-mono">v4.2 ULTRA-LOW LATENCY</span>
            </div>

            <div className="neural-confidence-box">
              <div className="conf-top font-mono">
                <span>DIAGNOSTIC CERTAINTY</span>
                <span className={isEmergency ? 'text-crimson font-bold' : 'text-cyan font-bold'}>
                  {isEmergency ? '98.7% CONFIDENCE' : '99.4% NORMAL'}
                </span>
              </div>
              <div className="conf-progress-track">
                <div
                  className={`conf-progress-fill ${isEmergency ? 'fill-crimson' : 'fill-cyan'}`}
                  style={{ width: isEmergency ? '98.7%' : '99.4%' }}
                />
              </div>
            </div>

            <div className="neural-classification-list">
              <div className={`class-item ${isEmergency ? 'class-item-alert' : ''}`}>
                <div className="class-name font-mono">
                  {isEmergency ? 'VENTRICULAR TACHYCARDIA' : 'NORMAL SINUS RHYTHM'}
                </div>
                <div className="class-sub font-mono">
                  {isEmergency ? 'QRS COMPLEX WIDENING > 140MS' : 'ISOELECTRIC BASELINE UNIFORM'}
                </div>
              </div>
              <div className="class-item">
                <div className="class-name font-mono">MICRO-ISCHEMIA PREDICTOR</div>
                <div className="class-sub font-mono">
                  {isEmergency ? 'ELEVATED ST-SEGMENT DETECTED' : 'NO ANOMALOUS ST-DEPRESSION'}
                </div>
              </div>
            </div>
          </div>

          {/* Autonomous Protocol Timeline Card */}
          <div className="card triage-card">
            <div className="card-header">
              <div className="card-title-group">
                <AlertTriangle size={18} className={isEmergency ? 'text-crimson' : 'text-cyan'} />
                <h3 className="card-title font-display">AUTONOMOUS TRIAGE</h3>
              </div>
              <span className={`status-pill ${isEmergency ? 'pill-alert' : 'pill-standby'} font-mono`}>
                {isEmergency ? 'DISPATCH ACTIVE' : 'SENTINEL STANDBY'}
              </span>
            </div>

            <div className="triage-steps-timeline font-mono">
              <div className="triage-step complete">
                <div className="step-icon-circle"><Clock size={12} /></div>
                <div className="step-content">
                  <div className="step-title">ANOMALY DETECTED T+0.00s</div>
                  <div className="step-desc">Morphological feature deviation tagged</div>
                </div>
              </div>

              <div className={`triage-step ${isEmergency ? 'complete' : 'pending'}`}>
                <div className="step-icon-circle"><MapPin size={12} /></div>
                <div className="step-content">
                  <div className="step-title">GPS BEACON SYNCHRONIZED T+0.82s</div>
                  <div className="step-desc">Lat: 37.7749° N, Long: 122.4194° W</div>
                </div>
              </div>

              <div className={`triage-step ${isEmergency ? 'in-progress' : 'pending'}`}>
                <div className="step-icon-circle"><PhoneCall size={12} /></div>
                <div className="step-content">
                  <div className="step-title">EMERGENCY TELEMETRY SENT T+1.44s</div>
                  <div className="step-desc">Cardiology triage & primary contact notified</div>
                </div>
              </div>
            </div>

            {/* Replay Cinematic Experience */}
            <div className="replay-box">
              <button onClick={onReplayCinematic} className="replay-cinematic-btn font-mono">
                <RotateCcw size={16} />
                <span>REPLAY 3D SMARTWATCH CINEMATIC</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
