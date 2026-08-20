// Mercury planet page (/planetarium/mercury). Ports templates/mercury.html into the SPA.
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import SectionHead from "../components/primitives/SectionHead";
import LocationPill from "../components/LocationPill";
import Moon from "../components/viz/Moon";
import { useSeo } from "../hooks/useSeo";
import { useApi } from "../hooks/useApi";
import { useLoc } from "../context/LocationContext";
import { getMercury, getPlanets } from "../lib/api";
import "../styles/planetarium.css";

const MONTH_KEYS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

function fmtEventDate(iso, t) {
  const d = new Date(iso);
  return d.getDate() + " " + t("common.months." + MONTH_KEYS[d.getMonth()]) + " " + d.getFullYear();
}

const MESSENGER_PHOTOS = [
  { key: "caloris", img_src: "/mercury/caloris.jpg", titleKey: "mercury.surface.c1", date: "MESSENGER" },
  { key: "rupes", img_src: "/mercury/rupes.jpg", titleKey: "mercury.surface.c2", date: "MESSENGER" },
  { key: "ice", img_src: "/mercury/ice.jpg", titleKey: "mercury.surface.c3", date: "MESSENGER" },
  { key: "surface", img_src: "/mercury/surface.jpg", titleKey: "mercury.surface.c4", date: "MESSENGER" },
];

// Gauge-style elongation diagram for the "best time to observe" card: an arc
// from the Sun (glowing, at the horizon end) up to Mercury's position at its
// current apparition, with the angle between them called out — same idea as
// a speedometer needle. Not to scale (the true elongation varies 18-28° per
// apparition and isn't in the data); Mercury/Sun colors match the ones
// already used in this page's resonance diagram (#FFD37A, #B7A08C/#E8E6D8).
function bezierPoint(p0, p1, p2, tt) {
  const mt = 1 - tt;
  return {
    x: mt * mt * p0.x + 2 * mt * tt * p1.x + tt * tt * p2.x,
    y: mt * mt * p0.y + 2 * mt * tt * p1.y + tt * tt * p2.y,
  };
}

function ElongationDiagram({ eastern, t }) {
  const w = 300, h = 168;
  const sun = eastern ? { x: 78, y: 138 } : { x: 222, y: 138 };
  const ctrl = { x: 150, y: 26 };
  const end = eastern ? { x: 260, y: 76 } : { x: 40, y: 76 };
  const merc = bezierPoint(sun, ctrl, end, 0.58);
  const gradId = "mercGaugeGrad" + (eastern ? "E" : "W");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} style={{ display: "block", maxWidth: 340, margin: "0 auto" }}>
      <defs>
        <linearGradient id={gradId} x1={eastern ? "0%" : "100%"} y1="100%" x2={eastern ? "100%" : "0%"} y2="0%">
          <stop offset="0%" stopColor="#FFD37A" />
          <stop offset="45%" stopColor="#8A6A5A" />
          <stop offset="100%" stopColor="#2a3050" />
        </linearGradient>
        <radialGradient id="mercGaugeSunGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#FFE8B0" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#FFD37A" stopOpacity="0" />
        </radialGradient>
      </defs>

      <path d={`M ${sun.x} ${sun.y} Q ${ctrl.x} ${ctrl.y} ${end.x} ${end.y}`}
        fill="none" stroke={`url(#${gradId})`} strokeWidth="3" strokeLinecap="round" opacity="0.85" />

      <circle cx={sun.x} cy={sun.y} r="30" fill="url(#mercGaugeSunGlow)" />
      <circle cx={sun.x} cy={sun.y} r="14" fill="#FFD37A" />

      <line x1={sun.x} y1={sun.y} x2={merc.x} y2={merc.y} stroke="#E8E6D8" strokeWidth="1" strokeDasharray="3,3" opacity="0.6" />
      <circle cx={merc.x} cy={merc.y} r="5" fill="#E8E6D8" />
      <circle cx={merc.x} cy={merc.y} r="9" fill="none" stroke="#E8E6D8" strokeOpacity="0.35" />
      <text x={(sun.x + merc.x) / 2} y={(sun.y + merc.y) / 2 - 10}
        fill="var(--text-dim)" fontSize="11" fontFamily="var(--font-mono)" textAnchor="middle">≤28°</text>

      <line x1="0" y1={h - 20} x2={w} y2={h - 20} stroke="var(--border)" strokeWidth="1" />
      <text x={w / 2} y={h - 4} fill="var(--text-dim)" fontSize="11" fontFamily="var(--font-mono)" textAnchor="middle">
        {eastern ? t("mercury.observe.westHorizon") : t("mercury.observe.eastHorizon")}
      </text>
    </svg>
  );
}

// Small hand-drawn line icons (no icon-library dependency) for the countdown
// segments and the upcoming-elongation rows.
function IconMoonStar({ size = 20, color = "var(--gold)" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" />
      <path d="M18 3v3M16.5 4.5h3" />
    </svg>
  );
}
function IconClock({ size = 20, color = "var(--gold)" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  );
}
function IconHourglass({ size = 20, color = "var(--gold)" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 3h12M6 21h12M7 3c0 5 4 6.5 5 8-1 1.5-5 3-5 8M17 3c0 5-4 6.5-5 8 1 1.5 5 3 5 8" />
    </svg>
  );
}
function IconSunSmall({ size = 15, color = "#fff" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="12" r="4.5" />
      <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
    </svg>
  );
}
function IconMoonSmall({ size = 15, color = "#fff" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke="none">
      <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" />
    </svg>
  );
}
function IconPhaseBadge({ size = 22, color = "var(--text-dim)" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" fill="none" stroke={color} strokeWidth="1.6" />
      <path d="M12 3a9 9 0 0 1 0 18Z" fill={color} />
    </svg>
  );
}

function breakdown(ms) {
  const total = Math.max(0, ms);
  const days = Math.floor(total / 86400000);
  const hours = Math.floor((total % 86400000) / 3600000);
  const mins = Math.floor((total % 3600000) / 60000);
  return { days, hours, mins };
}

export default function Mercury() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language || "uk";
  useSeo();
  
  useEffect(() => {
    document.title = t("title.mercury");
  }, [t]);

  const { data } = useApi(getMercury, { deps: [] });
  const { loc } = useLoc();
  const { data: planetsData } = useApi(() => getPlanets(loc, lang), {
    deps: [loc && loc.lat, loc && loc.lon, lang],
  });
  const mercuryNow = ((planetsData && planetsData.items) || []).find((r) => r.name_key === "mercury") || null;
  const upcoming = (data && data.elongations_upcoming) || [];

  // ---- hero live distance / signal -----------------------------------------
  const distStr = data?.distance_km
    ? Math.round(data.distance_km / 1e6) + " " + t("mercury.stats.distUnit")
    : t("mercury.stats.distance");
  const sigStr = data?.light_time_min != null
    ? (Math.round(data.light_time_min * 10) / 10) + " " + t("jupiter.opposition.mins")
    : t("mercury.stats.signal");

  // ---- greatest elongation countdown ---------------------------------------
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
        setModalIdx((i) => (i === null ? null : (i - 1 + MESSENGER_PHOTOS.length) % MESSENGER_PHOTOS.length));
      else if (e.key === "ArrowRight")
        setModalIdx((i) => (i === null ? null : (i + 1) % MESSENGER_PHOTOS.length));
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [modalIdx]);

  const { days, hours, mins, passed } = useMemo(() => {
    const iso = data?.elongation_next?.date_iso;
    const target = iso ? new Date(iso).getTime() : 0;
    const diff = target - now;
    if (diff <= 0) {
      return { days: 0, hours: 0, mins: 0, passed: true };
    }
    const { days, hours, mins } = breakdown(diff);
    return { days, hours, mins, passed: false };
  }, [data, now]);

  return (
    <>
      {/* ---------- hero ---------- */}
      <section className="hero">
        <div className="wrap hero-grid">
          <div>
            <div className="eyebrow">{t("mercury.hero.eyebrow")}</div>
            <h1 className="hero-title" dangerouslySetInnerHTML={{ __html: t("mercury.hero.title") }} />
            <p className="hero-sub">{t("mercury.hero.sub")}</p>
            
            <div className="stat-mini" style={{ marginTop: 26, maxWidth: 420 }}>
              <div className="box">
                <div className="n">{distStr}</div>
                <div className="l">{t("mercury.stats.distanceL")}</div>
              </div>
              <div className="box">
                <div className="n">{sigStr}</div>
                <div className="l">{t("mercury.stats.signalL")}</div>
              </div>
            </div>
          </div>
          
          <div className="orbit-wrap" style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
            <img
              src="/planets/Mercury.png"
              alt="Mercury"
              style={{
                width: "100%",
                maxWidth: "320px",
                height: "auto",
                filter: "drop-shadow(0 0 50px rgba(183, 160, 140, 0.35))",
              }}
              className="planet-hero-img planet-spin"
            />
          </div>
        </div>
      </section>

      {/* ---------- visible now, for the observer's location ---------- */}
      <section className="section" id="visible-now" style={{ paddingTop: 8 }}>
        <div className="wrap">
          <SectionHead eyebrow={t("mercury.visibleNow.eyebrow")} title={t("mercury.visibleNow.title")} />
          <LocationPill />
          <div className="grid cols-4" style={{ marginTop: 16 }}>
            <div className="card">
              <div className="k">{t("mercury.visibleNow.alt")}</div>
              <div className="v">
                {mercuryNow ? Math.round(mercuryNow.alt) : "—"}
                <span className="unit">°</span>
              </div>
              <div className="foot">
                {mercuryNow ? (mercuryNow.visible ? t("mercury.visibleNow.above") : t("mercury.visibleNow.below")) : ""}
              </div>
            </div>
            <div className="card">
              <div className="k">{t("mercury.visibleNow.az")}</div>
              <div className="v" style={{ fontSize: 20 }}>{mercuryNow ? mercuryNow.az_dir : "—"}</div>
              <div className="foot">{mercuryNow ? Math.round(mercuryNow.az) + "°" : ""}</div>
            </div>
            <div className="card">
              <div className="k">{t("mercury.visibleNow.mag")}</div>
              <div className="v">{mercuryNow && mercuryNow.mag != null ? mercuryNow.mag.toFixed(1) : "—"}</div>
              <div className="foot">{t("mercury.visibleNow.magFoot")}</div>
            </div>
            <div className="card">
              <div className="k">{t("mercury.visibleNow.status")}</div>
              <div className={"v" + (mercuryNow && mercuryNow.visible ? " accent" : "")} style={{ fontSize: 18 }}>
                {mercuryNow
                  ? (mercuryNow.visible ? t("mercury.visibleNow.visible") : t("mercury.visibleNow.notVisible"))
                  : t("mercury.visibleNow.loading")}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- mercury right now ---------- */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <SectionHead eyebrow={t("mercury.weather.eyebrow")} title={t("mercury.weather.title")} />
          
          <div className="grid cols-4">
            <div className="card">
              <div className="k">{t("mercury.weather.speedK")}</div>
              <div className="v">
                {t("mercury.weather.speedV")}
                <span className="unit">{t("mercury.weather.speedUnit")}</span>
              </div>
              <div className="foot">{t("mercury.weather.speedFoot")}</div>
            </div>
            
            <div className="card">
              <div className="k">{t("mercury.weather.rotK")}</div>
              <div className="v">
                {t("mercury.weather.rotV")}
                <span className="unit">{t("mercury.weather.rotUnit")}</span>
              </div>
              <div className="foot">{t("mercury.weather.rotFoot")}</div>
            </div>
            
            <div className="card">
              <div className="k">{t("mercury.weather.dayK")}</div>
              <div className="v">
                {t("mercury.weather.dayV")}
                <span className="unit">{t("mercury.weather.dayUnit")}</span>
              </div>
              <div className="foot">{t("mercury.weather.dayFoot")}</div>
            </div>
            
            <div className="card">
              <div className="k">{t("mercury.weather.atmosK")}</div>
              <div className="v">
                {t("mercury.weather.atmosV")}
                <span className="unit">{t("mercury.weather.atmosUnit")}</span>
              </div>
              <div className="foot">{t("mercury.weather.atmosFoot")}</div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- eccentric orbit ---------- */}
      <section className="section" id="orbit">
        <div className="wrap">
          <SectionHead eyebrow={t("mercury.orbit.eyebrow")} title={t("mercury.orbit.title")} />
          
          <div className="grid cols-2" style={{ alignItems: "center", gap: 32 }}>
            <div className="orbit-wrap" style={{ maxWidth: 440, margin: "0 auto" }}>
              <svg viewBox="0 0 480 480" xmlns="http://www.w3.org/2000/svg">
                <circle className="mars-orbit-ring" cx="175.4" cy="240.0" r="253.0" opacity=".5" />
                <text className="mars-moon-label" x="175.4" y="30.0" textAnchor="middle">
                  {t("mercury.orbit.scale")}
                </text>
                <ellipse className="comet-ellipse" cx="268.8" cy="240.0" rx="163.2" ry="133.8" />
                <path id="mercuryPath" d="M 432.0 240.0 A 163.2 133.8 0 1 1 105.6 240.0 A 163.2 133.8 0 1 1 432.0 240.0 Z" fill="none" opacity="0" />
                <circle cx="175.4" cy="240.0" r="9" fill="#FFD37A" />
                <circle cx="175.4" cy="240.0" r="16" fill="none" stroke="#FFD37A" strokeOpacity=".3" />
                <circle r="5" fill="#B7A08C">
                  <animateMotion dur="6s" repeatCount="indefinite" rotate="auto">
                    <mpath href="#mercuryPath" />
                  </animateMotion>
                </circle>
                <text className="mars-moon-label" x="105.6" y="258.0" textAnchor="middle">
                  {t("mercury.orbit.perihelion")}
                </text>
                <text className="mars-moon-label" x="432.0" y="228.0" textAnchor="middle">
                  {t("mercury.orbit.aphelion")}
                </text>
              </svg>
            </div>
            <div>
              <p style={{ color: "var(--text-dim)", fontSize: 14.5, lineHeight: 1.8 }}>
                {t("mercury.orbit.desc1")}
              </p>
              <p style={{ color: "var(--text-dim)", fontSize: 14.5, lineHeight: 1.8, marginTop: 14 }}>
                {t("mercury.orbit.desc2")}
              </p>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--text-dim)", marginTop: 22, borderLeft: "2px solid rgba(232,185,77,.4)", paddingLeft: 12, lineHeight: 1.6 }}>
                {t("mercury.orbit.footnote")}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- compare ---------- */}
      <section className="section">
        <div className="wrap">
          <SectionHead eyebrow={t("mercury.compare.eyebrow")} title={t("mercury.compare.title")} />
          
          <table className="data">
            <thead>
              <tr>
                <th>{t("jupiter.compare.param")}</th>
                <th>{t("mercury.compare.eyebrow").split(" ")[0]}</th>
                <th>{t("mercury.compare.eyebrow").split(" ").pop()}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{t("mercury.compare.p.day")}</td>
                <td className="mono">{t("mercury.compare.v.day.mercury")}</td>
                <td className="mono">{t("mercury.compare.v.day.earth")}</td>
              </tr>
              <tr>
                <td>{t("mercury.compare.p.year")}</td>
                <td className="mono">{t("mercury.compare.v.year.mercury")}</td>
                <td className="mono">{t("mercury.compare.v.year.earth")}</td>
              </tr>
              <tr>
                <td>{t("mercury.compare.p.gravity")}</td>
                <td className="mono">{t("mercury.compare.v.gravity.mercury")}</td>
                <td className="mono">{t("mercury.compare.v.gravity.earth")}</td>
              </tr>
              <tr>
                <td>{t("mercury.compare.p.diameter")}</td>
                <td className="mono">{t("mercury.compare.v.diameter.mercury")}</td>
                <td className="mono">{t("mercury.compare.v.diameter.earth")}</td>
              </tr>
              <tr>
                <td>{t("mercury.compare.p.temp")}</td>
                <td className="mono">{t("mercury.compare.v.temp.mercury")}</td>
                <td className="mono">{t("mercury.compare.v.temp.earth")}</td>
              </tr>
              <tr>
                <td>{t("mercury.compare.p.atmosphere")}</td>
                <td className="mono">{t("mercury.compare.v.atmosphere.mercury")}</td>
                <td className="mono">{t("mercury.compare.v.atmosphere.earth")}</td>
              </tr>
              <tr>
                <td>{t("mercury.compare.p.moons")}</td>
                <td className="mono">{t("mercury.compare.v.moons.mercury")}</td>
                <td className="mono">{t("mercury.compare.v.moons.earth")}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* ---------- resonance ---------- */}
      <section className="section" id="resonance">
        <div className="wrap">
          <SectionHead eyebrow={t("mercury.resonance.eyebrow")} title={t("mercury.resonance.title")} />
          
          <div className="grid cols-2" style={{ alignItems: "center" }}>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <svg viewBox="0 0 260 260" xmlns="http://www.w3.org/2000/svg">
                <g>
                  <circle cx="130.0" cy="130.0" r="58" fill="#8A7562" />
                  <circle cx="112.0" cy="120.0" r="7" fill="#6b5a4a" opacity=".6" />
                  <circle cx="144.0" cy="146.0" r="5" fill="#6b5a4a" opacity=".6" />
                  <circle cx="136.0" cy="108.0" r="4" fill="#6b5a4a" opacity=".6" />
                  <circle cx="120.0" cy="148.0" r="6" fill="#6b5a4a" opacity=".6" />
                  <circle cx="182.0" cy="130.0" r="4" fill="#FFD37A" />
                  <animateTransform attributeName="transform" type="rotate" from="0 130.0 130.0" to="1080 130.0 130.0" dur="12s" repeatCount="indefinite" />
                </g>
              </svg>
            </div>
            <div>
              <p style={{ color: "var(--text-dim)", fontSize: 14, lineHeight: 1.75 }}>
                {t("mercury.resonance.p1")}
              </p>
              <p style={{ color: "var(--text-dim)", fontSize: 14, lineHeight: 1.75, marginTop: 14 }}>
                {t("mercury.resonance.p2")}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- temperature ---------- */}
      <section className="section" id="temperature">
        <div className="wrap">
          <SectionHead eyebrow={t("mercury.temperature.eyebrow")} title={t("mercury.temperature.title")} />
          <p className="section-sub">{t("mercury.temperature.sub")}</p>
          
          <div className="depth-wrap" style={{ marginTop: 10 }}>
            <div className="depth-bar" style={{ background: "linear-gradient(to bottom, #E8622F, #E8B94D 35%, #4FD1C5 62%, #2E5C8A 82%, #12203A)" }} />
            <div className="depth-marks">
              <div className="pmark hl" style={{ top: "2%" }}>
                <span className="txt">{t("mercury.temperature.m1")}</span>
                <span className="ln" />
              </div>
              <div className="pmark" style={{ top: "30%" }}>
                <span className="txt">{t("mercury.temperature.m2")}</span>
                <span className="ln" />
              </div>
              <div className="pmark" style={{ top: "58%" }}>
                <span className="txt">{t("mercury.temperature.m3")}</span>
                <span className="ln" />
              </div>
              <div className="pmark" style={{ top: "80%" }}>
                <span className="txt">{t("mercury.temperature.m4")}</span>
                <span className="ln" />
              </div>
              <div className="pmark hl" style={{ top: "97%" }}>
                <span className="txt">{t("mercury.temperature.m5")}</span>
                <span className="ln" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- caloris basin ---------- */}
      <section className="section" id="caloris">
        <div className="wrap">
          <SectionHead eyebrow={t("mercury.surface.eyebrow")} title={t("mercury.surface.title")} />
          
          <div className="gal">
            {MESSENGER_PHOTOS.map((p, i) => (
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
          
          <div className="grid cols-3" style={{ marginTop: 22 }}>
            <div className="card">
              <div className="k">{t("mercury.surface.basink")}</div>
              <div className="v" style={{ fontSize: 20 }}>{t("mercury.surface.basinv")}</div>
              <div className="foot">{t("mercury.surface.basinfoot")}</div>
            </div>
            <div className="card">
              <div className="k">{t("mercury.surface.shrinkk")}</div>
              <div className="v" style={{ fontSize: 20 }}>{t("mercury.surface.shrinkv")}</div>
              <div className="foot">{t("mercury.surface.shrinkfoot")}</div>
            </div>
            <div className="card">
              <div className="k">{t("mercury.surface.corek")}</div>
              <div className="v" style={{ fontSize: 20 }}>{t("mercury.surface.corev")}</div>
              <div className="foot">{t("mercury.surface.corefoot")}</div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- missions ---------- */}
      <section className="section" id="mission-status">
        <div className="wrap">
          <SectionHead eyebrow={t("mercury.missions.eyebrow")} title={t("mercury.missions.title")} />
          
          <div className="card" style={{ padding: "8px 22px" }}>
            <div className="mission-row">
              <span className="dot live" />
              <span className="nm">{t("mercury.missions.bepi")}</span>
              <span className="ag">ESA / JAXA</span>
              <span className="yr">2018</span>
              <span className="st active">{t("mercury.missions.bepist")}</span>
            </div>
            <div className="mission-row">
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--text-dim)", display: "inline-block" }} />
              <span className="nm">{t("mercury.missions.messenger")}</span>
              <span className="ag">NASA</span>
              <span className="yr">2004</span>
              <span className="st retired">{t("mercury.missions.messengerst")}</span>
            </div>
            <div className="mission-row">
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--text-dim)", display: "inline-block" }} />
              <span className="nm">{t("mercury.missions.mariner")}</span>
              <span className="ag">NASA</span>
              <span className="yr">1973</span>
              <span className="st retired">{t("mercury.missions.marinerst")}</span>
            </div>
          </div>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)", marginTop: 12 }}>
            {t("mercury.missions.footnote")}
          </p>
        </div>
      </section>

      {/* ---------- best observation time ---------- */}
      <section className="section" id="observe">
        <div className="wrap">
          <SectionHead eyebrow={t("mercury.observe.eyebrow")} title={t("mercury.observe.title")} />

          {/* card 1: gauge diagram + headline + description */}
          <div className="card" style={{ padding: "22px 26px" }}>
            <div style={{
              fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.12em",
              textTransform: "uppercase", color: "var(--text-dim)",
            }}>
              {t("mercury.observe.overviewLabel")}
            </div>
            <div className="grid cols-2" style={{ alignItems: "center", gap: 24, marginTop: 8 }}>
              <ElongationDiagram eastern={data?.elongation_next?.type === "eastern"} t={t} />
              <div>
                <div style={{ fontSize: 19, fontWeight: 700 }}>
                  {t("mercury.observe.until")}
                  {data?.elongation_next && ` (${lang === "en" ? data.elongation_next.name_en : data.elongation_next.name_uk})`}
                </div>
                <p style={{ fontSize: 13.5, color: "var(--text-dim)", marginTop: 10, lineHeight: 1.7 }}>
                  {data?.elongation_next?.type === "eastern" ? t("mercury.observe.footEastern") : t("mercury.observe.footWestern")}
                </p>
              </div>
            </div>
          </div>

          {/* row: countdown-with-icons | phase */}
          <div className="grid cols-2" style={{ alignItems: "stretch", marginTop: 16 }}>
            <div className="card" style={{ padding: "20px 22px" }}>
              {passed ? (
                <div className="jupiter-opposition-now">{t("jupiter.opposition.passed")}</div>
              ) : (
                <div style={{ display: "flex", justifyContent: "space-around", textAlign: "center" }}>
                  <div>
                    <IconMoonStar />
                    <div className="v" style={{ fontSize: 28, marginTop: 8 }}>{days}</div>
                    <div className="foot">{t("mercury.observe.days")}</div>
                  </div>
                  <div>
                    <IconClock />
                    <div className="v" style={{ fontSize: 28, marginTop: 8 }}>{hours}</div>
                    <div className="foot">{t("mercury.observe.hours")}</div>
                  </div>
                  <div>
                    <IconHourglass />
                    <div className="v" style={{ fontSize: 28, marginTop: 8 }}>{mins}</div>
                    <div className="foot">{t("jupiter.opposition.mins")}</div>
                  </div>
                </div>
              )}
            </div>

            <div className="card" style={{ padding: "20px 22px", position: "relative", display: "flex", alignItems: "center", gap: 16 }}>
              <div style={{ position: "absolute", top: 16, right: 16 }}>
                <IconPhaseBadge />
              </div>
              <Moon illumination={mercuryNow ? mercuryNow.illum : 0.5} phase={mercuryNow && mercuryNow.waxing ? 0.25 : 0.75} size={64} />
              <div>
                <div className="v" style={{ fontSize: 30 }}>
                  {mercuryNow && mercuryNow.illum != null ? Math.round(mercuryNow.illum * 100) : "—"}
                  <span className="unit">%</span>
                </div>
                <div className="foot">
                  {mercuryNow ? (mercuryNow.waxing ? t("mercury.phase.waxing") : t("mercury.phase.waning")) : t("mercury.phase.title")}
                </div>
              </div>
            </div>
          </div>

          {/* upcoming elongations */}
          <div className="card" style={{ padding: "20px 22px", marginTop: 16 }}>
            <div style={{
              fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.12em",
              textTransform: "uppercase", color: "var(--text-dim)", marginBottom: 12,
            }}>
              {t("mercury.observe.upcomingK")}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {upcoming.map((e, i) => {
                const evening = e.type === "eastern";
                const tint = evening ? "232, 150, 80" : "90, 140, 220";
                return (
                  <div key={i} style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 14px", borderRadius: 10,
                    background: `linear-gradient(90deg, rgba(${tint},0.28), rgba(${tint},0.05))`,
                  }}>
                    {evening ? <IconSunSmall /> : <IconMoonSmall />}
                    <span style={{ fontSize: 13.5, flex: 1 }}>{lang === "en" ? e.name_en : e.name_uk}</span>
                    <span className="mono" style={{ fontSize: 12.5, color: `rgb(${tint})` }}>{fmtEventDate(e.date_iso, t)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ---------- facts ---------- */}
      <section className="section" id="facts">
        <div className="wrap">
          <SectionHead eyebrow={t("mercury.facts.eyebrow")} title={t("mercury.facts.title")} />
          
          <div className="grid cols-3">
            <div className="card">
              <div className="k">{t("mercury.facts.speedK")}</div>
              <div className="v" style={{ fontSize: 20 }}>{t("mercury.facts.speedV")}</div>
              <div className="foot">{t("mercury.facts.speedFoot")}</div>
            </div>
            <div className="card">
              <div className="k">{t("mercury.facts.moonsK")}</div>
              <div className="v" style={{ fontSize: 20 }}>{t("mercury.facts.moonsV")}</div>
              <div className="foot">{t("mercury.facts.moonsFoot")}</div>
            </div>
            <div className="card">
              <div className="k">{t("mercury.facts.transitK")}</div>
              <div className="v" style={{ fontSize: 20 }}>{t("mercury.facts.transitV")}</div>
              <div className="foot">{t("mercury.facts.transitFoot")}</div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- lightbox modal ---------- */}
      {modalIdx !== null && (
        <div className="photo-modal open" onClick={() => setModalIdx(null)}>
          <div className="photo-modal-inner" onClick={(e) => e.stopPropagation()}>
            <div className="photo-modal-img"
              style={{ backgroundImage: `url("${MESSENGER_PHOTOS[modalIdx].img_src}")`, backgroundSize: "cover", backgroundPosition: "center" }}>
              <button className="photo-modal-close" onClick={() => setModalIdx(null)}>✕</button>
              <button className="photo-modal-nav prev"
                onClick={() => setModalIdx((i) => (i - 1 + MESSENGER_PHOTOS.length) % MESSENGER_PHOTOS.length)}>‹</button>
              <button className="photo-modal-nav next"
                onClick={() => setModalIdx((i) => (i + 1) % MESSENGER_PHOTOS.length)}>›</button>
            </div>
            <div className="photo-modal-info">
              <div className="cat">MESSENGER · NASA</div>
              <h3>{t(MESSENGER_PHOTOS[modalIdx].titleKey)}</h3>
              <div className="d">{MESSENGER_PHOTOS[modalIdx].date}</div>
              <p>{t(MESSENGER_PHOTOS[modalIdx].titleKey + "Desc")}</p>
              <div className="dl-row"><span className="lbl">{t("mars.rovers.lightbox.camera")}</span><span className="val">MDIS</span></div>
              <div className="dl-row"><span className="lbl">{t("mars.rovers.lightbox.rover")}</span><span className="val">MESSENGER (NASA)</span></div>
              <div className="dl-row"><span className="lbl">{t("mars.rovers.lightbox.date")}</span><span className="val">2011–2015</span></div>
              <a className="section-link" style={{ marginTop: "auto", paddingTop: 18 }}
                href={MESSENGER_PHOTOS[modalIdx].img_src} target="_blank" rel="noopener noreferrer">
                {t("mars.rovers.lightbox.openFull")} ↗
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
