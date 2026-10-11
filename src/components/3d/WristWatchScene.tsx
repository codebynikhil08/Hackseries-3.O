import React, { useState, useEffect, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { ContactShadows } from '@react-three/drei';
import { WristWatchModel } from './WristWatchModel';
import { Activity } from 'lucide-react';

interface WristWatchSceneProps {
  heartRate: number;
  spO2: number;
  isAnomaly: boolean;
  scrollProgress: number;
  sectionIndex: number;
}

// Fallback component if WebGL is unsupported or disabled
const WebGLFallback: React.FC<{ heartRate: number; isAnomaly: boolean }> = ({ heartRate, isAnomaly }) => (
  <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-[#F0EDE4] border border-[#294638]/15 rounded-3xl text-center">
    <div className={`w-48 h-48 rounded-full border-4 ${isAnomaly ? 'border-[#E76F51] bg-[#E76F51]/10' : 'border-[#294638] bg-[#294638]/5'} flex flex-col items-center justify-center p-4 relative shadow-2xl`}>
      <Activity className={`w-8 h-8 ${isAnomaly ? 'text-[#E76F51]' : 'text-[#294638]'} animate-pulse mb-1`} />
      <span className="text-4xl font-editorial font-bold tracking-tight text-[#242923]">
        {heartRate}
      </span>
      <span className="text-xs uppercase font-mono tracking-widest text-[#242923]/60">BPM</span>
      <div className={`mt-2 px-3 py-0.5 rounded-full text-[10px] font-semibold tracking-wider uppercase ${isAnomaly ? 'bg-[#E76F51] text-white' : 'bg-[#294638] text-[#F7F5EF]'}`}>
        {isAnomaly ? 'Anomaly' : 'Synchronized'}
      </div>
    </div>
    <p className="mt-4 text-xs font-mono text-[#242923]/50">
      WebGL hardware acceleration unavailable — running simplified telemetry rendering.
    </p>
  </div>
);

export const WristWatchScene: React.FC<WristWatchSceneProps> = ({
  heartRate,
  spO2,
  isAnomaly,
  scrollProgress,
  sectionIndex,
}) => {
  const [hasWebGL, setHasWebGL] = useState<boolean>(true);

  useEffect(() => {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) {
        setHasWebGL(false);
      }
    } catch {
      setHasWebGL(false);
    }
  }, []);

  if (!hasWebGL) {
    return <WebGLFallback heartRate={heartRate} isAnomaly={isAnomaly} />;
  }

  return (
    <div className="w-full h-full relative pointer-events-auto">
      <Canvas
        shadows
        camera={{ position: [0, 0, 4.2], fov: 42 }}
        dpr={[1, 2]}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
        }}
        className="w-full h-full"
      >
        <Suspense fallback={null}>
          {/* Studio Lights */}
          <ambientLight intensity={1.4} color="#FAF8F2" />
          
          <directionalLight
            position={[4, 6, 4]}
            intensity={2.2}
            color="#FFFFFF"
            castShadow
            shadow-mapSize={[1024, 1024]}
            shadow-bias={-0.0001}
          />
          
          {/* Sage / Emerald Rim Light from the rear to catch watch edge bevels */}
          <directionalLight
            position={[-4, 3, -3]}
            intensity={1.6}
            color="#C6D8CB"
          />

          {/* Warm Fill Light */}
          <directionalLight
            position={[0, -4, 2]}
            intensity={0.7}
            color="#FFEED9"
          />

          {/* Contact Shadows on ground plane */}
          <ContactShadows
            position={[0, -1.8, 0]}
            opacity={0.35}
            scale={8}
            blur={2.4}
            far={4}
            color="#294638"
          />

          {/* The Wrist and Smartwatch 3D Character */}
          <WristWatchModel
            heartRate={heartRate}
            spO2={spO2}
            isAnomaly={isAnomaly}
            scrollProgress={scrollProgress}
            sectionIndex={sectionIndex}
          />
        </Suspense>
      </Canvas>
    </div>
  );
};
