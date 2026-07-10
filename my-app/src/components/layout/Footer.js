// Site footer (index.html footer). Links are mostly internal routes.
import { useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BOT_URL } from "../../lib/constants";
import FeedbackModal from "../FeedbackModal";

export default function Footer() {
  const { t } = useTranslation();
  const [fbOpen, setFbOpen] = useState(false);
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
            <button className="btn ghost foot-feedback" onClick={() => setFbOpen(true)}>
              ✉ {t("footer.feedback")}
            </button>
          </div>
          <div>
            <h5>{t("footer.colSky")}</h5>
            <Link to="/iss">{t("footer.colOrbit")}</Link>
            <Link to="/sky">{t("footer.colSkyObs")}</Link>
            <Link to="/?weather">{t("footer.colWeather")}</Link>
            <Link to="/?launches">{t("footer.colLaunches")}</Link>
            <Link to="/comets">{t("footer.colComets")}</Link>
            <Link to="/exoplanets">{t("nav.exoplanets")}</Link>
            <Link to="/mast">{t("nav.mast")}</Link>
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
      <FeedbackModal open={fbOpen} onClose={() => setFbOpen(false)} />
    </footer>
  );
}