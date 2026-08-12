import React from 'react';
import { Stars } from '@react-three/drei';
import { EffectComposer, Bloom, ChromaticAberration, Vignette } from '@react-three/postprocessing';
import Planet from './Planet';
import OrbitLine from './OrbitLine';
import AsteroidBelt from './AsteroidBelt';
import CameraController from './CameraController';
import useSolarSystemStore from '../../store/solarSystemStore';
import planetsData from '../../data/planets.json';

export default function Scene() {
  const isRealisticScale = useSolarSystemStore(s => s.isRealisticScale);
  const showOrbits = useSolarSystemStore(s => s.showOrbits);
  const showLabels = useSolarSystemStore(s => s.showLabels);
  const setFocusedObjectId = useSolarSystemStore(s => s.setFocusedObjectId);

  return (
    <>
      <color attach="background" args={['#020202']} />
      
      {/* Lights */}
      <ambientLight intensity={0.6} />
      {/* Sun Light Source - zero decay so all planets are lit regardless of distance */}
      <pointLight 
        castShadow
        position={[0, 0, 0]} 
        intensity={3.0} 
        distance={0} 
        decay={0} 
        color="#ffffff" 
        shadow-mapSize-width={2048} 
        shadow-mapSize-height={2048} 
        shadow-bias={-0.0001}
      />
      
      {/* Background stars */}
      <Stars radius={10000} depth={2000} count={10000} factor={10} saturation={0} fade speed={0.5} />
      
      {/* Camera controls */}
      <CameraController />
      
      {/* Post-processing */}
      <EffectComposer disableNormalPass>
        <Bloom luminanceThreshold={0.5} mipmapBlur intensity={1.5} />
        <ChromaticAberration offset={[0.0005, 0.0005]} />
        <Vignette eskil={false} offset={0.1} darkness={1.1} />
      </EffectComposer>

      {/* Main Asteroid Belt */}
      <AsteroidBelt />

      {/* Render Planets and their Orbits */}
      {planetsData.map((data) => (
        <group key={data.id}>
          <Planet 
            data={data} 
            isRealisticScale={isRealisticScale} 
            showLabels={showLabels}
            showOrbits={showOrbits}
            onClick={setFocusedObjectId} 
          />
          {data.type !== 'star' && (
            <OrbitLine 
              orbit={data.orbit} 
              color={data.color} 
              isRealisticScale={isRealisticScale}
              visible={showOrbits}
            />
          )}
        </group>
      ))}
    </>
  );
}
