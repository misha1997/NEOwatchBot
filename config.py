"""Configuration for NEOwatch Bot"""
import os
from dotenv import load_dotenv

load_dotenv()

# API Keys (set in .env or environment variables)
NASA_API_KEY = os.getenv('NASA_API_KEY')
N2YO_API_KEY = os.getenv('N2YO_API_KEY')
BOT_TOKEN = os.getenv('BOT_TOKEN')
GEOAPIFY_KEY = os.getenv('GEOAPIFY_KEY', '')
DEEPL_API_KEY = os.getenv('DEEPL_API_KEY')

# NASA API
NASA_NEO_URL = "https://api.nasa.gov/neo/rest/v1/feed"
NASA_APOD_URL = "https://api.nasa.gov/planetary/apod"

# N2YO API
N2YO_BASE_URL = "https://api.n2yo.com/rest/v1/satellite"

# Default location (Kyiv, Ukraine)
DEFAULT_LAT = float(os.getenv('DEFAULT_LAT', ''))
DEFAULT_LON = float(os.getenv('DEFAULT_LON', ''))
DEFAULT_ALT = int(os.getenv('DEFAULT_ALT', ''))

# Database Configuration
DB_HOST = os.getenv('DB_HOST', 'localhost')
DB_PORT = int(os.getenv('DB_PORT', 3306))
DB_NAME = os.getenv('DB_NAME', '')
DB_USER = os.getenv('DB_USER', '')
DB_PASSWORD = os.getenv('DB_PASSWORD', '')
ISS_NORAD_ID = 25544

# Starlink satellite IDs (most visible ones - updated 2026)
# Source: Celestrak
STARLINK_NORAD_IDS = [
    # v1.0 launches (2019-2020)
    44714, 44718, 44723, 44724, 44725, 44741, 44744, 44747, 44748, 44751,
    44752, 44753, 44768, 44771, 44772, 44927, 44930, 44941, 44949, 44961,
    44968, 45044, 45047, 45048, 45054, 45057, 45060, 45061, 45062, 45064,
    # v1.5 launches (2021-2022)
    47445, 47446, 47447, 47448, 47449, 47450, 47451, 47452, 47453, 47454,
    48219, 48220, 48221, 48222, 48223, 48224, 48225, 48226, 48227, 48228,
]
