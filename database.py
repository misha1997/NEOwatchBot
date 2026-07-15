"""MySQL database for NEOwatch Bot"""
import logging
import requests
from typing import Optional, Dict, List
import mysql.connector
from mysql.connector import Error, pooling
from utils.i18n import DEFAULT_LANG
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
                subscribed_grb BOOLEAN DEFAULT TRUE,
                lang VARCHAR(5) NOT NULL DEFAULT 'uk',
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
                INDEX idx_subscribed_flares (subscribed_flares),
                INDEX idx_subscribed_grb (subscribed_grb)
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

        # News article archive for the website (full articles + UK translation).
        # Body columns are nullable — filled lazily when an article page is opened.
        # `slug` (derived from the source URL) is the public article page key:
        # /news/<slug>. UNIQUE so two articles can't share a slug.
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS news_articles (
                id INT AUTO_INCREMENT PRIMARY KEY,
                url VARCHAR(500) NOT NULL,
                slug VARCHAR(200) NOT NULL DEFAULT '',
                title VARCHAR(500) NOT NULL,
                title_uk VARCHAR(500),
                excerpt TEXT,
                excerpt_uk TEXT,
                body MEDIUMTEXT,
                body_uk MEDIUMTEXT,
                image VARCHAR(500),
                category VARCHAR(40) NOT NULL DEFAULT 'missions',
                category_raw VARCHAR(120),
                source VARCHAR(120) NOT NULL DEFAULT 'SpaceflightNow',
                published_date VARCHAR(60),
                fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY idx_news_url (url),
                UNIQUE KEY idx_news_slug (slug),
                INDEX idx_news_cat (category),
                INDEX idx_news_fetched (fetched_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ''')

        # APOD photo archive for the website gallery (NASA APOD, one entry/day).
        # `date` is the PK (APOD = 1/day, idempotent UPSERT). Images are mirrored
        # locally to data/apod/YYYY/MM/DD-<full|thumb>.<ext>; thumb_path/full_path
        # are relative paths served via /apod-img. Video APODs keep their YouTube
        # link in video_url and only mirror the thumbnail. explanation_uk is
        # translated eagerly at ingest (DeepL quota-safe: ~1.5k chars/day).
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS apod_entries (
                date DATE PRIMARY KEY,
                title VARCHAR(500) NOT NULL,
                explanation TEXT,
                explanation_uk MEDIUMTEXT,
                media_type VARCHAR(20) NOT NULL DEFAULT 'image',
                thumb_path VARCHAR(300),
                full_path VARCHAR(300),
                video_url VARCHAR(500),
                credit VARCHAR(300),
                fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_apod_date (date)
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

        # Geomagnetic storm notifications tracking
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS storm_notifications (
                id INT AUTO_INCREMENT PRIMARY KEY,
                kp_value DECIMAL(3,1) NOT NULL,
                observation_time VARCHAR(50) NOT NULL,
                g_scale VARCHAR(5) NOT NULL,
                notified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY idx_storm_obs (kp_value, observation_time),
                INDEX idx_notified_at (notified_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ''')

        # GRB notifications tracking
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS grb_notifications (
                id INT AUTO_INCREMENT PRIMARY KEY,
                grb_name VARCHAR(50) NOT NULL,
                circular_id VARCHAR(20) NOT NULL,
                notified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY idx_grb_notification (grb_name),
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

        # Add subscribed_grb column to existing users (migration)
        try:
            cursor.execute('''
                SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = 'users'
                AND COLUMN_NAME = 'subscribed_grb'
            ''')
            if cursor.fetchone()[0] == 0:
                cursor.execute('''
                    ALTER TABLE users
                    ADD COLUMN subscribed_grb BOOLEAN DEFAULT TRUE
                ''')
                conn.commit()
                logger.info("Added subscribed_grb column to users table")
        except Error:
            pass

        # Add lang column to existing users (migration)
        try:
            cursor.execute('''
                SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = 'users'
                AND COLUMN_NAME = 'lang'
            ''')
            if cursor.fetchone()[0] == 0:
                cursor.execute('''
                    ALTER TABLE users
                    ADD COLUMN lang VARCHAR(5) NOT NULL DEFAULT 'uk'
                ''')
                conn.commit()
                logger.info("Added lang column to users table")
        except Error:
            pass

        # Add slug column to news_articles (migration for existing installs).
        # Order matters: add the column first, backfill empty slugs so they're
        # all unique, THEN add the UNIQUE index (it would otherwise reject the
        # duplicate '' defaults already in the table).
        try:
            cursor.execute('''
                SELECT COUNT(*) FROM information_schema.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = 'news_articles'
                AND COLUMN_NAME = 'slug'
            ''')
            if cursor.fetchone()[0] == 0:
                cursor.execute('''
                    ALTER TABLE news_articles
                    ADD COLUMN slug VARCHAR(200) NOT NULL DEFAULT '' AFTER url
                ''')
                conn.commit()
                logger.info("Added slug column to news_articles table")
        except Error as e:
            logger.warning(f"news_articles slug column migration: {e}")

        # Backfill empty slugs from the source URL (best-effort, one pass).
        try:
            cursor.execute("SELECT id, url FROM news_articles WHERE slug = '' OR slug IS NULL")
            rows = cursor.fetchall()
            for row in rows:
                slug = _news_slug_for_url(row[1], cursor)
                if slug:
                    cursor.execute(
                        "UPDATE news_articles SET slug = %s WHERE id = %s",
                        (slug, row[0])
                    )
            if rows:
                conn.commit()
                logger.info(f"Backfilled {len(rows)} news article slug(s)")
        except Error as e:
            logger.warning(f"news_articles slug backfill: {e}")

        # Now that every row has a unique slug, add the UNIQUE index (if missing).
        try:
            cursor.execute('''
                SELECT COUNT(*) FROM information_schema.STATISTICS
                WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = 'news_articles'
                AND INDEX_NAME = 'idx_news_slug'
            ''')
            if cursor.fetchone()[0] == 0:
                cursor.execute('''
                    ALTER TABLE news_articles
                    ADD UNIQUE KEY idx_news_slug (slug)
                ''')
                conn.commit()
                logger.info("Added idx_news_slug unique index")
        except Error as e:
            # Duplicate non-unique slugs would block this; log and continue
            # (the site still works, the column just isn't uniqueness-constrained).
            logger.warning(f"news_articles idx_news_slug migration: {e}")

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


def get_user_lang(user_id: int) -> Optional[str]:
    """Get a user's language code ('uk' or 'en'), or None if user not found."""
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute('SELECT lang FROM users WHERE user_id = %s', (user_id,))
        row = cursor.fetchone()
        return row[0] if row else None
    except Error as e:
        logger.error(f"Error getting user language: {e}")
        return None
    finally:
        cursor.close()
        conn.close()


def update_user_lang(user_id: int, lang: str) -> bool:
    """Update a user's language. lang must be one of the supported codes."""
    from utils.i18n import SUPPORTED_LANGS
    if lang not in SUPPORTED_LANGS:
        return False

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            'UPDATE users SET lang = %s, updated_at = CURRENT_TIMESTAMP WHERE user_id = %s',
            (lang, user_id)
        )
        conn.commit()
        return cursor.rowcount > 0
    except Error as e:
        logger.error(f"Error updating user language: {e}")
        conn.rollback()
        return False
    finally:
        cursor.close()
        conn.close()


def create_or_update_user(user_id: int, chat_id: int = None, username: str = None,
                          first_name: str = None, last_name: str = None,
                          city: str = None, lat: float = None, lon: float = None,
                          lang: str = None) -> Dict:
    """Create or update user. lang is only applied on insert (new user)."""
    # If chat_id not provided, use user_id
    if chat_id is None:
        chat_id = user_id
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # Insert or update user. lang defaults to 'uk' via the column default
        # when not provided; on update lang is left untouched (use update_user_lang).
        if lang:
            cursor.execute('''
                INSERT INTO users (user_id, chat_id, username, first_name, last_name, city, lat, lon, lang)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON DUPLICATE KEY UPDATE
                    chat_id = VALUES(chat_id),
                    username = COALESCE(VALUES(username), username),
                    first_name = COALESCE(VALUES(first_name), first_name),
                    last_name = COALESCE(VALUES(last_name), last_name),
                    city = COALESCE(VALUES(city), city),
                    lat = COALESCE(VALUES(lat), lat),
                    lon = COALESCE(VALUES(lon), lon),
                    updated_at = CURRENT_TIMESTAMP
            ''', (user_id, chat_id, username, first_name, last_name, city, lat, lon, lang))
        else:
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
    if subscription_type not in ('iss', 'apod', 'launches', 'neo', 'news', 'meteors', 'flares', 'grb'):
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


def get_grb_subscribers() -> List[Dict]:
    """Get all users subscribed to GRB notifications"""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)

    try:
        cursor.execute('SELECT * FROM users WHERE subscribed_grb = TRUE')
        return cursor.fetchall()

    except Error as e:
        logger.error(f"Error getting GRB subscribers: {e}")
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


def _nominatim_accept_language(lang: str) -> str:
    """Return an accept-language preference string for Nominatim."""
    return 'uk,en' if lang == 'uk' else 'en'


def _short_name_from_address(address: Dict, display_name: str, item_name: str = '') -> str:
    """Pick the most specific locality name from a Nominatim `address` dict,
    falling back to the item's `name` field and then the first chunk of
    `display_name`."""
    if address:
        for key in ('city', 'town', 'village', 'hamlet', 'locality',
                    'municipality', 'county', 'state_district'):
            val = address.get(key)
            if val:
                return val
    if item_name:
        return item_name
    if display_name:
        return display_name.split(',')[0].strip()
    return ''


def _country_from_address(address: Dict, display_name: str) -> str:
    """Country name from structured `address`, falling back to the last chunk
    of `display_name`."""
    if address and address.get('country'):
        return address['country']
    if display_name and ',' in display_name:
        return display_name.split(',')[-1].strip()
    return ''


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


def get_city_suggestions(city_name: str, lang: str = DEFAULT_LANG, limit: int = 5) -> List[Dict]:
    """Get disambiguated city suggestions from OpenStreetMap Nominatim.

    Returns a list of dicts: {short_name, country, country_code, state,
    display_name, lat, lon}. Structured `addressdetails=1` is requested so the
    short name and country come from parsed fields (not fragile display_name
    splitting), and `accept-language` is set per the user's language.
    """
    try:
        url = "https://nominatim.openstreetmap.org/search"
        params = {
            'q': city_name,
            'format': 'json',
            'limit': limit,
            'addressdetails': 1,
            'accept-language': _nominatim_accept_language(lang),
        }
        headers = {'User-Agent': 'NEOwatchBot/1.0'}

        response = requests.get(url, params=params, headers=headers, timeout=10)
        data = response.json()

        suggestions = []
        seen = set()
        for item in data:
            address = item.get('address') or {}
            display_name = item.get('display_name', '') or ''
            short_name = _short_name_from_address(address, display_name, item.get('name', ''))
            country = _country_from_address(address, display_name)
            country_code = address.get('country_code', '').upper()
            state = address.get('state', address.get('region', ''))

            # Deduplicate the same place (Nominatim often returns multiple OSM
            # elements — e.g. a node and a relation — for one city). Merge by
            # name + country + state; keep the first occurrence's coordinates.
            try:
                float(item.get('lat'))
                float(item.get('lon'))
            except (TypeError, ValueError):
                continue
            key = (short_name.lower(), country.lower(), state.lower())
            if key in seen:
                continue
            seen.add(key)

            suggestions.append({
                'short_name': short_name or display_name.split(',')[0].strip(),
                'country': country,
                'country_code': country_code,
                'state': state,
                'display_name': display_name,
                'lat': item.get('lat'),
                'lon': item.get('lon'),
            })

        return suggestions
    except Exception as e:
        logger.error(f"Error getting city suggestions for '{city_name}': {e}")
        return []


def reverse_geocode(lat: float, lon: float, lang: str = DEFAULT_LANG) -> Optional[tuple]:
    """Reverse-geocode coordinates to a place name via Nominatim /reverse.

    Returns (short_name, display_name, country) or None. Used by the
    location-share flow and the coord-based picker callback so the stored
    `city` label matches the user's language.
    """
    try:
        url = "https://nominatim.openstreetmap.org/reverse"
        params = {
            'lat': lat,
            'lon': lon,
            'format': 'json',
            'addressdetails': 1,
            'accept-language': _nominatim_accept_language(lang),
        }
        headers = {'User-Agent': 'NEOwatchBot/1.0'}

        response = requests.get(url, params=params, headers=headers, timeout=10)
        if response.status_code != 200:
            return None
        data = response.json()
        address = data.get('address') or {}
        display_name = data.get('display_name', '') or ''
        short_name = _short_name_from_address(address, display_name)
        country = _country_from_address(address, display_name)
        if not short_name:
            return None
        return (short_name, display_name, country)
    except Exception as e:
        logger.error(f"Error reverse-geocoding ({lat}, {lon}): {e}")
        return None


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


def _news_slug_for_url(url: str, cursor, exclude_id: Optional[int] = None) -> str:
    """Return a unique slug for `url`, suffixing -2/-3/… on collisions.

    `cursor` is used to check the news_articles table for existing slugs.
    `exclude_id` lets the backfill UPDATE skip the row's own current slug.
    Never raises — returns "" if the URL is empty.
    """
    from parsers.spaceflightnow import SpaceflightNowParser
    base = SpaceflightNowParser.slug_from_url(url)
    if not base:
        return ""
    slug = base
    n = 1
    while True:
        if exclude_id is not None:
            cursor.execute(
                "SELECT 1 FROM news_articles WHERE slug = %s AND id != %s",
                (slug, exclude_id)
            )
        else:
            cursor.execute("SELECT 1 FROM news_articles WHERE slug = %s", (slug,))
        if not cursor.fetchone():
            return slug
        n += 1
        slug = f"{base}-{n}"
        if n > 99:  # pathological — give up and tie-break with a hash
            import hashlib
            slug = f"{base}-{hashlib.md5(url.encode('utf-8')).hexdigest()[:6]}"
            return slug


def ingest_news_articles(articles: list) -> int:
    """Store new SpaceflightNow articles into the website news archive.

    Idempotent: skips URLs already present (UNIQUE idx_news_url + a prior
    SELECT). Translates title+excerpt to UK in one DeepL batch (local import
    to avoid coupling database.py -> translator at module load). The article
    body (English, from the RSS ``content:encoded``) and hero image are taken
    from the item dict — no per-article HTTP fetch here. ``body_uk`` is left
    NULL and translated lazily on first article-page view (DeepL quota: full
    bodies for every new article would exceed the 500k/month free limit).
    Returns the number of newly inserted articles. Raises nothing on DB
    failure: the scheduler / web layer wrap this in try/except."""
    if not articles:
        return 0
    from utils.translator import Translator

    inserted = 0
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        for a in articles:
            url = (a.get('url') or '').strip()
            if not url:
                continue
            cursor.execute('SELECT 1 FROM news_articles WHERE url = %s', (url,))
            if cursor.fetchone():
                continue
            title = (a.get('title') or '').strip()
            excerpt = (a.get('excerpt') or '').strip()
            # Batch-translate title + excerpt (skips empty/short internally).
            trans = Translator.translate_batch([title, excerpt], 'uk')
            title_uk = trans[0] if len(trans) > 0 else ''
            excerpt_uk = trans[1] if len(trans) > 1 else ''
            # Public slug for /news/<slug> (unique, suffix on collision).
            slug = _news_slug_for_url(url, cursor)
            # Body (EN) + hero image come straight from the RSS feed item — no
            # extra HTTP fetch. body_uk stays NULL (lazy translation on view).
            body = (a.get('body') or '').strip()
            image = (a.get('image') or '').strip()
            cursor.execute(
                '''INSERT INTO news_articles
                   (url, slug, title, title_uk, excerpt, excerpt_uk, body,
                    image, category, category_raw, published_date)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)''',
                (url, slug, title, title_uk or None, excerpt or None, excerpt_uk or None,
                 body or None, image or None, a.get('category_bucket') or 'missions',
                 (a.get('category') or '')[:120] or None, a.get('date') or None)
            )
            inserted += 1
        conn.commit()
        if inserted:
            logger.info(f"Ingested {inserted} new news article(s) into archive")
    except Error as e:
        logger.error(f"Error ingesting news articles: {e}")
        conn.rollback()
    finally:
        cursor.close()
        conn.close()
    return inserted


def get_news_articles(limit: int = 60) -> list:
    """Return the most recent archived news articles (newest first) as dicts.
    Returns [] on any DB error (never raises) so the web layer can fall back
    to a live SpaceflightNow fetch."""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            '''SELECT id, url, slug, title, title_uk, excerpt, excerpt_uk, image,
                      category, category_raw, published_date, source, fetched_at
               FROM news_articles ORDER BY fetched_at DESC LIMIT %s''',
            (limit,)
        )
        return list(cursor.fetchall())
    except Error as e:
        logger.error(f"Error reading news articles: {e}")
        return []
    finally:
        cursor.close()
        conn.close()


def get_news_article(article_id: int) -> Optional[dict]:
    """Return a single archived article (all columns) by id, or None if not
    found / DB error."""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute('SELECT * FROM news_articles WHERE id = %s', (article_id,))
        return cursor.fetchone()
    except Error as e:
        logger.error(f"Error reading news article {article_id}: {e}")
        return None
    finally:
        cursor.close()
        conn.close()


def get_news_article_by_slug(slug: str) -> Optional[dict]:
    """Return a single archived article (all columns) by its public slug, or
    None if not found / DB error. This is the key for the /news/<slug> page."""
    if not slug:
        return None
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute('SELECT * FROM news_articles WHERE slug = %s', (slug,))
        return cursor.fetchone()
    except Error as e:
        logger.error(f"Error reading news article by slug {slug}: {e}")
        return None
    finally:
        cursor.close()
        conn.close()


def get_related_news_articles(category: str, exclude_slug: str, limit: int = 3) -> list:
    """Return up to `limit` same-category articles (newest first), excluding the
    one identified by `exclude_slug`. Falls back to any-category if fewer than
    `limit` same-category results. Returns [] on DB error (never raises)."""
    if not category:
        category = 'missions'
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            '''SELECT id, url, slug, title, title_uk, excerpt, excerpt_uk, image,
                      category, published_date, source
               FROM news_articles
               WHERE category = %s AND slug != %s AND slug != ''
               ORDER BY fetched_at DESC LIMIT %s''',
            (category, exclude_slug or '', limit)
        )
        rows = list(cursor.fetchall())
        # Top up from other categories if not enough same-category matches.
        if len(rows) < limit:
            have = {r.get('slug') for r in rows}
            have.add(exclude_slug)
            placeholders = ",".join(["%s"] * len(have)) if have else "''"
            cursor.execute(
                f'''SELECT id, url, slug, title, title_uk, excerpt, excerpt_uk, image,
                          category, published_date, source
                   FROM news_articles
                   WHERE slug != '' AND slug NOT IN ({placeholders})
                   ORDER BY fetched_at DESC LIMIT %s''',
                list(have) + [limit - len(rows)]
            )
            rows.extend(cursor.fetchall())
        return rows[:limit]
    except Error as e:
        logger.error(f"Error reading related news articles: {e}")
        return []
    finally:
        cursor.close()
        conn.close()


def set_news_article_body(article_id: int, body: str, body_uk: str, image: Optional[str]) -> None:
    """Persist the lazily-fetched article body + hero image. Best-effort."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            '''UPDATE news_articles SET body = %s, body_uk = %s, image = COALESCE(%s, image)
               WHERE id = %s''',
            (body or None, body_uk or None, image or None, article_id)
        )
        conn.commit()
    except Error as e:
        logger.error(f"Error saving news article body {article_id}: {e}")
        conn.rollback()
    finally:
        cursor.close()
        conn.close()


def ingest_apod_entries(entries: list) -> int:
    """Mirror NASA APOD entries into the website photo archive.

    Idempotent by ``date`` (PK): a row that already has both ``thumb_path`` and
    ``full_path`` is skipped entirely; a row missing its images is re-fetched
    (retry on a previous failed download). The explanation is translated to UK
    **once** — never retranslated on a re-ingest that already has
    ``explanation_uk`` (DeepL quota). Image download + translation use local
    imports to avoid coupling database.py at module load. Best-effort: image
    download failure still stores the row (without paths) so the next poll
    retries. Raises nothing on DB failure. Returns the number of new/updated
    rows.
    """
    if not entries:
        return 0
    from services.apod_images import download_apod_media
    from utils.translator import Translator

    changed = 0
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        for e in entries:
            date = (e.get('date') or '').strip()
            if not date:
                continue
            cursor.execute(
                'SELECT thumb_path, full_path, explanation_uk FROM apod_entries WHERE date = %s',
                (date,)
            )
            existing = cursor.fetchone()
            # Skip only if both image sizes are already mirrored locally.
            if existing and existing.get('thumb_path') and existing.get('full_path'):
                continue

            media_type = (e.get('media_type') or 'image').lower()
            # Best-effort local image mirror; row is stored even on failure.
            try:
                full_rel, thumb_rel = download_apod_media(e)
            except Exception as ex:  # never let image failure abort ingest
                logger.error(f"APOD image download error for {date}: {ex}")
                full_rel, thumb_rel = None, None

            # Translate explanation once (reuse stored translation if present).
            explanation = (e.get('explanation') or '').strip()
            if existing and existing.get('explanation_uk'):
                explanation_uk = existing['explanation_uk']
            elif explanation:
                try:
                    explanation_uk = Translator.translate(explanation, 'en', 'uk') or None
                except Exception:
                    explanation_uk = None
            else:
                explanation_uk = None

            video_url = (e.get('url') or '').strip() if media_type == 'video' else None
            credit = (e.get('copyright') or '').strip() or None
            title = (e.get('title') or '').strip() or ''

            cursor.execute(
                '''INSERT INTO apod_entries
                   (date, title, explanation, explanation_uk, media_type,
                    thumb_path, full_path, video_url, credit)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                   ON DUPLICATE KEY UPDATE
                     title = VALUES(title),
                     explanation = VALUES(explanation),
                     media_type = VALUES(media_type),
                     video_url = VALUES(video_url),
                     credit = VALUES(credit),
                     thumb_path = COALESCE(VALUES(thumb_path), thumb_path),
                     full_path = COALESCE(VALUES(full_path), full_path),
                     explanation_uk = COALESCE(explanation_uk, VALUES(explanation_uk))''',
                (date, title, explanation or None, explanation_uk, media_type,
                 thumb_rel, full_rel, video_url, credit)
            )
            changed += 1
        conn.commit()
        if changed:
            logger.info(f"Ingested/updated {changed} APOD entry/entries")
    except Error as e:
        logger.error(f"Error ingesting APOD entries: {e}")
        conn.rollback()
    finally:
        cursor.close()
        conn.close()
    return changed


def get_apod_entries(start: str, end: str) -> Optional[list]:
    """Return archived APOD entries for ``[start, end]`` (newest first) as
    dicts. Returns ``None`` on DB error (so the web layer falls back to a live
    NASA fetch) and ``[]`` if the window is empty/not yet backfilled.
    """
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute(
            '''SELECT date, title, explanation, explanation_uk, media_type,
                      thumb_path, full_path, video_url, credit
               FROM apod_entries
               WHERE date BETWEEN %s AND %s
               ORDER BY date DESC''',
            (start, end)
        )
        return list(cursor.fetchall())
    except Error as e:
        logger.error(f"Error reading APOD entries: {e}")
        return None
    finally:
        cursor.close()
        conn.close()


def backfill_apod_archive(days: int = 90) -> int:
    """One-shot backfill of the last ``days`` of APOD into the archive.

    Fetches ``[today - days, yesterday]`` from NASA in <=60-day chunks (NASA
    caps a single APOD range request) and ingests each chunk (downloading +
    translating as it goes). Run once manually after deploy; the daily poll
    keeps it fresh thereafter. Returns the total number of ingested/updated
    rows. Raises nothing — best-effort.
    """
    from services.nasa_api import NasaAPI
    from datetime import date, timedelta

    today = date.today()
    start = today - timedelta(days=days)
    end = today - timedelta(days=1)  # NASA 400s on today if not published yet.
    total = 0
    cursor_date = start
    while cursor_date <= end:
        chunk_end = min(cursor_date + timedelta(days=59), end)
        try:
            entries = NasaAPI.get_apod_archive(cursor_date.isoformat(), chunk_end.isoformat())
            if entries:
                total += ingest_apod_entries(entries)
        except Exception as ex:
            logger.error(f"APOD backfill chunk {cursor_date}..{chunk_end} error: {ex}")
        cursor_date = chunk_end + timedelta(days=1)
    logger.info(f"APOD backfill of {days} days done: {total} entries ingested/updated")
    return total


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


def is_storm_notified(kp_value: float, observation_time: str) -> bool:
    """Check if geomagnetic storm notification was already sent"""
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            'SELECT 1 FROM storm_notifications WHERE kp_value = %s AND observation_time = %s',
            (kp_value, observation_time)
        )
        return cursor.fetchone() is not None
    except Error as e:
        logger.error(f"Error checking storm notification: {e}")
        return False
    finally:
        cursor.close()
        conn.close()


def mark_storm_notified(kp_value: float, observation_time: str, g_scale: str):
    """Mark geomagnetic storm notification as sent"""
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            'INSERT INTO storm_notifications (kp_value, observation_time, g_scale) VALUES (%s, %s, %s)',
            (kp_value, observation_time, g_scale)
        )
        conn.commit()
    except Error as e:
        logger.error(f"Error marking storm notification: {e}")
        conn.rollback()
    finally:
        cursor.close()
        conn.close()


def cleanup_old_storm_notifications(days: int = 7):
    """Remove old storm notifications (older than N days)"""
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            'DELETE FROM storm_notifications WHERE notified_at < DATE_SUB(NOW(), INTERVAL %s DAY)',
            (days,)
        )
        conn.commit()
        logger.info(f"Cleaned up {cursor.rowcount} old storm notifications")
    except Error as e:
        logger.error(f"Error cleaning up storm notifications: {e}")
        conn.rollback()
    finally:
        cursor.close()
        conn.close()


def is_grb_notified(grb_name: str) -> bool:
    """Check if GRB notification was already sent"""
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            'SELECT 1 FROM grb_notifications WHERE grb_name = %s',
            (grb_name,)
        )
        return cursor.fetchone() is not None
    except Error as e:
        logger.error(f"Error checking GRB notification: {e}")
        return False
    finally:
        cursor.close()
        conn.close()


def mark_grb_notified(grb_name: str, circular_id: str):
    """Mark GRB notification as sent"""
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            'INSERT INTO grb_notifications (grb_name, circular_id) VALUES (%s, %s)',
            (grb_name, circular_id)
        )
        conn.commit()
    except Error as e:
        logger.error(f"Error marking GRB notification: {e}")
        conn.rollback()
    finally:
        cursor.close()
        conn.close()


def cleanup_old_grb_notifications(days: int = 30):
    """Remove old GRB notifications (older than N days)"""
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            'DELETE FROM grb_notifications WHERE notified_at < DATE_SUB(NOW(), INTERVAL %s DAY)',
            (days,)
        )
        conn.commit()
        logger.info(f"Cleaned up {cursor.rowcount} old GRB notifications")
    except Error as e:
        logger.error(f"Error cleaning up GRB notifications: {e}")
        conn.rollback()
    finally:
        cursor.close()
        conn.close()
