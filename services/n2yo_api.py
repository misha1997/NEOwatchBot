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
            return N2YOAPI._format_passes(passes, lang)

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
    def _format_passes(passes, lang=DEFAULT_LANG):
        """Format ISS passes for Telegram"""
        message = t('iss.passes_title', lang)
        kyiv = t('kyiv_time', lang)

        for i, p in enumerate(passes, 1):
            start_utc = datetime.fromtimestamp(p['startUTC'], tz=timezone.utc)
            end_utc = datetime.fromtimestamp(p['endUTC'], tz=timezone.utc)
            start_kyiv = start_utc.astimezone(KYIV_TZ)
            end_kyiv = end_utc.astimezone(KYIV_TZ)
            duration = p['duration']

            message += t('iss.pass_date', lang, i=i, date=start_kyiv.strftime('%d.%m.%Y'))
            message += t('iss.pass_time', lang,
                         start=start_kyiv.strftime('%H:%M'),
                         end=end_kyiv.strftime('%H:%M'),
                         kyiv=kyiv)
            message += t('iss.pass_duration', lang, dur=duration)
            message += t('iss.pass_mag', lang, mag=f"{p['mag']:.1f}")

        return message

    @staticmethod
    def get_starlink_passes(lat, lon, alt=0, days=7, lang=DEFAULT_LANG):
        """Get Starlink passes for given location"""
        try:
            from config import STARLINK_NORAD_IDS

            all_passes = []
            for sat_id in STARLINK_NORAD_IDS[:10]:  # Check first 10 satellites
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

            if not all_passes:
                return t('starlink.no_passes', lang)

            # Sort by time and take first 5
            all_passes.sort(key=lambda x: x['startUTC'])
            return N2YOAPI._format_starlink_passes(all_passes[:5], lang)

        except Exception as e:
            logger.error(f"Starling passes error: {e}")
            return t('starlink.error', lang)

    @staticmethod
    def _format_starlink_passes(passes, lang=DEFAULT_LANG):
        """Format Starlink passes for Telegram"""
        message = t('starlink.title', lang)
        kyiv = t('kyiv_time', lang)

        for i, p in enumerate(passes, 1):
            start_utc = datetime.fromtimestamp(p['startUTC'], tz=timezone.utc)
            start_kyiv = start_utc.astimezone(KYIV_TZ)

            message += t('starlink.item', lang, i=i,
                          date=start_kyiv.strftime('%d.%m.%Y %H:%M'),
                          kyiv=kyiv, mag=f"{p['mag']:.1f}", el=p['maxEl'])

        return message