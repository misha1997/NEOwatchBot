"""Mars rover photos — Mars Vista API.

The original NASA Mars Rover Photos API (``api.nasa.gov/mars-photos``) was
retired in 2024 — its Heroku app was decommissioned and every endpoint now
returns ``404 "No such app"``. The community successor is the **Mars Vista
API** (https://marsvista.dev), which preserves 100% of NASA/JPL metadata for
Perseverance and Curiosity. It needs a free API key (email signup) passed via
the ``X-API-Key`` header — see ``MARS_VISTA_API_KEY`` in ``config.py``.

We request recent photos (last ~30 Earth days) for a rover, sort newest-first
client-side and pick a handful, preferring different cameras for variety.
"""
from datetime import date, timedelta
import requests
import logging
from config import MARS_VISTA_API_KEY
from utils.i18n import t, DEFAULT_LANG

logger = logging.getLogger(__name__)

MARS_API_BASE = "https://api.marsvista.dev"
ROVERS = ("perseverance", "curiosity")
# How far back to look for recent photos. Both rovers image daily, so 30 days
# comfortably covers the newest sol even during light-activity periods.
_LOOKBACK_DAYS = 30


class MarsRoverAPI:
    """Mars Vista API client for the latest Perseverance / Curiosity photos."""

    @staticmethod
    def is_configured() -> bool:
        return bool(MARS_VISTA_API_KEY)

    @staticmethod
    def get_latest_photos(rover: str, limit: int = 4, lang: str = DEFAULT_LANG):
        """Return up to `limit` latest photos for `rover`.

        Returns list of dicts: {img_src, camera, sol, earth_date, rover}, or
        [] on failure / when the API key is not configured. Prefers one photo
        per camera for variety.
        """
        rover = (rover or "").lower()
        if rover not in ROVERS:
            return []
        if not MARS_VISTA_API_KEY:
            logger.warning("Mars rover photos: MARS_VISTA_API_KEY not set")
            return []
        try:
            earth_min = (date.today() - timedelta(days=_LOOKBACK_DAYS)).isoformat()
            params = {
                "rovers": rover,
                "include": "rover,camera",
                "per_page": 60,
                "earth_date_min": earth_min,
            }
            headers = {"X-API-Key": MARS_VISTA_API_KEY}
            r = requests.get(f"{MARS_API_BASE}/api/v2/photos",
                             params=params, headers=headers, timeout=20)
            r.raise_for_status()
            items = r.json().get("data", []) or []
            if not items:
                return []

            # Flatten to the shape the handler expects, newest-first by sol then
            # capture time.
            flattened = []
            for item in items:
                a = item.get("attributes", {}) or {}
                rels = item.get("relationships", {}) or {}
                rover_attrs = (rels.get("rover") or {}).get("attributes", {}) or {}
                cam_attrs = (rels.get("camera") or {}).get("attributes", {}) or {}
                cam_id = (rels.get("camera") or {}).get("id", "")
                images = a.get("images", {}) or {}
                img_src = (images.get("large") or images.get("medium")
                           or images.get("full") or images.get("small") or "")
                if not img_src:
                    continue
                flattened.append({
                    "img_src": img_src,
                    "camera": cam_attrs.get("full_name") or cam_id or "",
                    "sol": a.get("sol"),
                    "earth_date": a.get("earth_date", "") or "",
                    "rover": rover_attrs.get("name") or rover.capitalize(),
                    "_sort": (a.get("sol") or 0, a.get("date_taken_utc") or ""),
                })
            flattened.sort(key=lambda p: p["_sort"], reverse=True)

            # Prefer variety: first photo per camera, then fill up to limit.
            picked = []
            seen_cameras = set()
            for p in flattened:
                cam = p["camera"] or "_"
                if cam in seen_cameras:
                    continue
                seen_cameras.add(cam)
                p.pop("_sort", None)
                picked.append(p)
                if len(picked) >= limit:
                    break

            if len(picked) < limit:
                for p in flattened:
                    if len(picked) >= limit:
                        break
                    p.pop("_sort", None)
                    if p not in picked:
                        picked.append(p)
            return picked
        except Exception as e:
            logger.error(f"Mars rover photos error for {rover}: {e}")
            return []

    @staticmethod
    def format_header(rover: str, photos: list, lang: str = DEFAULT_LANG) -> str:
        """Text header shown alongside the photos."""
        if not photos:
            return t('rovers.empty', lang, rover=rover.capitalize())
        sol = photos[0].get("sol", "—")
        earth = photos[0].get("earth_date", "—")
        msg = t('rovers.title', lang, rover=rover.capitalize())
        msg += t('rovers.meta', lang, sol=sol, date=earth, n=len(photos))
        msg += t('rovers.source', lang)
        return msg

    @staticmethod
    def caption_for(photo: dict, lang: str = DEFAULT_LANG) -> str:
        return t('rovers.caption', lang,
                 rover=photo.get("rover", ""), camera=photo.get("camera", ""),
                 sol=photo.get("sol", "—"), date=photo.get("earth_date", "—"))