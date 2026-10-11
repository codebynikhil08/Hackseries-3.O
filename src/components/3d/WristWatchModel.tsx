import React, { useMemo, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { WatchDialTexture } from './WatchDialTexture';

interface WristWatchModelProps {
  heartRate: number;
  spO2: number;
  isAnomaly: boolean;
  scrollProgress: number; // 0 to 1
  sectionIndex: number; // 0: Hero, 1: A, 2: B, 3: C, 4: D
}

export const WristWatchModel: React.FC<WristWatchModelProps> = ({
  heartRate,
  spO2,
  isAnomaly,
  scrollProgress: _scrollProgress,
  sectionIndex,

}) => {
  // Hierarchy:
  // outerGroupRef: Controlled strictly by scroll storytelling transforms (position, base rotation)
  // idleGroupRef: Controlled strictly by continuous subtle floating & slow idle rotation
  const outerGroupRef = useRef<THREE.Group>(null);
  const idleGroupRef = useRef<THREE.Group>(null);

  const dialTextureManager = useMemo(() => new WatchDialTexture(), []);

  useEffect(() => {
    return () => {
      dialTextureManager.dispose();
    };
  }, [dialTextureManager]);

  // Procedural Forearm Geometry (Anatomical oval cross-section running along X)
  const armGeometry = useMemo(() => {
    const geom = new THREE.CylinderGeometry(0.46, 0.58, 5.6, 36, 8);
    geom.scale(1, 1, 1.45); // Naturally wider across wrist width in Z-axis
    geom.rotateZ(Math.PI / 2); // Aligned horizontally along X-axis
    return geom;
  }, []);



  // Dial Geometry
  const dialGeometry = useMemo(() => new THREE.CircleGeometry(0.78, 64), []);

  useFrame((_, delta) => {
    // 1. Update Dial Canvas texture with live ECG and current stats
    dialTextureManager.update(heartRate, spO2, isAnomaly, delta);

    // 2. Idle Physics (Separate inner group)
    if (idleGroupRef.current) {
      const time = performance.now() * 0.001;
      // Gentle continuous floating (levitation)
      idleGroupRef.current.position.y = Math.sin(time * 1.2) * 0.08;
      idleGroupRef.current.position.x = Math.cos(time * 0.9) * 0.04;

      // Slow, elegant continuous rotation that never fights scroll
      idleGroupRef.current.rotation.y = Math.sin(time * 0.6) * 0.12;
      idleGroupRef.current.rotation.z = Math.cos(time * 0.5) * 0.05;
      idleGroupRef.current.rotation.x = Math.sin(time * 0.7) * 0.06;
    }

    // 3. Smooth Scroll-Driven Target Interpolation (Separate outer group)
    if (outerGroupRef.current) {
      // Calculate target transforms according to story section & scrollProgress
      // Section 0 (Hero): Center-right, slight 3/4 tilt
      // Section 1 (Section A - "Every second leaves a signal"): Camera approaches, watch faces forward
      // Section 2 (Section B - "One reading never tells the whole story"): 3/4 angle, angled for annotations
      // Section 3 (Section C - "Notice what changes"): Dramatic inspection tilt
      // Section 4 (Section D - "From raw readings to alerts"): Receding back to composed hero position

      let targetX = 1.35;
      let targetY = 0.0;
      let targetZ = 0.0;
      let targetRotX = 0.45;
      let targetRotY = -0.55;
      let targetRotZ = 0.15;
      let targetScale = 1.05;

      if (sectionIndex === 0) {
        // Hero: Elegant 3/4 front view showcasing the round dial, titanium bezel, and floating wrist
        targetX = 1.15;
        targetY = -0.15;
        targetZ = 0.35;
        targetRotX = 1.18;
        targetRotY = -0.32;
        targetRotZ = 0.12;
        targetScale = 1.08;
      } else if (sectionIndex === 1) {
        // Section A: Approach wrist, watch turns directly forward to reveal screen & live waveform
        targetX = 0.45;
        targetY = 0.05;
        targetZ = 1.15;
        targetRotX = 1.45;
        targetRotY = -0.12;
        targetRotZ = 0.04;
        targetScale = 1.25;
      } else if (sectionIndex === 2) {
        // Section B: 3/4 elevated perspective for multi-signal annotations
        targetX = -0.35;
        targetY = -0.18;
        targetZ = 0.65;
        targetRotX = 1.12;
        targetRotY = -0.58;
        targetRotZ = 0.22;
        targetScale = 1.12;
      } else if (sectionIndex === 3) {
        // Section C: "Notice what changes" - prominent watch display focus on the coral alert
        targetX = 0.35;
        targetY = 0.02;
        targetZ = 1.08;
        targetRotX = 1.38;
        targetRotY = -0.18;
        targetRotZ = 0.06;
        targetScale = 1.22;
      } else {
        // Section D: Pulled back hero composition transitioning to dashboard
        targetX = 1.15;
        targetY = -0.15;
        targetZ = 0.2;
        targetRotX = 1.18;
        targetRotY = -0.35;
        targetRotZ = 0.12;
        targetScale = 0.98;
      }


      // Smooth lerp for buttery transitions
      const lerpFactor = Math.min(delta * 4.5, 0.2);
      outerGroupRef.current.position.x = THREE.MathUtils.lerp(outerGroupRef.current.position.x, targetX, lerpFactor);
      outerGroupRef.current.position.y = THREE.MathUtils.lerp(outerGroupRef.current.position.y, targetY, lerpFactor);
      outerGroupRef.current.position.z = THREE.MathUtils.lerp(outerGroupRef.current.position.z, targetZ, lerpFactor);

      outerGroupRef.current.rotation.x = THREE.MathUtils.lerp(outerGroupRef.current.rotation.x, targetRotX, lerpFactor);
      outerGroupRef.current.rotation.y = THREE.MathUtils.lerp(outerGroupRef.current.rotation.y, targetRotY, lerpFactor);
      outerGroupRef.current.rotation.z = THREE.MathUtils.lerp(outerGroupRef.current.rotation.z, targetRotZ, lerpFactor);

      const currentScale = outerGroupRef.current.scale.x;
      const newScale = THREE.MathUtils.lerp(currentScale, targetScale, lerpFactor);
      outerGroupRef.current.scale.set(newScale, newScale, newScale);
    }
  });

  return (
    <group ref={outerGroupRef} position={[1.35, 0, 0]}>
      <group ref={idleGroupRef}>
        {/* ==================================================== */}
        {/* 1. REALISTIC HUMAN WRIST / FOREARM GEOMETRY          */}
        {/* ==================================================== */}
        <mesh geometry={armGeometry} position={[0, -0.60, 0]} castShadow receiveShadow>

          <meshStandardMaterial
            color="#dfbeac"
            roughness={0.62}
            metalness={0.03}
          />
        </mesh>


        {/* ==================================================== */}
        {/* 2. SMARTWATCH CHASSIS & BEZEL                        */}
        {/* ==================================================== */}
        {/* Main Titanium Watch Case */}
        <mesh position={[0, 0.05, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.96, 0.98, 0.32, 64]} />
          <meshStandardMaterial
            color={isAnomaly ? '#272d29' : '#1f2521'}
            roughness={0.28}
            metalness={0.88}
          />
        </mesh>


        {/* Inner Ceramic Bezel Rim */}
        <mesh position={[0, 0.21, 0]}>
          <cylinderGeometry args={[0.88, 0.92, 0.06, 64]} />
          <meshStandardMaterial
            color="#121714"
            roughness={0.15}
            metalness={0.4}
          />
        </mesh>

        {/* Watch Crown Dial (Side Button at 3 o'clock) */}
        <group position={[0.98, 0.05, 0]} rotation={[0, 0, Math.PI / 2]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.13, 0.13, 0.14, 24]} />
            <meshStandardMaterial
              color="#2a332c"
              roughness={0.3}
              metalness={0.9}
            />
          </mesh>
          {/* Accent knurling ring on crown */}
          <mesh position={[0, 0.04, 0]}>
            <torusGeometry args={[0.132, 0.015, 8, 24]} />
            <meshStandardMaterial
              color={isAnomaly ? '#E76F51' : '#4E876B'}
              roughness={0.2}
              metalness={0.8}
            />
          </mesh>
        </group>

        {/* Secondary Flush Button at 4 o'clock */}
        <mesh position={[0.88, 0.05, -0.42]} rotation={[0, -0.45, Math.PI / 2]}>
          <boxGeometry args={[0.08, 0.12, 0.22]} />
          <meshStandardMaterial
            color="#2a332c"
            roughness={0.35}
            metalness={0.85}
          />
        </mesh>

        {/* ==================================================== */}
        {/* 3. DYNAMIC OLED WATCH SCREEN                         */}
        {/* ==================================================== */}
        <mesh
          geometry={dialGeometry}
          position={[0, 0.245, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <meshBasicMaterial
            map={dialTextureManager.texture}
            side={THREE.DoubleSide}
            toneMapped={false}
          />
        </mesh>



        {/* ==================================================== */}
        {/* 4. OPTICAL PPG SENSOR DOME ON CASEBACK               */}
        {/* ==================================================== */}
        <mesh position={[0, -0.12, 0]}>
          <cylinderGeometry args={[0.55, 0.6, 0.06, 32]} />
          <meshStandardMaterial
            color="#0f1411"
            roughness={0.3}
            metalness={0.6}
          />
        </mesh>

        {/* Optical Sensor Green/Red Photoplethysmography LED */}
        <pointLight
          position={[0, -0.16, 0]}
          color={isAnomaly ? '#E76F51' : '#4E876B'}
          intensity={0.7}
          distance={0.8}
        />

        {/* ==================================================== */}
        {/* 5. WATCH STRAPS (WRAPPING AROUND WRIST IN Z-AXIS)    */}
        {/* ==================================================== */}
        {/* 12 o'clock Upper Strap segment (facing -Z) */}
        <mesh position={[0, -0.28, -0.68]} rotation={[-0.32, 0, 0]} castShadow>
          <boxGeometry args={[0.66, 0.12, 0.85]} />
          <meshStandardMaterial
            color="#18201a"
            roughness={0.45}
            metalness={0.15}
          />
        </mesh>

        {/* 6 o'clock Lower Strap segment (facing +Z) */}
        <mesh position={[0, -0.28, 0.68]} rotation={[0.32, 0, 0]} castShadow>
          <boxGeometry args={[0.66, 0.12, 0.85]} />
          <meshStandardMaterial
            color="#18201a"
            roughness={0.45}
            metalness={0.15}
          />
        </mesh>

        {/* Strap Under-loop closing around the wrist bottom */}
        <mesh position={[0, -1.22, 0]}>
          <boxGeometry args={[0.64, 0.1, 1.15]} />
          <meshStandardMaterial
            color="#18201a"
            roughness={0.45}
            metalness={0.15}
          />
        </mesh>

        {/* Stainless Steel Strap Buckle / Keeper Pin */}
        <mesh position={[0, -1.22, 0.15]}>
          <boxGeometry args={[0.68, 0.13, 0.16]} />
          <meshStandardMaterial
            color="#88968d"
            roughness={0.2}
            metalness={0.9}
          />
        </mesh>

      </group>
    </group>
  );
};
