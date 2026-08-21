// Homepage (index.html): hero with the sky-dome, tonight's sky events,
// space-weather strip, ISS passes, launches calendar, and the section grid.
// Block bodies ported from the orbit-light design sample (SVG visualizations,
// live countdowns, day-grouped launches, full section grid).
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { BOT_URL } from "../lib/constants";
import LocalizedLink from "../components/primitives/LocalizedLink";
import { useLoc, locCity } from "../context/LocationContext";
import SectionHead from "../components/primitives/SectionHead";
import LocationPill from "../components/LocationPill";
import SkyDome from "../components/SkyDome";
import ApodCard from "../components/home/ApodCard";
import TonightPanel from "../components/home/TonightPanel";
import WeatherCards from "../components/home/WeatherCards";
import IssPassCards from "../components/home/IssPassCards";
import LaunchCalendar from "../components/home/LaunchCalendar";
import NewsCards from "../components/home/NewsCards";
import SectionsGrid from "../components/home/SectionsGrid";

export default function Home() {
  const { t } = useTranslation();
  const { loc } = useLoc();
  const city = locCity(loc) || t("common.kyiv");
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
                <LocalizedLink to="constellations" className="btn primary">{t("home.hero.skyNow")}</LocalizedLink>
                <a href={BOT_URL} className="btn ghost" target="_blank" rel="noopener">{t("home.hero.telegram")}</a>
              </div>
              <LocationPill />
            </div>
            <SkyDome />
          </div>
        </div>
      </section>

      <ApodCard />

      <section className="section" id="tonight">
        <div className="wrap">
          <SectionHead eyebrow={t("home.tonight.eyebrow")} title={t("home.tonight.title", { city })} />
          <p className="section-sub">{t("home.tonight.sub")}</p>
          <TonightPanel />
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <SectionHead eyebrow={t("home.weather.eyebrow")} title={t("home.weather.title")}
            linkHref="https://www.spaceweather.gov" linkLabel={t("home.weather.link")} />
          <WeatherCards />
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <SectionHead gold eyebrow={t("home.iss.eyebrow")} title={t("home.iss.title")}
            linkTo="iss" linkLabel={t("home.iss.link")} />
          <IssPassCards />
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <SectionHead eyebrow={t("home.news.eyebrow")} title={t("home.news.title")}
            linkTo="news" linkLabel={t("home.news.link")} />
          <NewsCards />
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <SectionHead eyebrow={t("home.launches.eyebrow")} title={t("home.launches.title")}
            linkTo="launches" linkLabel={t("home.launches.link")} />
          <LaunchCalendar />
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <SectionHead eyebrow={t("home.sections.eyebrow")} title={t("home.sections.title")}
            sub={t("home.sections.sub")} />
          <SectionsGrid />
        </div>
      </section>
    </>
  );
}