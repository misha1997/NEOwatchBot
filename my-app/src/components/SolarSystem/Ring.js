import React, { useRef, useEffect } from 'react';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';

export default function Ring({ textureUrl, innerRadius, outerRadius, color }) {
  const texture = useTexture(textureUrl);
  const geometryRef = useRef();

  useEffect(() => {
    if (geometryRef.current) {
      const pos = geometryRef.current.attributes.position;
      const uvs = geometryRef.current.attributes.uv;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        const radius = Math.sqrt(x * x + y * y);
        // Map inner edge to u=0, outer edge to u=1
        const u = (radius - innerRadius) / (outerRadius - innerRadius);
        uvs.setXY(i, u, 0.5);
      }
      uvs.needsUpdate = true;
    }
  }, [innerRadius, outerRadius]);
  
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry ref={geometryRef} args={[innerRadius, outerRadius, 64]} />
      <meshBasicMaterial 
        map={texture} 
        color={color || '#ffffff'}
        side={THREE.DoubleSide} 
        transparent={true} 
        opacity={0.8}
      />
    </mesh>
  );
}
