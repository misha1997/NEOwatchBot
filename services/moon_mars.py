"""Moon phases and Mars weather"""
import requests
import logging
import math
from datetime import datetime

logger = logging.getLogger(__name__)

class MoonMarsAPI:
    """Moon phases and Mars weather API"""
    
    @staticmethod
    def get_moon_phase():
        """Calculate current moon phase"""
        try:
            now = datetime.now()
            
            # Moon phase calculation (simplified algorithm)
            # New moon reference: 2000-01-06 18:14 UTC
            year = now.year
            month = now.month
            day = now.day
            
            # Convert to Julian day
            if month < 3:
                year -= 1
                month += 12
            
            a = math.floor(year / 100)
            b = 2 - a + math.floor(a / 4)
            jd = math.floor(365.25 * (year + 4716)) + math.floor(30.6001 * (month + 1)) + day + b - 1524.5
            
            # Days since known new moon (2000-01-06)
            days_since_new = jd - 2451549.5
            
            # Moon synodic period (29.53 days)
            synodic = 29.53058867
            
            # Calculate current phase (0 = new, 0.5 = full, 1 = new)
            phase = (days_since_new % synodic) / synodic
            
            # Determine phase name and emoji
            phase_names = [
                (0.00, 0.03, "🌑 Новий Місяць", "new"),
                (0.03, 0.22, "🌒 Молода Місяць", "waxing_crescent"),
                (0.22, 0.28, "🌓 Перша чверть", "first_quarter"),
                (0.28, 0.47, "🌔 Прибуваючий Місяць", "waxing_gibbous"),
                (0.47, 0.53, "🌕 Повний Місяць", "full"),
                (0.53, 0.72, "🌖 Спадаючий Місяць", "waning_gibbous"),
                (0.72, 0.78, "🌗 Остання чверть", "last_quarter"),
                (0.78, 0.97, "🌘 Стара Місяць", "waning_crescent"),
                (0.97, 1.00, "🌑 Новий Місяць", "new"),
            ]
            
            phase_name = "🌑 Місяць"
            illumination = 0
            
            for start, end, name, phase_type in phase_names:
                if start <= phase < end or (start == 0.97 and phase >= 0.97):
                    phase_name = name
                    # Calculate illumination percentage
                    if phase <= 0.5:
                        illumination = (phase / 0.5) * 100
                    else:
                        illumination = ((1 - phase) / 0.5) * 100
                    break
            
            # Find next full moon
            days_to_full = ((0.5 - phase) % 1) * synodic
            next_full = days_to_full if days_to_full < synodic/2 else days_to_full - synodic
            next_full = next_full if next_full > 0 else days_to_full + synodic/2
            
            # Find next new moon
            days_to_new = ((1 - phase) % 1) * synodic
            
            return {
                'phase_name': phase_name,
                'illumination': round(illumination, 1),
                'phase_percent': round(phase * 100, 1),
                'days_to_full': round(next_full, 1) if next_full > 0 else round(days_to_full, 1),
                'days_to_new': round(days_to_new, 1)
            }
            
        except Exception as e:
            logger.error(f"Moon phase error: {e}")
            return None
    
    @staticmethod
    def get_mars_weather():
        """Get Mars weather (using NASA InSight last data or Perseverance)"""
        try:
            # InSight stopped transmitting in Dec 2022
            # Use NASA MAAS API (Mars Atmospheric Aggregation System) if available
            # Or return static info with last known typical conditions
            
            # Try to get from NASA API
            url = "https://api.nasa.gov/insight_weather/"
            params = {'api_key': 'DEMO_KEY', 'feedtype': 'json', 'ver': '1.0'}
            
            try:
                response = requests.get(url, params=params, timeout=10)
                if response.status_code == 200:
                    data = response.json()
                    if 'sol_keys' in data and data['sol_keys']:
                        latest_sol = data['sol_keys'][-1]
                        sol_data = data[latest_sol]
                        
                        temp_high = sol_data.get('AT', {}).get('mx')
                        temp_low = sol_data.get('AT', {}).get('mn')
                        pressure = sol_data.get('PRE', {}).get('av')
                        
                        if temp_high and temp_low:
                            return {
                                'source': 'InSight',
                                'sol': latest_sol,
                                'temp_high': round(temp_high, 1),
                                'temp_low': round(temp_low, 1),
                                'pressure': round(pressure, 1) if pressure else None,
                                'season': 'dusty'  # Mars is often dusty
                            }
            except:
                pass
            
            # Fallback - return typical Mars conditions
            return {
                'source': 'avg',
                'temp_high': -10,
                'temp_low': -80,
                'pressure': 610,
                'season': 'typical'
            }
            
        except Exception as e:
            logger.error(f"Mars weather error: {e}")
            return None
    
    @staticmethod
    def format_moon_mars_message():
        """Format combined moon and mars message"""
        moon = MoonMarsAPI.get_moon_phase()
        mars = MoonMarsAPI.get_mars_weather()
        
        message = "🌙 <b>Місяць та Марс</b>\n\n"
        
        # Moon section
        if moon:
            message += f"{moon['phase_name']}\n"
            message += f"💡 Освітленість: {moon['illumination']}%\n"
            
            if moon['days_to_full'] < 15:
                message += f"🌕 Повний Місяць через: {moon['days_to_full']} дн.\n"
            else:
                message += f"🌑 Новий Місяць через: {moon['days_to_new']} дн.\n"
            
            message += "\n"
        
        # Mars section
        if mars:
            message += "🔴 <b>Погода на Марсі</b>\n"
            
            if mars.get('source') == 'InSight':
                message += f"Сол {mars['sol']} (марсіанський день)\n"
            
            message += f"🌡️ Температура: {mars['temp_low']}°C ... {mars['temp_high']}°C\n"
            
            if mars.get('pressure'):
                message += f"💨 Тиск: {mars['pressure']} Па\n"
            
            message += "☀️ Сезон: місцевий літній" if mars['temp_high'] > -20 else "❄️ Сезон: місцевий зимовий"
            message += "\n"
        
        return message
