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