// Interactive orrery for the exoplanets hero. Replaces the static TOI-700
// diagram: the user picks a star system (chips), and the planets orbit the
// host star in real time. Each planet is clickable — a voyager-style popup
// (oi-pop / oi-card) anchored to the dot shows that planet's parameters.
// The animation pauses while a popup is open so the popup stays anchored.
//
// Orbit radii use a per-system log scale (makeOrbitMapper) so close-in
// planets (TRAPPIST-1 b/h span) stay readable; the habitable zone ring is
// computed from the star's luminosity. Angular speed is Keplerian (ω ∝ 1/P)
// with clamps so both fast inner and slow outer planets stay visibly moving.
import { useState, useRef, useLayoutEffect, useEffect, useCallback, useMemo, useReducer } from "react";
import { useTranslation } from "react-i18next";
import { fmtNum } from "../../lib/format";
import { SYSTEMS, habitableZone, makeOrbitMapper, angularSpeed } from "./systems";

const VB_W = 520, VB_H = 380;
const CX = 260, CY = 190;

// Planet dot radius (px in viewBox units) from physical radius (R⊕), capped so
// gas giants don't dominate and tiny planets stay clickable.
function dotR(rRearth) {
  if (!rRearth) return 2.6;
  return Math.max(2.4, Math.min(9, 2.4 + Math.cbrt(rRearth) * 1.5));
}

// Color by equilibrium temperature (K): hot → coral, habitable → teal, cold →
// blue/gold-faint. Matches the page's habitability vocabulary.
function planetColor(habitability, eqt) {
  switch (habitability) {
    case "habitable": return "var(--teal)";
    case "edge": return "var(--gold)";
    case "hot": return "var(--coral)";
    case "cold": return "#6f8bb0";
    default: return "var(--text-dim)";
  }
}

function Row({ label, val }) {
  if (val == null || val === "") return null;
  return <div className="dl-row"><span className="lbl">{label}</span><span className="val">{val}</span></div>;
}

export default function ExoSystem({ systemId, onSelectPlanet }) {
  const { t, i18n } = useTranslation();
  const system = SYSTEMS.find((s) => s.id === systemId) || SYSTEMS[0];
  const { star, planets } = system;

  const [sel, setSel] = useState(null);      // selected planet id
  const [pos, setPos] = useState(null);       // popup pixel pos within stage
  const stageRef = useRef(null);
  const rafRef = useRef(null);
  const lastRef = useRef(0);
  // Angles live in a ref (mutated in place by the rAF loop) rather than state.
  // A state array would desync from planets.length on system switches: the
  // first render of a new system still held the OLD length, so planets beyond
  // it got angles[i] === undefined → NaN coords → vanished, and the rAF tick
  // (which mapped over the stale array) locked that wrong length in. Seeding
  // in render keeps angles always length-matched to the current planets.
  const anglesRef = useRef(null);
  if (!anglesRef.current || anglesRef.current.length !== planets.length) {
    anglesRef.current = planets.map((_, i) => (i * 137) % 360);
  }
  const [, force] = useReducer((x) => x + 1, 0);   // re-render on each animation frame
  const selRef = useRef(sel);
  selRef.current = sel;
  const hoveredRef = useRef(false);          // pointer over the stage → freeze so dots are clickable

  const mapper = useMemo(() => makeOrbitMapper(planets), [systemId, planets]);
  const orbits = useMemo(() => planets.map((p, i) => ({
    r: mapper(p.a),
    omega: angularSpeed(p.p),
    phase: (i * 137) % 360,                 // golden-angle spread for variety
    color: planetColor(p.habitability, p.eqt),
    dr: dotR(p.r),
  })), [planets, mapper]);
  const rHzIn = mapper(habitableZone(star.lum)[0]);
  const rHzOut = mapper(habitableZone(star.lum)[1]);

  // Animation loop: advance each planet's angle in place, then re-render.
  // Pause while a popup is open or the pointer is over the stage so the dots
  // stay clickable and the popup stays anchored.
  useEffect(() => {
    lastRef.current = performance.now();
    const tick = (now) => {
      const dt = Math.min(0.05, (now - lastRef.current) / 1000);
      lastRef.current = now;
      const a = anglesRef.current;
      if (!selRef.current && !hoveredRef.current && a && a.length === orbits.length) {
        for (let i = 0; i < orbits.length; i++) {
          a[i] = (a[i] + orbits[i].omega * dt * (180 / Math.PI)) % 360;
        }
        force();
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [orbits]);

  // Clear the popup when the system changes (angles reseed in render above).
  useEffect(() => {
    setSel(null);
    setPos(null);
  }, [systemId]);

  const active = planets.find((p) => p.id === sel);

  // Anchor the popup to the selected planet's current pixel position within the
  // stage (viewBox 520×400 → stage px). Recompute on selection + resize.
  const measure = useCallback(() => {
    if (!sel || !stageRef.current) { setPos(null); return; }
    const idx = planets.findIndex((p) => p.id === sel);
    if (idx < 0) { setPos(null); return; }
    const deg = anglesRef.current[idx];
    const ang = (deg - 90) * Math.PI / 180;
    const ox = orbits[idx].r * Math.cos(ang);
    const oy = orbits[idx].r * Math.sin(ang);
    const sx = (CX + ox) / VB_W, sy = (CY + oy) / VB_H;
    const w = stageRef.current.clientWidth || 460;
    const h = stageRef.current.clientHeight || (w * VB_H / VB_W);
    const px = sx * w, py = sy * h;
    const half = 130;
    const left = w < half * 2 ? w / 2 : Math.max(half, Math.min(w - half, px));
    setPos({ left, top: py, below: py < 110 });
  }, [sel, planets, orbits]);

  useLayoutEffect(measure, [sel]);
  useEffect(() => {
    if (!sel) return;
    const onResize = () => measure();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [sel, measure]);

  const K = t("exoplanets.detail.units.teq");
  const Msun = t("exoplanets.detail.units.stMass");
  const R = t("exoplanets.radiusUnit");
  const D = t("exoplanets.periodUnit");
  const LY = t("exoplanets.lyUnit");
  const hostLabel = star.name + " (" + star.type + ")";

  const selectPlanet = (p, idx) => {
    setSel(p.id);
    // The popup is anchored by the useLayoutEffect(measure, [sel]) below — no
    // need to schedule measure() here (an earlier rAF call captured a stale
    // `measure` closure with sel===null and reset pos to null, dismissing the
    // popup one frame after it opened).
    if (onSelectPlanet) onSelectPlanet(buildPlanetObject(p, star, hostLabel, t, K, Msun, R, D, LY, i18n.language));
  };

  return (
    <div className="exo-wrap">
      <div className="exo-stage" ref={stageRef}
           onMouseEnter={() => { hoveredRef.current = true; }}
           onMouseLeave={() => { hoveredRef.current = false; }}
           onTouchStart={() => { hoveredRef.current = true; }}
           onTouchEnd={() => { hoveredRef.current = false; }}>
        <svg viewBox={`0 0 ${VB_W} ${VB_H}`} xmlns="http://www.w3.org/2000/svg" role="img"
             aria-label={star.name}>
          {/* habitable zone annulus */}
          {rHzOut > rHzIn && (
            <circle cx={CX} cy={CY} r={Math.min(rHzOut, 178)} fill="var(--teal)" opacity=".09" />
          )}
          {rHzIn > 18 && (
            <circle cx={CX} cy={CY} r={Math.max(18, Math.min(rHzIn, 178))} fill="var(--panel)" opacity=".92" />
          )}
          {/* orbits */}
          {orbits.map((o, i) => (
            <circle key={i} className="exo-orbit" cx={CX} cy={CY} r={o.r} />
          ))}
          {/* host star (glow + body) */}
          <circle cx={CX} cy={CY} r={14} fill={star.color} opacity=".18" />
          <circle cx={CX} cy={CY} r={Math.max(5, Math.min(11, 5 + Math.cbrt(star.rR) * 2.2))} fill={star.color} />
          {/* planets */}
          {planets.map((p, i) => {
            const deg = (anglesRef.current && anglesRef.current[i] != null) ? anglesRef.current[i] : (i * 137) % 360;
            const ang = (deg - 90) * Math.PI / 180;
            const x = CX + orbits[i].r * Math.cos(ang);
            const y = CY + orbits[i].r * Math.sin(ang);
            const on = sel === p.id;
            return (
              <g key={p.id}
                 className={"exo-dot-btn" + (on ? " selected" : "")}
                 role="button" tabIndex={0}
                 aria-label={p.name || star.name + " " + p.id}
                 onClick={(e) => { e.stopPropagation(); if (on) { setSel(null); } else selectPlanet(p, i); }}
                 onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); on ? setSel(null) : selectPlanet(p, i); } }}>
                <circle cx={x} cy={y} r={16} fill="transparent" />
                {on && <circle cx={x} cy={y} r={orbits[i].dr + 4} fill="none" stroke={orbits[i].color} strokeOpacity=".7" strokeWidth="1.5" />}
                <circle cx={x} cy={y} r={orbits[i].dr} fill={orbits[i].color} className="obj-dot" />
                <text className="exo-label" x={x + orbits[i].dr + 3} y={y + 3} fill={orbits[i].color}>
                  {p.name || p.id}
                </text>
              </g>
            );
          })}
          <text className="exo-label" x={CX} y={VB_H - 8} textAnchor="middle">
            {star.name} · {star.type}
          </text>
        </svg>

        {active && pos && (() => {
          const p = active;
          const blurb = t("exoplanets.detail.blurb." + (p.habitability || "unknown"), { defaultValue: "" });
          const habiLabel = t("exoplanets.feat." + (p.habitability || "unknown"), { defaultValue: "—" });
          return (
            <div className={"oi-pop exo-pop" + (pos.below ? " below" : "")}
                 style={{ left: pos.left, top: pos.top }} role="dialog"
                 onClick={(e) => e.stopPropagation()}>
              <div className="oi-card">
                <div className="oi-head">
                  <span className="oi-probe v2">{t("exoplanets.catalog.confirmed")}</span>
                  <span className="oi-tag">{p.name || star.name + " " + p.id}</span>
                  <button type="button" className="oi-close" onClick={() => setSel(null)} aria-label={t("exoplanets.detail.close")}>×</button>
                </div>
                <div className="exo-pop-rows">
                  <Row label={t("exoplanets.detail.host")} val={hostLabel} />
                  <Row label={t("exoplanets.detail.radius")} val={p.r != null ? fmtNum(p.r, 2) + " " + R : null} />
                  <Row label={t("exoplanets.detail.period")} val={p.p != null ? fmtNum(p.p, 2) + " " + D : null} />
                  <Row label={t("exoplanets.detail.distance")} val={star.dist != null ? star.dist + " " + LY : null} />
                  <Row label={t("exoplanets.detail.teq")} val={p.eqt != null ? fmtNum(p.eqt, 0) + " " + K : null} />
                  <Row label={t("exoplanets.detail.stTeff")} val={star.teff != null ? fmtNum(star.teff, 0) + " " + K : null} />
                  <Row label={t("exoplanets.detail.stMass")} val={star.mM != null ? fmtNum(star.mM, 2) + " " + Msun : null} />
                  <Row label={t("exoplanets.detail.discYear")} val={p.disc != null ? String(p.disc) : null} />
                  <Row label={t("exoplanets.detail.facility")} val={p.facility || null} />
                  <Row label={t("exoplanets.detail.habitability")} val={habiLabel} />
                </div>
                {blurb && <p className="oi-desc">{blurb}</p>}
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

// Build the planet object passed to onSelectPlanet (kept here so the page can
// mirror the selected planet elsewhere if needed; currently unused upstream).
function buildPlanetObject(p, star, hostLabel, t, K, Msun, R, D, LY, lang) {
  return {
    name: p.name || star.name + " " + p.id,
    host: hostLabel,
    radius: p.r,
    period: p.p,
    distance_ly: star.dist,
    teq: p.eqt,
    st_teff: star.teff,
    st_mass: star.mM,
    disc_year: p.disc,
    facility: p.facility,
    confirmed: true,
    habitability: p.habitability,
  };
}