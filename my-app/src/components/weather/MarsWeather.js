// Mars weather section (weather.html #mars). Two cards: the InSight telemetry
// card (#mars-card) and the explanation card whose season line (#mars-season)
// is filled from the same payload. Port of loadMars/marsCardHtml in app.js.
// The InSight mission ended in 2022, so the feed returns the last available sol.
import { useTranslation } from "react-i18next";
import { useApi } from "../../hooks/useApi";
import { getMars } from "../../lib/api";
import { fmtNum } from "../../lib/format";
import { VelocityIcon } from "../../lib/icons";

function MarsLine({ label, val, unit }) {
  return (
    <div className="dl-row">
      <VelocityIcon />
      <span className="lbl">{label}</span>
      <span className="val">{val != null ? val : "—"}{unit ? " " + unit : ""}</span>
    </div>
  );
}

function MarsTemp({ label, val, t }) {
  return (
    <div className="card" style={{ padding: 14 }}>
      <div className="k" style={{ fontSize: 11 }}>{label}</div>
      <div className="v" style={{ fontSize: 20 }}>{val != null ? fmtNum(val, 0) : "—"}<span className="unit">{t("common.units.c")}</span></div>
    </div>
  );
}

// Presentational view: takes the resolved payload (or null) and renders the two
// Mars cards. The weather page fetches the payload itself (so it can show a
// skeleton during the first load) and renders this directly; the default
// `MarsWeather` export below is a self-fetching wrapper for standalone use.
export function MarsWeatherView({ d }) {
  const { t } = useTranslation();
  const ok = d && d.available;
  const season = ok && d.northern_season && d.northern_season !== "Unknown"
    ? d.northern_season : (ok ? (d.season || "") : "");

  return (
    <div className="grid cols-2" style={{ gridTemplateColumns: "1fr 1fr" }}>
      <div className="card" id="mars-card">
        {!ok ? (
          <>
            <div className="k">{t("weather.mars.title")}</div>
            <p style={{ color: "var(--text-dim)", fontSize: 13, marginTop: 12, lineHeight: 1.5 }}>
              {t("weather.mars.unavailable")}
            </p>
          </>
        ) : (
          <>
            <div className="k">{t("weather.mars.title")} <span className="dot warn" /></div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 14 }}>
              <div style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 26, color: "var(--coral)" }}>
                {t("weather.mars.sol")} {d.sol || "—"}
              </div>
              {season && <span className="pill coral" style={{ textTransform: "capitalize" }}>{season}</span>}
            </div>
            <div className="grid cols-3" style={{ marginTop: 16 }}>
              <MarsTemp label={t("weather.mars.avg")} val={d.temp_avg} t={t} />
              <MarsTemp label={t("weather.mars.min")} val={d.temp_min} t={t} />
              <MarsTemp label={t("weather.mars.max")} val={d.temp_max} t={t} />
            </div>
            <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
              <MarsLine label={t("weather.mars.pressure")} val={d.pressure_avg} unit={t("common.units.pa")} />
              <MarsLine label={t("weather.mars.wind")} val={d.wind_avg} unit={t("weather.mars.windUnit", { dir: d.wind_direction || "" })} />
              <MarsLine label={t("weather.mars.samples")} val={d.temp_samples} />
            </div>
            <p style={{ color: "var(--text-dim)", fontSize: 11.5, marginTop: 14 }}>
              {t("weather.mars.source", { date: d.last_date || "" })}
            </p>
          </>
        )}
      </div>
      <div className="card">
        <div className="k">{t("weather.mars.what")}</div>
        <p style={{ color: "var(--text-dim)", fontSize: 13.5, marginTop: 12, lineHeight: 1.6 }}>
          {t("weather.mars.whatBody")}
        </p>
        <div className="dl-row" style={{ marginTop: 14 }}>
          <span className="lbl">{t("weather.mars.northHemi")}</span>
          <span className="val" id="mars-season">{season || "—"}</span>
        </div>
      </div>
    </div>
  );
}

// Self-fetching wrapper for standalone use (e.g. imported elsewhere without a
// pre-fetched payload). The weather page uses <MarsWeatherView/> directly.
export default function MarsWeather() {
  const { data } = useApi(getMars);
  return <MarsWeatherView d={data} />;
}