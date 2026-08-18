// Saturn planet page (/planetarium/saturn). Mirrors Neptune.js / Uranus.js structure.
import { useEffect, useMemo, useState, useLayoutEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import SectionHead from "../components/primitives/SectionHead";
import { useSeo } from "../hooks/useSeo";
import { useApi } from "../hooks/useApi";
import { getSaturn } from "../lib/api";
import SaturnMoonSystemFullscreen from "./SaturnMoonSystemFullscreen";
import "../styles/planetarium.css";

const EPOCH_MS = Date.UTC(2000, 0, 1, 12, 0, 0);
const TIME_SCALE = 0.1;
const SYS = { vb: 640, cx: 320, cy: 320, rMin: 32, rMax: 300 };
const SATURN_RADIUS_KM = 58232;
const ORBIT_POWER = 1;

const HERO_MOONS = [
  { key: "mimas", name: "Мімас", r: 76, color: "#C9BFAE", size: 1.8, m0: 40, p: 0.942, prograde: true },
  { key: "enceladus", name: "Енцелад", r: 86, color: "#E8D48A", size: 1.8, m0: 160, p: 1.370, prograde: true },
  { key: "tethys", name: "Тетіс", r: 98, color: "#B08060", size: 2.0, m0: 260, p: 1.888, prograde: true },
  { key: "dione", name: "Діона", r: 112, color: "#8A8375", size: 2.0, m0: 20, p: 2.737, prograde: true },
  { key: "rhea", name: "Рея", r: 128, color: "#9C8F7E", size: 2.4, m0: 200, p: 4.518, prograde: true },
  { key: "titan", name: "Титан", r: 154, color: "var(--gold)", size: 3.6, m0: 90, p: 15.945, prograde: true },
];
const HERO_SCALE = 3 / 0.942; // Mimas rotates once in 3s

// Stylized hint of Saturn's rings on the hero mini-map. The hero scale is
// non-linear (planet image inflated, outer moons compressed), so these are
// NOT to scale — just five faint concentric circles hugging the disc
// (between the planet edge at r=60 and the innermost moon Mimas at r=76) as a
// visual cue that the rings exist. True, to-scale rings live in the
// fullscreen moon-system viewer. Order: C ring (innermost) → F ring (outer).
const HERO_RINGS = [
  { r: 63, op: 0.14 }, // C ring — broad, faint
  { r: 66, op: 0.42 }, // B ring — brightest, broadest
  { r: 69, op: 0.10 }, // Cassini Division — the gap, near-transparent
  { r: 72, op: 0.50 }, // A ring
  { r: 75, op: 0.28 }, // F ring — narrow, outermost
];

// Legend order for the live moon-system section; filtered to groups actually
// present in the catalog. Prograde/retrograde per group is read from the data.
const GROUP_ORDER = ["inner", "main", "trojan", "titan", "inuit", "gallic", "norse"];

function spacer(n) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

const fmtA = (a) =>
  a >= 1e6 ? (a / 1e6).toFixed(2) + " млн км" : spacer(Math.round(a)) + " км";
const fmtP = (p) => (p < 1 ? (p * 24).toFixed(1) + " год" : p.toFixed(2) + " діб");

// The eight moons shown in the moon-cards grid (and cycled by the detail
// modal prev/next). Keys match the `saturn.moons.<key>` i18n entries and the
// lowercased catalog `name` from /api/saturn.
const MOON_CARDS = ["mimas", "enceladus", "tethys", "dione", "rhea", "titan", "hyperion", "iapetus"];

export default function Saturn() {
  const { t } = useTranslation();
  useSeo();

  useEffect(() => {
    document.title = t("title.saturn");
  }, [t]);

  const { data } = useApi(getSaturn, { deps: [] });
  const moons = useMemo(() => data?.moons ?? [], [data]);
  const count = data?.moons_count ?? 146;

  // ---- hero live distance / signal -----------------------------------------
  const distStr = data?.distance_km
    ? (Math.round(data.distance_km / 1e8) / 10) + " " + t("saturn.hero.distUnit")
    : "1.3 " + t("saturn.hero.distUnit");

  const sigStr = useMemo(() => {
    if (data?.light_time_min != null) {
      const totalMins = Math.round(data.light_time_min);
      const h = Math.floor(totalMins / 60);
      const m = totalMins % 60;
      return h > 0
        ? `${h} ${t("jupiter.opposition.hours")} ${m} ${t("jupiter.opposition.mins")}`
        : `${m} ${t("jupiter.opposition.mins")}`;
    }
    return `71 ${t("jupiter.opposition.mins")}`;
  }, [data, t]);

  // ---- opposition countdown (months + days, like Uranus) --------------------
  const [countdown, setCountdown] = useState({ months: 0, days: 0 });
  useEffect(() => {
    if (!data?.opposition_next_iso) return;
    const target = new Date(data.opposition_next_iso);
    const update = () => {
      const today = new Date();
      let m = (target.getFullYear() - today.getFullYear()) * 12 + (target.getMonth() - today.getMonth());
      let d = target.getDate() - today.getDate();
      if (d < 0) {
        m -= 1;
        const prevMonth = new Date(target.getFullYear(), target.getMonth(), 0);
        d += prevMonth.getDate();
      }
      if (m < 0) { m = 0; d = 0; }
      setCountdown({ months: m, days: d });
    };
    update();
    const interval = setInterval(update, 1000 * 60 * 60);
    return () => clearInterval(interval);
  }, [data]);

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
      if (m.name.toLowerCase() === "titan") return 4.0;
      if (m.group === "inner" || m.group === "main") return 2.2;
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
    const aMax = moons.length ? Math.max(...moons.map((m) => m.a_km)) : 24203300;
    return SYS.rMax * Math.pow(SATURN_RADIUS_KM / aMax, ORBIT_POWER);
  }, [moons]);

  const counts = useMemo(() => {
    const c = {};
    for (const m of moons) c[m.group] = (c[m.group] || 0) + 1;
    return c;
  }, [moons]);

  const groupProgrades = useMemo(() => {
    const g = {};
    for (const m of moons) if (g[m.group] === undefined) g[m.group] = m.prograde;
    return g;
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
  const legendGroups = GROUP_ORDER.filter((g) => counts[g]);

  return (
    <>
      {/* ---------- hero ---------- */}
      <section className="hero">
        <div className="wrap hero-grid">
          <div>
            <div className="eyebrow">{t("saturn.hero.eyebrow")}</div>
            <h1 className="hero-title" dangerouslySetInnerHTML={{ __html: t("saturn.hero.title") }} />
            <p className="hero-sub">{t("saturn.hero.sub")}</p>

            <div className="stat-mini" style={{ marginTop: 26 }}>
              <div className="box">
                <div className="n">{distStr}</div>
                <div className="l">{t("saturn.hero.distL")}</div>
              </div>
              <div className="box">
                <div className="n">{sigStr}</div>
                <div className="l">{t("saturn.hero.signalL")}</div>
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
                href="/planets/Saturn_no_rings.png"
                x="180" y="180" width="120" height="120"
                className="jupiter-disc-img"
              />
              {/* Rings — stylized hint (not to scale; the hero layout is
                  non-linear). True-scale rings are in the fullscreen viewer.
                  Drawn over the disc, under the moons. */}
              {HERO_RINGS.map((rg, i) => (
                <circle
                  key={"ring" + i}
                  className="saturn-ring"
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
              <text className="mars-moon-label" x="240" y="130" textAnchor="middle">Тетіс</text>
              <text className="mars-moon-label" x="240" y="108" textAnchor="middle">Діона</text>
              <text className="mars-moon-label" x="240" y="86" textAnchor="middle">Рея</text>
              <text className="mars-moon-label" x="240" y="60" textAnchor="middle" fill="var(--gold)">Титан</text>
              <text className="mars-moon-label" x="240" y="458" textAnchor="middle" opacity=".7">
                {t("jupiter.hero.moreMoons", { n: moreMoons })}
              </text>
            </svg>
          </div>
        </div>
        <div className="wrap" style={{ marginTop: 8 }}>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)", textAlign: "center" }}>
            {t("saturn.hero.footnote", { count })}
          </p>
        </div>
      </section>

      {/* ---------- saturn right now ---------- */}
      <section className="section" style={{ paddingTop: 8 }}>
        <div className="wrap">
          <SectionHead eyebrow={t("saturn.weather.eyebrow")} title={t("saturn.weather.title")} />

          <div className="grid cols-4">
            <div className="card">
              <div className="k">{t("saturn.weather.speedK")}</div>
              <div className="v">
                {t("saturn.weather.speedV")}
                <span className="unit">{t("saturn.weather.speedUnit")}</span>
              </div>
              <div className="foot">{t("saturn.weather.speedFoot")}</div>
            </div>

            <div className="card">
              <div className="k">{t("saturn.weather.tempK")}</div>
              <div className="v">
                {t("saturn.weather.tempV")}
                <span className="unit">{t("saturn.weather.tempUnit")}</span>
              </div>
              <div className="foot">{t("saturn.weather.tempFoot")}</div>
            </div>

            <div className="card">
              <div className="k">{t("saturn.weather.rotK")}</div>
              <div className="v">
                {t("saturn.weather.rotV")}
                <span className="unit">{t("saturn.weather.rotUnit")}</span>
              </div>
              <div className="foot">{t("saturn.weather.rotFoot")}</div>
            </div>

            <div className="card">
              <div className="k">{t("saturn.weather.revK")}</div>
              <div className="v">
                {t("saturn.weather.revV")}
                <span className="unit">{t("saturn.weather.revUnit")}</span>
              </div>
              <div className="foot">{t("saturn.weather.revFoot")}</div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- compare ---------- */}
      <section className="section">
        <div className="wrap">
          <SectionHead eyebrow={t("saturn.compare.eyebrow")} title={t("saturn.compare.title")} />

          <table className="data">
            <thead>
              <tr>
                <th>{t("jupiter.compare.param")}</th>
                <th>{t("nav.saturn")}</th>
                <th>{t("nav.earth")}</th>
              </tr>
            </thead>
            <tbody>
              {["day", "year", "gravity", "diameter", "mass", "atmosphere", "moons"].map((k) => (
                <tr key={k}>
                  <td>{t("saturn.compare.rows." + k + ".label")}</td>
                  <td className="mono">{t("saturn.compare.rows." + k + ".s")}</td>
                  <td className="mono">{t("saturn.compare.rows." + k + ".e")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ---------- rings ---------- */}
      <section className="section" id="rings">
        <div className="wrap">
          <SectionHead eyebrow={t("saturn.rings.eyebrow")} title={t("saturn.rings.title")} />
          <p className="section-sub">{t("saturn.rings.sub")}</p>

          <div className="grid cols-3" style={{ marginTop: 20 }}>
            <div className="card">
              <div className="k">{t("saturn.rings.c1.title")}</div>
              <div className="v" style={{ fontSize: 20 }}>{t("saturn.rings.c1.val")}</div>
              <div className="foot">{t("saturn.rings.c1.foot")}</div>
            </div>
            <div className="card">
              <div className="k">{t("saturn.rings.c2.title")}</div>
              <div className="v" style={{ fontSize: 20 }}>{t("saturn.rings.c2.val")}</div>
              <div className="foot">{t("saturn.rings.c2.foot")}</div>
            </div>
            <div className="card">
              <div className="k">{t("saturn.rings.c3.title")}</div>
              <div className="v" style={{ fontSize: 20 }}>{t("saturn.rings.c3.val")}</div>
              <div className="foot">{t("saturn.rings.c3.foot")}</div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- hexagon storm ---------- */}
      <section className="section" id="hexagon">
        <div className="wrap">
          <SectionHead eyebrow={t("saturn.hexagon.eyebrow")} title={t("saturn.hexagon.title")} />

          <div className="grid cols-2" style={{ alignItems: "center" }}>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <svg viewBox="0 0 260 260" xmlns="http://www.w3.org/2000/svg">
                <g>
                  <circle cx="130" cy="130" r="30" fill="none" stroke="#D9BC7A" strokeWidth="1" opacity=".3" />
                  <circle cx="130" cy="130" r="45" fill="none" stroke="#D9BC7A" strokeWidth="1" opacity=".3" />
                  <circle cx="130" cy="130" r="58" fill="none" stroke="#D9BC7A" strokeWidth="1" opacity=".3" />
                  <circle cx="130" cy="130" r="14" fill="var(--coral)" opacity=".6" />
                  <animateTransform attributeName="transform" type="rotate" from="0 130 130" to="360 130 130" dur="20s" repeatCount="indefinite" />
                </g>
                <polygon points="130,60 190.6,95 190.6,165 130,200 69.4,165 69.4,95" fill="none" stroke="var(--gold)" strokeWidth="2.5" opacity=".85" />
                <text className="mars-moon-label" x="130" y="254" textAnchor="middle">{t("saturn.hexagon.diameterLabel")}</text>
              </svg>
            </div>
            <div>
              <p style={{ color: "var(--text-dim)", fontSize: 14, lineHeight: 1.75 }}>
                {t("saturn.hexagon.desc1")}
              </p>
              <p style={{ color: "var(--text-dim)", fontSize: 14, lineHeight: 1.75, marginTop: 14 }}>
                {t("saturn.hexagon.desc2")}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- moons cards ---------- */}
      <section className="section" id="moons">
        <div className="wrap">
          <SectionHead
            eyebrow={t("saturn.moons.eyebrow")}
            title={t("saturn.moons.title_block")}
            sub={t("saturn.moons.sub_block")}
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
                      alt={t("saturn.moons." + k + ".name")}
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    />
                    <span className="tag">{t("saturn.moons." + k + ".tag")}</span>
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
                      <h4>{t("saturn.moons." + k + ".name")}</h4>
                      {md && <span className="moon-group">{t("saturn.system." + md.group)}</span>}
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
                    <p>{t("saturn.moons." + k + ".desc")}</p>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="jupiter-moons-note">{t("saturn.moons.note")}</p>
        </div>
      </section>

      {/* ---------- full moon system (live, all moons on real orbits) ---------- */}
      <section className="section" id="moon-system">
        <div className="wrap">
          <SectionHead
            eyebrow={t("saturn.system.eyebrow", { count: count || 0 })}
            title={t("saturn.system.title")}
            sub={t("saturn.system.sub", { count: count || 0 })}
          />
          <div className="jup-sys-wrap orbit-wrap">
            <svg
              className="jup-sys-svg"
              viewBox={`0 0 ${SYS.vb} ${SYS.vb}`}
              xmlns="http://www.w3.org/2000/svg"
              role="img"
              aria-label={t("saturn.system.title")}
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
              <circle cx={SYS.cx} cy={SYS.cy} r={discR} fill="#E8D9A0" />
              <circle cx={SYS.cx} cy={SYS.cy} r={discR} fill="none" stroke="#D9C078" strokeWidth="1.5" opacity=".6" vectorEffect="non-scaling-stroke" />
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
                <div className="jmt-row"><span>{t("jupiter.tooltip.group")}</span><b>{t("saturn.system." + hm.group)}</b></div>
                <div className="jmt-row"><span>{t("jupiter.tooltip.a")}</span><b>{fmtA(hm.a_km)}</b></div>
                <div className="jmt-row"><span>{t("jupiter.tooltip.period")}</span><b>{fmtP(hm.period_d)}</b></div>
                <div className="jmt-row"><span>{t("jupiter.tooltip.direction")}</span><b>{hm.prograde ? t("jupiter.tooltip.dirPro") : t("jupiter.tooltip.dirRetro")}</b></div>
                <div className="jmt-row"><span>{t("jupiter.tooltip.inclination")}</span><b>{hm.i_deg.toFixed(1)}°</b></div>
                <div className="jmt-row"><span>{t("jupiter.tooltip.eccentricity")}</span><b>{hm.e.toFixed(3)}</b></div>
                <div className="jmt-row"><span>{t("jupiter.tooltip.diameter")}</span><b>{hm.diameter_km != null ? spacer(Math.round(hm.diameter_km)) + " км" : t("jupiter.tooltip.dash")}</b></div>
              </div>
            )}
            {!geo.length && <div className="jup-sys-loading">{t("common.loading")}</div>}
            <button
              type="button"
              className="jup-sys-cta"
              onClick={() => setShowFullscreen(true)}
              aria-label={t("saturn.system.open_interactive")}
              title={t("saturn.system.open_interactive")}
            >
              <span className="jup-sys-cta-ico">⛶</span>
              <span className="jup-sys-cta-tip">{t("saturn.system.open_interactive")}</span>
            </button>
          </div>
          <div className="jupiter-legend jup-legend">
            {legendGroups.map((g) => (
              <div className="legend-row" key={g}>
                <span className="legend-swatch" style={{ background: groupProgrades[g] ? "var(--teal)" : "var(--coral)" }} />
                {t("saturn.system." + g)} · {counts[g] || 0}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- magnetic field ---------- */}
      <section className="section" id="magnetic">
        <div className="wrap">
          <SectionHead eyebrow={t("saturn.magnetic.eyebrow")} title={t("saturn.magnetic.title")} />

          <div className="grid cols-3">
            <div className="card">
              <div className="k">{t("saturn.magnetic.c1.title")}</div>
              <div className="v" style={{ fontSize: 20 }}>{t("saturn.magnetic.c1.val")}</div>
              <div className="foot">{t("saturn.magnetic.c1.foot")}</div>
            </div>
            <div className="card">
              <div className="k">{t("saturn.magnetic.c2.title")}</div>
              <div className="v" style={{ fontSize: 20 }}>{t("saturn.magnetic.c2.val")}</div>
              <div className="foot">{t("saturn.magnetic.c2.foot")}</div>
            </div>
            <div className="card">
              <div className="k">{t("saturn.magnetic.c3.title")}</div>
              <div className="v" style={{ fontSize: 20 }}>{t("saturn.magnetic.c3.val")}</div>
              <div className="foot">{t("saturn.magnetic.c3.foot")}</div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- missions ---------- */}
      <section className="section" id="mission-status">
        <div className="wrap">
          <SectionHead eyebrow={t("saturn.missions.eyebrow")} title={t("saturn.missions.title")} />

          <div className="card" style={{ padding: "8px 22px" }}>
            <div className="mission-row">
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--text-dim)", display: "inline-block" }} />
              <span className="nm">{t("saturn.missions.pioneer")}</span>
              <span className="ag">NASA</span>
              <span className="yr">1979</span>
              <span className="st retired">{t("saturn.missions.pioneerst")}</span>
            </div>
            <div className="mission-row">
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--text-dim)", display: "inline-block" }} />
              <span className="nm">{t("saturn.missions.voyager")}</span>
              <span className="ag">NASA</span>
              <span className="yr">1980–81</span>
              <span className="st retired">{t("saturn.missions.voyagerst")}</span>
            </div>
            <div className="mission-row">
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--text-dim)", display: "inline-block" }} />
              <span className="nm">{t("saturn.missions.cassini")}</span>
              <span className="ag">NASA/ESA/ASI</span>
              <span className="yr">1997</span>
              <span className="st retired">{t("saturn.missions.cassinist")}</span>
            </div>
            <div className="mission-row">
              <span className="dot live" />
              <span className="nm">{t("saturn.missions.dragonfly")}</span>
              <span className="ag">NASA</span>
              <span className="yr">~2028</span>
              <span className="st active">{t("saturn.missions.dragonflyst")}</span>
            </div>
          </div>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)", marginTop: 12 }}>
            {t("saturn.missions.footnote")}
          </p>
        </div>
      </section>

      {/* ---------- next opposition ---------- */}
      <section className="section" id="opposition">
        <div className="wrap">
          <SectionHead eyebrow={t("saturn.opposition.eyebrow")} title={t("saturn.opposition.title")} />

          <div className="grid cols-2" style={{ alignItems: "center" }}>
            <div className="card" style={{ padding: 26 }}>
              <div className="k">{t("saturn.opposition.countdown_label")}</div>

              <div className="clock" style={{ marginTop: 14 }}>
                <div className="seg">
                  <div className="n">{String(countdown.months).padStart(2, "0")}</div>
                  <span className="u">{t("saturn.opposition.months")}</span>
                </div>
                <div className="seg">
                  <div className="n">{String(countdown.days).padStart(2, "0")}</div>
                  <span className="u">{t("saturn.opposition.days")}</span>
                </div>
              </div>

              <div className="foot" style={{ marginTop: 14 }}>
                {t("saturn.opposition.foot")}
              </div>
            </div>

            <div className="card" style={{ padding: 26 }}>
              <div className="k">{t("saturn.opposition.telescope_label")}</div>
              <p style={{ color: "var(--text-dim)", fontSize: 13.5, marginTop: 10, lineHeight: 1.7 }}>
                {t("saturn.opposition.telescope_desc")}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- facts ---------- */}
      <section className="section" id="facts">
        <div className="wrap">
          <SectionHead eyebrow={t("saturn.facts.eyebrow")} title={t("saturn.facts.title")} />

          <div className="grid cols-3">
            <div className="card">
              <div className="k">{t("saturn.facts.c1.title")}</div>
              <div className="v" style={{ fontSize: 20 }}>{t("saturn.facts.c1.val")}</div>
              <div className="foot">{t("saturn.facts.c1.foot")}</div>
            </div>
            <div className="card">
              <div className="k">{t("saturn.facts.c2.title")}</div>
              <div className="v" style={{ fontSize: 20 }}>{t("saturn.facts.c2.val")}</div>
              <div className="foot">{t("saturn.facts.c2.foot")}</div>
            </div>
            <div className="card">
              <div className="k">{t("saturn.facts.c3.title")}</div>
              <div className="v" style={{ fontSize: 20 }}>{t("saturn.facts.c3.val")}</div>
              <div className="foot">{t("saturn.facts.c3.foot")}</div>
            </div>
          </div>
        </div>
      </section>

      {showFullscreen && (
        <SaturnMoonSystemFullscreen
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
                <div className="cat">{md ? t("saturn.system." + md.group) : "—"}</div>
                <h3>{t("saturn.moons." + detailKey + ".name")}</h3>
                <div className="d" style={{ color: pro ? "var(--teal)" : "var(--coral)" }}>
                  {pro ? "↻" : "↺"} {pro ? t("jupiter.moons.stat.dirPro") : t("jupiter.moons.stat.dirRetro")}
                </div>
                <p>{t("saturn.moons." + detailKey + ".desc")}</p>
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
