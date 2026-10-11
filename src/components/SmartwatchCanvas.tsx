import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface SmartwatchCanvasProps {
  scrollProgress: number; // 0 to 1
  stage: number; // 1 to 7
  onLoaded?: () => void;
  isEmergencyOverride?: boolean;
}

export const SmartwatchCanvas: React.FC<SmartwatchCanvasProps> = ({
  scrollProgress,
  stage: _stage,
  onLoaded,
  isEmergencyOverride = false
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const watchGroupRef = useRef<THREE.Group | null>(null);
  const crownRef = useRef<THREE.Group | null>(null);
  const ppgLedsRef = useRef<THREE.Mesh[]>([]);
  const particlesRef = useRef<THREE.Points | null>(null);
  const scanRingRef = useRef<THREE.Mesh | null>(null);
  const floatingRingsRef = useRef<THREE.Group | null>(null);
  
  // Lights
  const keyLightRef = useRef<THREE.DirectionalLight | null>(null);
  const rimLightRef = useRef<THREE.PointLight | null>(null);
  const emergencyLightRef = useRef<THREE.PointLight | null>(null);

  // Screen Canvas Texture
  const screenCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const screenTextureRef = useRef<THREE.CanvasTexture | null>(null);

  // Animation state
  const ecgHistoryRef = useRef<number[]>([]);
  const lastEcgTimeRef = useRef<number>(0);
  const beatPhaseRef = useRef<number>(0);
  const animFrameIdRef = useRef<number | null>(null);

  // Target values for smooth interpolation
  const currentRotRef = useRef({ x: 0, y: 0, z: 0 });
  const currentPosRef = useRef({ x: 0, y: 0, z: 0 });
  const currentCamRef = useRef({ x: 0, y: 0, z: 8.5, fov: 45 });
  const currentScaleRef = useRef(1);

  // Initialize Screen Canvas
  const initScreenCanvas = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    screenCanvasRef.current = canvas;
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    screenTextureRef.current = texture;

    // Pre-populate ECG buffer
    const buffer: number[] = [];
    for (let i = 0; i < 180; i++) {
      buffer.push(0);
    }
    ecgHistoryRef.current = buffer;
  };

  // Draw OLED screen frame
  const drawScreen = (time: number, progress: number, isEmergency: boolean) => {
    const canvas = screenCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const radius = 420;

    // Clear background
    ctx.fillStyle = '#020408';
    ctx.fillRect(0, 0, w, h);

    // Bezel shadow & outer boundary
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.clip();

    // Background radial ambient
    const bgGrad = ctx.createRadialGradient(cx, cy, 50, cx, cy, radius);
    if (isEmergency) {
      bgGrad.addColorStop(0, '#2d060a');
      bgGrad.addColorStop(0.6, '#180306');
      bgGrad.addColorStop(1, '#080102');
    } else if (progress < 0.2) {
      bgGrad.addColorStop(0, '#0a101a');
      bgGrad.addColorStop(1, '#020408');
    } else {
      bgGrad.addColorStop(0, '#041d29');
      bgGrad.addColorStop(0.7, '#020b12');
      bgGrad.addColorStop(1, '#010408');
    }
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Subtle circular radar grid
    ctx.strokeStyle = isEmergency ? 'rgba(239, 68, 68, 0.12)' : 'rgba(0, 245, 255, 0.08)';
    ctx.lineWidth = 1.5;
    for (let r = 100; r <= radius - 40; r += 70) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Outer ticks
    ctx.save();
    ctx.translate(cx, cy);
    const tickCount = 60;
    for (let i = 0; i < tickCount; i++) {
      const angle = (i * Math.PI * 2) / tickCount;
      const isMajor = i % 5 === 0;
      const tickLen = isMajor ? 16 : 8;
      const rInner = radius - 24 - tickLen;
      const rOuter = radius - 24;

      ctx.strokeStyle = isEmergency
        ? (isMajor ? 'rgba(239, 68, 68, 0.8)' : 'rgba(239, 68, 68, 0.3)')
        : (isMajor ? 'rgba(0, 245, 255, 0.7)' : 'rgba(0, 245, 255, 0.2)');
      ctx.lineWidth = isMajor ? 3 : 1.5;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * rInner, Math.sin(angle) * rInner);
      ctx.lineTo(Math.cos(angle) * rOuter, Math.sin(angle) * rOuter);
      ctx.stroke();
    }
    ctx.restore();

    // Radar Sweep Line (Rotating during active stages)
    if (progress >= 0.25) {
      const sweepAngle = time * 2.2;
      ctx.save();
      ctx.translate(cx, cy);
      const sweepGrad = ctx.createLinearGradient(0, 0, Math.cos(sweepAngle) * radius, Math.sin(sweepAngle) * radius);
      sweepGrad.addColorStop(0, 'rgba(0,0,0,0)');
      sweepGrad.addColorStop(1, isEmergency ? 'rgba(239, 68, 68, 0.35)' : 'rgba(0, 245, 255, 0.3)');

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, radius - 30, sweepAngle - 0.45, sweepAngle);
      ctx.closePath();
      ctx.fillStyle = sweepGrad;
      ctx.fill();
      ctx.restore();
    }

    // Determine Metrics based on stage / emergency
    const bpm = isEmergency ? 168 : Math.round(72 + Math.sin(time * 0.8) * 4);
    const spo2 = isEmergency ? 88 : 99;
    const temp = isEmergency ? 38.6 : 36.8;
    const hrv = isEmergency ? 22 : 68;

    // STAGE 01 - 02: IDLE CLOCK
    if (progress < 0.26 && !isEmergency) {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const mins = String(now.getMinutes()).padStart(2, '0');
      const secs = String(now.getSeconds()).padStart(2, '0');

      ctx.textAlign = 'center';
      ctx.fillStyle = '#f8fafc';
      ctx.font = '700 130px "Space Grotesk", sans-serif';
      ctx.fillText(`${hours}:${mins}`, cx, cy + 20);

      ctx.fillStyle = 'rgba(0, 245, 255, 0.8)';
      ctx.font = '600 36px "JetBrains Mono", monospace';
      ctx.fillText(`:${secs}  SEC`, cx, cy + 90);

      ctx.fillStyle = 'rgba(148, 163, 184, 0.6)';
      ctx.font = '500 24px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('VITALRADAR AI // STANDBY', cx, cy - 90);

      // Battery & connection
      ctx.fillStyle = 'rgba(0, 245, 255, 0.6)';
      ctx.font = '500 20px "JetBrains Mono", monospace';
      ctx.fillText('BATTERY 94% • LINK OK', cx, cy + 180);
    } else {
      // ACTIVE STAGES (03 to 07): LIVE BIOMETRICS & ECG
      // Top Status Bar
      ctx.textAlign = 'center';
      ctx.fillStyle = isEmergency ? '#ef4444' : '#00f5ff';
      ctx.font = '700 24px "JetBrains Mono", monospace';
      ctx.fillText(
        isEmergency ? '⚠ CRITICAL TACHYCARDIA DETECTED' : '● VITALRADAR AI — REAL-TIME SENTINEL',
        cx,
        cy - 240
      );

      // Main Heart Rate Display
      ctx.font = '800 118px "Space Grotesk", sans-serif';
      ctx.fillStyle = isEmergency ? '#ff2a5f' : '#ffffff';
      ctx.shadowColor = isEmergency ? '#ef4444' : '#00f5ff';
      ctx.shadowBlur = isEmergency ? 30 : 15;
      ctx.fillText(`${bpm}`, cx - 40, cy - 80);
      ctx.shadowBlur = 0;

      ctx.font = '700 32px "JetBrains Mono", monospace';
      ctx.fillStyle = isEmergency ? '#ef4444' : 'rgba(0, 245, 255, 0.85)';
      ctx.fillText('BPM', cx + 90, cy - 85);

      // Heart Icon Pulsing
      const beatScale = 1 + Math.sin(time * (bpm / 60) * Math.PI * 2) * 0.18;
      ctx.save();
      ctx.translate(cx + 90, cy - 130);
      ctx.scale(beatScale, beatScale);
      ctx.fillStyle = isEmergency ? '#ef4444' : '#00f5ff';
      ctx.beginPath();
      ctx.arc(-8, -4, 8, Math.PI, 0, false);
      ctx.arc(8, -4, 8, Math.PI, 0, false);
      ctx.lineTo(0, 12);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // Real-time ECG Waveform Canvas Strip
      const ecgY = cy + 40;
      const ecgH = 120;
      const ecgW = 580;
      const ecgX = cx - ecgW / 2;

      // Draw ECG background bounding box
      ctx.fillStyle = isEmergency ? 'rgba(239, 68, 68, 0.08)' : 'rgba(0, 245, 255, 0.05)';
      ctx.strokeStyle = isEmergency ? 'rgba(239, 68, 68, 0.3)' : 'rgba(0, 245, 255, 0.2)';
      ctx.lineWidth = 1.5;
      ctx.fillRect(ecgX, ecgY - ecgH / 2, ecgW, ecgH);
      ctx.strokeRect(ecgX, ecgY - ecgH / 2, ecgW, ecgH);

      // Grid inside ECG
      ctx.strokeStyle = isEmergency ? 'rgba(239, 68, 68, 0.15)' : 'rgba(0, 245, 255, 0.1)';
      ctx.lineWidth = 1;
      for (let gx = ecgX; gx <= ecgX + ecgW; gx += 30) {
        ctx.beginPath();
        ctx.moveTo(gx, ecgY - ecgH / 2);
        ctx.lineTo(gx, ecgY + ecgH / 2);
        ctx.stroke();
      }
      for (let gy = ecgY - ecgH / 2; gy <= ecgY + ecgH / 2; gy += 25) {
        ctx.beginPath();
        ctx.moveTo(ecgX, gy);
        ctx.lineTo(ecgX + ecgW, gy);
        ctx.stroke();
      }

      // Update ECG values
      const nowMs = performance.now();
      if (nowMs - lastEcgTimeRef.current > (isEmergency ? 18 : 28)) {
        lastEcgTimeRef.current = nowMs;
        beatPhaseRef.current += isEmergency ? 0.22 : 0.12;

        let sample = 0;
        const phase = beatPhaseRef.current % (Math.PI * 2);
        if (phase < 0.2) {
          sample = Math.sin(phase * 15) * 8; // P wave
        } else if (phase > 0.4 && phase < 0.5) {
          sample = -18; // Q dip
        } else if (phase >= 0.5 && phase < 0.7) {
          sample = isEmergency ? 62 : 48; // R peak
        } else if (phase >= 0.7 && phase < 0.85) {
          sample = isEmergency ? -32 : -22; // S dip
        } else if (phase > 1.1 && phase < 1.6) {
          sample = Math.sin((phase - 1.1) * 6) * (isEmergency ? 22 : 14); // T wave
        } else {
          sample = (Math.random() - 0.5) * 4; // Baseline jitter
        }

        ecgHistoryRef.current.push(sample);
        if (ecgHistoryRef.current.length > 180) {
          ecgHistoryRef.current.shift();
        }
      }

      // Draw ECG trace line
      ctx.beginPath();
      ctx.strokeStyle = isEmergency ? '#ff2a5f' : '#00f5ff';
      ctx.lineWidth = 3.5;
      ctx.shadowColor = isEmergency ? '#ef4444' : '#00f5ff';
      ctx.shadowBlur = 12;

      const pts = ecgHistoryRef.current;
      const step = ecgW / pts.length;
      for (let i = 0; i < pts.length; i++) {
        const px = ecgX + i * step;
        const py = ecgY - pts[i];
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Bottom Biometric Gauges: SpO2, Temp, HRV
      const metrics = [
        { label: 'SpO2', val: `${spo2}%`, color: isEmergency ? '#ef4444' : '#00e5ff', warn: isEmergency },
        { label: 'TEMP', val: `${temp}°C`, color: '#38bdf8', warn: isEmergency },
        { label: 'HRV', val: `${hrv}ms`, color: isEmergency ? '#f59e0b' : '#a855f7', warn: isEmergency },
      ];

      const colW = 160;
      metrics.forEach((m, idx) => {
        const mx = cx - 180 + idx * colW;
        const my = cy + 180;

        // Metric pill card
        ctx.fillStyle = m.warn ? 'rgba(239, 68, 68, 0.15)' : 'rgba(15, 23, 42, 0.6)';
        ctx.strokeStyle = m.warn ? 'rgba(239, 68, 68, 0.5)' : 'rgba(56, 189, 248, 0.2)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(mx - 65, my - 38, 130, 80, 10);
        ctx.fill();
        ctx.stroke();

        ctx.font = '600 18px "JetBrains Mono", monospace';
        ctx.fillStyle = 'rgba(148, 163, 184, 0.9)';
        ctx.fillText(m.label, mx, my - 12);

        ctx.font = '700 32px "Space Grotesk", sans-serif';
        ctx.fillStyle = m.color;
        ctx.fillText(m.val, mx, my + 26);
      });

      // Bottom Scanning status text
      ctx.font = '600 20px "JetBrains Mono", monospace';
      ctx.fillStyle = isEmergency ? '#ef4444' : 'rgba(0, 245, 255, 0.7)';
      ctx.fillText(
        isEmergency
          ? 'EMERGENCY PROTOCOL ENGAGED // AUTONOMOUS DISPATCH'
          : 'RADAR SCAN 100% // CONTINUOUS SENTINEL',
        cx,
        cy + 270
      );
    }

    ctx.restore();

    // Mark texture as needing upload to GPU
    if (screenTextureRef.current) {
      screenTextureRef.current.needsUpdate = true;
    }
  };

  // Build 3D Watch Assembly
  const createSmartwatchMesh = (): THREE.Group => {
    const watch = new THREE.Group();

    // Materials
    // 1. Titanium Dark Chassis
    const titaniumDark = new THREE.MeshStandardMaterial({
      color: 0x181b22,
      metalness: 0.92,
      roughness: 0.26,
    });

    // 2. Titanium Chamfer / Polished Bezel
    const titaniumPolished = new THREE.MeshStandardMaterial({
      color: 0x2e3544,
      metalness: 0.96,
      roughness: 0.12,
    });

    // 3. Ceramic Back Dome
    const ceramicMat = new THREE.MeshStandardMaterial({
      color: 0x0c0e14,
      metalness: 0.2,
      roughness: 0.35,
    });

    // 4. Fluororubber Strap Material
    const strapMat = new THREE.MeshStandardMaterial({
      color: 0x111317,
      metalness: 0.08,
      roughness: 0.88,
    });

    // 5. Crown Accent Ring (Anodized Red)
    const crownAccentMat = new THREE.MeshStandardMaterial({
      color: 0xd92638,
      metalness: 0.85,
      roughness: 0.25,
    });

    // 6. Gold Charging Pins
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      metalness: 0.95,
      roughness: 0.15,
    });

    // 7. Curved Sapphire Glass (Physically Based Material)
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transmission: 0.92,
      opacity: 1,
      transparent: true,
      roughness: 0.03,
      ior: 1.54,
      reflectivity: 0.85,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
    });

    // --- CASE BODY (Rounded Cushion Cylinder) ---
    const caseRadius = 2.15;
    const caseHeight = 0.65;
    const caseGeom = new THREE.CylinderGeometry(caseRadius, caseRadius * 0.98, caseHeight, 64, 1);
    const caseMesh = new THREE.Mesh(caseGeom, titaniumDark);
    caseMesh.rotation.x = Math.PI / 2;
    watch.add(caseMesh);

    // Bezel Ring (Outer Chamfer)
    const bezelGeom = new THREE.TorusGeometry(caseRadius * 0.96, 0.12, 24, 64);
    const bezelMesh = new THREE.Mesh(bezelGeom, titaniumPolished);
    bezelMesh.position.z = caseHeight / 2 + 0.02;
    watch.add(bezelMesh);

    // Inner Screen Bezel
    const innerBezelGeom = new THREE.CylinderGeometry(caseRadius * 0.92, caseRadius * 0.92, 0.05, 64);
    const innerBezelMat = new THREE.MeshStandardMaterial({
      color: 0x05070a,
      metalness: 0.5,
      roughness: 0.7,
    });
    const innerBezelMesh = new THREE.Mesh(innerBezelGeom, innerBezelMat);
    innerBezelMesh.rotation.x = Math.PI / 2;
    innerBezelMesh.position.z = caseHeight / 2 + 0.03;
    watch.add(innerBezelMesh);

    // --- OLED SCREEN DISK ---
    const screenRadius = caseRadius * 0.88;
    const screenGeom = new THREE.CircleGeometry(screenRadius, 64);
    const screenMat = new THREE.MeshBasicMaterial({
      map: screenTextureRef.current,
      toneMapped: false,
    });
    const screenMesh = new THREE.Mesh(screenGeom, screenMat);
    screenMesh.position.z = caseHeight / 2 + 0.06;
    watch.add(screenMesh);

    // --- CURVED SAPPHIRE CRYSTAL GLASS ---
    // Slight dome cap over the screen
    const glassGeom = new THREE.CylinderGeometry(screenRadius + 0.04, screenRadius + 0.02, 0.06, 64);
    const glassMesh = new THREE.Mesh(glassGeom, glassMat);
    glassMesh.rotation.x = Math.PI / 2;
    glassMesh.position.z = caseHeight / 2 + 0.09;
    watch.add(glassMesh);

    // --- DIGITAL CROWN (Knurled Titanium on the right flank) ---
    const crownGroup = new THREE.Group();
    const crownRadius = 0.42;
    const crownLength = 0.38;

    // Crown Base
    const crownBaseGeom = new THREE.CylinderGeometry(crownRadius, crownRadius, crownLength, 32);
    const crownBaseMesh = new THREE.Mesh(crownBaseGeom, titaniumPolished);
    crownBaseMesh.rotation.z = Math.PI / 2;
    crownGroup.add(crownBaseMesh);

    // Crown Knurling Teeth (Individual ribbed ridges)
    const teethCount = 24;
    for (let i = 0; i < teethCount; i++) {
      const toothAngle = (i * Math.PI * 2) / teethCount;
      const toothGeom = new THREE.BoxGeometry(crownLength * 0.9, 0.03, 0.05);
      const toothMesh = new THREE.Mesh(toothGeom, titaniumDark);
      toothMesh.position.set(0, Math.cos(toothAngle) * (crownRadius + 0.01), Math.sin(toothAngle) * (crownRadius + 0.01));
      toothMesh.rotation.x = toothAngle;
      crownGroup.add(toothMesh);
    }

    // Crown Accent Ring (Red/Orange Groove)
    const crownRingGeom = new THREE.TorusGeometry(crownRadius * 0.95, 0.03, 16, 32);
    const crownRingMesh = new THREE.Mesh(crownRingGeom, crownAccentMat);
    crownRingMesh.rotation.y = Math.PI / 2;
    crownRingMesh.position.x = crownLength * 0.25;
    crownGroup.add(crownRingMesh);

    // Position Crown on watch
    crownGroup.position.set(caseRadius + crownLength / 2 - 0.04, 0.45, 0);
    watch.add(crownGroup);
    crownRef.current = crownGroup;

    // --- SECONDARY ACTION BUTTON (Below Crown) ---
    const buttonGeom = new THREE.BoxGeometry(0.18, 0.55, 0.22);
    const buttonMesh = new THREE.Mesh(buttonGeom, titaniumDark);
    buttonMesh.position.set(caseRadius + 0.05, -0.65, 0);
    watch.add(buttonMesh);

    // --- SPEAKER & MIC ACOUSTIC PORTS (Left Flank) ---
    for (let i = -1; i <= 1; i++) {
      const micGeom = new THREE.CylinderGeometry(0.04, 0.04, 0.1, 16);
      const micMat = new THREE.MeshBasicMaterial({ color: 0x05070a });
      const micMesh = new THREE.Mesh(micGeom, micMat);
      micMesh.rotation.z = Math.PI / 2;
      micMesh.position.set(-caseRadius + 0.02, i * 0.22, 0);
      watch.add(micMesh);
    }

    // --- CERAMIC BACK SENSOR DOME (Underneath) ---
    const backDomeGeom = new THREE.CylinderGeometry(caseRadius * 0.82, caseRadius * 0.72, 0.22, 48);
    const backDomeMesh = new THREE.Mesh(backDomeGeom, ceramicMat);
    backDomeMesh.rotation.x = Math.PI / 2;
    backDomeMesh.position.z = -caseHeight / 2 - 0.1;
    watch.add(backDomeMesh);

    // 4 Optical Green PPG Sensor LEDs
    const leds: THREE.Mesh[] = [];
    const ledDist = 0.52;
    const ledOffsets = [
      [0, ledDist],
      [0, -ledDist],
      [ledDist, 0],
      [-ledDist, 0],
    ];

    ledOffsets.forEach(([lx, ly]) => {
      const ledGeom = new THREE.CircleGeometry(0.12, 24);
      const ledMat = new THREE.MeshBasicMaterial({
        color: 0x00ff66,
      });
      const ledMesh = new THREE.Mesh(ledGeom, ledMat);
      ledMesh.position.set(lx, ly, -caseHeight / 2 - 0.215);
      ledMesh.rotation.y = Math.PI; // Face downwards
      watch.add(ledMesh);
      leds.push(ledMesh);
    });
    ppgLedsRef.current = leds;

    // 2 Gold Charging Pins
    const pinGeom = new THREE.CircleGeometry(0.06, 16);
    const pin1 = new THREE.Mesh(pinGeom, goldMat);
    pin1.position.set(0.75, 0.3, -caseHeight / 2 - 0.215);
    pin1.rotation.y = Math.PI;
    const pin2 = new THREE.Mesh(pinGeom, goldMat);
    pin2.position.set(0.75, -0.3, -caseHeight / 2 - 0.215);
    pin2.rotation.y = Math.PI;
    watch.add(pin1);
    watch.add(pin2);

    // --- WATCH STRAPS (Top & Bottom Sculpted Straps) ---
    const strapWidth = caseRadius * 1.15;
    const strapThickness = 0.22;
    const strapLength = 3.6;

    // Top Strap
    const topStrapGeom = new THREE.BoxGeometry(strapWidth, strapLength, strapThickness);
    const topStrapMesh = new THREE.Mesh(topStrapGeom, strapMat);
    topStrapMesh.position.set(0, caseRadius + strapLength / 2 - 0.25, -0.15);
    topStrapMesh.rotation.x = 0.12; // Slight ergonomic curve back
    watch.add(topStrapMesh);

    // Bottom Strap
    const btmStrapGeom = new THREE.BoxGeometry(strapWidth, strapLength, strapThickness);
    const btmStrapMesh = new THREE.Mesh(btmStrapGeom, strapMat);
    btmStrapMesh.position.set(0, -caseRadius - strapLength / 2 + 0.25, -0.15);
    btmStrapMesh.rotation.x = -0.12;
    watch.add(btmStrapMesh);

    // Strap Lugs (Metallic integrated joints)
    const lugGeom = new THREE.BoxGeometry(strapWidth * 1.04, 0.35, 0.3);
    const topLug = new THREE.Mesh(lugGeom, titaniumDark);
    topLug.position.set(0, caseRadius - 0.05, 0);
    const btmLug = new THREE.Mesh(lugGeom, titaniumDark);
    btmLug.position.set(0, -caseRadius + 0.05, 0);
    watch.add(topLug);
    watch.add(btmLug);

    // --- SCANNING LASER RING (Stage 03-05 Visual) ---
    const scanRingGeom = new THREE.TorusGeometry(caseRadius * 1.25, 0.02, 16, 64);
    const scanRingMat = new THREE.MeshBasicMaterial({
      color: 0x00f5ff,
      transparent: true,
      opacity: 0.7,
    });
    const scanRing = new THREE.Mesh(scanRingGeom, scanRingMat);
    scanRing.position.z = 0;
    watch.add(scanRing);
    scanRingRef.current = scanRing;

    // --- DETACHED FLOATING 3D HOLOGRAPHIC RINGS (Stage 05 Deep Scan) ---
    const floatingGroup = new THREE.Group();
    const ring1Geom = new THREE.TorusGeometry(screenRadius * 0.75, 0.015, 16, 64);
    const ring1Mat = new THREE.MeshBasicMaterial({
      color: 0x00f5ff,
      transparent: true,
      opacity: 0.5,
    });
    const r1 = new THREE.Mesh(ring1Geom, ring1Mat);
    r1.position.z = 0.5;

    const ring2Geom = new THREE.TorusGeometry(screenRadius * 0.5, 0.012, 16, 64);
    const ring2Mat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.4,
    });
    const r2 = new THREE.Mesh(ring2Geom, ring2Mat);
    r2.position.z = 0.85;

    floatingGroup.add(r1);
    floatingGroup.add(r2);
    watch.add(floatingGroup);
    floatingRingsRef.current = floatingGroup;

    return watch;
  };

  // Create 3D Ambient Biometric Particles
  const createParticleField = (): THREE.Points => {
    const particleCount = 1400;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    const baseColor = new THREE.Color(0x00f5ff);
    const secondColor = new THREE.Color(0x38bdf8);

    for (let i = 0; i < particleCount; i++) {
      // Cylinder / Torus distribution around watch
      const radius = 2.5 + Math.random() * 6.5;
      const angle = Math.random() * Math.PI * 2;
      const height = (Math.random() - 0.5) * 12;

      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = height;
      positions[i * 3 + 2] = Math.sin(angle) * radius;

      // Color variation
      const c = Math.random() > 0.4 ? baseColor : secondColor;
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.06,
      vertexColors: true,
      transparent: true,
      opacity: 0.65,
      blending: THREE.AdditiveBlending,
    });

    const points = new THREE.Points(geometry, material);
    return points;
  };

  // Main Scene Setup
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // 1. Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.fog = new THREE.FogExp2(0x020408, 0.055);

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0, 8.5);
    cameraRef.current = camera;

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. Lighting Rig
    // Ambient Light
    const ambientLight = new THREE.AmbientLight(0x0a101d, 1.2);
    scene.add(ambientLight);

    // Key Light (Ice Blue specular)
    const keyLight = new THREE.DirectionalLight(0x93c5fd, 2.5);
    keyLight.position.set(5, 6, 6);
    scene.add(keyLight);
    keyLightRef.current = keyLight;

    // Cool Rim Light (Electric Cyan from opposite angle)
    const rimLight = new THREE.PointLight(0x00f5ff, 4.0, 15);
    rimLight.position.set(-6, -4, 4);
    scene.add(rimLight);
    rimLightRef.current = rimLight;

    // Emergency Warning Light (Red, initially low intensity)
    const emergencyLight = new THREE.PointLight(0xef4444, 0.0, 20);
    emergencyLight.position.set(0, 0, 4);
    scene.add(emergencyLight);
    emergencyLightRef.current = emergencyLight;

    // Subtle Top Spotlight
    const spotLight = new THREE.SpotLight(0x38bdf8, 3.5, 20, Math.PI / 4, 0.5);
    spotLight.position.set(0, 8, 4);
    scene.add(spotLight);

    // 5. Initialize Canvas Texture
    initScreenCanvas();

    // 6. Build 3D Watch
    const watchMesh = createSmartwatchMesh();
    scene.add(watchMesh);
    watchGroupRef.current = watchMesh;

    // 7. Particle Field
    const particles = createParticleField();
    scene.add(particles);
    particlesRef.current = particles;

    if (onLoaded) {
      onLoaded();
    }

    // Resize Handler
    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    // Animation Loop
    let clock = new THREE.Clock();
    const animate = () => {
      animFrameIdRef.current = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Render Dynamic OLED Screen
      const isEmergency = isEmergencyOverride || scrollProgress >= 0.78;
      drawScreen(elapsedTime, scrollProgress, isEmergency);

      // Crown Rotation
      if (crownRef.current) {
        crownRef.current.rotation.x = elapsedTime * 1.5;
      }

      // Optical PPG LEDs Pulsing
      const ppgIntensity = Math.sin(elapsedTime * 6) > 0 ? 1 : 0.2;
      ppgLedsRef.current.forEach((led) => {
        (led.material as THREE.MeshBasicMaterial).color.setHex(
          isEmergency ? (ppgIntensity > 0.5 ? 0xff0044 : 0x440011) : (ppgIntensity > 0.5 ? 0x00ff66 : 0x004411)
        );
      });

      // Scanning Laser Ring Animation
      if (scanRingRef.current) {
        scanRingRef.current.position.z = Math.sin(elapsedTime * 3) * 0.45;
        scanRingRef.current.rotation.z = elapsedTime * 0.8;
        const ringOpacity = scrollProgress >= 0.25 && scrollProgress <= 0.85 ? 0.75 : 0.0;
        (scanRingRef.current.material as THREE.MeshBasicMaterial).opacity = ringOpacity;
        (scanRingRef.current.material as THREE.MeshBasicMaterial).color.setHex(isEmergency ? 0xef4444 : 0x00f5ff);
      }

      // Detached Floating Rings (Stage 05 Deep Scan)
      if (floatingRingsRef.current) {
        const floatProgress = Math.max(0, Math.min(1, (scrollProgress - 0.6) / 0.18));
        floatingRingsRef.current.position.z = floatProgress * 0.8;
        floatingRingsRef.current.rotation.z = elapsedTime * 0.4;
      }

      // Animate Particle Cloud
      if (particlesRef.current) {
        particlesRef.current.rotation.y = elapsedTime * 0.05;
        const geom = particlesRef.current.geometry;
        const posAttr = geom.getAttribute('position') as THREE.BufferAttribute;
        const colorAttr = geom.getAttribute('color') as THREE.BufferAttribute;
        const pulse = Math.sin(elapsedTime * 4) * 0.05;

        for (let i = 0; i < posAttr.count; i += 4) {
          posAttr.setY(i, posAttr.getY(i) + Math.sin(elapsedTime + i) * 0.003 + pulse * 0.01);
          if (isEmergency) {
            colorAttr.setXYZ(i, 0.95, 0.15, 0.25);
          } else {
            colorAttr.setXYZ(i, 0.0, 0.96, 1.0);
          }
        }
        posAttr.needsUpdate = true;
        colorAttr.needsUpdate = true;
      }

      // Lighting Dynamics (Emergency Transition)
      if (emergencyLightRef.current && rimLightRef.current) {
        if (isEmergency) {
          const alertPulse = (Math.sin(elapsedTime * 8) + 1) * 3.5;
          emergencyLightRef.current.intensity = alertPulse;
          rimLightRef.current.color.setHex(0xff2244);
          scene.fog!.color.setHex(0x140204);
        } else {
          emergencyLightRef.current.intensity = 0.0;
          rimLightRef.current.color.setHex(0x00f5ff);
          scene.fog!.color.setHex(0x020408);
        }
      }

      // Smooth Lerping of Watch & Camera based on calculated targets
      if (watchGroupRef.current && cameraRef.current) {
        // Linear interpolation towards current targets
        const lerpFactor = 0.08;
        watchGroupRef.current.rotation.x += (currentRotRef.current.x - watchGroupRef.current.rotation.x) * lerpFactor;
        watchGroupRef.current.rotation.y += (currentRotRef.current.y - watchGroupRef.current.rotation.y) * lerpFactor;
        watchGroupRef.current.rotation.z += (currentRotRef.current.z - watchGroupRef.current.rotation.z) * lerpFactor;

        watchGroupRef.current.position.x += (currentPosRef.current.x - watchGroupRef.current.position.x) * lerpFactor;
        watchGroupRef.current.position.y += (currentPosRef.current.y - watchGroupRef.current.position.y) * lerpFactor;
        watchGroupRef.current.position.z += (currentPosRef.current.z - watchGroupRef.current.position.z) * lerpFactor;

        const targetScale = currentScaleRef.current;
        watchGroupRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), lerpFactor);

        cameraRef.current.position.z += (currentCamRef.current.z - cameraRef.current.position.z) * lerpFactor;
        cameraRef.current.position.x += (currentCamRef.current.x - cameraRef.current.position.x) * lerpFactor;
        cameraRef.current.position.y += (currentCamRef.current.y - cameraRef.current.position.y) * lerpFactor;

        // Subtle floating breathing effect
        if (scrollProgress < 0.9) {
          watchGroupRef.current.position.y += Math.sin(elapsedTime * 1.5) * 0.003;
          watchGroupRef.current.rotation.z += Math.cos(elapsedTime * 1.2) * 0.002;
        }
      }

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animFrameIdRef.current) {
        cancelAnimationFrame(animFrameIdRef.current);
      }
      renderer.dispose();
      container.innerHTML = '';
    };
  }, []);

  // Coordinated Timeline Target Calculations driven by scrollProgress (0 to 1)
  useEffect(() => {
    // 7-Stage Coordinate System:
    // STAGE 01 (0.00 - 0.12): DARKNESS & SLOW APPROACH
    // STAGE 02 (0.12 - 0.28): WATCH REVEAL (Angled metallic view)
    // STAGE 03 (0.28 - 0.45): HEALTH ACTIVATION (Face turning towards camera)
    // STAGE 04 (0.45 - 0.62): SCROLL TRANSFORMATION (Side profile & crown showcase)
    // STAGE 05 (0.62 - 0.78): DEEP SCAN (Close macro zoom onto screen)
    // STAGE 06 (0.78 - 0.90): EMERGENCY EVENT (Tremor, high drama, critical alert)
    // STAGE 07 (0.90 - 1.00): ENTER THE RADAR (Massive scale expansion, entering screen)

    const p = Math.max(0, Math.min(1, scrollProgress));

    if (p <= 0.12) {
      // Stage 1: Far away, angled dramatically in deep shadow
      const t = p / 0.12;
      currentRotRef.current = { x: 0.35, y: -0.85 + t * 0.2, z: -0.15 };
      currentPosRef.current = { x: 0.2, y: -0.2, z: -3.0 + t * 1.5 };
      currentCamRef.current = { x: 0, y: 0, z: 9.0 - t * 0.8, fov: 45 };
      currentScaleRef.current = 0.85 + t * 0.15;
    } else if (p <= 0.28) {
      // Stage 2: Watch Reveal (glorious titanium highlights, 3/4 beauty angle)
      const t = (p - 0.12) / 0.16;
      currentRotRef.current = { x: 0.25 - t * 0.1, y: -0.65 + t * 0.35, z: -0.1 };
      currentPosRef.current = { x: 0.1 - t * 0.1, y: 0, z: -1.5 + t * 1.2 };
      currentCamRef.current = { x: 0, y: 0, z: 8.2 - t * 0.7, fov: 45 };
      currentScaleRef.current = 1.0 + t * 0.12;
    } else if (p <= 0.45) {
      // Stage 3: Health Activation (direct face view, screen illuminates)
      const t = (p - 0.28) / 0.17;
      currentRotRef.current = { x: 0.15 - t * 0.15, y: -0.3 + t * 0.3, z: 0 };
      currentPosRef.current = { x: 0, y: 0, z: -0.3 + t * 0.5 };
      currentCamRef.current = { x: 0, y: 0, z: 7.5 - t * 0.8, fov: 45 };
      currentScaleRef.current = 1.12 + t * 0.15;
    } else if (p <= 0.62) {
      // Stage 4: Scroll Transformation (Side profile & digital crown rotation)
      const t = (p - 0.45) / 0.17;
      // Rotates to show knurled crown and chamfer
      currentRotRef.current = { x: 0.1 + t * 0.3, y: t * 1.15, z: t * 0.25 };
      currentPosRef.current = { x: -0.4 * t, y: 0.1 * t, z: 0.2 + t * 0.4 };
      currentCamRef.current = { x: 0, y: 0, z: 6.7 - t * 0.8, fov: 45 };
      currentScaleRef.current = 1.27 + t * 0.2;
    } else if (p <= 0.78) {
      // Stage 5: Deep Scan (Macro face zoom, parallel to screen)
      const t = (p - 0.62) / 0.16;
      currentRotRef.current = { x: 0.4 - t * 0.4, y: 1.15 - t * 1.15, z: 0.25 - t * 0.25 };
      currentPosRef.current = { x: -0.4 + t * 0.4, y: 0.1 - t * 0.1, z: 0.6 + t * 0.8 };
      currentCamRef.current = { x: 0, y: 0, z: 5.9 - t * 1.2, fov: 45 };
      currentScaleRef.current = 1.47 + t * 0.35;
    } else if (p <= 0.90) {
      // Stage 6: Emergency Event (Tachycardia critical moment, intense macro)
      const t = (p - 0.78) / 0.12;
      const tremor = (Math.random() - 0.5) * 0.04;
      currentRotRef.current = { x: tremor, y: tremor, z: tremor };
      currentPosRef.current = { x: 0, y: 0, z: 1.4 + t * 0.8 };
      currentCamRef.current = { x: 0, y: 0, z: 4.7 - t * 0.9, fov: 45 };
      currentScaleRef.current = 1.82 + t * 0.55;
    } else {
      // Stage 7: Enter The Radar (Expands full viewport, transitioning into dashboard)
      const t = (p - 0.90) / 0.10;
      currentRotRef.current = { x: 0, y: 0, z: 0 };
      currentPosRef.current = { x: 0, y: 0, z: 2.2 + t * 3.8 };
      currentCamRef.current = { x: 0, y: 0, z: 3.8 - t * 1.6, fov: 45 };
      currentScaleRef.current = 2.37 + t * 4.5; // Expands dramatically through viewport
    }
  }, [scrollProgress]);

  return (
    <div
      ref={containerRef}
      className="smartwatch-canvas-container"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 10,
      }}
    />
  );
};
