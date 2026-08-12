import React, { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import useSolarSystemStore from '../../store/solarSystemStore';

export default function CameraController() {
  const controlsRef = useRef();
  const { camera, scene } = useThree();
  
  const focusedObjectId = useSolarSystemStore(s => s.focusedObjectId);
  
  // A target position for the camera to look at
  const targetLookAt = useRef(new THREE.Vector3(0, 0, 0));
  const currentLookAt = useRef(new THREE.Vector3(0, 0, 0));
  
  // To move camera itself
  const targetCameraPos = useRef(new THREE.Vector3(0, 10, 30));
  const isTransitioning = useRef(false);

  useEffect(() => {
    if (!focusedObjectId) {
      targetLookAt.current.set(0, 0, 0);
      targetCameraPos.current.set(0, 150, 350); // Move camera back to see linear distance scaling
      isTransitioning.current = true;
    } else if (focusedObjectId === 'sun') {
      targetLookAt.current.set(0, 0, 0);
      targetCameraPos.current.set(0, 20, 40);
      isTransitioning.current = true;
    } else {
      isTransitioning.current = true;
    }
  }, [focusedObjectId]);

  useEffect(() => {
    // Cancel automatic camera transition if user manually interacts (scrolls or clicks/drags)
    const cancelTransition = () => {
      isTransitioning.current = false;
    };
    
    window.addEventListener('wheel', cancelTransition, { passive: true });
    window.addEventListener('pointerdown', cancelTransition, { passive: true });
    window.addEventListener('touchstart', cancelTransition, { passive: true });
    
    return () => {
      window.removeEventListener('wheel', cancelTransition);
      window.removeEventListener('pointerdown', cancelTransition);
      window.removeEventListener('touchstart', cancelTransition);
    };
  }, []);

  useFrame(() => {
    if (!controlsRef.current) return;
    
    // dynamically track the planet's current position if focused
    if (focusedObjectId && focusedObjectId !== 'sun') {
      let found = false;
      let radius = 1;
      
      const planetGroup = scene.getObjectByName(focusedObjectId);
      if (planetGroup) {
        planetGroup.getWorldPosition(targetLookAt.current);
        
        // Try to get radius from the mesh inside the planetGroup
        // planetGroup children usually are [mesh, ringGroup, moonGroup, ...]
        if (planetGroup.children && planetGroup.children[0] && planetGroup.children[0].geometry) {
           const geoParams = planetGroup.children[0].geometry.parameters;
           if (geoParams && geoParams.radius) radius = geoParams.radius;
        }
        found = true;
      }
      
      if (found) {
        // Only update targetCameraPos during transition to avoid locking camera
        if (isTransitioning.current) {
          const offset = new THREE.Vector3(radius * 3, radius * 1.5, radius * 3);
          targetCameraPos.current.copy(targetLookAt.current).add(offset);
        }
      } else {
        targetLookAt.current.set(0, 0, 0);
      }
    }
    
    // Smoothly interpolate currentLookAt towards targetLookAt
    currentLookAt.current.lerp(targetLookAt.current, 0.1);
    
    // Move the camera if transitioning
    if (isTransitioning.current) {
      camera.position.lerp(targetCameraPos.current, 0.05);
      // Stop transitioning if close enough
      if (camera.position.distanceTo(targetCameraPos.current) < 0.5) {
        isTransitioning.current = false;
      }
    }
    
    // Update OrbitControls target
    controlsRef.current.target.copy(currentLookAt.current);
    controlsRef.current.update();
  });

  return (
    <OrbitControls 
      ref={controlsRef} 
      enablePan={true}
      enableZoom={true}
      enableRotate={true}
      maxDistance={50000}
      zoomSpeed={1.5}
      makeDefault
    />
  );
}
