// Launches page (launches.html): next-launch hero with live countdown, the
// upcoming launches list, provider bar stats and a recent-launches archive.
// Port of app.js loadLaunches / renderNextLaunch / launchCardHtml.
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useApi } from "../hooks/useApi";
import { getLaunches } from "../lib/api";
import SectionHead from "../components/primitives/SectionHead";
import FeatureRow from "../components/primitives/FeatureRow";
import NextLaunch from "../components/launches/NextLaunch";
import LaunchCard from "../components/launches/LaunchCard";

const BASE = Math.floor(Date.now() / 1000);
const PH = (d, h, m) => BASE + d * 86400 + h * 3600 + m * 60;

export default function Launches() {
  const { t } = useTranslation();
  useEffect(() => { document.title = t("title.launches"); }, [t]);

  // Static placeholder cards (verbatim from launches.html) shown until the API
  // resolves. Their countdowns tick from a near-future epoch so the page looks
  // alive immediately, matching the original static numbers.
  const PLACEHOLDERS = [
    { name: "Starlink Group 12-4", status_label: "Go", status_class: "teal", lsp: "SpaceX", rocket: "Falcon 9", pad: t("launches.ph.canaveral40"), net_ts: PH(4, 11, 37), date: "4 " + t("common.months.jul") + " · 19:32" },
    { name: "Galileo L13", status_label: "TBD", status_class: "", lsp: "ArianeGroup", rocket: "Ariane 6", pad: t("launches.ph.kourou"), net_ts: PH(6, 7, 58), date: "6 " + t("common.months.jul") + " · 03:10" },
    { name: "Recon-4", status_label: "TBD", status_class: "", lsp: "Rocket Lab", rocket: "Electron", pad: t("launches.ph.mahia"), net_ts: PH(9, 19, 15), date: "9 " + t("common.months.jul") + " · 14:47" },
    { name: "USSF-52", status_label: "Go", status_class: "teal", lsp: "SpaceX", rocket: "Falcon Heavy", pad: t("launches.ph.canaveral39a"), net_ts: PH(12, 12, 30), date: "12 " + t("common.months.jul") + " · 08:02" },
    { name: t("launches.ph.alos4"), status_label: "TBD", status_class: "", lsp: "JAXA", rocket: "H3", pad: t("launches.ph.tanegashima"), net_ts: PH(15, 5, 48), date: "15 " + t("common.months.jul") + " · 01:20" },
    { name: t("launches.ph.stationModule"), status_label: "Hold", status_class: "coral", lsp: "CASC", rocket: "Chang Zheng 5B", pad: t("launches.ph.wenchang"), net_ts: PH(18, 10, 8), date: "18 " + t("common.months.jul") + " · 06:40" },
  ];

  const PROVIDER_STATS = [
    { lbl: "SpaceX", pct: 86, color: "var(--gold)", cnt: 71 },
    { lbl: t("launches.provider.casc"), pct: 44, color: "var(--teal)", cnt: 36 },
    { lbl: "Rocket Lab", pct: 22, color: "var(--teal)", cnt: 18 },
    { lbl: "ISRO", pct: 14, color: "var(--teal)", cnt: 11 },
    { lbl: "ArianeGroup", pct: 9, color: "var(--teal)", cnt: 7 },
  ];

  const ARCHIVE = [
    { tag: t("launches.archive.ok"), title: t("launches.archive.a1title"), desc: t("launches.archive.a1desc"), num: "28.06.2026" },
    { tag: t("launches.archive.ok"), title: t("launches.archive.a2title"), desc: t("launches.archive.a2desc"), num: "14.06.2026" },
    { tag: t("launches.archive.partial"), title: t("launches.archive.a3title"), desc: t("launches.archive.a3desc"), num: "02.06.2026" },
  ];

  const { data } = useApi(getLaunches);
  const items = (data && data.items) || PLACEHOLDERS;
  return (
    <>
      <section className="page-head">
        <div className="wrap">
          <span className="icon-badge">{t("launches.badge")}</span>
          <h1 className="page-title">{t("launches.title")}</h1>
          <p className="page-desc">{t("launches.desc")}</p>
          <NextLaunch l={items[0]} />
        </div>
      </section>

      <section className="section" id="upcoming">
        <div className="wrap">
          <SectionHead eyebrow={t("launches.s1.eyebrow")} title={t("launches.s1.title")} />
          <div className="launch-list" id="launches-list">
            {items.map((l, i) => <LaunchCard key={i} l={l} />)}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <SectionHead eyebrow={t("launches.s2.eyebrow")} title={t("launches.s2.title")} />
          <div className="grid cols-2">
            <div className="card">
              <div className="k">{t("launches.stats.byProvider")}</div>
              <div className="barstat" style={{ marginTop: 16 }}>
                {PROVIDER_STATS.map((r, i) => (
                  <div className="barstat-row" key={i}>
                    <span className="lbl">{r.lbl}</span>
                    <div className="track"><div style={{ width: r.pct + "%", background: r.color }} /></div>
                    <span className="cnt">{r.cnt}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="card">
              <div className="k">{t("launches.stats.total")}</div>
              <div className="grid cols-2" style={{ marginTop: 16, gap: 14 }}>
                <div><div className="v" style={{ fontSize: 26 }}>148</div><div className="foot">{t("launches.stats.f1")}</div></div>
                <div><div className="v" style={{ fontSize: 26 }}>96%</div><div className="foot">{t("launches.stats.f2")}</div></div>
                <div><div className="v" style={{ fontSize: 26 }}>62</div><div className="foot">{t("launches.stats.f3")}</div></div>
                <div><div className="v" style={{ fontSize: 26 }}>SLC-40</div><div className="foot">{t("launches.stats.f4")}</div></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <SectionHead eyebrow={t("launches.s3.eyebrow")} title={t("launches.s3.title")} />
          {ARCHIVE.map((a, i) => (
            <FeatureRow key={i} tag={a.tag} title={a.title} num={a.num}>{a.desc}</FeatureRow>
          ))}
        </div>
      </section>
    </>
  );
}