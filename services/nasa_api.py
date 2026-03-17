"""NASA API Service - NEO and APOD"""
import requests
import logging
from datetime import datetime, timedelta
from config import NASA_API_KEY, NASA_NEO_URL, NASA_APOD_URL
from utils.translator import Translator

logger = logging.getLogger(__name__)


class NasaAPI:
    """NASA Open APIs client"""
    
    @staticmethod
    def get_asteroids_today():
        """Fetch near-Earth objects for today"""
        today = datetime.now().strftime('%Y-%m-%d')
        params = {
            'start_date': today,
            'end_date': today,
            'api_key': NASA_API_KEY
        }
        
        try:
            response = requests.get(NASA_NEO_URL, params=params, timeout=10)
            data = response.json()
            
            asteroids = data['near_earth_objects'].get(today, [])
            
            if not asteroids:
                return "🌌 Сьогодні немає близьких астероїдів"
            
            # Sort by distance (closest first)
            asteroids.sort(key=lambda x: float(x['close_approach_data'][0]['miss_distance']['kilometers']))
            
            return NasaAPI._format_asteroids(asteroids, today)
            
        except Exception as e:
            logger.error(f"NEO API error: {e}")
            return "❌ Не вдалося отримати дані про астероїди"
    
    @staticmethod
    def _format_asteroids(asteroids, date):
        """Format asteroids data for Telegram"""
        message = f"🌑 <b>Астероїди поблизу Землі ({date})</b>\n\n"
        message += f"Всього знайдено: <b>{len(asteroids)}</b>\n\n"

        for i, neo in enumerate(asteroids[:5], 1):
            name = neo['name']
            diameter = neo['estimated_diameter']['meters']
            diameter_min = int(diameter['estimated_diameter_min'])
            diameter_max = int(diameter['estimated_diameter_max'])

            approach = neo['close_approach_data'][0]
            distance_km = float(approach['miss_distance']['kilometers'])
            distance_km_str = f"{distance_km:,.0f}".replace(',', ' ')

            velocity = float(approach['relative_velocity']['kilometers_per_hour'])

            is_hazardous = neo['is_potentially_hazardous_asteroid']
            hazard_emoji = "⚠️ НЕБЕЗПЕЧНИЙ" if is_hazardous else "✅ Безпечний"

            message += f"{i}. <b>{name}</b>\n"
            message += f"   📏 {diameter_min}-{diameter_max} м\n"
            message += f"   📍 {distance_km_str} км від Землі\n"
            message += f"   🚀 {velocity:,.0f} км/год\n".replace(',', ' ')
            message += f"   {hazard_emoji}\n\n"

        return message

    @staticmethod
    def get_hazardous_asteroids():
        """Fetch potentially hazardous asteroids for today and next 6 days"""
        today = datetime.now()
        today_str = today.strftime('%Y-%m-%d')
        end_date = (today + timedelta(days=6)).strftime('%Y-%m-%d')

        params = {
            'start_date': today_str,
            'end_date': end_date,
            'api_key': NASA_API_KEY
        }

        try:
            response = requests.get(NASA_NEO_URL, params=params, timeout=10)
            data = response.json()

            hazardous = []
            for date_str, asteroids in data.get('near_earth_objects', {}).items():
                for neo in asteroids:
                    if neo['is_potentially_hazardous_asteroid']:
                        hazardous.append({
                            'id': neo['id'],
                            'name': neo['name'],
                            'approach_date': date_str,
                            'miss_distance_km': float(neo['close_approach_data'][0]['miss_distance']['kilometers']),
                            'diameter_min': int(neo['estimated_diameter']['meters']['estimated_diameter_min']),
                            'diameter_max': int(neo['estimated_diameter']['meters']['estimated_diameter_max']),
                            'velocity': float(neo['close_approach_data'][0]['relative_velocity']['kilometers_per_hour']),
                            'url': neo.get('nasa_jpl_url', '')
                        })

            # Sort by distance (closest first)
            hazardous.sort(key=lambda x: x['miss_distance_km'])
            return hazardous

        except Exception as e:
            logger.error(f"NEO hazardous API error: {e}")
            return []
    
    @staticmethod
    def get_apod():
        """Fetch Astronomy Picture of the Day"""
        try:
            params = {
                'api_key': NASA_API_KEY,
                'thumbs': 'True'
            }
            logger.info(f"Fetching APOD from {NASA_APOD_URL}")
            response = requests.get(NASA_APOD_URL, params=params, timeout=10)
            logger.info(f"APOD response status: {response.status_code}")
            
            if response.status_code != 200:
                logger.error(f"APOD API error: {response.status_code} - {response.text[:200]}")
                return None
            
            data = response.json()
            logger.info(f"APOD data received: media_type={data.get('media_type')}, title={data.get('title', 'N/A')[:30]}")
            
            return {
                'title': data.get('title', ''),
                'date': data.get('date', ''),
                'explanation': data.get('explanation', ''),
                'url': data.get('url', ''),
                'hdurl': data.get('hdurl', ''),
                'media_type': data.get('media_type', 'image'),
                'thumbnail': data.get('thumbnail_url', '')
            }
            
        except Exception as e:
            logger.error(f"APOD API error: {e}")
            return None
    
    @staticmethod
    def format_apod(data):
        """Format APOD for Telegram (returns photo + text separately for long captions)"""
        title = data['title']
        date = data['date']
        explanation = data['explanation']
        
        # Translate explanation to Ukrainian
        explanation_uk = Translator.translate_apod(explanation)
        
        # Short caption for photo
        caption = f"🌌 <b>Фото дня від NASA</b>\n\n"
        caption += f"📅 {date}\n"
        caption += f"📷 {title}\n\n"
        caption += "<i>Повний опис нижче ↓</i>"
        
        # Full text message
        full_text = f"🌌 <b>{title}</b>\n"
        full_text += f"📅 {date}\n\n"
        
        # Truncate explanation if too long
        if len(explanation_uk) > 3800:
            explanation_uk = explanation_uk[:3800] + "..."
        full_text += explanation_uk
        full_text += "\n\n🌐 apod.nasa.gov"
        
        image_url = data.get('hdurl') or data.get('url', '')
        
        return {
            'image': image_url,
            'caption': caption,
            'text': full_text
        }
