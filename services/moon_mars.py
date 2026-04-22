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
            
            for start, end, name, _ in phase_names:
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
        """Get Mars weather from NASA InSight API"""
        try:
            url = "https://mars.nasa.gov/rss/api/?feed=weather&category=insight_temperature&feedtype=json"

            response = requests.get(url, timeout=15)
            if response.status_code != 200:
                logger.error(f"Mars API error: HTTP {response.status_code}")
                return None

            data = response.json()

            if 'sol_keys' not in data or not data['sol_keys']:
                logger.error("Mars API: No sol data available")
                return None

            # Get the latest sol with data
            latest_sol = data['sol_keys'][-1]
            sol_data = data[latest_sol]

            # Extract temperature data (AT = Atmospheric Temperature)
            at_data = sol_data.get('AT', {})
            temp_avg = at_data.get('av')
            temp_min = at_data.get('mn')
            temp_max = at_data.get('mx')
            temp_samples = at_data.get('ct', 0)

            # Extract pressure data (PRE = Pressure)
            pre_data = sol_data.get('PRE', {})
            pressure_avg = pre_data.get('av')
            pressure_min = pre_data.get('mn')
            pressure_max = pre_data.get('mx')

            # Extract wind speed data (HWS = Horizontal Wind Speed)
            hws_data = sol_data.get('HWS', {})
            wind_avg = hws_data.get('av')
            wind_min = hws_data.get('mn')
            wind_max = hws_data.get('mx')

            # Extract wind direction (WD = Wind Direction)
            wd_data = sol_data.get('WD', {})
            most_common_wind = wd_data.get('most_common', {})
            wind_direction = most_common_wind.get('compass_point', 'N/A')
            wind_direction_deg = most_common_wind.get('compass_degrees', 0)

            # Extract season info
            season = sol_data.get('Season', 'Unknown')
            northern_season = sol_data.get('Northern_season', 'Unknown')
            southern_season = sol_data.get('Southern_season', 'Unknown')

            # Extract timestamps
            first_utc = sol_data.get('First_UTC', '')
            last_utc = sol_data.get('Last_UTC', '')

            # Parse dates for display
            first_date = ''
            last_date = ''
            if first_utc:
                try:
                    first_date = first_utc.split('T')[0]
                except:
                    pass
            if last_utc:
                try:
                    last_date = last_utc.split('T')[0]
                except:
                    pass

            return {
                'sol': latest_sol,
                'temp_avg': round(temp_avg, 1) if temp_avg else None,
                'temp_min': round(temp_min, 1) if temp_min else None,
                'temp_max': round(temp_max, 1) if temp_max else None,
                'temp_samples': temp_samples,
                'pressure_avg': round(pressure_avg, 1) if pressure_avg else None,
                'pressure_min': round(pressure_min, 1) if pressure_min else None,
                'pressure_max': round(pressure_max, 1) if pressure_max else None,
                'wind_avg': round(wind_avg, 1) if wind_avg else None,
                'wind_min': round(wind_min, 1) if wind_min else None,
                'wind_max': round(wind_max, 1) if wind_max else None,
                'wind_direction': wind_direction,
                'wind_direction_deg': wind_direction_deg,
                'season': season,
                'northern_season': northern_season,
                'southern_season': southern_season,
                'first_date': first_date,
                'last_date': last_date,
                'data_count': len(data.get('sol_keys', []))
            }

        except Exception as e:
            logger.error(f"Mars weather error: {e}")
            return None
    
