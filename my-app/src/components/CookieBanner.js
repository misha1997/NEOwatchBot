// GDPR-style cookie consent banner. Shown once (choice persisted to
// localStorage) and wired to Google Consent Mode v2: the gtag snippet in
// public/index.html sets default consent to "denied", so no analytics cookies
// land until the user clicks "Accept". Accepting updates consent to "granted".
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

const STORAGE_KEY = "neowatch.cookie";
// Values: "accepted" | "rejected" | null (not yet decided).

function updateConsent(granted) {
  if (typeof window.gtag !== "function") return;
  const value = granted ? "granted" : "denied";
  window.gtag("consent", "update", {
    analytics_storage: value,
    ad_storage: value,
    ad_user_data: value,
    ad_personalization: value,
  });
}

export default function CookieBanner() {
  const { t } = useTranslation();
  const [choice, setChoice] = useState(() => localStorage.getItem(STORAGE_KEY));

  // If a previous session already accepted, re-assert granted consent so GA
  // resumes tracking on this load (gtag default is denied each page load).
  useEffect(() => {
    if (choice === "accepted") updateConsent(true);
  }, [choice]);

  function decide(next) {
    localStorage.setItem(STORAGE_KEY, next);
    setChoice(next);
    updateConsent(next === "accepted");
  }

  if (choice) return null;

  return (
    <div className="cookie-banner" role="dialog" aria-label={t("cookies.policy")}>
      <div className="wrap cb-inner">
        <p className="cb-text">
          <span className="cb-icon" aria-hidden="true">🍪</span>
          {t("cookies.text")}
        </p>
        <div className="cb-actions">
          <button className="btn ghost cb-btn" onClick={() => decide("rejected")}>
            {t("cookies.reject")}
          </button>
          <button className="btn primary cb-btn" onClick={() => decide("accepted")}>
            {t("cookies.accept")}
          </button>
        </div>
      </div>
    </div>
  );
}