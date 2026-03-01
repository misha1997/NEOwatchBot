"""Configuration for NEOwatch Bot"""
import os
from dotenv import load_dotenv

load_dotenv()

# API Keys
NASA_API_KEY = os.getenv('NASA_API_KEY')
N2YO_API_KEY = os.getenv('N2YO_API_KEY')
BOT_TOKEN = os.getenv('BOT_TOKEN')

# API Endpoints
NASA_NEO_URL = "https://api.nasa.gov/neo/rest/v1/feed"
N2YO_BASE_URL = "https://api.n2yo.com/rest/v1/satellite"

# Default location (Kyiv, Ukraine)
DEFAULT_LAT = float(os.getenv('DEFAULT_LAT', 50.4501))
DEFAULT_LON = float(os.getenv('DEFAULT_LON', 30.5234))
DEFAULT_ALT = int(os.getenv('DEFAULT_ALT', 0))

# Satellite IDs
ISS_NORAD_ID = 25544  # International Space Station
