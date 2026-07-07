// Homepage (index.html): hero with the sky-dome, tonight's sky events,
// space-weather strip, ISS passes, launches table, and the section grid.
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BOT_URL } from "../lib/constants";
import { useLoc, locCity } from "../context/LocationContext";
import SectionHead from "../components/primitives/SectionHead";
import FeatureCard from "../components/primitives/FeatureCard";
import LocationPill from "../components/LocationPill";
import SkyDome from "../components/SkyDome";
import SkyEvents from "../components/home/SkyEvents";
import WeatherCards from "../components/home/WeatherCards";
import IssPassCards from "../components/home/IssPassCards";
import LaunchesTable from "../components/launches/LaunchesTable";

export default function Home() {
  const { t } = useTranslation();
  const { loc } = useLoc();
  const city = locCity(loc) || t("common.kyiv");
  useEffect(() => { document.title = t("title.home"); }, [t]);
  return (
    <>
      <section className="hero">
        <div className="wrap">
          <div className="hero-grid">
            <div>
              <div className="eyebrow">{t("home.hero.eyebrow")}</div>
              <h1 className="hero-title" dangerouslySetInnerHTML={{ __html: t("home.hero.title") }} />
              <p className="hero-sub">{t("home.hero.sub")}</p>
              <div className="hero-actions">
                <Link to="/sky" className="btn primary">{t("home.hero.skyNow")}</Link>
                <a href={BOT_URL} className="btn ghost" target="_blank" rel="noopener">{t("home.hero.telegram")}</a>
              </div>
              <LocationPill />
            </div>
            <SkyDome />
          </div>
        </div>
      </section>

      <section className="section" id="tonight">
        <div className="wrap">
          <SectionHead eyebrow={t("home.tonight.eyebrow")} title={t("home.tonight.title", { city })}
            linkTo="/sky" linkLabel={t("home.tonight.link")} />
          <p className="section-sub">{t("home.tonight.sub", {
            lat: Math.abs(Math.round(loc ? loc.lat : 50)),
            ns: ((loc ? loc.lat : 50) >= 0) ? t("common.latN") : t("common.latS"),
          })}</p>
          <SkyEvents />
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <SectionHead eyebrow={t("home.weather.eyebrow")} title={t("home.weather.title")}
            linkHref="#" linkLabel={t("home.weather.link")} />
          <WeatherCards />
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <SectionHead gold eyebrow={t("home.iss.eyebrow")} title={t("home.iss.title")}
            linkTo="/iss" linkLabel={t("home.iss.link")} />
          <IssPassCards />
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <SectionHead eyebrow={t("home.launches.eyebrow")} title={t("home.launches.title")}
            linkTo="/launches" linkLabel={t("home.launches.link")} />
          <LaunchesTable />
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <SectionHead eyebrow={t("home.sections.eyebrow")} title={t("home.sections.title")}
            sub={t("home.sections.sub")} />
          <div className="fcards">
            <FeatureCard to="/iss" icon="🛰️" title={t("home.sections.issTitle")}>
              {t("home.sections.issBody")}
            </FeatureCard>
            <FeatureCard to="/sky" icon="🔭" title={t("home.sections.skyTitle")}>
              {t("home.sections.skyBody")}
            </FeatureCard>
          </div>
        </div>
      </section>
    </>
  );
}