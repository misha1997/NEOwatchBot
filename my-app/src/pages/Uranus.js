// Uranus planet page (/planetarium/uranus). Ports templates/uranus.html into the SPA.
import { useEffect, useLayoutEffect, useMemo, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import SectionHead from "../components/primitives/SectionHead";
import { useSeo } from "../hooks/useSeo";
import { useApi } from "../hooks/useApi";
import { getUranus } from "../lib/api";
import UranusMoonSystemFullscreen from "./UranusMoonSystemFullscreen";
import "../styles/planetarium.css";

const EPOCH_MS = Date.UTC(2000, 0, 1, 12, 0, 0);
const TIME_SCALE = 0.1;
const SYS = { vb: 640, cx: 320, cy: 320, rMin: 32, rMax: 300 };
const ORBIT_POWER = 1;

const HERO_MOONS = [
  { key: "miranda", name: "Міранда", r: 84, color: "#B0A89A", size: 3.5, m0: 120, p: 1.41, prograde: true },
  { key: "ariel", name: "Аріель", r: 102, color: "#C9C2B4", size: 4.0, m0: 45, p: 2.52, prograde: true },
  { key: "umbriel", name: "Умбріель", r: 120, color: "#8A8375", size: 4.6, m0: 190, p: 4.14, prograde: true },
  { key: "titania", name: "Титанія", r: 145, color: "#A69D8E", size: 5.3, m0: 280, p: 8.71, prograde: true },
  { key: "oberon", name: "Оберон", r: 168, color: "#948C7E", size: 6.0, m0: 87, p: 13.46, prograde: true }
];
const HERO_SCALE = 3 / 1.41; // Miranda rotates once in 3s

// Stylized hint of Uranus's faint planetary rings on the hero mini-map. The
// hero scale is non-linear (planet image inflated, outer moons compressed), so
// these are NOT to scale — just faint concentric circles hugging the disc
// (between the planet edge at r=60 and the innermost moon Miranda at r=84) as a
// visual cue that the rings exist. The epsilon ring (brightest, most opaque)
// sits outermost of the hint set. True, to-scale rings live in the fullscreen
// moon-system viewer.
const HERO_RINGS = [
  { r: 63, op: 0.12 }, // zeta — broad, very faint (inner)
  { r: 66, op: 0.25 }, // alpha/beta
  { r: 69, op: 0.35 }, // gamma/delta
  { r: 72, op: 0.55 }, // epsilon — narrow, brightest
  { r: 76, op: 0.10 }, // nu — broad, faint (outer)
];

function spacer(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

const fmtA = (a) =>
  a >= 1e6 ? (a / 1e6).toFixed(2) + " млн км" : spacer(Math.round(a)) + " км";
const fmtP = (p) => (p < 1 ? (p * 24).toFixed(1) + " год" : p.toFixed(2) + " діб");

const MOON_CARDS = ["miranda", "ariel", "umbriel", "titania", "oberon"];

export default function Uranus() {
  const { t } = useTranslation();
  useSeo();

  useEffect(() => {
    document.title = t("title.uranus");
  }, [t]);

  const { data } = useApi(getUranus, { deps: [] });
  const moons = useMemo(() => data?.moons ?? [], [data]);
  const count = data?.moons_count ?? 28;

  // ---- hero live distance / signal -----------------------------------------
  const distStr = data?.distance_km
    ? (Math.round(data.distance_km / 1e8) / 10) + " " + t("uranus.hero.distUnit")
    : "2.9 " + t("uranus.hero.distUnit");

  const sigStr = useMemo(() => {
    if (data?.light_time_min != null) {
      const totalMins = Math.round(data.light_time_min);
      const h = Math.floor(totalMins / 60);
      const m = totalMins % 60;
      return `${h} ${t("jupiter.opposition.hours")} ${m} ${t("jupiter.opposition.mins")}`;
    }
    return `2 ${t("jupiter.opposition.hours")} 40 ${t("jupiter.opposition.mins")}`;
  }, [data, t]);

  // ---- opposition countdown ------------------------------------------------
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  const countdown = useMemo(() => {
    const iso = data?.opposition_next_iso;
    if (!iso) return { months: 0, days: 0, passed: true };
    const target = new Date(iso + "T00:00:00Z").getTime();
    const diff = target - now;
    if (diff <= 0) return { months: 0, days: 0, passed: true };
    // Full calendar months to the opposition, then remaining days. Uranus's
    // opposition is months away, so the hero clock shows months + days (not
    // days/hours/mins like Neptune's). All math in UTC so the count is stable
    // regardless of the viewer's timezone.
    const tDate = new Date(target);
    const nDate = new Date(now);
    let months =
      (tDate.getUTCFullYear() - nDate.getUTCFullYear()) * 12 +
      (tDate.getUTCMonth() - nDate.getUTCMonth());
    let days = tDate.getUTCDate() - nDate.getUTCDate();
    if (days < 0) {
      months -= 1;
      // length of the month immediately before the target month
      const prev = new Date(Date.UTC(tDate.getUTCFullYear(), tDate.getUTCMonth(), 0));
      days += prev.getUTCDate();
    }
    if (months < 0) {
      months = 0;
      days = Math.max(0, Math.floor(diff / 86400000));
    }
    return { months, days, passed: false };
  }, [data, now]);

  // ---- fullscreen map modal ------------------------------------------------
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [focusKey, setFocusKey] = useState(null);

  // ---- detailed moon modal (cards list) ------------------------------------
  const [detailKey, setDetailKey] = useState(null);

  const detailMoon = useMemo(() => {
    if (!detailKey) return null;
    return moons.find((m) => m.name.toLowerCase() === detailKey);
  }, [detailKey, moons]);

  const detailIndex = useMemo(() => {
    if (!detailKey) return -1;
    return MOON_CARDS.indexOf(detailKey);
  }, [detailKey]);

  useEffect(() => {
    if (!detailKey) return;
    const onKey = (e) => {
      if (e.key === "Escape") setDetailKey(null);
      else if (e.key === "ArrowLeft") {
        const prev = (detailIndex - 1 + MOON_CARDS.length) % MOON_CARDS.length;
        setDetailKey(MOON_CARDS[prev]);
      } else if (e.key === "ArrowRight") {
        const next = (detailIndex + 1) % MOON_CARDS.length;
        setDetailKey(MOON_CARDS[next]);
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [detailKey, detailIndex]);

  // ---- interactive system map ----------------------------------------------
  const [hover, setHover] = useState(null);
  const [selectedI, setSelectedI] = useState(null);
  const dotsRef = useRef(null);
  const tipRef = useRef(null);

  const geo = useMemo(() => {
    if (!moons.length) return [];
    const aMax = Math.max(...moons.map((m) => m.a_km));

    const getMoonSize = (m) => {
      if (["miranda", "ariel", "umbriel", "titania", "oberon"].includes(m.name.toLowerCase())) return 4.0;
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
    const aMax = moons.length ? Math.max(...moons.map((m) => m.a_km)) : 20901000;
    return SYS.rMax * Math.pow(25362 / aMax, ORBIT_POWER);
  }, [moons]);

  const counts = useMemo(() => {
    const c = { inner: 0, major: 0, outer: 0 };
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
            <div className="eyebrow">{t("uranus.hero.eyebrow")}</div>
            <h1 className="hero-title" dangerouslySetInnerHTML={{ __html: t("uranus.hero.title") }} />
            <p className="hero-sub">{t("uranus.hero.sub")}</p>
            <div className="stat-mini" style={{ marginTop: 26 }}>
              <div className="box">
                <div className="n">{distStr}</div>
                <div className="l">{t("uranus.hero.distL")}</div>
              </div>
              <div className="box">
                <div className="n">{sigStr}</div>
                <div className="l">{t("uranus.hero.signalL")}</div>
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
                href="/planets/Uranus_no_rings.png"
                x="180" y="180" width="120" height="120"
                className="jupiter-disc-img"
              />
              {/* Faint planetary rings — stylized hint (not to scale; the hero
                  layout is non-linear). True-scale rings are in the fullscreen
                  viewer. Drawn over the disc, under the moons. */}
              {HERO_RINGS.map((rg, i) => (
                <circle
                  key={"ring" + i}
                  className="uranus-ring"
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
              <text className="mars-moon-label" x="240" y="165" textAnchor="middle">Міранда</text>
              <text className="mars-moon-label" x="240" y="140" textAnchor="middle">Аріель</text>
              <text className="mars-moon-label" x="240" y="115" textAnchor="middle">Умбріель</text>
              <text className="mars-moon-label" x="240" y="88" textAnchor="middle">Титанія</text>
              <text className="mars-moon-label" x="240" y="62" textAnchor="middle">Оберон</text>
              <text className="mars-moon-label" x="240" y="458" textAnchor="middle" opacity=".7">
                {t("jupiter.hero.moreMoons", { n: moreMoons })}
              </text>
            </svg>
          </div>
        </div>
        <div className="wrap" style={{ marginTop: 8 }}>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)", textAlign: "center" }}>
            {t("uranus.hero.footnote")}
          </p>
        </div>
      </section>

      {/* ---------- weather / live stats ---------- */}
      <section className="section" style={{ paddingTop: 8 }}>
        <div className="wrap">
          <SectionHead eyebrow={t("uranus.weather.eyebrow")} title={t("uranus.weather.title")} />
          <div className="grid cols-4">
            <div className="card">
              <div className="k">{t("uranus.weather.speedK")}</div>
              <div className="v">{t("uranus.weather.speedV")}<span className="unit">{t("uranus.weather.speedUnit")}</span></div>
              <div className="foot">{t("uranus.weather.speedFoot")}</div>
            </div>
            <div className="card">
              <div className="k">{t("uranus.weather.tempK")}</div>
              <div className="v">{t("uranus.weather.tempV")}<span className="unit">{t("uranus.weather.tempUnit")}</span></div>
              <div className="foot">{t("uranus.weather.tempFoot")}</div>
            </div>
            <div className="card">
              <div className="k">{t("uranus.weather.rotK")}</div>
              <div className="v">{t("uranus.weather.rotV")}<span className="unit">{t("uranus.weather.rotUnit")}</span></div>
              <div className="foot">{t("uranus.weather.rotFoot")}</div>
            </div>
            <div className="card">
              <div className="k">{t("uranus.weather.revK")}</div>
              <div className="v">{t("uranus.weather.revV")}<span className="unit">{t("uranus.weather.revUnit")}</span></div>
              <div className="foot">{t("uranus.weather.revFoot")}</div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- comparison table ---------- */}
      <section className="section">
        <div className="wrap">
          <SectionHead eyebrow={t("uranus.compare.eyebrow")} title={t("uranus.compare.title")} />
          <table className="data">
            <thead>
              <tr>
                <th>{t("jupiter.compare.param")}</th>
                <th>{t("nav.uranus")}</th>
                <th>{t("jupiter.compare.earth")}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{t("uranus.compare.p.day")}</td>
                <td className="mono">{t("uranus.compare.v.day.uranus")}</td>
                <td className="mono">{t("uranus.compare.v.day.earth")}</td>
              </tr>
              <tr>
                <td>{t("uranus.compare.p.year")}</td>
                <td className="mono">{t("uranus.compare.v.year.uranus")}</td>
                <td className="mono">{t("uranus.compare.v.year.earth")}</td>
              </tr>
              <tr>
                <td>{t("uranus.compare.p.gravity")}</td>
                <td className="mono">{t("uranus.compare.v.gravity.uranus")}</td>
                <td className="mono">{t("uranus.compare.v.gravity.earth")}</td>
              </tr>
              <tr>
                <td>{t("uranus.compare.p.diameter")}</td>
                <td className="mono">{t("uranus.compare.v.diameter.uranus")}</td>
                <td className="mono">{t("uranus.compare.v.diameter.earth")}</td>
              </tr>
              <tr>
                <td>{t("uranus.compare.p.dist")}</td>
                <td className="mono">{t("uranus.compare.v.dist.uranus")}</td>
                <td className="mono">{t("uranus.compare.v.dist.earth")}</td>
              </tr>
              <tr>
                <td>{t("uranus.compare.p.density")}</td>
                <td className="mono">{t("uranus.compare.v.density.uranus")}</td>
                <td className="mono">{t("uranus.compare.v.density.earth")}</td>
              </tr>
              <tr>
                <td>{t("uranus.compare.p.moons")}</td>
                <td className="mono">{t("uranus.compare.v.moons.uranus")}</td>
                <td className="mono">{t("uranus.compare.v.moons.earth")}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* ---------- why uranus is tilted ---------- */}
      <section className="section" id="tilt">
        <div className="wrap">
          <SectionHead eyebrow={t("uranus.tilt.eyebrow")} title={t("uranus.tilt.title")} />
          <div className="grid cols-2" style={{ alignItems: "center" }}>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <svg viewBox="0 0 300 180" xmlns="http://www.w3.org/2000/svg">
                <line x1="24.0" y1="121.6" x2="144.0" y2="121.6" stroke="var(--border)" strokeWidth="1" />
                <circle cx="84.0" cy="75.6" r="26" fill="#2E7DB0" />
                <line x1="66.4" y1="116.2" x2="101.6" y2="35.0" stroke="var(--gold)" strokeWidth="1.4" strokeDasharray="2 2" />
                <text className="mars-moon-label" x="84.0" y="135.6" textAnchor="middle">{t("uranus.tilt.earthLabel")}</text>
                
                <line x1="156.0" y1="121.6" x2="276.0" y2="121.6" stroke="var(--border)" strokeWidth="1" />
                <circle cx="216.0" cy="75.6" r="26" fill="#6FBFC2" />
                <line x1="172.2" y1="69.7" x2="259.8" y2="81.5" stroke="var(--gold)" strokeWidth="1.4" strokeDasharray="2 2" />
                <text className="mars-moon-label" x="216.0" y="135.6" textAnchor="middle">{t("uranus.tilt.uranusLabel")}</text>
              </svg>
            </div>
            <div>
              <p style={{ color: "var(--text-dim)", fontSize: 14, lineHeight: 1.75 }}>
                {t("uranus.tilt.p1")}
              </p>
              <p style={{ color: "var(--text-dim)", fontSize: 14, lineHeight: 1.75, marginTop: 14 }}>
                {t("uranus.tilt.p2")}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- rings ---------- */}
      <section className="section" id="rings">
        <div className="wrap">
          <SectionHead eyebrow={t("uranus.rings.eyebrow")} title={t("uranus.rings.title")} />
          <p className="section-sub">{t("uranus.rings.sub")}</p>
          <div className="grid cols-3" style={{ marginTop: 20 }}>
            <div className="card">
              <div className="k">{t("uranus.rings.zeta.discoverer")}</div>
              <div className="v" style={{ fontSize: 20 }}>13 відомих</div>
              <div className="foot">Другі за кількістю кілець після Сатурна</div>
            </div>
            <div className="card">
              <div className="k">Яскравість</div>
              <div className="v" style={{ fontSize: 20 }}>дуже тьмяні</div>
              <div className="foot">Складаються з темних частинок, а не ясного льоду</div>
            </div>
            <div className="card">
              <div className="k">Орієнтація</div>
              <div className="v" style={{ fontSize: 20 }}>майже вертикальна</div>
              <div className="foot">Через екстремальний нахил осі планети</div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Shakespeare moons cards ---------- */}
      <section className="section" id="moons">
        <div className="wrap">
          <SectionHead
            eyebrow={t("uranus.moons.eyebrow")}
            title={t("uranus.moons.title_block")}
            sub={t("uranus.moons.sub_block")}
          />
          <div className="grid cols-4">
            {MOON_CARDS.map((k) => {
              const md = moons.find((x) => x.name.toLowerCase() === k);
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
                      alt={t("uranus.moons." + k + ".name")}
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    />
                    <span className="tag">{t("uranus.moons." + k + ".tag")}</span>
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
                      <h4>{t("uranus.moons." + k + ".name")}</h4>
                      {md && <span className="moon-group">{t("uranus.system." + md.group)}</span>}
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
                        <div className="moon-stat">
                          <div className="l">{t("jupiter.moons.stat.period")}</div>
                          <div className="v">{fmtP(md.period_d)}</div>
                        </div>
                      </div>
                    )}
                    <p>{t("uranus.moons." + k + ".desc")}</p>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="jupiter-moons-note">{t("uranus.moons.note")}</p>
        </div>
      </section>

      {/* ---------- full moon system (live, all moons on real orbits) ---------- */}
      <section className="section" id="moon-system">
        <div className="wrap">
          <SectionHead
            eyebrow={t("uranus.system.eyebrow", { count: count || 0 })}
            title={t("uranus.system.title")}
            sub={t("uranus.system.sub", { count: count || 0 })}
          />
          <div className="jup-sys-wrap orbit-wrap">
            <svg
              className="jup-sys-svg"
              viewBox={`0 0 ${SYS.vb} ${SYS.vb}`}
              xmlns="http://www.w3.org/2000/svg"
              role="img"
              aria-label={t("uranus.system.title")}
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
              <circle cx={SYS.cx} cy={SYS.cy} r={discR} fill="#2e7da8" />
              <circle cx={SYS.cx} cy={SYS.cy} r={discR} fill="none" stroke="#9fd9e0" strokeWidth="1.5" opacity=".6" vectorEffect="non-scaling-stroke" />
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
                <div className="jmt-name">{hm.name_uk || hm.name}</div>
                <div className="jmt-row"><span>{t("jupiter.tooltip.group")}</span><b>{t("uranus.system." + hm.group)}</b></div>
                <div className="jmt-row"><span>{t("jupiter.tooltip.a")}</span><b>{fmtA(hm.a_km)}</b></div>
                <div className="jmt-row"><span>{t("jupiter.tooltip.period")}</span><b>{fmtP(hm.period_d)}</b></div>
                <div className="jmt-row"><span>{t("jupiter.tooltip.direction")}</span><b>{hm.prograde ? t("jupiter.tooltip.dirPro") : t("jupiter.tooltip.dirRetro")}</b></div>
                <div className="jmt-row"><span>{t("jupiter.tooltip.inclination")}</span><b>{hm.i_deg.toFixed(1)}°</b></div>
                <div className="jmt-row"><span>{t("jupiter.tooltip.eccentricity")}</span><b>{hm.e.toFixed(3)}</b></div>
                <div className="jmt-row"><span>{t("jupiter.tooltip.diameter")}</span><b>{hm.diameter_km != null ? spacer(Math.round(hm.diameter_km)) + " км" : t("jupiter.tooltip.dash")}</b></div>
              </div>
            )}
            {!geo.length && <div className="jup-sys-loading">{t("uranus.system.loading")}</div>}
            <button
              type="button"
              className="jup-sys-cta"
              onClick={() => setShowFullscreen(true)}
              aria-label={t("uranus.system.fullscreen")}
              title={t("uranus.system.fullscreenHint", { count: count || 0 })}
            >
              <span className="jup-sys-cta-ico">⛶</span>
              <span className="jup-sys-cta-tip">{t("uranus.system.fullscreenHint", { count: count || 0 })}</span>
            </button>
          </div>
          <div className="jupiter-legend jup-legend">
            {["inner", "major", "outer"].map((g) => (
              <div className="legend-row" key={g}>
                <span className="legend-swatch" style={{ background: g !== "outer" ? "var(--teal)" : "var(--coral)" }} />
                {t("uranus.system." + g)} · {counts[g] || 0}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- magnetic field ---------- */}
      <section className="section" id="magnetic">
        <div className="wrap">
          <SectionHead eyebrow={t("uranus.magnetic.eyebrow")} title={t("uranus.magnetic.title")} />
          <div className="grid cols-3">
            <div className="card">
              <div className="k">{t("uranus.magnetic.c1.title")}</div>
              <div className="v" style={{ fontSize: 20 }}>{t("uranus.magnetic.c1.val")}</div>
              <div className="foot">{t("uranus.magnetic.c1.foot")}</div>
            </div>
            <div className="card">
              <div className="k">{t("uranus.magnetic.c2.title")}</div>
              <div className="v" style={{ fontSize: 20 }}>{t("uranus.magnetic.c2.val")}</div>
              <div className="foot">{t("uranus.magnetic.c2.foot")}</div>
            </div>
            <div className="card">
              <div className="k">{t("uranus.magnetic.c3.title")}</div>
              <div className="v" style={{ fontSize: 20 }}>{t("uranus.magnetic.c3.val")}</div>
              <div className="foot">{t("uranus.magnetic.c3.foot")}</div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- missions ---------- */}
      <section className="section" id="mission-status">
        <div className="wrap">
          <SectionHead eyebrow={t("uranus.missions.eyebrow")} title={t("uranus.missions.title")} />
          <div className="card" style={{ padding: "8px 22px" }}>
            <div className="mission-row">
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--text-dim)", display: "inline-block" }}></span>
              <span className="nm">{t("uranus.missions.v2")}</span>
              <span className="ag">NASA</span>
              <span className="yr">1986</span>
              <span className="st retired">{t("uranus.missions.v2st")}</span>
            </div>
            <div className="mission-row">
              <span className="dot live"></span>
              <span className="nm">{t("uranus.missions.uop")}</span>
              <span className="ag">NASA</span>
              <span className="yr">пріоритет з 2023</span>
              <span className="st active">{t("uranus.missions.uopst")}</span>
            </div>
          </div>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)", marginTop: 12 }}>
            {t("uranus.missions.footnote")}
          </p>
        </div>
      </section>

      {/* ---------- next opposition / observatory ---------- */}
      <section className="section" id="opposition">
        <div className="wrap">
          <SectionHead eyebrow={t("uranus.opposition.eyebrow")} title={t("uranus.opposition.title")} />
          <div className="grid cols-2" style={{ alignItems: "center" }}>
            <div className="card" style={{ padding: 26 }}>
              <div className="k">{t("uranus.opposition.until")}</div>
              <div className="clock" style={{ marginTop: 14 }}>
                <div className="seg">
                  <div className="n">{String(countdown.months).padStart(2, "0")}</div>
                  <span className="u">{t("uranus.opposition.months")}</span>
                </div>
                <div className="seg">
                  <div className="n">{String(countdown.days).padStart(2, "0")}</div>
                  <span className="u">{t("uranus.opposition.days")}</span>
                </div>
              </div>
              <div className="foot" style={{ marginTop: 14 }}>{t("uranus.opposition.foot")}</div>
            </div>
            <div className="card" style={{ padding: 26 }}>
              <div className="k">{t("uranus.opposition.findK")}</div>
              <p style={{ color: "var(--text-dim)", fontSize: 13.5, marginTop: 10, lineHeight: 1.7 }}>
                {t("uranus.opposition.findBody")}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- fun records ---------- */}
      <section className="section" id="facts">
        <div className="wrap">
          <SectionHead eyebrow={t("uranus.records.eyebrow")} title={t("uranus.records.title")} />
          <div className="grid cols-3">
            <div className="card">
              <div className="k">{t("uranus.records.c1_key")}</div>
              <div className="v" style={{ fontSize: 20 }}>{t("uranus.records.c1_val")}</div>
              <div className="foot">{t("uranus.records.c1_foot")}</div>
            </div>
            <div className="card">
              <div className="k">{t("uranus.records.c2_key")}</div>
              <div className="v" style={{ fontSize: 20 }}>{t("uranus.records.c2_val")}</div>
              <div className="foot">{t("uranus.records.c2_foot")}</div>
            </div>
            <div className="card">
              <div className="k">{t("uranus.records.c3_key")}</div>
              <div className="v" style={{ fontSize: 20 }}>{t("uranus.records.c3_val")}</div>
              <div className="foot">{t("uranus.records.c3_foot")}</div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- fullscreen map modal container ---------- */}
      {showFullscreen && (
        <UranusMoonSystemFullscreen
          initialMoonKey={focusKey}
          onClose={() => {
            setShowFullscreen(false);
            setFocusKey(null);
          }}
        />
      )}
      {/* moon detail lightbox (click a moon card) */}
      {detailKey !== null && (() => {
        const md = detailMoon;
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
                <div className="cat">{md ? t("uranus.system." + md.group) : "—"}</div>
                <h3>{t("uranus.moons." + detailKey + ".name")}</h3>
                <div className="d" style={{ color: pro ? "var(--teal)" : "var(--coral)" }}>
                  {pro ? "↻" : "↺"} {pro ? t("jupiter.moons.stat.dirPro") : t("jupiter.moons.stat.dirRetro")}
                </div>
                <p>{t("uranus.moons." + detailKey + ".desc")}</p>
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
