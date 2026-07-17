// 404 page — served for any unknown route. The Layout's Starfield sits behind
// it, so the big translucent "404" reads as a drifting object in the field.
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import LocalizedLink from "../components/primitives/LocalizedLink";

export default function NotFound() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  useEffect(() => { document.title = t("title.404"); }, [t]);
  return (
    <section className="hero not-found">
      <div className="wrap">
        <div className="hero-grid" style={{ gridTemplateColumns: "1fr" }}>
          <div className="nf-content">
            <div className="eyebrow">{t("notFound.eyebrow")}</div>
            <div className="nf-code" aria-hidden="true">{t("notFound.code")}</div>
            <h1 className="hero-title">{t("notFound.title")}</h1>
            <p className="hero-sub">{t("notFound.body")}</p>
            <div className="hero-actions">
              <LocalizedLink to="home" className="btn primary">{t("notFound.home")}</LocalizedLink>
              <button type="button" className="btn ghost" onClick={() => navigate(-1)}>{t("notFound.back")}</button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}