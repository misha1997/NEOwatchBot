"""Fetch galaxy photos from Wikimedia Commons by category.

NASA Image Library search is keyword-matched and noisy — a "Milky Way" query
returns nebulae, other-galaxy Hubble shots, even Arctic Earth photos that
happen to carry the keyword. Wikimedia Commons, by contrast, has a curated
``Category:<Galaxy Name>`` for each galaxy where every file genuinely depicts
that object (human-categorised), including the iconic wide-field views and
the latest JWST/ESO/Hubble releases. This is the primary photo source for the
galaxies page; ``services/galaxies._nasa_photos`` remains as a fallback for any
galaxy whose Commons category is empty.

Returned dicts are ingest-compatible with ``database.ingest_galaxy_photos``:
``{nasa_id, title, description, credit, date_created, orig_url, source_url}``.
``nasa_id`` is sanitised to a filesystem-safe ``commons_<slug>_<hash>`` so it
can be used as a filename by ``services.galaxy_images.download_galaxy_photo``.
``orig_url`` is Commons' 1280px scaled derivative (good lightbox size; the
full originals run to 7000+ px / tens of MB). ``source_url`` is the Commons
file page (for the "open original" link — NASA photos link to
images.nasa.gov/details instead).
"""
import hashlib
import logging
import re

import requests

logger = logging.getLogger(__name__)

COMMONS_API = "https://commons.wikimedia.org/w/api.php"
_UA = "NEOwatchBot/1.0 (galaxies; +https://github.com/) NEOwatch-commons-mirror"
_TIMEOUT = 25
_FULL_WIDTH = 1280  # px — the lightbox-quality derivative we mirror

# raster image MIME types we accept (skip svg/gif/tiff/bmp — diagrams, animations,
# and formats browsers won't render inline / Pillow handles awkwardly).
_ACCEPT_MIME = {"image/jpeg", "image/png", "image/webp"}


def _strip_html(s: str) -> str:
    """Crude HTML strip + whitespace collapse for Commons extmetadata fields."""
    if not s:
        return ""
    s = re.sub(r"<[^>]+>", " ", s)
    s = re.sub(r"&[a-z]+;|&#\d+;", " ", s)
    s = re.sub(r"\s+", " ", s)
    return s.strip()


def _slugify(filename: str) -> str:
    """Filesystem-safe slug from a Commons ``File:Foo Bar.png`` name.

    Strips the ``File:`` prefix and extension, replaces non-alphanumerics with
    ``_``, collapses runs, and truncates. Combined with a short hash of the
    original filename for uniqueness (distinct files can share a stem).
    """
    name = re.sub(r"^File:", "", filename)
    name = re.sub(r"\.[^.]+$", "", name)
    name = re.sub(r"[^A-Za-z0-9]+", "_", name).strip("_")
    if len(name) > 50:
        name = name[:50]
    h = hashlib.md5(filename.encode("utf-8")).hexdigest()[:6]
    return f"commons_{name}_{h}"


def _score(meta: dict, title: str, width: int) -> int:
    """Prefer high-res real photos of the galaxy itself; deprioritise diagrams
    and annotated/instrument-overlay images that Commons categories contain."""
    blob = f"{title} {meta.get('desc','')} {meta.get('credit','')}".lower()
    s = 0
    # High-resolution real photo (not a tiny thumbnail).
    if width >= 2000:
        s += 3
    elif width >= 1000:
        s += 2
    elif width < 600:
        s -= 2
    # Hubble / JWST / Webb / ESO / NASA imaging — iconic optical/near-IR.
    if any(k in blob for k in ("hubble", "hst", "jwst", "webb", "eso", "nasa", "noao")):
        s += 2
    # Galactic-structure imagery — what users mean by "a photo of the galaxy
    # itself", especially for the Milky Way (no external view exists). Boosts
    # top-down illustrations, Spitzer infrared mosaics, and galactic-center
    # maps above incidental Earth-based sky shots.
    if any(k in blob for k in (
        "top-down view", "top down view", "glimpse of the milky", "spitzer",
        "structure of the milky", "spiral structure", "galactic center",
        "map of the milky",
    )):
        s += 4
    # Real photos but off-topic for a galaxy gallery: Earth/ISS shots that
    # only incidentally include the Milky Way band (aurora, airglow).
    if any(k in blob for k in (
        "aurora australis", "aurora borealis", "airglow", "iss0",
        "beneath the milky", "earth beneath", "from the iss", "from orbit",
    )):
        s -= 4
    # Not a clean photo.
    if any(k in blob for k in (
        "chart", "map", "diagram", "schematic", "plot", "table", "spectrum",
        "annotated", "annotation", "compass", "label", "labels", "inset",
        "sketch", "logo", "comic", "collage of",
    )):
        s -= 3
    if any(k in blob for k in ("artist", "concept", "impression")):
        s -= 2
    return s


def build_commons_photos(category: str, cap: int = 24) -> list[dict]:
    """Return up to ``cap`` ingest-ready photo dicts from a Commons category.

    Best-effort: returns ``[]`` on any failure so the caller falls back to the
    NASA Image Library. Never raises.
    """
    if not category:
        return []
    try:
        resp = requests.get(
            COMMONS_API,
            params={
                "action": "query", "generator": "categorymembers",
                "gcmtitle": f"Category:{category}", "gcmtype": "file",
                "gcmlimit": "max", "prop": "imageinfo",
                "iiprop": "url|mime|size|extmetadata", "iiurlwidth": _FULL_WIDTH,
                "format": "json", "origin": "*",
            },
            timeout=_TIMEOUT, headers={"User-Agent": _UA},
        )
        if resp.status_code != 200 or not resp.text:
            logger.warning("commons category %r -> %s", category, resp.status_code)
            return []
        pages = (resp.json().get("query", {}) or {}).get("pages", {}) or {}
    except Exception as e:  # noqa: BLE001 — best-effort
        logger.warning("commons fetch %r failed: %s", category, e)
        return []

    scored: list[tuple[int, dict]] = []
    for p in pages.values():
        ii = (p.get("imageinfo") or [{}])[0]
        mime = ii.get("mime") or ""
        if mime not in _ACCEPT_MIME:
            continue
        em = ii.get("extmetadata", {}) or {}
        artist = _strip_html((em.get("Artist") or {}).get("value", ""))
        lic = _strip_html((em.get("LicenseShortName") or {}).get("value", ""))
        credit = " · ".join(x for x in (artist, lic) if x) or None
        title = p.get("title", "")
        title_clean = re.sub(r"^File:", "", title)
        title_clean = re.sub(r"\.[^.]+$", "", title_clean)
        meta = {
            "desc": _strip_html((em.get("ImageDescription") or {}).get("value", "")),
            "credit": credit or "",
        }
        width = ii.get("width") or 0
        scored.append((_score(meta, title_clean, width), {
            "nasa_id": _slugify(title),
            "title": title_clean[:280],
            "description": meta["desc"][:600],
            "credit": (credit or "")[:280] or None,
            "date_created": _strip_html((em.get("DateTimeOriginal") or {}).get("value", ""))[:40] or None,
            "orig_url": ii.get("thumburl") or ii.get("url"),
            "source_url": f"https://commons.wikimedia.org/wiki/{title.replace(' ', '_')}",
            "_w": width,
        }))

    scored.sort(key=lambda t: (t[0], t[1]["_w"]), reverse=True)
    out = []
    seen = set()
    for _, ph in scored:
        nid = ph["nasa_id"]
        if nid in seen:
            continue
        seen.add(nid)
        ph.pop("_w", None)
        out.append(ph)
        if len(out) >= cap:
            break
    return out