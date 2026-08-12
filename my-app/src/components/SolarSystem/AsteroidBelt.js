import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import useSolarSystemStore from '../../store/solarSystemStore';
import { scaleDistance, getDaysSinceJ2000 } from '../../utils/orbitalMath';

const ASTEROID_COUNT = 3000;

export default function AsteroidBelt() {
  const meshRef = useRef();
  const showAsteroids = useSolarSystemStore(s => s.showAsteroids);
  const isRealisticScale = useSolarSystemStore(s => s.isRealisticScale);

  // Generate random asteroid data once
  const asteroids = useMemo(() => {
    const data = [];
    for (let i = 0; i < ASTEROID_COUNT; i++) {
      // Semi-major axis between 2.2 and 3.2 AU (Main Belt)
      const a = 2.2 + Math.random() * 1.0;
      
      // Kepler's Third Law (simplified): n is proportional to a^(-1.5)
      // Earth speed is 1 unit/year approx. So speed is 2*PI / (a^1.5 * 365.25) radians per day.
      const speed = (Math.PI * 2) / (Math.pow(a, 1.5) * 365.25);
      
      // Concentrate inclination near the ecliptic using a power curve
      // Most will be very close to 0, with a few spreading further out (max +/- 10 degrees)
      const randomSpread = Math.pow(Math.random() * 2 - 1, 3); // cubic curve between -1 and 1
      const inclination = randomSpread * (10 * Math.PI / 180);

      data.push({
        a: a,
        speed: speed,
        offsetAngle: Math.random() * Math.PI * 2,
        inclination: inclination,
        node: Math.random() * Math.PI * 2,
        scale: Math.random() * 0.15 + 0.05
      });
    }
    return data;
  }, []);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame(() => {
    if (!showAsteroids || !meshRef.current) return;

    const state = useSolarSystemStore.getState();
    const daysSinceJ2000 = getDaysSinceJ2000(state.simDate);

    asteroids.forEach((ast, i) => {
      // Calculate scaled distance
      const scaledA = scaleDistance(ast.a, isRealisticScale);

      // Current angle
      const theta = ast.offsetAngle + ast.speed * daysSinceJ2000;

      // Uninclined coordinates (in XZ plane)
      const x_prime = scaledA * Math.cos(theta);
      const z_prime = scaledA * Math.sin(theta);

      // Apply inclination and node
      const cosN = Math.cos(ast.node);
      const sinN = Math.sin(ast.node);
      const cosI = Math.cos(ast.inclination);
      const sinI = Math.sin(ast.inclination);

      const x = cosN * x_prime - sinN * cosI * z_prime;
      const y = sinI * z_prime;
      const z = sinN * x_prime + cosN * cosI * z_prime;

      dummy.position.set(x, y, z);
      
      const scaleMult = isRealisticScale ? 0.3 : 1.0;
      dummy.scale.setScalar(ast.scale * scaleMult);
      
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  if (!showAsteroids) return null;

  return (
    <instancedMesh ref={meshRef} args={[null, null, ASTEROID_COUNT]}>
      {/* A simple low-poly geometry for asteroid look */}
      <dodecahedronGeometry args={[1, 0]} />
      <meshStandardMaterial color="#9a8b78" roughness={0.8} metalness={0.1} />
    </instancedMesh>
  );
}
