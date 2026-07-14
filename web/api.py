"""HTTP API routes for the NEOwatch website.

Endpoints return JSON consumed by the React SPA (``my-app/src/lib/api.js``). They are thin:
authentication, formatting and caching live in ``web.data`` and the bot's
service modules. Sync service calls are offloaded to a thread pool via
``asyncio.to_thread`` so the event loop stays responsive for the bot polling.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Query, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from config import DEFAULT_LAT, DEFAULT_LON
from web import data
from web.feedback import FeedbackNotConfigured, send_feedback_telegram

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["site"])


def _loc(lat: float | None, lon: float | None) -> tuple[float, float]:
    """Fall back to the configured default (Kyiv) when no location is given."""
    if lat is None or lon is None:
        return DEFAULT_LAT, DEFAULT_LON
    return lat, lon


# Optional language override for endpoints that return localized text. The
# site defaults to Ukrainian; the React app appends ``?lang=en`` when the user
# switches to English. Endpoints that only return language-neutral/key-based
# data (weather, launches, voyager, mars, debris, grb, geocode) ignore it.
LANG_Q = Query("uk", pattern="uk|en", description="Response language (uk|en)")


@router.get("/weather")
async def weather(
    lat: float | None = Query(None, description="Observer latitude, for aurora estimate"),
    lon: float | None = Query(None, description="Observer longitude"),
):
    """Space weather snapshot: Kp, solar wind, Bz, X-ray class, aurora chance."""
    return await data.get_space_weather(lat, lon)


@router.get("/weather/series")
async def weather_series():
    """Time-series for the space-weather page charts (Kp history + forecast,
    solar wind, Bz, GOES X-ray flux) + the NOAA OVATION aurora map URL."""
    return await data.get_weather_series()


@router.get("/launches")
async def launches():
    """Upcoming rocket launches (Launch Library 2)."""
    return await data.get_launches()


@router.get("/iss/passes")
async def iss_passes(
    lat: float | None = Query(None),
    lon: float | None = Query(None),
    lang: str = LANG_Q,
):
    """Next visible ISS passes over the observer's location (defaults to Kyiv)."""
    la, lo = _loc(lat, lon)
    return await data.get_iss_passes(la, lo, lang)


@router.get("/sky")
async def sky(
    lat: float | None = Query(None),
    lon: float | None = Query(None),
    lang: str = LANG_Q,
):
    """Tonight-in-the-sky digest: ISS pass, top planet, next meteor, Moon phase."""
    la, lo = _loc(lat, lon)
    return await data.get_sky(la, lo, lang)


@router.get("/neo")
async def neo(lang: str = LANG_Q):
    """Upcoming asteroid close approaches (NASA NEO feed)."""
    return await data.get_neo(lang)


@router.get("/iss/now")
async def iss_now(lang: str = LANG_Q):
    """Current ISS ground position (lat/lon/alt + country)."""
    return await data.get_iss_now(lang)


@router.get("/iss/crew")
async def iss_crew(lang: str = LANG_Q):
    """ISS crew count, expedition, and personnel."""
    return await data.get_iss_crew(lang)


@router.get("/voyager")
async def voyager():
    """Voyager 1/2 propagated distances, speeds, light-time."""
    return await data.get_voyager()


@router.get("/planets")
async def planets(
    lat: float | None = Query(None),
    lon: float | None = Query(None),
    lang: str = LANG_Q,
):
    """All naked-eye planets with current altitude/azimuth/visibility."""
    la, lo = _loc(lat, lon)
    return await data.get_planets(la, lo, lang)


@router.get("/moon")
async def moon(lang: str = LANG_Q):
    """Current Moon phase, illumination, days to next full/new."""
    return await data.get_moon(lang)


@router.get("/meteors")
async def meteors(lang: str = LANG_Q):
    """Upcoming meteor showers calendar (peak dates, ZHR, radiant, status)."""
    return await data.get_meteors(lang)


@router.get("/events")
async def events(lang: str = LANG_Q):
    """Astronomical events: eclipses, conjunctions, next eclipse, weekly digest."""
    return await data.get_events(lang)


@router.get("/mars")
async def mars():
    """Mars weather from the NASA InSight feed (sol, temps, pressure, wind)."""
    return await data.get_mars()


@router.get("/mars/rovers")
async def mars_rovers():
    """Latest Perseverance / Curiosity photos (Mars Vista API).

    Returns ``{configured, perseverance[], curiosity[]}``. Each photo is
    ``{img_src, camera, sol, earth_date, rover}``. When the API key isn't set,
    ``configured`` is false and both lists are empty (the site shows
    placeholder tiles rather than erroring).
    """
    return await data.get_mars_rovers()


@router.get("/news")
async def news(lang: str = LANG_Q):
    """Space news digest archived in MySQL with a live-parser fallback.

    Returns ``{available, items[]}``. ``available`` is false when neither the
    DB archive nor a live SpaceflightNow fetch yielded anything. Each item has
    ``id`` (DB row id; ``null`` for live-without-DB fallback entries) so the
    front can route cards with an id to the on-site article page and the rest
    out to the source.
    """
    return await data.get_news(lang)


@router.get("/news/{slug}")
async def news_article(slug: str, lang: str = LANG_Q):
    """Full article body (translated) for the on-site article page /news/<slug>.

    The slug is derived from the source article URL (see
    SpaceflightNowParser.slug_from_url). The body is fetched lazily from the
    source on first request and persisted in the DB, then cached per
    article+language. Returns ``{available:false}`` when the slug isn't in the
    archive (requires the DB). Also returns ``related[]`` (up to 3 same-category
    articles) for the «Пов'язані новини» section.
    """
    return await data.get_news_article_api(slug, lang)


@router.get("/apod")
async def apod(lang: str = LANG_Q):
    """NASA Astronomy Picture of the Day: image, title, translated explanation."""
    return await data.get_apod(lang)


@router.get("/apod/archive")
async def apod_archive(
    start: str | None = Query(None, description="Start date YYYY-MM-DD (default: 30 days ago)"),
    end: str | None = Query(None, description="End date YYYY-MM-DD (default: today)"),
    lang: str = LANG_Q,
):
    """A date range of NASA APOD entries for the photo/video gallery page.

    Defaults to the last 30 days; the span is capped at 60 days to keep the
    NASA request light. Returns ``[]`` if NASA is unreachable.
    """
    from datetime import date, timedelta

    today = date.today()
    # NASA publishes a day's APOD during that day (US time); requesting today
    # often 400s ("Date must be between Jun 16, 1995 and <yesterday>"). Default
    # the window to end yesterday so the out-of-the-box query always resolves.
    end_d = date.fromisoformat(end) if end else (today - timedelta(days=1))
    # Clamp an explicit future end to today (NASA rejects anything past "now").
    if end_d > today:
        end_d = today
    start_d = date.fromisoformat(start) if start else (end_d - timedelta(days=29))
    # Enforce ordering + a 60-day ceiling so a bad query can't pull a huge range.
    if start_d > end_d:
        start_d, end_d = end_d, start_d
    if (end_d - start_d).days > 60:
        start_d = end_d - timedelta(days=60)
    return await data.get_apod_archive(
        start_d.isoformat(), end_d.isoformat(), lang
    )


@router.get("/debris")
async def debris():
    """Curated space-debris statistics (ESA Space Environment Report)."""
    return await data.get_debris()


@router.get("/grb")
async def grb(limit: int = Query(20, ge=1, le=50)):
    """Recent gamma-ray burst alerts from NASA GCN Circulars."""
    return await data.get_grb(limit)


@router.get("/comets")
async def comets(lang: str = LANG_Q):
    """Observable comets digest: brightest now, visible catalog, orbit, famous."""
    return await data.get_comets(lang)


@router.get("/exoplanets")
async def exoplanets():
    """Exoplanet digest from the NASA Exoplanet Archive (TAP): confirmed +
    TOI candidate counts, featured planet, radius/period scatter, catalog."""
    return await data.get_exoplanets()


@router.get("/geocode")
async def geocode(q: str = Query(..., min_length=2, description="City name to search")):
    """City suggestions (Nominatim proxy) for the location picker."""
    return await data.geocode(q)


@router.get("/geocode/reverse")
async def geocode_reverse(
    lat: float = Query(..., description="Latitude from the browser geolocation API"),
    lon: float = Query(..., description="Longitude from the browser geolocation API"),
):
    """Reverse-geocode coordinates to a place label (Nominatim /reverse)."""
    return await data.reverse_geocode(lat, lon)


@router.get("/geo/ip")
async def geo_ip(request: Request):
    """Approximate location from the caller's IP — fallback when the browser
    geolocation API is unavailable, denied, or times out. Reads the client IP
    from X-Forwarded-For (when behind nginx) or the direct peer."""
    ip = (request.headers.get("x-forwarded-for") or "").split(",")[0].strip()
    if not ip:
        ip = request.client.host if request.client else ""
    res = await data.ip_geocode(ip)
    return res or {"lat": None, "lon": None, "label": None, "source": None}


@router.get("/tle")
async def tle(
    group: str = Query("iss", description="Satellite group key (iss/starlink/...)"),
    limit: int = Query(300, ge=0, le=2000, description="Cap on objects returned"),
    lang: str = LANG_Q,
):
    """TLE set for a satellite group (Celestrak), for client-side propagation."""
    return await data.get_tle(group, limit, lang)


@router.get("/tle/groups")
async def tle_groups(lang: str = LANG_Q):
    """Registry of available satellite groups for the map UI."""
    return data.tle_groups(lang)


class FeedbackPayload(BaseModel):
    name: str = Field("", max_length=120)
    email: str = Field("", max_length=200)
    message: str = Field(..., min_length=1, max_length=5000)


@router.post("/feedback")
async def feedback(payload: FeedbackPayload):
    """Site feedback form → forwarded to the owner's Telegram chat via the bot.

    Returns 503 when the bot isn't configured (no BOT_TOKEN → modal shows
    "service unavailable"), 422 on invalid input, 500 on a send failure. The
    endpoint never raises into a 5xx stack trace — failures are logged and
    returned as JSON.
    """
    # Light email sanity check (no external email-validator dependency). A
    # malformed address is just rejected; the message doesn't go out.
    email = payload.email.strip()
    if email and ("@" not in email or " " in email or len(email) < 3):
        return JSONResponse({"ok": False, "error": "bad_email"}, status_code=422)
    try:
        await send_feedback_telegram(payload.name, email, payload.message)
    except FeedbackNotConfigured:
        logger.warning("Feedback submitted but BOT_TOKEN not configured")
        return JSONResponse(
            {"ok": False, "error": "unavailable"},
            status_code=503,
        )
    except Exception as exc:  # noqa: BLE001 — send errors must not 500-stack
        logger.error("Feedback send failed: %s", exc)
        return JSONResponse(
            {"ok": False, "error": "send_failed"},
            status_code=500,
        )
    return {"ok": True}


@router.get("/mast/lightcurve")
async def mast_lightcurve(target: str = Query(..., min_length=1, description="Target name or TIC ID")):
    """TESS/Kepler lightcurve for a star."""
    return await data.get_mast_lightcurve(target)


@router.get("/mast/hubble-jwst")
async def mast_hubble_jwst():
    """Recent science observations from HST/JWST."""
    return await data.get_mast_hubble_jwst()