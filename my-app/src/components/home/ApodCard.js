// Astronomy Picture of the Day block for the homepage (under the hero).
// Loads /api/apod (NASA APOD, with the explanation translated to the site
// language). For image APODs, shows the photo (links to full-res). For video
// APODs, shows a thumbnail with a play badge; clicking it loads a real
// embedded player inline — a YouTube <iframe> (privacy-enhanced nocookie) or a
// native <video> element for direct media files — instead of bouncing the user
// to an external site. NASA does not always ship a thumbnail_url for videos, so
// the preview is derived from the video URL itself (YouTube's public stills, or
// the first frame of a raw <video>). Hides itself entirely when APOD is
// unavailable or still loading, so the homepage never shows an empty frame.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLang } from "../../context/LanguageContext";
import { useApi } from "../../hooks/useApi";
import { getApod } from "../../lib/api";
import {
  videoEmbed,
  posterCandidates,
  withAutoplay,
  PosterImg,
} from "../../lib/apodVideo";
import SectionHead from "../primitives/SectionHead";

export default function ApodCard() {
  const { t } = useTranslation();
  const { lang } = useLang();
  const { data } = useApi(() => getApod(lang), { deps: [lang] });
  // Lazy-load the player only after the user clicks the thumbnail, so the
  // homepage never pulls a third-party iframe until asked to.
  const [playing, setPlaying] = useState(false);

  if (!data || !data.available) return null;
  const isVideo = data.media_type === "video";
  const date = data.date ? new Date(`${data.date}T00:00:00Z`).toLocaleDateString(
    lang === "en" ? "en-GB" : "uk-UA", { day: "numeric", month: "long", year: "numeric" },
  ) : "";
  const embed = isVideo ? videoEmbed(data.video_url) : null;
  const embeddable = embed && (embed.kind === "file" || embed.kind === "iframe");
  const poster = isVideo ? posterCandidates(data.video_url, data.image) : [];

  const media = isVideo ? (
    embeddable && playing ? (
      embed.kind === "file" ? (
        <video className="apod-player" src={`${embed.src}#t=0.5`}
          poster={poster[0]} controls autoPlay muted playsInline title={data.title}>
          {t("home.apod.noVideoSupport")}
          <a href={embed.src} target="_blank" rel="noopener noreferrer">
            {t("home.apod.openVideo")} ↗
          </a>
        </video>
      ) : (
        <iframe className="apod-player" src={withAutoplay(embed.src)}
          title={data.title} loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
      )
    ) : embeddable ? (
      <button type="button" className="apod-play-btn"
        onClick={() => setPlaying(true)}
        aria-label={t("home.apod.play")}>
        {embed.kind === "file" ? (
          // Render the first frame of a raw video file as its own preview.
          <video className="apod-thumb-frame" src={`${embed.src}#t=0.5`}
            poster={poster[0]} preload="metadata" muted playsInline tabIndex={-1} />
        ) : (
          <PosterImg candidates={poster} alt={data.title} className="apod-thumb-img" />
        )}
        <span className="apod-play" aria-hidden="true">▶</span>
      </button>
    ) : (
      // Unrecognized video host — fall back to opening externally.
      <a href={data.video_url || data.image} target="_blank" rel="noopener noreferrer">
        <PosterImg candidates={poster.length ? poster : [data.image].filter(Boolean)} alt={data.title} />
        <span className="apod-play" aria-hidden="true">▶</span>
      </a>
    )
  ) : (
    <a href={data.image} target="_blank" rel="noopener noreferrer">
      <img src={data.image} alt={data.title} loading="lazy" />
    </a>
  );

  return (
    <section className="section apod-section" style={{ paddingTop: 0 }}>
      <div className="wrap">
        <SectionHead eyebrow={t("home.apod.eyebrow")} title={t("home.apod.title")} />
        <div className="apod-card">
          <div className="apod-media">{media}</div>
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