"""Visible planets — topocentric positions via skyfield (JPL DE440s).

Computes each planet's altitude/azimuth, IAU constellation, above-horizon
visibility and an approximate apparent visual magnitude for an observer at the
given latitude/longitude. The ephemeris and constellation tables are loaded
lazily and cached for the process lifetime; the first call downloads
``de440s.bsp`` (~32 MB) and the constellation table into ``data/``.
"""
import os
import math
import logging
import numpy as np
from utils.i18n import t, compass_dir, DEFAULT_LANG

logger = logging.getLogger(__name__)

# JPL DE ephemeris: de440s.bsp. The small ("s") file carries Mercury/Venus/
# Earth/Moon/Sun directly and the outer planets as barycenters — fine for
# angular position (barycenter ≈ planet center to arcseconds).
_EPHEMERIS = "de440s.bsp"

# Planet name key (i18n) -> SPK target id in de440s.bsp
TARGETS = [
    ("mercury", 199),
    ("venus", 299),
    ("mars", 4),
    ("jupiter", 5),
    ("saturn", 6),
    ("uranus", 7),
    ("neptune", 8),
]

# Emoji per planet for display.
_EMOJI = {
    "mercury": "☿️", "venus": "♀️", "mars": "🔴", "jupiter": "🟠",
    "saturn": "🪐", "uranus": "🔵", "neptune": "🔹",
}

# IAU constellation abbreviations the planets can occupy (the 13 zodiacal
# band, incl. Ophiuchus) mapped to Ukrainian + English names. Anything outside
# this set falls back to the Latin name from skyfield's name table.
_CONST = {
    "Ari": ("Овен", "Aries"), "Tau": ("Телець", "Taurus"),
    "Gem": ("Близнюки", "Gemini"), "Cnc": ("Рак", "Cancer"),
    "Leo": ("Лев", "Leo"), "Vir": ("Діва", "Virgo"),
    "Lib": ("Терези", "Libra"), "Sco": ("Скорпіон", "Scorpius"),
    "Oph": ("Змієносець", "Ophiuchus"), "Sgr": ("Стрілець", "Sagittarius"),
    "Cap": ("Козоріг", "Capricornus"), "Aqr": ("Водолій", "Aquarius"),
    "Psc": ("Риби", "Pisces"),
}

_SKF = None  # cached (eph, ts, wgs84, constellation_map, latin_names)


def _data_dir():
    here = os.path.dirname(os.path.abspath(__file__))
    return os.path.normpath(os.path.join(here, "..", "data"))


def _get_skyfield():
    """Lazily load and cache skyfield assets."""
    global _SKF
    if _SKF is not None:
        return _SKF
    from skyfield.api import Loader, wgs84, load_constellation_map, load_constellation_names
    load = Loader(_data_dir())
    eph = load(_EPHEMERIS)
    ts = load.timescale()
    cm = load_constellation_map()
    latin = {abbr: name for abbr, name in load_constellation_names()}
    _SKF = (eph, ts, wgs84, cm, latin)
    return _SKF


def _az_to_code(az_deg):
    """Convert azimuth degrees to the nearest 8-point compass code."""
    idx = int(round(az_deg / 45.0)) % 8
    return ("N", "NE", "E", "SE", "S", "SW", "W", "NW")[idx]


def _const_name(abbr, lang, latin):
    entry = _CONST.get(abbr)
    if entry:
        return entry[1] if lang == "en" else entry[0]
    return latin.get(abbr, abbr)


def _magnitude(planet_key, r, delta, i_deg):
    """Approximate apparent visual magnitude.

    r = Sun-planet distance (AU), delta = Earth-planet distance (AU),
    i = phase angle Sun-planet-Earth (deg). Mercury & Venus use the
    Hilton/Mallama (2018) polynomials in (i/100) adopted by The Astronomical
    Almanac; the outer planets use the standard Harris phase terms (i in
    degrees). Saturn's ring-tilt term is omitted (approximation, noted in UI).
    """
    log = 5.0 * math.log10(r * delta)
    x = i_deg / 100.0
    if planet_key == "mercury":
        return -0.60 + 4.98 * x - 4.88 * x * x + 3.02 * x ** 3 + log
    if planet_key == "venus":
        if 163.6 < i_deg <= 170.2:  # forward-scattering "tail"
            return 0.98 - 1.02 * x + log
        return -4.47 + 1.03 * x + 0.57 * x * x + 0.13 * x ** 3 + log
    if planet_key == "mars":
        return -1.52 + log + 0.016 * i_deg
    if planet_key == "jupiter":
        return -9.25 + log + 0.005 * i_deg
    if planet_key == "saturn":
        return -8.88 + log + 0.004 * i_deg  # ring tilt term omitted
    if planet_key == "uranus":
        return -7.19 + log + 0.002 * i_deg
    if planet_key == "neptune":
        return -6.87 + log
    return 0.0


class PlanetsAPI:
    """Visible-planets computation for an observer location."""

    @staticmethod
    def compute(lat, lon):
        """Return list of dicts {name_key, alt, az, mag, constellation, visible}.

        Raises on hard failure; caller wraps in try/except.
        """
        eph, ts, wgs84, cm, latin = _get_skyfield()
        t = ts.now()
        earth, sun = eph[399], eph[10]
        observer = earth + wgs84.latlon(lat, lon)
        evec = earth.at(t).position.au

        out = []
        for key, tid in TARGETS:
            body = eph[tid]
            app = observer.at(t).observe(body).apparent()
            alt, az, d = app.altaz()
            alt_deg = alt.degrees

            r = body.at(t).distance().au
            delta = d.au

            # Phase angle Sun-planet-Earth via heliocentric vectors.
            pvec = body.at(t).position.au
            ps = -pvec
            pe = evec - pvec
            cos_i = float(np.dot(ps, pe) / (np.linalg.norm(ps) * np.linalg.norm(pe)))
            cos_i = max(-1.0, min(1.0, cos_i))
            i_deg = math.degrees(math.acos(cos_i))

            mag = _magnitude(key, r, delta, i_deg)
            try:
                abbr = cm(app)
            except Exception:
                abbr = ""
            out.append({
                "name_key": key,
                "alt": alt_deg,
                "az": az.degrees,
                "mag": mag,
                "constellation": abbr,
                "visible": alt_deg > 0.0,
            })
        return out

    @staticmethod
    def get_visible(lat, lon, lang=DEFAULT_LANG):
        """Format the visible-planets message for the user."""
        try:
            eph, ts, wgs84, cm, latin = _get_skyfield()
            rows = PlanetsAPI.compute(lat, lon)
            visible = [r for r in rows if r["visible"]]
            below = [r for r in rows if not r["visible"]]

            msg = t('planets.title', lang)
            if not visible:
                msg += t('planets.none_visible', lang)
            else:
                msg += t('planets.intro', lang)
                for r in visible:
                    name = t(f'planets.name.{r["name_key"]}', lang)
                    const = _const_name(r["constellation"], lang, latin)
                    az_code = _az_to_code(r["az"])
                    az_dir = compass_dir(az_code, lang)
                    msg += t('planets.entry', lang,
                              emoji=_EMOJI.get(r["name_key"], "🪐"),
                              name=name, const=const,
                              alt=f'{r["alt"]:.0f}',
                              az_dir=az_dir, az=f'{r["az"]:.0f}',
                              mag=f'{r["mag"]:.1f}')
            if below:
                names = ", ".join(t(f'planets.name.{r["name_key"]}', lang) for r in below)
                msg += t('planets.below', lang, list=names)
            msg += t('planets.source', lang)
            return msg
        except Exception as e:
            logger.error(f"Planets error: {e}")
            return t('planets.error', lang)