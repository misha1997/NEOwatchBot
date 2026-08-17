import React, { useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { useNavigate } from 'react-router-dom';
import Scene from '../components/SolarSystem/Scene';
import useSolarSystemStore from '../store/solarSystemStore';
import planetsData from '../data/planets.json';
import { useLang } from '../context/LanguageContext';
import { calculatePosition, getDaysSinceJ2000 } from '../utils/orbitalMath';
import * as THREE from 'three';

export default function SolarSystem3D() {
  const { lang } = useLang();
  const navigate = useNavigate();

  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 640px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 640px)');
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Zustand state
  const timeMultiplier = useSolarSystemStore(s => s.timeMultiplier);
  const setTimeMultiplier = useSolarSystemStore(s => s.setTimeMultiplier);
  const advanceTime = useSolarSystemStore(s => s.advanceTime);
  const simDate = useSolarSystemStore(s => s.simDate);
  const setSimDate = useSolarSystemStore(s => s.setSimDate);
  const resetTime = useSolarSystemStore(s => s.resetTime);
  const isRealisticScale = useSolarSystemStore(s => s.isRealisticScale);
  const setIsRealisticScale = useSolarSystemStore(s => s.setIsRealisticScale);
  const showOrbits = useSolarSystemStore(s => s.showOrbits);
  const setShowOrbits = useSolarSystemStore(s => s.setShowOrbits);
  const showLabels = useSolarSystemStore(s => s.showLabels);
  const setShowLabels = useSolarSystemStore(s => s.setShowLabels);
  const showAsteroids = useSolarSystemStore(s => s.showAsteroids);
  const setShowAsteroids = useSolarSystemStore(s => s.setShowAsteroids);
  const focusedObjectId = useSolarSystemStore(s => s.focusedObjectId);
  const setFocusedObjectId = useSolarSystemStore(s => s.setFocusedObjectId);

  // Simulation loop outside of React Three Fiber's frame for global state
  useEffect(() => {
    let lastTime = performance.now();
    let animId;
    
    const loop = (time) => {
      const dt = (time - lastTime) / 1000; // delta seconds
      lastTime = time;
      advanceTime(dt);
      animId = requestAnimationFrame(loop);
    };
    
    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [advanceTime]);

  const focusedPlanet = planetsData.find(p => p.id === focusedObjectId);

  // Time slider bounds (1900 to 2100)
  const minTime = new Date('1900-01-01').getTime();
  const maxTime = new Date('2100-01-01').getTime();

  // Button styles
  const btnStyle = {
    background: 'rgba(255,255,255,0.1)',
    border: '1px solid rgba(255,255,255,0.2)',
    color: 'white',
    padding: '8px 16px',
    borderRadius: '20px',
    cursor: 'pointer',
    backdropFilter: 'blur(10px)',
    transition: 'all 0.2s',
    fontSize: '14px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  };

  const glassPanelStyle = {
    background: 'rgba(10, 15, 30, 0.6)',
    border: '1px solid rgba(255,255,255,0.1)',
    backdropFilter: 'blur(12px)',
    borderRadius: '16px',
    color: 'white',
    padding: '20px',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)'
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: '#000', overflow: 'hidden', zIndex: 9999 }}>
      
      {/* 3D Canvas */}
      <Canvas shadows={{ type: THREE.PCFSoftShadowMap }} camera={{ position: [0, 50, 120], fov: 45, far: 100000 }}>
        <React.Suspense fallback={null}>
          <Scene />
        </React.Suspense>
      </Canvas>

      {/* UI Overlay */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: isMobile ? '12px' : '24px',
        color: 'white',
        fontFamily: 'Inter, sans-serif'
      }}>

        {/* Top Row: Back button & Controls */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>

          {/* Top Left: Back & Title */}
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', pointerEvents: 'auto' }}>
            <button
              onClick={() => navigate(-1)}
              style={{ ...btnStyle, padding: isMobile ? '7px 12px' : btnStyle.padding, fontSize: isMobile ? '13px' : btnStyle.fontSize }}
              onMouseOver={e => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
              onMouseOut={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
            >
              ← {lang === 'uk' ? 'Назад' : 'Back'}
            </button>

            {!isMobile && (
              <div style={{ ...glassPanelStyle, padding: '8px 16px', borderRadius: '20px' }}>
                <span style={{ fontWeight: '600', letterSpacing: '1px', whiteSpace: 'nowrap' }}>Solar System 3D</span>
              </div>
            )}
          </div>

          {/* Top Right: Compact Controls Panel */}
          <div style={{ ...glassPanelStyle, pointerEvents: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', width: isMobile ? '150px' : '200px', padding: isMobile ? '14px' : glassPanelStyle.padding }}>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13px', cursor: 'pointer' }}>
              {lang === 'uk' ? 'Реалізм' : 'Real Scale'}
              <input type="checkbox" checked={isRealisticScale} onChange={e => setIsRealisticScale(e.target.checked)} style={{ accentColor: '#4facfe' }} />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13px', cursor: 'pointer' }}>
              {lang === 'uk' ? 'Орбіти' : 'Orbits'}
              <input type="checkbox" checked={showOrbits} onChange={e => setShowOrbits(e.target.checked)} style={{ accentColor: '#4facfe' }} />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13px', cursor: 'pointer' }}>
              {lang === 'uk' ? 'Назви' : 'Labels'}
              <input type="checkbox" checked={showLabels} onChange={e => setShowLabels(e.target.checked)} style={{ accentColor: '#4facfe' }} />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13px', cursor: 'pointer' }}>
              {lang === 'uk' ? 'Астероїди' : 'Asteroids'}
              <input type="checkbox" checked={showAsteroids} onChange={e => setShowAsteroids(e.target.checked)} style={{ accentColor: '#4facfe' }} />
            </label>
            
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.1)', margin: '4px 0' }} />
            
            <select 
              value={timeMultiplier} 
              onChange={e => setTimeMultiplier(Number(e.target.value))}
              style={{ background: 'rgba(0,0,0,0.5)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', padding: '6px', borderRadius: '8px', fontSize: '12px', outline: 'none' }}
            >
              <option value={0}>⏸ {lang === 'uk' ? 'Пауза' : 'Pause'}</option>
              <option value={1}>▶ {lang === 'uk' ? 'Реальний час' : '1x Real Time'}</option>
              <option value={86400}>⏩ 1 {lang === 'uk' ? 'День' : 'Day'}/s</option>
              <option value={2592000}>⏩ 1 {lang === 'uk' ? 'Місяць' : 'Month'}/s</option>
              <option value={31536000}>⏭ 1 {lang === 'uk' ? 'Рік' : 'Year'}/s</option>
            </select>
            
            <button 
              onClick={resetTime}
              style={{ ...btnStyle, justifyContent: 'center', padding: '6px', borderRadius: '8px', fontSize: '12px', marginTop: '4px' }}
            >
              ⏱ {lang === 'uk' ? 'Зараз' : 'Now'}
            </button>
          </div>
        </div>

        {/* Bottom Area: Info Panel (Left) & Timeline (Center) */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'flex-end', gap: isMobile ? '10px' : '20px', flexWrap: isMobile ? 'wrap' : 'nowrap' }}>

          {/* Info Panel */}
          <div style={{ width: isMobile ? '100%' : '320px', pointerEvents: 'auto', order: isMobile ? 1 : 0 }}>
            {focusedPlanet && (
              <div style={{
                ...glassPanelStyle,
                borderLeft: `4px solid ${focusedPlanet.color}`,
                boxShadow: `0 8px 32px rgba(0,0,0,0.5), 0 0 20px ${focusedPlanet.color}20`
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h2 style={{ margin: 0, fontSize: '22px', fontWeight: '300', letterSpacing: '1px' }}>
                    {focusedPlanet.name}
                  </h2>
                  <button 
                    onClick={() => setFocusedObjectId(null)}
                    style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '18px', opacity: 0.5 }}
                  >
                    ✕
                  </button>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px', fontSize: '13px', marginBottom: '20px' }}>
                  <div style={{ opacity: 0.5 }}>{lang === 'uk' ? 'Тип' : 'Type'}</div>
                  <div style={{ textTransform: 'capitalize' }}>{focusedPlanet.type}</div>
                  
                  <div style={{ opacity: 0.5 }}>{lang === 'uk' ? 'Радіус' : 'Radius'}</div>
                  <div>
                    {focusedPlanet.radiusKm.toLocaleString()} km
                    {focusedPlanet.id !== 'earth' && focusedPlanet.type !== 'star' && (
                      <span style={{ fontSize: '11px', color: '#4facfe', marginLeft: '6px' }}>
                        ({(focusedPlanet.radiusKm / 6371).toFixed(2)}x 🌍)
                      </span>
                    )}
                  </div>
                  
                  <div style={{ opacity: 0.5 }}>{lang === 'uk' ? 'Маса' : 'Mass'}</div>
                  <div>{focusedPlanet.mass}</div>

                  {focusedPlanet.type !== 'star' && (
                    <>
                      <div style={{ opacity: 0.5 }}>{lang === 'uk' ? 'Дистанція' : 'Distance'}</div>
                      <div>
                        {(() => {
                          const pos = calculatePosition(focusedPlanet.orbit, getDaysSinceJ2000(simDate));
                          const dist = Math.sqrt(pos.x*pos.x + pos.y*pos.y + pos.z*pos.z);
                          return dist.toFixed(3) + ' AU';
                        })()}
                      </div>
                    </>
                  )}
                </div>

                <button 
                  onClick={() => navigate(`/${lang}/planetarium/${focusedPlanet.id}`)}
                  style={{
                    width: '100%', 
                    background: `linear-gradient(90deg, ${focusedPlanet.color}80, ${focusedPlanet.color})`, 
                    color: 'white', 
                    border: 'none', 
                    padding: '12px', 
                    borderRadius: '8px', 
                    cursor: 'pointer', 
                    fontWeight: '600',
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    boxShadow: `0 4px 15px ${focusedPlanet.color}40`,
                    textShadow: '0 1px 2px rgba(0,0,0,0.5)',
                    transition: 'opacity 0.2s'
                  }}
                  onMouseOver={e => e.currentTarget.style.opacity = 0.9}
                  onMouseOut={e => e.currentTarget.style.opacity = 1}
                >
                  {lang === 'uk' ? 'Енциклопедія' : 'Encyclopedia'}
                </button>
              </div>
            )}
          </div>

          {/* Time Slider (Bottom Center-ish) */}
          <div style={{
            pointerEvents: 'auto',
            ...glassPanelStyle,
            padding: isMobile ? '10px 14px' : '12px 24px',
            flexGrow: 1,
            maxWidth: isMobile ? '100%' : '600px',
            width: isMobile ? '100%' : undefined,
            margin: isMobile ? 0 : '0 auto',
            order: isMobile ? 2 : 0,
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', gap: '8px' }}>
              <span style={{ opacity: 0.5 }}>1900</span>
              <span style={{ fontWeight: '500', color: '#4facfe', letterSpacing: '1px', whiteSpace: 'nowrap' }}>
                {simDate.toLocaleString(lang === 'uk' ? 'uk-UA' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
              </span>
              <span style={{ opacity: 0.5 }}>2100</span>
            </div>
            <input
              type="range"
              min={minTime}
              max={maxTime}
              step={86400000} // 1 day steps
              value={simDate.getTime()}
              onChange={(e) => {
                setSimDate(new Date(Number(e.target.value)));
                if (timeMultiplier !== 0) setTimeMultiplier(0);
              }}
              style={{ width: '100%', cursor: 'pointer', accentColor: '#4facfe' }}
            />
          </div>

          {/* Empty right area to balance the left Info Panel on desktop only —
              on mobile the row wraps, so this spacer would just eat width. */}
          {!isMobile && <div style={{ width: '320px' }}></div>}
        </div>

      </div>
    </div>
  );
}
