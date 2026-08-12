import React, { useMemo } from 'react';
import * as THREE from 'three';
import { getNeo } from '../../lib/api';
import { useApi } from '../../hooks/useApi';
import { useLang } from '../../context/LanguageContext';
import useSolarSystemStore from '../../store/solarSystemStore';
import { scaleRadius } from '../../utils/orbitalMath';

export default function NEOCloud() {
  const { lang } = useLang();
  // Fetch real NEOs from backend
  const { data } = useApi(() => getNeo(lang), { deps: [lang] });
  const isRealisticScale = useSolarSystemStore(s => s.isRealisticScale);

  // Generate random spherical positions for each NEO based on its distance
  const neos = useMemo(() => {
    const items = data?.items || [];
    return items.map(neo => {
      // 1 Lunar Distance (LD) is approx 0.00257 AU
      const distanceAu = neo.distance_ld * 0.00257;
      
      // Random direction vector
      const phi = Math.acos(-1 + (2 * Math.random()));
      const theta = Math.sqrt(items.length * Math.PI) * phi;
      
      const x = distanceAu * Math.cos(theta) * Math.sin(phi);
      const y = distanceAu * Math.sin(theta) * Math.sin(phi);
      const z = distanceAu * Math.cos(phi);

      return {
        ...neo,
        localPos: new THREE.Vector3(x, y, z),
        color: neo.hazardous ? '#ff4d4d' : '#ffd700'
      };
    });
  }, [data]);

  // If no NEOs, don't render anything
  if (!neos || neos.length === 0) return null;

  return (
    <group>
      {neos.map((neo, i) => {
        // We use scaleMoonDistance logic for NEOs to make them visible relative to Earth
        // But since this is a child of Earth, we just apply the same scaleDistance
        // Actually, LD is very small, so in visual mode we might need to push them out
        // Just use a generic visual multiplier if not realistic
        const distScale = isRealisticScale ? 100 : 1500;
        
        // Size: asteroids are tiny. 
        const baseSize = neo.diameter_max ? neo.diameter_max / 1000 : 1; // km
        const radius = Math.max(scaleRadius(baseSize, isRealisticScale) * 0.5, 0.02);

        return (
          <mesh 
            key={i} 
            position={[neo.localPos.x * distScale, neo.localPos.y * distScale, neo.localPos.z * distScale]}
            name={neo.name}
          >
            <sphereGeometry args={[radius, 8, 8]} />
            <meshBasicMaterial color={neo.color} />
          </mesh>
        );
      })}
    </group>
  );
}
