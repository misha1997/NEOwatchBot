import React, { useEffect, useState, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import { scaleRadius } from '../../utils/orbitalMath';
import useSolarSystemStore from '../../store/solarSystemStore';

export default function ISS({ parentRadiusVisual, showLabels, onClick }) {
  const [issData, setIssData] = useState(null);
  const [hovered, setHovered] = useState(false);
  const meshRef = useRef();
  const isRealisticScale = useSolarSystemStore(s => s.isRealisticScale);

  useEffect(() => {
    let mounted = true;
    const fetchIss = async () => {
      try {
        const res = await fetch('/api/iss/now');
        const data = await res.json();
        if (mounted && data.lat !== undefined) {
          setIssData(data);
        }
      } catch (err) {
        console.error('Failed to fetch ISS data', err);
      }
    };
    
    fetchIss();
    const interval = setInterval(fetchIss, 10000); // 10 seconds
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const targetPos = useRef(new THREE.Vector3());
  
  useFrame(() => {
    if (!meshRef.current || !issData) return;
    
    // Convert Lat/Lon/Alt to Cartesian
    const latRad = (issData.lat * Math.PI) / 180;
    const lonRad = (issData.lon * Math.PI) / 180;
    
    const altRatio = (6371 + (issData.alt || 400)) / 6371;
    const dist = isRealisticScale ? parentRadiusVisual * altRatio : parentRadiusVisual * 1.5;

    // ThreeJS coordinate mapping
    const x = dist * Math.cos(latRad) * Math.cos(lonRad);
    const y = dist * Math.sin(latRad);
    const z = -dist * Math.cos(latRad) * Math.sin(lonRad);

    targetPos.current.set(x, y, z);
    meshRef.current.position.lerp(targetPos.current, 0.05);
  });

  if (!issData) return null;

  const size = isRealisticScale ? scaleRadius(0.2, true) : 0.04;

  return (
    <group 
      ref={meshRef}
      name="iss"
      onClick={(e) => { 
        e.stopPropagation(); 
        if (onClick) onClick('iss'); 
      }}
      onPointerOver={(e) => { 
        e.stopPropagation(); 
        setHovered(true); 
        document.body.style.cursor = 'pointer'; 
      }}
      onPointerOut={(e) => { 
        e.stopPropagation(); 
        setHovered(false); 
        document.body.style.cursor = 'auto'; 
      }}
    >
      {/* Detailed Procedural ISS Model */}
      <group scale={[size*2, size*2, size*2]}>
        {/* Main Truss */}
        <mesh position={[0, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.1, 0.1, 4, 16]} />
          <meshStandardMaterial color={hovered ? "#ffffff" : "#cccccc"} metalness={0.8} roughness={0.3} />
        </mesh>
        
        {/* Central Modules */}
        <mesh position={[0, 0, 0.5]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.2, 0.2, 1.5, 16]} />
          <meshStandardMaterial color={hovered ? "#ffffff" : "#dddddd"} metalness={0.6} roughness={0.4} />
        </mesh>
        <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.15, 0.15, 2, 16]} />
          <meshStandardMaterial color={hovered ? "#ffffff" : "#eeeeee"} metalness={0.7} roughness={0.3} />
        </mesh>

        {/* Solar Arrays - Left */}
        {[ -1.5, -1.0, -0.5, 0.5, 1.0, 1.5 ].map((x, i) => (
          <React.Fragment key={i}>
            <mesh position={[x, 0, 0.5]} rotation={[0.2, 0, 0]}>
              <boxGeometry args={[0.3, 0.02, 1.2]} />
              <meshStandardMaterial color={hovered ? "#2a4b6c" : "#1a3b5c"} metalness={0.9} roughness={0.1} />
            </mesh>
            <mesh position={[x, 0, -0.5]} rotation={[-0.2, 0, 0]}>
              <boxGeometry args={[0.3, 0.02, 1.2]} />
              <meshStandardMaterial color={hovered ? "#2a4b6c" : "#1a3b5c"} metalness={0.9} roughness={0.1} />
            </mesh>
          </React.Fragment>
        ))}

        {/* Radiators */}
        <mesh position={[0, 0.8, 0]} rotation={[0, 0, 0]}>
          <boxGeometry args={[0.8, 1.5, 0.05]} />
          <meshStandardMaterial color="#ffffff" metalness={0.2} roughness={0.8} />
        </mesh>
      </group>
      
      {showLabels && (
        <Html distanceFactor={15} zIndexRange={[100, 0]} style={{ pointerEvents: 'none' }}>
          <div style={{
            color: '#fff',
            background: 'rgba(0,0,0,0.7)',
            padding: '2px 6px',
            borderRadius: '4px',
            fontSize: '10px',
            whiteSpace: 'nowrap',
            border: hovered ? '1px solid #ffffff' : '1px solid #ffcc00',
            transform: 'translate3d(10px, -10px, 0)'
          }}>
            ISS
          </div>
        </Html>
      )}
    </group>
  );
}
