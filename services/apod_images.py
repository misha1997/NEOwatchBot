"""Download + locally cache NASA APOD media in two sizes.

The website gallery used to hotlink ``apod.nasa.gov`` imagery. We now mirror
each day's APOD to ``data/apod/YYYY/MM/DD-<full|thumb>.<ext>`` so the grid loads
from our own server (no hotlink, faster cards) and the lightbox still has the
full-resolution original.

- ``full``  = the original bytes (HD image, or the video thumbnail as-is).
- ``thumb`` = a ~480px-wide JPEG (Pillow) for the grid card.

For video APODs the media itself stays a YouTube hotlink (``video_url``); only
the thumbnail is downloaded locally. Everything here is best-effort: any
failure returns ``(None, None)`` so ingest stores the row without paths and the
next poll retries the download.
"""
import logging
import os
from pathlib import Path
from urllib.parse import urlparse

import requests

logger = logging.getLogger(__name__)

DATA_APOD_DIR = Path("data/apod")
_UA = ("Mozilla/5.0 (NEOwatchBot/1.0; +https://github.com/) "
       "APOD-archive-mirror")
_TIMEOUT = 20
_THUMB_MAX = 480  # px on the long edge


def _ext_from_url(url: str, fallback: str = "jpg") -> str:
    """Best-effort file extension from a URL path (lowercased, no query)."""
    try:
        path = urlparse(url).path
    except Exception:
        return fallback
    ext = os.path.splitext(path)[1].lower().lstrip(".")
    if ext in ("jpg", "jpeg", "png", "gif", "webp", "tif", "tiff", "bmp"):
        # Normalise jpeg->jpg so the on-disk name is consistent.
        return "jpg" if ext == "jpeg" else ext
    return fallback


def _source_url(entry: dict) -> str:
    """Pick the URL to download as the 'full' original.

    Image APODs: prefer hdurl (HD), fall back to url (standard res ~1280px) —
    hdurl is sometimes 403/missing. Video APODs: use the thumbnail (NASA
    ``thumbs=True``) as the poster — only the thumbnail is mirrored locally,
    never the video file itself; if NASA didn't supply one, return '' so the
    caller skips the download (the row keeps just its hotlinked video_url).
    """
    media_type = (entry.get("media_type") or "image").lower()
    if media_type == "video":
        return entry.get("thumbnail") or ""
    return entry.get("hdurl") or entry.get("url") or entry.get("thumbnail") or ""


def download_apod_media(entry: dict):
    """Download one APOD entry's media to ``data/apod/`` in two sizes.

    Returns ``(full_rel, thumb_rel)`` — paths relative to ``data/apod/``
    (e.g. ``"2026/07/14-full.jpg"``, ``"2026/07/14-thumb.jpg"``) — or
    ``(None, None)`` on any failure. ``full_rel`` may be set while ``thumb_rel``
    is ``None`` if the Pillow resize step fails (the thumb is optional; the
    grid falls back to the full image).
    """
    date = (entry.get("date") or "").strip()
    src = (_source_url(entry) or "").strip()
    if not date or not src:
        return None, None

    try:
        rel_dir = f"{date[:4]}/{date[5:7]}"
        abs_dir = DATA_APOD_DIR / rel_dir
        abs_dir.mkdir(parents=True, exist_ok=True)

        ext = _ext_from_url(src)
        full_rel = f"{rel_dir}/{date[8:10]}-full.{ext}"
        thumb_rel = f"{rel_dir}/{date[8:10]}-thumb.jpg"
        full_abs = DATA_APOD_DIR / full_rel

        # Skip re-download if we already have the files (idempotent).
        if full_abs.exists() and (DATA_APOD_DIR / thumb_rel).exists():
            return full_rel, thumb_rel

        resp = requests.get(src, timeout=_TIMEOUT, headers={"User-Agent": _UA})
        if resp.status_code != 200 or not resp.content:
            logger.warning("APOD image download failed %s -> %s", src, resp.status_code)
            return None, None

        full_abs.write_bytes(resp.content)

        # Build the 480px thumbnail from the freshly-saved full file.
        try:
            from PIL import Image
            with Image.open(full_abs) as im:
                im = im.convert("RGB")
                im.thumbnail((_THUMB_MAX, _THUMB_MAX))
                im.save(DATA_APOD_DIR / thumb_rel, "JPEG", quality=85, optimize=True)
        except Exception as e:
            logger.warning("APOD thumb resize failed for %s: %s", date, e)
            return full_rel, None

        return full_rel, thumb_rel
    except Exception as e:
        logger.error("APOD media download error for %s: %s", date, e)
        return None, None