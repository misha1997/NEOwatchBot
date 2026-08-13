"""Download + locally cache inline images found in news article bodies.

News RSS bodies (``content:encoded``) and the generic per-domain HTML fetch
(``parsers.news.NewsParser.get_article_content``) both extract embedded
``<img>`` tags as ``[IMG:n]`` placeholders in the body text (see
``parsers/news.py``). This module mirrors each one to
``data/news/<slug>/<n>-full.<ext>`` + a ~480px thumb, so the article page
loads from our own server instead of hotlinking whichever of the 5 source
sites it came from. Same pattern as ``services/apod_images.py`` /
``services/galaxy_images.py``.
"""
import logging
from pathlib import Path

import requests

logger = logging.getLogger(__name__)

DATA_NEWS_DIR = Path("data/news")
_UA = "NEOwatchBot/1.0 (news; +https://github.com/) NEOwatch-news-mirror"
_TIMEOUT = 20
_THUMB_MAX = 480  # px on the long edge


def _ext_from_url(url: str, fallback: str = "jpg") -> str:
    """Best-effort file extension from a URL path (lowercased, no query)."""
    try:
        import os
        from urllib.parse import urlparse
        path = urlparse(url).path
    except Exception:
        return fallback
    ext = os.path.splitext(path)[1].lower().lstrip(".")
    if ext in ("jpg", "jpeg", "png", "gif", "webp", "tif", "tiff", "bmp"):
        return "jpg" if ext == "jpeg" else ext
    return fallback


def download_news_image(slug: str, index: int, url: str):
    """Download one article image to ``data/news/<slug>/`` in two sizes.

    Returns ``(full_rel, thumb_rel)`` — paths relative to ``data/news/``
    (e.g. ``"falcon-9-launch/0-full.jpg"``, ``"falcon-9-launch/0-thumb.jpg"``)
    — or ``(None, None)`` on any failure. ``full_rel`` may be set while
    ``thumb_rel`` is ``None`` if the Pillow resize step fails (the thumb is
    optional; the page falls back to the full image).
    """
    slug = (slug or "").strip()
    src = (url or "").strip()
    if not slug or src == "" or index is None:
        return None, None

    try:
        abs_dir = DATA_NEWS_DIR / slug
        abs_dir.mkdir(parents=True, exist_ok=True)

        ext = _ext_from_url(src)
        full_rel = f"{slug}/{index}-full.{ext}"
        thumb_rel = f"{slug}/{index}-thumb.jpg"
        full_abs = DATA_NEWS_DIR / full_rel

        # Skip re-download if we already have both files (idempotent).
        if full_abs.exists() and (DATA_NEWS_DIR / thumb_rel).exists():
            return full_rel, thumb_rel

        resp = requests.get(src, timeout=_TIMEOUT, headers={"User-Agent": _UA})
        if resp.status_code != 200 or not resp.content:
            logger.warning("news image download failed %s -> %s", src, resp.status_code)
            return None, None

        full_abs.write_bytes(resp.content)

        try:
            from PIL import Image
            with Image.open(full_abs) as im:
                im = im.convert("RGB")
                im.thumbnail((_THUMB_MAX, _THUMB_MAX))
                im.save(DATA_NEWS_DIR / thumb_rel, "JPEG", quality=85, optimize=True)
        except Exception as e:
            logger.warning("news image thumb resize failed for %s/%s: %s", slug, index, e)
            return full_rel, None

        return full_rel, thumb_rel
    except Exception as e:
        logger.error("news image download error for %s/%s: %s", slug, index, e)
        return None, None
