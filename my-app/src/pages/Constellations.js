import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useLang } from "../context/LanguageContext";
import ConstellationMap from "../components/ConstellationMap";
import "../styles/constellations.css";

export default function Constellations() {
  const { t } = useTranslation();
  const { lang } = useLang();

  // Set document title.
  useEffect(() => {
    document.title = t("title.constellations") || "Сузір'я — OrbitLight";
  }, [t]);

  return (
    <>
      {/* Hero section */}
      <section className="hero">
        <div className="wrap">
          <div className="eyebrow">{t("constellations.hero.eyebrow") || "Інтерактивно · клікни на будь-яке сузір'я"}</div>
          <h1 className="hero-title">
            {lang === "en" ? (
              <>Find <span className="accent">constellations</span><br />in the night sky</>
            ) : (
              <>Впізнай <span className="accent">сузір'я</span><br />на нічному небі</>
            )}
          </h1>
          <p className="hero-sub" style={{ maxWidth: 640 }}>
            {lang === "en"
              ? "The eight most famous constellations of the northern sky — with their shape, brightest star, and origin myth. Click on a figure or button below to select."
              : "Вісім найвідоміших сузір'їв північного неба — з їхньою формою, головною зорею та міфом походження. Клікай на фігуру або на назву внизу, щоб дізнатись більше."}
          </p>
        </div>
      </section>

      {/* Interactive Map Section */}
      <section className="section" style={{ paddingTop: 8 }}>
        <div className="wrap">
          <ConstellationMap />
        </div>
      </section>
    </>
  );
}