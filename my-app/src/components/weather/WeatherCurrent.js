// Weather-page current-conditions block: storm banner (Kp ≥ 5) + the 4
// now-cards (Kp gauge, solar wind, Bz, X-ray). Port of fillCurrent in
// space-weather.js. `d` is the /api/weather payload (null → placeholders).
import { useTranslation } from "react-i18next";
import { fmtNum, kpColor } from "../../lib/format";
import { xrayStatus, bzFoot } from "../../lib/constants";

export default function WeatherCurrent({ d }) {
  const { t } = useTranslation();
  const kp = d && d.kp != null ? d.kp : null;
  const g = d && d.g_scale;
  const kpFoot = kp != null ? (g ? t("weather.kpFoot.storm", { g }) : t("weather.current.kpModerate"))
    : t("weather.kpFoot.moderate");
  const kpBar = kp != null ? Math.min(100, kp / 9 * 100) : 0;

  const sw = d && d.solar_wind;
  const windVal = sw ? fmtNum(sw.speed, 0) : "—";
  const windFoot = sw
    ? t("weather.current.windFoot", { density: fmtNum(sw.density, 1), temp: fmtNum(sw.temp / 1e6, 1) })
    : "—";

  const bz = d && d.bz != null ? d.bz : null;
  const bzVal = bz != null ? (bz > 0 ? "+" : "−") + fmtNum(Math.abs(bz), 1) : "—";
  const bzFootTxt = bz != null ? bzFoot(bz) : "—";

  const xcls = d && d.xray_class;
  const xrayVal = xcls || "—";
  const xrayFoot = d && d.xray_status_key ? xrayStatus(d.xray_status_key) : "—";
  const xrayStyle = xcls ? { color: xcls === "X" ? "#FF6B4A" : xcls === "M" ? "#FFA94D" : xcls === "C" ? "#E8B94D" : "#4FD1C5" } : undefined;

  const storm = kp != null && kp >= 5;

  return (
    <>
      {storm && (
        <div className="wrap">
          <div className="storm-banner show">
            <span className="pulse" />
            <span><strong>{t("weather.storm.strong")}</strong> {t("weather.storm.body")}</span>
          </div>
        </div>
      )}

      <section className="section" id="current" style={{ paddingTop: 8 }}>
        <div className="wrap">
          <div className="section-head">
            <div>
              <div className="eyebrow">{t("weather.current.eyebrow")}</div>
              <h2 className="section-title">{t("weather.current.title")}</h2>
            </div>
          </div>
          <div className="grid cols-4">
            <div className="card">
              <div className="k">{t("weather.card.kp")} <span className="dot live" /></div>
              <div className="v">{kp != null ? fmtNum(kp, 1) : "—"}<span className="unit">/9</span></div>
              <div className="kp-gauge"><div className="bar" style={{ width: kpBar + "%", background: kp != null ? kpColor(kp) : undefined }} /></div>
              <div className="foot">{kpFoot}</div>
            </div>
            <div className="card">
              <div className="k">{t("weather.card.wind")}</div>
              <div className="v">{windVal}<span className="unit">{t("common.units.km_s")}</span></div>
              <div className="foot">{windFoot}</div>
            </div>
            <div className="card">
              <div className="k">{t("weather.card.bz")}</div>
              <div className="v">{bzVal}<span className="unit">{t("common.units.nt")}</span></div>
              <div className="foot">{bzFootTxt}</div>
            </div>
            <div className="card">
              <div className="k">{t("weather.current.xray")}</div>
              <div className="v" style={xrayStyle}>{xrayVal}</div>
              <div className="foot">{xrayFoot}</div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}