// Neptune planet page (/planetarium/neptune). Ports templates/neptune.html into the SPA.
import { useEffect, useMemo, useState, useLayoutEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import SectionHead from "../components/primitives/SectionHead";
import { useSeo } from "../hooks/useSeo";
import { useApi } from "../hooks/useApi";
import { getNeptune } from "../lib/api";
import NeptuneMoonSystemFullscreen from "./NeptuneMoonSystemFullscreen";
import "../styles/planetarium.css";

const EPOCH_MS = Date.UTC(2000, 0, 1, 12, 0, 0);
const TIME_SCALE = 0.1;
const SYS = { vb: 640, cx: 320, cy: 320, rMin: 32, rMax: 300 };
const NEPTUNE_RADIUS_KM = 24622;
const ORBIT_POWER = 1;

const HERO_MOONS = [
  { key: "despina", name: "Деспіна", r: 76, color: "#8A93A0", size: 1.8, m0: 120, p: 0.33, prograde: true },
  { key: "galatea", name: "Галатея", r: 88, color: "#8A93A0", size: 1.8, m0: 45, p: 0.43, prograde: true },
  { key: "larissa", name: "Ларисса", r: 102, color: "#93A0A8", size: 2.2, m0: 190, p: 0.55, prograde: true },
  { key: "proteus", name: "Протей", r: 118, color: "#A0A8B0", size: 2.8, m0: 280, p: 1.12, prograde: true },
  { key: "triton", name: "Тритон", r: 154, color: "var(--coral)", size: 4.0, m0: 87, p: 5.88, prograde: false },
  { key: "nereid", name: "Нереїда", r: 195, color: "#7A8290", size: 2.5, m0: 220, p: 360.13, prograde: true }
];
const HERO_SCALE = 3 / 0.33; // Despina rotates once in 3s

// Stylized hint of Neptune's faint planetary rings on the hero mini-map. The
// hero scale is non-linear (planet image inflated, outer moons compressed), so
// these are NOT to scale — just five faint concentric circles hugging the disc
// (between the planet edge at r=60 and the innermost moon Despina at r=76) as a
// visual cue that the rings exist. True, to-scale rings live in the fullscreen
// moon-system viewer. Order: innermost (Galle) → outermost (Adams, brightest).
const HERO_RINGS = [
  { r: 62, op: 0.16 }, // Galle — broad, very faint
  { r: 65, op: 0.50 }, // Le Verrier — narrow, bright
  { r: 68, op: 0.10 }, // Lassell — broad plateau, faintest
  { r: 71, op: 0.34 }, // Arago
  { r: 74, op: 0.55 }, // Adams — outermost, carries the arcs
];

const GROUPS = [
  { key: "inner", prograde: true },
  { key: "triton", prograde: false },
  { key: "nereid", prograde: true },
  { key: "outer", prograde: false }
];

function breakdown(ms) {
  const total = Math.max(0, ms);
  const days = Math.floor(total / 86400000);
  const hours = Math.floor((total % 86400000) / 3600000);
  const mins = Math.floor((total % 3600000) / 60000);
  return { days, hours, mins };
}

function spacer(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

const fmtA = (a) =>
  a >= 1e6 ? (a / 1e6).toFixed(2) + " млн км" : spacer(Math.round(a)) + " км";
const fmtP = (p) => (p < 1 ? (p * 24).toFixed(1) + " год" : p.toFixed(2) + " діб");

// The eight moons shown in the moon-cards grid (and cycled by the detail
// modal prev/next). Keys match the `neptune.moons.<key>` i18n entries and the
// lowercased catalog `name` from /api/neptune.
const MOON_CARDS = ["naiad", "thalassa", "despina", "galatea", "larissa", "proteus", "triton", "nereid"];

export default function Neptune() {
  const { t } = useTranslation();
  useSeo();

  useEffect(() => {
    document.title = t("title.neptune");
  }, [t]);

  const { data } = useApi(getNeptune, { deps: [] });
  const moons = useMemo(() => data?.moons ?? [], [data]);
  const count = data?.moons_count ?? 16;

  // ---- hero live distance / signal -----------------------------------------
  const distStr = data?.distance_km
    ? (Math.round(data.distance_km / 1e8) / 10) + " " + t("neptune.hero.distUnit")
    : "4.3 " + t("neptune.hero.distUnit");

  const sigStr = useMemo(() => {
    if (data?.light_time_min != null) {
      const totalMins = Math.round(data.light_time_min);
      const h = Math.floor(totalMins / 60);
      const m = totalMins % 60;
      return `${h} ${t("jupiter.opposition.hours")} ${m} ${t("jupiter.opposition.mins")}`;
    }
    return `4 ${t("jupiter.opposition.hours")} 10 ${t("jupiter.opposition.mins")}`;
  }, [data, t]);

  // ---- opposition countdown ------------------------------------------------
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  const { days, hours, mins, passed } = useMemo(() => {
    const iso = data?.opposition_next_iso;
    const target = iso ? new Date(iso + "T00:00:00Z").getTime() : 0;
    if (!target) return { days: 0, hours: 0, mins: 0, passed: false };
    const diff = target - now;
    if (diff <= 0) return { days: 0, hours: 0, mins: 0, passed: true };
    return { ...breakdown(diff), passed: false };
  }, [now, data]);

  // ---- dynamic moons system layout calculations -----------------------------
  const [hover, setHover] = useState(null); // { i, x, y }
  const [selectedI, setSelectedI] = useState(null);
  const [showFullscreen, setShowFullscreen] = useState(false);
  // Moon detail modal (click a moon card) + the moon to focus in fullscreen.
  const [detailKey, setDetailKey] = useState(null);
  const [focusKey, setFocusKey] = useState(null);

  // Resolve live moon data for a card key (catalog name lowercased equals key).
  const moonByKey = (k) => moons.find((m) => m.name.toLowerCase() === k);

  // Moon detail modal keyboard nav + body scroll lock.
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

  const dotsRef = useRef(null);
  const tipRef = useRef(null);

  const geo = useMemo(() => {
    if (!moons.length) return [];
    const aMax = Math.max(...moons.map((m) => m.a_km));

    const getMoonSize = (m) => {
      if (m.name.toLowerCase() === "triton") return 4.0;
      if (m.group === "inner") return 2.2;
      return 1.8;
    };

    return moons.map((m) => {
      const r = SYS.rMax * Math.pow(m.a_km / aMax, ORBIT_POWER);
      const sgn = m.prograde ? 1 : -1;
      const size = getMoonSize(m);
      return { ...m, r, sgn, size, color: m.prograde ? "var(--teal)" : "var(--coral)" };
    });
  }, [moons]);

  const discR = useMemo(() => {
    const aMax = moons.length ? Math.max(...moons.map((m) => m.a_km)) : 50624000;
    return SYS.rMax * Math.pow(NEPTUNE_RADIUS_KM / aMax, ORBIT_POWER);
  }, [moons]);

  const counts = useMemo(() => {
    const c = { inner: 0, triton: 0, nereid: 0, outer: 0 };
    for (const m of moons) c[m.group] = (c[m.group] || 0) + 1;
    return c;
  }, [moons]);

  useLayoutEffect(() => {
    if (!geo.length) return;
    const g = dotsRef.current;
    if (!g) return;
    const kids = g.children;
    const t0 = performance.now();
    const daysSinceEpoch = (Date.now() - EPOCH_MS) / 86400000;

    const place = (m, total) => {
      const ang = (m.sgn * (m.m0_deg + (360 / m.period_d) * total) * Math.PI) / 180;
      return [SYS.cx + m.r * Math.cos(ang), SYS.cy - m.r * Math.sin(ang)];
    };

    // Initial positioning
    for (let i = 0; i < geo.length; i++) {
      const [x, y] = place(geo[i], daysSinceEpoch);
      if (kids[i]) {
        kids[i].setAttribute("cx", x.toFixed(2));
        kids[i].setAttribute("cy", y.toFixed(2));
      }
    }

    let frameId;
    const tick = (t) => {
      const simDays = ((t - t0) / 1000) * TIME_SCALE;
      const total = daysSinceEpoch + simDays;
      for (let i = 0; i < geo.length; i++) {
        const [x, y] = place(geo[i], total);
        if (kids[i]) {
          kids[i].setAttribute("cx", x.toFixed(2));
          kids[i].setAttribute("cy", y.toFixed(2));
        }
      }
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frameId);
  }, [geo]);

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

  const hm = hover != null ? geo[hover.i] : null;
  const moreMoons = Math.max(0, count - HERO_MOONS.length);

  return (
    <>
      {/* ---------- hero ---------- */}
      <section className="hero">
        <div className="wrap hero-grid">
          <div>
            <div className="eyebrow">{t("neptune.hero.eyebrow")}</div>
            <h1 className="hero-title" dangerouslySetInnerHTML={{ __html: t("neptune.hero.title") }} />
            <p className="hero-sub">{t("neptune.hero.sub")}</p>
            
            <div className="stat-mini" style={{ marginTop: 26 }}>
              <div className="box">
                <div className="n">{distStr}</div>
                <div className="l">{t("neptune.hero.distL")}</div>
              </div>
              <div className="box">
                <div className="n">{sigStr}</div>
                <div className="l">{t("neptune.hero.signalL")}</div>
              </div>
            </div>
          </div>
          
          <div className="orbit-wrap">
            <svg viewBox="0 0 480 480" xmlns="http://www.w3.org/2000/svg">
              <circle cx="240" cy="240" r="195" fill="none" stroke="var(--border)" strokeWidth="1" strokeDasharray="1 5" opacity=".6" />
              {HERO_MOONS.map((m) => (
                <circle key={m.key + "o"} className="mars-orbit-ring" cx="240" cy="240" r={m.r} />
              ))}
              <image
                href="/planets/Neptune.png"
                x="180" y="180" width="120" height="120"
                className="jupiter-disc-img"
              />
              {/* Faint planetary rings — stylized hint (not to scale; the hero
                  layout is non-linear). True-scale rings are in the fullscreen
                  viewer. Drawn over the disc, under the moons. */}
              {HERO_RINGS.map((rg, i) => (
                <circle
                  key={"ring" + i}
                  className="neptune-ring"
                  cx="240" cy="240" r={rg.r}
                  opacity={rg.op}
                />
              ))}
              {HERO_MOONS.map((m) => (
                <g key={m.key}>
                  <circle cx={240 + m.r} cy="240" r={m.size} fill={m.color} />
                  <animateTransform
                    attributeName="transform" type="rotate"
                    from={`${m.m0} 240 240`} to={m.prograde ? `${m.m0 - 360} 240 240` : `${m.m0 + 360} 240 240`}
                    dur={(m.p * HERO_SCALE).toFixed(2) + "s"} repeatCount="indefinite" />
                </g>
              ))}
              <text className="mars-moon-label" x="240" y="150" textAnchor="middle">Ларисса</text>
              <text className="mars-moon-label" x="240" y="132" textAnchor="middle">Протей</text>
              <text className="mars-moon-label" x="240" y="96" textAnchor="middle" fill="var(--coral)">Тритон ↺</text>
              <text className="mars-moon-label" x="240" y="55" textAnchor="middle">Нереїда</text>
              <text className="mars-moon-label" x="240" y="458" textAnchor="middle" opacity=".7">
                {t("jupiter.hero.moreMoons", { n: moreMoons })}
              </text>
            </svg>
          </div>
        </div>
        <div className="wrap" style={{ marginTop: 8 }}>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)", textAlign: "center" }}>
            {t("neptune.hero.footnote")}
          </p>
        </div>
      </section>

      {/* ---------- neptune right now ---------- */}
      <section className="section" style={{ paddingTop: 8 }}>
        <div className="wrap">
          <SectionHead eyebrow={t("neptune.weather.eyebrow")} title={t("neptune.weather.title")} />
          
          <div className="grid cols-4">
            <div className="card">
              <div className="k">{t("neptune.weather.speedK")}</div>
              <div className="v">
                {t("neptune.weather.speedV")}
                <span className="unit">{t("neptune.weather.speedUnit")}</span>
              </div>
              <div className="foot">{t("neptune.weather.speedFoot")}</div>
            </div>
            
            <div className="card">
              <div className="k">{t("neptune.weather.tempK")}</div>
              <div className="v">
                {t("neptune.weather.tempV")}
                <span className="unit">{t("neptune.weather.tempUnit")}</span>
              </div>
              <div className="foot">{t("neptune.weather.tempFoot")}</div>
            </div>
            
            <div className="card">
              <div className="k">{t("neptune.weather.rotK")}</div>
              <div className="v">
                {t("neptune.weather.rotV")}
                <span className="unit">{t("neptune.weather.rotUnit")}</span>
              </div>
              <div className="foot">{t("neptune.weather.rotFoot")}</div>
            </div>
            
            <div className="card">
              <div className="k">{t("neptune.weather.revK")}</div>
              <div className="v">
                {t("neptune.weather.revV")}
                <span className="unit">{t("neptune.weather.revUnit")}</span>
              </div>
              <div className="foot">{t("neptune.weather.revFoot")}</div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- compare ---------- */}
      <section className="section">
        <div className="wrap">
          <SectionHead eyebrow={t("neptune.compare.eyebrow")} title={t("neptune.compare.title")} />
          
          <table className="data">
            <thead>
              <tr>
                <th>{t("jupiter.compare.param")}</th>
                <th>{t("nav.neptune")}</th>
                <th>{t("nav.earth")}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{t("neptune.compare.p.day")}</td>
                <td className="mono">{t("neptune.compare.v.day.neptune")}</td>
                <td className="mono">{t("neptune.compare.v.day.earth")}</td>
              </tr>
              <tr>
                <td>{t("neptune.compare.p.year")}</td>
                <td className="mono">{t("neptune.compare.v.year.neptune")}</td>
                <td className="mono">{t("neptune.compare.v.year.earth")}</td>
              </tr>
              <tr>
                <td>{t("neptune.compare.p.gravity")}</td>
                <td className="mono">{t("neptune.compare.v.gravity.neptune")}</td>
                <td className="mono">{t("neptune.compare.v.gravity.earth")}</td>
              </tr>
              <tr>
                <td>{t("neptune.compare.p.diameter")}</td>
                <td className="mono">{t("neptune.compare.v.diameter.neptune")}</td>
                <td className="mono">{t("neptune.compare.v.diameter.earth")}</td>
              </tr>
              <tr>
                <td>{t("neptune.compare.p.dist")}</td>
                <td className="mono">{t("neptune.compare.v.dist.neptune")}</td>
                <td className="mono">{t("neptune.compare.v.dist.earth")}</td>
              </tr>
              <tr>
                <td>{t("neptune.compare.p.density")}</td>
                <td className="mono">{t("neptune.compare.v.density.neptune")}</td>
                <td className="mono">{t("neptune.compare.v.density.earth")}</td>
              </tr>
              <tr>
                <td>{t("neptune.compare.p.moons")}</td>
                <td className="mono">{t("neptune.compare.v.moons.neptune")}</td>
                <td className="mono">{t("neptune.compare.v.moons.earth")}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* ---------- discovery ---------- */}
      <section className="section" id="discovery">
        <div className="wrap">
          <SectionHead eyebrow={t("neptune.discovery.eyebrow")} title={t("neptune.discovery.title")} />
          
          <div className="grid cols-2" style={{ alignItems: "center" }}>
            <div>
              <p style={{ color: "var(--text-dim)", fontSize: 14, lineHeight: 1.75 }}>
                {t("neptune.discovery.p1")}
              </p>
              <p style={{ color: "var(--text-dim)", fontSize: 14, lineHeight: 1.75, marginTop: 14 }}>
                {t("neptune.discovery.p2")}
              </p>
            </div>
            <div className="card" style={{ padding: 26 }}>
              <div className="k">{t("neptune.discovery.timeK")}</div>
              <div className="v" style={{ fontSize: 26 }}>
                {t("neptune.discovery.timeV")}
                <span className="unit">{t("neptune.discovery.timeUnit")}</span>
              </div>
              <div className="foot">{t("neptune.discovery.timeFoot")}</div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- dark spot ---------- */}
      <section className="section" id="dark-spot">
        <div className="wrap">
          <SectionHead eyebrow={t("neptune.darkSpot.eyebrow")} title={t("neptune.darkSpot.title")} />
          <p className="section-sub">{t("neptune.darkSpot.sub")}</p>
          
          <div className="grid cols-3" style={{ marginTop: 20 }}>
            <div className="card">
              <div className="k">{t("neptune.darkSpot.c1.title")}</div>
              <div className="v" style={{ fontSize: 20 }}>{t("neptune.darkSpot.c1.val")}</div>
              <div className="foot">{t("neptune.darkSpot.c1.foot")}</div>
            </div>
            <div className="card">
              <div className="k">{t("neptune.darkSpot.c2.title")}</div>
              <div className="v" style={{ fontSize: 20 }}>{t("neptune.darkSpot.c2.val")}</div>
              <div className="foot">{t("neptune.darkSpot.c2.foot")}</div>
            </div>
            <div className="card">
              <div className="k">{t("neptune.darkSpot.c3.title")}</div>
              <div className="v" style={{ fontSize: 20 }}>{t("neptune.darkSpot.c3.val")}</div>
              <div className="foot">{t("neptune.darkSpot.c3.foot")}</div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- rings ---------- */}
      <section className="section" id="rings">
        <div className="wrap">
          <SectionHead eyebrow={t("neptune.rings.eyebrow")} title={t("neptune.rings.title")} />
          <p className="section-sub">{t("neptune.rings.sub")}</p>
        </div>
      </section>

      {/* ---------- triton ---------- */}
      <section className="section" id="triton">
        <div className="wrap">
          <SectionHead eyebrow={t("neptune.triton.eyebrow")} title={t("neptune.triton.title")} />
          
          <div className="grid cols-3">
            <div className="card">
              <div className="k">{t("neptune.triton.c1.title")}</div>
              <div className="v" style={{ fontSize: 20 }}>{t("neptune.triton.c1.val")}</div>
              <div className="foot">{t("neptune.triton.c1.foot")}</div>
            </div>
            <div className="card">
              <div className="k">{t("neptune.triton.c2.title")}</div>
              <div className="v" style={{ fontSize: 20 }}>{t("neptune.triton.c2.val")}</div>
              <div className="foot">{t("neptune.triton.c2.foot")}</div>
            </div>
            <div className="card">
              <div className="k">{t("neptune.triton.c3.title")}</div>
              <div className="v" style={{ fontSize: 20 }}>{t("neptune.triton.c3.val")}</div>
              <div className="foot">{t("neptune.triton.c3.foot")}</div>
            </div>
          </div>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)", marginTop: 14 }}>
            {t("neptune.triton.footnote")}
          </p>
        </div>
      </section>

      {/* ---------- moons cards ---------- */}
      <section className="section" id="moons">
        <div className="wrap">
          <SectionHead
            eyebrow={t("neptune.moons.eyebrow")}
            title={t("neptune.moons.title_block")}
            sub={t("neptune.moons.sub_block")}
          />
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
                      alt={t("neptune.moons." + k + ".name")}
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    />
                    <span className="tag">{t("neptune.moons." + k + ".tag")}</span>
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
                      <h4>{t("neptune.moons." + k + ".name")}</h4>
                      {md && <span className="moon-group">{t("neptune.system." + md.group)}</span>}
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
                    <p>{t("neptune.moons." + k + ".desc")}</p>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="jupiter-moons-note">{t("neptune.moons.note")}</p>
        </div>
      </section>

      {/* ---------- full moon system (live, all moons on real orbits) ---------- */}
      <section className="section" id="moon-system">
        <div className="wrap">
          <SectionHead
            eyebrow={t("neptune.system.eyebrow", { count: count || 0 })}
            title={t("neptune.system.title")}
            sub={t("neptune.system.sub", { count: count || 0 })}
          />
          <div className="jup-sys-wrap orbit-wrap">
            <svg
              className="jup-sys-svg"
              viewBox={`0 0 ${SYS.vb} ${SYS.vb}`}
              xmlns="http://www.w3.org/2000/svg"
              role="img"
              aria-label={t("neptune.system.title")}
            >
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
              <circle cx={SYS.cx} cy={SYS.cy} r={discR} fill="#2E5CC9" />
              <circle cx={SYS.cx} cy={SYS.cy} r={discR} fill="none" stroke="#6FA8E8" strokeWidth="1.5" opacity=".6" vectorEffect="non-scaling-stroke" />
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
                <div className="jmt-row"><span>{t("jupiter.tooltip.group")}</span><b>{t("neptune.system." + hm.group)}</b></div>
                <div className="jmt-row"><span>{t("jupiter.tooltip.a")}</span><b>{fmtA(hm.a_km)}</b></div>
                <div className="jmt-row"><span>{t("jupiter.tooltip.period")}</span><b>{fmtP(hm.period_d)}</b></div>
                <div className="jmt-row"><span>{t("jupiter.tooltip.direction")}</span><b>{hm.prograde ? t("jupiter.tooltip.dirPro") : t("jupiter.tooltip.dirRetro")}</b></div>
                <div className="jmt-row"><span>{t("jupiter.tooltip.inclination")}</span><b>{hm.i_deg.toFixed(1)}°</b></div>
                <div className="jmt-row"><span>{t("jupiter.tooltip.eccentricity")}</span><b>{hm.e.toFixed(3)}</b></div>
                <div className="jmt-row"><span>{t("jupiter.tooltip.diameter")}</span><b>{hm.diameter_km != null ? spacer(Math.round(hm.diameter_km)) + " км" : t("jupiter.tooltip.dash")}</b></div>
              </div>
            )}
            {!geo.length && <div className="jup-sys-loading">{t("neptune.system.loading")}</div>}
            <button
              type="button"
              className="jup-sys-cta"
              onClick={() => setShowFullscreen(true)}
              aria-label={t("neptune.system.fullscreen")}
              title={t("neptune.system.fullscreenHint", { count: count || 0 })}
            >
              <span className="jup-sys-cta-ico">⛶</span>
              <span className="jup-sys-cta-tip">{t("neptune.system.fullscreenHint", { count: count || 0 })}</span>
            </button>
          </div>
          <div className="jupiter-legend jup-legend">
            {GROUPS.map((g) => (
              <div className="legend-row" key={g.key}>
                <span className="legend-swatch" style={{ background: g.prograde ? "var(--teal)" : "var(--coral)" }} />
                {t("neptune.system." + g.key)} · {counts[g.key] || 0}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- magnetic ---------- */}
      <section className="section" id="magnetic">
        <div className="wrap">
          <SectionHead eyebrow={t("neptune.magnetic.eyebrow")} title={t("neptune.magnetic.title")} />
          
          <div className="grid cols-3">
            <div className="card">
              <div className="k">{t("neptune.magnetic.c1.title")}</div>
              <div className="v" style={{ fontSize: 20 }}>{t("neptune.magnetic.c1.val")}</div>
              <div className="foot">{t("neptune.magnetic.c1.foot")}</div>
            </div>
            <div className="card">
              <div className="k">{t("neptune.magnetic.c2.title")}</div>
              <div className="v" style={{ fontSize: 20 }}>{t("neptune.magnetic.c2.val")}</div>
              <div className="foot">{t("neptune.magnetic.c2.foot")}</div>
            </div>
            <div className="card">
              <div className="k">{t("neptune.magnetic.c3.title")}</div>
              <div className="v" style={{ fontSize: 20 }}>{t("neptune.magnetic.c3.val")}</div>
              <div className="foot">{t("neptune.magnetic.c3.foot")}</div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- missions ---------- */}
      <section className="section" id="mission-status">
        <div className="wrap">
          <SectionHead eyebrow={t("neptune.missions.eyebrow")} title={t("neptune.missions.title")} />
          
          <div className="card" style={{ padding: "8px 22px" }}>
            <div className="mission-row">
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--text-dim)", display: "inline-block" }} />
              <span className="nm">{t("neptune.missions.v2")}</span>
              <span className="ag">NASA</span>
              <span className="yr">1989</span>
              <span className="st retired">{t("neptune.missions.v2st")}</span>
            </div>
            <div className="mission-row">
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--text-dim)", display: "inline-block" }} />
              <span className="nm">{t("neptune.missions.trident")}</span>
              <span className="ag">NASA</span>
              <span className="yr">proposed 2019</span>
              <span className="st retired">{t("neptune.missions.tridentst")}</span>
            </div>
          </div>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)", marginTop: 12 }}>
            {t("neptune.missions.footnote")}
          </p>
        </div>
      </section>

      {/* ---------- next opposition ---------- */}
      <section className="section" id="opposition">
        <div className="wrap">
          <SectionHead eyebrow={t("neptune.opposition.eyebrow")} title={t("neptune.opposition.title")} />
          
          <div className="grid cols-2" style={{ alignItems: "center" }}>
            <div className="card" style={{ padding: 26 }}>
              <div className="k">{t("neptune.opposition.until")}</div>
              
              {passed ? (
                <div className="jupiter-opposition-now">{t("jupiter.opposition.passed")}</div>
              ) : (
                <div className="clock" style={{ marginTop: 14 }}>
                  <div className="seg">
                    <div className="n">{String(days).padStart(2, "0")}</div>
                    <span className="u">{t("jupiter.opposition.days")}</span>
                  </div>
                  <div className="seg">
                    <div className="n">{String(hours).padStart(2, "0")}</div>
                    <span className="u">{t("jupiter.opposition.hours")}</span>
                  </div>
                  <div className="seg">
                    <div className="n">{String(mins).padStart(2, "0")}</div>
                    <span className="u">{t("jupiter.opposition.mins")}</span>
                  </div>
                </div>
              )}
              
              <div className="foot" style={{ marginTop: 14 }}>
                {t("neptune.opposition.foot")}
              </div>
            </div>
            
            <div className="card" style={{ padding: 26 }}>
              <div className="k">{t("neptune.opposition.findK")}</div>
              <p style={{ color: "var(--text-dim)", fontSize: 13.5, marginTop: 10, lineHeight: 1.7 }}>
                {t("neptune.opposition.findBody")}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- facts ---------- */}
      <section className="section" id="facts">
        <div className="wrap">
          <SectionHead eyebrow={t("neptune.facts.eyebrow")} title={t("neptune.facts.title")} />
          
          <div className="grid cols-3">
            <div className="card">
              <div className="k">{t("neptune.facts.c1.title")}</div>
              <div className="v" style={{ fontSize: 20 }}>{t("neptune.facts.c1.val")}</div>
              <div className="foot">{t("neptune.facts.c1.foot")}</div>
            </div>
            <div className="card">
              <div className="k">{t("neptune.facts.c2.title")}</div>
              <div className="v" style={{ fontSize: 20 }}>{t("neptune.facts.c2.val")}</div>
              <div className="foot">{t("neptune.facts.c2.foot")}</div>
            </div>
            <div className="card">
              <div className="k">{t("neptune.facts.c3.title")}</div>
              <div className="v" style={{ fontSize: 20 }}>{t("neptune.facts.c3.val")}</div>
              <div className="foot">{t("neptune.facts.c3.foot")}</div>
            </div>
          </div>
        </div>
      </section>

      {showFullscreen && (
        <NeptuneMoonSystemFullscreen
          onClose={() => { setShowFullscreen(false); setFocusKey(null); }}
          initialMoonKey={focusKey}
        />
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
                <div className="cat">{md ? t("neptune.system." + md.group) : "—"}</div>
                <h3>{t("neptune.moons." + detailKey + ".name")}</h3>
                <div className="d" style={{ color: pro ? "var(--teal)" : "var(--coral)" }}>
                  {pro ? "↻" : "↺"} {pro ? t("jupiter.moons.stat.dirPro") : t("jupiter.moons.stat.dirRetro")}
                </div>
                <p>{t("neptune.moons." + detailKey + ".desc")}</p>
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
