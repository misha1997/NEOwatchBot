"""ISS Map Service - Generate map images with ISS position"""
import requests
import logging
from io import BytesIO
from config import ISS_NORAD_ID

logger = logging.getLogger(__name__)


class ISSMapService:
    """Generate static map images with ISS position"""
    
    @staticmethod
    def get_iss_position():
        """Get current ISS position from WhereTheISS API"""
        try:
            url = f"https://api.wheretheiss.at/v1/satellites/{ISS_NORAD_ID}"
            response = requests.get(url, timeout=10)
            data = response.json()
            
            return {
                'lat': data['latitude'],
                'lon': data['longitude'],
                'altitude': data['altitude'],
                'velocity': data['velocity'],
                'timestamp': data['timestamp']
            }
        except Exception as e:
            logger.error(f"Error getting ISS position: {e}")
            return None
    
    @staticmethod
    def generate_map_image(lat, lon, width=800, height=500):
        """Generate static map image using OpenStreetMap (free, no API key needed)"""
        try:
            # Using staticmap API (free service)
            # Alternative: mapbox (needs token), google static maps (needs key)
            
            # Option 1: OpenStreetMap static (simple, no markers)
            zoom = 3  # World view
            
            # Using staticmap.openstreetmap.de (free, no key)
            url = f"https://staticmap.openstreetmap.de/staticmap.php" \
                  f"?center={lat},{lon}" \
                  f"&zoom={zoom}" \
                  f"&size={width}x{height}" \
                  f"&maptype=mapnik" \
                  f"&markers={lat},{lon},red-pushpin"
            
            response = requests.get(url, timeout=15)
            
            if response.status_code == 200:
                return BytesIO(response.content)
            else:
                logger.error(f"Map API error: {response.status_code}")
                return None
                
        except Exception as e:
            logger.error(f"Error generating map: {e}")
            return None
    
    @staticmethod
    def generate_mapbox_map(lat, lon, mapbox_token=None, width=800, height=500):
        """Generate map using Mapbox (better quality, needs token)"""
        try:
            if not mapbox_token:
                # Fallback to OpenStreetMap
                return ISSMapService.generate_map_image(lat, lon, width, height)
            
            # Mapbox static API
            url = f"https://api.mapbox.com/styles/v1/mapbox/dark-v11/static/" \
                  f"pin-s+ff0000({lon},{lat})/{lon},{lat},2,0/{width}x{height}" \
                  f"?access_token={mapbox_token}"
            
            response = requests.get(url, timeout=15)
            
            if response.status_code == 200:
                return BytesIO(response.content)
            else:
                logger.error(f"Mapbox API error: {response.status_code}")
                # Fallback to OSM
                return ISSMapService.generate_map_image(lat, lon, width, height)
                
        except Exception as e:
            logger.error(f"Error generating Mapbox map: {e}")
            return ISSMapService.generate_map_image(lat, lon, width, height)
    
    @staticmethod
    def get_iss_map_with_info(mapbox_token=None):
        """Get ISS position, map image and formatted info"""
        position = ISSMapService.get_iss_position()
        
        if not position:
            return None, "❌ Не вдалося отримати позицію МКС"
        
        lat = position['lat']
        lon = position['lon']
        
        # Generate map
        if mapbox_token:
            map_image = ISSMapService.generate_mapbox_map(lat, lon, mapbox_token)
        else:
            map_image = ISSMapService.generate_map_image(lat, lon)
        
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
        
        # Add map link
        maps_link = f"https://www.google.com/maps?q={lat:.4f},{lon:.4f}"
        caption += f"🗺️ <a href='{maps_link}'>Відкрити на Google Maps</a>"
        
        return map_image, caption
    
    @staticmethod
    def _get_location_name(lat, lon):
        """Get rough location description from coordinates"""
        # Simple bounding box check for major regions
        # This is a simplified version - you can expand with more regions
        
        # Check if over water (simplified)
        # Major oceans approximation
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
