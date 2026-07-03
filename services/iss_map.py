"""ISS Map Service - Generate map images with ISS position"""
import requests
import logging
from io import BytesIO
from config import ISS_NORAD_ID, GEOAPIFY_KEY
from utils.i18n import t, lat_hemi, lon_hemi, DEFAULT_LANG

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
    def get_iss_map_with_info(lang=DEFAULT_LANG):
        """Get ISS position, map image (if available) and formatted info"""
        position = ISSMapService.get_iss_position()

        if not position:
            return None, t('iss.position_error', lang), None

        lat = position['lat']
        lon = position['lon']

        # Try to generate map
        map_image, map_source = ISSMapService.generate_map_image(lat, lon)

        # Format caption
        caption = t('iss.now_title', lang)
        caption += t('iss.coords', lang)
        caption += t('iss.lat_line', lang, lat=f'{abs(lat):.4f}', hemi=lat_hemi(lat, lang))
        caption += t('iss.lon_line', lang, lon=f'{abs(lon):.4f}', hemi=lon_hemi(lon, lang))
        caption += t('iss.altitude', lang, alt=f'{position["altitude"]:.1f}')
        caption += t('iss.velocity', lang, v=f'{position["velocity"]:.0f}')

        # Add location info
        location = ISSMapService._get_location_name(lat, lon, lang)
        if location:
            caption += f"🌍 {location}\n\n"

        # Create Google Maps link
        maps_link = f"https://www.google.com/maps?q={lat:.4f},{lon:.4f}"

        return map_image, caption, maps_link

    @staticmethod
    def _get_location_name(lat, lon, lang=DEFAULT_LANG):
        """Get rough location description from coordinates"""
        # Major regions
        if -60 < lat < 60:
            if -160 < lon < -80 or (100 < lon < 180 or -180 < lon < -160):
                return t('issmap.pacific', lang)
            elif -80 < lon < 20:
                return t('issmap.atlantic', lang)
            elif 20 < lon < 100:
                if lat > 30:
                    return t('issmap.eurasia', lang)
                elif lat < -10:
                    return t('issmap.africa', lang)
                else:
                    return t('issmap.indian', lang)
        elif lat > 60:
            return t('issmap.arctic', lang)
        elif lat < -60:
            return t('issmap.antarctic', lang)

        return t('issmap.ocean', lang)
