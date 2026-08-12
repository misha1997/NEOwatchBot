import React, { useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { calculatePosition, getDaysSinceJ2000, scaleMoonDistance, scaleRadius } from '../../utils/orbitalMath';
import useSolarSystemStore from '../../store/solarSystemStore';
import { Html, useTexture } from '@react-three/drei';
import * as THREE from 'three';

export default function Moon({ data, isRealisticScale, showLabels, parentRadiusVisual, parentPosition, onClick }) {
  const meshRef = useRef();
  const groupRef = useRef();
  
  const [hovered, setHovered] = useState(false);
  const { camera } = useThree();
  
  const visualRadius = scaleRadius(data.radiusKm, isRealisticScale) * 0.7; // smaller moon size
  
  useFrame(() => {
    if (!groupRef.current) return;
    
    const state = useSolarSystemStore.getState();
    const daysSinceJ2000 = getDaysSinceJ2000(state.simDate);
    
    // Calculate relative position to planet
    const pos = calculatePosition(data.orbit, daysSinceJ2000);
    const dist = Math.sqrt(pos.x*pos.x + pos.y*pos.y + pos.z*pos.z);
    
    const scaledDist = scaleMoonDistance(dist, isRealisticScale, parentRadiusVisual);
    
    let x = 0, y = 0, z = 0;
    if (dist > 0) {
      x = (pos.x / dist) * scaledDist;
      y = (pos.y / dist) * scaledDist;
      z = (pos.z / dist) * scaledDist;
    }
    
    groupRef.current.position.set(x, y, z);
    
    // Moon visibility based on distance (LOD)
    if (!data.isMajor && groupRef.current) {
      const distToCamera = camera.position.distanceTo(parentPosition);
      groupRef.current.visible = distToCamera < 100;
    }
  });

  return (
    <group ref={groupRef} name={data.id}>
      <group
        onClick={(e) => { e.stopPropagation(); if(onClick) onClick(data.id); }}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
        onPointerOut={(e) => { e.stopPropagation(); setHovered(false); document.body.style.cursor = 'auto'; }}
      >
        <mesh ref={meshRef} castShadow receiveShadow>
          <sphereGeometry args={[visualRadius, 32, 32]} />
          <MoonMaterial 
            textureUrl={data.textureUrl} 
            flatTextureUrl={data.flatTextureUrl}
            color={data.color} 
            hovered={hovered} 
          />
        </mesh>
      </group>

      {showLabels && (data.isMajor || hovered) && (
        <Html distanceFactor={15} zIndexRange={[100, 0]} style={{ pointerEvents: 'none' }}>
          <div style={{
            color: 'white',
            background: 'rgba(0,0,0,0.6)',
            padding: '2px 4px',
            borderRadius: '4px',
            fontSize: '10px',
            transform: 'translate3d(10px, -10px, 0)',
            whiteSpace: 'nowrap',
            border: hovered ? `1px solid ${data.color}` : '1px solid transparent',
            fontFamily: 'Inter, sans-serif'
          }}>
            {data.name}
          </div>
        </Html>
      )}
    </group>
  );
}

// Separate component to handle conditional hook call
function MoonMaterial({ textureUrl, flatTextureUrl, color, hovered }) {
  const actualTextureUrl = flatTextureUrl || textureUrl;
  if (actualTextureUrl) {
    return <TexturedMaterial textureUrl={actualTextureUrl} hovered={hovered} color={color} />;
  }
  return (
    <meshStandardMaterial 
      color={color || '#aaaaaa'} 
      metalness={0.1} 
      roughness={0.9}
      emissive={hovered ? '#333' : '#000'}
    />
  );
}

function TexturedMaterial({ textureUrl, hovered, color, transparent = false }) {
  const texture = useTexture(textureUrl);
  return (
    <meshStandardMaterial 
      map={texture} 
      metalness={0.1} 
      roughness={0.9} 
      emissive={hovered ? '#333' : '#000'}
      transparent={transparent}
      alphaTest={transparent ? 0.1 : 0}
      side={THREE.DoubleSide}
    />
  );
}
