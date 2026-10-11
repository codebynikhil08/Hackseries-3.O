import * as THREE from 'three';

export class WatchDialTexture {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  public texture: THREE.CanvasTexture;
  private ecgOffset: number = 0;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 512;
    this.canvas.height = 512;
    this.ctx = this.canvas.getContext('2d')!;
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
  }

  public update(
    heartRate: number,
    spO2: number,
    isAnomaly: boolean,
    timeDelta: number
  ) {
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const cx = w / 2;
    const cy = h / 2;

    this.ecgOffset += timeDelta * (heartRate > 100 ? 180 : 110);

    // Dark OLED Face Background
    ctx.fillStyle = '#121714';
    ctx.fillRect(0, 0, w, h);

    // Subtle outer ring radar coordinate circle
    ctx.strokeStyle = isAnomaly ? 'rgba(231, 111, 81, 0.25)' : 'rgba(230, 232, 220, 0.15)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, 238, 0, Math.PI * 2);
    ctx.stroke();

    // 60-second micro tick marks around bezel
    for (let i = 0; i < 60; i++) {
      const angle = (i * Math.PI) / 30;
      const isMajor = i % 5 === 0;
      const r1 = 232;
      const r2 = isMajor ? 218 : 224;
      const x1 = cx + Math.cos(angle) * r1;
      const y1 = cy + Math.sin(angle) * r1;
      const x2 = cx + Math.cos(angle) * r2;
      const y2 = cy + Math.sin(angle) * r2;

      ctx.strokeStyle = isMajor
        ? (isAnomaly ? '#E76F51' : 'rgba(230, 232, 220, 0.6)')
        : 'rgba(230, 232, 220, 0.2)';
      ctx.lineWidth = isMajor ? 3 : 1.5;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    // Top status pill
    ctx.fillStyle = isAnomaly ? '#E76F51' : '#294638';
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(cx - 80, 56, 160, 28, 14);
    } else {
      ctx.rect(cx - 80, 56, 160, 28);
    }
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(isAnomaly ? 'ANOMALY FLAGGED' : 'RADAR ACTIVE', cx, 75);


    // Main Heart Rate Display
    ctx.fillStyle = isAnomaly ? '#E76F51' : '#F7F5EF';
    ctx.font = '600 84px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${heartRate}`, cx, 185);

    ctx.fillStyle = 'rgba(230, 232, 220, 0.7)';
    ctx.font = '500 20px system-ui, sans-serif';
    ctx.fillText('BPM', cx, 220);

    // Live continuous ECG waveform band
    const ecgY = 300;
    const ecgWidth = 340;
    const startX = cx - ecgWidth / 2;

    ctx.save();
    ctx.beginPath();
    ctx.rect(startX, ecgY - 60, ecgWidth, 120);
    ctx.clip();

    ctx.strokeStyle = isAnomaly ? '#E76F51' : '#4E876B';
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();

    const speed = this.ecgOffset;
    for (let x = 0; x <= ecgWidth; x += 3) {
      const globalX = (x + speed) % 220;
      let yOffset = 0;

      // Realistic P-Q-R-S-T heartbeat wave shape
      if (globalX >= 40 && globalX < 55) {
        yOffset = -8 * Math.sin(((globalX - 40) / 15) * Math.PI); // P wave
      } else if (globalX >= 65 && globalX < 72) {
        yOffset = 10 * ((globalX - 65) / 7); // Q wave dip
      } else if (globalX >= 72 && globalX < 84) {
        yOffset = -52 * Math.sin(((globalX - 72) / 12) * Math.PI); // R peak
      } else if (globalX >= 84 && globalX < 92) {
        yOffset = 14 * Math.sin(((globalX - 84) / 8) * Math.PI); // S wave dip
      } else if (globalX >= 115 && globalX < 140) {
        yOffset = -14 * Math.sin(((globalX - 115) / 25) * Math.PI); // T wave
      }

      const drawX = startX + x;
      const drawY = ecgY + yOffset;
      if (x === 0) {
        ctx.moveTo(drawX, drawY);
      } else {
        ctx.lineTo(drawX, drawY);
      }
    }
    ctx.stroke();
    ctx.restore();

    // Bottom telemetry sub-metrics (SpO2 & Baselines)
    ctx.fillStyle = 'rgba(230, 232, 220, 0.85)';
    ctx.font = '500 18px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`SpO₂ ${spO2}%`, cx - 110, 420);

    ctx.textAlign = 'right';
    ctx.fillText(isAnomaly ? 'Δ +36 BPM' : 'Δ NOMINAL', cx + 110, 420);

    // Micro radar pulse ring in bottom center
    const pulseRad = 10 + (Math.sin(Date.now() / 300) + 1) * 6;
    ctx.strokeStyle = isAnomaly ? 'rgba(231, 111, 81, 0.6)' : 'rgba(78, 135, 107, 0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, 448, pulseRad, 0, Math.PI * 2);
    ctx.stroke();

    this.texture.needsUpdate = true;
  }

  public dispose() {
    this.texture.dispose();
  }
}
