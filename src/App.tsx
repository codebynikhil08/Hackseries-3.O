import { useEffect, useRef, useState, useCallback } from 'react';
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SmartwatchCanvas } from './components/SmartwatchCanvas';
import { CinematicOverlay } from './components/CinematicOverlay';
import { NavigationHeader } from './components/NavigationHeader';
import { DashboardView } from './components/DashboardView';
import { audioEngine } from './components/AudioEngine';

gsap.registerPlugin(ScrollTrigger);

export function App() {
  const [scrollProgress, setScrollProgress] = useState(0);
  const [currentStage, setCurrentStage] = useState(1);
  const [isMuted, setIsMuted] = useState(true);
  const [isEmergencyOverride, setIsEmergencyOverride] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const heroPinRef = useRef<HTMLDivElement>(null);
  const lenisRef = useRef<Lenis | null>(null);

  // Initialize Lenis Smooth Scroll & GSAP ScrollTrigger
  useEffect(() => {
    // 1. Initialize Lenis
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      gestureOrientation: 'vertical',
      smoothWheel: true,
      wheelMultiplier: 0.9,
    });
    lenisRef.current = lenis;

    // Connect Lenis with GSAP ScrollTrigger
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => {
      lenis.raf(time * 1000);
    });
    gsap.ticker.lagSmoothing(0);

    // 2. Coordinated Master ScrollTrigger Timeline
    if (heroPinRef.current && containerRef.current) {
      const pinTrigger = ScrollTrigger.create({
        trigger: heroPinRef.current,
        start: 'top top',
        end: 'bottom bottom',
        scrub: 0.6,
        onUpdate: (self) => {
          const progress = self.progress;
          setScrollProgress(progress);

          // Determine stage (1 to 7) based on scroll progress
          let st = 1;
          if (progress < 0.12) st = 1;
          else if (progress < 0.28) st = 2;
          else if (progress < 0.45) st = 3;
          else if (progress < 0.62) st = 4;
          else if (progress < 0.78) st = 5;
          else if (progress < 0.90) st = 6;
          else st = 7;

          setCurrentStage(st);

          // Audio engine triggers
          if (progress >= 0.78) {
            audioEngine.setMode(168, true);
          } else if (progress >= 0.28) {
            audioEngine.setMode(72, false);
          } else {
            audioEngine.setMode(60, false);
          }
        },
      });

      return () => {
        pinTrigger.kill();
        lenis.destroy();
      };
    }

    return () => {
      lenis.destroy();
    };
  }, []);

  // Handle Stage Selection Navigation
  const handleSelectStage = useCallback((stage: number) => {
    if (!heroPinRef.current || !lenisRef.current) return;
    const stageTargets = [0.0, 0.05, 0.20, 0.36, 0.53, 0.70, 0.84, 0.98];
    const targetProgress = stageTargets[stage] || 0;

    const heroHeight = heroPinRef.current.offsetHeight - window.innerHeight;
    const targetScroll = targetProgress * heroHeight;

    lenisRef.current.scrollTo(targetScroll, { duration: 1.5 });
  }, []);

  // Jump to Dashboard
  const handleJumpToDashboard = useCallback(() => {
    const dashboardEl = document.getElementById('radar-dashboard');
    if (dashboardEl && lenisRef.current) {
      lenisRef.current.scrollTo(dashboardEl, { duration: 1.8 });
    }
  }, []);

  // Replay Cinematic
  const handleReplayCinematic = useCallback(() => {
    if (lenisRef.current) {
      lenisRef.current.scrollTo(0, { duration: 2.0 });
    }
  }, []);

  // Audio Toggle
  const handleToggleSound = () => {
    const nextMuted = !isMuted;
    setIsMuted(nextMuted);
    audioEngine.setMuted(nextMuted);
    if (!nextMuted) {
      audioEngine.playRadarBlip();
    }
  };

  return (
    <div className="vitalradar-app" ref={containerRef}>
      {/* Loading Overlay */}
      {!isLoaded && (
        <div className="loader-overlay font-mono">
          <div className="loader-spinner" />
          <div className="loader-title font-display">VITALRADAR AI</div>
          <div className="loader-sub">INITIALIZING 3D SPATIAL TELEMETRY...</div>
        </div>
      )}

      {/* Persistent Navigation Header */}
      <NavigationHeader
        currentStage={currentStage}
        totalStages={7}
        isMuted={isMuted}
        onToggleSound={handleToggleSound}
        onSelectStage={handleSelectStage}
        onJumpToDashboard={handleJumpToDashboard}
      />

      {/* PINNED HERO SECTION WITH 700VH SCROLL TRACK */}
      <section className="cinematic-hero-track" ref={heroPinRef}>
        <div className="sticky-viewport">
          {/* 3D Smartwatch WebGL Canvas */}
          <SmartwatchCanvas
            scrollProgress={scrollProgress}
            stage={currentStage}
            onLoaded={() => setIsLoaded(true)}
            isEmergencyOverride={isEmergencyOverride}
          />

          {/* Synchronized Editorial Text & HUD Overlay */}
          <CinematicOverlay
            scrollProgress={scrollProgress}
            stage={currentStage}
            isEmergencyOverride={isEmergencyOverride}
          />

          {/* Seamless Transition Portal Vignette into Dashboard */}
          <div
            className="stage-transition-portal"
            style={{
              opacity: Math.max(0, (scrollProgress - 0.88) / 0.12),
              pointerEvents: scrollProgress > 0.95 ? 'auto' : 'none',
            }}
          />
        </div>
      </section>

      {/* VITALRADAR AI INTERACTIVE COMMAND DASHBOARD */}
      <DashboardView
        onReplayCinematic={handleReplayCinematic}
        isEmergencyOverride={isEmergencyOverride}
        onToggleEmergency={setIsEmergencyOverride}
      />

      {/* Modern Editorial Footer */}
      <footer className="site-footer font-mono">
        <div className="footer-content">
          <div className="footer-left">
            <span className="footer-brand font-display">VITALRADAR AI</span>
            <span className="footer-meta">AUTONOMOUS BIOMETRIC MONITORING SYSTEM</span>
          </div>
          <div className="footer-center">
            <span>INSPIRED BY CINEMATIC PRODUCT EXPERIENCES • 60 FPS 3D ENGINE</span>
          </div>
          <div className="footer-right">
            <span>© 2026 VITALRADAR AI INC. ALL RIGHTS RESERVED.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
