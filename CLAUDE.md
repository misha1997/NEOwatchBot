# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

NEOwatch Bot is a Ukrainian-language Telegram bot for space tracking: asteroids, ISS position and passes, rocket launches, aurora forecasts, ISS crew, Starlink satellite visibility, space weather, and meteor showers. The bot interface uses Ukrainian text with emoji buttons.

## Development Commands

```bash
# Run locally (requires .env with API keys)
python3 bot.py

# Or use the startup script
./start.sh

# Install dependencies
pip install -r requirements.txt

# Production deployment uses systemd (see DEPLOY.md)
sudo systemctl restart neowatch
sudo journalctl -u neowatch -f
```

## Architecture

### Entry Point (`bot.py`)
- Creates `Application` with `BOT_TOKEN`
- Registers handlers from `handlers/` module
- Initializes database via `init_db()`
- Starts `NotificationScheduler` as background task in `post_init`

### Handler Structure (`handlers/`)
- `commands.py` - `/start`, `/help` command handlers
- `callbacks.py` - Inline keyboard button handlers (main UI router)
- `messages.py` - Text message handlers (city input)

The main menu keyboard is defined in `CallbackHandlers.get_main_menu()` with callback_data routing to handler methods.

### Services (`services/`)
External API wrapper classes with static methods:
- `NasaAPI` - NASA NEO (asteroids), APOD (photo of the day), and hazardous asteroid tracking
- `N2YOAPI` - ISS position, passes, and Starlink tracking
- `LaunchAPI` - Rocket launches from Launch Library 2
- `SpaceWeatherAPI` - Aurora/noaa space weather
- `ISSCrewAPI` - Current ISS crew
- `MeteorShower` - Meteor shower data and tracking

### Parsers (`parsers/`)
HTML parsers for external websites:
- `SpaceflightNowParser` - Parses launch schedule and news articles from spaceflightnow.com

### Database (`database.py`)
MySQL with connection pooling:
- `users` table - user profiles, locations, subscription flags (iss, apod, launches, neo, news, meteors)
- `iss_passes` table - pass history
- `launch_notifications` table - tracks notified launches
- `neo_notifications` table - tracks notified hazardous asteroids
- `news_notifications` table - tracks sent news articles
- `meteor_notifications` table - tracks sent meteor shower notifications
- Connection pool initialized lazily in `get_db_connection()`
- All functions handle connection cleanup in `finally` blocks

### Scheduler (`services/scheduler.py`)
`NotificationScheduler` runs as async background task:
- **09:00** - APOD (Astronomy Picture of the Day)
- **10:00** - Daily news digest from Spaceflightnow (translated to Ukrainian)
- **22:00** - Meteor shower reminders (1 day before and on peak day)
- Every 10 minutes - ISS pass notifications (10 min before visible pass)
- Every 5 minutes - Launch notifications (24h, 2h, 30min before)
- Every hour - Hazardous asteroid check

Duplicate prevention uses database tracking for all notification types.

### Translation (`utils/translator.py`)
- `Translator.translate()` - Uses MyMemory API (free, 1000 words/day)
- `Translator.translate_apod()` - Translates APOD descriptions to Ukrainian
- `Translator.translate_news()` - Translates news titles and excerpts

## Configuration

Environment variables in `.env`:
```
NASA_API_KEY=      # From api.nasa.gov
N2YO_API_KEY=      # From n2yo.com
BOT_TOKEN=         # From @BotFather
DB_HOST/PORT/NAME/USER/PASSWORD  # MySQL credentials
```

## Key Implementation Details

- **User location**: Users set city via text message, geocoded via OpenStreetMap Nominatim
- **ISS tracking**: N2YO API returns pass data with UTC timestamps converted to local time
- **Country detection**: `COUNTRY_BBOXES` in `utils/constants.py` maps coordinates to country names
- **APOD handling**: Videos sent via `send_video`, images via `send_photo`; long captions split across two messages
- **Starlink tracking**: Checks multiple NORAD IDs from `STARLINK_NORAD_IDS` in config
- **News translation**: Automatic translation of Spaceflightnow articles to Ukrainian
- **Meteor showers**: Notifications at 22:00 (10 PM) - 1 day before peak and on peak day

## Database Schema

```sql
users:
  user_id (BIGINT PK), chat_id, username, first_name, last_name
  city, lat (DECIMAL), lon (DECIMAL)
  subscribed_iss, subscribed_apod, subscribed_launches (BOOLEAN)
  subscribed_neo, subscribed_news, subscribed_meteors (BOOLEAN)
  last_iss_pass, last_apod_date

iss_passes:
  id (AUTO_INCREMENT), user_id (FK), pass_time, duration, max_elevation, notified

launch_notifications:
  id, launch_id, notification_type, notified_at

neo_notifications:
  id, asteroid_id, approach_date, notified_at

news_notifications:
  id, article_url, article_title, notified_at

meteor_notifications:
  id, shower_name, peak_date, notification_type, notified_at
```

## Notification Schedule

| Time | Event | Type |
|------|-------|------|
| 09:00 | APOD | Daily |
| 10:00 | Space news | Daily |
| 22:00 | Meteor showers | Before peak |
| Every 10 min | ISS passes | Real-time |
| Every 5 min | Launches | Real-time |
| Every hour | Hazardous asteroids | Real-time |

## Dependencies

Key packages from `requirements.txt`:
- `python-telegram-bot[job-queue]` - Bot framework with async support
- `mysql-connector-python` - MySQL connection pooling
- `requests` - HTTP for external APIs
- `fuzzywuzzy` + `python-Levenshtein` - String matching for city search
