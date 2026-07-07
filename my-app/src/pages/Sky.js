// Sky-observer page (sky.html): visible planets, Moon phase, space-weather
// strip, observing tips, and the weekly sky calendar.
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useLang } from "../context/LanguageContext";
import SectionHead from "../components/primitives/SectionHead";
import FeatureRow from "../components/primitives/FeatureRow";
import LocationPill from "../components/LocationPill";
import PlanetsTable from "../components/sky/PlanetsTable";
import MoonCard from "../components/sky/MoonCard";
import SkyWeather from "../components/sky/SkyWeather";
import SkyCalendar from "../components/sky/SkyCalendar";

export default function Sky() {
  const { t } = useTranslation();
  useEffect(() => { document.title = t("title.sky"); }, [t]);
  const { lang } = useLang();
  return (
    <>
      <section className="hero">
        <div className="wrap">
          <div style={{ maxWidth: 680 }}>
            <div className="eyebrow">{t("sky.hero.eyebrow")}</div>
            <h1 className="hero-title" dangerouslySetInnerHTML={{ __html: t("sky.hero.title") }} />
            <p className="hero-sub">{t("sky.hero.sub")}</p>
            <div className="hero-actions">
              <a href="#planets" className="btn primary">{t("sky.hero.planets")}</a>
              <a href="#diary" className="btn ghost">{t("sky.hero.diary")}</a>
            </div>
            <LocationPill />
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 8 }}>
        <div className="wrap">
          <div className="grid cols-2 split">
            <div className="card" id="planets">
              <div className="k">{t("sky.planets.title")} <span className="dot live" /></div>
              <div style={{ marginTop: 14 }}>
                <PlanetsTable lang={lang} />
              </div>
            </div>
            <MoonCard lang={lang} />
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <SectionHead eyebrow={t("sky.s1.eyebrow")} title={t("sky.s1.title")}
            linkTo="/" linkLabel={t("sky.s1.link")} />
          <SkyWeather />
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <SectionHead eyebrow={t("sky.s2.eyebrow")} title={t("sky.s2.title")} />
          <FeatureRow tag={t("sky.tips.t1_tag")} title={t("sky.tips.t1_title")} href="#">{t("sky.tips.t1_body")}</FeatureRow>
          <FeatureRow tag={t("sky.tips.t2_tag")} title={t("sky.tips.t2_title")} href="#">{t("sky.tips.t2_body")}</FeatureRow>
          <FeatureRow tag={t("sky.tips.t3_tag")} title={t("sky.tips.t3_title")} href="#">{t("sky.tips.t3_body")}</FeatureRow>
          <FeatureRow tag={t("sky.tips.t4_tag")} title={t("sky.tips.t4_title")} to="/">{t("sky.tips.t4_body")}</FeatureRow>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <SectionHead eyebrow={t("sky.s3.eyebrow")} title={t("sky.s3.title")} />
          <SkyCalendar lang={lang} />
        </div>
      </section>
    </>
  );
}