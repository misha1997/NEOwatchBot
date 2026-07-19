// Famous-galaxies hub (/galaxies). Ports templates/galaxies.html into the SPA.
// 12 curated galaxies served by /api/galaxies (DB-first, live NED + NASA Image
// Library fallback). Each card links to the detail page /galaxies/:slug which
// carries the full NASA photo gallery. The distance chart is computed from the
// numeric `dist_ly` field on a log scale (the nearest vs farthest span many
// orders of magnitude, so a linear axis can't show them all at once).
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLang } from "../context/LanguageContext";
import { useApi } from "../hooks/useApi";
import { useSeo } from "../hooks/useSeo";
import { getGalaxies } from "../lib/api";
import { pathFor } from "../lib/seo";
import LocalizedLink from "../components/primitives/LocalizedLink";
import "../styles/gallery.css"; // .photo-grid / .photo-card / .ph .cat / .cap
import "../styles/planetarium.css"; // .mars-orbit-ring / .mars-moon-label

const FILTERS = ["all", "spiral", "elliptical", "irregular", "peculiar"];

// Per-galaxy gradient fallback (matches templates/galaxies.html) for when a
// preview thumbnail isn't mirrored yet. Once backfill mirrors a real NASA
// photo, the card shows that instead.
const GRAD_BY_KEY = {
  "milky-way": "linear-gradient(150deg,#2a2340,#0d0f1c)",
  andromeda: "linear-gradient(150deg,#3a2d4d,#12142a)",
  triangulum: "linear-gradient(150deg,#2d3a4d,#12142a)",
  whirlpool: "linear-gradient(150deg,#1a3a4d,#0d0f1c)",
  sombrero: "linear-gradient(150deg,#4d3a1a,#0d0f1c)",
  "centaurus-a": "linear-gradient(150deg,#4d1a2b,#0d0f1c)",
  pinwheel: "linear-gradient(150deg,#1a4d3a,#0d0f1c)",
  cigar: "linear-gradient(150deg,#4d2a1a,#0d0f1c)",
  "black-eye": "linear-gradient(150deg,#2b1a4d,#0d0f1c)",
  antennae: "linear-gradient(150deg,#4d1a1a,#0d0f1c)",
  cartwheel: "linear-gradient(150deg,#4d3a2f,#0d0f1c)",
  lmc: "linear-gradient(150deg,#3a4d1a,#0d0f1c)",
};

// Log-scale distance chart geometry (mirrors the template axis):
//   x(v) = 261.4 + 211.4 * (log10(v_ly) - 5), v in light-years.
// Each ×10 step is 211.4 px; 0.1 M ly sits at x=261.4, 500 M ly at ~1043.
const X0 = 50;
const X_TICKS = [
  { x: 50, key: "axis0" },
  { x: 261.4, key: "axis1" },
  { x: 472.8, key: "axis2" },
  { x: 684.1, key: "axis3" },
  { x: 895.5, key: "axis4" },
  { x: 1043.3, key: "axis5" },
];
function distX(distLy) {
  if (!distLy || distLy <= 0) return X0; // Milky Way — we're inside it
  const x = 261.4 + 211.4 * (Math.log10(distLy) - 5);
  return Math.max(X0, Math.min(1043.3, x));
}

export default function Galaxies() {
  const { t } = useTranslation();
  const { lang } = useLang();
  useSeo();

  useEffect(() => {
    document.body.classList.add("p-galaxies");
    return () => document.body.classList.remove("p-galaxies");
  }, []);

  const { data, loading, error } = useApi(() => getGalaxies(lang), { deps: [lang] });
  const items = (data && data.items) || [];

  const [filter, setFilter] = useState("all");

  const filtered = useMemo(
    () => (filter === "all" ? items : items.filter((g) => g.category === filter)),
    [items, filter]
  );

  // Local Group diagram: place the four catalog members that belong to it at
  // fixed coords, labelled with their localized names from the API.
  const byKey = useMemo(() => {
    const m = {};
    for (const g of items) m[g.key] = g;
    return m;
  }, [items]);
  const lgMembers = [
    { key: "milky-way", cx: 260, cy: 210, r: 8, fill: "var(--gold)" },
    { key: "andromeda", cx: 352.4, cy: 78.1, r: 6, fill: "var(--teal)" },
    { key: "triangulum", cx: 404.9, cy: 293.7, r: 4, fill: "#B98FE8" },
    { key: "lmc", cx: 246.1, cy: 248.3, r: 3, fill: "var(--coral)" },
  ];

  return (
    <div className="wrap" style={{ position: "relative", zIndex: 1 }}>
      <section className="hero">
        <div className="hero-grid">
          <div>
            <span className="icon-badge">{t("galaxies.hero.eyebrow")}</span>
            <h1 className="hero-title">{t("galaxies.hero.title")}</h1>
            <p className="hero-sub">{t("galaxies.hero.sub")}</p>
            <div className="filters" style={{ marginTop: 26 }}>
              {FILTERS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={"filter-pill" + (filter === c ? " on" : "")}
                  data-cat={c}
                  onClick={() => setFilter(c)}
                >
                  {t(`galaxies.filters.${c}`)}
                </button>
              ))}
            </div>
          </div>

          {/* Local Group diagram — placed top-right of the title, mirroring the
              homepage hero's sky-dome (two-column .hero-grid). */}
          <div className="dome-wrap" style={{ flexDirection: "column", alignItems: "flex-start" }}>
            <div className="eyebrow">{t("galaxies.localGroup.eyebrow")}</div>
            <div className="orbit-wrap">
              <svg viewBox="0 0 520 420" xmlns="http://www.w3.org/2000/svg">
                <circle className="mars-orbit-ring" cx="260" cy="210" r="72" />
                <circle className="mars-orbit-ring" cx="260" cy="210" r="124.7" />
                <circle className="mars-orbit-ring" cx="260" cy="210" r="167.3" />
                {lgMembers.map((m) => {
                  const name = byKey[m.key]?.name;
                  if (!name) return null;
                  const anchor = m.cx < 260 ? "end" : "start";
                  const lx = m.cx < 260 ? m.cx - 10 : m.cx + 10;
                  return (
                    <g key={m.key}>
                      <circle cx={m.cx} cy={m.cy} r={m.r} fill={m.fill} className="obj-dot" />
                      <text
                        className="mars-moon-label"
                        x={lx}
                        y={m.cy + 4}
                        textAnchor={anchor}
                        fill={m.fill}
                      >
                        {name}
                      </text>
                    </g>
                  );
                })}
                {/* M32 — Andromeda's satellite, not in the 12-galaxy catalog. */}
                <circle cx="402.2" cy="127.9" r="2.5" fill="var(--text-dim)" className="obj-dot" />
                <text className="mars-moon-label" x="412.2" y="131.9" textAnchor="start" fill="var(--text-dim)">
                  M32
                </text>
              </svg>
            </div>
            <p className="section-sub" style={{ fontSize: 13, marginTop: 14, maxWidth: 440 }}>
              {t("galaxies.localGroup.sub")}
            </p>
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 8 }}>
        {loading ? (
          <p style={{ color: "var(--text-dim)", fontFamily: "var(--font-mono)", fontSize: 14 }}>
            {t("galaxies.loading")}
          </p>
        ) : error ? (
          <p style={{ color: "var(--coral)", marginTop: 18 }}>{t("galaxies.loading")}</p>
        ) : (
          <div className="photo-grid">
            {filtered.map((g) => (
              <LocalizedLink
                key={g.key}
                className="photo-card"
                to={`${pathFor("galaxies", lang)}/${g.slug}`}
                style={{ display: "block" }}
              >
                <div
                  className="ph"
                  style={
                    g.thumb
                      ? { backgroundImage: `url("${g.thumb}")`, backgroundSize: "cover", backgroundPosition: "center" }
                      : { background: GRAD_BY_KEY[g.key] || "linear-gradient(150deg,#2a3a4d,#0d0f1c)" }
                  }
                >
                  <span className="cat">{t(`galaxies.filters.${g.category}`)}</span>
                </div>
                <div className="cap">
                  <h4>{g.name}</h4>
                  <div className="d">{g.dist_text}</div>
                </div>
              </LocalizedLink>
            ))}
          </div>
        )}
      </section>

      <section className="section" id="distances">
        <div className="section-head">
          <div>
            <div className="eyebrow">{t("galaxies.distances.eyebrow")}</div>
            <h2 className="section-title">{t("galaxies.distances.title")}</h2>
          </div>
        </div>
        <p className="section-sub">{t("galaxies.distances.sub")}</p>
        <div className="brightness-wrap">
          <svg viewBox="0 0 1080 280" xmlns="http://www.w3.org/2000/svg">
            {X_TICKS.map((tk) => (
              <line key={tk.key} className="exo-gridline" x1={tk.x} y1="20" x2={tk.x} y2="250" />
            ))}
            {items.map((g, i) => {
              const x = distX(g.dist_ly);
              const y = 24.2 + i * 19.2;
              const barFill =
                g.category === "peculiar" ? "var(--coral)"
                  : g.category === "irregular" ? "var(--gold)"
                  : "var(--teal)";
              return (
                <g key={g.key}>
                  <rect x={X0} y={y} width={x - X0} height="10.7" rx="3" fill={barFill} opacity=".85" />
                  <text className="exo-axis" x={x + 8} y={y + 8} textAnchor="start" fill="var(--text)">
                    {g.name}
                  </text>
                </g>
              );
            })}
            {X_TICKS.map((tk) => (
              <text key={tk.key} className="exo-axis" x={tk.x} y="272" textAnchor="middle">
                {t(`galaxies.distances.${tk.key}`)}
              </text>
            ))}
          </svg>
        </div>
      </section>

      <section className="section" id="facts">
        <div className="section-head">
          <div>
            <div className="eyebrow">{t("galaxies.records.eyebrow")}</div>
            <h2 className="section-title">{t("galaxies.records.title")}</h2>
          </div>
        </div>
        <div className="grid cols-3">
          <div className="card">
            <div className="k">{t("galaxies.records.nearestK")}</div>
            <div className="v" style={{ fontSize: 20 }}>{t("galaxies.records.nearestV")}</div>
            <div className="foot">{t("galaxies.records.nearestFoot")}</div>
          </div>
          <div className="card">
            <div className="k">{t("galaxies.records.farthestK")}</div>
            <div className="v" style={{ fontSize: 20 }}>{t("galaxies.records.farthestV")}</div>
            <div className="foot">{t("galaxies.records.farthestFoot")}</div>
          </div>
          <div className="card">
            <div className="k">{t("galaxies.records.brightestK")}</div>
            <div className="v" style={{ fontSize: 20 }}>{t("galaxies.records.brightestV")}</div>
            <div className="foot">{t("galaxies.records.brightestFoot")}</div>
          </div>
        </div>
      </section>
    </div>
  );
}