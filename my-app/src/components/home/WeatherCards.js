// Homepage "Умови для аврори просто зараз" — port of the orbit-light
// SpaceWeather block. Four metric cards, each with a small visualization:
// Kp arc gauge, solar-wind sparkline, Bz sparkline (zero baseline), and a
// 24h Kp bar histogram for the aurora chance. Current values from /api/weather,
// history from /api/weather/series.
import { useTranslation } from "react-i18next";
import { useApi } from "../../hooks/useApi";
import { useLoc } from "../../context/LocationContext";
import { getWeather, getWeatherSeries } from "../../lib/api";
import { fmtNum } from "../../lib/format";
import { auroraStatus, bzFoot, solarWindFoot } from "../../lib/constants";
import KpGauge from "../viz/KpGauge";
import Sparkline from "../viz/Sparkline";

// Pull the value column out of a [[ms, val], …] series and downsample to `n`
// evenly-spaced points (oldest → newest).
function seriesValues(arr, n = 12) {
  if (!arr || !arr.length) return [];
  if (arr.length <= n) return arr.map((r) => r[1]);
  const out = [];
  const step = (arr.length - 1) / (n - 1);
  for (let i = 0; i < n; i++) out.push(arr[Math.round(i * step)][1]);
  return out;
}

function Metric({ label, value, unit, note, tone, children }) {
  const vClass = "wmetric-v" + (tone ? " " + tone : "");
  return (
    <div className="wmetric">
      <div className="wmetric-top">
        <span className="wmetric-k">{label}</span>
        <span className={vClass}>
          {value}
          {unit != null && unit !== "" && <span className="wmetric-unit">{unit}</span>}
        </span>
      </div>
      <div className="wmetric-viz">{children}</div>
      <p className="wmetric-note">{note}</p>
    </div>
  );
}

export default function WeatherCards() {
  const { loc } = useLoc();
  const { t } = useTranslation();
  const { data: d } = useApi(() => getWeather(loc), { deps: [loc && loc.lat, loc && loc.lon] });
  const { data: s } = useApi(getWeatherSeries, { deps: [] });

  const kp = d && d.kp != null ? d.kp : 4;
  const g = d && d.g_scale;
  const kpFoot = g ? t("weather.kpFoot.storm", { g }) : t("weather.kpFoot.moderate");

  const sw = d && d.solar_wind ? d.solar_wind.speed : 512;
  const bz = d && d.bz != null ? d.bz : -6.4;
  const aur = d && d.aurora;
  const aurPct = aur ? aur.chance_pct : 42;
  const aurFoot = aur ? auroraStatus(aur.status_key) : t("weather.auroraDefault");

  const windHist = seriesValues(s && s.solar_wind, 12);
  const bzHist = seriesValues(s && s.bz, 12);
  const kpHist = seriesValues(s && s.kp_history, 8);

  return (
    <div className="weather-grid" id="weather">
      <Metric label={t("weather.card.kp")} value={fmtNum(kp, 1)} unit="/9" note={kpFoot} tone="teal">
        <KpGauge value={kp} />
      </Metric>

      <Metric label={t("weather.card.wind")} value={fmtNum(sw, 0)} unit={t("common.units.km_s")} note={solarWindFoot(sw)}>
        <Sparkline data={windHist} color="var(--teal)" />
      </Metric>

      <Metric label={t("weather.card.bz")}
        value={(bz > 0 ? "+" : "−") + fmtNum(Math.abs(bz), 1)} unit={t("common.units.nt")} note={bzFoot(bz)}>
        <Sparkline data={bzHist} color="var(--gold)" zeroLine />
      </Metric>

      <Metric label={t("weather.card.aurora")} value={fmtNum(aurPct, 0)} unit="%" note={aurFoot} tone="gold">
        <div className="kp-bars" aria-hidden="true">
          {kpHist.map((k, i) => (
            <div key={i} className="kp-bar" style={{ height: `${Math.max(8, (k / 9) * 100)}%` }} />
          ))}
        </div>
      </Metric>
    </div>
  );
}