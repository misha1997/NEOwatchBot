// Astronomy Picture of the Day block for the homepage (under the hero).
// Loads /api/apod (NASA APOD, with the explanation translated to the site
// language). Renders the image (or video thumbnail linking to the APOD video)
// beside the title + explanation. Hides itself entirely when APOD is unavailable
// or still loading, so the homepage never shows an empty frame.
import { useTranslation } from "react-i18next";
import { useLang } from "../../context/LanguageContext";
import { useApi } from "../../hooks/useApi";
import { getApod } from "../../lib/api";
import SectionHead from "../primitives/SectionHead";

export default function ApodCard() {
  const { t } = useTranslation();
  const { lang } = useLang();
  const { data } = useApi(() => getApod(lang), { deps: [lang] });

  if (!data || !data.available) return null;
  const isVideo = data.media_type === "video";
  const date = data.date ? new Date(`${data.date}T00:00:00Z`).toLocaleDateString(
    lang === "en" ? "en-GB" : "uk-UA", { day: "numeric", month: "long", year: "numeric" },
  ) : "";

  return (
    <section className="section apod-section" style={{ paddingTop: 0 }}>
      <div className="wrap">
        <SectionHead eyebrow={t("home.apod.eyebrow")} title={t("home.apod.title")} />
        <div className="apod-card">
          <div className="apod-media">
            {isVideo ? (
              <a href={data.video_url || data.image} target="_blank" rel="noopener noreferrer">
                <img src={data.image} alt={data.title} loading="lazy" />
                <span className="apod-play" aria-hidden="true">▶</span>
              </a>
            ) : (
              <a href={data.image} target="_blank" rel="noopener noreferrer">
                <img src={data.image} alt={data.title} loading="lazy" />
              </a>
            )}
          </div>
          <div className="apod-text">
            <div className="apod-date">{date}</div>
            <h3 className="apod-title">{data.title}</h3>
            <p className="apod-expl">{data.explanation}</p>
            {data.credit && <div className="apod-credit">© {data.credit}</div>}
            <a className="apod-link" href="https://apod.nasa.gov/apod/astropix.html"
              target="_blank" rel="noopener noreferrer">{t("home.apod.source")} ↗</a>
          </div>
        </div>
      </div>
    </section>
  );
}