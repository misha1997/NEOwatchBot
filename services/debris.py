"""Space debris statistics — curated ESA figures.

ESA (and NASA/LEO population models) publish debris statistics as periodic
reports, not a live JSON feed. The numbers below are the widely-cited ESA
estimates as of the 2024 Space Environment Report; they drift only slowly, so
we hard-code them with a clear date stamp and a source link rather than scrape
a fragile page. Update the block annually (or when ESA releases a new report).
"""
import logging
from utils.i18n import t, DEFAULT_LANG

logger = logging.getLogger(__name__)

# Reference: ESA Space Environment Report 2024 (figures rounded).
# https://www.esa.int/Space_Safety/Space_Debris/Space_debris_by_the_numbers
_DATA = {
    "year_ref": "2024",
    "tracked": 36000,        # objects >10 cm routinely tracked
    "cm1": 1_000_000,        # objects >=1 cm estimated
    "cm01": 130_000_000,     # objects >=1 mm estimated
    "total_mass_t": 13000,   # tonnes on orbit
    "breakups": 640,         # in-orbit breakups/explosions on record
    "source_url": "https://www.esa.int/Space_Safety/Space_Debris/Space_debris_by_the_numbers",
}


class SpaceDebrisAPI:
    """Curated space-debris statistics."""

    @staticmethod
    def get_stats_dict() -> dict:
        """Structured debris stats for the website (curated ESA figures)."""
        return {
            "year_ref": _DATA["year_ref"],
            "tracked": _DATA["tracked"],
            "cm1": _DATA["cm1"],
            "cm01": _DATA["cm01"],
            "total_mass_t": _DATA["total_mass_t"],
            "breakups": _DATA["breakups"],
            "source_url": _DATA["source_url"],
        }

    @staticmethod
    def get_stats(lang: str = DEFAULT_LANG) -> str:
        try:
            d = _DATA
            msg = t('debris.title', lang)
            msg += t('debris.tracked', lang, v=f"{d['tracked']:,}".replace(",", " "))
            msg += t('debris.cm1', lang, v=f"{d['cm1']:,}".replace(",", " "))
            msg += t('debris.cm01', lang, v=f"{d['cm01']:,}".replace(",", " "))
            msg += t('debris.mass', lang, v=f"{d['total_mass_t']:,}".replace(",", " "))
            msg += t('debris.breakups', lang, v=f"{d['breakups']}")
            msg += t('debris.note', lang, year=d['year_ref'])
            msg += t('debris.source', lang, url=d['source_url'])
            return msg
        except Exception as e:
            logger.error(f"Debris stats error: {e}")
            return t('debris.error', lang)