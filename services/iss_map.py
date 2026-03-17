"""ISS Map Service - Generate map images with ISS position"""
import requests
import logging
from io import BytesIO
from config import ISS_NORAD_ID, GEOAPIFY_KEY

logger = logging.getLogger(__name__)


class ISSMapService:
    """Generate static map images with ISS position"""
    
    # Use real API key from config, fallback to demo
    GEOAPIFY_KEY = GEOAPIFY_KEY if GEOAPIFY_KEY else "demo"
    
    @staticmethod
    def get_iss_position():
        """Get current ISS position from WhereTheISS API with fallback to N2YO"""
        # Try wheretheiss.at first (usually faster)
        try:
            url = f"https://api.wheretheiss.at/v1/satellites/{ISS_NORAD_ID}"
            response = requests.get(url, timeout=20)
            data = response.json()
            
            return {
                'lat': data['latitude'],
                'lon': data['longitude'],
                'altitude': data['altitude'],
                'velocity': data['velocity'],
                'timestamp': data['timestamp']
            }
        except Exception as e:
            logger.warning(f"wheretheiss.at failed: {e}, trying N2YO fallback")
        
        # Fallback to N2YO API (the one already used in the project)
        try:
            from config import N2YO_API_KEY, N2YO_BASE_URL
            url = f"{N2YO_BASE_URL}/positions/{ISS_NORAD_ID}/0/0/0/1"
            params = {'apiKey': N2YO_API_KEY}
            
            response = requests.get(url, params=params, timeout=20)
            data = response.json()
            
            if 'positions' in data and data['positions']:
                pos = data['positions'][0]
                return {
                    'lat': pos['satlatitude'],
                    'lon': pos['satlongitude'],
                    'altitude': pos['sataltitude'],
                    'velocity': pos.get('satazimuth', 27600) / 100,  # approximate if not available
                    'timestamp': pos['timestamp']
                }
        except Exception as e:
            logger.error(f"N2YO fallback also failed: {e}")
        
        return None
    
    @staticmethod
    def generate_map_image(lat, lon, width=800, height=500):
        """Generate static map image using free services"""
        try:
            # Try Geoapify with demo key (works with limits)
            zoom = 2  # World view
            url = f"https://maps.geoapify.com/v1/staticmap?style=osm-bright-smooth&" \
                  f"width={width}&height={height}&" \
                  f"center=lonlat:{lon},{lat}&" \
                  f"zoom={zoom}&" \
                  f"marker=lonlat:{lon},{lat};type:material;color:%23ff0000;size:large&" \
                  f"apiKey={ISSMapService.GEOAPIFY_KEY}"
            
            response = requests.get(url, timeout=15)
            
            if response.status_code == 200 and len(response.content) > 1000:
                return BytesIO(response.content), "geoapify"
            
            # Try alternative: MapQuest (no API key needed for basic usage)
            url2 = f"https://www.mapquestapi.com/staticmap/v5/map?" \
                   f"key=demo&" \
                   f"center={lat},{lon}&" \
                   f"size={width},{height}&" \
                   f"zoom={zoom}&" \
                   f"locations={lat},{lon}|marker-red-lg"
            
            response2 = requests.get(url2, timeout=15)
            if response2.status_code == 200 and len(response2.content) > 1000:
                return BytesIO(response2.content), "mapquest"
            
            logger.warning(f"Map APIs failed, using fallback")
            return None, None
                
        except Exception as e:
            logger.error(f"Error generating map: {e}")
            return None, None
    
    @staticmethod
    def get_iss_map_with_info():
        """Get ISS position, map image (if available) and formatted info"""
        position = ISSMapService.get_iss_position()
        
        if not position:
            return None, "❌ Не вдалося отримати позицію МКС", None
        
        lat = position['lat']
        lon = position['lon']
        
        # Try to generate map
        map_image, map_source = ISSMapService.generate_map_image(lat, lon)
        
        # Format caption
        lat_dir = 'Пн' if lat >= 0 else 'Пд'
        lon_dir = 'Сх' if lon >= 0 else 'Зх'
        
        caption = f"🛰️ <b>МКС зараз</b>\n\n"
        caption += f"📍 Координати:\n"
        caption += f"   🌐 {abs(lat):.4f}° {lat_dir} широти\n"
        caption += f"   🌐 {abs(lon):.4f}° {lon_dir} довготи\n"
        caption += f"   🏔️ Висота: {position['altitude']:.1f} км\n"
        caption += f"   🚀 Швидкість: {position['velocity']:.0f} км/год\n\n"
        
        # Add location info
        location = ISSMapService._get_location_name(lat, lon)
        if location:
            caption += f"🌍 {location}\n\n"
        
        # Create Google Maps link
        maps_link = f"https://www.google.com/maps?q={lat:.4f},{lon:.4f}"
        
        return map_image, caption, maps_link
    
    @staticmethod
    def _get_location_name(lat, lon):
        """Get rough location description from coordinates"""
        # Major regions
        if -60 < lat < 60:
            if -160 < lon < -80 or (100 < lon < 180 or -180 < lon < -160):
                return "Над Тихим океаном 🌊"
            elif -80 < lon < 20:
                return "Над Атлантичним океаном 🌊"
            elif 20 < lon < 100:
                if lat > 30:
                    return "Над Євразією 🌍"
                elif lat < -10:
                    return "Над Африкою 🌍"
                else:
                    return "Над Індійським океаном 🌊"
        elif lat > 60:
            return "Над Арктикою ❄️"
        elif lat < -60:
            return "Над Антарктидою 🧊"
        
        return "Над океаном 🌊"
