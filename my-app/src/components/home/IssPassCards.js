// Homepage 4-up ISS pass cards (index.html #iss-passes). Port of passCardHtml.
import { useTranslation } from "react-i18next";
import { useApi } from "../../hooks/useApi";
import { useLoc } from "../../context/LocationContext";
import { useLang } from "../../context/LanguageContext";
import { getIssPasses } from "../../lib/api";

function PassCard({ p, t }) {
  const mins = Math.round((p.duration_sec || 0) / 60);
  const mag = (p.mag !== null && p.mag !== undefined) ? t("iss.brightness", { mag: p.mag }) : "";
  return (
    <div className="card">
      <div className="k">{p.start}</div>
      <div className="v">{p.max_el}<span className="unit">{t("iss.maxAlt")}</span></div>
      <div className="foot">{p.from_dir} → {p.to_dir} · {mins} {t("common.units.min")}{mag}</div>
    </div>
  );
}

export default function IssPassCards() {
  const { loc } = useLoc();
  const { lang } = useLang();
  const { t } = useTranslation();
  const { data } = useApi(() => getIssPasses(loc, lang), { deps: [loc && loc.lat, loc && loc.lon, lang] });
  const placeholders = [
    { start: "5 " + t("common.months.jul") + " · 22:14", max_el: 78, from_dir: t("common.compass.NW"), to_dir: t("common.compass.SE"), duration_sec: 360, mag: -3.8 },
    { start: "6 " + t("common.months.jul") + " · 21:26", max_el: 54, from_dir: t("common.compass.W"), to_dir: t("common.compass.S"), duration_sec: 300, mag: -3.1 },
    { start: "7 " + t("common.months.jul") + " · 22:01", max_el: 32, from_dir: t("common.compass.NW"), to_dir: t("common.compass.S"), duration_sec: 240, mag: -2.4 },
    { start: "8 " + t("common.months.jul") + " · 21:13", max_el: 65, from_dir: t("common.compass.W"), to_dir: t("common.compass.SE"), duration_sec: 360, mag: -3.5 },
  ];
  const items = (data && data.items) || placeholders;
  return (
    <div className="grid cols-4" id="iss-passes">
      {items.map((p, i) => <PassCard key={i} p={p} t={t} />)}
    </div>
  );
}