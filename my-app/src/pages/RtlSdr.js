// RTL-SDR page (rtl-sdr.html): amateur radio astronomy — Jupiter radio bursts
// (spectrogram) and meteor forward-scatter pings, plus gear & community.
// Port of app.js loadRtlSdr (next meteor peak → #rtl-shower-tag).
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useLang } from "../context/LanguageContext";
import { useApi } from "../hooks/useApi";
import { getMeteors } from "../lib/api";
import SectionHead from "../components/primitives/SectionHead";
import FeatureRow from "../components/primitives/FeatureRow";
import Spectrogram from "../components/rtl/Spectrogram";
import MeteorPing from "../components/rtl/MeteorPing";

function RtlShowerTag({ t, lang }) {
  const { data } = useApi(() => getMeteors(lang), { deps: [lang] });
  let tag = t("rtl.showerDefault");
  if (data && data.items) {
    let next = null;
    for (const s of data.items) {
      if (s.days_until == null || s.days_until < 0) continue;
      if (!next || s.days_until < next.days_until) next = s;
    }
    if (next) tag = next.name + " · " + (next.peak || "");
  }
  return (
    <FeatureRow tag={tag} title={t("rtl.showerTitle")} num={t("rtl.showerNum")}>
      {t("rtl.showerBody")}
    </FeatureRow>
  );
}

export default function RtlSdr() {
  const { t } = useTranslation();
  useEffect(() => { document.title = t("title.rtl"); }, [t]);
  const { lang } = useLang();

  const GEAR = [
    { g: t("rtl.gear.g1"), p: t("rtl.gear.p1") },
    { g: t("rtl.gear.g2"), p: t("rtl.gear.p2") },
    { g: t("rtl.gear.g3"), p: t("rtl.gear.p3") },
    { g: t("rtl.gear.g4"), p: t("rtl.gear.p4") },
    { g: t("rtl.gear.g5"), p: t("rtl.gear.p5") },
  ];

  return (
    <>
      <section className="hero">
        <div className="wrap">
          <div className="eyebrow">{t("rtl.hero.eyebrow")}</div>
          <h1 className="hero-title" dangerouslySetInnerHTML={{ __html: t("rtl.hero.title") }} />
          <p className="hero-sub" style={{ maxWidth: 640 }}>{t("rtl.hero.sub")}</p>
        </div>
      </section>

      <section className="section" id="jupiter" style={{ paddingTop: 8 }}>
        <div className="wrap">
          <SectionHead eyebrow={t("rtl.s1.eyebrow")} title={t("rtl.s1.title")} />
          <p className="section-sub">{t("rtl.s1.sub")}</p>

          <div className="spectro-wrap">
            <Spectrogram />
          </div>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--text-dim)", marginTop: 10, textAlign: "center" }}>{t("rtl.spectroCaption")}</p>

          <div className="grid cols-3" style={{ marginTop: 28 }}>
            <div className="card"><div className="k">{t("rtl.cards.range")}</div><div className="v" style={{ fontSize: 22 }}>18–28<span className="unit">МГц</span></div><div className="foot">{t("rtl.cards.rangeFoot")}</div></div>
            <div className="card"><div className="k">{t("rtl.cards.bestTime")}</div><div className="v" style={{ fontSize: 22 }}>{t("rtl.cards.bestTimeVal")}</div><div className="foot">{t("rtl.cards.bestTimeFoot")}</div></div>
            <div className="card"><div className="k">{t("rtl.cards.network")}</div><div className="v" style={{ fontSize: 22 }}>{t("rtl.cards.networkVal")}</div><div className="foot">{t("rtl.cards.networkFoot")}</div></div>
          </div>

          <div className="grid cols-2" style={{ marginTop: 20, alignItems: "start" }}>
            <div className="card"><div className="k">{t("rtl.sBurst.title")}</div><p style={{ fontSize: 13.5, color: "var(--text-dim)", marginTop: 10 }}>{t("rtl.sBurst.body")}</p></div>
            <div className="card"><div className="k">{t("rtl.lBurst.title")}</div><p style={{ fontSize: 13.5, color: "var(--text-dim)", marginTop: 10 }}>{t("rtl.lBurst.body")}</p></div>
          </div>
        </div>
      </section>

      <section className="section" id="meteors">
        <div className="wrap">
          <SectionHead eyebrow={t("rtl.s2.eyebrow")} title={t("rtl.s2.title")} />
          <p className="section-sub">{t("rtl.s2.sub")}</p>

          <div className="ping-wrap">
            <MeteorPing />
          </div>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--text-dim)", marginTop: 10, textAlign: "center" }}>{t("rtl.pingCaption")}</p>

          <div className="grid cols-3" style={{ marginTop: 28 }}>
            <div className="card"><div className="k">{t("rtl.metCards.range")}</div><div className="v" style={{ fontSize: 22 }}>30–150<span className="unit">МГц</span></div><div className="foot">{t("rtl.metCards.rangeFoot")}</div></div>
            <div className="card"><div className="k">{t("rtl.metCards.measure")}</div><div className="v" style={{ fontSize: 22 }}>{t("rtl.metCards.measureVal")}</div><div className="foot">{t("rtl.metCards.measureFoot")}</div></div>
            <div className="card"><div className="k">{t("rtl.metCards.use")}</div><div className="v" style={{ fontSize: 22 }}>{t("rtl.metCards.useVal")}</div><div className="foot">{t("rtl.metCards.useFoot")}</div></div>
          </div>

          <div style={{ marginTop: 24 }}>
            <RtlShowerTag t={t} lang={lang} />
          </div>
        </div>
      </section>

      <section className="section" id="gear">
        <div className="wrap">
          <SectionHead eyebrow={t("rtl.s3.eyebrow")} title={t("rtl.s3.title")} />
          <div className="card" style={{ padding: "8px 24px" }}>
            {GEAR.map((row, i) => (
              <div className="gear-row" key={i}>
                <div className="g">{row.g}</div>
                <p>{row.p}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <SectionHead eyebrow={t("rtl.s4.eyebrow")} title={t("rtl.s4.title")} />
          <FeatureRow tag={t("rtl.communityTag")} title={t("rtl.communityTitle")} num={t("rtl.communityNum")}>{t("rtl.communityBody")}</FeatureRow>
          <div className="hero-actions" style={{ marginTop: 20 }}>
            <a href="/community" className="btn primary">{t("rtl.forum")}</a>
            <a href="https://t.me/NEOwatchBot" className="btn ghost">{t("rtl.bot")}</a>
          </div>
        </div>
      </section>
    </>
  );
}