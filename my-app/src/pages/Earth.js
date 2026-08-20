// Earth planet page (/planetarium/earth). Ports templates/earth.html into the SPA.
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import SectionHead from "../components/primitives/SectionHead";
import LocalizedLink from "../components/primitives/LocalizedLink";
import LocationPill from "../components/LocationPill";
import EarthTerminatorMap from "../components/EarthTerminatorMap";
import { useSeo } from "../hooks/useSeo";
import { useApi } from "../hooks/useApi";
import { useLoc } from "../context/LocationContext";
import { getEarth, getEarthQuakes, getEarthDay } from "../lib/api";
import "../styles/planetarium.css";

function quakeColor(mag) {
  if (mag == null) return "var(--text-dim)";
  if (mag >= 6) return "var(--coral)";
  if (mag >= 4.5) return "var(--gold)";
  return "var(--teal)";
}

function mapsUrl(lat, lon) {
  return `https://www.google.com/maps?q=${lat},${lon}`;
}

export default function Earth() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language || "uk";
  useSeo();

  useEffect(() => {
    document.title = t("title.earth");
  }, [t]);

  const { data } = useApi(getEarth, { deps: [] });
  const { loc } = useLoc();
  const { data: quakes } = useApi(getEarthQuakes, { deps: [], interval: 300000 });
  const { data: dayInfo } = useApi(() => getEarthDay(loc), { deps: [loc && loc.lat, loc && loc.lon] });

  const fmtTime = (iso) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleTimeString(lang === "uk" ? "uk-UA" : "en-US", { hour: "2-digit", minute: "2-digit" });
  };

  // Real-time population counter simulating ~2.2 people growth per second
  const [population, setPopulation] = useState(() => {
    const baseTime = new Date("2026-07-25T00:00:00Z").getTime();
    const basePop = 8282120450;
    const rateMs = 2.2 / 1000;
    const diff = Date.now() - baseTime;
    return Math.floor(basePop + diff * rateMs);
  });

  useEffect(() => {
    const rateMs = 2.2 / 1000;
    const baseTime = new Date("2026-07-25T00:00:00Z").getTime();
    const basePop = 8282120450;
    const timer = setInterval(() => {
      const diff = Date.now() - baseTime;
      setPopulation(Math.floor(basePop + diff * rateMs));
    }, 100);
    return () => clearInterval(timer);
  }, []);

  const formatElapsed = (mins) => {
    if (mins < 60) {
      return lang === "uk" ? `${mins} хв тому` : `${mins} mins ago`;
    }
    const hrs = Math.floor(mins / 60);
    if (hrs === 1) {
      return lang === "uk" ? "1 годину тому" : "1 hour ago";
    }
    return lang === "uk" ? `${hrs} год тому` : `${hrs} hours ago`;
  };

  return (
    <>
      {/* ---------- hero ---------- */}
      <section className="hero">
        <div className="wrap hero-grid">
          <div>
            <div className="eyebrow">{t("earth.hero.eyebrow")}</div>
            <h1 className="hero-title" dangerouslySetInnerHTML={{ __html: t("earth.hero.title") }} />
            <p className="hero-sub">{t("earth.hero.sub")}</p>
            <div className="stat-mini" style={{ marginTop: 26 }}>
              <div className="box">
                <div className="n">{t("earth.hero.sunDist")}</div>
                <div className="l">{t("earth.hero.sunDistL")}</div>
              </div>
              <div className="box">
                <div className="n">{t("earth.hero.lightTime")}</div>
                <div className="l">{t("earth.hero.lightTimeL")}</div>
              </div>
            </div>
          </div>
          <div className="orbit-wrap">
            <svg viewBox="0 0 480 480" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <radialGradient id="moonGrad" cx="35%" cy="30%" r="80%">
                  <stop offset="0%" stopColor="#E3DED5" />
                  <stop offset="100%" stopColor="#9C948A" />
                </radialGradient>
              </defs>
              <circle className="mars-orbit-ring" cx="240" cy="240" r="190" />
              <image
                href="/planets/Earth.png"
                x="170" y="170" width="140" height="140"
                className="mars-disc-img"
              />
              <g>
                <circle cx="430" cy="240" r="15" fill="url(#moonGrad)" />
                <g transform="translate(430,240)">
                  <circle cx="-4" cy="-3" r="2.2" fill="#7d766c" opacity="0.6" />
                  <circle cx="3" cy="2" r="1.6" fill="#7d766c" opacity="0.6" />
                  <circle cx="-2" cy="4" r="1.3" fill="#7d766c" opacity="0.6" />
                </g>
                <animateTransform attributeName="transform" type="rotate" from="0 240 240" to="360 240 240" dur="14s" repeatCount="indefinite" />
              </g>
              <text className="mars-moon-label" x="240" y="40" textAnchor="middle">{t("earth.hero.moonLabel")}</text>
            </svg>
          </div>
        </div>
      </section>

      {/* ---------- day/night terminator + your day right now ---------- */}
      <section className="section" id="daynight" style={{ paddingTop: 8 }}>
        <div className="wrap">
          <SectionHead eyebrow={t("earth.daynight.eyebrow")} title={t("earth.daynight.title")} />
          <LocationPill />

          <div className="map-card" style={{ marginTop: 16 }}>
            <div className="map-body map-live">
              <EarthTerminatorMap loc={loc} />
            </div>
          </div>

          <div className="grid cols-2" style={{ marginTop: 16, alignItems: "stretch", gap: 20 }}>
            <div className="card" style={{ padding: "22px 24px" }}>
              <div className="k">{t("earth.daynight.dayInfo")}</div>
              <div style={{ display: "flex", gap: 28, marginTop: 16 }}>
                <div>
                  <div className="v" style={{ fontSize: 24 }}>{fmtTime(dayInfo && dayInfo.sunrise)}</div>
                  <div className="foot">{t("earth.daynight.sunrise")}</div>
                </div>
                <div>
                  <div className="v" style={{ fontSize: 24 }}>{fmtTime(dayInfo && dayInfo.sunset)}</div>
                  <div className="foot">{t("earth.daynight.sunset")}</div>
                </div>
              </div>
            </div>
            <div className="card" style={{ padding: "22px 24px", display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <div className="k">{t("earth.daynight.dayLength")}</div>
              <div className="v" style={{ fontSize: 26, marginTop: 10 }}>
                {dayInfo && dayInfo.day_length_hours != null
                  ? `${Math.floor(dayInfo.day_length_hours)}${t("earth.daynight.hUnit")} ${Math.round((dayInfo.day_length_hours % 1) * 60)}${t("earth.daynight.mUnit")}`
                  : "—"}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- live stats ---------- */}
      <section className="section" id="live-stats" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <SectionHead eyebrow={t("earth.stats.eyebrow")} title={t("earth.stats.title")} />
          <div className="grid cols-4">
            <div className="card">
              <div className="k">{t("earth.stats.population")}</div>
              <div className="v" style={{ fontSize: 22, letterSpacing: "-0.5px" }}>
                {population.toLocaleString(lang === "uk" ? "uk-UA" : "en-US")}
              </div>
              <div className="foot">{t("earth.stats.populationFoot")}</div>
            </div>
            <div className="card">
              <div className="k">{t("earth.stats.speed")}</div>
              <div className="v">
                {t("earth.stats.speedV")}
                <span className="unit">{t("earth.stats.speedUnit")}</span>
              </div>
              <div className="foot">{t("earth.stats.speedFoot")}</div>
            </div>
            <div className="card">
              <div className="k">{t("earth.stats.field")}</div>
              <div className="v">
                {t("earth.stats.fieldV")}
                <span className="unit">{t("earth.stats.fieldUnit")}</span>
              </div>
              <div className="foot">{t("earth.stats.fieldFoot")}</div>
            </div>
            <div className="card">
              <div className="k">{t("earth.stats.period")}</div>
              <div className="v">
                {t("earth.stats.periodV")}
                <span className="unit">{t("earth.stats.periodUnit")}</span>
              </div>
              <div className="foot">{t("earth.stats.periodFoot")}</div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- climate vital signs ---------- */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <SectionHead eyebrow={t("earth.climate.eyebrow")} title={t("earth.climate.title")} />
          <div className="grid cols-3">
            <div className="card">
              <div className="k">{t("earth.climate.co2")}</div>
              <div className="v">
                {data?.co2 ? `${data.co2} ` : "— "}
                <span className="unit">ppm</span>
              </div>
              <div className="foot">
                {data?.co2_trend ? `${t("earth.climate.co2Trend")} ${data.co2_trend} ppm` : t("earth.climate.co2Foot")}
              </div>
            </div>
            <div className="card">
              <div className="k">{t("earth.climate.temp")}</div>
              <div className="v">
                {data?.temperature_anomaly != null ? `${data.temperature_anomaly > 0 ? "+" : ""}${data.temperature_anomaly} ` : "— "}
                <span className="unit">°C</span>
              </div>
              <div className="foot">{t("earth.climate.tempFoot")}</div>
            </div>
            <div className="card">
              <div className="k">{t("earth.climate.seaLevel")}</div>
              <div className="v">
                {data?.sea_level_rise_mm != null ? `${data.sea_level_rise_mm} ` : "— "}
                <span className="unit">mm</span>
              </div>
              <div className="foot">{t("earth.climate.seaLevelFoot")}</div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- earthquakes ---------- */}
      <section className="section" id="earthquakes" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <SectionHead eyebrow={t("earth.quakes.eyebrow")} title={t("earth.quakes.title")} />

          <div className="grid cols-2" style={{ alignItems: "stretch", gap: 20 }}>
            <div className="card" style={{ padding: "22px 24px" }}>
              <div style={{
                fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.12em",
                textTransform: "uppercase", color: "var(--text-dim)",
              }}>
                {t("earth.quakes.latestLabel")}
              </div>
              {quakes && quakes.latest ? (
                <>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 10 }}>
                    <div className="v" style={{ fontSize: 40, color: quakeColor(quakes.latest.mag) }}>
                      {quakes.latest.mag != null ? quakes.latest.mag.toFixed(1) : "—"}
                    </div>
                    <div className="foot">{t("earth.quakes.magUnit")}</div>
                  </div>
                  <a href={mapsUrl(quakes.latest.lat, quakes.latest.lon)} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: 15, fontWeight: 600, marginTop: 8, display: "block", color: "var(--text)" }}>
                    {quakes.latest.place} ↗
                  </a>
                  <div className="foot" style={{ marginTop: 6 }}>
                    {formatElapsed(quakes.latest.elapsed_min)}
                    {quakes.latest.depth_km != null ? ` · ${t("earth.quakes.depth")} ${Math.round(quakes.latest.depth_km)} ${t("earth.quakes.km")}` : ""}
                  </div>
                </>
              ) : (
                <div className="foot" style={{ marginTop: 10 }}>{t("earth.quakes.loading")}</div>
              )}
            </div>

            <div className="card" style={{ padding: "22px 24px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
              <div className="v" style={{ fontSize: 44 }}>{quakes ? quakes.count_24h : "—"}</div>
              <div className="foot">{t("earth.quakes.count24hFoot")}</div>
            </div>
          </div>

          <div className="card" style={{ padding: "20px 22px", marginTop: 16 }}>
            <div style={{
              fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.12em",
              textTransform: "uppercase", color: "var(--text-dim)", marginBottom: 6,
            }}>
              {t("earth.quakes.recentLabel")}
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {((quakes && quakes.recent) || []).map((q, i) => (
                <a key={i} href={mapsUrl(q.lat, q.lon)} target="_blank" rel="noopener noreferrer"
                  style={{
                    display: "flex", alignItems: "center", gap: 12, padding: "10px 4px",
                    borderTop: i > 0 ? "1px solid var(--border)" : "none",
                    textDecoration: "none", color: "inherit",
                  }}>
                  <span style={{ width: 38, textAlign: "right", fontFamily: "var(--font-mono)", fontWeight: 600, color: quakeColor(q.mag) }}>
                    {q.mag != null ? q.mag.toFixed(1) : "—"}
                  </span>
                  <span style={{ fontSize: 13, flex: 1 }}>{q.place}</span>
                  <span className="foot mono">{formatElapsed(q.elapsed_min)}</span>
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ---------- earth vs others ---------- */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <SectionHead eyebrow={t("earth.compare.eyebrow")} title={t("earth.compare.title")} />
          <table className="data">
            <thead>
              <tr>
                <th>{t("earth.compare.feature")}</th>
                <th>{t("nav.earth")}</th>
                <th>{t("earth.compare.comparison")}</th>
              </tr>
            </thead>
            <tbody>
              {["water", "tectonics", "oxygen", "moonSize", "magnetosphere", "life"].map((k) => (
                <tr key={k}>
                  <td>{t(`earth.compare.r.${k}`)}</td>
                  <td className="mono hl">{t(`earth.compare.r.${k}V`)}</td>
                  <td className="mono">{t(`earth.compare.r.${k}C`)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* ---------- seasons ---------- */}
      <section className="section" id="seasons" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <SectionHead eyebrow={t("earth.seasons.eyebrow")} title={t("earth.seasons.title")} />
          <div className="grid cols-2" style={{ alignItems: "center" }}>
            <div style={{ display: "flex", justifyContent: "center" }}>
              <svg viewBox="0 0 260 220" xmlns="http://www.w3.org/2000/svg">
                <line x1="0" y1="120" x2="80" y2="120" stroke="#FFD37A" strokeWidth="2" opacity="0.7" />
                <circle cx="130" cy="120" r="46" fill="#2E7DB0" />
                <ellipse cx="130" cy="120" rx="46" ry="12" fill="none" stroke="#fff" strokeOpacity="0.4" strokeWidth="1" transform="rotate(23.4 130 120)" />
                <line x1="102.6" y1="183.3" x2="157.4" y2="56.7" stroke="var(--gold)" strokeWidth="1.6" strokeDasharray="3 3" />
                <text className="mars-moon-label" x="130" y="214" textAnchor="middle" fill="var(--gold)">
                  {t("earth.seasons.svgLabel")}
                </text>
              </svg>
            </div>
            <div>
              <p style={{ color: "var(--text-dim)", fontSize: 14, lineHeight: 1.75 }}>
                {t("earth.seasons.p1")}
              </p>
              <p style={{ color: "var(--text-dim)", fontSize: 14, lineHeight: 1.75, marginTop: 14 }}>
                {t("earth.seasons.p2")}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- interior ---------- */}
      <section className="section" id="interior" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <SectionHead eyebrow={t("earth.interior.eyebrow")} title={t("earth.interior.title")} sub={t("earth.interior.sub")} />
          <div className="depth-wrap" style={{ marginTop: 10 }}>
            <div className="depth-bar" style={{ background: "linear-gradient(to bottom, #8B6F47, #B8622F 25%, #E8622F 55%, #FFD37A 82%, #FFF3D6)" }} />
            <div className="depth-marks">
              <div className="pmark" style={{ top: "2%" }}>
                <span className="txt">{t("earth.interior.m1")}</span>
                <span className="ln" />
              </div>
              <div className="pmark" style={{ top: "18%" }}>
                <span className="txt">{t("earth.interior.m2")}</span>
                <span className="ln" />
              </div>
              <div className="pmark" style={{ top: "55%" }}>
                <span className="txt">{t("earth.interior.m3")}</span>
                <span className="ln" />
              </div>
              <div className="pmark" style={{ top: "90%" }}>
                <span className="txt">{t("earth.interior.m4")}</span>
                <span className="ln" />
              </div>
              <div className="pmark hl" style={{ top: "97%" }}>
                <span className="txt">{t("earth.interior.m5")}</span>
                <span className="ln" />
              </div>
            </div>
          </div>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)", marginTop: 16 }}>
            {t("earth.interior.quakesNote")}{" "}
            <a href="#earthquakes" className="section-link" style={{ display: "inline" }}>{t("earth.quakes.title")} →</a>
          </p>
        </div>
      </section>

      {/* ---------- atmosphere ---------- */}
      <section className="section" id="atmosphere" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <SectionHead eyebrow={t("earth.atmosphere.eyebrow")} title={t("earth.atmosphere.title")} sub={t("earth.atmosphere.sub")} />
          <div className="depth-wrap" style={{ marginTop: 10 }}>
            <div className="depth-bar" style={{ background: "linear-gradient(to bottom, #050614, #123A5C 25%, #2E7DB0 55%, #7EC8E3 82%, #E8F4FA)" }} />
            <div className="depth-marks">
              <div className="pmark" style={{ top: "2%" }}>
                <span className="txt">{t("earth.atmosphere.m1")}</span>
                <span className="ln" />
              </div>
              <div className="pmark" style={{ top: "20%" }}>
                <span className="txt">{t("earth.atmosphere.m2")}</span>
                <span className="ln" />
              </div>
              <div className="pmark" style={{ top: "45%" }}>
                <span className="txt">{t("earth.atmosphere.m3")}</span>
                <span className="ln" />
              </div>
              <div className="pmark" style={{ top: "65%" }}>
                <span className="txt">{t("earth.atmosphere.m4")}</span>
                <span className="ln" />
              </div>
              <div className="pmark hl" style={{ top: "96%" }}>
                <span className="txt">{t("earth.atmosphere.m5")}</span>
                <span className="ln" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- magnetosphere ---------- */}
      <section className="section" id="magnetosphere" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <SectionHead eyebrow={t("earth.magnetosphere.eyebrow")} title={t("earth.magnetosphere.title")} />
          <div className="grid cols-3">
            <div className="card">
              <div className="k">{t("earth.magnetosphere.sourceKey")}</div>
              <div className="v" style={{ fontSize: 20 }}>{t("earth.magnetosphere.sourceVal")}</div>
              <div className="foot">{t("earth.magnetosphere.sourceFoot")}</div>
            </div>
            <div className="card">
              <div className="k">{t("earth.magnetosphere.protectKey")}</div>
              <div className="v" style={{ fontSize: 20 }}>{t("earth.magnetosphere.protectVal")}</div>
              <div className="foot">{t("earth.magnetosphere.protectFoot")}</div>
            </div>
            <div className="card">
              <div className="k">{t("earth.magnetosphere.auroraKey")}</div>
              <div className="v" style={{ fontSize: 20 }}>{t("earth.magnetosphere.auroraVal")}</div>
              <div className="foot">{t("earth.magnetosphere.auroraFoot")}</div>
            </div>
          </div>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)", marginTop: 14 }}>
            {t("earth.magnetosphere.note")}{" "}
            <LocalizedLink to="weather">{t("weather.eyebrow")}{" "}</LocalizedLink>
          </p>
        </div>
      </section>

      {/* ---------- moon connection ---------- */}
      <section className="section" id="moon-relationship" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <SectionHead eyebrow={t("earth.moonRel.eyebrow")} title={t("earth.moonRel.title")} />
          <div className="grid cols-2">
            <div className="card" style={{ padding: 22 }}>
              <div className="k">{t("earth.moonRel.recedeKey")}</div>
              <div style={{ marginTop: 10, fontSize: 13.5, color: "var(--text-dim)", lineHeight: 1.7 }}>
                {t("earth.moonRel.recedeBody")}
              </div>
            </div>
            <div className="card" style={{ padding: 22 }}>
              <div className="k">{t("earth.moonRel.dayKey")}</div>
              <div style={{ marginTop: 10, fontSize: 13.5, color: "var(--text-dim)", lineHeight: 1.7 }}>
                {t("earth.moonRel.dayBody")}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- satellites ---------- */}
      <section className="section" id="observation" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <SectionHead eyebrow={t("earth.observation.eyebrow")} title={t("earth.observation.title")} />
          <div className="card" style={{ padding: "8px 22px" }}>
            <div className="mission-row">
              <span className="dot live" />
              <span className="nm">{t("earth.observation.s1")}</span>
              <span className="ag">NASA/Роскосмос/ESA/JAXA</span>
              <span className="yr">1998</span>
              <span className="st active">{t("earth.observation.s1_detail")}</span>
            </div>
            <div className="mission-row">
              <span className="dot live" />
              <span className="nm">{t("earth.observation.s2")}</span>
              <span className="ag">NASA/NOAA</span>
              <span className="yr">2015</span>
              <span className="st active">{t("earth.observation.s2_detail")}</span>
            </div>
            <div className="mission-row">
              <span className="dot live" />
              <span className="nm">{t("earth.observation.s3")}</span>
              <span className="ag">NASA/USGS</span>
              <span className="yr">2021</span>
              <span className="st active">{t("earth.observation.s3_detail")}</span>
            </div>
            <div className="mission-row">
              <span className="dot live" />
              <span className="nm">{t("earth.observation.s4")}</span>
              <span className="ag">ESA</span>
              <span className="yr">2015</span>
              <span className="st active">{t("earth.observation.s4_detail")}</span>
            </div>
            <div className="mission-row">
              <span className="dot live" />
              <span className="nm">{t("earth.observation.s5")}</span>
              <span className="ag">NOAA</span>
              <span className="yr">2024</span>
              <span className="st active">{t("earth.observation.s5_detail")}</span>
            </div>
          </div>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)", marginTop: 12 }}>
            {t("earth.observation.note")}{" "}
            <LocalizedLink to="iss">{t("iss.eyebrow")}{" "}</LocalizedLink>
          </p>
        </div>
      </section>

      {/* ---------- records ---------- */}
      <section className="section" id="facts" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <SectionHead eyebrow={t("earth.records.eyebrow")} title={t("earth.records.title")} />
          <div className="grid cols-3">
            <div className="card">
              <div className="k">{t("earth.records.c1_key")}</div>
              <div className="v" style={{ fontSize: 20 }}>{t("earth.records.c1_val")}</div>
              <div className="foot">{t("earth.records.c1_foot")}</div>
            </div>
            <div className="card">
              <div className="k">{t("earth.records.c2_key")}</div>
              <div className="v" style={{ fontSize: 20 }}>{t("earth.records.c2_val")}</div>
              <div className="foot">{t("earth.records.c2_foot")}</div>
            </div>
            <div className="card">
              <div className="k">{t("earth.records.c3_key")}</div>
              <div className="v" style={{ fontSize: 20 }}>{t("earth.records.c3_val")}</div>
              <div className="foot">{t("earth.records.c3_foot")}</div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
