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
    def get_upcoming_launches():
        """Get upcoming launches (Launch Library API → spaceflightnow.com)"""
        try:
            # Try Launch Library API first
            params = {
                'limit': 7,
                'mode': 'detailed',
                'ordering': 'net'
            }
            
            response = requests.get(LAUNCH_LIBRARY_URL, params=params, timeout=15)
            
            if response.status_code == 429:
                logger.warning("Launch Library API throttled, using fallback")
                return SpaceflightNowParser.get_launches()
            
            response.raise_for_status()
            data = response.json()
            
            if 'results' not in data or not data['results']:
                return SpaceflightNowParser.get_launches()
            
            return LaunchAPI._format_launches(data['results'][:7])
            
        except Exception as e:
            logger.error(f"Launch API error: {e}")
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
        """Get status emoji for launch"""
        statuses = {
            0: '🟡 TBD Дата',
            1: '🟡 TBD Час',
            2: '🟢 Go',
            3: '🟠 Hold',
            4: '🔴 Скасовано',
            5: '🔵 В польоті',
            6: '✅ Успіх',
            7: '🟠 Часткова невдача',
            8: '🔴 Невдача'
        }
        return statuses.get(status_id, '—')
