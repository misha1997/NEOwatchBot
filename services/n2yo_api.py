"""N2YO API Service - ISS and satellite tracking"""
import requests
import logging
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from config import N2YO_API_KEY, N2YO_BASE_URL, ISS_NORAD_ID
from utils.constants import COUNTRY_BBOXES, country_name
from utils.i18n import t, lat_hemi, lon_hemi, DEFAULT_LANG

KYIV_TZ = ZoneInfo('Europe/Kyiv')

logger = logging.getLogger(__name__)


class N2YOAPI:
    """N2YO satellite tracking API client"""

    @staticmethod
    def get_iss_position(lang=DEFAULT_LANG):
        """Get current ISS position and country"""
        try:
            url = f"{N2YO_BASE_URL}/positions/{ISS_NORAD_ID}/0/0/0/1"
            params = {'apiKey': N2YO_API_KEY}

            response = requests.get(url, params=params, timeout=10)
            data = response.json()

            if 'positions' not in data or not data['positions']:
                return t('iss.position_error', lang)

            pos = data['positions'][0]
            lat = pos['satlatitude']
            lon = pos['satlongitude']
            alt = pos['sataltitude']

            country = N2YOAPI._get_country_from_coords(lat, lon, lang)

            message = t('iss.now_title', lang)
            message += t('iss.coords', lang)
            message += t('iss.lat_line', lang, lat=f'{lat:.4f}', hemi=lat_hemi(lat, lang))
            message += t('iss.lon_line', lang, lon=f'{lon:.4f}', hemi=lon_hemi(lon, lang))
            message += t('iss.altitude', lang, alt=f'{alt:.1f}')

            if country.startswith('🌊'):
                message += t('iss.location', lang, country=country)
            else:
                message += t('iss.over_location', lang, country=country)

            # Get next passes over default location
            lat_s = f"{lat:.2f}"
            lon_s = f"{lon:.2f}"
            maps_link = f"https://www.google.com/maps?q={lat_s},{lon_s}"
            message += t('iss.view_map', lang, link=maps_link)

            return message

        except Exception as e:
            logger.error(f"ISS position error: {e}")
            return t('iss.position_api_error', lang)

    @staticmethod
    def _is_in_ukraine(lat, lon) -> bool:
        """True if (lat, lon) falls inside Ukraine's bounding box.

        Longitude alone (22-40°E) isn't enough — that band also crosses
        Finland, Romania, Turkey, Egypt, Kenya, etc. — so latitude must be
        checked too before labelling pass times "Kyiv time".
        """
        if lat is None or lon is None:
            return False
        min_lon, min_lat, max_lon, max_lat = COUNTRY_BBOXES['🇺🇦 Україна']
        return min_lon <= lon <= max_lon and min_lat <= lat <= max_lat

    @staticmethod
    def _get_country_from_coords(lat, lon, lang=DEFAULT_LANG):
        """Determine country from coordinates using bounding boxes"""
        for country_key, bbox in COUNTRY_BBOXES.items():
            min_lon, min_lat, max_lon, max_lat = bbox
            if min_lon <= lon <= max_lon and min_lat <= lat <= max_lat:
                return country_name(country_key, lang)
        return t('country.ocean', lang)

    @staticmethod
    def get_iss_passes(lat, lon, alt=0, lang=DEFAULT_LANG):
        """Get ISS passes for given location"""
        try:
            url = f"{N2YO_BASE_URL}/visualpasses/{ISS_NORAD_ID}/{lat}/{lon}/{alt}/10/60"
            params = {'apiKey': N2YO_API_KEY}

            response = requests.get(url, params=params, timeout=10)
            data = response.json()

            if 'passes' not in data or not data['passes']:
                return t('iss.no_passes', lang)

            passes = data['passes'][:5]
            return N2YOAPI._format_passes(passes, lat, lon, lang)

        except Exception as e:
            logger.error(f"ISS passes error: {e}")
            return t('iss.passes_error', lang)

    @staticmethod
    def get_iss_passes_raw(lat, lon, alt=0, days=10):
        """Get ISS passes raw data for scheduler"""
        try:
            url = f"{N2YO_BASE_URL}/visualpasses/{ISS_NORAD_ID}/{lat}/{lon}/{alt}/{days}/60"
            params = {'apiKey': N2YO_API_KEY}

            response = requests.get(url, params=params, timeout=10)
            data = response.json()

            return data

        except Exception as e:
            logger.error(f"ISS passes raw error: {e}")
            return None

    @staticmethod
    def _format_passes(passes, lat=None, lon=None, lang=DEFAULT_LANG):
        """Format ISS passes for Telegram"""
        message = t('iss.passes_title', lang)

        is_ukraine = N2YOAPI._is_in_ukraine(lat, lon)

        from datetime import timezone as dt_timezone, timedelta
        if is_ukraine or lat is None or lon is None:
            tz = KYIV_TZ
            tz_label = t('kyiv_time', lang)
        else:
            offset_hours = round(lon / 15.0)
            tz = dt_timezone(timedelta(hours=offset_hours))
            sign = "+" if offset_hours >= 0 else ""
            tz_label = f" (UTC{sign}{offset_hours})"

        for i, p in enumerate(passes, 1):
            start_utc = datetime.fromtimestamp(p['startUTC'], tz=timezone.utc)
            end_utc = datetime.fromtimestamp(p['endUTC'], tz=timezone.utc)
            start_local = start_utc.astimezone(tz)
            end_local = end_utc.astimezone(tz)
            duration = p['duration']

            message += t('iss.pass_date', lang, i=i, date=start_local.strftime('%d.%m.%Y'))
            message += t('iss.pass_time', lang,
                         start=start_local.strftime('%H:%M'),
                         end=end_local.strftime('%H:%M'),
                         kyiv=tz_label)
            message += t('iss.pass_duration', lang, dur=duration)
            message += t('iss.pass_mag', lang, mag=f"{p['mag']:.1f}")

        return message

    @staticmethod
    def get_starlink_passes(lat, lon, alt=0, days=7, lang=DEFAULT_LANG):
        """Get Starlink passes for given location"""
        try:
            from web.cache import get_or_fetch
            from config import STARLINK_NORAD_IDS

            key = f"starlink_passes:{round(lat,2)}:{round(lon,2)}:{lang}"
            ttl = 3600  # 1 hour

            def fetch():
                all_passes = []
                for sat_id in STARLINK_NORAD_IDS[:10]:
                    url = f"{N2YO_BASE_URL}/visualpasses/{sat_id}/{lat}/{lon}/{alt}/{days}/60"
                    params = {'apiKey': N2YO_API_KEY}
                    try:
                        response = requests.get(url, params=params, timeout=5)
                        data = response.json()
                        if 'passes' in data and data['passes']:
                            for p in data['passes']:
                                p['sat_id'] = sat_id
                                all_passes.append(p)
                    except:
                        continue
                return all_passes

            passes_data = get_or_fetch(key, ttl, fetch)

            if not passes_data:
                return t('starlink.no_passes', lang)

            # Sort by time and take first 5
            passes_data.sort(key=lambda x: x['startUTC'])
            return N2YOAPI._format_starlink_passes(passes_data[:5], lat, lon, lang)

        except Exception as e:
            logger.error(f"Starlink passes error: {e}")
            return t('starlink.error', lang)

    @staticmethod
    def _format_starlink_passes(passes, lat=None, lon=None, lang=DEFAULT_LANG):
        """Format Starlink passes for Telegram"""
        message = t('starlink.title', lang)

        is_ukraine = N2YOAPI._is_in_ukraine(lat, lon)

        from datetime import timezone as dt_timezone, timedelta
        if is_ukraine or lat is None or lon is None:
            tz = KYIV_TZ
            tz_label = t('kyiv_time', lang)
        else:
            offset_hours = round(lon / 15.0)
            tz = dt_timezone(timedelta(hours=offset_hours))
            sign = "+" if offset_hours >= 0 else ""
            tz_label = f" (UTC{sign}{offset_hours})"

        for i, p in enumerate(passes, 1):
            start_utc = datetime.fromtimestamp(p['startUTC'], tz=timezone.utc)
            start_local = start_utc.astimezone(tz)

            message += t('starlink.item', lang, i=i,
                          date=start_local.strftime('%d.%m.%Y %H:%M'),
                          kyiv=tz_label, mag=f"{p['mag']:.1f}", el=p['maxEl'])

        return message