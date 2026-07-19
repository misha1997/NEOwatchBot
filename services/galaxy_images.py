"""Download + locally cache NASA Image Library photos for the galaxies page.

Mirrors each NASA image to ``data/galaxies/<galaxy_key>/<nasa_id>-<full|thumb>.<ext>``
so the gallery loads from our own server (no hotlink) and the lightbox has a
full-resolution original. Same pattern as ``services/apod_images.py``:

- ``full``  = the ``~large`` asset bytes (good size/quality balance).
- ``thumb`` = a ~480px-long-edge JPEG (Pillow) for the grid card.

Idempotent: skips re-download when both files already exist. Best-effort: any
failure returns ``(None, None)`` so ingest stores the row without paths and the
next poll retries the download.
"""
import logging
from pathlib import Path

import requests

logger = logging.getLogger(__name__)

DATA_GAL_DIR = Path("data/galaxies")
_UA = "NEOwatchBot/1.0 (galaxies; +https://github.com/) NEOwatch-galaxy-mirror"
_TIMEOUT = 25
_THUMB_MAX = 480  # px on the long edge


def _ext_from_url(url: str, fallback: str = "jpg") -> str:
    """Best-effort file extension from a URL path (lowercased, no query)."""
    try:
        from urllib.parse import urlparse
        import os
        path = urlparse(url).path
    except Exception:
        return fallback
    import os
    ext = os.path.splitext(path)[1].lower().lstrip(".")
    if ext in ("jpg", "jpeg", "png", "gif", "webp", "tif", "tiff", "bmp"):
        return "jpg" if ext == "jpeg" else ext
    return fallback


# NASA image-asset URLs follow ``.../<nasa_id>/<nasa_id>~<size>.<ext>``. Not every
# asset publishes every size — ``~large`` frequently 403s while ``~orig`` or
# ``~medium`` exist. Try them in order of preference and take the first 200.
_ASSET_SIZES = ["large", "orig", "medium", "small"]


def _asset_candidates(orig_url: str) -> list:
    """Derive candidate asset URLs by swapping the ``~<size>`` suffix."""
    import re
    m = re.match(r"^(.*?~)(large|orig|medium|small)(\.[^./]+)$", orig_url)
    if not m:
        return [orig_url]
    base, _, ext = m.group(1), m.group(2), m.group(3)
    return [f"{base}{sz}{ext}" for sz in _ASSET_SIZES]


def download_galaxy_photo(galaxy_key: str, nasa_id: str, orig_url: str):
    """Download one NASA photo to ``data/galaxies/<key>/`` in two sizes.

    Returns ``(full_rel, thumb_rel)`` — paths relative to ``data/galaxies/``
    (e.g. ``"andromeda/PIA04230-full.jpg"``, ``"andromeda/PIA04230-thumb.jpg"``)
    — or ``(None, None)`` on any failure. ``full_rel`` may be set while
    ``thumb_rel`` is ``None`` if the Pillow resize step fails.
    """
    galaxy_key = (galaxy_key or "").strip()
    nasa_id = (nasa_id or "").strip()
    src = (orig_url or "").strip()
    if not galaxy_key or not nasa_id or not src:
        return None, None

    try:
        abs_dir = DATA_GAL_DIR / galaxy_key
        abs_dir.mkdir(parents=True, exist_ok=True)

        ext = _ext_from_url(src)
        full_rel = f"{galaxy_key}/{nasa_id}-full.{ext}"
        thumb_rel = f"{galaxy_key}/{nasa_id}-thumb.jpg"
        full_abs = DATA_GAL_DIR / full_rel

        # Skip re-download if we already have both files (idempotent).
        if full_abs.exists() and (DATA_GAL_DIR / thumb_rel).exists():
            return full_rel, thumb_rel

        content = None
        for cand in _asset_candidates(src):
            try:
                resp = requests.get(cand, timeout=_TIMEOUT, headers={"User-Agent": _UA})
            except Exception as e:
                logger.warning("galaxy photo download error %s: %s", cand, e)
                continue
            if resp.status_code == 200 and resp.content:
                content = resp.content
                break
            logger.warning("galaxy photo download failed %s -> %s", cand, resp.status_code)
        if content is None:
            return None, None

        full_abs.write_bytes(content)

        # Build the 480px thumbnail from the freshly-saved full file.
        try:
            from PIL import Image
            with Image.open(full_abs) as im:
                im = im.convert("RGB")
                im.thumbnail((_THUMB_MAX, _THUMB_MAX))
                im.save(DATA_GAL_DIR / thumb_rel, "JPEG", quality=85, optimize=True)
        except Exception as e:
            logger.warning("galaxy thumb resize failed for %s/%s: %s", galaxy_key, nasa_id, e)
            return full_rel, None

        return full_rel, thumb_rel
    except Exception as e:
        logger.error("galaxy photo download error for %s/%s: %s", galaxy_key, nasa_id, e)
        return None, None