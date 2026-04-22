"""Launch API Service - Rocket launches with fallback"""
import requests
import logging
from datetime import datetime
from parsers.spaceflightnow import SpaceflightNowParser

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
    def get_upcoming_launches():
        """Get upcoming launches (Launch Library API → spaceflightnow.com)"""
        raw = LaunchAPI.get_raw_launches()
        if raw:
            return LaunchAPI._format_launches(raw['results'][:7])
        return SpaceflightNowParser.get_launches()
    
    @staticmethod
    def _format_launches(launches):
        """Format Launch Library data for Telegram"""
        message = "🚀 <b>Найближчі запуски ракет</b>\n\n"
        
        for i, launch in enumerate(launches, 1):
            name = launch.get('name', 'Невідомо')
            lsp = launch.get('lsp_name', 'Невідомо')
            rocket = launch.get('rocket', {}).get('configuration', {}).get('name', 'Невідомо')
            
            pad = launch.get('pad', {})
            location = pad.get('location', {}).get('name', 'Невідомо')
            pad_name = pad.get('name', '')
            
            net = launch.get('net', '')
            date_str = LaunchAPI._format_launch_date(net)
            
            status_id = launch.get('status', {}).get('id', 0)
            status = LaunchAPI._get_status_emoji(status_id)
            
            message += f"{i}. 📅 <b>{name}</b>\n"
            message += f"   🚀 {rocket} | {lsp}\n"
            message += f"   📍 {location}\n"
            if pad_name and pad_name != 'Unknown Pad':
                message += f"   🎯 {pad_name}\n"
            message += f"   ⏰ {date_str}\n"
            message += f"   📊 {status}\n\n"
        
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
    def _get_status_emoji(status_id):
        """Get status emoji for launch (Launch Library 2.3.0 status IDs)."""
        statuses = {
            1: '🟢 Go for Launch',
            2: '🟡 TBD',
            3: '🟠 Hold',
            4: '🔵 In Flight',
            5: '🟠 Partial Failure',
            6: '🔴 Failure',
            7: '✅ Success',
            8: '🟡 To Be Confirmed',
            9: '🟢 Payload Deployed',
        }
        return statuses.get(status_id, '—')
