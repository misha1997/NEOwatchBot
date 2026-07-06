// Space-weather page (weather.html): current conditions (Kp/wind/Bz/X-ray +
// storm banner), five NOAA SWPC time-series charts, the aurora forecast card
// and OVATION map, and the Mars weather section. Ports loadCurrent + loadSeries
// from space-weather.js. The current payload and the series payload are each
// fetched once at the page level so the aurora card and the map share sources.
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import LocationPill from "../components/LocationPill";
import WeatherCurrent from "../components/weather/WeatherCurrent";
import { MarsWeatherView } from "../components/weather/MarsWeather";
import {
  CurrentSkeleton, ChartPairSkeleton, ChartSingleSkeleton,
  AuroraSkeleton, MarsSkeleton,
} from "../components/weather/WeatherSkeletons";
import KpHistory from "../components/charts/KpHistory";
import KpForecast from "../components/charts/KpForecast";
import SolarWind from "../components/charts/SolarWind";
import Bz from "../components/charts/Bz";
import Xray from "../components/charts/Xray";
import { useApi } from "../hooks/useApi";
import { useLoc } from "../context/LocationContext";
import { getWeather, getWeatherSeries, getMars } from "../lib/api";
import { fmtNum } from "../lib/format";
import { auroraStatus } from "../lib/constants";

export default function Weather() {
  const { t } = useTranslation();
  useEffect(() => { document.title = t("title.weather"); }, [t]);
  const { loc } = useLoc();
  const { data: w, loading: wLoading } = useApi(() => getWeather(loc), { deps: [loc && loc.lat, loc && loc.lon] });
  const { data: s, loading: sLoading } = useApi(getWeatherSeries);
  const { data: mars, loading: marsLoading } = useApi(getMars);
  // Cache-bust the OVATION map on each mount (it refreshes ~5 min server-side).
  const [ts] = useState(() => Date.now());
  const auroraMap = s && s.aurora_map ? s.aurora_map + "?t=" + ts : null;

  const aur = w && w.aurora;
  const aurPct = aur ? fmtNum(aur.chance_pct, 0) : "—";
  const aurFoot = aur ? auroraStatus(aur.status_key) : "—";

  const kpHist = (s && s.kp_history) || [];
  const kpFc = (s && s.kp_forecast) || [];
  const wind = (s && s.solar_wind) || [];
  const bz = (s && s.bz) || [];
  const xray = (s && s.xray) || [];

  return (
    <>
      <section className="hero">
        <div className="wrap">
          <div style={{ maxWidth: 720 }}>
            <div className="eyebrow"><span className="dot live" /> {t("weather.hero.eyebrow")}</div>
            <h1 className="hero-title" dangerouslySetInnerHTML={{ __html: t("weather.hero.title") }} />
            <p className="hero-sub">{t("weather.hero.sub")}</p>
            <div className="hero-actions">
              <a href="#current" className="btn primary">{t("weather.hero.now")}</a>
              <a href="#aurora" className="btn ghost">{t("weather.hero.aurora")}</a>
            </div>
            <LocationPill />
          </div>
        </div>
      </section>

      {wLoading && !w ? <CurrentSkeleton /> : <WeatherCurrent d={w} />}

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="section-head">
            <div>
              <div className="eyebrow gold">{t("weather.s1.eyebrow")}</div>
              <h2 className="section-title">{t("weather.s1.title")}</h2>
            </div>
          </div>
          <p className="section-sub">{t("weather.s1.sub")}</p>
          {sLoading && !s ? <ChartPairSkeleton /> : (
            <div className="grid cols-2">
              <div className="chart-card">
                <div className="ch-head"><h4>{t("weather.s1.history")}</h4><span className="sub">{t("weather.s1.historySub")}</span></div>
                <div className="canvas-wrap"><KpHistory rows={kpHist} /></div>
              </div>
              <div className="chart-card">
                <div className="ch-head"><h4>{t("weather.s1.forecast")}</h4><span className="sub">{t("weather.s1.forecastSub")}</span></div>
                <div className="canvas-wrap"><KpForecast rows={kpFc} /></div>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="section-head">
            <div>
              <div className="eyebrow">{t("weather.s2.eyebrow")}</div>
              <h2 className="section-title">{t("weather.s2.title")}</h2>
            </div>
          </div>
          <p className="section-sub">{t("weather.s2.sub")}</p>
          {sLoading && !s ? <ChartPairSkeleton /> : (
            <div className="grid cols-2">
              <div className="chart-card">
                <div className="ch-head"><h4>{t("weather.s2.wind")}</h4><span className="sub">{t("weather.s2.windSub")}</span></div>
                <div className="canvas-wrap"><SolarWind rows={wind} /></div>
              </div>
              <div className="chart-card">
                <div className="ch-head"><h4>{t("weather.s2.bz")}</h4><span className="sub">{t("weather.s2.bzSub")}</span></div>
                <div className="canvas-wrap"><Bz rows={bz} /></div>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="section-head">
            <div>
              <div className="eyebrow">{t("weather.s3.eyebrow")}</div>
              <h2 className="section-title">{t("weather.s3.title")}</h2>
            </div>
          </div>
          <p className="section-sub">{t("weather.s3.sub")}</p>
          {sLoading && !s ? <ChartSingleSkeleton /> : (
            <div className="chart-card">
              <div className="ch-head"><h4>{t("weather.s3.xray")}</h4><span className="sub">{t("weather.s3.xraySub")}</span></div>
              <div className="canvas-wrap" style={{ height: 260 }}><Xray rows={xray} /></div>
            </div>
          )}
        </div>
      </section>

      <section className="section" id="aurora" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="section-head">
            <div>
              <div className="eyebrow">{t("weather.s4.eyebrow")}</div>
              <h2 className="section-title">{t("weather.s4.title")}</h2>
            </div>
          </div>
          <p className="section-sub">{t("weather.s4.sub")}</p>
          {wLoading && !w ? <AuroraSkeleton /> : (
            <div className="grid cols-2" style={{ alignItems: "center" }}>
              <div className="card" style={{ textAlign: "center" }}>
                <div className="k">{t("weather.s4.chance")}</div>
                <div className="v accent">{aurPct}<span className="unit">%</span></div>
                <div className="foot">{aurFoot}</div>
              </div>
              <div className="aurora-map-wrap">
                {auroraMap && <img className="aurora-map" src={auroraMap} alt={t("weather.s4.mapAlt")} />}
                <div className="ovl" />
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="section" id="mars" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="section-head">
            <div>
              <div className="eyebrow gold">{t("weather.s5.eyebrow")}</div>
              <h2 className="section-title">{t("weather.s5.title")}</h2>
            </div>
          </div>
          <p className="section-sub">{t("weather.s5.sub")}</p>
          {marsLoading && !mars ? <MarsSkeleton /> : <MarsWeatherView d={mars} />}
        </div>
      </section>
    </>
  );
}