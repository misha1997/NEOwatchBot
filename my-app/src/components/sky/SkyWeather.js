// Sky-page space-weather strip (sky.html #sky-weather). Four value-only cards
// (no footers, matching the static template). Port of app.js fillWeather.
import { useTranslation } from "react-i18next";
import { useApi } from "../../hooks/useApi";
import { useLoc } from "../../context/LocationContext";
import { getWeather } from "../../lib/api";
import { fmtNum } from "../../lib/format";

export default function SkyWeather() {
  const { t } = useTranslation();
  const { loc } = useLoc();
  const { data: d } = useApi(() => getWeather(loc), { deps: [loc && loc.lat, loc && loc.lon] });
  const kp = d && d.kp != null ? d.kp : 4;
  const sw = d && d.solar_wind ? d.solar_wind.speed : 512;
  const bz = d && d.bz != null ? d.bz : -6.4;
  const aurPct = d && d.aurora ? d.aurora.chance_pct : 42;
  return (
    <div className="grid cols-4" id="sky-weather">
      <div className="card">
        <div className="k">{t("sky.weather.kp")} <span className="dot live" /></div>
        <div className="v">{fmtNum(kp, 1)}<span className="unit">/9</span></div>
      </div>
      <div className="card">
        <div className="k">{t("sky.weather.wind")}</div>
        <div className="v">{fmtNum(sw, 0)}<span className="unit">{t("common.units.km_s")}</span></div>
      </div>
      <div className="card">
        <div className="k">{t("sky.weather.bz")}</div>
        <div className="v">{(bz > 0 ? "+" : "−") + fmtNum(Math.abs(bz), 1)}<span className="unit">{t("common.units.nt")}</span></div>
      </div>
      <div className="card">
        <div className="k">{t("sky.weather.aurora")}</div>
        <div className="v accent">{fmtNum(aurPct, 0)}<span className="unit">%</span></div>
      </div>
    </div>
  );
}