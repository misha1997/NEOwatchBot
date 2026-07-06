// Moon phase card (sky.html #moon-card). Port of app.js loadMoon.
import { useTranslation } from "react-i18next";
import { useApi } from "../../hooks/useApi";
import { getMoon } from "../../lib/api";
import { fmtNum } from "../../lib/format";

export default function MoonCard({ lang }) {
  const { t } = useTranslation();
  const { data: m } = useApi(() => getMoon(lang), { deps: [lang] });
  const illum = m && m.illumination != null ? fmtNum(m.illumination, 0) + "%" : "34%";
  // phase_name carries a leading emoji; strip it for the caption.
  const name = m && m.phase_name ? m.phase_name.replace(/^\S+\s/, "") : t("sky.moon.phName");
  const dark = m ? m.illumination < 40 : true;
  const note = dark ? t("sky.moon.darkNote") : t("sky.moon.brightNote");
  return (
    <div className="card" id="moon-card">
      <div className="k">{t("sky.moon.title")}</div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 18 }}>
        <div className="moon" aria-hidden="true" />
        <div id="moon-illum" style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 22, marginTop: 18 }}>{illum}</div>
        <div id="moon-name" style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 4 }}>{name}</div>
        <div id="moon-note" style={{ fontSize: 12, color: "var(--text-dim)", marginTop: 10, textAlign: "center", maxWidth: 200 }}>{note}</div>
      </div>
    </div>
  );
}