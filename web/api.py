"""HTTP API routes for the NEOwatch website.

Endpoints return JSON consumed by the React SPA (``my-app/src/lib/api.js``). They are thin:
authentication, formatting and caching live in ``web.data`` and the bot's
service modules. Sync service calls are offloaded to a thread pool via
``asyncio.to_thread`` so the event loop stays responsive for the bot polling.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Query

from config import DEFAULT_LAT, DEFAULT_LON
from web import data

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