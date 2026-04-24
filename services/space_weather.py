"""Space Weather API Service - NOAA SWPC data"""
import requests
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

NOAA_KP_URL = "https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json"
NOAA_SOLAR_WIND_URL = "https://services.swpc.noaa.gov/products/solar-wind/plasma-5-minute.json"
NOAA_MAG_URL = "https://services.swpc.noaa.gov/products/solar-wind/mag-1-minute.json"
NOAA_XRAY_URL = "https://services.swpc.noaa.gov/products/current-goes-xray-flux.json"
NOAA_KP_FORECAST = "https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json"
NOAA_AURORA_MAP = "https://services.swpc.noaa.gov/images/animations/ovation/north/latest.jpg"


class SpaceWeatherAPI:
    """NOAA Space Weather API client"""
    
    @staticmethod
    def get_space_weather(user_lat=None, user_lon=None):
        """Get space weather in compact format"""
        try:
            message = "🌌 <b>Космічна погода</b>\n\n"
            
            # Kp index
            kp_index, kp_time = SpaceWeatherAPI._get_kp_index()
            if kp_index is not None:
                g_scale = SpaceWeatherAPI._get_g_scale(kp_index)
                kp_emoji = SpaceWeatherAPI._get_kp_emoji_simple(kp_index)
                message += f"📊 <b>Геомагнітна активність</b>\n"
                message += f"Індекс Kp: {kp_index:.1f}/9\n"
                message += f"{kp_emoji} {g_scale}\n\n"
            
            # Solar wind
            solar_data = SpaceWeatherAPI._get_solar_wind()
            if solar_data:
                speed_emoji = "🟢" if solar_data['speed'] < 400 else "🟡" if solar_data['speed'] < 500 else "🔴"
                message += f"💨 <b>Сонячний вітер</b>\n"
                message += f"Швидкість: {solar_data['speed']:.0f} км/с {speed_emoji} {SpaceWeatherAPI._get_solar_wind_status(solar_data['speed'])}\n"
                message += f"Щільність: {solar_data['density']:.1f} ч/см³\n"
                message += f"Температура: {solar_data['temp']/1000:.1f} тис. K\n\n"
            
            # Magnetic field
            bz_data = SpaceWeatherAPI._get_bz_component()
            if bz_data is not None:
                bz_emoji = SpaceWeatherAPI._get_bz_emoji(bz_data)
                bz_status = SpaceWeatherAPI._get_bz_status(bz_data)
                message += f"🧲 <b>Магнітне поле</b>\n"
                message += f"Bz: {bz_data:.1f} нТл\n"
                message += f"{bz_emoji} {bz_status}\n\n"
            
            # X-ray
            xray_data = SpaceWeatherAPI._get_xray_flux()
            if xray_data and xray_data[0]:
                xclass, xstatus = xray_data
                x_emoji = SpaceWeatherAPI._get_xray_emoji(xclass)
                message += f"☀️ <b>Сонячна активність</b>\n"
                message += f"Рентген: {xclass}\n"
                message += f"{x_emoji} {xstatus}\n\n"
            else:
                message += f"☀️ <b>Сонячна активність</b>\n"
                message += f"🟢 Спокійно\n\n"
            
            # Aurora
            if user_lat is not None and kp_index is not None:
                aurora_status = SpaceWeatherAPI._can_see_aurora_simple(kp_index, user_lat)
                message += f"🌃 <b>Полярне сяйво</b>\n"
                message += f"{aurora_status}\n"
                message += f"📍 Ваша широта: {abs(user_lat):.1f}°\n\n"
            
            # Forecast
            forecast = SpaceWeatherAPI._get_kp_forecast_simple()
            if forecast:
                message += "\n📅 <b>Прогноз Kp на 3 дні</b>\n"
                for day in ['Сьогодні', 'Завтра', 'Післязавтра']:
                    if day in forecast:
                        kp_val = forecast[day]
                        emoji = SpaceWeatherAPI._get_kp_emoji_simple(kp_val)
                        message += f"{emoji} {day}: max Kp {kp_val:.0f}\n"
            
            message += "\n📖 <b>Шкала Kp</b>\n"
            message += "🟢 0-3: Спокійна погода\n"
            message += "🟡 4-5: Збурення\n"
            message += "🟠 6-7: Сяйво на півночі\n"
            message += "🔴 8-9: Сяйво всюди\n\n"
            message += "🌌 Дані: NOAA SWPC"
            return message
            
        except Exception as e:
            logger.error(f"Space weather error: {e}")
            return "🌌 <b>Космічна погода</b>\n\n⚠️ Часткові дані\n\n📝 NOAA SWPC"
    
    @staticmethod
    def get_aurora_map_url():
        """Get NOAA OVATION aurora forecast map URL."""
        return NOAA_AURORA_MAP

    @staticmethod
    def _get_kp_index():
        """Get current Kp index"""
        try:
            response = requests.get(NOAA_KP_URL, timeout=10)
            data = response.json()
            
            if data and len(data) >= 2:
                latest = data[-1]
                kp = float(latest[1])
                time_str = latest[0] if len(latest) > 0 else "—"
                return kp, time_str
            return None, None
        except:
            return None, None
    
    @staticmethod
    def _get_solar_wind():
        """Get solar wind data"""
        try:
            response = requests.get(NOAA_SOLAR_WIND_URL, timeout=10)
            data = response.json()
            
            if data and len(data) > 1:
                latest = data[-1]
                # [time_tag, density, speed, temperature]
                return {
                    'density': float(latest[1]),
                    'speed': float(latest[2]),
                    'temp': float(latest[3])
                }
            return None
        except:
            return None
    
    @staticmethod
    def _get_bz_component():
        """Get magnetic field Bz component"""
        try:
            response = requests.get(NOAA_MAG_URL, timeout=10)
            data = response.json()
            
            if data and len(data) > 1:
                latest = data[-1]
                # [time_tag, bx, by, bz, bt]
                return float(latest[3])  # Bz
            return None
        except:
            return None
    
    @staticmethod
    def _get_bz_status(bz):
        """Get status text for Bz value"""
        if bz > -5:
            return "Слабкий, сяйво малоймовірне"
        elif bz > -10:
            return "Помірний, сяйво можливе"
        else:
            return "Сильний, полярне сяйво ймовірне!"
    
    @staticmethod
    def _get_xray_flux():
        """Get X-ray flux and classification"""
        try:
            response = requests.get(NOAA_XRAY_URL, timeout=10)
            data = response.json()
            
            if data and len(data) > 0:
                latest = data[-1]
                flux = float(latest[1])  # flux value
                return SpaceWeatherAPI._classify_xray(flux)
            return None, None
        except:
            return None, None
    
    @staticmethod
    def _classify_xray(flux):
        """Classify X-ray flux"""
        if flux >= 1e-4:
            return "X", "🚨 Екстремальний спалах!"
        elif flux >= 1e-5:
            return "M", "⚠️ Великий спалах"
        elif flux >= 1e-6:
            return "C", "📈 Помірний спалах"
        elif flux >= 1e-7:
            return "B", "✅ Слабкий спалах"
        else:
            return "A", "🟢 Спокійно"
    
    @staticmethod
    def _get_xray_emoji(xray_class):
        """Get emoji for X-ray class"""
        emojis = {
            'A': "🟢",
            'B': "🟢",
            'C': "🟡",
            'M': "🔴",
            'X': "⚠️"
        }
        return emojis.get(xray_class, "⚪")

    @staticmethod
    def check_xclass_flare():
        """Check for X-class solar flare and return alert data if detected."""
        return SpaceWeatherAPI.check_significant_flare(min_class='X')

    @staticmethod
    def check_significant_flare(min_class='M'):
        """Check for solar flares of specified class or higher.

        Args:
            min_class: Minimum flare class to alert on ('M' or 'X')

        Returns:
            dict with flare data if detected and it's a new event, None otherwise
        """
        try:
            response = requests.get(NOAA_XRAY_URL, timeout=10)
            data = response.json()

            if not data or len(data) < 2:
                return None

            # Get latest and previous readings
            latest = data[-1]
            previous = data[-2] if len(data) > 1 else latest

            latest_flux = float(latest[1])
            previous_flux = float(previous[1])
            time_str = latest[0] if len(latest) > 0 else "—"

            latest_class, _ = SpaceWeatherAPI._classify_xray(latest_flux)
            previous_class, _ = SpaceWeatherAPI._classify_xray(previous_flux)

            # Class priority: A < B < C < M < X
            class_priority = {'A': 0, 'B': 1, 'C': 2, 'M': 3, 'X': 4}
            min_priority = class_priority.get(min_class, 3)
            latest_priority = class_priority.get(latest_class, 0)
            previous_priority = class_priority.get(previous_class, 0)

            # Alert only if current meets threshold and previous was below threshold
            # (prevents spamming the same flare)
            if latest_priority >= min_priority and previous_priority < min_priority:
                return {
                    "flux": latest_flux,
                    "time": time_str,
                    "class": latest_class,
                }

            return None
        except Exception as e:
            logger.error(f"Solar flare check error: {e}")
            return None

    @staticmethod
    def get_flare_description(flare_class):
        """Get Ukrainian description for flare class"""
        descriptions = {
            'A': "Дуже слабкий спалах",
            'B': "Слабкий спалах",
            'C': "Помірний спалах",
            'M': "Великий спалах",
            'X': "Екстремальний спалах"
        }
        return descriptions.get(flare_class, "Невідомий спалах")

    @staticmethod
    def get_flare_emoji(flare_class):
        """Get emoji for flare class alert"""
        emojis = {
            'A': "🟢",
            'B': "🟢",
            'C': "🟡",
            'M': "🔴",
            'X': "🚨"
        }
        return emojis.get(flare_class, "⚠️")

    @staticmethod
    def _get_g_scale(kp):
        """Get G-scale for Kp"""
        if kp < 5:
            return "G0: Спокійно"
        elif kp < 6:
            return "G1: Слабка буря"
        elif kp < 7:
            return "G2: Помірна буря"
        elif kp < 8:
            return "G3: Сильна буря"
        elif kp < 9:
            return "G4: Сильна геомагнітна буря"
        else:
            return "G5: Екстремальна буря"
    
    @staticmethod
    def _get_kp_emoji_simple(kp):
        """Simple emoji for Kp"""
        if kp < 4:
            return "🟢"
        elif kp < 5:
            return "🟡"
        elif kp < 7:
            return "🟠"
        else:
            return "🔴"
    
    @staticmethod
    def _get_solar_wind_status(speed):
        """Get status for solar wind speed"""
        if speed < 400:
            return "Спокійний"
        elif speed < 500:
            return "Помірний"
        elif speed < 600:
            return "Сильний"
        else:
            return "Дуже сильний"
    
    @staticmethod
    def _get_bz_status(bz):
        """Get status for Bz"""
        if bz > -5:
            return "Спокійне поле"
        elif bz > -10:
            return "Можливо слабке сяйво"
        else:
            return "Ймовірне сяйво!"
    
    @staticmethod
    def _get_bz_emoji(bz):
        """Get emoji for Bz"""
        if bz > -5:
            return "🟢"
        elif bz > -10:
            return "🟡"
        else:
            return "🔴"
    
    @staticmethod
    def _can_see_aurora_simple(kp, latitude):
        """Simple aurora visibility"""
        abs_lat = abs(latitude)
        
        if kp >= 8:
            return "🔴 Сяйво всюди"
        elif kp >= 6:
            return "🟠 Сяйво на півночі"
        elif kp >= 5 and abs_lat > 55:
            return "🟡 Можливо на півночі"
        else:
            return "🟢 Сьогодні не видно в Україні"
    
    @staticmethod
    def _get_kp_forecast_simple():
        """Get simple 3-day forecast with relative day names"""
        try:
            response = requests.get(NOAA_KP_FORECAST, timeout=10)
            data = response.json()
            
            if not data or len(data) <= 1:
                return None
            
            from datetime import datetime, date
            
            # Today (UTC date matching NOAA data)
            today = datetime.utcnow().date()
            
            # Build dictionary of max Kp per date
            daily_kp = {}
            for row in data[1:]:  # Skip header
                if len(row) >= 4:
                    # Handle both formats: "2026-03-01T00:00:00" and "2026-03-01 00:00:00"
                    date_part = row[0].split()[0]  # Get "2026-03-01"
                    kp = float(row[1])
                    
                    if date_part not in daily_kp or daily_kp[date_part] < kp:
                        daily_kp[date_part] = kp
            
            # Create result with relative day names
            result = {}
            
            for date_str, kp in daily_kp.items():
                date_obj = datetime.strptime(date_str, '%Y-%m-%d').date()
                days_diff = (date_obj - today).days
                
                if days_diff == 0:
                    result['Сьогодні'] = kp
                elif days_diff == 1:
                    result['Завтра'] = kp
                elif days_diff == 2:
                    result['Післязавтра'] = kp
            
            return result if result else None
            
        except Exception as e:
            logger.error(f"Forecast error: {e}")
            return None
    
