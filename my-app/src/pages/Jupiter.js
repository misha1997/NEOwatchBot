// Jupiter planet page (/planetarium/jupiter). Ports templates/jupiter.html into
// the SPA, with the moon system driven by live data from /api/jupiter:
//   - hero: live geocentric distance + signal travel time (JPL de440s
//     ephemeris via skyfield) and the eight orbiting moons animated at their
//     REAL relative periods (Metis fastest, Callisto slowest);
//   - "moon system": ALL known satellites drawn on a TRUE linear scale (real
//     semi-major axes: 128 000 km Metis .. ~24 000 000 km outer irregulars,
//     a ~190× span), colored by real direction (prograde teal / retrograde
//     coral), animated at real relative angular speed, with a hover tooltip per
//     moon and the live count. The inner 8 moons cluster near the centre; a
//     CTA opens the fullscreen PixiJS explorer for deep zoom, real photos and
//     per-moon detail cards. The mini-map itself has no zoom/pan;
//   - next opposition: date served from the API, countdown ticks client-side.
// All prose is localized via `jupiter.*` i18n keys.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import SectionHead from "../components/primitives/SectionHead";
import { useSeo } from "../hooks/useSeo";
import { useApi } from "../hooks/useApi";
import { getJupiter } from "../lib/api";
import JupiterMoonSystemFullscreen from "./JupiterMoonSystemFullscreen";
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

// The eight moons shown in the moon-cards grid (and cycled by the detail
// modal prev/next). Keys match the `jupiter.moons.<key>` i18n entries and the
// lowercased catalog `name` from /api/jupiter.
const MOON_CARDS = ["metis", "adrastea", "amalthea", "thebe", "io", "europa", "ganymede", "callisto"];

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

function breakdown(ms) {
  const total = Math.max(0, ms);
  const days = Math.floor(total / 86400000);
  const hours = Math.floor((total % 86400000) / 3600000);
  const mins = Math.floor((total % 3600000) / 60000);
  return { days, hours, mins };
}

// Group digits with thin spaces (Ukrainian convention): 421800 -> "421 800".
function spacer(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
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
  const [showFullscreen, setShowFullscreen] = useState(false);
  // Moon detail modal (click a moon card) + the moon to focus in fullscreen.
  const [detailKey, setDetailKey] = useState(null);
  const [focusKey, setFocusKey] = useState(null);
  // Pinned moon selection in the mini-map: clicking a dot or its orbit keeps
  // that orbit highlighted (independent of hover). Toggle — click again to clear.
  const [selectedI, setSelectedI] = useState(null);

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

  // Moon detail modal: resolve live moon data for a card key (catalog name
  // lowercased equals the i18n card key).
  const moonByKey = (k) => moons.find((m) => m.name.toLowerCase() === k);

  // Moon detail modal keyboard nav + body scroll lock (mirrors the lightbox).
  useEffect(() => {
    if (detailKey === null) return;
    const onKey = (e) => {
      if (e.key === "Escape") setDetailKey(null);
      else if (e.key === "ArrowLeft")
        setDetailKey((k) =>
          k == null ? null : MOON_CARDS[(MOON_CARDS.indexOf(k) - 1 + MOON_CARDS.length) % MOON_CARDS.length]);
      else if (e.key === "ArrowRight")
        setDetailKey((k) =>
          k == null ? null : MOON_CARDS[(MOON_CARDS.indexOf(k) + 1) % MOON_CARDS.length]);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [detailKey]);
  const { days, hours, mins, passed } = useMemo(() => {
    const iso = data?.opposition_next_iso;
    const target = iso ? new Date(iso + "T00:00:00Z").getTime() : 0;
    if (!target) return { days: 0, hours: 0, mins: 0, passed: false, pending: true };
    const diff = target - now;
    if (diff <= 0) return { days: 0, hours: 0, mins: 0, passed: true };
    return { ...breakdown(diff), passed: false };
  }, [now, data]);

  // ---- full moon system: per-group counts for the legend ------------------
  const counts = useMemo(() => {
    const c = { ring: 0, galilean: 0, himalia: 0, ananke: 0, carme: 0, pasiphae: 0 };
    for (const m of moons) c[m.group] = (c[m.group] || 0) + 1;
    return c;
  }, [moons]);

  // ---- full moon system: per-moon static geometry --------------------------
  // Orbit radii are drawn on a TRUE linear scale (real semi-major axes a_km):
  // Metis (128 000 km) sits next to Jupiter and the outer irregulars
  // (~24 000 000 km) sit near the edge — a ~190× span. The inner 8 moons
  // therefore cluster tightly near the centre; this is the honest geometry and
  // matches the fullscreen PixiJS viewer. Only the angular animation is sped up.
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
      // The mini-map is a simplified overview: orbits drawn as circles (radius
      // = semi-major axis) and uniform angular motion. The accurate Keplerian
      // ellipses + variable speed live in the fullscreen viewer (toggle there).
      return { ...m, r, sgn, size, color: m.prograde ? "var(--teal)" : "var(--coral)" };
    });
  }, [moons]);

  // Jupiter disc radius, true-scaled to the same mapping as the orbits.
  const discR = useMemo(() => {
    const aMax = moons.length ? Math.max(...moons.map((m) => m.a_km)) : 24203300;
    return SYS.rMax * (JUPITER_RADIUS_KM / aMax);
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
    // Simplified circular motion: uniform angular speed, radius = semi-major
    // axis. (Keplerian ellipses + variable speed are in the fullscreen viewer.)
    const place = (m, total) => {
      const ang = (m.sgn * (m.m0_deg + (360 / m.period_d) * total) * Math.PI) / 180;
      return [SYS.cx + m.r * Math.cos(ang), SYS.cy - m.r * Math.sin(ang)];
    };
    // initial positions before first paint (no origin flash)
    for (let i = 0; i < geo.length; i++) {
      const [x, y] = place(geo[i], daysSinceEpoch);
      kids[i].setAttribute("cx", x.toFixed(2));
      kids[i].setAttribute("cy", y.toFixed(2));
    }
    let raf;
    // The outer moons barely move per second (periods of months–years at
    // TIME_SCALE=0.1), so the SVG dot repaint is capped at ~30 fps to keep the
    // 115-dot + 115-ring SVG cheap. simDays is derived from real elapsed time,
    // so throttling renders does not slow the motion — only the repaint rate.
    let lastRender = -1;
    const frame = (t) => {
      raf = requestAnimationFrame(frame);
      if (lastRender >= 0 && t - lastRender < 33) return;
      lastRender = t;
      const total = daysSinceEpoch + ((t - t0) / 1000) * TIME_SCALE;
      for (let i = 0; i < geo.length; i++) {
        const [x, y] = place(geo[i], total);
        kids[i].setAttribute("cx", x.toFixed(2));
        kids[i].setAttribute("cy", y.toFixed(2));
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [geo]);

  // Tooltip: enter/leave change `hover.i` (re-renders only the tooltip); the
  // cursor-follow drift writes directly to the tooltip DOM node so the 115
  // orbit circles are not re-rendered on every mousemove.
  const onMoonEnter = (i, e) => {
    const rect = e.currentTarget.ownerSVGElement.parentElement.getBoundingClientRect();
    setHover({ i, x: e.clientX - rect.left, y: e.clientY - rect.top });
  };
  const onMoonMove = (e) => {
    const tip = tipRef.current;
    if (!tip) return;
    const rect = e.currentTarget.ownerSVGElement.parentElement.getBoundingClientRect();
    tip.style.left = e.clientX - rect.left + 14 + "px";
    tip.style.top = e.clientY - rect.top + 14 + "px";
  };

  const fmtA = (a) =>
    a >= 1e6 ? (a / 1e6).toFixed(2) + " млн км" : spacer(Math.round(a)) + " км";
  const fmtP = (p) => (p < 1 ? (p * 24).toFixed(1) + " год" : p.toFixed(2) + " діб");
  const hm = hover != null ? geo[hover.i] : null;

  const polyPoints = GRS_POINTS.map((p) => `${p.x},${p.y}`).join(" ");
  const moreMoons = Math.max(0, count - HERO_MOONS.length);

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
            {MOON_CARDS.map((k) => {
              const md = moonByKey(k);
              const pro = md?.prograde !== false;
              return (
                <div
                  className="moon-card"
                  key={k}
                  role="button"
                  tabIndex={0}
                  onClick={() => setDetailKey(k)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setDetailKey(k); } }}
                >
                  <div className="photo">
                    <img
                      src={`/moons/${k}.png`}
                      alt={t("jupiter.moons." + k + ".name")}
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    />
                    <span className="tag">{t("jupiter.moons." + k + ".tag")}</span>
                    <span
                      className="moon-dir"
                      style={{ color: pro ? "var(--teal)" : "var(--coral)" }}
                      title={pro ? t("jupiter.moons.stat.dirPro") : t("jupiter.moons.stat.dirRetro")}
                    >
                      {pro ? "↻" : "↺"}
                    </span>
                  </div>
                  <div className="body">
                    <div className="moon-head">
                      <h4>{t("jupiter.moons." + k + ".name")}</h4>
                      {md && <span className="moon-group">{t("jupiter.system." + md.group)}</span>}
                    </div>
                    {md && (
                      <div className="moon-stats">
                        <div className="moon-stat">
                          <div className="l">{t("jupiter.moons.stat.diameter")}</div>
                          <div className="v">{md.diameter_km != null ? spacer(Math.round(md.diameter_km)) + " км" : t("jupiter.tooltip.dash")}</div>
                        </div>
                        <div className="moon-stat">
                          <div className="l">{t("jupiter.moons.stat.orbit")}</div>
                          <div className="v">{fmtA(md.a_km)}</div>
                        </div>
                        <div className="moon-stat">
                          <div className="l">{t("jupiter.moons.stat.ecc")}</div>
                          <div className="v">{md.e.toFixed(3)}</div>
                        </div>
                        <div className="moon-stat">
                          <div className="l">{t("jupiter.moons.stat.incl")}</div>
                          <div className="v">{md.i_deg.toFixed(1)}°</div>
                        </div>
                      </div>
                    )}
                    <p>{t("jupiter.moons." + k + ".desc")}</p>
                  </div>
                </div>
              );
            })}
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
              className="jup-sys-svg"
              viewBox={`0 0 ${SYS.vb} ${SYS.vb}`}
              xmlns="http://www.w3.org/2000/svg"
              role="img"
              aria-label={t("jupiter.system.title")}
            >
              {/* faint orbit circle per moon, at its true linear radius
                  (simplified — semi-major axis as a circle); highlighted when
                  hovered. Each ring is a pair: a visible thin circle
                  (pointer-events none) + an invisible wider hit circle that
                  drives hover/click so the orbit is easy to grab (a 1 px stroke
                  alone is nearly impossible to hover). Hovering or clicking the
                  ring sets hover.i, thickening the visible ring and showing the
                  moon's tooltip — same as interacting with the dot itself. */}
              {geo.map((m, i) => (
                <g key={m.name + "og"}>
                  <circle
                    className={"jup-orbit" + ((hover && hover.i === i) || selectedI === i ? " hl" : "")}
                    cx={SYS.cx} cy={SYS.cy} r={m.r}
                    stroke={m.color}
                    vectorEffect="non-scaling-stroke"
                    pointerEvents="none"
                  />
                  <circle
                    cx={SYS.cx} cy={SYS.cy} r={m.r}
                    fill="none"
                    stroke="transparent"
                    strokeWidth="10"
                    vectorEffect="non-scaling-stroke"
                    pointerEvents="stroke"
                    style={{ cursor: "help" }}
                    onMouseEnter={(e) => onMoonEnter(i, e)}
                    onMouseMove={onMoonMove}
                    onClick={(e) => { onMoonEnter(i, e); setSelectedI((p) => (p === i ? null : i)); }}
                    onMouseLeave={() => setHover(null)}
                  />
                </g>
              ))}
              <circle cx={SYS.cx} cy={SYS.cy} r={discR} fill="#C99B60" />
              <circle cx={SYS.cx} cy={SYS.cy} r={discR} fill="none" stroke="#8B5A2B" strokeWidth="1.5" opacity=".6" vectorEffect="non-scaling-stroke" />
              {/* moon dots — cx/cy set imperatively each frame by the rAF loop */}
              <g ref={dotsRef}>
                {geo.map((m, i) => (
                  <circle
                    key={m.name}
                    className={"jup-moon-dot" + (m.prograde ? "" : " retro") + (selectedI === i ? " sel" : "")}
                    r={m.size}
                    fill={m.color}
                    stroke="transparent" strokeWidth="8"
                    vectorEffect="non-scaling-stroke"
                    onMouseEnter={(e) => onMoonEnter(i, e)}
                    onMouseMove={onMoonMove}
                    onClick={() => setSelectedI((p) => (p === i ? null : i))}
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
            <button
              type="button"
              className="jup-sys-cta"
              onClick={() => setShowFullscreen(true)}
              aria-label={t("jupiter.system.fullscreen")}
              title={t("jupiter.system.fullscreenHint", { count: count || 0 })}
            >
              <span className="jup-sys-cta-ico">⛶</span>
              <span className="jup-sys-cta-tip">{t("jupiter.system.fullscreenHint", { count: count || 0 })}</span>
            </button>
          </div>
          <div className="jupiter-legend jup-legend">
            {GROUPS.map((g) => (
              <div className="legend-row" key={g.key}>
                <span className="legend-swatch" style={{ background: g.prograde ? "var(--teal)" : "var(--coral)" }} />
                {t("jupiter.system." + g.key)} · {counts[g.key] || 0}
              </div>
            ))}
          </div>
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

      {showFullscreen && (
        <JupiterMoonSystemFullscreen
          onClose={() => { setShowFullscreen(false); setFocusKey(null); }}
          initialMoonKey={focusKey}
        />
      )}

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

      {/* moon detail lightbox (click a moon card) */}
      {detailKey !== null && (() => {
        const md = moonByKey(detailKey);
        const pro = md?.prograde !== false;
        return (
          <div className="photo-modal open" onClick={() => setDetailKey(null)}>
            <div className="photo-modal-inner" onClick={(e) => e.stopPropagation()}>
              <div className="photo-modal-img"
                style={{ backgroundImage: `url("/moons/${detailKey}.png")` }}>
                <button className="photo-modal-close" onClick={() => setDetailKey(null)}
                  aria-label={t("mars.rovers.lightbox.close")}>✕</button>
                <button className="photo-modal-nav prev"
                  onClick={() => setDetailKey((k) => MOON_CARDS[(MOON_CARDS.indexOf(k) - 1 + MOON_CARDS.length) % MOON_CARDS.length])}
                  aria-label={t("mars.rovers.lightbox.prev")}>‹</button>
                <button className="photo-modal-nav next"
                  onClick={() => setDetailKey((k) => MOON_CARDS[(MOON_CARDS.indexOf(k) + 1) % MOON_CARDS.length])}
                  aria-label={t("mars.rovers.lightbox.next")}>›</button>
              </div>
              <div className="photo-modal-info">
                <div className="cat">{md ? t("jupiter.system." + md.group) : "—"}</div>
                <h3>{t("jupiter.moons." + detailKey + ".name")}</h3>
                <div className="d" style={{ color: pro ? "var(--teal)" : "var(--coral)" }}>
                  {pro ? "↻" : "↺"} {pro ? t("jupiter.moons.stat.dirPro") : t("jupiter.moons.stat.dirRetro")}
                </div>
                <p>{t("jupiter.moons." + detailKey + ".desc")}</p>
                {md && (
                  <>
                    <div className="dl-row"><span className="lbl">{t("jupiter.tooltip.diameter")}</span><span className="val">{md.diameter_km != null ? spacer(Math.round(md.diameter_km)) + " км" : t("jupiter.tooltip.dash")}</span></div>
                    <div className="dl-row"><span className="lbl">{t("jupiter.tooltip.a")}</span><span className="val">{fmtA(md.a_km)}</span></div>
                    <div className="dl-row"><span className="lbl">{t("jupiter.tooltip.period")}</span><span className="val">{fmtP(md.period_d)}</span></div>
                    <div className="dl-row"><span className="lbl">{t("jupiter.tooltip.eccentricity")}</span><span className="val">{md.e.toFixed(3)}</span></div>
                    <div className="dl-row"><span className="lbl">{t("jupiter.tooltip.inclination")}</span><span className="val">{md.i_deg.toFixed(1)}°</span></div>
                  </>
                )}
                <button type="button" className="moon-open-system"
                  onClick={() => { setFocusKey(detailKey); setDetailKey(null); setShowFullscreen(true); }}>
                  {t("jupiter.moons.stat.openFullscreen")} <span aria-hidden="true">↗</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}