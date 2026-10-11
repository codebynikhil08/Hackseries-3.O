// Web Audio API Synthesizer for Biometric Radar & Heartbeat Soundscapes

class BiometricAudioEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = true;
  private initialized: boolean = false;
  private heartbeatInterval: number | null = null;
  private currentBpm: number = 72;
  private emergencyMode: boolean = false;

  public init() {
    if (this.initialized && this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.initialized = true;
    } catch {
      // Audio not supported or blocked
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (!muted && (!this.ctx || this.ctx.state === 'suspended')) {
      this.init();
      this.ctx?.resume();
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public playHeartbeat(critical: boolean = false) {
    if (this.isMuted || !this.ctx) return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }

    const now = this.ctx.currentTime;

    // First lub sound (low thump)
    const osc1 = this.ctx.createOscillator();
    const gain1 = this.ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(critical ? 110 : 85, now);
    osc1.frequency.exponentialRampToValueAtTime(critical ? 45 : 35, now + 0.12);

    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(critical ? 0.35 : 0.22, now + 0.02);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    osc1.connect(gain1);
    gain1.connect(this.ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.15);

    // Second dub sound (slightly higher and punchier)
    const osc2 = this.ctx.createOscillator();
    const gain2 = this.ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(critical ? 140 : 105, now + 0.14);
    osc2.frequency.exponentialRampToValueAtTime(critical ? 55 : 40, now + 0.25);

    gain2.gain.setValueAtTime(0, now + 0.14);
    gain2.gain.linearRampToValueAtTime(critical ? 0.28 : 0.18, now + 0.16);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    osc2.connect(gain2);
    gain2.connect(this.ctx.destination);
    osc2.start(now + 0.14);
    osc2.stop(now + 0.29);
  }

  public playRadarBlip() {
    if (this.isMuted || !this.ctx) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1420, now);
    osc.frequency.exponentialRampToValueAtTime(860, now + 0.08);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.09);
  }

  public playEmergencyAlarm() {
    if (this.isMuted || !this.ctx) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.linearRampToValueAtTime(620, now + 0.18);

    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.005, now + 0.19);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1600, now);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.2);
  }

  public setMode(bpm: number, emergency: boolean) {
    this.currentBpm = bpm;
    this.emergencyMode = emergency;

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (!this.isMuted) {
      const intervalMs = (60 / this.currentBpm) * 1000;
      this.heartbeatInterval = window.setInterval(() => {
        this.playHeartbeat(this.emergencyMode);
        if (this.emergencyMode && Math.random() > 0.4) {
          this.playEmergencyAlarm();
        }
      }, intervalMs);
    }
  }

  public stop() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }
}

export const audioEngine = new BiometricAudioEngine();
