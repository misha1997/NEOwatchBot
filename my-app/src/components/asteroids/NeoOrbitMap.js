// Heliocentric asteroid-orbit map (asteroids page, second diagram), styled like
// the comets page orbit-card: bordered card, header (live name + "as of" date),
// a toolbar of toggle chips (one per asteroid) that show/hide each orbit, and
// the SVG itself — compact, pan/zoom-able. Sun at centre, Earth + Mars
// reference orbits with the planets drawn at their real current positions, and
// each near-Earth asteroid as a true Keplerian ellipse (Sun at one focus) with
// its CURRENT position dot — not an animation.
//
// Zoom keeps labels/dots/line-thickness a constant on-screen size: orbit
// geometry scales, but strokes use `vector-effect: non-scaling-stroke` and each
// dot/label sits inside a `scale(1/s)` group that cancels the parent zoom (the
// POSITION still rides along the orbit; only the glyph/dot size is held fixed).
//
// How: NASA's `mean_anomaly` is given at `epoch_osculation` (a Julian Date).
// M_now = M_epoch + n·(JD_now − epoch); solve Kepler for E → true anomaly ν →
// position. Planets use the circular mean-longitude formula. (Top-down ecliptic
// projection; inclination ignored.) Distinct from NeoOrbit (geocentric LD radar).
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ellipseGeometry, dotPosition, meanMotion, planetPosition,
  EARTH, MARS, VB, SUN_X, SUN_Y, AU_TO_PX,
} from "./kepler";

const MIN_SCALE = 0.6;
const MAX_SCALE = 26;
// Default view: 2× zoom centred on the Sun (viewBox centre). x = (1 − s)·(VB/2)
// keeps the centre pinned while scaling, so s=2 → x = −VB/2.
const DEFAULT_VIEW = { s: 2, x: (1 - 2) * (VB / 2), y: (1 - 2) * (VB / 2) };

// Julian Date from JS epoch ms: Unix epoch (1970-01-01T00:00:00Z) = JD 2440587.5.
function nowJD() {
  return Date.now() / 86400000 + 2440587.5;
}

// Pointer position in viewBox units (viewBox is 0 0 VB VB, square).
function toViewBox(svg, clientX, clientY) {
  const r = svg.getBoundingClientRect();
  return {
    x: ((clientX - r.left) / r.width) * VB,
    y: ((clientY - r.top) / r.height) * VB,
  };
}

export default function NeoOrbitMap({ items = [] }) {
  const { t, i18n } = useTranslation();
  const au = t("asteroids.orbitMap.au");
  const jd = nowJD();
  const locale = i18n.language === "en" ? "en-GB" : "uk-UA";
  const asOf = t("asteroids.orbitMap.asOf", { date: new Date().toLocaleDateString(locale) });

  // Zoom/pan view: transform = translate(x,y) scale(s), so screen_vb = x + s·world.
  const [view, setView] = useState(DEFAULT_VIEW);
  const svgRef = useRef(null);
  const drag = useRef({ active: false, lastX: 0, lastY: 0, moved: false });

  // Wheel zoom toward the cursor (native non-passive listener so preventDefault
  // works — React's onWheel is passive and can't stop the page from scrolling).
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e) => {
      e.preventDefault();
      const p = toViewBox(svg, e.clientX, e.clientY);
      setView((v) => {
        const factor = Math.exp(-e.deltaY * 0.0015);
        const s = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.s * factor));
        return { s, x: v.x + (v.s - s) * p.x, y: v.y + (v.s - s) * p.y };
      });
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, []);

  // Button zoom toward the centre of the viewBox.
  const zoomBy = (factor) => setView((v) => {
    const s = Math.min(MAX_SCALE, Math.max(MIN_SCALE, v.s * factor));
    return { s, x: v.x + (v.s - s) * (VB / 2), y: v.y + (v.s - s) * (VB / 2) };
  });
  const reset = () => setView(DEFAULT_VIEW);

  const onPointerDown = (e) => {
    drag.current = { active: true, lastX: e.clientX, lastY: e.clientY, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (!drag.current.active) return;
    const svg = svgRef.current;
    if (!svg) return;
    const dx = e.clientX - drag.current.lastX;
    const dy = e.clientY - drag.current.lastY;
    if (Math.abs(dx) + Math.abs(dy) > 2) drag.current.moved = true;
    const r = svg.getBoundingClientRect();
    setView((v) => ({ ...v, x: v.x + (dx / r.width) * VB, y: v.y + (dy / r.height) * VB }));
    drag.current.lastX = e.clientX;
    drag.current.lastY = e.clientY;
  };
  const onPointerUp = (e) => {
    drag.current.active = false;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
  };

  // Visible/hidden per asteroid. Missing key => visible (default-on).
  const [hidden, setHidden] = useState({});
  const toggle = (key) => setHidden((h) => ({ ...h, [key]: !h[key] }));

  const rows = [];
  (items || []).forEach((a, i) => {
    const el = a && a.orbit;
    if (!el) return;
    const g = ellipseGeometry(el);
    if (!g) return;
    const maEpoch = (+el.ma || 0) * (Math.PI / 180);
    const n = meanMotion(el);
    const epoch = +el.epoch;
    let M = maEpoch;
    if (isFinite(epoch) && epoch > 0 && isFinite(n) && n > 0) {
      M = maEpoch + n * (jd - epoch);
    }
    const p = dotPosition(el, M);
    if (!p) return;
    const color = a.hazardous ? "var(--coral)" : "var(--gold)";
    const name = String(a.name || "").replace(/[()]/g, "");
    const key = a.id || name || i;
    rows.push({ key, g, p, color, name });
  });

  const earth = planetPosition(EARTH.a, EARTH.L0, EARTH.n, jd);
  const mars = planetPosition(MARS.a, MARS.L0, MARS.n, jd);
  // Counter-scale so dots/text keep a constant on-screen size regardless of
  // zoom: their POSITION scales with the view (so they ride along the orbit),
  // but each is drawn inside a `scale(1/s)` group that cancels the parent zoom.
  const inv = 1 / view.s;
  const f = (n) => Number(n).toFixed(1);

  return (
    <div className="orbit-card orbit-map-card">
      <div className="orbit-head">
        <div className="live"><span className="dot live" /> {t("asteroids.orbitMap.head")}</div>
        <span className="coords">{asOf}</span>
      </div>
      <div className="orbit-toolbar">
        <div className="comet-toggles">
          {rows.map((r) => {
            const visible = !hidden[r.key];
            return (
              <button type="button" key={r.key}
                className={"comet-toggle-btn" + (visible ? " active" : "")}
                style={{ "--c": r.color }}
                onClick={() => toggle(r.key)}>
                <span className="sw" />{r.name}
              </button>
            );
          })}
        </div>
      </div>
      <div className="orbit-map-stage">
        <div className="orbit-map-box">
          <div className="orbit-zoom" role="group" aria-label={t("asteroids.orbitMap.zoom")}>
            <button type="button" onClick={() => zoomBy(1.3)} aria-label="+">+</button>
            <button type="button" onClick={() => zoomBy(1 / 1.3)} aria-label="−">−</button>
            <button type="button" onClick={reset} aria-label={t("asteroids.orbitMap.reset")}>{t("asteroids.orbitMap.reset")}</button>
          </div>
          <svg id="orbit-map" ref={svgRef} viewBox={`0 0 ${VB} ${VB}`}
            xmlns="http://www.w3.org/2000/svg" aria-label={t("asteroids.orbitMap.title")}
            onPointerDown={onPointerDown} onPointerMove={onPointerMove}
            onPointerUp={onPointerUp} onPointerLeave={onPointerUp} onPointerCancel={onPointerUp}
            style={{ cursor: drag.current.active ? "grabbing" : "grab", touchAction: "none" }}>
            <g transform={`translate(${view.x.toFixed(2)} ${view.y.toFixed(2)}) scale(${view.s.toFixed(4)})`}>
              {/* reference orbits: Earth (teal) + Mars (faint) — geometry scales
                  with zoom; stroke stays 1px via non-scaling-stroke. */}
              <circle className="comet-scale-ring" cx={SUN_X} cy={SUN_Y} r={(EARTH.a * AU_TO_PX).toFixed(1)}
                style={{ stroke: "var(--teal)", strokeOpacity: 0.4 }} />
              <circle className="comet-scale-ring" cx={SUN_X} cy={SUN_Y} r={(MARS.a * AU_TO_PX).toFixed(1)}
                style={{ stroke: "var(--grid-line)", strokeOpacity: 0.7 }} />
              <g transform={`translate(${SUN_X + 6} ${f(SUN_Y - EARTH.a * AU_TO_PX + 5)}) scale(${inv.toFixed(4)})`}>
                <text className="neo-label" x="0" y="0" fill="var(--teal)">{t("asteroids.orbitMap.earth")}</text>
              </g>
              <g transform={`translate(${SUN_X + 6} ${f(SUN_Y - MARS.a * AU_TO_PX + 5)}) scale(${inv.toFixed(4)})`}>
                <text className="neo-label" x="0" y="0">{t("asteroids.orbitMap.mars")}</text>
              </g>

              {/* Mars body (faint) + Earth body (teal) at real positions —
                  counter-scaled so the dots stay a constant on-screen size. */}
              <g transform={`translate(${f(mars.x)} ${f(mars.y)}) scale(${inv.toFixed(4)})`}>
                <circle cx="0" cy="0" r="6" fill="var(--coral)" opacity=".55" />
              </g>
              <g transform={`translate(${f(earth.x)} ${f(earth.y)}) scale(${inv.toFixed(4)})`}>
                <circle className="obj-dot" cx="0" cy="0" r="10"
                  style={{ fill: "var(--teal)", filter: "drop-shadow(0 0 6px var(--teal))" }} />
              </g>

              {/* Sun (glow + body) — counter-scaled so it doesn't balloon on zoom. */}
              <g transform={`translate(${SUN_X} ${SUN_Y}) scale(${inv.toFixed(4)})`}>
                <circle cx="0" cy="0" r="18" fill="var(--gold)" opacity=".18" />
                <circle cx="0" cy="0" r="10" fill="var(--gold)" />
              </g>
              <g transform={`translate(${SUN_X + 14} ${SUN_Y + 5}) scale(${inv.toFixed(4)})`}>
                <text className="neo-label" x="0" y="0" fill="var(--gold)">{t("asteroids.orbitMap.sun")}</text>
              </g>

              {rows.map((r) => {
                const visible = !hidden[r.key];
                const labelAnchor = r.p.dotX >= SUN_X ? "start" : "end";
                const lx = r.p.dotX + (labelAnchor === "start" ? 10 : -10);
                return (
                  <g key={r.key} className={"neo-item" + (visible ? "" : " is-hidden")}>
                    <ellipse className="neo-ellipse"
                      cx={f(r.g.cx)} cy={f(r.g.cy)}
                      rx={f(r.g.rx)} ry={f(r.g.ry)}
                      style={{ stroke: r.color }}
                      transform={`rotate(${r.g.rotDeg.toFixed(1)} ${f(r.g.cx)} ${f(r.g.cy)})`} />
                    <g transform={`translate(${f(r.p.dotX)} ${f(r.p.dotY)}) scale(${inv.toFixed(4)})`}>
                      <circle className="neo-now-dot" cx="0" cy="0" r="8"
                        style={{ fill: r.color, filter: `drop-shadow(0 0 5px ${r.color})` }} />
                    </g>
                    <g transform={`translate(${f(lx)} ${f(r.p.dotY)}) scale(${inv.toFixed(4)})`}>
                      <text className="neo-label" x="0" y="5"
                        textAnchor={labelAnchor} fill={r.color}>
                        {r.name} · {Number(r.g.a).toFixed(2)} {au}
                      </text>
                    </g>
                  </g>
                );
              })}

              {rows.length === 0 && (
                <g transform={`translate(${SUN_X} ${f(SUN_Y + 140)}) scale(${inv.toFixed(4)})`}>
                  <text className="neo-label" x="0" y="0" textAnchor="middle" fill="var(--text-dim)">
                    {t("asteroids.orbitMap.noOrbit")}
                  </text>
                </g>
              )}
            </g>
          </svg>
        </div>
      </div>
    </div>
  );
}