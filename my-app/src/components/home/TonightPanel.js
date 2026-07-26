// Homepage "Найцікавіше над обрієм" — port of the orbit-light TonightPanel.
// Two-thirds: tonight's sky events from /api/sky (icon tile + title + time +
// detail). One-third sidebar: a Moon-phase card (/api/moon) and a darkness
// window track (sunset → dusk → astronomical dark → dawn from /api/sky sun).
import { useTranslation } from "react-i18next";
import { useApi } from "../../hooks/useApi";
import { useLoc } from "../../context/LocationContext";
import { useLang } from "../../context/LanguageContext";
import { getSky, getMoon } from "../../lib/api";
import { formatTime } from "../../lib/liveTime";
import Moon from "../viz/Moon";

function kindClass(kind) {
  if (kind === "planet") return "ic teal";
  if (kind === "meteor") return "ic coral";
  if (kind === "iss") return "ic live";
  return "ic";
}

function DarknessTrack({ sun, t }) {
  const start = new Date(sun.sunset).getTime();
  const end = new Date(sun.dawn).getTime();
  if (!start || !end || end <= start) return null;
  const pct = (iso) => ((new Date(iso).getTime() - start) / (end - start)) * 100;
  const marks = [
    { label: t("home.tonight.marks.sunset"), at: sun.sunset },
    { label: t("home.tonight.marks.dusk"), at: sun.dusk },
    { label: t("home.tonight.marks.dark"), at: sun.dark_from },
    { label: t("home.tonight.marks.dawn"), at: sun.dawn },
  ].filter((m) => m.at);
  const duskP = sun.dusk ? pct(sun.dusk) : 0;
  const darkP = sun.dark_from ? pct(sun.dark_from) : 0;
  const dawnP = sun.dawn ? pct(sun.dawn) : 100;

  return (
    <div className="darkness-track">
      <div className="dt-head">
        <span className="dt-icon" aria-hidden="true">🌆</span>
        <span className="dt-label">{t("home.tonight.darkWindow")}</span>
      </div>
      <div className="dt-bar">
        {sun.dusk && <div className="dt-fill dusk" style={{ left: `${duskP}%`, right: `${100 - dawnP}%` }} />}
        {sun.dark_from && <div className="dt-fill dark" style={{ left: `${darkP}%`, right: `${100 - dawnP}%` }} />}
      </div>
      <div className="dt-marks">
        {marks.map((m) => (
          <span key={m.label} className="dt-mark">
            <span className="dt-t tabular">{formatTime(m.at)}</span>
            <span className="dt-name">{m.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export default function TonightPanel() {
  const { loc } = useLoc();
  const { lang } = useLang();
  const { t } = useTranslation();
  const { data: sky } = useApi(() => getSky(loc, lang), { deps: [loc && loc.lat, loc && loc.lon, lang] });
  const { data: moon } = useApi(() => getMoon(lang), { deps: [lang] });

  const placeholders = [
    { emoji: "🛰️", title: t("home.skyEvents.issTitle"), time: "22:14", detail: t("home.skyEvents.issDetail"), kind: "iss" },
    { emoji: "🪐", title: t("home.skyEvents.planetTitle"), time: t("home.skyEvents.planetTime"), detail: t("home.skyEvents.planetDetail"), kind: "planet" },
    { emoji: "☄️", title: t("home.skyEvents.meteorTitle"), time: t("home.skyEvents.meteorTime"), detail: t("home.skyEvents.meteorDetail"), kind: "meteor" },
    { emoji: "🌙", title: t("home.skyEvents.moonTitle"), time: "—", detail: t("home.skyEvents.moonDetail"), kind: "moon" },
  ];
  const events = (sky && sky.events) || placeholders;
  const sun = sky && sky.sun;

  // Moon card values (illumination 0..1, phase 0..1 for the SVG).
  const illum = moon && moon.illumination != null ? moon.illumination / 100 : 0.5;
  const phase = moon && moon.phase_percent != null ? moon.phase_percent / 100 : 0.25;
  const phaseName = moon && moon.phase_name ? moon.phase_name : "—";

  return (
    <div className="tonight-grid">
      <ul className="tonight-events">
        {events.map((e, i) => (
          <li key={i} className="tonight-evt">
            <span className={kindClass(e.kind)}>{e.emoji}</span>
            <div className="tonight-body">
              <div className="tonight-top">
                <h4>{e.title}</h4>
                <span className="tonight-time tabular">{e.time}</span>
              </div>
              <p>{e.detail}</p>
            </div>
          </li>
        ))}
      </ul>

      <div className="tonight-side">
        <div className="moon-card">
          <Moon illumination={illum} phase={phase} size={64} />
          <div className="moon-meta">
            <span className="moon-eyebrow">🌙 {t("home.tonight.phase")}</span>
            <span className="moon-name">{phaseName}</span>
            <span className="moon-illum tabular">
              {t("home.tonight.illum", { pct: Math.round(illum * 100) })}
            </span>
          </div>
        </div>

        {sun && <DarknessTrack sun={sun} t={t} />}
      </div>
    </div>
  );
}