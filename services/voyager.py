"""Voyager 1/2 status — distance from a reference epoch + curated facts.

JPL's DE ephemerides do not carry the Voyager spacecraft, and the live DSN
distance feed is not a stable public JSON API. We instead propagate each
probe's heliocentric distance from a reference epoch using its known recession
velocity — accurate to well within 1% over years — and pair it with the
well-established mission facts. Everything is labelled "≈" so it never claims
DSN-grade precision.
"""
from datetime import datetime, timezone
import logging
from utils.i18n import t, DEFAULT_LANG

logger = logging.getLogger(__name__)

C_KM_S = 299_792.458
AU_KM = 149_597_870.7

# Reference epoch + heliocentric distance at that epoch + recession velocity.
# Distances are heliocentric (Sun-centered); Earth's distance varies by ±1 AU
# as it orbits, which we note rather than compute (no Voyager direction angle).
# Figures rounded from NASA/JPL status pages, epoch 2025-01-01 UTC.
_PROBES = {
    1: {
        "epoch": datetime(2025, 1, 1, tzinfo=timezone.utc),
        "dist_km": 24_800_000_000,
        "velocity_km_s": 17.0,
        "interstellar_date": "25.08.2012",
    },
    2: {
        "epoch": datetime(2025, 1, 1, tzinfo=timezone.utc),
        "dist_km": 20_800_000_000,
        "velocity_km_s": 15.3,
        "interstellar_date": "05.11.2018",
    },
}


def _fmt_km(n: float) -> str:
    return f"{n:,.0f}".replace(",", " ")


class VoyagerAPI:
    """Voyager 1 / 2 status (approximate, propagated from reference epoch)."""

    @staticmethod
    def get_status(which: int = 1, lang: str = DEFAULT_LANG) -> str:
        try:
            probe = _PROBES.get(which) or _PROBES[1]
            now = datetime.now(timezone.utc)
            seconds = (now - probe["epoch"]).total_seconds()
            helio_km = probe["dist_km"] + probe["velocity_km_s"] * seconds
            helio_au = helio_km / AU_KM
            light_hours = helio_km / C_KM_S / 3600.0

            msg = t('voyager.title', lang, n=which)
            msg += t('voyager.distance', lang, km=_fmt_km(helio_km), au=f"{helio_au:,.1f}".replace(",", " "))
            msg += t('voyager.light_time', lang, h=f"{light_hours:.1f}")
            msg += t('voyager.speed', lang, v=f"{probe['velocity_km_s']:.1f}")
            msg += t('voyager.interstellar', lang, date=probe["interstellar_date"])
            msg += t('voyager.status', lang)
            msg += t('voyager.note', lang)
            msg += t('voyager.source', lang)
            return msg
        except Exception as e:
            logger.error(f"Voyager status error: {e}")
            return t('voyager.error', lang)