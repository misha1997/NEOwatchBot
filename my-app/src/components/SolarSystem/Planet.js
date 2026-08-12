import React, { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { calculatePosition, getDaysSinceJ2000, scaleDistance, scaleRadius } from '../../utils/orbitalMath';
import useSolarSystemStore from '../../store/solarSystemStore';
import { Html, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import Ring from './Ring';
import Moon from './Moon';
import MoonOrbitLine from './MoonOrbitLine';
import NEOCloud from './NEOCloud';
import ISS from './ISS';

export default function Planet({ data, isRealisticScale, showLabels, showOrbits, onClick }) {
  const meshRef = useRef();
  const groupRef = useRef();
  const isStar = data.type === 'star';

  const [hovered, setHovered] = useState(false);
  const starTextures = useTexture(isStar ? { map: data.textureUrl } : { map: '/textures/sun.jpg' }); 
  // We load sun.jpg as a dummy for planets, but it's not used (PlanetMaterial is used instead)
  const texture = isStar ? starTextures.map : null;
  
  // Track parent position to pass to moons for LOD calculation
  const currentPos = useRef(new THREE.Vector3(0,0,0));

  useFrame(() => {
    if (!groupRef.current) return;
    
    const state = useSolarSystemStore.getState();
    const daysSinceJ2000 = getDaysSinceJ2000(state.simDate);
    
    let x = 0, y = 0, z = 0;
    
    if (!isStar) {
      const pos = calculatePosition(data.orbit, daysSinceJ2000);
      const dist = Math.sqrt(pos.x*pos.x + pos.y*pos.y + pos.z*pos.z);
      let scaledDist = scaleDistance(dist, isRealisticScale);
      
      // Ensure JWST is visible outside of Earth's enlarged radius in compact mode
      if (!isRealisticScale && data.id === 'jwst') {
        scaledDist += 2.0; // Earth's visual radius is 1.5, push JWST past it
      }
      
      if (dist > 0) {
        x = (pos.x / dist) * scaledDist;
        y = (pos.y / dist) * scaledDist;
        z = (pos.z / dist) * scaledDist;
      }
    }
    
    groupRef.current.position.set(x, y, z);
    currentPos.current.set(x, y, z); // Update tracked position for moons
    
    // Rotate the planet on its axis
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.005;
    }
  });

  const visualRadius = scaleRadius(data.radiusKm, isRealisticScale, isStar);

  return (
    <group ref={groupRef} name={data.id}>
      {data.id === 'jwst' ? (
        <group
          onClick={(e) => { e.stopPropagation(); onClick(data.id); }}
          onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
          onPointerOut={(e) => { e.stopPropagation(); setHovered(false); document.body.style.cursor = 'auto'; }}
        >
          <JWSTModel visualRadius={visualRadius} />
        </group>
      ) : (
        <mesh 
          ref={meshRef} 
          castShadow={!isStar}
          receiveShadow={!isStar}
          onClick={(e) => { e.stopPropagation(); onClick(data.id); }}
          onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
          onPointerOut={(e) => { e.stopPropagation(); setHovered(false); document.body.style.cursor = 'auto'; }}
        >
          <sphereGeometry args={[visualRadius, 64, 64]} />
          {isStar ? (
            <meshBasicMaterial map={texture} color={hovered ? '#ffffff' : data.color} />
          ) : (
            <PlanetMaterial data={data} hovered={hovered} />
          )}
        </mesh>
      )}



      {/* Earth Clouds */}
      {data.id === 'earth' && data.cloudsMap && (
        <EarthClouds visualRadius={visualRadius} cloudsMapUrl={data.cloudsMap} />
      )}

      {/* Atmosphere for Earth/Venus */}
      {(data.id === 'earth' || data.id === 'venus') && (
        <mesh>
          <sphereGeometry args={[visualRadius * 1.05, 64, 64]} />
          <meshBasicMaterial 
            color={data.id === 'earth' ? '#4facfe' : '#ffd194'}
            transparent 
            opacity={0.15} 
            blending={THREE.AdditiveBlending} 
            side={THREE.BackSide}
          />
        </mesh>
      )}

      {/* Render Ring if exists */}
      {data.ring && (
        <group rotation={[(data.ring.inclination * Math.PI) / 180, 0, 0]}>
          <Ring 
            textureUrl={data.ring.textureUrl} 
            innerRadius={visualRadius * data.ring.innerRadiusScale} 
            outerRadius={visualRadius * data.ring.outerRadiusScale} 
            color="#ffffff" 
          />
        </group>
      )}

      {/* Render Moons if any */}
      {data.moons && data.moons.map((moonData) => (
        <group key={moonData.id}>
          <Moon 
            data={moonData}
            isRealisticScale={isRealisticScale}
            showLabels={showLabels}
            parentRadiusVisual={visualRadius}
            parentPosition={currentPos.current}
            onClick={onClick}
          />
          <MoonOrbitLine 
            orbit={moonData.orbit}
            color={moonData.color}
            isRealisticScale={isRealisticScale}
            parentRadiusVisual={visualRadius}
            visible={showOrbits}
          />
        </group>
      ))}

      {/* Render NEOs and ISS around Earth */}
      {data.id === 'earth' && (
        <React.Suspense fallback={null}>
          <NEOCloud />
          <ISS parentRadiusVisual={visualRadius} showLabels={showLabels} onClick={onClick} />
        </React.Suspense>
      )}

      {/* Render Comet Tail */}
      {data.type === 'comet' && (
        <CometTail visualRadius={visualRadius} />
      )}

      {showLabels && (
        <Html distanceFactor={15} zIndexRange={[100, 0]} style={{ pointerEvents: 'none' }}>
          <div style={{
            color: 'white',
            background: 'rgba(0,0,0,0.6)',
            padding: '2px 6px',
            borderRadius: '4px',
            fontSize: '12px',
            transform: 'translate3d(-50%, -150%, 0)',
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

function PlanetMaterial({ data, hovered }) {
  // Use object syntax to safely load variable textures in a single hook call
  const textureObj = useTexture({
    map: data.textureUrl,
    ...(data.normalMap ? { normalMap: data.normalMap } : {}),
    ...(data.specularMap ? { specularMap: data.specularMap } : {})
  });
  
  const texture = textureObj.map;
  const normalMap = textureObj.normalMap || null;
  const roughnessMap = textureObj.specularMap || null;
  // Note: we use specular as roughness, so we might need to invert it in shader or just set it as metalness.
  // Actually, setting specular map as roughness map: bright = rough. Wait, specular map: bright = reflective (smooth). 
  // So using it as roughness map means bright areas become rough (not reflective), which is the opposite of what we want!
  // BUT we can use it as a metalnessMap! Bright = metallic (reflective).
  
  return (
    <meshStandardMaterial 
      map={texture}
      normalMap={normalMap}
      metalnessMap={roughnessMap}
      metalness={data.specularMap ? 0.6 : 0.1}
      roughness={data.specularMap ? 0.4 : 0.8}
      normalScale={normalMap ? new THREE.Vector2(2, 2) : new THREE.Vector2(1, 1)}
      emissive={hovered ? '#333333' : '#000000'}
      emissiveIntensity={hovered ? 0.5 : 0}
    />
  );
}

function EarthClouds({ visualRadius, cloudsMapUrl }) {
  const cloudsMap = useTexture(cloudsMapUrl);
  const meshRef = useRef();
  
  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.006; // Rotate slightly faster than earth
    }
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[visualRadius * 1.01, 64, 64]} />
      <meshStandardMaterial 
        map={cloudsMap}
        transparent={true}
        opacity={0.8}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
}

function JWSTModel({ visualRadius }) {
  const groupRef = useRef();
  
  useFrame(() => {
    if (groupRef.current) {
      // Point the Z-axis towards the Sun (0,0,0)
      groupRef.current.lookAt(0, 0, 0);
    }
  });

  // Fixed visual scale for the spacecraft so it doesn't look absurdly huge or small in compact mode
  const scale = 0.04;
  
  return (
    <group ref={groupRef} scale={[scale, scale, scale]}>
      {/* 
        Bottom of sunshield faces +Z (towards the Sun).
        We keep the group rotation at [0, 0, 0] so Z points at the sun.
      */}
      <group>
        {/* Sunshield Layers (Kite shape) */}
        {[-0.08, -0.04, 0, 0.04, 0.08].map((z, i) => (
          <mesh key={i} position={[0, 0, z]} rotation={[0, 0, Math.PI / 4]} scale={[1, 1.8, 1]}>
            <boxGeometry args={[1.5, 1.5, 0.01]} />
            <meshStandardMaterial 
              color={i === 4 ? "#ffb6c1" : "#cccccc"} 
              metalness={0.9} 
              roughness={0.2} 
            />
          </mesh>
        ))}
        
        {/* Primary Mirror (Hexagonal segments simulated by a large gold hex) */}
        <mesh position={[0, 0, -0.2]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.5, 0.5, 0.05, 6]} />
          <meshStandardMaterial color="#ffd700" metalness={1} roughness={0.1} />
        </mesh>
        
        {/* Central Instrument Module behind mirror */}
        <mesh position={[0, 0, -0.1]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.2, 0.2, 0.2, 16]} />
          <meshStandardMaterial color="#333333" metalness={0.6} roughness={0.4} />
        </mesh>
        
        {/* Secondary Mirror Support Tripod */}
        <group position={[0, 0, -0.2]} rotation={[Math.PI / 2, 0, 0]}>
          <mesh position={[0, 0.6, 0]}>
            <cylinderGeometry args={[0.02, 0.02, 1.2, 8]} />
            <meshStandardMaterial color="#555555" />
          </mesh>
          <mesh position={[0.3, 0.3, 0]} rotation={[0, 0, -Math.PI / 6]}>
            <cylinderGeometry args={[0.01, 0.01, 1.0, 8]} />
            <meshStandardMaterial color="#555555" />
          </mesh>
          <mesh position={[-0.3, 0.3, 0]} rotation={[0, 0, Math.PI / 6]}>
            <cylinderGeometry args={[0.01, 0.01, 1.0, 8]} />
            <meshStandardMaterial color="#555555" />
          </mesh>
        </group>

        {/* Secondary Mirror */}
        <mesh position={[0, 0, -0.8]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.1, 0.1, 0.02, 6]} />
          <meshStandardMaterial color="#ffd700" metalness={1} roughness={0.1} />
        </mesh>
        
        {/* Spacecraft Bus (Facing Sun) */}
        <mesh position={[0, 0, 0.25]}>
          <boxGeometry args={[0.4, 0.4, 0.3]} />
          <meshStandardMaterial color="#444444" metalness={0.8} roughness={0.4} />
        </mesh>
        
        {/* Solar Panel */}
        <mesh position={[0, 0.6, 0.25]}>
          <boxGeometry args={[0.3, 0.8, 0.05]} />
          <meshStandardMaterial color="#1a3b5c" metalness={0.9} roughness={0.1} />
        </mesh>
      </group>
    </group>
  );
}

function CometTail({ visualRadius }) {
  const groupRef = useRef();

  useFrame(({ camera }) => {
    if (groupRef.current) {
      // Look at the sun (origin) in world space
      // This makes the local Z-axis point towards the Sun
      // We want the tail to point AWAY from the sun, which is the negative Z-axis
      groupRef.current.lookAt(0, 0, 0);
    }
  });

  const tailLength = visualRadius * 15;
  const tailWidth = visualRadius * 2;

  return (
    <group ref={groupRef}>
      {/* 
        Cone default points along Y axis.
        We rotate it so its tip points towards +Z (towards the Sun) 
        and the base points towards -Z (away from the Sun).
        Actually, we want the wide part away from the sun, so the tip is at the comet.
        ConeGeometry: tip is at +Y, base at -Y.
        If we rotate it X by -Math.PI/2, tip points to +Z.
      */}
      <mesh position={[0, 0, -tailLength / 2]} rotation={[-Math.PI / 2, 0, 0]}>
        <coneGeometry args={[tailWidth, tailLength, 16]} />
        <meshBasicMaterial 
          color="#88ccff" 
          transparent={true} 
          opacity={0.3} 
          blending={THREE.AdditiveBlending} 
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}
