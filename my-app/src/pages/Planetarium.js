// Planetarium hub (/planetarium): a grid of all eight solar-system planets.
// Mars has a dedicated page (live weather + rover photos) so its card links
// through; the other seven aren't built yet and render as "soon" tiles. Each
// card shows a planet photo (from /public/planets), a short blurb and a row of
// key facts. Ports the visual language of templates/mars.html.
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import LocalizedLink from "../components/primitives/LocalizedLink";
import { PLANETS } from "../lib/planets";
import { useSeo } from "../hooks/useSeo";
import "../styles/planetarium.css";

export default function Planetarium() {
  const { t, i18n } = useTranslation();
  useSeo();
  useEffect(() => { document.title = t("title.planetarium"); }, [t]);

  const factLabel = (k) => t("planetarium.facts." + k);

  return (
    <>
      <section className="hero planetarium-hero">
        <div className="wrap hero-grid">
          <div>
            <div className="eyebrow gold">{t("planetarium.hero.eyebrow")}</div>
            <h1 className="hero-title" dangerouslySetInnerHTML={{ __html: t("planetarium.hero.title") }} />
            <p className="hero-sub">{t("planetarium.hero.sub")}</p>
            <div className="hero-actions" style={{ marginTop: 24 }}>
              <LocalizedLink to="solarsystem3d" className="btn primary">
                {i18n.language === "en" ? "Explore Solar System in 3D" : "Сонячна система у 3D"}
              </LocalizedLink>
            </div>
          </div>
          <div className="orbit-wrap" style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
            <svg viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg" style={{ width: "100%", maxWidth: 360, height: "auto" }}>
              <defs>
                <radialGradient id="sunGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#FFF3D6" />
                  <stop offset="30%" stopColor="#FFD37A" />
                  <stop offset="100%" stopColor="#FFD37A" stopOpacity="0" />
                </radialGradient>
              </defs>
              <circle cx="200" cy="200" r="16" fill="url(#sunGlow)" />
              <circle cx="200" cy="200" r="6" fill="#FFD37A" />
              
              {/* Mercury */}
              <circle cx="200" cy="200" r="30" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
              <g>
                <circle cx="230" cy="200" r="2.5" fill="#C9C2BC" />
                <animateTransform attributeName="transform" type="rotate" from="0 200 200" to="360 200 200" dur="4s" repeatCount="indefinite" />
              </g>

              {/* Venus (Retrograde orbit direction check, actually planets all orbit prograde around the Sun, but let's keep orbit direction prograde and just rotate the planet itself retro. All planets orbit counter-clockwise around the Sun when viewed from North Pole. So from="0 200 200" to="360 200 200" for all!) */}
              <circle cx="200" cy="200" r="50" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
              <g>
                <circle cx="250" cy="200" r="3.5" fill="#E8C07A" />
                <animateTransform attributeName="transform" type="rotate" from="0 200 200" to="360 200 200" dur="6.5s" repeatCount="indefinite" />
              </g>

              {/* Earth */}
              <circle cx="200" cy="200" r="75" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
              <g>
                <circle cx="275" cy="200" r="4" fill="#4FD1C5" />
                <animateTransform attributeName="transform" type="rotate" from="0 200 200" to="360 200 200" dur="9s" repeatCount="indefinite" />
              </g>

              {/* Mars */}
              <circle cx="200" cy="200" r="100" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
              <g>
                <circle cx="300" cy="200" r="3.2" fill="#E25C5C" />
                <animateTransform attributeName="transform" type="rotate" from="0 200 200" to="360 200 200" dur="12s" repeatCount="indefinite" />
              </g>

              {/* Jupiter */}
              <circle cx="200" cy="200" r="130" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
              <g>
                <circle cx="330" cy="200" r="7" fill="#E8A068" />
                <animateTransform attributeName="transform" type="rotate" from="0 200 200" to="360 200 200" dur="20s" repeatCount="indefinite" />
              </g>

              {/* Saturn */}
              <circle cx="200" cy="200" r="160" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
              <g>
                <g transform="translate(360, 200)">
                  <circle cx="0" cy="0" r="5.5" fill="#F3D090" />
                  <ellipse cx="0" cy="0" rx="9" ry="2.5" fill="none" stroke="#F3D090" strokeWidth="1.5" opacity="0.8" transform="rotate(15)" />
                </g>
                <animateTransform attributeName="transform" type="rotate" from="0 200 200" to="360 200 200" dur="30s" repeatCount="indefinite" />
              </g>

              {/* Uranus */}
              <circle cx="200" cy="200" r="180" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
              <g>
                <circle cx="380" cy="200" r="4.5" fill="#B4E5F2" />
                <animateTransform attributeName="transform" type="rotate" from="0 200 200" to="360 200 200" dur="45s" repeatCount="indefinite" />
              </g>

              {/* Neptune */}
              <circle cx="200" cy="200" r="195" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
              <g>
                <circle cx="395" cy="200" r="4.2" fill="#6A9CF2" />
                <animateTransform attributeName="transform" type="rotate" from="0 200 200" to="360 200 200" dur="60s" repeatCount="indefinite" />
              </g>
            </svg>
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 8 }}>
        <div className="wrap">
          <div className="planet-grid">
            {PLANETS.map((p) => {
              const body = (
                <>
                  <div className="planet-disc-wrap">
                    <img
                      className="planet-photo"
                      src={p.img}
                      alt={t(p.labelKey)}
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                  <div className="planet-card-body">
                    <div className="planet-card-head">
                      <h3>{t(p.labelKey)}</h3>
                      {p.disabled
                        ? <span className="planet-soon">{t("planetarium.soon")}</span>
                        : <span className="planet-live">{t("planetarium.liveTag")}</span>}
                    </div>
                    <p className="planet-blurb">{t(p.blurbKey)}</p>
                    <div className="planet-facts">
                      <div><span className="fk">{factLabel("dia")}</span><span className="fv">{p.facts.dia}</span><span className="fu">{t("planetarium.units.km")}</span></div>
                      <div><span className="fk">{factLabel("day")}</span><span className="fv">{p.facts.day}</span><span className="fu">{t("planetarium.units.day")}</span></div>
                      <div><span className="fk">{factLabel("year")}</span><span className="fv">{p.facts.year}</span><span className="fu">{t("planetarium.units.year")}</span></div>
                      <div><span className="fk">{factLabel("gravity")}</span><span className="fv">{p.facts.gravity}</span><span className="fu">{t("planetarium.units.gravity")}</span></div>
                      <div><span className="fk">{factLabel("moons")}</span><span className="fv">{p.facts.moons}</span></div>
                      <div><span className="fk">{factLabel("temp")}</span><span className="fv">{p.facts.temp}</span></div>
                    </div>
                  </div>
                </>
              );
              return p.disabled ? (
                <div key={p.key} className="planet-card disabled" aria-disabled="true">
                  {body}
                </div>
              ) : (
                <LocalizedLink key={p.key} to={p.to} className="planet-card">
                  {body}
                  <div className="planet-cta">{t("planetarium.open")} →</div>
                </LocalizedLink>
              );
            })}
          </div>
          <p className="planet-foot-note">{t("planetarium.footNote")}</p>
        </div>
      </section>
    </>
  );
}