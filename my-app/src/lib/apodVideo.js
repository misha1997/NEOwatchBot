// Shared helpers for rendering NASA APOD *video* entries inline — used by the
// homepage ApodCard and the Gallery page. APOD video URLs are either direct
// media files (native <video>) or YouTube/Vimeo links (embedded <iframe> via
// the privacy-enhanced nocookie hosts). NASA doesn't always ship a
// thumbnail_url, so the preview still is derived from the video URL itself
// (YouTube's public stills, or the first frame of a raw <video>).
import { useState } from "react";

export const LOOKS_LIKE_IMAGE = (s) =>
  !!s && /^https?:\/\/.+\.(jpg|jpeg|png|webp|gif|avif)(\?|#|$)/i.test(s);

// Turn a NASA APOD video URL into something we can embed inline.
// Returns one of:
//   { kind: "file",   src } — direct media file → native <video>
//   { kind: "iframe", src } — YouTube/Vimeo → embedded <iframe>
//   { kind: "link",   src } — anything else → fall back to opening externally
export function videoEmbed(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (/\.(mp4|webm|ogv|ogg|mov|m4v)(\?|#|$)/i.test(u.pathname)) {
      return { kind: "file", src: url };
    }
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      return { kind: "iframe", src: `https://www.youtube-nocookie.com/embed/${u.pathname.slice(1)}` };
    }
    if (host === "youtube.com" || host === "youtube-nocookie.com") {
      const v = u.searchParams.get("v");
      if (u.pathname === "/watch" && v) {
        return { kind: "iframe", src: `https://www.youtube-nocookie.com/embed/${v}` };
      }
      if (u.pathname.startsWith("/embed/")) {
        return { kind: "iframe", src: `https://www.youtube-nocookie.com${u.pathname}` };
      }
    }
    if (host === "vimeo.com" || host === "player.vimeo.com") {
      const id = u.pathname.split("/").filter(Boolean).pop();
      if (id) return { kind: "iframe", src: `https://player.vimeo.com/video/${id}` };
    }
    return { kind: "link", src: url };
  } catch {
    return { kind: "link", src: url };
  }
}

export function youtubeId(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtu.be") return u.pathname.slice(1).split("/")[0];
    if (host === "youtube.com" || host === "youtube-nocookie.com") {
      return u.searchParams.get("v") || (u.pathname.match(/\/embed\/([^/?#]+)/) || [])[1];
    }
  } catch { /* ignore */ }
  return null;
}

// Candidate poster images for a video APOD, best-first. NASA's thumbnail_url is
// used when present and actually points at an image; otherwise we fall back to
// YouTube's public stills (maxres → sd → hq). PosterImg walks the list and
// drops a candidate on load error, so a missing maxres never shows a broken img.
export function posterCandidates(videoUrl, apiImage) {
  const list = [];
  if (LOOKS_LIKE_IMAGE(apiImage)) list.push(apiImage);
  const id = youtubeId(videoUrl);
  if (id) {
    list.push(`https://i.ytimg.com/vi/${id}/maxresdefault.jpg`);
    list.push(`https://i.ytimg.com/vi/${id}/sddefault.jpg`);
    list.push(`https://i.ytimg.com/vi/${id}/hqdefault.jpg`);
  }
  return list;
}

// <img> that tries a list of candidate srcs, advancing on error. Renders a
// neutral placeholder if every candidate fails (e.g. raw .mp4 with no still).
export function PosterImg({ candidates, alt, className }) {
  const [idx, setIdx] = useState(0);
  const src = candidates[idx];
  if (!src) {
    return <div className="apod-thumb-fallback" aria-hidden="true"><span>▶</span></div>;
  }
  return (
    <img className={className} src={src} alt={alt} loading="lazy" decoding="async"
      onError={() => setIdx((i) => i + 1)} />
  );
}

// Append an autoplay param to an embed URL, minding any existing query string.
export function withAutoplay(src) {
  if (!src) return src;
  return src.includes("?") ? `${src}&autoplay=1` : `${src}?autoplay=1`;
}