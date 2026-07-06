// Asteroids page (asteroids.html): NEO close-approach grid + the orbit radar.
// Port of app.js loadNeo / renderNeoOrbit.
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useLang } from "../context/LanguageContext";
import { useApi } from "../hooks/useApi";
import { getNeo } from "../lib/api";
import StatMini from "../components/primitives/StatMini";
import SectionHead from "../components/primitives/SectionHead";
import NeoOrbit from "../components/asteroids/NeoOrbit";
import AsterCard from "../components/asteroids/AsterCard";

export default function Asteroids() {
  const { t } = useTranslation();
  useEffect(() => { document.title = t("title.asteroids"); }, [t]);
  const { lang } = useLang();
  const { data } = useApi(() => getNeo(lang), { deps: [lang] });

  // Static placeholder cards shown until /api/neo resolves, so the page never
  // looks empty. Built inside the component so they can use t(...).
  const PLACEHOLDERS = [
    { name: "2026 QT4", hazardous: false, approach: t("asteroids.ph.approach", { date: t("asteroids.ph.d1") }), diameter_min: 45, diameter_max: 100, distance_ld: 1.8, velocity_kms: 14.2 },
    { name: "2026 PL9", hazardous: true, approach: t("asteroids.ph.approach", { date: t("asteroids.ph.d2") }), diameter_min: 120, diameter_max: 270, distance_ld: 0.6, velocity_kms: 21.7 },
    { name: "2025 XR2", hazardous: false, approach: t("asteroids.ph.approach", { date: t("asteroids.ph.d3") }), diameter_min: 20, diameter_max: 45, distance_ld: 3.4, velocity_kms: 9.8 },
    { name: "2026 RM1", hazardous: true, approach: t("asteroids.ph.approach", { date: t("asteroids.ph.d4") }), diameter_min: 310, diameter_max: 690, distance_ld: 4.9, velocity_kms: 17.5 },
    { name: "2026 QA7", hazardous: false, approach: t("asteroids.ph.approach", { date: t("asteroids.ph.d5") }), diameter_min: 15, diameter_max: 35, distance_ld: 8.1, velocity_kms: 12.0 },
    { name: "2024 YB3", hazardous: true, approach: t("asteroids.ph.approach", { date: t("asteroids.ph.d6") }), diameter_min: 60, diameter_max: 140, distance_ld: 0.9, velocity_kms: 25.3 },
  ];

  const items = (data && data.items) || PLACEHOLDERS;
  const total = data ? (data.total || items.length) : "—";
  const hazardous = data ? (data.hazardous_count || 0) : "—";
  return (
    <>
      <section className="hero">
        <div className="wrap hero-grid">
          <div>
            <div className="eyebrow">{t("asteroids.hero.eyebrow")}</div>
            <h1 className="hero-title" dangerouslySetInnerHTML={{ __html: t("asteroids.hero.title") }} />
            <p className="hero-sub">{t("asteroids.hero.sub")}</p>
            <div className="stat-mini" id="neo-stats" style={{ marginTop: 26, maxWidth: 380 }}>
              <StatMini boxes={[
                { n: total, l: t("asteroids.stats.approaches") },
                { n: hazardous, l: t("asteroids.stats.hazardous"), danger: true },
              ]} />
            </div>
          </div>
          <div className="orbit-wrap">
            <NeoOrbit items={data ? items : []} />
          </div>
        </div>
        <div className="wrap" style={{ marginTop: 8 }}>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            <div className="legend-row"><span className="legend-swatch" style={{ background: "var(--gold)" }} /> {t("asteroids.legend.safe")}</div>
            <div className="legend-row"><span className="legend-swatch" style={{ background: "var(--coral)" }} /> {t("asteroids.legend.hazard")}</div>
            <div className="legend-row"><span className="legend-swatch" style={{ background: "var(--teal)", opacity: 0.6 }} /> {t("asteroids.legend.moon")}</div>
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 8 }}>
        <div className="wrap">
          <SectionHead eyebrow={t("asteroids.s1.eyebrow")} title={t("asteroids.s1.title")} />
          <div className="aster-grid" id="neo-grid">
            {items.map((a, i) => <AsterCard key={i} a={a} />)}
          </div>
        </div>
      </section>
    </>
  );
}