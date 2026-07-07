// Site footer (index.html footer). Links are mostly internal routes.
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BOT_URL } from "../../lib/constants";

export default function Footer() {
  const { t } = useTranslation();
  return (
    <footer>
      <div className="wrap">
        <div className="foot-grid">
          <div>
            <div className="logo" style={{ marginBottom: 12 }}>
              <img className="logo-img" src="/web-app-manifest-192x192.png" alt="" aria-hidden="true" />
              <span>OrbitLight<small>{t("footer.tagline")}</small></span>
            </div>
            <p style={{ color: "var(--text-dim)", fontSize: 13.5, maxWidth: 280 }}>
              {t("footer.intro")}
            </p>
          </div>
          <div>
            <h5>{t("footer.colSky")}</h5>
            <Link to="/iss">{t("footer.colOrbit")}</Link>
            <Link to="/sky">{t("footer.colSkyObs")}</Link>
            <Link to="/?weather">{t("footer.colWeather")}</Link>
            <Link to="/?launches">{t("footer.colLaunches")}</Link>
            <Link to="/comets">{t("footer.colComets")}</Link>
            <Link to="/exoplanets">{t("nav.exoplanets")}</Link>
          </div>
          <div>
            <h5>{t("footer.colProject")}</h5>
            <a href={BOT_URL} target="_blank" rel="noopener">{t("footer.colBot")}</a>
            <Link to="/deep">{t("footer.colDeep")}</Link>
            <Link to="/voyager">{t("footer.colVoyager")}</Link>
            <Link to="/events">{t("footer.colEvents")}</Link>
          </div>
        </div>
        <div className="foot-bottom">
          <span>{t("footer.copyright")}</span>
          <span>{t("footer.made")}</span>
        </div>
      </div>
    </footer>
  );
}