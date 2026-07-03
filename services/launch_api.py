"""Launch API Service - Rocket launches with fallback"""
import requests
import logging
from datetime import datetime
from parsers.spaceflightnow import SpaceflightNowParser
from utils.i18n import t, DEFAULT_LANG

logger = logging.getLogger(__name__)

LAUNCH_LIBRARY_URL = "https://ll.thespacedevs.com/2.3.0/launches/upcoming/"


class LaunchAPI:
    """Rocket launch data with fallback chain"""

    @staticmethod
    def get_raw_launches():
        """Get raw upcoming launches data from Launch Library API.

        Returns dict with 'results' list or None on failure.
        """
        try:
            params = {
                'limit': 10,
                'mode': 'detailed',
                'ordering': 'net'
            }

            response = requests.get(LAUNCH_LIBRARY_URL, params=params, timeout=15)

            if response.status_code == 429:
                logger.warning("Launch Library API throttled")
                return None

            response.raise_for_status()
            data = response.json()

            if 'results' not in data or not data['results']:
                logger.warning("Launch Library API returned no results")
                return None

            return data

        except Exception as e:
            logger.error(f"Launch API error: {e}")
            return None

    @staticmethod
    def get_upcoming_launches(lang=DEFAULT_LANG):
        """Get upcoming launches (Launch Library API → spaceflightnow.com)"""
        raw = LaunchAPI.get_raw_launches()
        if raw:
            return LaunchAPI._format_launches(raw['results'][:7], lang)
        return SpaceflightNowParser.get_launches(lang)

    @staticmethod
    def _format_launches(launches, lang=DEFAULT_LANG):
        """Format Launch Library data for Telegram"""
        message = t('launch.title', lang)
        unknown = t('launch.unknown', lang)

        for i, launch in enumerate(launches, 1):
            name = launch.get('name') or unknown
            lsp = launch.get('lsp_name') or unknown
            rocket = launch.get('rocket', {}).get('configuration', {}).get('name') or unknown

            pad = launch.get('pad', {})
            location = pad.get('location', {}).get('name') or unknown
            pad_name = pad.get('name', '')

            net = launch.get('net', '')
            date_str = LaunchAPI._format_launch_date(net)

            status_id = launch.get('status', {}).get('id', 0)
            status = LaunchAPI._get_status_emoji(status_id, lang)

            message += t('launch.entry', lang, i=i, name=name, rocket=rocket, lsp=lsp, location=location)
            if pad_name and pad_name != 'Unknown Pad':
                message += t('launch.pad_line', lang, pad=pad_name)
            message += t('launch.date_line', lang, date=date_str)
            message += t('launch.status_line', lang, status=status)

        return {'text': message, 'image': None}

    @staticmethod
    def _format_launch_date(net):
        """Format launch date string"""
        if not net:
            return 'TBD'
        try:
            if 'T' in net:
                dt = datetime.fromisoformat(net.replace('Z', '+00:00'))
                return dt.strftime('%d.%m.%Y %H:%M UTC')
            return net
        except:
            return net[:16] if net else 'TBD'

    @staticmethod
    def _get_status_emoji(status_id, lang=DEFAULT_LANG):
        """Get status label for launch (Launch Library 2.3.0 status IDs)."""
        key = f'launch.status.{status_id}'
        # status.1..9 exist; anything else falls back to .default
        return t(key if status_id in range(1, 10) else 'launch.status.default', lang)
