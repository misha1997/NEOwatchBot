// Deep space page (deep.html): orbital debris stats + GRB alerts, plus a
// Voyager teaser grid. Port of app.js loadDebris / loadGRB.
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useApi } from "../hooks/useApi";
import { getDebris, getGrb } from "../lib/api";
import { fmtInt } from "../lib/format";
import SectionHead from "../components/primitives/SectionHead";
import Eyebrow from "../components/primitives/Eyebrow";

function DebrisCard({ label, value, unit }) {
  return (
    <div className="card">
      <div className="k">{label}</div>
      <div className="v" style={{ fontSize: 26 }}>{value}{unit && <span className="unit">{unit}</span>}</div>
    </div>
  );
}

function Debris({ t }) {
  const { data } = useApi(getDebris);
  const d = data || {};
  const na = "—";
  return (
    <>
      <div className="grid cols-4" id="debris-stats">
        <DebrisCard label={t("deep.debris.tracked")} value={d.tracked != null ? fmtInt(d.tracked) : na} />
        <DebrisCard label={t("deep.debris.cm1")} value={d.cm1 != null ? fmtInt(d.cm1) : na} />
        <DebrisCard label={t("deep.debris.cm01")} value={d.cm01 != null ? fmtInt(d.cm01) : na} />
        <DebrisCard label={t("deep.debris.mass")} value={d.total_mass_t != null ? fmtInt(d.total_mass_t) : na} unit={t("deep.debris.tons")} />
      </div>
      <div className="grid cols-3" style={{ marginTop: 18 }}>
        <div className="card">
          <div className="k">{t("deep.debris.breakups")}</div>
          <div className="v accent" style={{ fontSize: 26, marginTop: 8 }}>
            <span id="debris-breakups">{d.breakups != null ? d.breakups : "—"}</span>
          </div>
          <div className="foot">{t("deep.debris.breakupsFoot")}</div>
        </div>
        <div className="card">
          <div className="k">{t("deep.debris.why")}</div>
          <p style={{ color: "var(--text-dim)", fontSize: 13, marginTop: 10, lineHeight: 1.55 }}>{t("deep.debris.whyBody")}</p>
        </div>
        <div className="card">
          <div className="k">{t("deep.debris.data")}</div>
          <p style={{ color: "var(--text-dim)", fontSize: 13, marginTop: 10, lineHeight: 1.55 }}>{t("deep.debris.dataBody", { year: d.year_ref || "—" })}</p>
          <a id="debris-source" href={d.source_url || "#"} target="_blank" rel="noopener" style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--teal)", display: "inline-block", marginTop: 10 }}>{t("deep.debris.source")}</a>
        </div>
      </div>
    </>
  );
}

function GrbList({ t }) {
  const { data } = useApi(() => getGrb(12));
  const items = (data && data.items) || [];
  return (
    <div className="event-list" id="grb-list" style={{ marginTop: 14 }}>
      {!data ? (
        <div style={{ color: "var(--text-dim)", fontSize: 13 }}>{t("deep.grb.loading")}</div>
      ) : items.length === 0 ? (
        <div style={{ color: "var(--text-dim)", fontSize: 13, padding: "6px 0" }}>{t("deep.grb.empty")}</div>
      ) : items.map((g, i) => (
        <div className="event" key={i}>
          <div className="ic coral">💥</div>
          <div>
            <div className="top"><h4>{g.grb_name}</h4><span className="t">#{g.circular_id}</span></div>
            <p>{g.title || ""}</p>
            <a href={g.url} target="_blank" rel="noopener" style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--teal)" }}>{t("deep.grb.link")}</a>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Deep() {
  const { t } = useTranslation();
  useEffect(() => { document.title = t("title.deep"); }, [t]);
  return (
    <>
      <section className="hero">
        <div className="wrap">
          <div style={{ maxWidth: 680 }}>
            <div className="eyebrow">{t("deep.hero.eyebrow")}</div>
            <h1 className="hero-title" dangerouslySetInnerHTML={{ __html: t("deep.hero.title") }} />
            <p className="hero-sub">{t("deep.hero.sub")}</p>
            <div className="hero-actions">
              <a href="#debris" className="btn primary">{t("deep.hero.debris")}</a>
              <a href="#grb" className="btn ghost">{t("deep.hero.grb")}</a>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="debris" style={{ paddingTop: 8 }}>
        <div className="wrap">
          <SectionHead eyebrow={t("deep.s1.eyebrow")} title={t("deep.s1.title")}
            linkHref="https://www.esa.int/Space_Safety/Space_Debris" linkLabel={t("deep.s1.link")} />
          <p className="section-sub">{t("deep.s1.sub")}</p>
          <Debris t={t} />
        </div>
      </section>

      <section className="section" id="grb" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <SectionHead eyebrow={t("deep.s2.eyebrow")} title={t("deep.s2.title")}
            linkHref="https://gcn.gsfc.nasa.gov/gcn3_archive.html" linkLabel={t("deep.s2.link")} />
          <p className="section-sub">{t("deep.s2.sub")}</p>
          <div className="grid cols-2 split">
            <div className="card">
              <div className="k">{t("deep.grb.fresh")} <span className="dot live" /></div>
              <GrbList t={t} />
            </div>
            <div className="card">
              <div className="k">{t("deep.grb.what")}</div>
              <p style={{ color: "var(--text-dim)", fontSize: 13.5, marginTop: 12, lineHeight: 1.6 }}>{t("deep.grb.whatBody1")}</p>
              <p style={{ color: "var(--text-dim)", fontSize: 13.5, marginTop: 12, lineHeight: 1.6 }}>{t("deep.grb.whatBody2")}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="voyager" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="section-head">
            <div>
              <Eyebrow gold>{t("deep.s3.eyebrow")}</Eyebrow>
              <h2 className="section-title">{t("deep.s3.title")}</h2>
            </div>
            <Link to="/voyager" className="section-link">{t("deep.s3.link")}</Link>
          </div>
          <div className="grid cols-2">
            <div className="card">
              <div className="k">{t("deep.v1.title")}</div>
              <p style={{ color: "var(--text-dim)", fontSize: 13.5, marginTop: 12, lineHeight: 1.6 }}>{t("deep.v1.body")}</p>
              <Link to="/voyager" className="btn ghost" style={{ marginTop: 14 }}>{t("deep.v1.link")}</Link>
            </div>
            <div className="card">
              <div className="k">{t("deep.v2.title")}</div>
              <p style={{ color: "var(--text-dim)", fontSize: 13.5, marginTop: 12, lineHeight: 1.6 }}>{t("deep.v2.body")}</p>
              <Link to="/voyager" className="btn ghost" style={{ marginTop: 14 }}>{t("deep.v2.link")}</Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}