"""Neptune data: live geocentric distance + next opposition event + moons catalog."""
from datetime import datetime, timezone

_OPPOSITION_DATES = [
    "2026-09-26", "2027-09-28", "2028-09-30", "2029-10-02", "2030-10-05",
]

_RAW_MOONS = [
    ("Naiad", 48227.0, 0.0004, 120.0, 4.74, 0.294396, 66.0, "inner", "Наяда"),
    ("Thalassa", 50075.0, 0.0002, 45.0, 0.21, 0.311485, 82.0, "inner", "Таласса"),
    ("Despina", 52526.0, 0.0002, 190.0, 0.07, 0.334655, 150.0, "inner", "Деспіна"),
    ("Galatea", 61953.0, 0.0001, 280.0, 0.06, 0.428745, 176.0, "inner", "Галатея"),
    ("Larissa", 73548.0, 0.0014, 310.0, 0.20, 0.554654, 194.0, "inner", "Ларисса"),
    ("Hippocamp", 105283.0, 0.0000, 0.0, 0.00, 0.9362, 18.0, "inner", "Гіпокамп"),
    ("Proteus", 117647.0, 0.0005, 15.0, 0.55, 1.122315, 420.0, "inner", "Протей"),
    ("Triton", 354759.0, 0.0000, 87.0, 156.885, 5.876854, 2706.8, "triton", "Тритон"),
    ("Nereid", 5513400.0, 0.7512, 220.0, 7.23, 360.1362, 340.0, "nereid", "Нереїда"),
    ("Halimede", 15728000.0, 0.5711, 110.0, 134.1, 1879.71, 62.0, "outer", "Галімеда"),
    ("Sao", 22422000.0, 0.2931, 25.0, 48.5, 2914.07, 44.0, "outer", "Сао"),
    ("Laomedeia", 23571000.0, 0.42, 140.0, 34.7, 3167.85, 42.0, "outer", "Лаомедея"),
    ("Psamathe", 46696000.0, 0.4496, 335.0, 137.4, 9115.91, 38.0, "outer", "Псамафа"),
    ("Neso", 48387000.0, 0.4947, 185.0, 132.6, 9373.99, 60.0, "outer", "Несо"),
    ("S/2002 N 5", 23360200.0, 0.54, 0.0, 37.0, 3141.0, 23.0, "outer", "S/2002 N 5"),
    ("S/2021 N 1", 50624000.0, 0.44, 0.0, 134.0, 10018.0, 14.0, "outer", "S/2021 N 1"),
]

NEPTUNE_MOONS = []
for name, a_km, e, M_deg, i_deg, P_days, dia_km, group, name_uk in _RAW_MOONS:
    NEPTUNE_MOONS.append({
        "name": name,
        "name_uk": name_uk,
        "group": group,
        "a_km": a_km,
        "period_d": P_days,
        "e": e,
        "i_deg": i_deg,
        "prograde": i_deg < 90.0,
        "m0_deg": M_deg,
        "diameter_km": dia_km,
    })


def _next_opposition(now: datetime) -> str:
    today = now.date().isoformat()
    for d in _OPPOSITION_DATES:
        if d >= today:
            return d
    return _OPPOSITION_DATES[-1]


def _earth_neptune_distance_km() -> float | None:
    """Live geocentric distance to Neptune, via skyfield."""
    try:
        from services.planets import _get_skyfield
        eph, ts, _wgs84, _cm, _latin = _get_skyfield()
        t = ts.now()
        earth, nep = eph[399], eph[8]
        d = earth.at(t).observe(nep).distance()
        return d.km
    except Exception:
        return None


_C_KM_S = 299792.458


def get_neptune() -> dict:
    """Return live Neptune distance, light time, next opposition, and moons catalog."""
    now = datetime.now(timezone.utc)
    dist_km = _earth_neptune_distance_km()
    light_time_min = (dist_km / _C_KM_S / 60.0) if dist_km is not None else None
    return {
        "now_ms": int(now.timestamp() * 1000),
        "distance_km": float(dist_km) if dist_km is not None else None,
        "light_time_min": float(light_time_min) if light_time_min is not None else None,
        "opposition_next_iso": _next_opposition(now),
        "moons_count": len(NEPTUNE_MOONS),
        "moons": NEPTUNE_MOONS,
    }
