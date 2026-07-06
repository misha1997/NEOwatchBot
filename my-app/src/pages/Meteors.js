// Meteors page (meteors.html): shower calendar + observing tips.
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useLang } from "../context/LanguageContext";
import { useApi } from "../hooks/useApi";
import { getMeteors } from "../lib/api";
import SectionHead from "../components/primitives/SectionHead";
import FeatureRow from "../components/primitives/FeatureRow";
import LocationPill from "../components/LocationPill";
import MeteorCard from "../components/meteors/MeteorCard";

export default function Meteors() {
  const { t } = useTranslation();
  useEffect(() => { document.title = t("title.meteors"); }, [t]);
  const { lang } = useLang();
  const { data } = useApi(() => getMeteors(lang), { deps: [lang] });
  const items = (data && data.items) || [];
  return (
    <>
      <section className="hero">
        <div className="wrap">
          <div style={{ maxWidth: 680 }}>
            <div className="eyebrow">{t("meteors.hero.eyebrow")}</div>
            <h1 className="hero-title" dangerouslySetInnerHTML={{ __html: t("meteors.hero.title") }} />
            <p className="hero-sub">{t("meteors.hero.sub")}</p>
            <div className="hero-actions">
              <a href="#calendar" className="btn primary">{t("meteors.hero.calendar")}</a>
              <a href="#tips" className="btn ghost">{t("meteors.hero.tips")}</a>
            </div>
            <LocationPill />
          </div>
        </div>
      </section>

      <section className="section" id="calendar" style={{ paddingTop: 8 }}>
        <div className="wrap">
          <SectionHead eyebrow={t("meteors.s1.eyebrow")} title={t("meteors.s1.title")} />
          <p className="section-sub">{t("meteors.s1.sub")}</p>
          <div className="grid cols-3" id="meteor-grid">
            {!data ? (
              <div className="card"><div className="k">{t("common.loading")}</div></div>
            ) : items.length === 0 ? (
              <div className="card"><p style={{ color: "var(--text-dim)" }}>{t("common.notFound")}</p></div>
            ) : items.map((s, i) => <MeteorCard key={i} s={s} />)}
          </div>
        </div>
      </section>

      <section className="section" id="tips" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <SectionHead eyebrow={t("meteors.s2.eyebrow")} title={t("meteors.s2.title")} />
          <FeatureRow tag={t("meteors.tips.t1_tag")} title={t("meteors.tips.t1_title")}>{t("meteors.tips.t1_body")}</FeatureRow>
          <FeatureRow tag={t("meteors.tips.t2_tag")} title={t("meteors.tips.t2_title")}>{t("meteors.tips.t2_body")}</FeatureRow>
          <FeatureRow tag={t("meteors.tips.t3_tag")} title={t("meteors.tips.t3_title")}>{t("meteors.tips.t3_body")}</FeatureRow>
          <FeatureRow tag={t("meteors.tips.t4_tag")} title={t("meteors.tips.t4_title")}>{t("meteors.tips.t4_body")}</FeatureRow>
        </div>
      </section>
    </>
  );
}