import React from 'react';
import { Volume2, VolumeX, Radio, Compass, ShieldCheck } from 'lucide-react';

interface NavigationHeaderProps {
  currentStage: number;
  totalStages: number;
  isMuted: boolean;
  onToggleSound: () => void;
  onSelectStage: (stage: number) => void;
  onJumpToDashboard: () => void;
}

export const NavigationHeader: React.FC<NavigationHeaderProps> = ({
  currentStage,
  totalStages,
  isMuted,
  onToggleSound,
  onSelectStage,
  onJumpToDashboard,
}) => {
  return (
    <header className="site-header">
      <div className="header-inner">
        {/* Brand Wordmark */}
        <div className="brand-group" onClick={() => onSelectStage(1)} style={{ cursor: 'pointer' }}>
          <div className="brand-logo-icon">
            <Radio size={18} className="text-cyan brand-pulse" />
          </div>
          <div className="brand-titles">
            <span className="brand-name font-display">VITALRADAR <span className="text-cyan">AI</span></span>
            <span className="brand-sub font-mono">SENTINEL-X9</span>
          </div>
        </div>

        {/* Stage Stepper Navigation */}
        <nav className="stage-nav-pill">
          {Array.from({ length: totalStages }).map((_, i) => {
            const stageNum = i + 1;
            const isActive = currentStage === stageNum;
            const isPast = currentStage > stageNum;
            return (
              <button
                key={stageNum}
                onClick={() => onSelectStage(stageNum)}
                className={`stage-step-btn ${isActive ? 'active' : ''} ${isPast ? 'past' : ''}`}
                title={`Jump to Stage 0${stageNum}`}
              >
                <span className="step-num font-mono">0{stageNum}</span>
                <span className="step-dot" />
              </button>
            );
          })}
        </nav>

        {/* Right Action Controls */}
        <div className="header-actions">
          {/* System status badge */}
          <div className="status-badge-pill font-mono">
            <ShieldCheck size={14} className="text-cyan" />
            <span className="hide-mobile">LINK: ENCRYPTED</span>
          </div>

          {/* Sound Synthesizer Toggle */}
          <button
            onClick={onToggleSound}
            className={`sound-toggle-btn ${!isMuted ? 'sound-active' : ''}`}
            title={isMuted ? 'Enable Biometric Heartbeat Audio' : 'Mute Sound'}
          >
            {isMuted ? <VolumeX size={17} /> : <Volume2 size={17} />}
            <span className="sound-label font-mono hide-mobile">
              {isMuted ? 'AUDIO OFF' : 'AUDIO LIVE'}
            </span>
            {!isMuted && <span className="audio-live-waves" />}
          </button>

          {/* Jump to Radar Dashboard */}
          <button
            onClick={onJumpToDashboard}
            className="cta-radar-btn font-mono"
            title="Explore Interactive Biometric Radar"
          >
            <Compass size={15} />
            <span>ENTER RADAR</span>
          </button>
        </div>
      </div>
    </header>
  );
};
