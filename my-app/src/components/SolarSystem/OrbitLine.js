import React, { useMemo } from 'react';
import { Line } from '@react-three/drei';
import { calculatePosition, scaleDistance } from '../../utils/orbitalMath';

export default function OrbitLine({ orbit, color, isRealisticScale, visible }) {
  const points = useMemo(() => {
    if (!orbit || orbit.a === 0 || !orbit.n) return [];
    
    const pts = [];
    const numPoints = 120;
    for (let i = 0; i <= numPoints; i++) {
      // Sample Eccentric Anomaly (E) uniformly for smooth curves even at high eccentricity
      const E_rad = (i / numPoints) * Math.PI * 2;
      const M_rad = E_rad - orbit.e * Math.sin(E_rad);
      const M_deg = M_rad * (180 / Math.PI);
      
      const days = (M_deg - orbit.M0) / orbit.n;
      const pos = calculatePosition(orbit, days);
      
      const dist = Math.sqrt(pos.x*pos.x + pos.y*pos.y + pos.z*pos.z);
      const scaledDist = scaleDistance(dist, isRealisticScale);
      
      // Normalize and scale
      if (dist > 0) {
        pts.push([
          (pos.x / dist) * scaledDist,
          (pos.y / dist) * scaledDist,
          (pos.z / dist) * scaledDist
        ]);
      }
    }
    return pts;
  }, [orbit, isRealisticScale]);

  if (!visible || points.length === 0) return null;

  return (
    <Line
      points={points}
      color={color}
      lineWidth={1}
      transparent
      opacity={0.4}
    />
  );
}
