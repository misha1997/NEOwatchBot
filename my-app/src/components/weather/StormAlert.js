// Storm alert card (weather.html): shown only when Kp >= 5, as its own
// featured section right under the hero — same "highlight card" language as
// launches' .next-launch, not squeezed into the hero itself. Severity color
// (kpColor) grades the border/badge/Kp number from amber (G1) to coral
// (G4/G5). `w` is the /api/weather payload.
import { useTranslation } from "react-i18next";
import { fmtNum, kpColor } from "../../lib/format";
import { auroraStatus } from "../../lib/constants";

export default function StormAlert({ w }) {
  const { t } = useTranslation();
  const kp = w && w.kp != null ? w.kp : null;
  if (kp == null || kp < 5) return null;

  const color = kpColor(kp);
  const kpBar = Math.min(100, kp / 9 * 100);

  const aur = w.aurora;
  const aurPct = aur ? fmtNum(aur.chance_pct, 0) : null;
  const aurFoot = aur ? auroraStatus(aur.status_key) : null;

  const fc = w.forecast || {};
  const fcToday = fc.today != null ? fmtNum(fc.today, 1) : "—";
  const fcTomorrow = fc.tomorrow != null ? fmtNum(fc.tomorrow, 1) : "—";

  return (
    <section className="section" style={{ paddingTop: 22, paddingBottom: 0 }}>
      <div className="wrap">
        <div className="storm-card" style={{ "--sbc": color }}>
          <span className="storm-live-badge"><span className="pulse" />{t("weather.storm.badge", { g: w.g_scale })}</span>
          <div className="storm-card-grid">
            <div>
              <h2>{t("weather.storm.headline")}</h2>
              <p className="storm-card-body">{t("weather.storm.body")}</p>
              <div className="storm-card-actions">
                <a href="#aurora" className="btn primary">{t("weather.hero.aurora")}</a>
                <a href="#current" className="btn ghost">{t("weather.hero.now")}</a>
              </div>
            </div>
            <div className="storm-card-side">
              <div className="storm-card-kp">{fmtNum(kp, 1)}<span className="unit">/9 Kp</span></div>
              <div className="kp-gauge"><div className="bar" style={{ width: kpBar + "%", background: color }} /></div>
              {aur && (
                <div className="dl-row"><span className="lbl">{t("weather.s4.chance")}</span><span className="val">{aurPct}% · {aurFoot}</span></div>
              )}
              <div className="dl-row"><span className="lbl">{t("weather.s4.forecastKp")}</span><span className="val">{t("weather.s4.today")} {fcToday} · {t("weather.s4.tomorrow")} {fcTomorrow}</span></div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
