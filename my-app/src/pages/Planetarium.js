// Planetarium hub (/planetarium): a grid of all eight solar-system planets.
// Mars has a dedicated page (live weather + rover photos) so its card links
// through; the other seven aren't built yet and render as "soon" tiles. Each
// card shows a planet disc (SVG radial gradient), a short blurb and a row of
// key facts. Ports the visual language of templates/mars.html.
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { PLANETS, gradId } from "../lib/planets";
import { useSeo } from "../hooks/useSeo";
import "../styles/planetarium.css";

// One planet disc with an optional ring (Saturn). Gradient stops come from the
// planet registry; `prefix` keeps SVG gradient ids unique across cards.
function PlanetDisc({ planet, prefix, size = 150 }) {
  const id = gradId(prefix, planet.key);
  return (
    <svg viewBox="0 0 160 160" width={size} height={size} className="planet-disc">
      <defs>
        <radialGradient id={id} cx="35%" cy="32%" r="75%">
          <stop offset="0%" stopColor={planet.grad[0]} />
          <stop offset="55%" stopColor={planet.grad[1]} />
          <stop offset="100%" stopColor={planet.grad[2]} />
        </radialGradient>
      </defs>
      {planet.rings && (
        <ellipse cx="80" cy="80" rx="70" ry="14"
          fill="none" stroke={planet.accent} strokeOpacity="0.55" strokeWidth="2" />
      )}
      <circle cx="80" cy="80" r="50" fill={`url(#${id})`} />
      {planet.rings && (
        <path d="M10 80 A70 14 0 0 0 150 80" fill="none"
          stroke={planet.accent} strokeOpacity="0.7" strokeWidth="2" />
      )}
    </svg>
  );
}

export default function Planetarium() {
  const { t } = useTranslation();
  useSeo();
  useEffect(() => { document.title = t("title.planetarium"); }, [t]);

  const factLabel = (k) => t("planetarium.facts." + k);

  return (
    <>
      <section className="hero planetarium-hero">
        <div className="wrap">
          <div style={{ maxWidth: 760 }}>
            <div className="eyebrow gold">{t("planetarium.hero.eyebrow")}</div>
            <h1 className="hero-title" dangerouslySetInnerHTML={{ __html: t("planetarium.hero.title") }} />
            <p className="hero-sub">{t("planetarium.hero.sub")}</p>
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
                    <PlanetDisc planet={p} prefix="hub" />
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
                <Link key={p.key} to={p.to} className="planet-card">
                  {body}
                  <div className="planet-cta">{t("planetarium.open")} →</div>
                </Link>
              );
            })}
          </div>
          <p className="planet-foot-note">{t("planetarium.footNote")}</p>
        </div>
      </section>
    </>
  );
}