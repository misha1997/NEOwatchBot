"""N2YO API Service - ISS and satellite tracking"""
import requests
import logging
from datetime import datetime, timedelta
from config import N2YO_API_KEY, N2YO_BASE_URL, ISS_NORAD_ID
from utils.constants import COUNTRY_BBOXES

logger = logging.getLogger(__name__)


class N2YOAPI:
    """N2YO satellite tracking API client"""
    
    @staticmethod
    def get_iss_position():
        """Get current ISS position and country"""
        try:
            url = f"{N2YO_BASE_URL}/positions/{ISS_NORAD_ID}/0/0/0/1"
            params = {'apiKey': N2YO_API_KEY}
            
            response = requests.get(url, params=params, timeout=10)
            data = response.json()
            
            if 'positions' not in data or not data['positions']:
                return "❌ Не вдалося отримати позицію МКС"
            
            pos = data['positions'][0]
            lat = pos['satlatitude']
            lon = pos['satlongitude']
            alt = pos['sataltitude']
            
            country = N2YOAPI._get_country_from_coords(lat, lon)
            
            message = "🛰️ <b>МКС зараз</b>\n\n"
            message += f"📍 Координати:\n"
            message += f"   🌐 {lat:.4f}° {'Пн' if lat >= 0 else 'Пд'} широти\n"
            message += f"   🌐 {lon:.4f}° {'Сх' if lon >= 0 else 'Зх'} довготи\n"
            message += f"   🏔️ Висота: {alt:.1f} км\n\n"
            
            if country.startswith('🌊'):
                message += f"🌍 Розташування: {country}\n\n"
            else:
                message += f"🌍 Над територією: {country}\n\n"
            
            # Get next passes over default location
            lat_s = f"{lat:.2f}"
            lon_s = f"{lon:.2f}"
            maps_link = f"https://www.google.com/maps?q={lat_s},{lon_s}"
            message += f"🗺️ <a href='{maps_link}'>Переглянути на мапі</a>"
            
            return message
            
        except Exception as e:
            logger.error(f"ISS position error: {e}")
            return "❌ Помилка при отриманні позиції МКС"
    
    @staticmethod
    def _get_country_from_coords(lat, lon):
        """Determine country from coordinates using bounding boxes"""
        for country_emoji, bbox in COUNTRY_BBOXES.items():
            min_lon, min_lat, max_lon, max_lat = bbox
            if min_lon <= lon <= max_lon and min_lat <= lat <= max_lat:
                return country_emoji
        return "🌊 Над водою (океан)"
    
    @staticmethod
    def get_iss_passes(lat, lon, alt=0):
        """Get ISS passes for given location"""
        try:
            url = f"{N2YO_BASE_URL}/visualpasses/{ISS_NORAD_ID}/{lat}/{lon}/{alt}/10/60"
            params = {'apiKey': N2YO_API_KEY}
            
            response = requests.get(url, params=params, timeout=10)
            data = response.json()
            
            if 'passes' not in data or not data['passes']:
                return "🛰️ У найближчі 10 днів видимих проходів не передбачається"
            
            passes = data['passes'][:5]
            return N2YOAPI._format_passes(passes)
            
        except Exception as e:
            logger.error(f"ISS passes error: {e}")
            return "❌ Не вдалося отримати дані про проходження"
    
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
    def _format_passes(passes):
        """Format ISS passes for Telegram"""
        message = "🛰️ <b>Найближчі проходження МКС</b>\n\n"
        
        for i, p in enumerate(passes, 1):
            start_time = datetime.fromtimestamp(p['startUTC'])
            end_time = datetime.fromtimestamp(p['endUTC'])
            duration = p['duration']
            
            message += f"{i}. 📅 {start_time.strftime('%d.%m.%Y')}\n"
            message += f"   🕐 {start_time.strftime('%H:%M')} - {end_time.strftime('%H:%M')}\n"
            message += f"   ⏱️ Тривалість: {duration} сек\n"
            message += f"   🔆 Яскравість: магнітуда {p['mag']:.1f}\n\n"
        
        return message
    
    @staticmethod
    def get_starlink_passes(lat, lon, alt=0, days=7):
        """Get Starlink passes for given location"""
        try:
            from config import STARLINK_NORAD_IDS
            
            all_passes = []
            for sat_id in STARLINK_NORAD_IDS[:5]:  # Limit to first 5
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
                return "🛰️ У найближчі дні видимих проходжень Starlink не передбачається"
            
            # Sort by time and take first 5
            all_passes.sort(key=lambda x: x['startUTC'])
            return N2YOAPI._format_starlink_passes(all_passes[:5])
            
        except Exception as e:
            logger.error(f"Starling passes error: {e}")
            return "❌ Не вдалося отримати дані про проходження Starlink"
    
    @staticmethod
    def _format_starlink_passes(passes):
        """Format Starlink passes for Telegram"""
        message = "🛰️ <b>Проходження Starlink</b>\n"
        message += "<i>(ланцюжок супутників)</i>\n\n"
        
        for i, p in enumerate(passes, 1):
            start_time = datetime.fromtimestamp(p['startUTC'])
            
            message += f"{i}. 📅 {start_time.strftime('%d.%m.%Y %H:%M')}\n"
            message += f"   🔆 Яскравість: магнітуда {p['mag']:.1f}\n"
            message += f"   📍 Макс. висота: {p['maxEl']}°\n\n"
        
        return message
