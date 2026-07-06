# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

NEOwatch Bot is a Ukrainian-language Telegram bot for space tracking: asteroids, ISS position and passes, rocket launches, aurora forecasts, ISS crew, Starlink satellite visibility, space weather, and meteor showers. The bot interface uses Ukrainian text with emoji buttons.

## Development Commands

```bash
# Run bot only (legacy, no website)
python3 bot.py

# Run website + bot in one process (production entrypoint)
python3 -m uvicorn web.app:app --host 0.0.0.0 --port 8000
# Site-only dev (no bot/DB needed): BOT_TOKEN= python3 -m uvicorn web.app:app --port 8000

# Or use the startup script
./start.sh

# Install dependencies
pip install -r requirements.txt

# Production deployment uses systemd (see DEPLOY.md)
sudo systemctl restart neowatch
sudo journalctl -u neowatch -f
```

## Architecture

### Website + Bot (`web/`, one process)
FastAPI serves the public dashboard and runs the Telegram bot on a single
event loop (uvicorn owns the loop; the bot is started via PTB's async lifecycle
inside the FastAPI `lifespan`). If the DB or bot token is unavailable, the site
keeps serving the public dashboard (weather/sky/launches don't need the DB).

- `web/app.py` - FastAPI app, `lifespan` boots bot + scheduler, mounts static site
- `web/api.py` - `/api/*` JSON routes (thin; consumed by `site/assets/app.js`)
- `web/data.py` - structured data layer. The bot's `services/*` return
  Telegram-formatted *text*; this module reuses their internal raw-data helpers
  (e.g. `SpaceWeatherAPI._get_kp_index`) to produce JSON for the site. Sync
  `requests` calls are wrapped in `asyncio.to_thread` by the API layer.
- `web/cache.py` - in-memory TTL cache shared with the bot (NOAA/N2YO/NASA are
  rate-limited). Module-level dict; repopulates on restart.
- `site/` - static HTML templates (moved from `site_template/`) + `assets/`
  (`neowatch.css`, `starfield.js`, `app.js`, `sat-map.js`, `dome.js`). Templates
  keep placeholder content; `app.js` progressively enhances them via
  `fetch('/api/...')`. One shared `app.js` runs on every page; loaders no-op
  unless their hook element exists. Location is stored in `localStorage`
  (`neowatch.loc`) and the `.loc-pill .chg` "Змінити" link opens a picker backed
  by `/api/geocode`. `saveLoc`/`clearLoc` dispatch a `neowatch:loc` window event
  so the live sky-dome (`dome.js`) and satellite maps can refetch for the new
  observer location.
- `site/assets/dome.js` - homepage sky-dome radar: polar alt/az plot of the
  naked-eye planets (from `/api/planets`, numeric `alt`/`az`) + the ISS
  (client-side TLE look-angles via `satellite.js`). Objects below the horizon
  are hidden; planets refresh every 60 s, the ISS dot every 3 s.

Site API endpoints (`web/api.py`), all GET, cached in `web/cache.py`:
- `/api/weather` — Kp, solar wind, Bz, X-ray, aurora chance (NOAA SWPC)
- `/api/weather/series` — chart time-series for the space-weather page: Kp
  history (7 d, 3-hourly), Kp forecast (3 d, hourly, observed flag), solar wind
  speed & Bz (last ~4 h, 1-min), GOES X-ray flux (6 h), plus the NOAA OVATION
  aurora-map URL. Arrays are `[epoch_ms, value]` (forecast adds an `observed`
  bool). Cached 5 min. `weather.html` renders them with Chart.js
  (`site/assets/space-weather.js`); a storm banner shows when Kp ≥ 5.
- `/api/launches` — upcoming launches (Launch Library 2)
- `/api/iss/passes?lat&lon` — next visible ISS passes (N2YO; defaults to Kyiv)
- `/api/iss/now` — current ISS ground position (N2YO)
- `/api/iss/crew` — crew count + expedition (corquaid API)
- `/api/sky?lat&lon` — tonight digest: ISS pass + top planet + meteor + Moon
- `/api/planets?lat&lon` — all naked-eye planets, altitude/azimuth (skyfield)
- `/api/moon` — phase, illumination, days to full/new
- `/api/neo` — upcoming asteroid close approaches, LD distances (NASA NEO)
- `/api/meteors` — full meteor-shower calendar (peak dates, ZHR, radiant,
  best time, status). Reuses `MeteorShower.get_upcoming_showers`; status text
  from `get_shower_status` is HTML-stripped for the web. `meteors.html`.
- `/api/events` — astronomical events: `next_eclipse` (`get_next_eclipse`),
  `eclipses[]` + `conjunctions[]` (`get_upcoming_events`, 365 d), and a
  structured `weekly[]` digest of the next 7 days rebuilt from the same
  internal pieces as `astronomy.get_weekly_calendar` (conjunctions, meteor
  maxima, Moon phases incl. supermoon via `_is_supermoon`, planet retrograde
  stations via `_detect_retrogrades`, eclipses) — but returning plain dicts
  instead of Telegram text. `events.html`.
- `/api/mars` — Mars weather from the NASA InSight feed
  (`MoonMarsAPI.get_mars_weather`): sol, temp avg/min/max, pressure, wind,
  season. The InSight mission ended in 2022 so the feed returns the last
  available sol; `available:false` is handled. Card in `weather.html`.
- `/api/debris` — curated space-debris stats (ESA Space Environment Report)
  via `SpaceDebrisAPI.get_stats_dict` — structured sibling of the bot's
  text `get_stats`. `deep.html`.
- `/api/grb?limit=` — recent gamma-ray burst alerts from NASA GCN Circulars
  (`GRBAlertAPI.get_recent_grbs`). `deep.html`.
- `/api/voyager` — Voyager 1/2 propagated distances/speeds/light-time
- `/api/geocode?q=` — city search (Nominatim proxy via `database.get_city_suggestions`)
- `/api/tle?group=&limit=` — TLE set for a satellite group (Celestrak), for
  client-side propagation. `group` is a key from `/api/tle/groups`. Most groups
  use `gp.php?GROUP=`; Starlink uses the supplemental `sup-gp.php?FILE=starlink`
  feed (the main `GROUP=starlink` feed is heavily throttled per-IP per-2h, the
  supplemental feed is not). Celestrak 403 "not updated since last download" is
  handled with a stash+fallback in `web/data.py` (`_TLE_STASH`), now persisted to
  `data/tle_stash/` so a server restart doesn't blank the map while Celestrak's
  2-hour window is still closed.
- `/api/tle/groups` — registry of satellite groups (key/label/color/icon) for the map UI.

Interactive maps (`site/assets/sat-map.js`, Leaflet + `satellite.js` via CDN):
the browser propagates each satellite's TLE itself every second (SGP4) so
markers move in real time with no per-frame API calls. Click a marker for a
popup (name, NORAD id, altitude, velocity, subpoint). `iss.html` shows the
station only (follow + ground track + visibility footprint); `satellites.html`
has a group-selector chip bar toggling Celestrak groups (Starlink, visual,
stations, weather, GPS, geo, amateur, …) on/off.

Content pages (each progressively enhanced by the shared `app.js`, which no-ops
unless its hook element is present): `meteors.html` (`#meteor-grid` ←
`/api/meteors`), `events.html` (`#next-eclipse`/`#eclipses-list`/
`#conjunctions-list`/`#weekly-events` ← `/api/events`), and `deep.html`
("Дальній космос" hub: `#debris-stats`/`#grb-list` ← `/api/debris`+`/api/grb`,
plus cards linking to `voyager.html`). Mars weather is a section in
`weather.html` (`#mars-card` ← `/api/mars`).

### Entry Point (`bot.py`)
- Creates `Application` with `BOT_TOKEN`
- Registers handlers from `handlers/` module
- Initializes database via `init_db()`
- Starts `NotificationScheduler` as background task in `post_init`
- Legacy bot-only entrypoint; production uses `uvicorn web.app:app` (see above)

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
MARS_VISTA_API_KEY= # Optional. Free key from marsvista.dev/signin (Mars rover photos)
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
- **Skyfield ephemeris**: `services/planets.py` and `services/astronomy.py` use the `skyfield` library for offline ephemeris (visible planets, retrogrades, supermoon). JPL `de440s.bsp` (~32 MB) downloads on first use into `data/` (gitignored); pre-fetch on deploy via `python3 -c "from skyfield.api import Loader; load=Loader('data'); load('de440s.bsp'); load.timescale()"`. See DEPLOY.md §7a.
- **Mars rover photos**: `services/mars_rover.py` uses the community **Mars Vista API** (`api.marsvista.dev`, `X-API-Key` header). The former NASA Mars Rover Photos API at `api.nasa.gov/mars-photos` was retired (404 "No such app"). Requires `MARS_VISTA_API_KEY`; without it the 🚀 Марсоходи button shows a "key not configured" hint.

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
