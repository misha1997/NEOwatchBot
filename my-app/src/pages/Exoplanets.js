// Exoplanets page (exoplanets.html): confirmed/candidate counts, featured
// planet, radius-vs-period scatter, catalog table, notable finds.
// Port of the template, wired to live NASA Exoplanet Archive (TAP) data.
// Planets in the TOI-700 diagram and rows in the catalog table are clickable
// and surface a detail panel (ExoDetail) with the planet's parameters.
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useApi } from "../hooks/useApi";
import { getExoplanets } from "../lib/api";
import { fmtNum, fmtInt } from "../lib/format";
import SectionHead from "../components/primitives/SectionHead";
import FeatureRow from "../components/primitives/FeatureRow";
import ExoSystem from "../components/exoplanets/ExoSystem";
import SystemSlider from "../components/exoplanets/SystemSlider";
import ExoScatter from "../components/exoplanets/ExoScatter";
import ExoDetail from "../components/exoplanets/ExoDetail";
import { CardsSkeleton, ScatterSkeleton, CatalogSkeleton } from "../components/exoplanets/ExoplanetsSkeleton";

function radiusFoot(t, r) {
  if (r == null) return "";
  if (r < 0.85) return t("exoplanets.feat.radiusFootSmall");
  if (r <= 1.6) return t("exoplanets.feat.radiusFoot");
  return t("exoplanets.feat.radiusFootBig");
}

function habiFoot(t, key) {
  return t("exoplanets.feat." + (key || "unknown"));
}

export default function Exoplanets() {
  const { t } = useTranslation();
  useEffect(() => {
    document.title = t("title.exoplanets");
    document.body.classList.add("p-exoplanets");
    return () => document.body.classList.remove("p-exoplanets");
  }, [t]);

  const { data, loading } = useApi(() => getExoplanets(), { deps: [] });

  // Expanded catalog row index (accordion). null = none open.
  const [openRow, setOpenRow] = useState(null);

  // Selected star system for the interactive orrery (chips switch systems).
  const [systemId, setSystemId] = useState("trappist1");

  // Placeholder catalog rows (used until /api/exoplanets resolves).
  const ph = t("exoplanets.catalog.ph", { returnObjects: true });
  const PH = Array.isArray(ph) && ph.length ? ph.map((s, i) => ({
    name: s[`name${i + 1}`],
    host: s[`host${i + 1}`],
    radius: parseFloat(s[`r${i + 1}`]),
    period: parseFloat(s[`p${i + 1}`]),
    distance_ly: parseInt(s[`d${i + 1}`], 10),
    confirmed: s.phStatus[i] === "confirmed",
  })) : [];

  const confirmedCount = data ? fmtInt(data.confirmed_count) : t("exoplanets.hero.countFallback");
  const candidateCount = data ? fmtInt(data.candidate_count) : t("exoplanets.hero.countFallback");
  const featured = data && data.featured;
  const scatter = (data && data.scatter) || [];
  const catalog = (data && data.catalog && data.catalog.length) ? data.catalog : PH;
  const showSkeleton = loading && !data;

  // Featured card values: live if available, else placeholder TOI-700 d.
  const featName = featured ? featured.name : "TOI-700 d";
  const featRadius = featured ? fmtNum(featured.radius, 2) : "1.19";
  const featPeriod = featured ? fmtNum(featured.period, 1) : "37.4";
  const featDist = featured && featured.distance_ly != null ? Math.round(featured.distance_ly) : 101;
  const featRadiusFoot = featured ? radiusFoot(t, featured.radius) : t("exoplanets.feat.radiusFoot");
  const featPeriodFoot = featured && featured.host
    ? t("exoplanets.feat.periodFootHost", { host: featured.host })
    : t("exoplanets.feat.periodFoot");
  const featDistFoot = t("exoplanets.feat.distanceFoot");
  const featHabi = featured ? habiFoot(t, featured.habitability) : t("exoplanets.feat.habitable");

  return (
    <>
      <section className="hero">
        <div className="wrap hero-grid">
          <div>
            <div className="eyebrow">{t("exoplanets.hero.eyebrow")}</div>
            <h1 className="hero-title" dangerouslySetInnerHTML={{ __html: t("exoplanets.hero.title") }} />
            <p className="hero-sub">{t("exoplanets.hero.sub")}</p>
            <div className="stat-mini" style={{ marginTop: 26, maxWidth: 380 }}>
              <div className="box">
                <div className="n">{confirmedCount}</div>
                <div className="l">{t("exoplanets.hero.confirmedLabel")}</div>
              </div>
              <div className="box">
                <div className="n">{candidateCount}</div>
                <div className="l">{t("exoplanets.hero.candidateLabel")}</div>
              </div>
            </div>
            <p className="exo-interact-hint">{t("exoplanets.interact.hint")}</p>
          </div>
          <div className="exo-stage-col">
            <ExoSystem systemId={systemId} />
            <SystemSlider systemId={systemId} onSelect={setSystemId} />
            <p className="exo-caption">{t("exoplanets.systems." + systemId + ".caption")}</p>
          </div>
        </div>
        <div className="wrap" style={{ marginTop: 8 }}>
          <div className="exo-legend">
            <span className="legend-row">
              <span className="legend-swatch" style={{ background: "var(--teal)" }} />
              {t("exoplanets.legend.habitable")}
            </span>
            <span className="legend-row">
              <span className="legend-swatch" style={{ background: "var(--gold)" }} />
              {t("exoplanets.legend.edge")}
            </span>
            <span className="legend-row">
              <span className="legend-swatch" style={{ background: "var(--coral)" }} />
              {t("exoplanets.legend.hot")}
            </span>
            <span className="legend-row">
              <span className="legend-swatch" style={{ background: "#6f8bb0" }} />
              {t("exoplanets.legend.cold")}
            </span>
            <span className="legend-row">
              <span className="legend-swatch" style={{ background: "var(--teal)", opacity: 0.5 }} />
              {t("exoplanets.diagram.hzLabel")}
            </span>
          </div>
        </div>
      </section>

      {showSkeleton ? (
        <CardsSkeleton />
      ) : (
        <section className="section" style={{ paddingTop: 8 }}>
          <div className="wrap">
            <div className="grid cols-4">
              <div className="card">
                <div className="k">{t("exoplanets.featuredLabel")}</div>
                <div className="v" style={{ fontSize: 20 }}>{featName}</div>
                <div className="foot">{featHabi}</div>
              </div>
              <div className="card">
                <div className="k">{t("exoplanets.feat.radius")}</div>
                <div className="v">{featRadius}<span className="unit">{t("exoplanets.radiusUnit")}</span></div>
                <div className="foot">{featRadiusFoot}</div>
              </div>
              <div className="card">
                <div className="k">{t("exoplanets.feat.period")}</div>
                <div className="v">{featPeriod}<span className="unit">{t("exoplanets.periodUnit")}</span></div>
                <div className="foot">{featPeriodFoot}</div>
              </div>
              <div className="card">
                <div className="k">{t("exoplanets.feat.distance")}</div>
                <div className="v">{featDist}<span className="unit">{t("exoplanets.lyUnit")}</span></div>
                <div className="foot">{featDistFoot}</div>
              </div>
            </div>
          </div>
        </section>
      )}

      {showSkeleton ? (
        <ScatterSkeleton />
      ) : (
        <section className="section" id="scatter">
          <div className="wrap">
            <SectionHead eyebrow={t("exoplanets.scatter.eyebrow")} title={t("exoplanets.scatter.title")} />
            <div className="exo-scatter-wrap">
              <ExoScatter points={scatter} />
            </div>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)", marginTop: 10, textAlign: "center" }}>
              {t("exoplanets.scatter.legend")}
            </p>
          </div>
        </section>
      )}

      {showSkeleton ? (
        <CatalogSkeleton />
      ) : (
        <section className="section" id="catalog">
          <div className="wrap">
            <SectionHead eyebrow={t("exoplanets.catalog.eyebrow")} title={t("exoplanets.catalog.title")} />
            <div className="table-wrap">
              <table className="data exo-table">
                <thead>
                  <tr>
                    <th>{t("exoplanets.catalog.col.name")}</th>
                    <th>{t("exoplanets.catalog.col.host")}</th>
                    <th>{t("exoplanets.catalog.col.radius")}</th>
                    <th>{t("exoplanets.catalog.col.period")}</th>
                    <th>{t("exoplanets.catalog.col.distance")}</th>
                    <th>{t("exoplanets.catalog.col.status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {catalog.map((c, i) => (
                    <CatalogRow
                      key={i}
                      row={c}
                      open={openRow === i}
                      onToggle={() => setOpenRow(openRow === i ? null : i)}
                      t={t}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      <section className="section" id="notable">
        <div className="wrap">
          <SectionHead eyebrow={t("exoplanets.notable.eyebrow")} title={t("exoplanets.notable.title")} />
          <FeatureRow tag={t("exoplanets.notable.f1_tag")} title={t("exoplanets.notable.f1_title")} num={t("exoplanets.notable.f1_num")}>
            {t("exoplanets.notable.f1_body")}
          </FeatureRow>
          <FeatureRow tag={t("exoplanets.notable.f2_tag")} title={t("exoplanets.notable.f2_title")} num={t("exoplanets.notable.f2_num")}>
            {t("exoplanets.notable.f2_body")}
          </FeatureRow>
          <FeatureRow tag={t("exoplanets.notable.f3_tag")} title={t("exoplanets.notable.f3_title")} num={t("exoplanets.notable.f3_num")}>
            {t("exoplanets.notable.f3_body")}
          </FeatureRow>
        </div>
      </section>
    </>
  );
}

function CatalogRow({ row: c, open, onToggle, t }) {
  return (
    <>
      <tr className={"exo-row" + (open ? " open" : "")}
          onClick={onToggle}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(); } }}
          tabIndex={0}
          role="button"
          aria-expanded={open}
          title={t("exoplanets.interact.clickRow")}>
        <td>{c.name}</td>
        <td>{c.host}</td>
        <td className="mono">{c.radius != null ? fmtNum(c.radius, 2) + " R⊕" : t("exoplanets.catalog.noData")}</td>
        <td className="mono">{c.period != null ? fmtNum(c.period, 2) + " д" : t("exoplanets.catalog.noData")}</td>
        <td className="mono">{c.distance_ly != null ? c.distance_ly + " св. р." : t("exoplanets.catalog.noData")}</td>
        <td>
          <span className={c.confirmed ? "pill teal" : "pill gold"}>
            {c.confirmed ? t("exoplanets.catalog.confirmed") : t("exoplanets.catalog.candidate")}
          </span>
        </td>
      </tr>
      {open && (
        <tr className="exo-expanded-row">
          <td colSpan={6} className="exo-expanded">
            <ExoDetail planet={c} onClose={() => onToggle()} />
          </td>
        </tr>
      )}
    </>
  );
}