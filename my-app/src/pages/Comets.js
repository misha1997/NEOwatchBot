// Comets page (comets.html): brightest comet now, orbit diagram, brightness
// curve, visible catalog, famous comets, observing how-to. Port of loadComets.
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useLang } from "../context/LanguageContext";
import { useApi } from "../hooks/useApi";
import { getComets } from "../lib/api";
import { fmtNum, genitiveConst, trendLabel } from "../lib/format";
import SectionHead from "../components/primitives/SectionHead";
import FeatureRow from "../components/primitives/FeatureRow";
import CometOrbit from "../components/comets/CometOrbit";
import CometBrightness from "../components/comets/CometBrightness";

function visPill(v) {
  return v === "naked_eye" ? "pill teal" : v === "binocular" ? "pill gold" : "pill";
}

export default function Comets() {
  const { t } = useTranslation();
  useEffect(() => { document.title = t("title.comets"); document.body.classList.add("p-comets"); return () => document.body.classList.remove("p-comets"); }, [t]);
  const { lang } = useLang();
  const { data } = useApi(() => getComets(lang), { deps: [lang] });
  const b = data && data.brightest;

  // Placeholder rows shown until /api/comets resolves. Built inside the
  // component so they can use t(...).
  const PH_VISIBLE = [
    { designation: "C/2025 R4 (Borёва)", type_label: t("comets.ph.type1"), magnitude: 4.8, constellation: t("comets.ph.const1"), best_time: "23:00–02:00", visibility: "naked_eye", visibility_label: t("comets.ph.vis1") },
    { designation: "29P/Schwassmann–Wachmann", type_label: t("comets.ph.type2"), magnitude: 11.2, constellation: t("comets.ph.const2"), best_time: "до 23:00", visibility: "telescope", visibility_label: t("comets.ph.vis2") },
    { designation: "C/2026 F3", type_label: t("comets.ph.type1"), magnitude: 9.6, constellation: t("comets.ph.const3"), best_time: "03:00–05:00", visibility: "binocular", visibility_label: t("comets.ph.vis3") },
    { designation: "67P/Чурюмова–Герасименко", type_label: t("comets.ph.type3"), magnitude: 14.1, constellation: t("comets.ph.const4"), best_time: "02:00–04:00", visibility: "telescope", visibility_label: t("comets.ph.vis4") },
  ];
  const visible = (data && data.visible) || PH_VISIBLE;

  const cometName = b ? t("comets.prefix") + " " + b.designation : t("comets.fallbackName");
  const cometType = b
    ? b.type_label + " · " + t("comets.inConstellation", { name: genitiveConst(b.constellation) }) + " · " + fmtNum(b.magnitude, 1) + "m"
    : t("comets.fallbackType");
  const sunAu = b ? fmtNum(b.distance_sun_au, 1) : "1.4";
  const earthAu = b ? fmtNum(b.distance_earth_au, 1) : "2.1";
  const periDays = b ? (b.days_to_perihelion != null ? b.days_to_perihelion : "—") : "72";
  const magNow = b ? fmtNum(b.magnitude, 1) + "m" : "4.8m";
  const magPeak = b ? fmtNum(b.peak_magnitude, 1) + "m" : "3.5m";
  const trend = b ? trendLabel(b.trend) : t("common.trend.up");

  return (
    <>
      <section className="hero">
        <div className="wrap hero-grid">
          <div>
            <div className="eyebrow">{t("comets.hero.eyebrow")}</div>
            <h1 className="hero-title" dangerouslySetInnerHTML={{ __html: t("comets.hero.title") }} />
            <p className="hero-sub">{t("comets.hero.sub")}</p>

            <div style={{ marginTop: 24 }}>
              <span className="badge-live"><span className="dot" />{t("comets.hero.liveBadge")}</span>
              <h2 id="comet-name" style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 22, marginTop: 12 }}>{cometName}</h2>
              <p id="comet-type" style={{ color: "var(--text-dim)", fontSize: 14, marginTop: 4 }}>{cometType}</p>
              <div className="grid cols-3" style={{ gap: 10, marginTop: 14, maxWidth: 420 }}>
                <div className="card" style={{ padding: 12 }}><div className="k">{t("comets.toSun")}</div><div className="v" style={{ fontSize: 17 }}><span id="comet-sun-au">{sunAu}</span><span className="unit">{t("common.units.ao")}</span></div></div>
                <div className="card" style={{ padding: 12 }}><div className="k">{t("comets.toEarth")}</div><div className="v" style={{ fontSize: 17 }}><span id="comet-earth-au">{earthAu}</span><span className="unit">{t("common.units.ao")}</span></div></div>
                <div className="card" style={{ padding: 12 }}><div className="k">{t("comets.toPerihelion")}</div><div className="v" style={{ fontSize: 17 }}><span id="comet-peri-days">{periDays}</span><span className="unit">{t("comets.daysUnit")}</span></div></div>
              </div>
            </div>
          </div>
        </div>

        <div className="wrap" style={{ marginTop: 28 }}>
          <CometOrbit b={b} />
        </div>
      </section>

      <section className="section" id="brightness" style={{ paddingTop: 8 }}>
        <div className="wrap">
          <SectionHead eyebrow={t("comets.s1.eyebrow")} title={t("comets.s1.title")} />
          <div className="grid cols-2" style={{ alignItems: "center" }}>
            <div>
              <div className="brightness-wrap">
                <CometBrightness />
              </div>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text-dim)", marginTop: 10, textAlign: "center" }}>{t("comets.brightnessNote")}</p>
            </div>
            <div className="card" style={{ padding: 24 }}>
              <div className="k">{t("comets.readChart")}</div>
              <p style={{ fontSize: 13.5, color: "var(--text-dim)", marginTop: 10, lineHeight: 1.7 }}>{t("comets.readBody")}</p>
              <div className="divider" />
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 14, gap: 12, flexWrap: "wrap" }}>
                <div><div className="k">{t("comets.now")}</div><div className="v" style={{ fontSize: 20 }} id="comet-mag-now">{magNow}</div></div>
                <div><div className="k">{t("comets.peak")}</div><div className="v" style={{ fontSize: 20 }} id="comet-mag-peak">{magPeak}</div></div>
                <div><div className="k">{t("comets.trend")}</div><div className="v" style={{ fontSize: 20 }} id="comet-trend">{trend}</div></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section" id="visible">
        <div className="wrap">
          <SectionHead eyebrow={t("comets.s2.eyebrow")} title={t("comets.s2.title")} />
          <table className="data">
            <thead>
              <tr><th>{t("comets.col.comet")}</th><th>{t("comets.col.type")}</th><th>{t("comets.col.mag")}</th><th>{t("comets.col.constellation")}</th><th>{t("comets.col.bestTime")}</th><th>{t("comets.col.visibility")}</th></tr>
            </thead>
            <tbody id="comet-visible-rows">
              {visible.map((c, i) => (
                <tr key={i}>
                  <td>{c.designation}</td>
                  <td>{c.type_label}</td>
                  <td className="mono">{fmtNum(c.magnitude, 1)}m</td>
                  <td>{c.constellation}</td>
                  <td className="mono">{c.best_time}</td>
                  <td><span className={visPill(c.visibility)}>{c.visibility_label}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section" id="famous">
        <div className="wrap">
          <SectionHead eyebrow={t("comets.s3.eyebrow")} title={t("comets.s3.title")} />
          <FeatureRow tag={t("comets.famous.f1_tag")} title={t("comets.famous.f1_title")} num={t("comets.famous.f1_num")}>{t("comets.famous.f1_body")}</FeatureRow>
          <FeatureRow tag={t("comets.famous.f2_tag")} title={t("comets.famous.f2_title")} num={t("comets.famous.f2_num")}>{t("comets.famous.f2_body")}</FeatureRow>
          <FeatureRow tag={t("comets.famous.f3_tag")} title={t("comets.famous.f3_title")} num={t("comets.famous.f3_num")}>{t("comets.famous.f3_body")}</FeatureRow>
        </div>
      </section>

      <section className="section" id="howto">
        <div className="wrap">
          <SectionHead eyebrow={t("comets.s4.eyebrow")} title={t("comets.s4.title")} />
          <FeatureRow tag="01" title={t("comets.howto.h1_title")} num={t("comets.howto.h1_num")}>{t("comets.howto.h1_body")}</FeatureRow>
          <FeatureRow tag="02" title={t("comets.howto.h2_title")} num={t("comets.howto.h2_num")}>{t("comets.howto.h2_body")}</FeatureRow>
          <FeatureRow tag="03" title={t("comets.howto.h3_title")} num={t("comets.howto.h3_num")}>{t("comets.howto.h3_body")}</FeatureRow>
        </div>
      </section>
    </>
  );
}