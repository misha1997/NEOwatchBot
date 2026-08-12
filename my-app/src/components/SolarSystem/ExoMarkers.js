import React, { useState } from 'react';
import { Html } from '@react-three/drei';
import { useNavigate } from 'react-router-dom';
import { useLang } from '../../context/LanguageContext';

const markers = [
  { id: 'trappist1', name: 'TRAPPIST-1 System', pos: [120, 40, -150], color: '#FF8A4C' },
  { id: 'proxima', name: 'Proxima Centauri', pos: [-150, -30, 80], color: '#ff4d4d' },
  { id: 'kepler186', name: 'Kepler-186', pos: [80, 100, 150], color: '#ffcc00' }
];

export default function ExoMarkers() {
  const navigate = useNavigate();
  const { lang } = useLang();
  
  return (
    <group>
      {markers.map((marker) => (
        <ExoMarker key={marker.id} marker={marker} navigate={navigate} lang={lang} />
      ))}
    </group>
  );
}

function ExoMarker({ marker, navigate, lang }) {
  const [hovered, setHovered] = useState(false);
  
  return (
    <mesh 
      position={marker.pos}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
      onPointerOut={(e) => { e.stopPropagation(); setHovered(false); document.body.style.cursor = 'auto'; }}
      onClick={(e) => { 
        e.stopPropagation(); 
        navigate(`/${lang}/exoplanets`); 
      }}
    >
      <sphereGeometry args={[hovered ? 3 : 2, 16, 16]} />
      <meshBasicMaterial color={marker.color} />
      
      <Html distanceFactor={250} center style={{ pointerEvents: 'none', transition: 'all 0.2s' }}>
        <div style={{
          color: marker.color,
          background: 'rgba(0,0,0,0.8)',
          padding: '4px 8px',
          borderRadius: '4px',
          fontSize: '16px',
          fontWeight: 'bold',
          border: `1px solid ${marker.color}`,
          opacity: hovered ? 1 : 0.6,
          transform: hovered ? 'scale(1.2)' : 'scale(1)',
          whiteSpace: 'nowrap'
        }}>
          {marker.name} ➔
        </div>
      </Html>
    </mesh>
  );
}
