"""MySQL database for NEOwatch Bot"""
import logging
import requests
from typing import Optional, Dict, List
import mysql.connector
from mysql.connector import Error, pooling
from config import (
    DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD
)

logger = logging.getLogger(__name__)

# Database connection pool
_db_pool = None


def get_db_connection():
    """Get database connection from pool or create new one"""
    global _db_pool
    
    try:
        if _db_pool is None:
            _db_pool = pooling.MySQLConnectionPool(
                pool_name="neowatch_pool",
                pool_size=5,
                host=DB_HOST,
                port=DB_PORT,
                database=DB_NAME,
                user=DB_USER,
                password=DB_PASSWORD,
                charset='utf8mb4',
                collation='utf8mb4_unicode_ci',
                autocommit=True
            )
        
        return _db_pool.get_connection()
    except Error as e:
        logger.error(f"Database connection error: {e}")
        # Fallback to direct connection if pool fails
        return mysql.connector.connect(
            host=DB_HOST,
            port=DB_PORT,
            database=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD,
            charset='utf8mb4',
            collation='utf8mb4_unicode_ci',
            autocommit=True
        )


def init_db():
    """Initialize database with tables"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # Users table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                user_id BIGINT PRIMARY KEY,
                chat_id BIGINT NOT NULL,
                username VARCHAR(255),
                first_name VARCHAR(255),
                last_name VARCHAR(255),
                city VARCHAR(255),
                lat DECIMAL(10, 8),
                lon DECIMAL(11, 8),
                subscribed_iss BOOLEAN DEFAULT TRUE,
                subscribed_apod BOOLEAN DEFAULT TRUE,
                subscribed_launches BOOLEAN DEFAULT TRUE,
                subscribed_neo BOOLEAN DEFAULT TRUE,
                subscribed_news BOOLEAN DEFAULT TRUE,
                subscribed_meteors BOOLEAN DEFAULT TRUE,
                subscribed_flares BOOLEAN DEFAULT TRUE,
                last_iss_pass INT,
                last_apod_date VARCHAR(10),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_subscribed_iss (subscribed_iss),
                INDEX idx_subscribed_apod (subscribed_apod),
                INDEX idx_subscribed_launches (subscribed_launches),
                INDEX idx_subscribed_neo (subscribed_neo),
                INDEX idx_subscribed_news (subscribed_news),
                INDEX idx_subscribed_meteors (subscribed_meteors),
                INDEX idx_subscribed_flares (subscribed_flares)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ''')

        # Meteor shower notifications tracking
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS meteor_notifications (
                id INT AUTO_INCREMENT PRIMARY KEY,
                shower_name VARCHAR(100) NOT NULL,
                peak_date DATE NOT NULL,
                notification_type VARCHAR(20) NOT NULL,
                notified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY idx_shower_notification (shower_name, peak_date, notification_type),
                INDEX idx_notified_at (notified_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ''')

        # News notifications tracking
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS news_notifications (
                id INT AUTO_INCREMENT PRIMARY KEY,
                article_url VARCHAR(500) NOT NULL,
                article_title VARCHAR(500) NOT NULL,
                notified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY idx_article_url (article_url),
                INDEX idx_notified_at (notified_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ''')

        # Hazardous asteroids notifications tracking
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS neo_notifications (
                id INT AUTO_INCREMENT PRIMARY KEY,
                asteroid_id VARCHAR(255) NOT NULL,
                approach_date DATE NOT NULL,
                notified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY idx_asteroid_date (asteroid_id, approach_date),
                INDEX idx_notified_at (notified_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ''')
        
        # ISS passes history
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS iss_passes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id BIGINT,
                pass_time TIMESTAMP,
                duration INT,
                max_elevation DECIMAL(5, 2),
                notified BOOLEAN DEFAULT FALSE,
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
                INDEX idx_user_pass (user_id, pass_time)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ''')

        # Solar flare notifications tracking
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS flare_notifications (
                id INT AUTO_INCREMENT PRIMARY KEY,
                flare_class VARCHAR(10) NOT NULL,
                flare_time VARCHAR(50) NOT NULL,
                flux_value DECIMAL(12, 10) NOT NULL,
                notified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY idx_flare_time (flare_class, flare_time),
                INDEX idx_notified_at (notified_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ''')

        # Launch notifications tracking
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS launch_notifications (
                id INT AUTO_INCREMENT PRIMARY KEY,
                launch_id VARCHAR(255) NOT NULL,
                notification_type VARCHAR(50) NOT NULL,
                notified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY idx_launch_notification (launch_id, notification_type),
                INDEX idx_notified_at (notified_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ''')

        # Add subscribed_flares column to existing users (migration)
        try:
            cursor.execute('''
                SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = 'users'
                AND COLUMN_NAME = 'subscribed_flares'
            ''')
            if cursor.fetchone()[0] == 0:
                cursor.execute('''
                    ALTER TABLE users
                    ADD COLUMN subscribed_flares BOOLEAN DEFAULT TRUE
                ''')
                conn.commit()
                logger.info("Added subscribed_flares column to users table")
        except Error:
            pass

        conn.commit()
        logger.info("Database initialized (MySQL)")

    except Error as e:
        logger.error(f"Database initialization error: {e}")
        raise
    finally:
        cursor.close()
        conn.close()


def get_user(user_id: int) -> Optional[Dict]:
    """Get user by ID"""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    try:
        cursor.execute('SELECT * FROM users WHERE user_id = %s', (user_id,))
        row = cursor.fetchone()
        return row
    except Error as e:
        logger.error(f"Error getting user: {e}")
        return None
    finally:
        cursor.close()
        conn.close()


def create_or_update_user(user_id: int, chat_id: int = None, username: str = None,
                          first_name: str = None, last_name: str = None,
                          city: str = None, lat: float = None, lon: float = None) -> Dict:
    """Create or update user"""
    # If chat_id not provided, use user_id
    if chat_id is None:
        chat_id = user_id
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # Insert or update user
        cursor.execute('''
            INSERT INTO users (user_id, chat_id, username, first_name, last_name, city, lat, lon)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE
                chat_id = VALUES(chat_id),
                username = COALESCE(VALUES(username), username),
                first_name = COALESCE(VALUES(first_name), first_name),
                last_name = COALESCE(VALUES(last_name), last_name),
                city = COALESCE(VALUES(city), city),
                lat = COALESCE(VALUES(lat), lat),
                lon = COALESCE(VALUES(lon), lon),
                updated_at = CURRENT_TIMESTAMP
        ''', (user_id, chat_id, username, first_name, last_name, city, lat, lon))
        
        conn.commit()
        return get_user(user_id)
        
    except Error as e:
        logger.error(f"Error creating/updating user: {e}")
        conn.rollback()
        return None
    finally:
        cursor.close()
        conn.close()


def update_user_location(user_id: int, city: str, lat: float, lon: float):
    """Update user location"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute('''
            UPDATE users SET city = %s, lat = %s, lon = %s, updated_at = CURRENT_TIMESTAMP
            WHERE user_id = %s
        ''', (city, lat, lon, user_id))
        
        conn.commit()
        logger.info(f"Updated location for user {user_id}: {city} ({lat}, {lon})")
        
    except Error as e:
        logger.error(f"Error updating location: {e}")
        conn.rollback()
    finally:
        cursor.close()
        conn.close()


def toggle_subscription(user_id: int, subscription_type: str) -> bool:
    """Toggle subscription status. Returns new status"""
    if subscription_type not in ('iss', 'apod', 'launches', 'neo', 'news', 'meteors', 'flares'):
        return False

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        column = f'subscribed_{subscription_type}'
        
        # Get current status
        cursor.execute(f'SELECT {column} FROM users WHERE user_id = %s', (user_id,))
        row = cursor.fetchone()
        if not row:
            return False
        
        current_status = bool(row[0])
        new_status = not current_status
        
        # Update status
        cursor.execute(f''
            f'UPDATE users SET {column} = %s WHERE user_id = %s'
        '', (new_status, user_id))
        
        conn.commit()
        return new_status
        
    except Error as e:
        logger.error(f"Error toggling subscription: {e}")
        conn.rollback()
        return False
    finally:
        cursor.close()
        conn.close()


def get_iss_subscribers() -> List[Dict]:
    """Get all users subscribed to ISS notifications"""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    try:
        cursor.execute('''
            SELECT * FROM users
            WHERE subscribed_iss = TRUE AND lat IS NOT NULL AND lon IS NOT NULL
        ''')
        
        return cursor.fetchall()
        
    except Error as e:
        logger.error(f"Error getting ISS subscribers: {e}")
        return []
    finally:
        cursor.close()
        conn.close()


def get_apod_subscribers() -> List[Dict]:
    """Get all users subscribed to APOD"""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    try:
        cursor.execute('SELECT * FROM users WHERE subscribed_apod = TRUE')
        return cursor.fetchall()
        
    except Error as e:
        logger.error(f"Error getting APOD subscribers: {e}")
        return []
    finally:
        cursor.close()
        conn.close()


def get_launch_subscribers() -> List[Dict]:
    """Get all users subscribed to launch notifications"""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        cursor.execute('SELECT * FROM users WHERE subscribed_launches = TRUE')
        return cursor.fetchall()

    except Error as e:
        logger.error(f"Error getting launch subscribers: {e}")
        return []
    finally:
        cursor.close()
        conn.close()


def get_neo_subscribers() -> List[Dict]:
    """Get all users subscribed to hazardous asteroid notifications"""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        cursor.execute('SELECT * FROM users WHERE subscribed_neo = TRUE')
        return cursor.fetchall()

    except Error as e:
        logger.error(f"Error getting NEO subscribers: {e}")
        return []
    finally:
        cursor.close()
        conn.close()


def get_news_subscribers() -> List[Dict]:
    """Get all users subscribed to daily news"""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        cursor.execute('SELECT * FROM users WHERE subscribed_news = TRUE')
        return cursor.fetchall()

    except Error as e:
        logger.error(f"Error getting news subscribers: {e}")
        return []
    finally:
        cursor.close()
        conn.close()


def get_meteor_subscribers() -> List[Dict]:
    """Get all users subscribed to meteor shower notifications"""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        cursor.execute('SELECT * FROM users WHERE subscribed_meteors = TRUE')
        return cursor.fetchall()

    except Error as e:
        logger.error(f"Error getting meteor subscribers: {e}")
        return []
    finally:
        cursor.close()
        conn.close()


def get_flare_subscribers() -> List[Dict]:
    """Get all users subscribed to solar flare notifications"""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        cursor.execute('SELECT * FROM users WHERE subscribed_flares = TRUE')
        return cursor.fetchall()

    except Error as e:
        logger.error(f"Error getting flare subscribers: {e}")
        return []
    finally:
        cursor.close()
        conn.close()


def update_last_iss_pass(user_id: int, pass_timestamp: int):
    """Update last notified ISS pass"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute(
            'UPDATE users SET last_iss_pass = %s WHERE user_id = %s',
            (pass_timestamp, user_id)
        )
        conn.commit()
    except Error as e:
        logger.error(f"Error updating last ISS pass: {e}")
        conn.rollback()
    finally:
        cursor.close()
        conn.close()


def update_last_apod_date(user_id: int, date: str):
    """Update last sent APOD date"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute(
            'UPDATE users SET last_apod_date = %s WHERE user_id = %s',
            (date, user_id)
        )
        conn.commit()
    except Error as e:
        logger.error(f"Error updating last APOD date: {e}")
        conn.rollback()
    finally:
        cursor.close()
        conn.close()


def get_last_apod_for_user(user_id: int) -> Optional[str]:
    """Get last sent APOD date for user"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute('SELECT last_apod_date FROM users WHERE user_id = %s', (user_id,))
        row = cursor.fetchone()
        
        if row:
            return row[0]
        return None
    except Error as e:
        logger.error(f"Error getting last APOD: {e}")
        return None
    finally:
        cursor.close()
        conn.close()


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
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute('SELECT COUNT(*) FROM users')
        count = cursor.fetchone()[0]
        return count
    except Error as e:
        logger.error(f"Error getting user count: {e}")
        return 0
    finally:
        cursor.close()
        conn.close()


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


def is_launch_notified(launch_id: str, notification_type: str) -> bool:
    """Check if launch notification was already sent"""
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            'SELECT 1 FROM launch_notifications WHERE launch_id = %s AND notification_type = %s',
            (launch_id, notification_type)
        )
        return cursor.fetchone() is not None
    except Error as e:
        logger.error(f"Error checking launch notification: {e}")
        return False
    finally:
        cursor.close()
        conn.close()


def mark_launch_notified(launch_id: str, notification_type: str):
    """Mark launch notification as sent"""
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            'INSERT INTO launch_notifications (launch_id, notification_type) VALUES (%s, %s)',
            (launch_id, notification_type)
        )
        conn.commit()
    except Error as e:
        logger.error(f"Error marking launch notification: {e}")
        conn.rollback()
    finally:
        cursor.close()
        conn.close()


def cleanup_old_launch_notifications(days: int = 7):
    """Remove old launch notifications (older than N days)"""
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            'DELETE FROM launch_notifications WHERE notified_at < DATE_SUB(NOW(), INTERVAL %s DAY)',
            (days,)
        )
        conn.commit()
        logger.info(f"Cleaned up {cursor.rowcount} old launch notifications")
    except Error as e:
        logger.error(f"Error cleaning up launch notifications: {e}")
        conn.rollback()
    finally:
        cursor.close()
        conn.close()


def is_neo_notified(asteroid_id: str, approach_date: str) -> bool:
    """Check if hazardous asteroid notification was already sent"""
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            'SELECT 1 FROM neo_notifications WHERE asteroid_id = %s AND approach_date = %s',
            (asteroid_id, approach_date)
        )
        return cursor.fetchone() is not None
    except Error as e:
        logger.error(f"Error checking NEO notification: {e}")
        return False
    finally:
        cursor.close()
        conn.close()


def mark_neo_notified(asteroid_id: str, approach_date: str):
    """Mark hazardous asteroid notification as sent"""
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            'INSERT INTO neo_notifications (asteroid_id, approach_date) VALUES (%s, %s)',
            (asteroid_id, approach_date)
        )
        conn.commit()
    except Error as e:
        logger.error(f"Error marking NEO notification: {e}")
        conn.rollback()
    finally:
        cursor.close()
        conn.close()


def cleanup_old_neo_notifications(days: int = 30):
    """Remove old NEO notifications (older than N days)"""
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            'DELETE FROM neo_notifications WHERE notified_at < DATE_SUB(NOW(), INTERVAL %s DAY)',
            (days,)
        )
        conn.commit()
        logger.info(f"Cleaned up {cursor.rowcount} old NEO notifications")
    except Error as e:
        logger.error(f"Error cleaning up NEO notifications: {e}")
        conn.rollback()
    finally:
        cursor.close()
        conn.close()


def is_news_notified(article_url: str) -> bool:
    """Check if news article was already sent"""
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            'SELECT 1 FROM news_notifications WHERE article_url = %s',
            (article_url,)
        )
        return cursor.fetchone() is not None
    except Error as e:
        logger.error(f"Error checking news notification: {e}")
        return False
    finally:
        cursor.close()
        conn.close()


def mark_news_notified(article_url: str, article_title: str):
    """Mark news article as sent"""
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            'INSERT INTO news_notifications (article_url, article_title) VALUES (%s, %s)',
            (article_url, article_title)
        )
        conn.commit()
    except Error as e:
        logger.error(f"Error marking news notification: {e}")
        conn.rollback()
    finally:
        cursor.close()
        conn.close()


def cleanup_old_news_notifications(days: int = 30):
    """Remove old news notifications (older than N days)"""
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            'DELETE FROM news_notifications WHERE notified_at < DATE_SUB(NOW(), INTERVAL %s DAY)',
            (days,)
        )
        conn.commit()
        logger.info(f"Cleaned up {cursor.rowcount} old news notifications")
    except Error as e:
        logger.error(f"Error cleaning up news notifications: {e}")
        conn.rollback()
    finally:
        cursor.close()
        conn.close()


def is_meteor_notified(shower_name: str, peak_date: str, notification_type: str) -> bool:
    """Check if meteor shower notification was already sent"""
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            'SELECT 1 FROM meteor_notifications WHERE shower_name = %s AND peak_date = %s AND notification_type = %s',
            (shower_name, peak_date, notification_type)
        )
        return cursor.fetchone() is not None
    except Error as e:
        logger.error(f"Error checking meteor notification: {e}")
        return False
    finally:
        cursor.close()
        conn.close()


def mark_meteor_notified(shower_name: str, peak_date: str, notification_type: str):
    """Mark meteor shower notification as sent"""
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            'INSERT INTO meteor_notifications (shower_name, peak_date, notification_type) VALUES (%s, %s, %s)',
            (shower_name, peak_date, notification_type)
        )
        conn.commit()
    except Error as e:
        logger.error(f"Error marking meteor notification: {e}")
        conn.rollback()
    finally:
        cursor.close()
        conn.close()


def cleanup_old_meteor_notifications(days: int = 60):
    """Remove old meteor notifications (older than N days)"""
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            'DELETE FROM meteor_notifications WHERE notified_at < DATE_SUB(NOW(), INTERVAL %s DAY)',
            (days,)
        )
        conn.commit()
        logger.info(f"Cleaned up {cursor.rowcount} old meteor notifications")
    except Error as e:
        logger.error(f"Error cleaning up meteor notifications: {e}")
        conn.rollback()
    finally:
        cursor.close()
        conn.close()


def is_flare_notified(flare_class: str, flare_time: str) -> bool:
    """Check if solar flare notification was already sent"""
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            'SELECT 1 FROM flare_notifications WHERE flare_class = %s AND flare_time = %s',
            (flare_class, flare_time)
        )
        return cursor.fetchone() is not None
    except Error as e:
        logger.error(f"Error checking flare notification: {e}")
        return False
    finally:
        cursor.close()
        conn.close()


def mark_flare_notified(flare_class: str, flare_time: str, flux_value: float):
    """Mark solar flare notification as sent"""
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            'INSERT INTO flare_notifications (flare_class, flare_time, flux_value) VALUES (%s, %s, %s)',
            (flare_class, flare_time, flux_value)
        )
        conn.commit()
    except Error as e:
        logger.error(f"Error marking flare notification: {e}")
        conn.rollback()
    finally:
        cursor.close()
        conn.close()


def cleanup_old_flare_notifications(days: int = 7):
    """Remove old flare notifications (older than N days)"""
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            'DELETE FROM flare_notifications WHERE notified_at < DATE_SUB(NOW(), INTERVAL %s DAY)',
            (days,)
        )
        conn.commit()
        logger.info(f"Cleaned up {cursor.rowcount} old flare notifications")
    except Error as e:
        logger.error(f"Error cleaning up flare notifications: {e}")
        conn.rollback()
    finally:
        cursor.close()
        conn.close()
