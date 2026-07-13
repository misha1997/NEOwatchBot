"""NASA API Service - NEO and APOD"""
import requests
import logging
from datetime import datetime, timedelta
from config import NASA_API_KEY, NASA_NEO_URL, NASA_APOD_URL
from utils.translator import Translator
from utils.i18n import t, DEFAULT_LANG

logger = logging.getLogger(__name__)


class NasaAPI:
    """NASA Open APIs client"""

    @staticmethod
    def get_asteroids_today(lang: str = DEFAULT_LANG):
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
                return t('neo.none_today', lang)

            # Sort by distance (closest first)
            asteroids.sort(key=lambda x: float(x['close_approach_data'][0]['miss_distance']['kilometers']))

            return NasaAPI._format_asteroids(asteroids, today, lang)

        except Exception as e:
            logger.error(f"NEO API error: {e}")
            return t('neo.api_error', lang)

    @staticmethod
    def _format_asteroids(asteroids, date, lang=DEFAULT_LANG):
        """Format asteroids data for Telegram"""
        message = t('neo.today_title', lang, date=date)
        message += t('neo.found', lang, n=len(asteroids))

        for i, neo in enumerate(asteroids[:5], 1):
            name = neo['name']
            diameter = neo['estimated_diameter']['meters']
            diameter_min = int(diameter['estimated_diameter_min'])
            diameter_max = int(diameter['estimated_diameter_max'])

            approach = neo['close_approach_data'][0]
            distance_km = float(approach['miss_distance']['kilometers'])
            distance_km_str = f"{distance_km:,.0f}".replace(',', ' ')

            velocity = float(approach['relative_velocity']['kilometers_per_hour'])
            velocity_str = f"{velocity:,.0f}".replace(',', ' ')

            is_hazardous = neo['is_potentially_hazardous_asteroid']
            hazard_label = t('neo.hazardous', lang) if is_hazardous else t('neo.safe', lang)

            message += t('neo.item', lang, i=i, name=name,
                         min=diameter_min, max=diameter_max,
                         dist=distance_km_str, vel=velocity_str,
                         hazard=hazard_label)

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
    def get_apod_archive(start_date: str, end_date: str):
        """Fetch a date range of APOD entries (NASA APOD supports ``start_date``
        + ``end_date``; with a range the API returns a JSON array).

        Each entry mirrors ``get_apod`` plus ``thumbnail`` and the raw
        ``copyright`` field. Returns ``[]`` on any error so the site can render
        an empty archive instead of crashing.
        """
        try:
            params = {
                'api_key': NASA_API_KEY,
                'start_date': start_date,
                'end_date': end_date,
                'thumbs': 'True',
            }
            logger.info(f"Fetching APOD archive {start_date}..{end_date}")
            response = requests.get(NASA_APOD_URL, params=params, timeout=15)
            if response.status_code != 200:
                logger.error(f"APOD archive API error: {response.status_code} - {response.text[:200]}")
                return []
            data = response.json()
            if not isinstance(data, list):
                # Single-day response is a dict — normalise to a one-item list.
                data = [data] if isinstance(data, dict) else []
            out = []
            for d in data:
                if not isinstance(d, dict):
                    continue
                media_type = d.get('media_type', 'image')
                out.append({
                    'title': d.get('title', ''),
                    'date': d.get('date', ''),
                    'explanation': d.get('explanation', '') or '',
                    'url': d.get('url', ''),
                    'hdurl': d.get('hdurl', '') or d.get('url', ''),
                    'media_type': media_type,
                    'thumbnail': d.get('thumbnail_url', '') or '',
                    'copyright': d.get('copyright', '') or '',
                })
            # Most-recent first (NASA returns oldest→newest).
            out.sort(key=lambda x: x['date'], reverse=True)
            return out
        except Exception as e:
            logger.error(f"APOD archive API error: {e}")
            return []

    @staticmethod
    def format_apod(data, lang=DEFAULT_LANG):
        """Format APOD for Telegram (returns photo + text separately for long captions)"""
        title = data['title']
        date = data['date']
        explanation = data['explanation']

        # Translate explanation (no-op for English users)
        explanation_tr = Translator.translate_apod(explanation, lang)

        # Short caption for photo
        caption = t('apod.caption', lang, date=date, title=title)

        # Full text message
        full_text = t('apod.full_apod', lang, title=title, date=date, explanation='')

        # Truncate explanation if too long
        if len(explanation_tr) > 3800:
            explanation_tr = explanation_tr[:3800] + "..."
        full_text = f"🌌 <b>{title}</b>\n📅 {date}\n\n{explanation_tr}\n\n🌐 apod.nasa.gov"

        # For image APODs: prefer the HD url, fall back to the standard url.
        # For video APODs: `url` is a YouTube embed link, which Telegram's
        # send_video rejects ("Wrong type of the web page content"). Use the
        # thumbnail as the photo and expose the video link separately so the
        # scheduler can send a photo + a clickable link instead.
        media_type = data.get('media_type', 'image')
        video_url = data.get('url', '') if media_type == 'video' else ''
        if media_type == 'video':
            image_url = data.get('thumbnail_url') or data.get('url', '')
        else:
            image_url = data.get('hdurl') or data.get('url', '')

        return {
            'image': image_url,
            'caption': caption,
            'text': full_text,
            'video_url': video_url,
        }