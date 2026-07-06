// Homepage 4-up space-weather strip (index.html #weather). Port of app.js
// fillWeather. Placeholders match the static template; live values from /api/weather.
import { useTranslation } from "react-i18next";
import { useApi } from "../../hooks/useApi";
import { useLoc } from "../../context/LocationContext";
import { getWeather } from "../../lib/api";
import { fmtNum } from "../../lib/format";
import { auroraStatus, bzFoot, solarWindFoot } from "../../lib/constants";
import Card from "../primitives/Card";

export default function WeatherCards() {
  const { loc } = useLoc();
  const { t } = useTranslation();
  const { data: d } = useApi(() => getWeather(loc), { deps: [loc && loc.lat, loc && loc.lon] });

  const kp = d && d.kp != null ? d.kp : 4;
  const g = d && d.g_scale;
  const kpFoot = g ? t("weather.kpFoot.storm", { g }) : t("weather.kpFoot.moderate");

  const sw = d && d.solar_wind ? d.solar_wind.speed : 512;
  const bz = d && d.bz != null ? d.bz : -6.4;
  const aur = d && d.aurora;
  const aurPct = aur ? aur.chance_pct : 42;
  const aurFoot = aur ? auroraStatus(aur.status_key) : t("weather.auroraDefault");

  return (
    <div className="grid cols-4" id="weather">
      <Card label={t("weather.card.kp")} dot="live" value={fmtNum(kp, 1)} unit="/9" foot={kpFoot} />
      <Card label={t("weather.card.wind")} value={fmtNum(sw, 0)} unit={t("common.units.km_s")} foot={solarWindFoot(sw)} />
      <Card label={t("weather.card.bz")}
        value={(bz > 0 ? "+" : "−") + fmtNum(Math.abs(bz), 1)} unit={t("common.units.nt")} foot={bzFoot(bz)} />
      <Card label={t("weather.card.aurora")} accent value={fmtNum(aurPct, 0)} unit="%" foot={aurFoot} />
    </div>
  );
}