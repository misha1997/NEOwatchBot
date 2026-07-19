// Mercury planet page (/planetarium/mercury). Ports templates/mercury.html into the SPA.
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import SectionHead from "../components/primitives/SectionHead";
import { useSeo } from "../hooks/useSeo";
import { useApi } from "../hooks/useApi";
import { getMercury } from "../lib/api";
import "../styles/planetarium.css";

const MESSENGER_PHOTOS = [
  { key: "caloris", img_src: "/mercury/caloris.jpg", titleKey: "mercury.surface.c1", date: "MESSENGER" },
  { key: "rupes", img_src: "/mercury/rupes.jpg", titleKey: "mercury.surface.c2", date: "MESSENGER" },
  { key: "ice", img_src: "/mercury/ice.jpg", titleKey: "mercury.surface.c3", date: "MESSENGER" },
  { key: "surface", img_src: "/mercury/surface.jpg", titleKey: "mercury.surface.c4", date: "MESSENGER" },
];

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

      {/* ---------- mercury right now ---------- */}
      <section className="section" style={{ paddingTop: 8 }}>
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
          
          <div className="grid cols-2" style={{ alignItems: "center" }}>
            <div className="card" style={{ padding: 26 }}>
              <div className="k">
                {t("mercury.observe.until")}
                {data?.elongation_next && ` (${lang === "en" ? data.elongation_next.name_en : data.elongation_next.name_uk})`}
              </div>
              
              {passed ? (
                <div className="jupiter-opposition-now">{t("jupiter.opposition.passed")}</div>
              ) : (
                <div className="clock" style={{ marginTop: 14 }}>
                  <div className="seg">
                    <div className="n">{String(days).padStart(2, "0")}</div>
                    <span className="u">{t("mercury.observe.days")}</span>
                  </div>
                  <div className="seg">
                    <div className="n">{String(hours).padStart(2, "0")}</div>
                    <span className="u">{t("mercury.observe.hours")}</span>
                  </div>
                  <div className="seg">
                    <div className="n">{String(mins).padStart(2, "0")}</div>
                    <span className="u">{t("jupiter.opposition.mins")}</span>
                  </div>
                </div>
              )}
              
              <div className="foot" style={{ marginTop: 14 }}>
                {data?.elongation_next?.type === "eastern"
                  ? t("mercury.observe.footEastern")
                  : t("mercury.observe.footWestern")}
              </div>
            </div>
            
            <div className="card" style={{ padding: 26 }}>
              <div className="k">{t("mercury.observe.whyK")}</div>
              <p style={{ color: "var(--text-dim)", fontSize: 13.5, marginTop: 10, lineHeight: 1.7 }}>
                {t("mercury.observe.whyBody")}
              </p>
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
