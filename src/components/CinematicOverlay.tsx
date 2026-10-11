import React from 'react';
import { Activity, ShieldAlert, Cpu, HeartPulse, ChevronDown, Zap } from 'lucide-react';

interface CinematicOverlayProps {
  scrollProgress: number;
  stage: number;
  isEmergencyOverride?: boolean;
}

export const CinematicOverlay: React.FC<CinematicOverlayProps> = ({
  scrollProgress,
  stage,
  isEmergencyOverride = false
}) => {
  const p = scrollProgress;
  const isEmergency = isEmergencyOverride || p >= 0.78;

  // Helper to calculate stage opacity with smooth fade-in and fade-out ramps
  const getStageOpacity = (start: number, peakStart: number, peakEnd: number, end: number) => {
    if (p < start || p > end) return 0;
    if (p < peakStart) return (p - start) / (peakStart - start);
    if (p > peakEnd) return 1 - (p - peakEnd) / (end - peakEnd);
    return 1;
  };

  const op1 = getStageOpacity(0.0, 0.02, 0.08, 0.14);
  const op2 = getStageOpacity(0.13, 0.17, 0.23, 0.29);
  const op3 = getStageOpacity(0.28, 0.33, 0.40, 0.46);
  const op4 = getStageOpacity(0.45, 0.50, 0.58, 0.63);
  const op5 = getStageOpacity(0.62, 0.67, 0.74, 0.79);
  const op6 = getStageOpacity(0.78, 0.81, 0.88, 0.92);

  // Sub-phrases for Stage 4
  const op4Sub1 = getStageOpacity(0.45, 0.47, 0.51, 0.53);
  const op4Sub2 = getStageOpacity(0.52, 0.54, 0.58, 0.60);
  const op4Sub3 = getStageOpacity(0.59, 0.61, 0.63, 0.65);

  return (
    <div className="cinematic-overlay-wrapper" aria-hidden="true">
      {/* Dynamic Ambient Background Vignette / Alarm Tint */}
      <div
        className="cinematic-ambient-vignette"
        style={{
          background: isEmergency
            ? 'radial-gradient(circle at 50% 50%, rgba(220, 38, 38, 0.16) 0%, rgba(5, 5, 10, 0.92) 85%)'
            : 'radial-gradient(circle at 50% 50%, rgba(0, 245, 255, 0.05) 0%, rgba(2, 4, 8, 0.94) 85%)',
          transition: 'background 0.6s ease',
        }}
      />

      {/* Floating HUD Telemetry Corners */}
      <div className="cinematic-hud-grid">
        <div className="hud-corner top-left">
          <span className="hud-label">COORDINATE SYSTEM</span>
          <span className="hud-value font-mono">3D_SPATIAL_ORBIT_LOCK</span>
          <div className="hud-bar"><div className="hud-bar-fill" style={{ width: `${Math.min(100, p * 100)}%` }} /></div>
        </div>

        <div className="hud-corner top-right">
          <span className="hud-label">TELEMETRY STREAM</span>
          <span className="hud-value font-mono">
            {isEmergency ? 'ERR_VENTRICULAR_ANOMALY' : 'BIO_LINK_99.98%'}
          </span>
          <span className={`status-indicator ${isEmergency ? 'status-critical' : 'status-optimal'}`} />
        </div>

        <div className="hud-corner bottom-left">
          <span className="hud-label">CURRENT PHASE</span>
          <span className="hud-stage-number font-display">
            0{stage} <span className="hud-stage-total">/ 07</span>
          </span>
          <span className="hud-stage-name font-mono">
            {stage === 1 && 'STAGE 01 — DARKNESS'}
            {stage === 2 && 'STAGE 02 — WATCH REVEAL'}
            {stage === 3 && 'STAGE 03 — HEALTH ACTIVATION'}
            {stage === 4 && 'STAGE 04 — SCROLL TRANSFORMATION'}
            {stage === 5 && 'STAGE 05 — DEEP SCAN'}
            {stage === 6 && 'STAGE 06 — EMERGENCY EVENT'}
            {stage === 7 && 'STAGE 07 — ENTER THE RADAR'}
          </span>
        </div>

        <div className="hud-corner bottom-right">
          <span className="hud-label">OPTICAL BIOSENSORS</span>
          <span className="hud-value font-mono">4X_PPG_ARRAY_ACTIVE</span>
          <div className="hud-pulse-dots">
            <span className="dot active" />
            <span className="dot active" />
            <span className="dot active" />
            <span className={`dot ${isEmergency ? 'dot-alarm' : 'active'}`} />
          </div>
        </div>
      </div>

      {/* STAGE 01: DARKNESS & WORDMARK */}
      {op1 > 0.01 && (
        <div
          className="stage-section stage-01"
          style={{ opacity: op1, transform: `translateY(${(1 - op1) * 20}px)` }}
        >
          <div className="badge-pill">
            <Zap size={14} className="text-cyan" />
            <span>AUTONOMOUS BIOMETRIC SENTINEL</span>
          </div>
          <h1 className="hero-wordmark font-display">
            VITALRADAR <span className="wordmark-highlight">AI</span>
          </h1>
          <p className="hero-tagline">
            Continuous cardiovascular surveillance engineered into aerospace-grade titanium.
          </p>
          <div className="scroll-invitation">
            <span className="scroll-text font-mono">SCROLL TO DISCOVER</span>
            <div className="scroll-chevron-bounce">
              <ChevronDown size={18} />
            </div>
          </div>
        </div>
      )}

      {/* STAGE 02: WATCH REVEAL */}
      {op2 > 0.01 && (
        <div
          className="stage-section stage-02"
          style={{ opacity: op2, transform: `translateY(${(1 - op2) * 20}px)` }}
        >
          <div className="stage-side-card left-align">
            <span className="stage-step-tag font-mono">STAGE 02 // CHASSIS ARCHITECTURE</span>
            <h2 className="stage-title font-display">
              AEROSPACE GRADE <br />
              <span className="text-cyan">DARK TITANIUM.</span>
            </h2>
            <p className="stage-desc">
              Precision-milled unibody housing with double-domed sapphire crystal. Engineered to withstand extreme physiological demands while housing medical-grade optical photoplethysmography arrays.
            </p>
            <div className="tech-specs-row font-mono">
              <div className="tech-item">
                <span className="spec-label">ALLOY</span>
                <span className="spec-val">GRADE 5 TI</span>
              </div>
              <div className="tech-item">
                <span className="spec-label">CRYSTAL</span>
                <span className="spec-val">SAPPHIRE 9H</span>
              </div>
              <div className="tech-item">
                <span className="spec-label">WATERPROOF</span>
                <span className="spec-val">100 METERS</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STAGE 03: HEALTH ACTIVATION */}
      {op3 > 0.01 && (
        <div
          className="stage-section stage-03"
          style={{ opacity: op3, transform: `translateY(${(1 - op3) * 20}px)` }}
        >
          <div className="stage-side-card right-align">
            <span className="stage-step-tag font-mono">STAGE 03 // BIOSENSOR ENGAGEMENT</span>
            <h2 className="stage-title font-display">
              REAL-TIME <br />
              <span className="text-cyan">HEMODYNAMIC RADAR.</span>
            </h2>
            <p className="stage-desc">
              Four-channel multi-spectral optical diodes awaken beneath the ceramic dome, sampling micro-capillary blood volume variations at 1,000Hz precision.
            </p>
            <div className="live-biometric-chips">
              <div className="bio-chip">
                <HeartPulse size={16} className="text-cyan" />
                <span className="font-mono">72 BPM NORMAL</span>
              </div>
              <div className="bio-chip">
                <Activity size={16} className="text-ice" />
                <span className="font-mono">SPO2 99% OPTIMAL</span>
              </div>
              <div className="bio-chip">
                <Cpu size={16} className="text-violet" />
                <span className="font-mono">HRV 68MS HOMEOSTASIS</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STAGE 04: SCROLL TRANSFORMATION */}
      {op4 > 0.01 && (
        <div className="stage-section stage-04" style={{ opacity: op4 }}>
          {op4Sub1 > 0.01 && (
            <div
              className="editorial-billboard font-display"
              style={{
                opacity: op4Sub1,
                transform: `scale(${0.9 + op4Sub1 * 0.1}) translateY(${(1 - op4Sub1) * 25}px)`,
              }}
            >
              YOUR BODY. <span className="text-cyan">IN REAL TIME.</span>
            </div>
          )}

          {op4Sub2 > 0.01 && (
            <div
              className="editorial-billboard font-display"
              style={{
                opacity: op4Sub2,
                transform: `scale(${0.9 + op4Sub2 * 0.1}) translateY(${(1 - op4Sub2) * 25}px)`,
              }}
            >
              EVERY SIGNAL <span className="text-ice">MATTERS.</span>
            </div>
          )}

          {op4Sub3 > 0.01 && (
            <div
              className="editorial-billboard font-display"
              style={{
                opacity: op4Sub3,
                transform: `scale(${0.9 + op4Sub3 * 0.1}) translateY(${(1 - op4Sub3) * 25}px)`,
              }}
            >
              DETECT THE <span className="text-violet">UNEXPECTED.</span>
            </div>
          )}
        </div>
      )}

      {/* STAGE 05: DEEP SCAN */}
      {op5 > 0.01 && (
        <div
          className="stage-section stage-05"
          style={{ opacity: op5, transform: `translateY(${(1 - op5) * 20}px)` }}
        >
          <div className="stage-side-card left-align scan-card">
            <span className="stage-step-tag font-mono">STAGE 05 // NEURAL DECOMPOSITION</span>
            <h2 className="stage-title font-display">
              DEEP CARDIAC <br />
              <span className="text-cyan">DECOMPOSITION.</span>
            </h2>
            <p className="stage-desc">
              Biometric signals decouple from the physical display into layered spatial tensors. Neural filters continuously cross-correlate ECG P-Q-R-S-T morphology against 140,000 arrhythmia patterns.
            </p>
            <div className="scan-alert-foreshadow font-mono">
              <span className="blink-dot" />
              <span>SCANNING ARTIFACT DETECTED IN VENTRICULAR REPOLARIZATION</span>
            </div>
          </div>
        </div>
      )}

      {/* STAGE 06: EMERGENCY EVENT */}
      {op6 > 0.01 && (
        <div
          className="stage-section stage-06 emergency-stage"
          style={{ opacity: op6, transform: `scale(${0.95 + op6 * 0.05})` }}
        >
          <div className="emergency-banner font-mono">
            <ShieldAlert size={20} className="emergency-icon-flash" />
            <span>CRITICAL ALERT // VENTRICULAR TACHYCARDIA // BPM 168</span>
          </div>
          <h2 className="emergency-headline font-display">
            WHEN EVERY SECOND <span className="text-crimson">MATTERS.</span>
          </h2>
          <p className="emergency-subline font-display">
            DETECT ANOMALIES BEFORE THEY GO UNNOTICED.
          </p>
          <div className="emergency-telemetry-hud font-mono">
            <div className="emergency-hud-box">
              <span className="lbl">HEART RATE</span>
              <span className="val-crit">168 BPM ▲</span>
            </div>
            <div className="emergency-hud-box">
              <span className="lbl">SPO2 OXYGEN</span>
              <span className="val-crit">88% ▼</span>
            </div>
            <div className="emergency-hud-box">
              <span className="lbl">TIME TO ARREST</span>
              <span className="val-crit">&lt; 4 MINUTES</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
