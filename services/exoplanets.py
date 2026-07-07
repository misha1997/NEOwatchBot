"""Exoplanets — live digest from the NASA Exoplanet Archive (TAP API).

The archive exposes a synchronous TAP endpoint that takes an ADQL query and
returns JSON:

    https://exoplanetarchive.ipac.caltech.edu/TAP/sync?query=<ADQL>&format=json

We pull two tables:

* ``pscomppars`` (Planetary Systems, Composite Parameters) — one row per
  confirmed exoplanet with the archive's default/merged parameters. Used for
  the "confirmed" list, the hero counts, the scatter chart and the featured
  "planet of the week".
* ``toi`` (TESS Objects of Interest) — TESS planet candidates. We filter to
  ``tfopwg_disp='PC'`` (planet candidate) for the candidate count and the
  "Кандидат" rows in the catalog table.

Distances come back in parsecs (``sy_dist`` / ``st_dist``); we convert to
light-years on the way out (×3.26156) for display. The page is cached for an
hour (``web/data.EXO_TTL``), so we make at most a handful of TAP requests per
hour regardless of traffic.
"""
from __future__ import annotations

import logging
import urllib.parse
from datetime import date

import requests

logger = logging.getLogger(__name__)

TAP_URL = "https://exoplanetarchive.ipac.caltech.edu/TAP/sync"
PC_TO_LY = 3.26156  # parsecs → light-years

# Number of rows to pull from each table. More than the page shows so the
# scatter chart has some spread; the catalog table trims to ~8.
_CONFIRMED_LIMIT = 40
_CANDIDATE_LIMIT = 30
_CATALOG_ROWS = 8
_SCATTER_ROWS = 24

# Confirmed planets: newest discoveries that have a radius + period. A
# ``disc_year`` floor keeps the TAP ``ORDER BY`` deterministic on the huge
# pscomppars view (without it the TOP-N over the full table returns stale
# Kepler rows even though newer ones exist).
_CONFIRMED_QUERY = (
    "SELECT TOP {lim} pl_name, hostname, pl_rade, pl_orbper, sy_dist, "
    "pl_eqt, st_teff, st_mass, disc_year, disc_facility "
    "FROM pscomppars "
    "WHERE pl_rade IS NOT NULL AND pl_orbper IS NOT NULL "
    "AND disc_year >= 2020 "
    "ORDER BY disc_year DESC, pl_name"
)

# Confirmed planet count.
_CONFIRMED_COUNT_QUERY = "SELECT count(*) AS n FROM pscomppars"

# TESS candidates (planet candidates only), newest by archive row update.
_CANDIDATE_QUERY = (
    "SELECT TOP {lim} toidisplay, pl_rade, pl_orbper, st_dist, st_teff, "
    "pl_eqt, rowupdate "
    "FROM toi WHERE tfopwg_disp='PC' AND pl_rade IS NOT NULL "
    "ORDER BY rowupdate DESC"
)

# TESS planet-candidate count.
_CANDIDATE_COUNT_QUERY = "SELECT count(*) AS n FROM toi WHERE tfopwg_disp='PC'"

# Featured "planet of the week": the nearest confirmed, roughly Earth-to-
# sub-Neptune sized planet in the habitable zone (equilibrium temp 180–310 K).
# Falls back to the newest confirmed list if the archive has none matching.
_FEATURED_QUERY = (
    "SELECT TOP 1 pl_name, hostname, pl_rade, pl_orbper, sy_dist, pl_eqt, "
    "st_teff, st_mass, disc_year, disc_facility "
    "FROM pscomppars "
    "WHERE pl_rade IS NOT NULL AND pl_eqt IS NOT NULL "
    "AND pl_eqt BETWEEN 180 AND 310 AND pl_rade <= 2.0 "
    "AND sy_dist IS NOT NULL "
    "ORDER BY sy_dist"
)


def _tap(query: str) -> list:
    """Run an ADQL query against the TAP sync endpoint, return the JSON rows."""
    url = TAP_URL + "?query=" + urllib.parse.quote(query) + "&format=json"
    try:
        resp = requests.get(url, timeout=25,
                            headers={"User-Agent": "NEOwatch/1.0"})
        resp.raise_for_status()
        return resp.json()
    except Exception as e:
        logger.warning("Exoplanet Archive TAP error: %s", e)
        return []


def _num(v, digits=None):
    if v is None or v == "":
        return None
    try:
        f = float(v)
    except (TypeError, ValueError):
        return None
    return round(f, digits) if digits is not None else f


def _ly(pc):
    """Parsecs → light-years (rounded to 1), or None."""
    d = _num(pc)
    return None if d is None else round(d * PC_TO_LY)


def _habitability(eqt) -> str:
    """Rough habitability bucket from equilibrium temperature (K)."""
    t = _num(eqt)
    if t is None:
        return "unknown"
    if 180 <= t <= 310:
        return "habitable"
    if 120 <= t < 180 or 310 < t <= 400:
        return "edge"
    return "hot" if t > 400 else "cold"


def _confirmed_row(r: dict) -> dict:
    rade = _num(r.get("pl_rade"), 2)
    return {
        "name": r.get("pl_name") or "—",
        "host": r.get("hostname") or "—",
        "radius": rade,                       # Earth radii
        "period": _num(r.get("pl_orbper"), 2),  # days
        "distance_ly": _ly(r.get("sy_dist")),
        "teq": _num(r.get("pl_eqt"), 0),        # K, equilibrium temp
        "st_teff": _num(r.get("st_teff"), 0),
        "st_mass": _num(r.get("st_mass"), 2),
        "disc_year": r.get("disc_year"),
        "facility": r.get("disc_facility") or "",
        "confirmed": True,
        "habitability": _habitability(r.get("pl_eqt")),
    }


def _candidate_row(r: dict) -> dict:
    return {
        "name": r.get("toidisplay") or "—",
        "host": (r.get("toidisplay") or "").split(".")[0],
        "radius": _num(r.get("pl_rade"), 2),
        "period": _num(r.get("pl_orbper"), 2),
        "distance_ly": _ly(r.get("st_dist")),
        "teq": _num(r.get("pl_eqt"), 0),
        "st_teff": _num(r.get("st_teff"), 0),
        "st_mass": None,
        "disc_year": None,
        "facility": "TESS",
        "confirmed": False,
        "habitability": _habitability(r.get("pl_eqt")),
    }


def _pick_featured(confirmed: list) -> dict | None:
    """Planet of the week: prefer a small, temperate, nearby confirmed planet;
    fall back to the newest, then to the first row."""
    if not confirmed:
        return None
    # temperate (eqt 180–310 K), Earth-to-sub-Neptune radius, nearest first
    temperate = [c for c in confirmed
                if c["habitability"] == "habitable"
                and c["radius"] is not None and c["radius"] <= 2.5
                and c["distance_ly"] is not None]
    temperate.sort(key=lambda c: (c["distance_ly"], c["radius"]))
    if temperate:
        return temperate[0]
    # newest by disc_year, smallest radius first
    by_year = sorted(confirmed,
                     key=lambda c: (-(c["disc_year"] or 0),
                                     c["radius"] or 99))
    return by_year[0]


class ExoplanetAPI:
    """Live exoplanet digest for the website (NASA Exoplanet Archive TAP)."""

    @staticmethod
    def get_exoplanets() -> dict:
        confirmed_rows = _tap(_CONFIRMED_QUERY.format(lim=_CONFIRMED_LIMIT))
        candidate_rows = _tap(_CANDIDATE_QUERY.format(lim=_CANDIDATE_LIMIT))

        confirmed = [_confirmed_row(r) for r in confirmed_rows]
        candidates = [_candidate_row(r) for r in candidate_rows]

        confirmed_count = None
        cc = _tap(_CONFIRMED_COUNT_QUERY)
        if cc:
            confirmed_count = cc[0].get("n")

        candidate_count = None
        ck = _tap(_CANDIDATE_COUNT_QUERY)
        if ck:
            candidate_count = ck[0].get("n")

        # Featured: nearest temperate Earth-ish planet if the archive has one,
        # else the newest confirmed from the pulled list.
        featured = None
        feat_rows = _tap(_FEATURED_QUERY)
        if feat_rows:
            featured = _confirmed_row(feat_rows[0])
        if featured is None:
            featured = _pick_featured(confirmed)

        # Scatter: confirmed + candidates, radius vs period (log-ish spread).
        scatter = []
        for c in confirmed[:_SCATTER_ROWS // 2]:
            if c["radius"] and c["period"]:
                scatter.append({"name": c["name"], "radius": c["radius"],
                                "period": c["period"], "confirmed": True})
        for c in candidates[:_SCATTER_ROWS - len(scatter)]:
            if c["radius"] and c["period"]:
                scatter.append({"name": c["name"], "radius": c["radius"],
                                "period": c["period"], "confirmed": False})

        # Catalog table: newest confirmed + a couple of candidates.
        catalog = confirmed[:max(1, _CATALOG_ROWS - 2)] + candidates[:2]
        # Keep the catalog readable: trim long TESS facility names.
        for row in catalog:
            if row["facility"].startswith("Transiting Exoplanet Survey"):
                row["facility"] = "TESS"

        return {
            "confirmed_count": confirmed_count,
            "candidate_count": candidate_count,
            "featured": featured,
            "scatter": scatter,
            "catalog": catalog,
            "updated": date.today().isoformat(),
            "source": "NASA Exoplanet Archive",
            "source_url": "https://exoplanetarchive.ipac.caltech.edu/",
        }