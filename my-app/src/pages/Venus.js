// Venus planet page (/planetarium/venus). Ports templates/venus.html into the SPA.
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import SectionHead from "../components/primitives/SectionHead";
import { useSeo } from "../hooks/useSeo";
import { useApi } from "../hooks/useApi";
import { getVenus } from "../lib/api";
import "../styles/planetarium.css";

const MAGELLAN_PHOTOS = [
  { key: "map", img_src: "/venus/map.jpg", titleKey: "venus.surface.p1", date: "1991-05-25" },
  { key: "maat", img_src: "/venus/maat.jpg", titleKey: "venus.surface.p2", date: "1992-04-20" },
  { key: "lakshmi", img_src: "/venus/lakshmi.jpg", titleKey: "venus.surface.p3", date: "1991-11-15" },
  { key: "mead", img_src: "/venus/mead.jpg", titleKey: "venus.surface.p4", date: "1990-12-05" },
];

export default function Venus() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language || "uk";
  useSeo();

  useEffect(() => {
    document.title = t("title.venus");
  }, [t]);

  const { data } = useApi(getVenus, { deps: [] });

  // ---- hero live stats -----------------------------------------------------
  const distStr = data?.distance_km
    ? Math.round(data.distance_km / 1e6) + " " + t("venus.hero.distUnit")
    : t("venus.hero.distL");
  const sigStr = data?.light_time_min != null
    ? (Math.round(data.light_time_min * 10) / 10) + " " + t("jupiter.opposition.mins")
    : t("venus.hero.signalL");

  // ---- countdown greatest brightness / elongation ------------------------
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  const { days, hours, passed } = useMemo(() => {
    const iso = data?.event_next?.date_iso;
    const target = iso ? new Date(iso).getTime() : 0;
    const diff = target - now;
    if (diff <= 0) {
      return { days: 0, hours: 0, passed: true };
    }
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    return { days, hours, passed: false };
  }, [data, now]);

  const eventLabel = data?.event_next
    ? (lang === "uk" ? data.event_next.name_uk : data.event_next.name_en)
    : "";
  const eventFoot = data?.event_next
    ? (lang === "uk" ? data.event_next.foot_uk : data.event_next.foot_en)
    : "";

  // ---- lightbox modal ------------------------------------------------------
  const [modalIdx, setModalIdx] = useState(null);

  useEffect(() => {
    if (modalIdx === null) return;
    const onKey = (e) => {
      if (e.key === "Escape") setModalIdx(null);
      else if (e.key === "ArrowLeft")
        setModalIdx((i) => (i === null ? null : (i - 1 + MAGELLAN_PHOTOS.length) % MAGELLAN_PHOTOS.length));
      else if (e.key === "ArrowRight")
        setModalIdx((i) => (i === null ? null : (i + 1) % MAGELLAN_PHOTOS.length));
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [modalIdx]);

  return (
    <>
      {/* ---------- hero ---------- */}
      <section className="hero">
        <div className="wrap hero-grid">
          <div>
            <div className="eyebrow">{t("venus.hero.eyebrow")}</div>
            <h1 className="hero-title" dangerouslySetInnerHTML={{ __html: t("venus.hero.title") }} />
            <p className="hero-sub">{t("venus.hero.sub")}</p>
            <div className="stat-mini" style={{ marginTop: 26, maxWidth: 420 }}>
              <div className="box">
                <div className="n">{distStr}</div>
                <div className="l">{t("venus.hero.distL")}</div>
              </div>
              <div className="box">
                <div className="n">{sigStr}</div>
                <div className="l">{t("venus.hero.signalL")}</div>
              </div>
            </div>
          </div>
          <div className="orbit-wrap" style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
            <img
              src="/planets/Venus.png"
              alt="Venus"
              style={{
                width: "100%",
                maxWidth: "320px",
                height: "auto",
                filter: "drop-shadow(0 0 50px rgba(232, 192, 122, 0.35))",
              }}
              className="planet-hero-img planet-spin-retro"
            />
          </div>
        </div>
        <div className="wrap" style={{ marginTop: 8 }}>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)", textAlign: "center" }}>
            {t("venus.hero.footnote")}
          </p>
        </div>
      </section>

      {/* ---------- live stats ---------- */}
      <section className="section" style={{ paddingTop: 8 }}>
        <div className="wrap">
          <SectionHead eyebrow={t("venus.stats.eyebrow")} title={t("venus.stats.title")} />
          <div className="grid cols-4">
            <div className="card">
              <div className="k">{t("venus.stats.temp")}</div>
              <div className="v">465<span className="unit">°C</span></div>
              <div className="foot">{t("venus.stats.tempFoot")}</div>
            </div>
            <div className="card">
              <div className="k">{t("venus.stats.pressure")}</div>
              <div className="v">92<span className="unit">атм</span></div>
              <div className="foot">{t("venus.stats.pressureFoot")}</div>
            </div>
            <div className="card">
              <div className="k">{t("venus.stats.speed")}</div>
              <div className="v">360<span className="unit">км/год</span></div>
              <div className="foot">{t("venus.stats.speedFoot")}</div>
            </div>
            <div className="card">
              <div className="k">{t("venus.stats.period")}</div>
              <div className="v">243<span className="unit">доби</span></div>
              <div className="foot">{t("venus.stats.periodFoot")}</div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- compare ---------- */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <SectionHead eyebrow={t("venus.compare.eyebrow")} title={t("venus.compare.title")} />
          <table className="data">
            <thead>
              <tr>
                <th>{t("venus.compare.param")}</th>
                <th>{t("nav.venus")}</th>
                <th>{t("nav.earth")}</th>
              </tr>
            </thead>
            <tbody>
              {["r1", "r2", "r3", "r4", "r5", "r6", "r7"].map((rk) => (
                <tr key={rk}>
                  <td>{t(`venus.compare.${rk}`)}</td>
                  <td className="mono hl">{t(`venus.compare.${rk}_v1`)}</td>
                  <td className="mono">{t(`venus.compare.${rk}_v2`)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)", marginTop: 12 }}>
            {t("venus.compare.footnote")}
          </p>
        </div>
      </section>

      {/* ---------- retrograde ---------- */}
      <section className="section" id="retrograde" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <SectionHead eyebrow={t("venus.retrograde.eyebrow")} title={t("venus.retrograde.title")} />
          <div className="grid cols-2" style={{ alignItems: "center" }}>
            <div style={{ display: "flex", justifyContent: "center", background: "rgba(255,255,255,0.02)", padding: "20px 10px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.05)" }}>
              <svg viewBox="0 0 360 180" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", maxWidth: 450, height: "auto" }}>
                <defs>
                  <clipPath id="sphereClip">
                    <circle cx="0" cy="0" r="32" />
                  </clipPath>
                  <g id="earthFeatures">
                    <path d="M-25,-12 Q-8,-20 8,-12 T39,-12" fill="none" stroke="#4FD1C5" strokeWidth="5" strokeLinecap="round" opacity="0.6" />
                    <path d="M39,-12 Q56,-20 72,-12 T103,-12" fill="none" stroke="#4FD1C5" strokeWidth="5" strokeLinecap="round" opacity="0.6" />
                    <path d="M-15,12 Q0,4 15,12 T49,12" fill="none" stroke="#4FD1C5" strokeWidth="6" strokeLinecap="round" opacity="0.6" />
                    <path d="M49,12 Q64,4 79,12 T113,12" fill="none" stroke="#4FD1C5" strokeWidth="6" strokeLinecap="round" opacity="0.6" />
                    <circle cx="-5" cy="-3" r="4" fill="#4FD1C5" opacity="0.6" />
                    <circle cx="59" cy="-3" r="4" fill="#4FD1C5" opacity="0.6" />
                    <circle cx="25" cy="4" r="3" fill="#4FD1C5" opacity="0.6" />
                    <circle cx="89" cy="4" r="3" fill="#4FD1C5" opacity="0.6" />
                  </g>
                  <g id="venusFeatures">
                    <path d="M-32,-12 L96,-12" fill="none" stroke="#B87B2E" strokeWidth="3" strokeDasharray="12,8" opacity="0.6" />
                    <path d="M-32,0 L96,0" fill="none" stroke="#D9A24B" strokeWidth="4" strokeDasharray="20,12" opacity="0.7" />
                    <path d="M-32,12 L96,12" fill="none" stroke="#B87B2E" strokeWidth="3" strokeDasharray="8,10" opacity="0.6" />
                    <path d="M-15,-4 Q-7,2 1,-4" fill="none" stroke="#FFF3D6" strokeWidth="2.5" opacity="0.5" />
                    <path d="M49,-4 Q57,2 65,-4" fill="none" stroke="#FFF3D6" strokeWidth="2.5" opacity="0.5" />
                    <path d="M15,6 Q23,12 31,6" fill="none" stroke="#FFF3D6" strokeWidth="2" opacity="0.5" />
                    <path d="M79,6 Q87,12 95,6" fill="none" stroke="#FFF3D6" strokeWidth="2" opacity="0.5" />
                  </g>
                  <radialGradient id="earthShade" cx="30%" cy="30%" r="70%">
                    <stop offset="0%" stopColor="#fff" stopOpacity="0.4" />
                    <stop offset="50%" stopColor="transparent" stopOpacity="0" />
                    <stop offset="100%" stopColor="#031628" stopOpacity="0.85" />
                  </radialGradient>
                  <radialGradient id="venusShade" cx="30%" cy="30%" r="70%">
                    <stop offset="0%" stopColor="#fff" stopOpacity="0.3" />
                    <stop offset="50%" stopColor="transparent" stopOpacity="0" />
                    <stop offset="100%" stopColor="#301500" stopOpacity="0.9" />
                  </radialGradient>
                </defs>

                {/* Left: Earth */}
                <g transform="translate(95, 80)">
                  <g transform="rotate(23.4)">
                    <circle cx="0" cy="0" r="32" fill="#0d3d5c" />
                    <g clipPath="url(#sphereClip)">
                      <g>
                        <use href="#earthFeatures" x="0" />
                        <use href="#earthFeatures" x="-64" />
                        <animateTransform attributeName="transform" type="translate" from="0 0" to="64 0" dur="4s" repeatCount="indefinite" />
                      </g>
                    </g>
                    <circle cx="0" cy="0" r="32" fill="url(#earthShade)" />
                    <line x1="0" y1="-40" x2="0" y2="40" stroke="#4FD1C5" strokeWidth="1.5" strokeDasharray="3,3" opacity="0.7" />
                  </g>
                  <text x="0" y="58" textAnchor="middle" fill="var(--text-dim)" fontSize="11" fontFamily="var(--font-sans)">
                    {t("venus.retrograde.earthLabel")}
                  </text>
                  <text x="0" y="72" textAnchor="middle" fill="#4FD1C5" fontSize="10" fontFamily="var(--font-mono)">
                    {t("venus.retrograde.earthDir")}
                  </text>
                </g>

                {/* Right: Venus */}
                <g transform="translate(265, 80)">
                  <g transform="rotate(-3)">
                    <circle cx="0" cy="0" r="32" fill="#E8C77A" />
                    <g clipPath="url(#sphereClip)">
                      <g>
                        <use href="#venusFeatures" x="0" />
                        <use href="#venusFeatures" x="64" />
                        <animateTransform attributeName="transform" type="translate" from="0 0" to="-64 0" dur="8s" repeatCount="indefinite" />
                      </g>
                    </g>
                    <circle cx="0" cy="0" r="32" fill="url(#venusShade)" />
                    <line x1="0" y1="-40" x2="0" y2="40" stroke="var(--coral)" strokeWidth="1.5" strokeDasharray="3,3" opacity="0.7" />
                  </g>
                  <text x="0" y="58" textAnchor="middle" fill="var(--text-dim)" fontSize="11" fontFamily="var(--font-sans)">
                    {t("venus.retrograde.venusLabel")}
                  </text>
                  <text x="0" y="72" textAnchor="middle" fill="var(--coral)" fontSize="10" fontFamily="var(--font-mono)">
                    {t("venus.retrograde.venusDir")}
                  </text>
                </g>
              </svg>
            </div>
            <div>
              <p style={{ color: "var(--text-dim)", fontSize: 14, lineHeight: 1.75 }}>
                {t("venus.retrograde.p1")}
              </p>
              <p style={{ color: "var(--text-dim)", fontSize: 14, lineHeight: 1.75, marginTop: 14 }}>
                {t("venus.retrograde.p2")}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- greenhouse ---------- */}
      <section className="section" id="greenhouse" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <SectionHead eyebrow={t("venus.greenhouse.eyebrow")} title={t("venus.greenhouse.title")} />
          <p className="section-sub">{t("venus.greenhouse.sub")}</p>
          <div className="depth-wrap" style={{ marginTop: 10 }}>
            <div className="depth-bar" style={{ background: "linear-gradient(to bottom, #F0D9A0, #D9A24B 30%, #B8621F 62%, #7A2E10 85%, #3D1408)" }} />
            <div className="depth-marks">
              <div className="pmark" style={{ top: "2%" }}>
                <span className="txt">{t("venus.greenhouse.m1")}</span>
                <span className="ln" />
              </div>
              <div className="pmark" style={{ top: "22%" }}>
                <span className="txt">{t("venus.greenhouse.m2")}</span>
                <span className="ln" />
              </div>
              <div className="pmark" style={{ top: "48%" }}>
                <span className="txt">{t("venus.greenhouse.m3")}</span>
                <span className="ln" />
              </div>
              <div className="pmark hl" style={{ top: "78%" }}>
                <span className="txt">{t("venus.greenhouse.m4")}</span>
                <span className="ln" />
              </div>
              <div className="pmark hl" style={{ top: "96%" }}>
                <span className="txt">{t("venus.greenhouse.m5")}</span>
                <span className="ln" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- surface ---------- */}
      <section className="section" id="surface" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <SectionHead eyebrow={t("venus.surface.eyebrow")} title={t("venus.surface.title")} />
          <p className="section-sub">{t("venus.surface.sub")}</p>
          <div className="gal">
            {MAGELLAN_PHOTOS.map((p, i) => (
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
              <div className="k">{t("venus.surface.volcanoes")}</div>
              <div className="v" style={{ fontSize: 20 }}>1 600+</div>
              <div className="foot">{t("venus.surface.volcanoesFoot")}</div>
            </div>
            <div className="card">
              <div className="k">{t("venus.surface.tectonics")}</div>
              <div className="v" style={{ fontSize: 20 }}>{t("venus.surface.tectonicsVal")}</div>
              <div className="foot">{t("venus.surface.tectonicsFoot")}</div>
            </div>
            <div className="card">
              <div className="k">{t("venus.surface.age")}</div>
              <div className="v" style={{ fontSize: 20 }}>{t("venus.surface.ageVal")}</div>
              <div className="foot">{t("venus.surface.ageFoot")}</div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- missions ---------- */}
      <section className="section" id="mission-status" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <SectionHead eyebrow={t("venus.missions.eyebrow")} title={t("venus.missions.title")} />
          <div className="card" style={{ padding: "8px 22px" }}>
            <div className="mission-row">
              <span className="dot live" />
              <span className="nm">Akatsuki</span>
              <span className="ag">JAXA</span>
              <span className="yr">2010</span>
              <span className="st active">{t("venus.missions.active")}</span>
            </div>
            <div className="mission-row">
              <span style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: "var(--text-dim)", display: "inline-block" }} />
              <span className="nm">Venera 7–14</span>
              <span className="ag">СРСР</span>
              <span className="yr">1970–81</span>
              <span className="st retired">{t("venus.compare.r6_v1")} (landed)</span>
            </div>
            <div className="mission-row">
              <span style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: "var(--text-dim)", display: "inline-block" }} />
              <span className="nm">Magellan</span>
              <span className="ag">NASA</span>
              <span className="yr">1990</span>
              <span className="st retired">radar mapping (1990-94)</span>
            </div>
            <div className="mission-row">
              <span style={{ width: 7, height: 7, borderRadius: "50%", backgroundColor: "var(--text-dim)", display: "inline-block" }} />
              <span className="nm">Venus Express</span>
              <span className="ag">ESA</span>
              <span className="yr">2006</span>
              <span className="st retired">{t("venus.missions.retired")} (2006-14)</span>
            </div>
            <div className="mission-row">
              <span className="dot live" />
              <span className="nm">DAVINCI</span>
              <span className="ag">NASA</span>
              <span className="yr">2029</span>
              <span className="st active">{t("venus.missions.active")} (scheduled)</span>
            </div>
            <div className="mission-row">
              <span className="dot live" />
              <span className="nm">VERITAS</span>
              <span className="ag">NASA</span>
              <span className="yr">2031</span>
              <span className="st active">{t("venus.missions.active")} (scheduled)</span>
            </div>
          </div>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)", marginTop: 12 }}>
            {t("venus.missions.footnote")}
          </p>
        </div>
      </section>

      {/* ---------- observe ---------- */}
      <section className="section" id="observe" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <SectionHead eyebrow={t("venus.observe.eyebrow")} title={t("venus.observe.title")} />
          <div className="grid cols-2" style={{ alignItems: "center" }}>
            <div className="card" style={{ padding: 26 }}>
              <div className="k">{t("venus.observe.target")}</div>
              {!passed && (
                <div className="clock" style={{ marginTop: 14 }}>
                  <div className="seg">
                    <div className="n">{days}</div>
                    <span className="u">{t("venus.observe.unitDays")}</span>
                  </div>
                  <div className="seg">
                    <div className="n">{hours}</div>
                    <span className="u">{t("venus.observe.unitHours")}</span>
                  </div>
                </div>
              )}
              <div className="foot" style={{ marginTop: 14 }}>
                {eventLabel ? `${eventLabel}: ` : ""}
                {eventFoot}
              </div>
            </div>
            <div className="card" style={{ padding: 26 }}>
              <div className="k">{t("venus.observe.phases")}</div>
              <p style={{ color: "var(--text-dim)", fontSize: 13.5, marginTop: 10, lineHeight: 1.7 }}>
                {t("venus.observe.phasesBody")}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- records ---------- */}
      <section className="section" id="facts" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <SectionHead eyebrow={t("venus.records.eyebrow")} title={t("venus.records.title")} />
          <div className="grid cols-3">
            <div className="card">
              <div className="k">{t("venus.records.c1_key")}</div>
              <div className="v" style={{ fontSize: 20 }}>{t("venus.records.c1_val")}</div>
              <div className="foot">{t("venus.records.c1_foot")}</div>
            </div>
            <div className="card">
              <div className="k">{t("venus.records.c2_key")}</div>
              <div className="v" style={{ fontSize: 20 }}>{t("venus.records.c2_val")}</div>
              <div className="foot">{t("venus.records.c2_foot")}</div>
            </div>
            <div className="card">
              <div className="k">{t("venus.records.c3_key")}</div>
              <div className="v" style={{ fontSize: 20 }}>{t("venus.records.c3_val")}</div>
              <div className="foot">{t("venus.records.c3_foot")}</div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- lightbox modal ---------- */}
      {modalIdx !== null && (
        <div className="photo-modal open" onClick={() => setModalIdx(null)}>
          <div className="photo-modal-inner" onClick={(e) => e.stopPropagation()}>
            <div className="photo-modal-img"
              style={{ backgroundImage: `url("${MAGELLAN_PHOTOS[modalIdx].img_src}")`, backgroundSize: "cover", backgroundPosition: "center" }}>
              <button className="photo-modal-close" onClick={() => setModalIdx(null)}>✕</button>
              <button className="photo-modal-nav prev"
                onClick={() => setModalIdx((i) => (i - 1 + MAGELLAN_PHOTOS.length) % MAGELLAN_PHOTOS.length)}>‹</button>
              <button className="photo-modal-nav next"
                onClick={() => setModalIdx((i) => (i + 1) % MAGELLAN_PHOTOS.length)}>›</button>
            </div>
            <div className="photo-modal-info">
              <div className="cat">MAGELLAN · NASA</div>
              <h3>{t(MAGELLAN_PHOTOS[modalIdx].titleKey)}</h3>
              <div className="d">{MAGELLAN_PHOTOS[modalIdx].date}</div>
              <p>{t(MAGELLAN_PHOTOS[modalIdx].titleKey + "Desc")}</p>
              <div className="dl-row"><span className="lbl">{t("mars.rovers.lightbox.camera")}</span><span className="val">Radar Altimeter</span></div>
              <div className="dl-row"><span className="lbl">{t("mars.rovers.lightbox.rover")}</span><span className="val">Magellan (NASA)</span></div>
              <div className="dl-row"><span className="lbl">{t("mars.rovers.lightbox.date")}</span><span className="val">1990–1994</span></div>
              <a className="section-link" style={{ marginTop: "auto", paddingTop: 18 }}
                href={MAGELLAN_PHOTOS[modalIdx].img_src} target="_blank" rel="noopener noreferrer">
                {t("mars.rovers.lightbox.openFull")} ↗
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
