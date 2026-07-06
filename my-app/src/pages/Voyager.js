// Voyager page (voyager.html): trajectory diagram, live distance cards,
// mission timeline, comparison table, RTG power bars, Golden Record.
// Port of app.js loadVoyager / setVoyager.
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useApi } from "../hooks/useApi";
import { getVoyager } from "../lib/api";
import SectionHead from "../components/primitives/SectionHead";
import FeatureRow from "../components/primitives/FeatureRow";
import OrbitMap from "../components/voyager/OrbitMap";

function VoyagerCards({ t }) {
  const { data } = useApi(getVoyager);
  const d = data || {};
  const v1 = d["1"] || {};
  const v2 = d["2"] || {};
  const cards = [
    { k: t("voyager.cards.v1"), dot: "live", val: v1.au != null ? v1.au : "166", unit: t("common.units.ao"), foot: v1.light_hours != null ? t("voyager.cards.lightHours", { n: v1.light_hours }) : t("voyager.cards.lightHours", { n: "24.8" }) },
    { k: t("voyager.cards.v2"), dot: "live", val: v2.au != null ? v2.au : "139", unit: t("common.units.ao"), foot: v2.light_hours != null ? t("voyager.cards.lightHours", { n: v2.light_hours }) : t("voyager.cards.lightHours", { n: "20.8" }) },
    { k: t("voyager.cards.speedV1"), val: v1.speed_kms != null ? v1.speed_kms.toFixed(1) : "17.0", unit: t("common.units.km_s"), foot: v1.au_per_year != null ? t("voyager.cards.auPerYear", { n: v1.au_per_year }) : t("voyager.cards.auPerYear", { n: "3.6" }) },
    { k: t("voyager.cards.speedV2"), val: v2.speed_kms != null ? v2.speed_kms.toFixed(1) : "15.4", unit: t("common.units.km_s"), foot: v2.au_per_year != null ? t("voyager.cards.auPerYear", { n: v2.au_per_year }) : t("voyager.cards.auPerYear", { n: "3.3" }) },
  ];
  return (
    <div className="grid cols-4" id="voyager-cards">
      {cards.map((c, i) => (
        <div className="card" key={i}>
          <div className="k">{c.k}{c.dot && <span className={"dot " + c.dot} />}</div>
          <div className="v">{c.val}{c.unit && <span className="unit">{c.unit}</span>}</div>
          <div className="foot">{c.foot}</div>
        </div>
      ))}
    </div>
  );
}

function CompareTable({ v1, v2, t }) {
  const rows = [
    { p: t("voyager.row.launch"), a: t("voyager.row.launchV1"), b: t("voyager.row.launchV2") },
    { p: t("voyager.row.distance"), a: (v1.au != null ? v1.au + " " + t("common.units.ao") : "166 " + t("common.units.ao")), b: (v2.au != null ? v2.au + " " + t("common.units.ao") : "139 " + t("common.units.ao")) },
    { p: t("voyager.row.helio"), a: "25.08.2012", b: "05.11.2018" },
    { p: t("voyager.row.planets"), a: t("voyager.row.planetsV1"), b: t("voyager.row.planetsV2") },
    { p: t("voyager.row.dir"), a: t("voyager.row.north"), b: t("voyager.row.south") },
    { p: t("voyager.row.signal"), a: v1.light_hours != null ? t("voyager.row.signalV", { n: v1.light_hours }) : t("voyager.row.signalV", { n: "24.8" }), b: v2.light_hours != null ? t("voyager.row.signalV", { n: v2.light_hours }) : t("voyager.row.signalV", { n: "20.8" }) },
    { p: t("voyager.row.instruments"), a: t("voyager.row.instrumentsV"), b: t("voyager.row.instrumentsV") },
  ];
  return (
    <table className="data">
      <thead>
        <tr><th>{t("voyager.compare.col")}</th><th>{t("voyager.compare.v1")}</th><th>{t("voyager.compare.v2")}</th></tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            <td>{r.p}</td>
            <td className="hl">{r.a}</td>
            <td className="hl2">{r.b}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function Voyager() {
  const { t } = useTranslation();
  useEffect(() => { document.title = t("title.voyager"); }, [t]);
  const { data } = useApi(getVoyager);
  const d = data || {};
  const v1 = d["1"] || {};
  const v2 = d["2"] || {};
  return (
    <>
      <section className="hero">
        <div className="wrap hero-grid" style={{ marginBottom: 20 }}>
          <div>
            <div className="eyebrow">{t("voyager.hero.eyebrow")}</div>
            <h1 className="hero-title" dangerouslySetInnerHTML={{ __html: t("voyager.hero.title") }} />
            <p className="hero-sub">{t("voyager.hero.sub")}</p>
            <div className="hero-actions">
              <a href="#timeline" className="btn primary">{t("voyager.hero.timeline")}</a>
              <a href="#compare" className="btn ghost">{t("voyager.hero.compare")}</a>
            </div>
          </div>
          <div className="orbit-wrap">
            <OrbitMap />
          </div>
        </div>
        <div className="wrap" style={{ marginTop: 8 }}>
          <div style={{ display: "flex", gap: 26, flexWrap: "wrap" }}>
            <div className="legend-row"><span className="legend-swatch" style={{ background: "var(--gold)" }} /> {t("voyager.legend.v1")}</div>
            <div className="legend-row"><span className="legend-swatch" style={{ background: "var(--teal)" }} /> {t("voyager.legend.v2")}</div>
            <div className="legend-row"><span className="legend-swatch" style={{ background: "var(--coral)", opacity: 0.6 }} /> {t("voyager.legend.helio")}</div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <SectionHead eyebrow={t("voyager.s1.eyebrow")} title={t("voyager.s1.title")} />
          <VoyagerCards t={t} />
        </div>
      </section>

      <section className="section" id="timeline">
        <div className="wrap">
          <SectionHead eyebrow={t("voyager.s2.eyebrow")} title={t("voyager.s2.title")} />
          <FeatureRow tag={t("voyager.tl.t1_tag")} title={t("voyager.tl.t1_title")} num={t("voyager.tl.t1_num")}>{t("voyager.tl.t1_body")}</FeatureRow>
          <FeatureRow tag={t("voyager.tl.t2_tag")} title={t("voyager.tl.t2_title")} num={t("voyager.tl.t2_num")}>{t("voyager.tl.t2_body")}</FeatureRow>
          <FeatureRow tag={t("voyager.tl.t3_tag")} title={t("voyager.tl.t3_title")} num={t("voyager.tl.t3_num")}>{t("voyager.tl.t3_body")}</FeatureRow>
          <FeatureRow tag={t("voyager.tl.t4_tag")} title={t("voyager.tl.t4_title")} num={t("voyager.tl.t4_num")}>{t("voyager.tl.t4_body")}</FeatureRow>
          <FeatureRow tag={t("voyager.tl.t5_tag")} title={t("voyager.tl.t5_title")} num={t("voyager.tl.t5_num")}>{t("voyager.tl.t5_body")}</FeatureRow>
          <FeatureRow tag={t("voyager.tl.t6_tag")} title={t("voyager.tl.t6_title")} num={t("voyager.tl.t6_num")}>{t("voyager.tl.t6_body")}</FeatureRow>
        </div>
      </section>

      <section className="section" id="compare">
        <div className="wrap">
          <SectionHead eyebrow={t("voyager.s3.eyebrow")} title={t("voyager.s3.title")} />
          <CompareTable v1={v1} v2={v2} t={t} />
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <SectionHead eyebrow={t("voyager.s4.eyebrow")} title={t("voyager.s4.title")} />
          <div className="grid cols-2">
            <div className="card">
              <div className="k">{t("voyager.rtg.v1")}</div>
              <div className="pbar"><div style={{ width: "34%", background: "var(--gold)" }} /></div>
              <div className="foot" style={{ marginTop: 12 }}>{t("voyager.rtg.v1Body")}</div>
            </div>
            <div className="card">
              <div className="k">{t("voyager.rtg.v2")}</div>
              <div className="pbar"><div style={{ width: "31%", background: "var(--teal)" }} /></div>
              <div className="foot" style={{ marginTop: 12 }}>{t("voyager.rtg.v2Body")}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <SectionHead eyebrow={t("voyager.s5.eyebrow")} title={t("voyager.s5.title")} />
          <FeatureRow tag={t("voyager.gold.tag")} title={t("voyager.gold.title")} num={t("voyager.gold.num")}>{t("voyager.gold.body")}</FeatureRow>
        </div>
      </section>
    </>
  );
}