// Jupiter planet page (/planetarium/jupiter). Ports templates/jupiter.html into
// the SPA, with the moon system driven by live data from /api/jupiter:
//   - hero: live geocentric distance + signal travel time (JPL de440s
//     ephemeris via skyfield) and the eight orbiting moons animated at their
//     REAL relative periods (Metis fastest, Callisto slowest);
//   - "full moon system": ALL known satellites drawn on a TRUE linear scale
//     (real semi-major axes: 128 000 km Metis .. ~24 000 000 km outer irregulars,
//     a ~190× span), colored by real direction (prograde teal / retrograde
//     coral), animated at real relative angular speed, with a hover tooltip per
//     moon and the live count. The inner 8 moons cluster near the centre, so
//     zoom/pan is provided to inspect them;
//   - next opposition: date served from the API, countdown ticks client-side.
// All prose is localized via `jupiter.*` i18n keys.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import SectionHead from "../components/primitives/SectionHead";
import { useSeo } from "../hooks/useSeo";
import { useApi } from "../hooks/useApi";
import { getJupiter } from "../lib/api";
import "../styles/planetarium.css";

// Fresh imagery of Jupiter clouds (JunoCam flybys)
const JUNO_PHOTOS = [
  { key: "c1", img_src: "/juno/c1.jpg", titleKey: "jupiter.gallery.c1", date: "03.07.2026" },
  { key: "c2", img_src: "/juno/c2.jpg", titleKey: "jupiter.gallery.c2", date: "03.07.2026" },
  { key: "c3", img_src: "/juno/c3.jpg", titleKey: "jupiter.gallery.c3", date: "03.07.2026" },
  { key: "c4", img_src: "/juno/c4.jpg", titleKey: "jupiter.gallery.c4", date: "02.07.2026" },
];

// Jupiter-vs-Earth comparison rows. The parameter label and each cell value go
// through i18n (units differ per language).
const COMPARE_ROWS = ["day", "year", "gravity", "diameter", "mass", "atmosphere", "moons"];

// The eight moons shown in the hero animation, inner→outer. `key` resolves the
// name/tag/description/gradient via the `jupiter.moons.<key>` i18n entries;
// `name` is the catalog name; `m0` is the real mean anomaly (deg) at the JPL
// epoch; `p` is the real orbital period (days) so the SMIL duration is a true
// relative speed.
const HERO_MOONS = [
  { key: "metis", name: "Metis", r: 76, color: "#8A8578", size: 1.8, m0: 166.0, p: 0.294779 },
  { key: "adrastea", name: "Adrastea", r: 80, color: "#8A8578", size: 1.8, m0: 214.5, p: 0.298260 },
  { key: "amalthea", name: "Amalthea", r: 86, color: "#B08060", size: 1.8, m0: 310.6, p: 0.499918 },
  { key: "thebe", name: "Thebe", r: 90, color: "#7A7568", size: 1.8, m0: 182.1, p: 0.676105 },
  { key: "io", name: "Io", r: 104, color: "#E8D48A", size: 3, m0: 330.9, p: 1.762732 },
  { key: "europa", name: "Europa", r: 126, color: "#C9BFAE", size: 3, m0: 345.4, p: 3.525463 },
  { key: "ganymede", name: "Ganymede", r: 150, color: "#9C8F7E", size: 3, m0: 324.8, p: 7.155588 },
  { key: "callisto", name: "Callisto", r: 176, color: "#6E6459", size: 3, m0: 87.4, p: 16.690440 },
];
// Hero animation time scale: Metis (P=0.2948 d) completes one orbit in ~3 s, so
// every other moon's duration is a true multiple of its real period.
const HERO_SCALE = 3 / 0.294779;

// Radiation rows: Io, Europa, Ganymede, Callisto. `level` picks the dot color
// (warn=coral, gold, teal) and is read straight from the i18n entry.
const RADIATION = ["io", "europa", "ganymede", "callisto"];

// Mission status rows. `s` is "on" (active/in-flight) or "off" (retired/flyby).
const MISSIONS = [
  { n: "Juno", ag: "NASA", yr: "2016", st: "juno", s: "on" },
  { n: "Europa Clipper", ag: "NASA", yr: "2024", st: "clipper", s: "on" },
  { n: "JUICE", ag: "ESA", yr: "2023", st: "juice", s: "on" },
  { n: "Galileo", ag: "NASA", yr: "1995", st: "galileo", s: "off" },
  { n: "Voyager 1 і 2 (проліт)", ag: "NASA", yr: "1979", st: "voyager", s: "off" },
  { n: "New Horizons (проліт)", ag: "NASA", yr: "2007", st: "newhorizons", s: "off" },
];

// Six dynamical groups of the full moon system, in order inner→outer, with
// their real direction of motion (matches services/jupiter._group).
const GROUPS = [
  { key: "ring", prograde: true },
  { key: "galilean", prograde: true },
  { key: "himalia", prograde: true },
  { key: "ananke", prograde: false },
  { key: "carme", prograde: false },
  { key: "pasiphae", prograde: false },
];

// Great Red Spot shrinkage chart points (year, size) — SVG coords transcribed
// from templates/jupiter.html; the year label and thousand-km ticks are localized.
const GRS_POINTS = [
  { x: 44.0, y: 38.6, yr: "1880" }, { x: 140.7, y: 83.9, yr: "1920" },
  { x: 237.3, y: 134.8, yr: "1960" }, { x: 334.0, y: 140.5, yr: "1980" },
  { x: 430.7, y: 157.4, yr: "2000" }, { x: 527.3, y: 177.2, yr: "2014" },
  { x: 624.0, y: 197.0, yr: "2026" },
];
const GRS_KM_TICKS = [
  { y: 217.0, v: "10" }, { y: 160.4, v: "20" }, { y: 103.9, v: "30" }, { y: 47.3, v: "40" },
];

// Mean-element epoch for all catalog moons: 2000-01-01.5 TDB (noon UTC on Jan 1
// 2000). Used to propagate each moon's approximate current phase.
const EPOCH_MS = Date.UTC(2000, 0, 1, 12, 0, 0);
// Animation time compression: 1 real second ≈ 0.1 simulated days. All moons
// share this scale, so their relative angular speeds stay real (Metis whirls,
// the outer irregulars creep). 1:1 real time would be invisible (Metis takes
// 7 h per orbit; Kore ~2.1 yr).
const TIME_SCALE = 0.1;
// Full-system SVG geometry.
const SYS = { vb: 640, cx: 320, cy: 320, rMin: 32, rMax: 300 };
// Jupiter equatorial radius (km) — used to draw the planet disc true-scale
// relative to the moons' orbits (Metis, the innermost moon, orbits at 128 000 km,
// only ~1.8× the planet's radius).
const JUPITER_RADIUS_KM = 69911;
// Zoom limits for the full-system viewBox (square, so width == height).
const ZOOM_MIN_W = 6;  // max zoom-in viewBox width — allow deep zoom to inspect the inner system
const ZOOM_MAX_W = SYS.vb; // never zoom out past the full system

function breakdown(ms) {
  const total = Math.max(0, ms);
  const days = Math.floor(total / 86400000);
  const hours = Math.floor((total % 86400000) / 3600000);
  const mins = Math.floor((total % 3600000) / 60000);
  return { days, hours, mins };
}

// Group digits with thin spaces (Ukrainian convention): 421800 -> "421 800".
function spacer(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

export default function Jupiter() {
  const { t } = useTranslation();
  useSeo();
  useEffect(() => { document.title = t("title.jupiter"); }, [t]);

  const { data } = useApi(getJupiter, { deps: [] });
  const moons = useMemo(() => data?.moons ?? [], [data]);
  // 95 (the previously published count) is a no-flash placeholder until the
  // API responds with the real catalog count (115 as of this build).
  const count = data?.moons_count ?? 95;

  // ---- hero live distance / signal -----------------------------------------
  const distStr = data?.distance_km
    ? Math.round(data.distance_km / 1e6) + " " + t("jupiter.stats.distUnit")
    : t("jupiter.stats.distance");
  const sigStr = data?.light_time_min != null
    ? Math.round(data.light_time_min) + " " + t("jupiter.opposition.mins")
    : t("jupiter.stats.signal");

  // ---- opposition countdown (date from API; ticks client-side) -------------
  const [now, setNow] = useState(() => Date.now());
  const [modalIdx, setModalIdx] = useState(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  // Lightbox keyboard navigation + body scroll lock.
  useEffect(() => {
    if (modalIdx === null) return;
    const onKey = (e) => {
      if (e.key === "Escape") setModalIdx(null);
      else if (e.key === "ArrowLeft")
        setModalIdx((i) => (i === null ? null : (i - 1 + JUNO_PHOTOS.length) % JUNO_PHOTOS.length));
      else if (e.key === "ArrowRight")
        setModalIdx((i) => (i === null ? null : (i + 1) % JUNO_PHOTOS.length));
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [modalIdx]);
  const { days, hours, mins, passed } = useMemo(() => {
    const iso = data?.opposition_next_iso;
    const target = iso ? new Date(iso + "T00:00:00Z").getTime() : 0;
    if (!target) return { days: 0, hours: 0, mins: 0, passed: false, pending: true };
    const diff = target - now;
    if (diff <= 0) return { days: 0, hours: 0, mins: 0, passed: true };
    return { ...breakdown(diff), passed: false };
  }, [now, data]);

  // ---- full moon system: per-moon static geometry --------------------------
  // Orbit radii are drawn on a TRUE linear scale (real semi-major axes a_km),
  // not log-compressed: Metis (128 000 km) sits next to Jupiter and the outer
  // irregulars (~24 000 000 km) sit near the edge — a ~190× span. The inner 8
  // moons therefore cluster tightly near the centre; use zoom/pan to inspect
  // them. This is the honest geometry; only the angular animation is sped up.
  const geo = useMemo(() => {
    if (!moons.length) return [];
    const as = moons.map((m) => m.a_km);
    const aMax = Math.max(...as);

    const getMoonSize = (m) => {
      if (m.diameter_km != null) {
        return Math.pow(m.diameter_km, 0.15);
      }
      if (m.group === "himalia") {
        return Math.pow(20, 0.15);
      }
      return Math.pow(3, 0.15);
    };

    return moons.map((m) => {
      const r = SYS.rMax * (m.a_km / aMax);
      const sgn = m.prograde ? 1 : -1;
      const size = getMoonSize(m);
      return { ...m, r, sgn, size, color: m.prograde ? "var(--teal)" : "var(--coral)" };
    });
  }, [moons]);

  // Jupiter disc radius, true-scaled to the same mapping as the orbits:
  // JUPITER_RADIUS_KM (69,911 km) mapped proportionally to the outermost moon's a_km.
  const discR = useMemo(() => {
    const aMax = moons.length ? Math.max(...moons.map((m) => m.a_km)) : 24203300;
    return SYS.rMax * (JUPITER_RADIUS_KM / aMax);
  }, [moons]);

  const counts = useMemo(() => {
    const c = { ring: 0, galilean: 0, himalia: 0, ananke: 0, carme: 0, pasiphae: 0 };
    for (const m of moons) c[m.group] = (c[m.group] || 0) + 1;
    return c;
  }, [moons]);

  // ---- full moon system: animation (imperative, one rAF for all dots) ------
  const dotsRef = useRef(null);
  const tipRef = useRef(null);
  const [hover, setHover] = useState(null); // { i, x, y }
  useLayoutEffect(() => {
    if (!geo.length) return;
    const g = dotsRef.current;
    if (!g) return;
    const kids = g.children;
    const t0 = performance.now();
    const daysSinceEpoch = (Date.now() - EPOCH_MS) / 86400000;
    const place = (m, simDays) => {
      const total = daysSinceEpoch + simDays;
      const ang = (m.sgn * (m.m0_deg + (360 / m.period_d) * total) * Math.PI) / 180;
      return [SYS.cx + m.r * Math.cos(ang), SYS.cy - m.r * Math.sin(ang)];
    };
    // initial positions before first paint (no origin flash)
    for (let i = 0; i < geo.length; i++) {
      const [x, y] = place(geo[i], 0);
      kids[i].setAttribute("cx", x.toFixed(2));
      kids[i].setAttribute("cy", y.toFixed(2));
    }
    let raf;
    const frame = (t) => {
      const simDays = ((t - t0) / 1000) * TIME_SCALE;
      for (let i = 0; i < geo.length; i++) {
        const [x, y] = place(geo[i], simDays);
        kids[i].setAttribute("cx", x.toFixed(2));
        kids[i].setAttribute("cy", y.toFixed(2));
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [geo]);

  // ---- full moon system: zoom + pan of the SVG viewBox ----------------------
  // The moon dots are positioned imperatively in the fixed 0..640 SYS space
  // (see the rAF loop above); zoom/pan only reframes the viewBox, so the
  // animation keeps running untouched at any zoom level.
  const sysSvgRef = useRef(null);
  const viewRef = useRef({ x: 0, y: 0, w: SYS.vb, h: SYS.vb });
  const dragRef = useRef(null); // { x, y, v } while dragging

  const clampView = (v) => {
    const margin = v.w * 0.15;
    const x = Math.max(-margin, Math.min(SYS.vb - v.w + margin, v.x));
    const y = Math.max(-margin, Math.min(SYS.vb - v.h + margin, v.y));
    return { ...v, x, y };
  };

  const applyView = useCallback((v) => {
    viewRef.current = v;
    const svg = sysSvgRef.current;
    if (!svg) return;
    svg.setAttribute("viewBox", `${v.x.toFixed(2)} ${v.y.toFixed(2)} ${v.w.toFixed(2)} ${v.w.toFixed(2)}`);

    const g = dotsRef.current;
    if (!g) return;
    const kids = g.children;
    if (kids.length === geo.length) {
      const scale = v.w / SYS.vb;
      for (let i = 0; i < geo.length; i++) {
        const size = geo[i].size;
        kids[i].setAttribute("r", (size * scale).toFixed(2));
        kids[i].setAttribute("stroke-width", (8 * scale).toFixed(2));
      }
    }
  }, [geo]);

  // Wheel zoom must preventDefault(), which React's synthetic onWheel can't do
  // (passive root listener) — attach a native non-passive listener instead.
  useEffect(() => {
    const svg = sysSvgRef.current;
    if (!svg) return;
    const onWheel = (e) => {
      e.preventDefault();
      const rect = svg.getBoundingClientRect();
      const v = viewRef.current;
      const sx = v.x + ((e.clientX - rect.left) / rect.width) * v.w;
      const sy = v.y + ((e.clientY - rect.top) / rect.height) * v.h;
      const factor = e.deltaY < 0 ? 0.82 : 1.22;
      const w = Math.max(ZOOM_MIN_W, Math.min(ZOOM_MAX_W, v.w * factor));
      const x = sx - (sx - v.x) * (w / v.w);
      const y = sy - (sy - v.y) * (w / v.w);
      applyView(clampView({ x, y, w, h: w }));
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, [geo, applyView]); // Re-attach wheel listener if geo length changes so kids.length matches

  const onPointerDown = (e) => {
    if (e.button !== 0) return;
    dragRef.current = { x: e.clientX, y: e.clientY, v: { ...viewRef.current } };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    const rect = sysSvgRef.current.getBoundingClientRect();
    const dx = ((e.clientX - d.x) / rect.width) * d.v.w;
    const dy = ((e.clientY - d.y) / rect.height) * d.v.h;
    applyView(clampView({ x: d.v.x - dx, y: d.v.y - dy, w: d.v.w, h: d.v.h }));
  };
  const onPointerUp = (e) => {
    dragRef.current = null;
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* noop */ }
  };

  const zoomBtn = (factor) => {
    const v = viewRef.current;
    const sx = v.x + v.w / 2;
    const sy = v.y + v.h / 2;
    const w = Math.max(ZOOM_MIN_W, Math.min(ZOOM_MAX_W, v.w * factor));
    const x = sx - (sx - v.x) * (w / v.w);
    const y = sy - (sy - v.y) * (w / v.w);
    applyView(clampView({ x, y, w, h: w }));
  };
  const resetView = () => applyView({ x: 0, y: 0, w: SYS.vb, h: SYS.vb });

  const onMoonEnter = (i, e) => {
    const rect = e.currentTarget.ownerSVGElement.parentElement.getBoundingClientRect();
    setHover({ i, x: e.clientX - rect.left, y: e.clientY - rect.top });
  };
  // Tooltip drift follows the cursor via direct DOM writes (no per-move re-render
  // of the 115 orbit circles — only enter/leave change `hover.i`).
  const onMoonMove = (e) => {
    const tip = tipRef.current;
    if (!tip) return;
    const rect = e.currentTarget.ownerSVGElement.parentElement.getBoundingClientRect();
    tip.style.left = e.clientX - rect.left + 14 + "px";
    tip.style.top = e.clientY - rect.top + 14 + "px";
  };

  const polyPoints = GRS_POINTS.map((p) => `${p.x},${p.y}`).join(" ");
  const moreMoons = Math.max(0, count - HERO_MOONS.length);

  const fmtA = (a) =>
    a >= 1e6 ? (a / 1e6).toFixed(2) + " млн км" : spacer(Math.round(a)) + " км";
  const fmtP = (p) => (p < 1 ? (p * 24).toFixed(1) + " год" : p.toFixed(2) + " діб");
  const hm = hover != null ? geo[hover.i] : null;

  return (
    <>
      {/* ---------- hero ---------- */}
      <section className="hero">
        <div className="wrap hero-grid jupiter-hero-grid">
          <div>
            <div className="eyebrow">{t("jupiter.hero.eyebrow")}</div>
            <h1 className="hero-title" dangerouslySetInnerHTML={{ __html: t("jupiter.hero.title") }} />
            <p className="hero-sub">{t("jupiter.hero.sub")}</p>
            <div className="stat-mini" style={{ marginTop: 26 }}>
              <div className="box"><div className="n">{distStr}</div><div className="l">{t("jupiter.stats.distanceL")}</div></div>
              <div className="box"><div className="n">{sigStr}</div><div className="l">{t("jupiter.stats.signalL")}</div></div>
            </div>
            <p className="jupiter-hero-note">{t("jupiter.stats.note")}</p>
          </div>
          <div className="orbit-wrap">
            <svg viewBox="0 0 480 480" xmlns="http://www.w3.org/2000/svg">
              <circle cx="240" cy="249.6" r="195" fill="none" stroke="var(--border)" strokeWidth="1" strokeDasharray="1 5" opacity=".6" />
              {HERO_MOONS.map((m) => (
                <circle key={m.key + "o"} className="mars-orbit-ring" cx="240" cy="249.6" r={m.r} />
              ))}
              <image
                href="/planets/Jupiter.png"
                x="174" y="183.6" width="132" height="132"
                className="jupiter-disc-img"
              />
              {HERO_MOONS.map((m) => (
                <g key={m.key}>
                  <circle cx={240 + m.r} cy="249.6" r={m.size} fill={m.color} />
                  <animateTransform
                    attributeName="transform" type="rotate"
                    from={`${m.m0} 240 249.6`} to={`${m.m0 - 360} 240 249.6`}
                    dur={(m.p * HERO_SCALE).toFixed(2) + "s"} repeatCount="indefinite" />
                </g>
              ))}
              <text className="mars-moon-label" x="240" y="137.6" textAnchor="middle">{t("jupiter.hero.io")}</text>
              <text className="mars-moon-label" x="240" y="115.6" textAnchor="middle">{t("jupiter.hero.europa")}</text>
              <text className="mars-moon-label" x="240" y="91.6" textAnchor="middle">{t("jupiter.hero.ganymede")}</text>
              <text className="mars-moon-label" x="240" y="65.6" textAnchor="middle">{t("jupiter.hero.callisto")}</text>
              <text className="mars-moon-label" x="240" y="458.6" textAnchor="middle" opacity=".7">
                {t("jupiter.hero.moreMoons", { n: moreMoons })}
              </text>
            </svg>
          </div>
        </div>
      </section>

      {/* ---------- atmosphere dashboard ---------- */}
      <section className="section" id="weather" style={{ paddingTop: 8 }}>
        <div className="wrap">
          <SectionHead gold eyebrow={t("jupiter.weather.eyebrow")} title={t("jupiter.weather.title")} />
          <div className="grid cols-4">
            <div className="card">
              <div className="k">{t("jupiter.weather.grsK")} <span className="dot warn" /></div>
              <div className="v">{t("jupiter.weather.grsV")}<span className="unit">{t("jupiter.weather.grsUnit")}</span></div>
              <div className="foot">{t("jupiter.weather.grsFoot")}</div>
            </div>
            <div className="card">
              <div className="k">{t("jupiter.weather.windK")}</div>
              <div className="v">{t("jupiter.weather.windV")}<span className="unit">{t("jupiter.weather.windUnit")}</span></div>
              <div className="foot">{t("jupiter.weather.windFoot")}</div>
            </div>
            <div className="card">
              <div className="k">{t("jupiter.weather.tempK")}</div>
              <div className="v">{t("jupiter.weather.tempV")}<span className="unit">{t("jupiter.weather.tempUnit")}</span></div>
              <div className="foot">{t("jupiter.weather.tempFoot")}</div>
            </div>
            <div className="card">
              <div className="k">{t("jupiter.weather.rotK")}</div>
              <div className="v">{t("jupiter.weather.rotV")}<span className="unit">{t("jupiter.weather.rotUnit")}</span></div>
              <div className="foot">{t("jupiter.weather.rotFoot")}</div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- jupiter vs earth ---------- */}
      <section className="section">
        <div className="wrap">
          <SectionHead eyebrow={t("jupiter.compare.eyebrow")} title={t("jupiter.compare.title")} />
          <table className="data">
            <thead>
              <tr><th>{t("jupiter.compare.param")}</th><th>{t("nav.jupiter")}</th><th>{t("nav.earth")}</th></tr>
            </thead>
            <tbody>
              {COMPARE_ROWS.map((k) => (
                <tr key={k}>
                  <td>{t("jupiter.compare.p." + k)}</td>
                  <td className="mono">{t("jupiter.compare.v." + k + ".jupiter", { count: count || 95 })}</td>
                  <td className="mono">{t("jupiter.compare.v." + k + ".earth")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ---------- moons ---------- */}
      <section className="section" id="moons">
        <div className="wrap">
          <SectionHead eyebrow={t("jupiter.moons.eyebrow")} title={t("jupiter.moons.title")} sub={t("jupiter.moons.sub", { count: count || 95 })} />
          <div className="grid cols-4">
            {["metis", "adrastea", "amalthea", "thebe", "io", "europa", "ganymede", "callisto"].map((k) => (
              <div className="moon-card" key={k}>
                <div className="photo">
                  <img
                    src={`/moons/${k}.jpg`}
                    alt={t("jupiter.moons." + k + ".name")}
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                  />
                  <span className="tag">{t("jupiter.moons." + k + ".tag")}</span>
                </div>
                <div className="body">
                  <h4>{t("jupiter.moons." + k + ".name")}</h4>
                  <p>{t("jupiter.moons." + k + ".desc")}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="jupiter-moons-note">{t("jupiter.moons.note")}</p>
        </div>
      </section>

      {/* ---------- full moon system (live, all moons on real orbits) ---------- */}
      <section className="section" id="moon-system">
        <div className="wrap">
          <SectionHead
            eyebrow={t("jupiter.system.eyebrow", { count: count || 0 })}
            title={t("jupiter.system.title")}
            sub={t("jupiter.system.sub", { count: count || 0 })}
          />
          <div className="jup-sys-wrap orbit-wrap">
            <svg
              ref={sysSvgRef}
              className="jup-sys-svg"
              viewBox={`${viewRef.current.x} ${viewRef.current.y} ${viewRef.current.w} ${viewRef.current.h}`}
              xmlns="http://www.w3.org/2000/svg"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              {/* faint orbit circle per moon, at its real (log-compressed) radius;
                  highlighted when hovered */}
              {geo.map((m, i) => (
                <circle
                  key={m.name + "o"}
                  className={"jup-orbit" + (hover && hover.i === i ? " hl" : "")}
                  cx={SYS.cx} cy={SYS.cy} r={m.r}
                  stroke={m.color}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
              <circle cx={SYS.cx} cy={SYS.cy} r={discR} fill="#C99B60" />
              <circle cx={SYS.cx} cy={SYS.cy} r={discR} fill="none" stroke="#8B5A2B" strokeWidth="1.5" opacity=".6" vectorEffect="non-scaling-stroke" />
              {/* moon dots — cx/cy set imperatively each frame by the rAF loop */}
              <g ref={dotsRef}>
                {geo.map((m, i) => (
                  <circle
                    key={m.name}
                    className={"jup-moon-dot" + (m.prograde ? "" : " retro")}
                    r={(m.size * (viewRef.current.w / SYS.vb)).toFixed(2)}
                    fill={m.color}
                    stroke="transparent" strokeWidth={(8 * (viewRef.current.w / SYS.vb)).toFixed(2)}
                    vectorEffect="non-scaling-stroke"
                    onMouseEnter={(e) => onMoonEnter(i, e)}
                    onMouseMove={onMoonMove}
                    onMouseLeave={() => setHover(null)}
                  />
                ))}
              </g>
            </svg>
            {hm && (
              <div
                ref={tipRef}
                className="jup-moon-tooltip"
                style={{ left: hover.x + 14, top: hover.y + 14 }}
              >
                <div className="jmt-name">{hm.name_uk}</div>
                <div className="jmt-row"><span>{t("jupiter.tooltip.group")}</span><b>{t("jupiter.system." + hm.group)}</b></div>
                <div className="jmt-row"><span>{t("jupiter.tooltip.a")}</span><b>{fmtA(hm.a_km)}</b></div>
                <div className="jmt-row"><span>{t("jupiter.tooltip.period")}</span><b>{fmtP(hm.period_d)}</b></div>
                <div className="jmt-row"><span>{t("jupiter.tooltip.direction")}</span><b>{hm.prograde ? t("jupiter.tooltip.dirPro") : t("jupiter.tooltip.dirRetro")}</b></div>
                <div className="jmt-row"><span>{t("jupiter.tooltip.inclination")}</span><b>{hm.i_deg.toFixed(1)}°</b></div>
                <div className="jmt-row"><span>{t("jupiter.tooltip.eccentricity")}</span><b>{hm.e.toFixed(3)}</b></div>
                <div className="jmt-row"><span>{t("jupiter.tooltip.diameter")}</span><b>{hm.diameter_km != null ? spacer(Math.round(hm.diameter_km)) + " км" : t("jupiter.tooltip.dash")}</b></div>
              </div>
            )}
            {!geo.length && <div className="jup-sys-loading">{t("jupiter.system.loading")}</div>}
            <div className="jup-sys-controls">
              <button type="button" onClick={() => zoomBtn(0.8)} aria-label={t("jupiter.system.zoomIn")}>＋</button>
              <button type="button" onClick={() => zoomBtn(1.25)} aria-label={t("jupiter.system.zoomOut")}>－</button>
              <button type="button" onClick={resetView} aria-label={t("jupiter.system.zoomReset")}>↺</button>
            </div>
          </div>
          <div className="jupiter-legend jup-legend">
            {GROUPS.map((g) => (
              <div className="legend-row" key={g.key}>
                <span className="legend-swatch" style={{ background: g.prograde ? "var(--teal)" : "var(--coral)" }} />
                {t("jupiter.system." + g.key)} · {counts[g.key] || 0}
              </div>
            ))}
          </div>
          <p className="jupiter-moons-note">{t("jupiter.system.scaleNote")}</p>
        </div>
      </section>

      {/* ---------- great red spot shrinkage ---------- */}
      <section className="section" id="grs-history">
        <div className="wrap">
          <SectionHead eyebrow={t("jupiter.grs.eyebrow")} title={t("jupiter.grs.title")} sub={t("jupiter.grs.sub")} />
          <div className="grs-wrap">
            <svg viewBox="0 0 640 240" xmlns="http://www.w3.org/2000/svg">
              <polyline points={polyPoints} fill="none" stroke="var(--coral)" strokeWidth="2" strokeLinecap="round" />
              {GRS_POINTS.map((p) => (
                <circle key={p.yr} cx={p.x} cy={p.y} r="3.5" fill="var(--coral)" />
              ))}
              {GRS_POINTS.map((p) => (
                <text key={p.yr + "x"} className="grs-axis" x={p.x} y="234" textAnchor="middle">{p.yr}</text>
              ))}
              {GRS_KM_TICKS.map((tk) => (
                <text key={tk.v} className="grs-axis" x="38" y={tk.y} textAnchor="end">{tk.v} {t("jupiter.grs.km")}</text>
              ))}
            </svg>
          </div>
        </div>
      </section>

      {/* ---------- depth scale ---------- */}
      <section className="section" id="depth">
        <div className="wrap">
          <SectionHead eyebrow={t("jupiter.depth.eyebrow")} title={t("jupiter.depth.title")} sub={t("jupiter.depth.sub")} />
          <div className="depth-wrap">
            <div className="depth-bar" />
            <div className="depth-marks">
              <div className="pmark" style={{ top: "2%" }}><span className="txt">{t("jupiter.depth.m0")}</span><span className="ln" /></div>
              <div className="pmark" style={{ top: "28%" }}><span className="txt">{t("jupiter.depth.m1")}</span><span className="ln" /></div>
              <div className="pmark hl" style={{ top: "58%" }}><span className="txt">{t("jupiter.depth.m2")}</span><span className="ln" /></div>
              <div className="pmark" style={{ top: "82%" }}><span className="txt">{t("jupiter.depth.m3")}</span><span className="ln" /></div>
              <div className="pmark" style={{ top: "97%" }}><span className="txt">{t("jupiter.depth.m4")}</span><span className="ln" /></div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- gallery (JunoCam) ---------- */}
      <section className="section" id="gallery">
        <div className="wrap">
          <SectionHead eyebrow={t("jupiter.gallery.eyebrow")} title={t("jupiter.gallery.title")} />
          <div className="gal">
            {JUNO_PHOTOS.map((p, i) => (
              <div
                key={p.key}
                className="rover-photo clickable"
                style={{ backgroundImage: `url(${p.img_src})`, backgroundSize: "cover", backgroundPosition: "center" }}
                onClick={() => setModalIdx(i)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setModalIdx(i); } }}
              >
                <span className="zoom-hint">{t("mars.rovers.lightbox.hint")}</span>
                <div className="info">{t(p.titleKey)}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- radiation ---------- */}
      <section className="section" id="radiation">
        <div className="wrap">
          <SectionHead eyebrow={t("jupiter.radiation.eyebrow")} title={t("jupiter.radiation.title")} />
          <div className="card" style={{ padding: "8px 22px" }}>
            {RADIATION.map((k) => {
              const level = t("jupiter.radiation." + k + ".level");
              const color = level === "teal" ? "var(--teal)" : level === "gold" ? "var(--gold)" : "var(--coral)";
              const stActive = level === "teal";
              return (
                <div className="mission-row" key={k}>
                  <span className="moon-radiation-dot" style={{ background: color }} />
                  <span className="nm">{t("jupiter.moons." + k + ".name")}</span>
                  <span className="ag">{t("jupiter.radiation." + k + ".zone")}</span>
                  <span className={"st " + (stActive ? "active" : "retired")}>{t("jupiter.radiation." + k + ".dose")}</span>
                </div>
              );
            })}
          </div>
          <p className="jupiter-radiation-note">{t("jupiter.radiation.note")}</p>
        </div>
      </section>

      {/* ---------- mission status ---------- */}
      <section className="section" id="mission-status">
        <div className="wrap">
          <SectionHead eyebrow={t("jupiter.missions.eyebrow")} title={t("jupiter.missions.title")} />
          <div className="card" style={{ padding: "8px 22px" }}>
            {MISSIONS.map((m) => (
              <div className="mission-row" key={m.n}>
                <span className={m.s === "on" ? "dot live" : "dot-off"} />
                <span className="nm">{m.n}</span>
                <span className="ag">{m.ag}</span>
                <span className="yr">{m.yr}</span>
                <span className={"st " + (m.s === "on" ? "active" : "retired")}>{t("jupiter.missions." + m.st)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- next opposition (live countdown) ---------- */}
      <section className="section" id="opposition">
        <div className="wrap">
          <SectionHead eyebrow={t("jupiter.opposition.eyebrow")} title={t("jupiter.opposition.title")} />
          <div className="grid cols-2" style={{ alignItems: "center" }}>
            <div className="card" style={{ padding: 26 }}>
              <div className="k">{t("jupiter.opposition.until")}</div>
              {passed ? (
                <div className="jupiter-opposition-now">{t("jupiter.opposition.passed")}</div>
              ) : (
                <div className="clock" style={{ marginTop: 14 }}>
                  <div className="seg"><div className="n">{String(days).padStart(2, "0")}</div><span className="u">{t("jupiter.opposition.days")}</span></div>
                  <div className="seg"><div className="n">{String(hours).padStart(2, "0")}</div><span className="u">{t("jupiter.opposition.hours")}</span></div>
                  <div className="seg"><div className="n">{String(mins).padStart(2, "0")}</div><span className="u">{t("jupiter.opposition.mins")}</span></div>
                </div>
              )}
              <div className="foot" style={{ marginTop: 14 }}>{t("jupiter.opposition.foot")}</div>
            </div>
            <div className="card" style={{ padding: 26 }}>
              <div className="k">{t("jupiter.opposition.whatTitle")}</div>
              <p style={{ color: "var(--text-dim)", fontSize: 13.5, marginTop: 10, lineHeight: 1.7 }}>{t("jupiter.opposition.whatBody")}</p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- facts ---------- */}
      <section className="section" id="facts">
        <div className="wrap">
          <SectionHead eyebrow={t("jupiter.facts.eyebrow")} title={t("jupiter.facts.title")} />
          <div className="grid cols-3">
            <div className="card">
              <div className="k">{t("jupiter.facts.magnetic")}</div>
              <div className="v" style={{ fontSize: 20 }}>{t("jupiter.facts.magneticV")}</div>
              <div className="foot">{t("jupiter.facts.magneticFoot")}</div>
            </div>
            <div className="card">
              <div className="k">{t("jupiter.facts.star")}</div>
              <div className="v" style={{ fontSize: 20 }}>{t("jupiter.facts.starV")}</div>
              <div className="foot">{t("jupiter.facts.starFoot")}</div>
            </div>
            <div className="card">
              <div className="k">{t("jupiter.facts.rings")}</div>
              <div className="v" style={{ fontSize: 20 }}>{t("jupiter.facts.ringsV")}</div>
              <div className="foot">{t("jupiter.facts.ringsFoot")}</div>
            </div>
          </div>
        </div>
      </section>

      {modalIdx !== null && (
        <div className="photo-modal open" onClick={() => setModalIdx(null)}>
          <div className="photo-modal-inner" onClick={(e) => e.stopPropagation()}>
            <div className="photo-modal-img"
              style={{ backgroundImage: `url("${JUNO_PHOTOS[modalIdx].img_src}")` }}>
              <button className="photo-modal-close" onClick={() => setModalIdx(null)}>✕</button>
              <button className="photo-modal-nav prev"
                onClick={() => setModalIdx((i) => (i - 1 + JUNO_PHOTOS.length) % JUNO_PHOTOS.length)}>‹</button>
              <button className="photo-modal-nav next"
                onClick={() => setModalIdx((i) => (i + 1) % JUNO_PHOTOS.length)}>›</button>
            </div>
            <div className="photo-modal-info">
              <div className="cat">JunoCam · NASA</div>
              <h3>{t(JUNO_PHOTOS[modalIdx].titleKey)}</h3>
              <div className="d">{JUNO_PHOTOS[modalIdx].date}</div>
              <p>{t("jupiter.gallery.c3Desc") || t("jupiter.weather.grsFoot") || "Свіжий детальний знімок атмосфери Юпітера від космічного апарату Juno (NASA)."}</p>
              <div className="dl-row"><span className="lbl">{t("mars.rovers.lightbox.camera")}</span><span className="val">JunoCam</span></div>
              <div className="dl-row"><span className="lbl">{t("mars.rovers.lightbox.rover")}</span><span className="val">Juno (NASA)</span></div>
              <div className="dl-row"><span className="lbl">{t("mars.rovers.lightbox.date")}</span><span className="val">{JUNO_PHOTOS[modalIdx].date}</span></div>
              <a className="section-link" style={{ marginTop: "auto", paddingTop: 18 }}
                href={JUNO_PHOTOS[modalIdx].img_src} target="_blank" rel="noopener noreferrer">
                {t("mars.rovers.lightbox.openFull")} ↗
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}