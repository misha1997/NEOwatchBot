"""Saturn data: live geocentric distance + next opposition event + moons catalog."""
from datetime import datetime, timezone

_OPPOSITION_DATES = [
    "2026-08-27", "2027-09-09", "2028-09-21", "2029-10-04", "2030-10-17",
]

_RAW_MOONS = [
    ("Pan", 133583.0, 0.000, 0.0, 0.0, 0.575, 28.2, "inner", "Пан"),
    ("Daphnis", 136505.0, 0.000, 0.0, 0.0, 0.594, 7.6, "inner", "Дафніс"),
    ("Atlas", 137670.0, 0.001, 0.0, 0.0, 0.602, 30.2, "inner", "Атлас"),
    ("Prometheus", 139380.0, 0.002, 0.0, 0.0, 0.613, 86.2, "inner", "Прометей"),
    ("Pandora", 141720.0, 0.004, 0.0, 0.0, 0.628, 81.4, "inner", "Пандора"),
    ("Epimetheus", 151410.0, 0.010, 0.0, 0.3, 0.694, 116.2, "inner", "Епіметей"),
    ("Janus", 151460.0, 0.007, 0.0, 0.2, 0.695, 179.0, "inner", "Янус"),
    ("Mimas", 185540.0, 0.020, 0.0, 1.5, 0.942, 396.4, "main", "Мімас"),
    ("Enceladus", 238040.0, 0.005, 0.0, 0.0, 1.370, 504.2, "main", "Енцелад"),
    ("Tethys", 294670.0, 0.000, 0.0, 1.1, 1.888, 1062.0, "main", "Тефія"),
    ("Telesto", 294670.0, 0.000, 0.0, 1.2, 1.888, 24.8, "trojan", "Телесто"),
    ("Calypso", 294670.0, 0.000, 0.0, 1.5, 1.888, 21.4, "trojan", "Каліпсо"),
    ("Dione", 377420.0, 0.002, 0.0, 0.0, 2.737, 1122.8, "main", "Діона"),
    ("Helene", 377420.0, 0.002, 0.0, 0.2, 2.737, 35.2, "trojan", "Гелена"),
    ("Polydeuces", 377420.0, 0.019, 0.0, 0.2, 2.737, 2.6, "trojan", "Полідевк"),
    ("Rhea", 527070.0, 0.001, 0.0, 0.3, 4.518, 1527.0, "main", "Рея"),
    ("Titan", 1221870.0, 0.029, 0.0, 0.3, 15.945, 5149.5, "titan", "Титан"),
    ("Hyperion", 1500930.0, 0.104, 0.0, 0.6, 21.276, 270.0, "main", "Гіперіон"),
    ("Iapetus", 3560840.0, 0.029, 0.0, 15.5, 79.321, 1469.0, "main", "Япет"),
    ("Kiviuq", 11294800.0, 0.329, 0.0, 46.1, 448.16, 16.0, "inuit", "Ківіок"),
    ("Ijiraq", 11355316.0, 0.292, 0.0, 49.1, 451.77, 12.0, "inuit", "Іджирак"),
    ("Phoebe", 12940600.0, 0.164, 0.0, 175.2, 550.31, 213.0, "norse", "Феба"),
    ("Paaliaq", 15103400.0, 0.364, 0.0, 45.1, 687.08, 22.0, "inuit", "Паліак"),
    ("Skathi", 15672500.0, 0.328, 0.0, 152.7, 727.69, 8.0, "norse", "Скаді"),
    ("Albiorix", 16266700.0, 0.479, 0.0, 34.0, 783.5, 32.0, "gallic", "Альбіорікс"),
    ("S/2007 S 2", 16560000.0, 0.218, 0.0, 176.7, 792.96, 6.0, "norse", "S/2007 S 2"),
    ("Bebhionn", 17153520.0, 0.333, 0.0, 40.5, 838.38, 6.0, "gallic", "Бевіон"),
    ("Erriapus", 17236900.0, 0.472, 0.0, 34.5, 871.1, 10.0, "gallic", "Ерріапух"),
    ("Skoll", 17561000.0, 0.463, 0.0, 161.2, 869.0, 6.0, "norse", "Сколл"),
    ("Siarnaq", 17776600.0, 0.296, 0.0, 45.6, 895.55, 40.0, "inuit", "Сіарнак"),
    ("Tarqeq", 17910600.0, 0.108, 0.0, 49.9, 894.86, 7.0, "inuit", "ҋаркек"),
    ("Greip", 18065700.0, 0.374, 0.0, 172.7, 937.0, 6.0, "norse", "Грейп"),
    ("Hyrrokkin", 18168300.0, 0.336, 0.0, 151.4, 931.8, 8.0, "norse", "Бірроккін"),
    ("Jarnsaxa", 18556900.0, 0.192, 0.0, 162.9, 943.7, 6.0, "norse", "Ярнсакса"),
    ("Tarvos", 18562800.0, 0.531, 0.0, 33.8, 926.2, 15.0, "gallic", "Тарвос"),
    ("Mundilfari", 18725800.0, 0.210, 0.0, 167.3, 951.6, 7.0, "norse", "Мундільфарі"),
    ("Bergelmir", 19104000.0, 0.152, 0.0, 157.9, 1005.7, 6.0, "norse", "Бергельмѕр"),
    ("Narvi", 19395200.0, 0.320, 0.0, 137.3, 1003.9, 7.0, "norse", "Нарві"),
    ("Aegir", 19618400.0, 0.237, 0.0, 166.7, 1025.9, 6.0, "norse", "Егѕр"),
    ("Kari", 22093000.0, 0.478, 0.0, 156.3, 1230.9, 7.0, "norse", "Карі"),
    ("Fenrir", 22454000.0, 0.136, 0.0, 164.9, 1260.3, 4.0, "norse", "Фенрір"),
    ("Surtur", 22707000.0, 0.451, 0.0, 169.7, 1297.4, 6.0, "norse", "Сурт"),
    ("Ymir", 22754000.0, 0.335, 0.0, 173.1, 1315.4, 18.0, "norse", "Імір"),
    ("Loge", 22984300.0, 0.187, 0.0, 167.9, 1312.0, 6.0, "norse", "Логі"),
    ("Fornjot", 24504900.0, 0.206, 0.0, 170.4, 1494.2, 6.0, "norse", "Форньйот"),
]

MOONS_CATALOG = []
for name, a_km, e, M_deg, i_deg, P_days, dia_km, group, name_uk in _RAW_MOONS:
    MOONS_CATALOG.append({
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


def _earth_saturn_distance_km() -> float | None:
    """Live geocentric distance to Saturn, via skyfield."""
    try:
        from services.planets import _get_skyfield
        eph, ts, _wgs84, _cm, _latin = _get_skyfield()
        t = ts.now()
        earth, saturn = eph[399], eph[6]
        d = earth.at(t).observe(saturn).distance()
        return d.km
    except Exception:
        return None


_C_KM_S = 299792.458


def get_saturn() -> dict:
    """Return live Saturn distance, light time, next opposition, and moons catalog."""
    now = datetime.now(timezone.utc)
    dist_km = _earth_saturn_distance_km()
    light_time_min = (dist_km / _C_KM_S / 60.0) if dist_km is not None else None
    return {
        "now_ms": int(now.timestamp() * 1000),
        "distance_km": float(dist_km) if dist_km is not None else None,
        "light_time_min": float(light_time_min) if light_time_min is not None else None,
        "opposition_next_iso": _next_opposition(now),
        "moons_count": 146,
        "moons": MOONS_CATALOG,
    }
