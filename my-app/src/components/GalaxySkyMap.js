// "Позиція на небі" — інтерактивна зумлена карта-локатор сузір'я галактики.
//
// Показує **наближений зріз** неба з центром у галактиці: її власне сузір'я
// (з реальними зорями у вершинах stick-figure) золотом з підписом-назвою,
// сусідні сузір'я — тьмяним контуром з підписами-абревіатурами, саму галактику —
// великим золотим маркером з перехрестям. У кутку — вставка всього неба для
// орієнтації. Можна зумити колесом/кнопками (у бік курсора) та перетягувати для
// панорами; кнопка ⟲ скидає до початкового вигляду сузір'я.
//
// Дані контурів — /data/constellation_lines.json (~17 KB, усі 88, кеш у модулі).
// Точки polylines — справжні позиції зір, тому вершини малюються зоряними крапками.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLang } from "../context/LanguageContext";
import { constellationName } from "../lib/constellation_names";

// ---- full-sky geometry (for the locator inset) --------------------------
const A_NGP = 192.85948, D_NGP = 27.12825, L_NCP = 122.93192, DR = Math.PI / 180;
function galToEq(l, b) {
  const ll = L_NCP - l;
  const sinDec = Math.cos(D_NGP * DR) * Math.cos(b * DR) * Math.cos(ll * DR)
    + Math.sin(D_NGP * DR) * Math.sin(b * DR);
  const dec = Math.asin(Math.max(-1, Math.min(1, sinDec))) / DR;
  const y = Math.cos(b * DR) * Math.sin(ll * DR);
  const x = Math.cos(D_NGP * DR) * Math.sin(b * DR) - Math.sin(D_NGP * DR) * Math.cos(b * DR) * Math.cos(ll * DR);
  let ra = A_NGP + Math.atan2(y, x) / DR;
  ra = ((ra % 360) + 360) % 360;
  return [ra, dec];
}
const MW = Array.from({ length: 49 }, (_, i) => galToEq(i * 7.5, 0));
const sxOf = (ra) => (ra / 360) * 360;
const syOf = (dec) => ((90 - dec) / 180) * 180;

// ---- constellation line data (cached, one fetch) ------------------------
let LINES_CACHE = null;
let LINES_PROMISE = null;
async function loadLines() {
  if (LINES_CACHE) return LINES_CACHE;
  if (!LINES_PROMISE) {
    LINES_PROMISE = fetch("/data/constellation_lines.json")
      .then((r) => r.json())
      .then((d) => { LINES_CACHE = d; return d; })
      .catch(() => { LINES_CACHE = {}; return {}; });
  }
  return LINES_PROMISE;
}

// ---- formatting --------------------------------------------------------
function fmtRaHMS(deg) {
  const h = (((deg % 360) + 360) % 360) / 15;
  const hi = Math.floor(h);
  const mi = Math.floor((h - hi) * 60);
  return `${hi}ʰ${String(mi).padStart(2, "0")}ᵐ`;
}
function fmtDecDeg(deg) {
  const sign = deg < 0 ? "−" : "+";
  const a = Math.abs(deg);
  return `${sign}${Math.floor(a)}°${String(Math.floor((a % 1) * 60)).padStart(2, "0")}′`;
}
function niceStep(span, count = 6) {
  const raw = span / count;
  const steps = [1, 2, 3, 5, 10, 15, 20, 30, 45, 60, 90];
  for (const s of steps) if (s >= raw) return s;
  return 90;
}
function ticks(min, max, step) {
  const out = [];
  const start = Math.ceil(min / step) * step;
  for (let v = start; v <= max + 1e-9; v += step) out.push(v);
  return out;
}

// viewBox geometry for the zoomed chart.
const VB_W = 1000, VB_H = 560;
const ML = 46, MR = 16, MT = 14, MB = 28;
const IX0 = ML, IX1 = VB_W - MR, IY0 = MT, IY1 = VB_H - MB;
const IW = IX1 - IX0, IH = IY1 - IY0;

// zoom limits (degrees). Max = a bit beyond the initial constellation frame;
// min = deep enough to see the galaxy's neighbourhood.
const MIN_SPAN_R = 2, MIN_SPAN_D = 1.5;

function clampDec(v) {
  // keep the declination window inside [-90, 90]
  let { dMin, dMax } = v;
  if (dMin < -90) { dMax += -90 - dMin; dMin = -90; }
  if (dMax > 90) { dMin -= dMax - 90; dMax = 90; }
  return { ...v, dMin, dMax };
}

export default function GalaxySkyMap({ ra, dec, name, abbr, constName }) {
  const { t } = useTranslation();
  const { lang } = useLang();
  const svgRef = useRef(null);
  const [lineMap, setLineMap] = useState(null);
  const [hover, setHover] = useState(null);
  const [showNeighbors, setShowNeighbors] = useState(true);
  const dragRef = useRef({ active: false, sx: 0, sy: 0, view: null });

  // Initial window: galaxy + its own constellation bbox (+ padding), with a
  // sensible minimum span. RA normalized relative to the galaxy so a window
  // crossing the 0/360° seam still works.
  const frame = useMemo(() => {
    let ownLines = null;
    if (abbr && lineMap) {
      const key = Object.keys(lineMap).find((k) => k.toLowerCase() === String(abbr).toLowerCase());
      if (key) ownLines = lineMap[key].lines;
    }
    const norm = (r) => { let x = r - ra; if (x > 180) x -= 360; if (x < -180) x += 360; return ra + x; };
    const pts = [[ra, dec]];
    if (ownLines) ownLines.forEach((pl) => pl.forEach(([r, d]) => pts.push([r, d])));
    const ras = pts.map((p) => norm(p[0]));
    const decs = pts.map((p) => p[1]);
    let rMin = Math.min(...ras), rMax = Math.max(...ras);
    let dMin = Math.min(...decs), dMax = Math.max(...decs);
    const padR = Math.max((rMax - rMin) * 0.28, 9);
    const padD = Math.max((dMax - dMin) * 0.28, 7);
    rMin -= padR; rMax += padR; dMin -= padD; dMax += padD;
    const minSpanR0 = 16, minSpanD0 = 12;
    if (rMax - rMin < minSpanR0) { const c = (rMin + rMax) / 2; rMin = c - minSpanR0 / 2; rMax = c + minSpanR0 / 2; }
    if (dMax - dMin < minSpanD0) { const c = (dMin + dMax) / 2; dMin = c - minSpanD0 / 2; dMax = c + minSpanD0 / 2; }
    dMin = Math.max(-90, dMin); dMax = Math.min(90, dMax);
    const C = (rMin + rMax) / 2;
    return { rMin, rMax, dMin, dMax, C };
  }, [ra, dec, abbr, lineMap]);

  const maxSpanR = (frame.rMax - frame.rMin) * 1.6;
  const maxSpanD = (frame.dMax - frame.dMin) * 1.6;

  // Current interactive viewport — starts at the frame, resets when the
  // galaxy (or the line data) changes.
  const [view, setView] = useState(frame);
  useEffect(() => { setView(frame); }, [frame]);
  // keep a ref so the (once-bound) wheel handler reads the latest view
  const viewRef = useRef(view);
  viewRef.current = view;

  useEffect(() => {
    let live = true;
    loadLines().then((d) => { if (live) setLineMap(d); });
    return () => { live = false; };
  }, []);

  const { rMin, rMax, dMin, dMax, C } = view;
  const spanR = rMax - rMin, spanD = dMax - dMin;
  const xOf = useMemo(() => {
    const nC = C;
    return (r) => {
      let x = r - nC; if (x > 180) x -= 360; if (x < -180) x += 360;
      return IX0 + ((nC + x - rMin) / spanR) * IW;
    };
  }, [C, rMin, spanR]);
  const yOf = useMemo(() => ((d) => IY0 + ((dMax - d) / spanD) * IH), [dMax, spanD]);

  const gx = xOf(ra), gy = yOf(dec);

  // Visible constellations: stick-figures that intersect the window, plus
  // a label centroid (in pixel space) and a visible-point count for filtering.
  const visibleConsts = useMemo(() => {
    if (!lineMap) return [];
    const out = [];
    for (const [key, c] of Object.entries(lineMap)) {
      if (!c || !c.lines) continue;
      const isOwn = abbr && key.toLowerCase() === String(abbr).toLowerCase();
      if (!isOwn && !showNeighbors) continue;
      const segs = [];
      let anyInside = false;
      let sx = 0, sy = 0, n = 0;
      for (const pl of c.lines) {
        const pts = [];
        for (const [r, d] of pl) {
          const px = xOf(r), py = yOf(d);
          pts.push(`${px.toFixed(1)},${py.toFixed(1)}`);
          if (px >= IX0 - 6 && px <= IX1 + 6 && py >= IY0 - 6 && py <= IY1 + 6) {
            anyInside = true; sx += px; sy += py; n += 1;
          }
        }
        if (pts.length > 1) segs.push(pts.join(" "));
      }
      if (anyInside) {
        out.push({ key, isOwn, segs, lines: c.lines,
          label: { x: sx / n, y: sy / n, n } });
      }
    }
    return out;
  }, [lineMap, showNeighbors, abbr, xOf, yOf]);

  // Star dots at every vertex (real star positions).
  const starDots = useMemo(() => {
    const out = [];
    for (const c of visibleConsts) {
      for (const pl of c.lines) {
        for (const [r, d] of pl) {
          const px = xOf(r), py = yOf(d);
          if (px >= IX0 - 2 && px <= IX1 + 2 && py >= IY0 - 2 && py <= IY1 + 2) {
            out.push({ x: px, y: py, own: c.isOwn });
          }
        }
      }
    }
    return out;
  }, [visibleConsts, xOf, yOf]);

  const stepR = niceStep(spanR);
  const stepD = niceStep(spanD, 5);
  const raTicks = ticks(rMin, rMax, stepR);
  const decTicks = ticks(dMin, dMax, stepD);

  const locRects = useMemo(() => {
    if (spanR >= 360) return [[0, 360]];
    const lo = ((rMin % 360) + 360) % 360, hi = ((rMax % 360) + 360) % 360;
    if (lo <= hi) return [[lo, hi]];
    return [[lo, 360], [0, hi]];
  }, [rMin, rMax, spanR]);

  // ---- coordinate helpers for interactions --------------------------------
  function clientToSky(clientX, clientY, v) {
    const svg = svgRef.current;
    if (!svg) return null;
    const pt = svg.createSVGPoint();
    pt.x = clientX; pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const p = pt.matrixTransform(ctm.inverse());
    if (p.x < IX0 || p.x > IX1 || p.y < IY0 || p.y > IY1) return null;
    const raView = v.rMin + ((p.x - IX0) / IW) * (v.rMax - v.rMin);
    const decView = v.dMax - ((p.y - IY0) / IH) * (v.dMax - v.dMin);
    return { raView, dec: decView, px: p.x, py: p.y };
  }

  const zoomAt = useCallback((clientX, clientY, factor) => {
    const v = viewRef.current;
    const sky = clientToSky(clientX, clientY, v);
    const newSpanR = Math.max(MIN_SPAN_R, Math.min(maxSpanR, (v.rMax - v.rMin) * factor));
    const newSpanD = Math.max(MIN_SPAN_D, Math.min(maxSpanD, (v.dMax - v.dMin) * factor));
    let cR, cD;
    if (sky) {
      // keep the point under the cursor fixed
      const fR = (sky.raView - v.rMin) / (v.rMax - v.rMin);
      const fD = (v.dMax - sky.dec) / (v.dMax - v.dMin);
      cR = sky.raView + newSpanR * (0.5 - fR);
      cD = sky.dec + newSpanD * (0.5 - fD);
    } else {
      cR = (v.rMin + v.rMax) / 2;
      cD = (v.dMin + v.dMax) / 2;
    }
    setView(clampDec({ rMin: cR - newSpanR / 2, rMax: cR + newSpanR / 2,
      dMin: cD - newSpanD / 2, dMax: cD + newSpanD / 2, C: cR }));
  }, [maxSpanR, maxSpanD]);

  // native, non-passive wheel listener so we can preventDefault (stop page scroll)
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 0.8 : 1.25; // up = zoom in
      zoomAt(e.clientX, e.clientY, factor);
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  function onDown(e) {
    dragRef.current = { active: true, sx: e.clientX, sy: e.clientY, view: { ...viewRef.current } };
  }
  function onMove(e) {
    if (dragRef.current.active) {
      const d = dragRef.current;
      const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
      const v = d.view;
      const dRA = -(dx / IW) * (v.rMax - v.rMin);   // drag right → look left
      const dDec = +(dy / IH) * (v.dMax - v.dMin);   // drag down → look north
      let cR = (v.rMin + v.rMax) / 2 + dRA;
      let cD = (v.dMin + v.dMax) / 2 + dDec;
      const sR = v.rMax - v.rMin, sD = v.dMax - v.dMin;
      setView(clampDec({ rMin: cR - sR / 2, rMax: cR + sR / 2, dMin: cD - sD / 2, dMax: cD + sD / 2, C: cR }));
      return;
    }
    const sky = clientToSky(e.clientX, e.clientY, viewRef.current);
    setHover(sky ? { ra: (((sky.raView % 360) + 360) % 360), dec: sky.dec } : null);
  }
  function endDrag() { dragRef.current.active = false; }

  function zoomBtn(factor) {
    const cx = (IX0 + IX1) / 2, cy = (IY0 + IY1) / 2;
    // convert chart-center svg coords → client coords for zoomAt
    const svg = svgRef.current;
    if (!svg) return;
    const pt = svg.createSVGPoint(); pt.x = cx; pt.y = cy;
    const m = svg.getScreenCTM();
    if (!m) return;
    const c = pt.matrixTransform(m);
    zoomAt(c.x, c.y, factor);
  }

  const labelLeft = gx > VB_W - 230;
  const labelX = labelLeft ? gx - 14 : gx + 14;
  const labelAnchor = labelLeft ? "end" : "start";

  return (
    <div className="sky-map sky-map-interactive" style={{ width: "100%" }}>
      <div className="sky-map-toolbar">
        <button
          type="button"
          className={"sky-layer" + (showNeighbors ? " on" : "")}
          onClick={() => setShowNeighbors((s) => !s)}
        >
          {t("galaxy.layerNeighbors")}
        </button>
        <span className="sky-zoom-group">
          <button type="button" className="sky-zoom-btn" title={t("galaxy.zoomOut")}
            onClick={() => zoomBtn(1.4)}>−</button>
          <button type="button" className="sky-zoom-btn" title={t("galaxy.zoomIn")}
            onClick={() => zoomBtn(0.7)}>+</button>
          <button type="button" className="sky-zoom-btn sky-zoom-reset" title={t("galaxy.zoomReset")}
            onClick={() => setView(frame)}>⟲</button>
        </span>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={t("galaxy.skyPosTitle")}
        onMouseDown={onDown}
        onMouseMove={onMove}
        onMouseUp={endDrag}
        onMouseLeave={() => { endDrag(); setHover(null); }}
        style={{ cursor: dragRef.current.active ? "grabbing" : "grab" }}
      >
        <defs>
          <clipPath id="skyClip">
            <rect x={IX0} y={IY0} width={IW} height={IH} />
          </clipPath>
          <radialGradient id="skyBg" cx="50%" cy="42%" r="75%">
            <stop offset="0%" stopColor="#0c1024" />
            <stop offset="100%" stopColor="#06070f" />
          </radialGradient>
        </defs>
        <rect x={IX0} y={IY0} width={IW} height={IH} fill="url(#skyBg)" />
        <rect x={IX0} y={IY0} width={IW} height={IH} fill="none" stroke="rgba(237,238,245,.10)" />

        {/* grid + ticks */}
        {raTicks.map((r) => {
          const x = xOf(r);
          if (x < IX0 - 0.5 || x > IX1 + 0.5) return null;
          return (
            <g key={`rt${r}`}>
              <line x1={x} y1={IY0} x2={x} y2={IY1} stroke="rgba(120,140,180,.10)" strokeWidth="1" />
              <text x={x} y={VB_H - 8} textAnchor="middle" fill="rgba(160,180,220,.5)"
                fontSize="13" fontFamily="var(--font-mono)">{fmtRaHMS(r)}</text>
            </g>
          );
        })}
        {decTicks.map((d) => {
          const y = yOf(d);
          if (y < IY0 - 0.5 || y > IY1 + 0.5) return null;
          return (
            <g key={`dt${d}`}>
              <line x1={IX0} y1={y} x2={IX1} y2={y} stroke="rgba(120,140,180,.10)" strokeWidth="1" />
              <text x={IX0 - 8} y={y + 4} textAnchor="end" fill="rgba(160,180,220,.5)"
                fontSize="13" fontFamily="var(--font-mono)">{fmtDecDeg(d)}</text>
            </g>
          );
        })}

        {/* constellation lines + stars + labels, clipped to the chart */}
        <g clipPath="url(#skyClip)">
          {visibleConsts.map((c) => (
            <g key={c.key}>
              {c.segs.map((pts, i) => (
                <polyline key={i} points={pts} fill="none"
                  stroke={c.isOwn ? "rgba(232,185,77,.65)" : "rgba(150,170,220,.22)"}
                  strokeWidth={c.isOwn ? 2 : 1.1}
                  strokeLinecap="round" strokeLinejoin="round"
                  style={c.isOwn ? { filter: "drop-shadow(0 0 3px rgba(232,185,77,.4))" } : undefined}
                />
              ))}
            </g>
          ))}
          {starDots.map((s, i) => (
            <circle key={i} cx={s.x} cy={s.y} r={s.own ? 2.1 : 1.4}
              fill={s.own ? "rgba(232,185,77,.95)" : "rgba(220,225,245,.7)"} />
          ))}

          {/* constellation labels (own = full localized name gold; neighbors = abbr dim) */}
          {visibleConsts.map((c) => {
            if (!c.label || c.label.n < (c.isOwn ? 1 : 3)) return null;
            const full = constellationName(c.key, lang) || c.key;
            return (
              <text key={`lab${c.key}`} x={c.label.x} y={c.label.y}
                textAnchor="middle"
                fill={c.isOwn ? "var(--gold)" : "rgba(160,180,220,.5)"}
                fontSize={c.isOwn ? 14 : 11}
                fontFamily={c.isOwn ? "var(--font-display)" : "var(--font-mono)"}
                fontWeight={c.isOwn ? 700 : 500}
                style={c.isOwn ? { filter: "drop-shadow(0 0 4px rgba(0,0,0,.7))" } : undefined}
              >{c.isOwn ? full : c.key}</text>
            );
          })}

          {/* hover crosshair */}
          {hover && (
            <g pointerEvents="none">
              <line x1={xOf(hover.ra)} y1={IY0} x2={xOf(hover.ra)} y2={IY1} stroke="rgba(232,185,77,.3)" strokeWidth="1" />
              <line x1={IX0} y1={yOf(hover.dec)} x2={IX1} y2={yOf(hover.dec)} stroke="rgba(232,185,77,.3)" strokeWidth="1" />
              <circle cx={xOf(hover.ra)} cy={yOf(hover.dec)} r="3.5" fill="var(--gold)" />
            </g>
          )}
        </g>

        {/* galaxy marker + crosshair + label (above the clipped layer) */}
        <g className="sky-dot">
          <circle cx={gx} cy={gy} r="16" fill="rgba(232,185,77,.16)" />
          <circle cx={gx} cy={gy} r="7" fill="var(--gold)" />
          <circle cx={gx} cy={gy} r="7" fill="none" stroke="var(--gold)" strokeWidth="2" opacity=".7" />
        </g>
        <g stroke="rgba(232,185,77,.55)" strokeWidth="1.2" pointerEvents="none">
          <line x1={gx - 26} y1={gy} x2={gx - 14} y2={gy} />
          <line x1={gx + 14} y1={gy} x2={gx + 26} y2={gy} />
          <line x1={gx} y1={gy - 26} x2={gx} y2={gy - 14} />
          <line x1={gx} y1={gy + 14} x2={gx} y2={gy + 26} />
        </g>
        <line x1={gx} y1={gy} x2={labelX + (labelLeft ? -2 : 2)} y2={gy - 30}
          stroke="rgba(232,185,77,.45)" strokeWidth="1" pointerEvents="none" />
        <text x={labelX} y={gy - 34} textAnchor={labelAnchor} fill="var(--gold)"
          fontSize="15" fontFamily="var(--font-display)" fontWeight="700">{name}</text>
        {constName && (
          <text x={labelX} y={gy - 18} textAnchor={labelAnchor} fill="rgba(237,238,245,.7)"
            fontSize="12" fontFamily="var(--font-mono)">{constName}</text>
        )}

        {/* ---- locator inset (whole-sky overview, top-right) ---- */}
        <g transform={`translate(${IX1 - 168},${IY0 + 12})`}>
          <rect x="-6" y="-6" width="172" height="104" rx="8"
            fill="rgba(6,7,15,.82)" stroke="rgba(237,238,245,.14)" />
          <svg x="0" y="0" width="160" height="92" viewBox="0 0 360 180" overflow="hidden">
            <rect x="0" y="0" width="360" height="180" fill="#080a14" />
            <polyline points={MW.map(([r, d]) => `${sxOf(r)},${syOf(d)}`).join(" ")}
              fill="none" stroke="rgba(150,170,220,.18)" strokeWidth="11" strokeLinecap="round" />
            {locRects.map(([a, b], i) => (
              <rect key={i} x={sxOf(a)} y={syOf(Math.min(dMax, 90))} width={sxOf(b) - sxOf(a)}
                height={syOf(Math.max(dMin, -90)) - syOf(Math.min(dMax, 90))}
                fill="rgba(232,185,77,.10)" stroke="var(--gold)" strokeWidth="3" />
            ))}
            <circle cx={sxOf(((ra % 360) + 360) % 360)} cy={syOf(dec)} r="6" fill="none" stroke="var(--gold)" strokeWidth="3" />
            <circle cx={sxOf(((ra % 360) + 360) % 360)} cy={syOf(dec)} r="2.5" fill="var(--gold)" />
          </svg>
          <text x="2" y="100" fill="rgba(160,180,220,.55)" fontSize="10" fontFamily="var(--font-mono)">
            {t("galaxy.locator")}
          </text>
        </g>
      </svg>

      <div className="sky-map-foot">
        <div className="sky-readout">
          {hover
            ? `RA ${fmtRaHMS(hover.ra)} · Dec ${fmtDecDeg(hover.dec)}`
            : `${constName || name} · RA ${fmtRaHMS(ra)} · Dec ${fmtDecDeg(dec)}`}
        </div>
        <div className="sky-hint">{t("galaxy.zoomHint")}</div>
      </div>
    </div>
  );
}