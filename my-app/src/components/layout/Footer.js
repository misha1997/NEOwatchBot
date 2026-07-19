// Site footer (index.html footer). Links are internal routes — passed as
// i18n route names to LocalizedLink so they resolve to /ua/ or /en/.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { BOT_URL } from "../../lib/constants";
import LocalizedLink from "../primitives/LocalizedLink";
import { useLang } from "../../context/LanguageContext";
import { pathFor } from "../../lib/seo";
import FeedbackModal from "../FeedbackModal";
import OnlineCounter from "./OnlineCounter";

export default function Footer() {
  const { t } = useTranslation();
  const { lang } = useLang();
  const [fbOpen, setFbOpen] = useState(false);
  // Home + a ?query that the Home page reads to jump to a section.
  const homeWeather = pathFor("home", lang) + "?weather";
  const homeLaunches = pathFor("home", lang) + "?launches";
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
            <LocalizedLink to="iss">{t("footer.colOrbit")}</LocalizedLink>
            <LocalizedLink to="sky">{t("footer.colSkyObs")}</LocalizedLink>
            <LocalizedLink to={homeWeather}>{t("footer.colWeather")}</LocalizedLink>
            <LocalizedLink to={homeLaunches}>{t("footer.colLaunches")}</LocalizedLink>
            <LocalizedLink to="comets">{t("footer.colComets")}</LocalizedLink>
            <LocalizedLink to="exoplanets">{t("nav.exoplanets")}</LocalizedLink>
            <LocalizedLink to="mast">{t("nav.mast")}</LocalizedLink>
            <LocalizedLink to="gallery">{t("nav.gallery")}</LocalizedLink>
          </div>
          <div>
            <h5>{t("footer.colProject")}</h5>
            <a href={BOT_URL} target="_blank" rel="noopener">{t("footer.colBot")}</a>
            <LocalizedLink to="deep">{t("footer.colDeep")}</LocalizedLink>
            <LocalizedLink to="voyager">{t("footer.colVoyager")}</LocalizedLink>
            <LocalizedLink to="events">{t("footer.colEvents")}</LocalizedLink>
          </div>
          <div>
            <h5>{t("footer.colStatus")}</h5>
            <OnlineCounter />
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