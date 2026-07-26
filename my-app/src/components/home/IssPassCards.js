// Homepage "Найближчі прольоти станції" — port of the orbit-light IssPasses
// block. Three cards, each with a PassArc SVG (arc height = max altitude),
// a live T- countdown on the first pass / relative time on the rest, a stats
// grid (altitude / duration / magnitude) and a quality label. Live data from
// /api/iss/passes (uses start_utc for the countdowns).
import { useTranslation } from "react-i18next";
import { useApi } from "../../hooks/useApi";
import { useLoc } from "../../context/LocationContext";
import { useLang } from "../../context/LanguageContext";
import { getIssPasses } from "../../lib/api";
import { fmtNum } from "../../lib/format";
import { formatDayShort, formatTime, formatWeekday, CountdownT, RelativeTime } from "../../lib/liveTime";
import PassArc from "../viz/PassArc";

function quality(maxAlt, t) {
  if (maxAlt >= 40) return { label: t("home.iss.quality.good"), cls: "good" };
  if (maxAlt >= 20) return { label: t("home.iss.quality.moderate"), cls: "moderate" };
  return { label: t("home.iss.quality.low"), cls: "low" };
}

function PassCard({ p, t, first }) {
  const ts = p.start_utc;
  const iso = ts ? ts * 1000 : null;
  const mins = Math.round((p.duration_sec || 0) / 60);
  const mag = p.mag !== null && p.mag !== undefined ? fmtNum(p.mag, 1) : "—";
  const q = quality(p.max_el, t);

  return (
    <article className={"pass-card" + (first ? " first" : "")}>
      <div className="pass-head">
        <div className="pass-when">
          <span className="pass-day tabular">
            {iso ? `${formatDayShort(iso)} · ${formatWeekday(iso)}` : p.start}
          </span>
          <span className="pass-time tabular">{iso ? formatTime(iso) : "—"}</span>
        </div>
        {first ? (
          <CountdownT ts={ts} fallback="T-—" className="pass-countdown" />
        ) : (
          <RelativeTime ts={ts} fallback="—" className="pass-relative" />
        )}
      </div>

      <PassArc maxAlt={p.max_el} startDir={p.from_dir} endDir={p.to_dir} />

      <dl className="pass-stats">
        <div><dt>{t("home.iss.stats.alt")}</dt><dd className="tabular">{fmtNum(p.max_el, 0)}°</dd></div>
        <div><dt>{t("home.iss.stats.dur")}</dt><dd className="tabular">{mins} {t("common.units.min")}</dd></div>
        <div><dt>{t("home.iss.stats.mag")}</dt><dd className="tabular">{mag}</dd></div>
      </dl>

      <p className={"pass-quality " + q.cls}>{q.label}</p>
    </article>
  );
}

export default function IssPassCards() {
  const { loc } = useLoc();
  const { lang } = useLang();
  const { t } = useTranslation();
  const { data } = useApi(() => getIssPasses(loc, lang), { deps: [loc && loc.lat, loc && loc.lon, lang] });

  const placeholders = [
    { start: "5 " + t("common.months.jul") + " · 22:14", start_utc: null, max_el: 78, from_dir: t("common.compass.NW"), to_dir: t("common.compass.SE"), duration_sec: 360, mag: -3.8 },
    { start: "6 " + t("common.months.jul") + " · 21:26", start_utc: null, max_el: 54, from_dir: t("common.compass.W"), to_dir: t("common.compass.S"), duration_sec: 300, mag: -3.1 },
    { start: "7 " + t("common.months.jul") + " · 22:01", start_utc: null, max_el: 32, from_dir: t("common.compass.NW"), to_dir: t("common.compass.S"), duration_sec: 240, mag: -2.4 },
  ];
  const items = (data && data.items) || placeholders;
  const shown = items.slice(0, 3);

  return (
    <div className="pass-grid" id="iss-passes">
      {shown.map((p, i) => <PassCard key={i} p={p} t={t} first={i === 0} />)}
    </div>
  );
}