"""Mercury data: live geocentric distance + next greatest elongation."""
from datetime import datetime, timezone

# Greatest elongation dates for Mercury in 2026 and 2027
# (ISO dates, approximation times set to 18:00 UTC for Evening/Eastern and 06:00 UTC for Morning/Western)
_ELONGATIONS = [
    # 2026
    ("2026-02-19T18:00:00Z", "eastern", "вечірня", "evening"),
    ("2026-04-03T06:00:00Z", "western", "ранкова", "morning"),
    ("2026-06-15T18:00:00Z", "eastern", "вечірня", "evening"),
    ("2026-08-02T06:00:00Z", "western", "ранкова", "morning"),
    ("2026-10-12T18:00:00Z", "eastern", "вечірня", "evening"),
    ("2026-11-20T06:00:00Z", "western", "ранкова", "morning"),
    # 2027
    ("2027-02-03T18:00:00Z", "eastern", "вечірня", "evening"),
    ("2027-03-17T06:00:00Z", "western", "ранкова", "morning"),
    ("2027-05-28T18:00:00Z", "eastern", "вечірня", "evening"),
    ("2027-07-15T06:00:00Z", "western", "ранкова", "morning"),
    ("2027-09-24T18:00:00Z", "eastern", "вечірня", "evening"),
    ("2027-11-04T06:00:00Z", "western", "ранкова", "morning"),
]


def _next_elongation(now: datetime) -> dict | None:
    for iso, etype, name_uk, name_en in _ELONGATIONS:
        # Parse ISO (e.g., "2026-08-02T06:00:00Z")
        dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
        if dt > now:
            return {
                "date_iso": iso,
                "type": etype,
                "name_uk": name_uk,
                "name_en": name_en,
            }
    return None


def _earth_mercury_distance_km() -> float | None:
    """Live geocentric distance to Mercury, via skyfield."""
    try:
        from services.planets import _get_skyfield
        eph, ts, _wgs84, _cm, _latin = _get_skyfield()
        t = ts.now()
        earth, mercury = eph[399], eph[199]
        d = earth.at(t).observe(mercury).distance()
        return d.km
    except Exception:
        return None


_C_KM_S = 299792.458


def get_mercury() -> dict:
    """Return live Mercury distance, light time, next elongation details."""
    now = datetime.now(timezone.utc)
    dist_km = _earth_mercury_distance_km()
    light_time_min = (dist_km / _C_KM_S / 60.0) if dist_km is not None else None
    elong = _next_elongation(now)
    return {
        "now_ms": int(now.timestamp() * 1000),
        "distance_km": dist_km,
        "light_time_min": light_time_min,
        "elongation_next": elong,
    }
