"""Configuration for NEOwatch Bot"""
import os
from dotenv import load_dotenv

load_dotenv()

# API Keys
NASA_API_KEY = os.getenv('NASA_API_KEY')
N2YO_API_KEY = os.getenv('N2YO_API_KEY')
BOT_TOKEN = os.getenv('BOT_TOKEN')

# NASA API
NASA_NEO_URL = "https://api.nasa.gov/neo/rest/v1/feed"
NASA_APOD_URL = "https://api.nasa.gov/planetary/apod"
NASA_IMAGE_URL = "https://images-api.nasa.gov/search"

# N2YO API
N2YO_BASE_URL = "https://api.n2yo.com/rest/v1/satellite"

# Launch API
LAUNCHLIBRARY_URL = "https://ll.thespacedevs.com/2.2.0/launch/upcoming"

# Space Weather
NOAA_SPACEWEATHER_URL = "https://services.swpc.noaa.gov/products/noaa-planetary-k-index"

# ISS Crew
OPEN_NOTIFY_CREW = "http://api.open-notify.org/astros.json"

# Default location (Kyiv, Ukraine)
DEFAULT_LAT = float(os.getenv('DEFAULT_LAT', ''))
DEFAULT_LON = float(os.getenv('DEFAULT_LON', ''))
DEFAULT_ALT = int(os.getenv('DEFAULT_ALT', 0))

# Database Configuration
DB_HOST = os.getenv('DB_HOST', 'localhost')
DB_PORT = int(os.getenv('DB_PORT', 3306))
DB_NAME = os.getenv('DB_NAME', '')
DB_USER = os.getenv('DB_USER', '')
DB_PASSWORD = os.getenv('DB_PASSWORD', '')
ISS_NORAD_ID = 25544

# Starlink satellite IDs (most visible ones)
STARLINK_NORAD_IDS = [
    44713, 44714, 44715, 44716, 44717, 44718, 44719, 44720, 44721, 44722,
    44723, 44724, 44725, 44726, 44727, 44728, 44729, 44730, 44731, 44732,
]
