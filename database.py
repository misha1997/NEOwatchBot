"""SQLite database for NEOwatch Bot"""
import sqlite3
import logging
import requests
from datetime import datetime
from typing import Optional, Dict, List
from config import N2YO_API_KEY, DEFAULT_LAT, DEFAULT_LON

logger = logging.getLogger(__name__)

DATABASE_FILE = 'neowatch.db'


def init_db():
    """Initialize database with tables"""
    conn = sqlite3.connect(DATABASE_FILE)
    cursor = conn.cursor()
    
    # Users table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            user_id INTEGER PRIMARY KEY,
            chat_id INTEGER NOT NULL,
            username TEXT,
            first_name TEXT,
            last_name TEXT,
            city TEXT,
            lat REAL,
            lon REAL,
            subscribed_iss BOOLEAN DEFAULT 1,
            subscribed_apod BOOLEAN DEFAULT 1,
            subscribed_launches BOOLEAN DEFAULT 1,
            last_iss_pass INTEGER,
            last_apod_date TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # ISS passes history
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS iss_passes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            pass_time TIMESTAMP,
            duration INTEGER,
            max_elevation REAL,
            notified BOOLEAN DEFAULT 0,
            FOREIGN KEY (user_id) REFERENCES users(user_id)
        )
    ''')
    
    conn.commit()
    conn.close()
    logger.info("Database initialized")


def get_user(user_id: int) -> Optional[Dict]:
    """Get user by ID"""
    conn = sqlite3.connect(DATABASE_FILE)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute('SELECT * FROM users WHERE user_id = ?', (user_id,))
    row = cursor.fetchone()
    conn.close()
    
    if row:
        return dict(row)
    return None


def create_or_update_user(user_id: int, chat_id: int, username: str = None,
                          first_name: str = None, last_name: str = None,
                          city: str = None, lat: float = None, lon: float = None) -> Dict:
    """Create or update user"""
    conn = sqlite3.connect(DATABASE_FILE)
    cursor = conn.cursor()
    
    cursor.execute('''
        INSERT INTO users (user_id, chat_id, username, first_name, last_name, city, lat, lon)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
            chat_id = excluded.chat_id,
            username = COALESCE(excluded.username, users.username),
            first_name = COALESCE(excluded.first_name, users.first_name),
            last_name = COALESCE(excluded.last_name, users.last_name),
            city = COALESCE(excluded.city, users.city),
            lat = COALESCE(excluded.lat, users.lat),
            lon = COALESCE(excluded.lon, users.lon),
            updated_at = CURRENT_TIMESTAMP
    ''', (user_id, chat_id, username, first_name, last_name, city, lat, lon))
    
    conn.commit()
    conn.close()
    
    return get_user(user_id)


def update_user_location(user_id: int, city: str, lat: float, lon: float):
    """Update user location"""
    conn = sqlite3.connect(DATABASE_FILE)
    cursor = conn.cursor()
    
    cursor.execute('''
        UPDATE users SET city = ?, lat = ?, lon = ?, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
    ''', (city, lat, lon, user_id))
    
    conn.commit()
    conn.close()
    logger.info(f"Updated location for user {user_id}: {city} ({lat}, {lon})")


def toggle_subscription(user_id: int, subscription_type: str) -> bool:
    """Toggle subscription status. Returns new status"""
    if subscription_type not in ('iss', 'apod', 'launches'):
        return False
    
    conn = sqlite3.connect(DATABASE_FILE)
    cursor = conn.cursor()
    
    column = f'subscribed_{subscription_type}'
    
    cursor.execute(f'SELECT {column} FROM users WHERE user_id = ?', (user_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        return False
    
    new_status = not row[0]
    
    cursor.execute(f'''
        UPDATE users SET {column} = ?, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
    ''', (new_status, user_id))
    
    conn.commit()
    conn.close()
    
    return new_status


def get_subscription_status(user_id: int) -> Dict[str, bool]:
    """Get subscription status for user"""
    conn = sqlite3.connect(DATABASE_FILE)
    cursor = conn.cursor()
    
    cursor.execute('SELECT subscribed_iss, subscribed_apod, subscribed_launches FROM users WHERE user_id = ?', (user_id,))
    row = cursor.fetchone()
    conn.close()
    
    if row:
        return {'iss': bool(row[0]), 'apod': bool(row[1]), 'launches': bool(row[2])}
    return {'iss': False, 'apod': False, 'launches': False}


def get_iss_subscribers() -> List[Dict]:
    """Get all users subscribed to ISS notifications"""
    conn = sqlite3.connect(DATABASE_FILE)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT * FROM users
        WHERE subscribed_iss = 1 AND lat IS NOT NULL AND lon IS NOT NULL
    ''')
    
    users = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return users


def get_apod_subscribers() -> List[Dict]:
    """Get all users subscribed to APOD"""
    conn = sqlite3.connect(DATABASE_FILE)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute('SELECT * FROM users WHERE subscribed_apod = 1')
    
    users = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return users


def get_launch_subscribers() -> List[Dict]:
    """Get all users subscribed to launch notifications"""
    conn = sqlite3.connect(DATABASE_FILE)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    
    cursor.execute('SELECT * FROM users WHERE subscribed_launches = 1')
    
    users = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return users


def update_last_iss_pass(user_id: int, pass_timestamp: int):
    """Update last notified ISS pass"""
    conn = sqlite3.connect(DATABASE_FILE)
    cursor = conn.cursor()
    
    cursor.execute('''
        UPDATE users SET last_iss_pass = ?, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
    ''', (pass_timestamp, user_id))
    
    conn.commit()
    conn.close()


def update_last_apod_date(user_id: int, date: str):
    """Update last sent APOD date"""
    conn = sqlite3.connect(DATABASE_FILE)
    cursor = conn.cursor()
    
    cursor.execute('''
        UPDATE users SET last_apod_date = ?, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = ?
    ''', (date, user_id))
    
    conn.commit()
    conn.close()


def get_last_apod_for_user(user_id: int) -> Optional[str]:
    """Get last sent APOD date for user"""
    conn = sqlite3.connect(DATABASE_FILE)
    cursor = conn.cursor()
    
    cursor.execute('SELECT last_apod_date FROM users WHERE user_id = ?', (user_id,))
    row = cursor.fetchone()
    conn.close()
    
    if row:
        return row[0]
    return None


def geocode_city(city_name: str) -> Optional[tuple]:
    """Geocode city name to coordinates using OpenStreetMap Nominatim"""
    try:
        url = "https://nominatim.openstreetmap.org/search"
        params = {
            'q': city_name,
            'format': 'json',
            'limit': 1
        }
        headers = {'User-Agent': 'NEOwatchBot/1.0'}
        
        response = requests.get(url, params=params, headers=headers, timeout=10)
        data = response.json()
        
        if data and len(data) > 0:
            lat = float(data[0]['lat'])
            lon = float(data[0]['lon'])
            display_name = data[0].get('display_name', city_name)
            return (lat, lon, display_name)
        
        return None
    except Exception as e:
        logger.error(f"Error geocoding city '{city_name}': {e}")
        return None


def get_user_count() -> int:
    """Get total user count"""
    conn = sqlite3.connect(DATABASE_FILE)
    cursor = conn.cursor()
    
    cursor.execute('SELECT COUNT(*) FROM users')
    count = cursor.fetchone()[0]
    conn.close()
    
    return count


def get_city_suggestions(city_name: str) -> List[Dict]:
    """Get city suggestions from OpenStreetMap"""
    try:
        url = "https://nominatim.openstreetmap.org/search"
        params = {
            'q': city_name,
            'format': 'json',
            'limit': 5,
            'accept-language': 'uk,en'
        }
        headers = {'User-Agent': 'NEOwatchBot/1.0'}
        
        response = requests.get(url, params=params, headers=headers, timeout=10)
        data = response.json()
        
        suggestions = []
        for item in data:
            suggestions.append({
                'name': item.get('display_name', '').split(',')[0],
                'display_name': item.get('display_name'),
                'lat': item.get('lat'),
                'lon': item.get('lon'),
                'country': item.get('display_name', '').split(',')[-1].strip() if ',' in item.get('display_name', '') else ''
            })
        
        return suggestions
    except Exception as e:
        logger.error(f"Error getting city suggestions for '{city_name}': {e}")
        return []
