"""Scheduled jobs - APOD daily, ISS passes, Launch notifications"""
import logging
import asyncio
from datetime import datetime, timedelta, timezone
from typing import List, Set
from zoneinfo import ZoneInfo
from telegram import Bot
from telegram.constants import ParseMode

KYIV_TZ = ZoneInfo('Europe/Kyiv')

from config import BOT_TOKEN
from services import LaunchAPI
from services.meteor_shower import MeteorShower
from services.space_weather import SpaceWeatherAPI
from services.grb_alerts import GRBAlertAPI
from parsers import SpaceflightNowParser, NewsParser
from utils.translator import Translator
from database import (
    get_apod_subscribers, get_launch_subscribers, get_iss_subscribers, get_neo_subscribers, get_news_subscribers, get_meteor_subscribers, get_flare_subscribers, get_grb_subscribers,
    update_last_apod_date, update_last_iss_pass,
    is_launch_notified, mark_launch_notified, cleanup_old_launch_notifications,
    is_neo_notified, mark_neo_notified, cleanup_old_neo_notifications,
    is_news_notified, mark_news_notified, cleanup_old_news_notifications,
    ingest_news_articles, get_news_articles,
    ingest_apod_entries,
    ingest_galaxies, ingest_galaxy_photos,
    is_meteor_notified, mark_meteor_notified, cleanup_old_meteor_notifications,
    is_flare_notified, mark_flare_notified, cleanup_old_flare_notifications,
    is_storm_notified, mark_storm_notified, cleanup_old_storm_notifications,
    is_grb_notified, mark_grb_notified, cleanup_old_grb_notifications,
    get_push_subscriptions, delete_push_subscription, update_push_last_iss_pass
)
from services import NasaAPI, N2YOAPI
from services.webpush import send_web_push
from utils.i18n import t, pick, compass_dir, normalize_lang, escape_html
from utils.constants import local_hour_for_coords
from web.seo import SITE_URL, slug_for_name

logger = logging.getLogger(__name__)


class NotificationScheduler:
    """Handle scheduled notifications"""

    def __init__(self):
        self.bot = Bot(token=BOT_TOKEN)
        self._last_apod_date = None  # Track last APOD sent
        self._notified_launches: Set[str] = set()  # Track notified launches
        self._notified_eclipses = set()  # Track notified astronomy events

    @staticmethod
    def _is_quiet_hours_for(user: dict) -> bool:
        """Per-user quiet-hours check.

        Evaluated in the user's own local time (derived from their saved
        lat/lon via local_hour_for_coords), not a single Kyiv-wide window —
        so a user in Tokyo doesn't get woken at their 9am because it's still
        night in Kyiv. Falls back to the (enabled, 00-06) default preset —
        the previous hardcoded behavior — for users who haven't set one.
        """
        if not user.get('quiet_hours_enabled', True):
            return False
        start = user.get('quiet_start')
        end = user.get('quiet_end')
        start = 0 if start is None else int(start)
        end = 6 if end is None else int(end)
        if start == end:
            return False
        hour = local_hour_for_coords(user.get('lat'), user.get('lon'))
        if start < end:
            return start <= hour < end
        return hour >= start or hour < end  # window wraps midnight

    @staticmethod
    async def _notify_push_subscribers(type_column: str, build_message):
        """Fan out a browser push notification to every push_subscriptions
        row with <type_column> = TRUE — the site's counterpart to the
        Telegram-send loops below, sharing the same trigger/dedup logic.
        `build_message(lang)` -> (title, body, url). Deletes a subscription
        if the push service reports it's gone (uninstalled browser, etc).
        """
        try:
            subs = get_push_subscriptions(type_column)
        except Exception as e:
            logger.error(f"Failed to load push subscribers ({type_column}): {e}")
            return
        for sub in subs:
            try:
                lang = normalize_lang(sub.get('lang'))
                title, body, url = build_message(lang)
                result = send_web_push(sub, title, body, url)
                if result == 'gone':
                    delete_push_subscription(sub['endpoint'])
            except Exception as e:
                logger.error(f"Push notify failed for subscription {sub.get('id')}: {e}")

    async def send_apod_to_subscribers(self):
        """Send APOD to all subscribers - once per day"""
        try:
            today = datetime.now().strftime('%Y-%m-%d')

            # Skip if already sent today
            if self._last_apod_date == today:
                logger.info(f"APOD already sent today ({today})")
                return

            subscribers = get_apod_subscribers()
            data = NasaAPI.get_apod()

            if not data:
                logger.error("Failed to get APOD data")
                return

            apod_date = data.get('date', today)

            if not subscribers:
                logger.info("No APOD subscribers")
                return

            success_count = 0
            for user in subscribers:
                try:
                    chat_id = user.get('chat_id')
                    user_last_apod = user.get('last_apod_date')
                    lang = normalize_lang(user.get('lang'))

                    # Skip if user already got today's APOD
                    if user_last_apod == apod_date:
                        continue

                    # Format APOD in the user's language (image URL is the
                    # same regardless of language; caption/text differ).
                    formatted = NasaAPI.format_apod(data, lang)

                    # Send based on media type
                    media_type = data.get('media_type', 'image')

                    if media_type == 'video':
                        # Direct video files (NASA-hosted mp4 etc.) can be sent
                        # as real Telegram videos; YouTube/other embed links
                        # can't ("Wrong type of the web page content") — those
                        # fall back to a thumbnail (if NASA provided one) plus
                        # a clickable link. Each send attempt is wrapped on
                        # its own so a failed photo/video never skips the
                        # text+link message that follows (previously an
                        # exception here — e.g. no thumbnail, so `photo` was
                        # the raw video URL — aborted delivery for that user
                        # entirely, with no fallback and no dedup update).
                        video_url = formatted.get('video_url') or ''
                        clean_url = video_url.split('?')[0].lower()
                        is_direct_video = clean_url.endswith(('.mp4', '.mov', '.avi', '.mkv', '.webm'))

                        sent_media = False
                        if is_direct_video:
                            try:
                                await self.bot.send_video(
                                    chat_id=chat_id,
                                    video=video_url,
                                    caption=formatted['caption'][:1024],
                                    parse_mode=ParseMode.HTML,
                                    supports_streaming=True
                                )
                                sent_media = True
                            except Exception as e:
                                logger.warning(f"APOD send_video failed for {chat_id}: {e}")

                        if not sent_media:
                            thumb = formatted.get('image')
                            if thumb:
                                try:
                                    await self.bot.send_photo(
                                        chat_id=chat_id,
                                        photo=thumb,
                                        caption=formatted['caption'][:1024],
                                        parse_mode=ParseMode.HTML
                                    )
                                except Exception as e:
                                    logger.warning(f"APOD send_photo (video thumb) failed for {chat_id}: {e}")

                        link_line = (
                            f"\n🎬 <a href='{video_url}'>{t('apod.watch_video', lang)}</a>\n"
                            if video_url else ''
                        )
                        await self.bot.send_message(
                            chat_id=chat_id,
                            text=formatted['text'] + link_line,
                            parse_mode=ParseMode.HTML
                        )
                    else:
                        # Send photo
                        await self.bot.send_photo(
                            chat_id=chat_id,
                            photo=formatted['image'],
                            caption=formatted['caption'][:1024],
                            parse_mode=ParseMode.HTML
                        )

                        # Send description as separate message
                        await self.bot.send_message(
                            chat_id=chat_id,
                            text=formatted['text'],
                            parse_mode=ParseMode.HTML
                        )

                    # Update last sent date
                    update_last_apod_date(user['user_id'], apod_date)
                    success_count += 1

                except Exception as e:
                    logger.error(f"Failed to send APOD to {user.get('user_id')}: {e}")

            self._last_apod_date = apod_date
            logger.info(f"Sent APOD to {success_count}/{len(subscribers)} subscribers")

        except Exception as e:
            logger.error(f"APOD scheduler error: {e}")

    @staticmethod
    def _compass_to_uk(compass: str) -> str:
        """Convert English compass direction to Ukrainian (legacy wrapper).

        Kept for backward compatibility; new code should use ``compass_dir``.
        """
        return compass_dir(compass, 'uk')

    async def check_iss_passes(self):
        """Check for upcoming ISS passes and notify subscribers"""
        try:
            logger.info("Checking ISS passes...")
            subscribers = get_iss_subscribers()

            if not subscribers:
                logger.info("No ISS subscribers")
                return

            now_kyiv = datetime.now(KYIV_TZ)

            for user in subscribers:
                try:
                    user_id = user['user_id']
                    chat_id = user['chat_id']
                    lang = normalize_lang(user.get('lang'))
                    lat = user.get('lat')
                    lon = user.get('lon')

                    if lat is None or lon is None:
                        continue

                    if self._is_quiet_hours_for(user):
                        continue

                    min_magnitude = user.get('iss_min_magnitude')
                    if min_magnitude is not None:
                        min_magnitude = float(min_magnitude)

                    # Get upcoming passes
                    passes = N2YOAPI.get_iss_passes_raw(lat, lon, days=2)

                    if not passes or 'passes' not in passes:
                        continue

                    for iss_pass in passes['passes']:
                        # Convert UTC timestamp to Kyiv time
                        pass_time_utc = datetime.fromtimestamp(
                            iss_pass['startUTC'], tz=timezone.utc
                        )
                        pass_time_kyiv = pass_time_utc.astimezone(KYIV_TZ)
                        time_until = (pass_time_utc - now_kyiv).total_seconds()

                        # Notify if pass is in 5-15 minutes. The window must be
                        # >= the 10-minute check cadence above (now.minute % 10
                        # == 0), otherwise a pass's countdown can step over a
                        # narrower window between two checks and never notify
                        # at all (this happened with the old 600-900s window).
                        if 300 <= time_until <= 900:
                            # Check if already notified about this specific pass
                            current_pass_timestamp = int(iss_pass['startUTC'])
                            last_notified_pass = user.get('last_iss_pass')

                            if last_notified_pass == current_pass_timestamp:
                                logger.info(f"Already notified user {user_id} about ISS pass at {pass_time_kyiv}")
                                continue

                            magnitude = iss_pass.get('mag')

                            # Brightness filter: lower/more negative magnitude
                            # = brighter. Passes with unknown magnitude are
                            # let through even with a filter set — better to
                            # over-notify on missing N2YO data than silently
                            # drop a pass that might be a great one.
                            if (min_magnitude is not None and magnitude is not None
                                    and magnitude > min_magnitude):
                                continue

                            duration = iss_pass.get('duration', 0)
                            max_elevation = iss_pass.get('maxEl', 0)
                            start_dir = compass_dir(iss_pass.get('startAzCompass', 'SW'), lang)
                            max_dir = compass_dir(iss_pass.get('maxAzCompass', ''), lang)
                            end_dir = compass_dir(iss_pass.get('endAzCompass', ''), lang)

                            msg = t('sch.iss.title', lang)
                            msg += t('sch.iss.time', lang,
                                     time=pass_time_kyiv.strftime('%d.%m %H:%M'),
                                     kyiv=t('kyiv_time', lang))
                            msg += t('sch.iss.duration', lang, dur=duration)
                            msg += t('sch.iss.max_el', lang, el=max_elevation)
                            if magnitude is not None:
                                msg += t('sch.iss.brightness', lang, mag=f"{magnitude:.1f}")
                            msg += t('sch.iss.city', lang,
                                     city=user.get('city') or t('sch.iss.city_default', lang))
                            msg += t('sch.iss.direction', lang, dir=start_dir)
                            if max_dir and max_dir != start_dir:
                                msg += f" → {max_dir}"
                            if end_dir and end_dir != start_dir:
                                msg += f" → {end_dir}"
                            msg += "\n"
                            msg += t('sch.iss.look_at', lang, dir=start_dir)

                            await self.bot.send_message(
                                chat_id=chat_id,
                                text=msg,
                                parse_mode=ParseMode.HTML
                            )

                            update_last_iss_pass(user_id, current_pass_timestamp)
                            break  # Only notify about next pass

                except Exception as e:
                    logger.error(f"Failed to check ISS for {user.get('user_id')}: {e}")

            # Web push subscribers (anonymous, own lat/lon) — same per-location
            # pass check as above, deduped via push_subscriptions.last_iss_pass
            # instead of users.last_iss_pass. No brightness filter/quiet hours
            # in v1 (push subscriptions don't carry those columns).
            try:
                push_subs = get_push_subscriptions('subscribed_iss')
            except Exception as e:
                logger.error(f"Failed to load ISS push subscribers: {e}")
                push_subs = []

            for sub in push_subs:
                try:
                    lat = sub.get('lat')
                    lon = sub.get('lon')
                    if lat is None or lon is None:
                        continue

                    passes = N2YOAPI.get_iss_passes_raw(lat, lon, days=2)
                    if not passes or 'passes' not in passes:
                        continue

                    for iss_pass in passes['passes']:
                        pass_time_utc = datetime.fromtimestamp(iss_pass['startUTC'], tz=timezone.utc)
                        time_until = (pass_time_utc - now_kyiv).total_seconds()

                        if 300 <= time_until <= 900:
                            current_pass_timestamp = int(iss_pass['startUTC'])
                            if sub.get('last_iss_pass') == current_pass_timestamp:
                                continue

                            lang = normalize_lang(sub.get('lang'))
                            pass_time_kyiv = pass_time_utc.astimezone(KYIV_TZ)
                            duration = iss_pass.get('duration', 0)
                            max_elevation = iss_pass.get('maxEl', 0)
                            start_dir = compass_dir(iss_pass.get('startAzCompass', 'SW'), lang)

                            if lang == 'en':
                                title = "🛰 The ISS is passing overhead"
                                body = f"{pass_time_kyiv.strftime('%H:%M')} · {duration}s · up to {max_elevation}° · look {start_dir}"
                            else:
                                title = "🛰 МКС пролітає над тобою"
                                body = f"{pass_time_kyiv.strftime('%H:%M')} · {duration}с · до {max_elevation}° · дивись на {start_dir}"
                            url = f"{SITE_URL}{'' if lang == 'en' else '/ua'}/iss"

                            result = send_web_push(sub, title, body, url)
                            if result == 'gone':
                                delete_push_subscription(sub['endpoint'])
                            else:
                                update_push_last_iss_pass(sub['id'], current_pass_timestamp)
                            break  # Only notify about next pass
                except Exception as e:
                    logger.error(f"Failed to check ISS for push subscription {sub.get('id')}: {e}")

            logger.info("ISS check completed")

        except Exception as e:
            logger.error(f"ISS scheduler error: {e}")

    async def check_upcoming_launches(self):
        """Check for launches happening now and notify subscribers"""
        try:
            logger.info("Checking upcoming launches...")

            raw_data = LaunchAPI.get_raw_launches()
            if not raw_data:
                logger.warning("No launch data available from API")
                return

            launches = self._parse_launches(raw_data)

            if not launches:
                logger.info("No upcoming launches to notify about")
                return

            subscribers = get_launch_subscribers()
            if not subscribers:
                logger.info("No launch subscribers")
                return

            now = datetime.now(timezone.utc)
            notified_count = 0

            for launch in launches:
                launch_id = launch.get('id')
                launch_time = launch.get('time')

                if not launch_time or not launch_id:
                    continue

                time_until = (launch_time - now).total_seconds()

                # Notify only at the moment of launch (within -10 to +5 min window,
                # accounting for 5-minute check interval)
                if not (-600 <= time_until <= 300):
                    continue

                notification_type = "now"
                notification_key = f"{launch_id}_{notification_type}"
                if notification_key in self._notified_launches:
                    continue

                if is_launch_notified(launch_id, notification_type):
                    self._notified_launches.add(notification_key)
                    continue

                await self._send_launch_notification(launch, subscribers)
                self._notified_launches.add(notification_key)
                mark_launch_notified(launch_id, notification_type)
                notified_count += 1

            # Cleanup old notifications from database (once per day at 03:00 Kyiv)
            now_kyiv = now.astimezone(KYIV_TZ)
            if now_kyiv.hour == 3 and now_kyiv.minute < 5:
                cleanup_old_launch_notifications(days=7)

            logger.info(f"Launch check completed. Sent {notified_count} notifications.")

        except Exception as e:
            logger.error(f"Launch scheduler error: {e}")

    async def check_hazardous_asteroids(self):
        """Check for hazardous asteroids and notify subscribers.

        Not quiet-hours gated: each asteroid is marked notified once,
        globally, the first time it's seen — if that happened to land in a
        quiet window the alert would be lost forever for every subscriber,
        not just deferred. These are rare enough that an occasional
        off-hours ping beats silently dropping a hazardous-asteroid alert.
        """
        try:
            logger.info("Checking hazardous asteroids...")

            # Get hazardous asteroids for next 7 days
            asteroids = NasaAPI.get_hazardous_asteroids()

            if not asteroids:
                logger.info("No hazardous asteroids found")
                return

            # Get subscribers
            subscribers = get_neo_subscribers()
            if not subscribers:
                logger.info("No NEO subscribers")
                return

            notified_count = 0

            for asteroid in asteroids:
                asteroid_id = asteroid['id']
                approach_date = asteroid['approach_date']

                # Skip if already notified about this asteroid on this date
                if is_neo_notified(asteroid_id, approach_date):
                    continue

                # Raw (language-neutral) asteroid data
                name = asteroid['name']
                distance_km = asteroid['miss_distance_km']
                diameter_min = asteroid['diameter_min']
                diameter_max = asteroid['diameter_max']
                velocity = asteroid['velocity']
                url = asteroid['url']

                # Send to all subscribers, formatted per-user language
                for user in subscribers:
                    try:
                        lang = normalize_lang(user.get('lang'))

                        # Format distance in the user's language
                        if distance_km >= 1_000_000:
                            distance_str = t('sch.neo.dist_mln', lang,
                                             v=f"{distance_km/1_000_000:.2f}")
                        else:
                            distance_str = t('sch.neo.dist_thousands', lang,
                                              v=f"{distance_km/1000:,.0f}".replace(',', ' '))

                        message = t('sch.neo.title', lang)
                        message += t('sch.neo.name', lang, name=name)
                        message += t('sch.neo.approach', lang, date=approach_date)
                        message += t('sch.neo.distance', lang, dist=distance_str)
                        message += t('sch.neo.size', lang, min=diameter_min, max=diameter_max)
                        message += t('sch.neo.velocity', lang,
                                     vel=f"{velocity:,.0f}".replace(',', ' '))
                        message += t('sch.neo.warning', lang)
                        if url:
                            message += t('sch.neo.link', lang, url=url)

                        await self.bot.send_message(
                            chat_id=user['chat_id'],
                            text=message,
                            parse_mode=ParseMode.HTML,
                            disable_web_page_preview=False
                        )
                    except Exception as e:
                        logger.error(f"Failed to notify {user['user_id']} about hazardous asteroid: {e}")

                def build_push_message(lang, name=name, approach_date=approach_date, distance_km=distance_km):
                    dist_str = (f"{distance_km/1_000_000:.2f} млн км" if distance_km >= 1_000_000
                                else f"{distance_km/1000:,.0f}".replace(',', ' ') + " тис. км")
                    if lang == 'en':
                        dist_str = (f"{distance_km/1_000_000:.2f}M km" if distance_km >= 1_000_000
                                    else f"{distance_km/1000:,.0f}".replace(',', ' ') + "K km")
                        return (
                            "☄️ Hazardous asteroid approach",
                            f"{name} · {approach_date} · {dist_str}",
                            SITE_URL + "/asteroids",
                        )
                    return (
                        "☄️ Небезпечний астероїд наближається",
                        f"{name} · {approach_date} · {dist_str}",
                        SITE_URL + "/ua/asteroids",
                    )

                await self._notify_push_subscribers('subscribed_neo', build_push_message)

                # Mark as notified
                mark_neo_notified(asteroid_id, approach_date)
                notified_count += 1
                logger.info(f"Sent hazardous asteroid notification: {name} ({approach_date})")

            logger.info(f"Hazardous asteroid check completed. Notified about {notified_count} asteroids")

            # Cleanup old notifications once per day (at 4 AM Kyiv)
            now = datetime.now(KYIV_TZ)
            if now.hour == 4 and now.minute < 5:
                cleanup_old_neo_notifications(days=30)

        except Exception as e:
            logger.error(f"Hazardous asteroid scheduler error: {e}")

    async def check_solar_flares(self):
        """Check for M-class and X-class solar flares and alert subscribers.

        Not quiet-hours gated — same one-shot global dedup reasoning as
        check_hazardous_asteroids above.
        """
        try:
            logger.info("Checking solar flares...")

            # Check for X-class first (most severe)
            x_flare = SpaceWeatherAPI.check_significant_flare(min_class='X')
            m_flare = None
            if not x_flare:
                # If no X-class, check for M-class
                m_flare = SpaceWeatherAPI.check_significant_flare(min_class='M')

            flare = x_flare or m_flare
            if not flare:
                logger.info("No significant solar flare detected")
                return

            flare_class = flare['class']
            flare_time = flare['time']

            # Check if already notified about this specific flare
            if is_flare_notified(flare_class, flare_time):
                logger.info(f"Already notified about {flare_class}-class flare at {flare_time}")
                return

            # Get dedicated flare subscribers
            subscribers = get_flare_subscribers()
            if not subscribers:
                logger.info("No subscribers for solar flare alerts")
                return

            # Class-level data (language-neutral)
            flare_desc_key = SpaceWeatherAPI.get_flare_description(flare_class)
            emoji = SpaceWeatherAPI.get_flare_emoji(flare_class)

            for user in subscribers:
                try:
                    lang = normalize_lang(user.get('lang'))

                    header = t('sch.flare.x_header' if flare_class == 'X'
                               else 'sch.flare.m_header', lang)
                    consequences = t('sch.flare.consequences_x' if flare_class == 'X'
                                     else 'sch.flare.consequences_m', lang)
                    description = t(f'weather.flare.{flare_desc_key}', lang)
                    flux_str = f"{flare['flux']:.2e}"

                    message = (
                        f"{header}"
                        f"{t('sch.flare.class_line', lang, emoji=emoji, cls=flare_class, desc=description)}"
                        f"{t('sch.flare.flux', lang, flux=flux_str)}"
                        f"{t('sch.flare.time', lang, time=flare_time)}"
                        f"{consequences}\n"
                        f"{t('sch.flare.source', lang)}"
                    )

                    await self.bot.send_message(
                        chat_id=user['chat_id'],
                        text=message,
                        parse_mode=ParseMode.HTML,
                    )
                except Exception as e:
                    logger.error(f"Failed to notify {user['user_id']} about solar flare: {e}")

            def build_push_message(lang):
                if lang == 'en':
                    return (
                        f"☀️ {flare_class}-class solar flare",
                        f"Flux {flare['flux']:.2e} · {flare_time}",
                        SITE_URL + "/weather",
                    )
                return (
                    f"☀️ Спалах на Сонці класу {flare_class}",
                    f"Потік {flare['flux']:.2e} · {flare_time}",
                    SITE_URL + "/ua/weather",
                )

            await self._notify_push_subscribers('subscribed_flares', build_push_message)

            # Mark as notified
            mark_flare_notified(flare_class, flare_time, flare['flux'])
            logger.info(f"Sent {flare_class}-class solar flare alert to {len(subscribers)} users")

            # Cleanup old notifications once per day (at 5 AM Kyiv)
            now = datetime.now(KYIV_TZ)
            if now.hour == 5 and now.minute < 5:
                cleanup_old_flare_notifications(days=7)

        except Exception as e:
            logger.error(f"Solar flare check error: {e}")

    async def check_geomagnetic_storms(self):
        """Check for geomagnetic storms (Kp >= 5) and notify subscribers.

        Not quiet-hours gated — same one-shot global dedup reasoning as
        check_hazardous_asteroids above (and aurora alerts are arguably the
        one case users most want even overnight).
        """
        try:
            logger.info("Checking geomagnetic storms...")

            storm = SpaceWeatherAPI.check_geomagnetic_storm()
            if not storm:
                logger.info("No geomagnetic storm detected")
                return

            kp = storm['kp']
            kp_time = storm['kp_time']
            g_scale = storm['g_scale']  # 'G1'..'G5' or None
            g_scale_key = storm['g_scale_key']  # 'g0'..'g5'
            solar_wind = storm.get('solar_wind')
            bz = storm.get('bz')
            forecast = storm.get('forecast')

            # Check if already notified about this Kp observation
            kp_str = f"{kp:.1f}"
            if is_storm_notified(kp_str, kp_time):
                logger.info(f"Already notified about Kp {kp_str} at {kp_time}")
                return

            # Get subscribers (reuse flare subscription for all space weather)
            subscribers = get_flare_subscribers()
            if not subscribers:
                logger.info("No solar activity subscribers")
                return

            # Language-neutral derived values
            kp_emoji = "🟠" if kp < 7 else "🔴"
            effects_key = (g_scale or 'G5').lower()  # g1..g5

            for user in subscribers:
                try:
                    lang = normalize_lang(user.get('lang'))

                    message = t('sch.storm.title', lang, emoji=kp_emoji)
                    message += t('sch.storm.kp', lang, kp=f"{kp:.1f}")
                    message += t('sch.storm.scale', lang,
                                 scale=t(f'weather.g_scale.{g_scale_key}', lang))
                    message += t('sch.storm.time', lang, time=kp_time)

                    # Solar wind details
                    if solar_wind:
                        speed = solar_wind['speed']
                        wind_status_key = SpaceWeatherAPI._get_solar_wind_status(speed)
                        wind_status = t(f'weather.wind.{wind_status_key}', lang)
                        message += t('sch.storm.wind', lang)
                        message += t('sch.storm.wind_speed', lang,
                                     speed=f"{speed:.0f}", status=wind_status)
                        message += t('sch.storm.wind_density', lang,
                                     density=f"{solar_wind['density']:.1f}")

                    # Magnetic field
                    if bz is not None:
                        bz_status_key = SpaceWeatherAPI._get_bz_status(bz)
                        bz_status = t(f'weather.bz.{bz_status_key}', lang)
                        bz_emoji = SpaceWeatherAPI._get_bz_emoji(bz)
                        message += t('sch.storm.bz', lang)
                        message += t('sch.storm.bz_line', lang,
                                     emoji=bz_emoji, bz=f"{bz:.1f}", status=bz_status)

                    # Possible effects
                    effects = t(f'sch.storm.effects.{effects_key}', lang)
                    message += t('sch.storm.effects_header', lang, effects=effects)

                    # Aurora hint
                    if kp >= 5:
                        message += t('sch.storm.aurora_header', lang)
                        if kp >= 8:
                            message += t('sch.storm.aurora.kp8', lang)
                        elif kp >= 6:
                            message += t('sch.storm.aurora.kp6', lang)
                        else:
                            message += t('sch.storm.aurora.kp5', lang)

                    # Forecast
                    if forecast:
                        message += t('sch.storm.forecast', lang)
                        for day_key in ('today', 'tomorrow', 'day_after'):
                            if day_key in forecast:
                                kp_val = forecast[day_key]
                                emoji = SpaceWeatherAPI._get_kp_emoji_simple(kp_val)
                                day_name = t(f'weather.day.{day_key}', lang)
                                message += t('sch.storm.forecast_line', lang,
                                             emoji=emoji, day=day_name, kp=f"{kp_val:.0f}")

                    message += t('sch.storm.source', lang)

                    await self.bot.send_message(
                        chat_id=user['chat_id'],
                        text=message,
                        parse_mode=ParseMode.HTML,
                    )
                except Exception as e:
                    logger.error(f"Failed to notify {user['user_id']} about geomagnetic storm: {e}")

            def build_push_message(lang):
                scale_str = g_scale or f"Kp {kp:.1f}"
                if lang == 'en':
                    return (
                        f"{kp_emoji} Geomagnetic storm ({scale_str})",
                        "Aurora may be visible tonight" if kp >= 5 else f"Kp {kp:.1f} · {kp_time}",
                        SITE_URL + "/weather",
                    )
                return (
                    f"{kp_emoji} Магнітна буря ({scale_str})",
                    "Сьогодні вночі можливе полярне сяйво" if kp >= 5 else f"Kp {kp:.1f} · {kp_time}",
                    SITE_URL + "/ua/weather",
                )

            await self._notify_push_subscribers('subscribed_flares', build_push_message)

            # Mark as notified
            mark_storm_notified(kp_str, kp_time, g_scale)
            logger.info(f"Sent geomagnetic storm alert (Kp={kp_str}, {g_scale}) to {len(subscribers)} users")

            # Cleanup old notifications once per day (at 5 AM Kyiv)
            now = datetime.now(KYIV_TZ)
            if now.hour == 5 and now.minute < 5:
                cleanup_old_storm_notifications(days=7)

        except Exception as e:
            logger.error(f"Geomagnetic storm check error: {e}")

    async def check_grb_alerts(self):
        """Check for new GRB events and notify subscribers.

        Not quiet-hours gated — same one-shot global dedup reasoning as
        check_hazardous_asteroids above.
        """
        try:
            logger.info("Checking GRB alerts...")

            # Get recent GRBs
            recent_grbs = GRBAlertAPI.get_recent_grbs(limit=5)
            if not recent_grbs:
                logger.info("No recent GRBs found")
                return

            # Get subscribers
            subscribers = get_grb_subscribers()
            if not subscribers:
                logger.info("No GRB subscribers")
                return

            notified_count = 0

            for grb in recent_grbs:
                grb_name = grb['grb_name']

                # Skip if already notified about this GRB
                if is_grb_notified(grb_name):
                    continue

                # Fetch details for richer message (language-neutral)
                details = GRBAlertAPI.get_grb_details(grb['circular_id'])

                # Send to all subscribers, formatted per-user language
                for user in subscribers:
                    try:
                        lang = normalize_lang(user.get('lang'))
                        message = GRBAlertAPI.format_grb_alert(grb, details, lang)
                        await self.bot.send_message(
                            chat_id=user['chat_id'],
                            text=message,
                            parse_mode=ParseMode.HTML,
                            disable_web_page_preview=False
                        )
                    except Exception as e:
                        logger.error(f"Failed to notify {user['user_id']} about GRB: {e}")

                def build_push_message(lang, grb_name=grb_name):
                    if lang == 'en':
                        return ("💥 New gamma-ray burst", grb_name, SITE_URL + "/deep")
                    return ("💥 Новий гамма-спалах", grb_name, SITE_URL + "/ua/deep")

                await self._notify_push_subscribers('subscribed_grb', build_push_message)

                # Mark as notified
                mark_grb_notified(grb_name, grb['circular_id'])
                notified_count += 1
                logger.info(f"Sent GRB notification: {grb_name}")

            logger.info(f"GRB check completed. Notified about {notified_count} GRBs")

            # Cleanup old notifications once per day (at 6 AM Kyiv)
            now = datetime.now(KYIV_TZ)
            if now.hour == 6 and now.minute < 5:
                cleanup_old_grb_notifications(days=30)

        except Exception as e:
            logger.error(f"GRB check error: {e}")

    async def check_astronomy_events(self):
        """Check for upcoming eclipses and notify subscribers"""
        try:
            from services.astronomy import get_next_eclipse
            # Use the neutral type field for the dedup decision; language does
            # not affect whether an eclipse is "tomorrow".
            eclipse_probe = get_next_eclipse()
            if not eclipse_probe:
                return

            # Notify 1 day before
            if eclipse_probe['days_until'] == 1:
                key = f"eclipse_{eclipse_probe['date']}"
                if key in self._notified_eclipses:
                    return

                subscribers = get_news_subscribers()
                if not subscribers:
                    return

                # `type` is a language-neutral key like 'moon_total' / 'sun_total'.
                is_total = eclipse_probe['type'].endswith('_total')
                emoji = "🌕" if is_total else "🌑"

                for user in subscribers:
                    try:
                        lang = normalize_lang(user.get('lang'))
                        eclipse = get_next_eclipse(lang)

                        message = t('sch.eclipse.title', lang, emoji=emoji)
                        message += t('sch.eclipse.name', lang, name=eclipse['name'])
                        message += t('sch.eclipse.date', lang, date=eclipse['date'])
                        message += t('sch.eclipse.visibility', lang, vis=eclipse['visibility'])
                        message += t('sch.eclipse.link1', lang)
                        message += t('sch.eclipse.link2', lang)
                        message += t('sch.eclipse.footer', lang)

                        await self.bot.send_message(
                            chat_id=user['chat_id'],
                            text=message,
                            parse_mode=ParseMode.HTML,
                        )
                    except Exception as e:
                        logger.error(f"Failed to notify {user['user_id']} about eclipse: {e}")

                self._notified_eclipses.add(key)
                logger.info(f"Sent eclipse notification: {eclipse_probe['name']}")

        except Exception as e:
            logger.error(f"Astronomy event check error: {e}")

    async def poll_apod_archive(self):
        """Ingest the last ~7 days of APOD into the website photo archive.

        Runs daily (called from run_scheduled_tasks right after the 09:00 APOD
        subscriber push). Idempotent by date: existing rows with both image
        sizes already mirrored are skipped; rows missing images are retried.
        Fetches ending=yesterday — NASA 400s on today if it isn't published yet
        (it appears during US daytime; 09:00 Kyiv ≈ 02:00 ET), so today's entry
        is picked up the following day. This is the single live-fetch point for
        the archive; the website (``/api/apod/archive``) reads from the DB.
        Best-effort: never raises."""
        try:
            from datetime import date, timedelta
            t = date.today()
            entries = NasaAPI.get_apod_archive(
                (t - timedelta(days=6)).isoformat(),
                (t - timedelta(days=1)).isoformat(),
            )
            if entries:
                ingest_apod_entries(entries)
        except Exception as e:
            logger.error(f"APOD archive poll error: {e}")

    async def poll_galaxies(self):
        """Weekly refresh of the 12-galaxy catalog: re-fetch live NED redshift/
        type for each galaxy and re-ingest any photos whose local mirror failed
        on a previous run (idempotent — already-mirrored photos are skipped).

        Runs every Monday at 03:00 Kyiv. Galaxy redshifts/types are effectively
        static, so a weekly cadence is plenty; this mainly retries dropped image
        downloads. This is the single live-fetch point for galaxies; the website
        (``/api/galaxies`` + ``/api/galaxies/<slug>``) reads from the DB.
        Best-effort: never raises."""
        try:
            from services.galaxies import build_galaxy_records, build_galaxy_photos
            records = build_galaxy_records()
            if records:
                ingest_galaxies(records)
                for r in records:
                    photos = build_galaxy_photos(r['key'], r.get('nasa_query'))
                    if photos:
                        ingest_galaxy_photos(r['key'], photos)
        except Exception as e:
            logger.error(f"Galaxies poll error: {e}")

    async def poll_news_feed(self):
        """Fetch the space news RSS feeds and ingest any new articles into
        the shared archive. Runs every 2 hours — this is the single live-fetch
        point for news; both the website (``/api/news``) and the bot digest
        (``send_daily_news``) read from the DB. Best-effort: never raises."""
        try:
            articles = NewsParser.get_news()  # RSS-first
            if articles:
                ingest_news_articles(articles)
        except Exception as e:
            logger.error(f"News feed poll error: {e}")

    async def send_daily_news(self):
        """Send daily news digest from Spaceflightnow"""
        try:
            logger.info("Sending daily news...")

            # Read recent articles from the archive (populated every 2h by
            # poll_news_feed). Fall back to a live fetch + ingest only when the
            # DB is empty (first run / DB unavailable) so the digest still goes
            # out and the archive is seeded.
            articles = get_news_articles(60)
            if not articles:
                articles = NewsParser.get_news()
                if articles:
                    try:
                        ingest_news_articles(articles)
                    except Exception as ingest_err:
                        logger.error(f"News archive ingest error: {ingest_err}")

            if not articles:
                logger.info("No news articles found")
                return

            # Get subscribers
            subscribers = get_news_subscribers()
            if not subscribers:
                logger.info("No news subscribers")
                return

            # Filter out already sent articles
            new_articles = []
            for article in articles:
                if not is_news_notified(article['url']):
                    new_articles.append(article)

            if not new_articles:
                logger.info("No new articles to send")
                return

            today = datetime.now().strftime('%d.%m.%Y')

            # Pre-translate each article's title/excerpt once (not once per
            # subscriber) — this loop used to call DeepL inside the
            # per-subscriber loop below, burning quota N times for identical
            # text when there are N Ukrainian subscribers.
            uk_titles = {}
            uk_excerpts = {}
            for article in new_articles[:3]:
                title = article['title']
                excerpt = article.get('excerpt') or ''
                if not article.get('title_uk') and title:
                    uk_titles[article['url']] = Translator.translate(title, "en", "uk") or title
                if excerpt and not article.get('excerpt_uk'):
                    uk_excerpts[article['url']] = Translator.translate(excerpt, "en", "uk") or excerpt

            # Send to all subscribers, formatted per-user language.
            sent_count = 0
            for user in subscribers:
                try:
                    lang = normalize_lang(user.get('lang'))

                    message = t('sch.news.title', lang, date=today)
                    message += t('sch.news.source', lang)

                    for i, article in enumerate(new_articles[:3], 1):
                        title = article['title']
                        excerpt = article.get('excerpt') or ''
                        # Link to the article's own page on the site (mirrored
                        # images, translated body) instead of the external
                        # source — falls back to the source URL if the article
                        # has no slug (e.g. a live fallback fetch, not yet
                        # ingested into news_articles).
                        if article.get('slug'):
                            prefix = 'ua' if lang == 'uk' else 'en'
                            news_slug = slug_for_name('news', lang)
                            url = f"{SITE_URL}/{prefix}/{news_slug}/{article['slug']}"
                        else:
                            url = article['url']
                        # category_raw is the raw source label (e.g. "Falcon 9")
                        # kept for the emoji keyword match; fall back to the bucket.
                        category = article.get('category_raw') or article.get('category') or ''

                        if lang == 'uk':
                            # Use the stored DeepL translation (ingested at poll
                            # time), falling back to the pre-translated copy
                            # computed once above.
                            title_disp = article.get('title_uk') or uk_titles.get(url) or title
                            excerpt_disp = article.get('excerpt_uk') or uk_excerpts.get(url) or excerpt
                        else:
                            # English: use the original source text.
                            title_disp = title
                            excerpt_disp = excerpt

                        # Category emoji
                        cat_emoji = "🚀"
                        if 'starlink' in category.lower() or 'falcon' in category.lower():
                            cat_emoji = "🛰️"
                        elif 'artemis' in category.lower() or 'moon' in category.lower():
                            cat_emoji = "🌙"
                        elif 'mars' in category.lower():
                            cat_emoji = "🔴"
                        elif 'iss' in category.lower():
                            cat_emoji = "🛰️"

                        message += t('sch.news.entry', lang, i=i, emoji=cat_emoji, title=escape_html(title_disp))
                        if excerpt_disp:
                            # Truncate excerpt if too long
                            if len(excerpt_disp) > 150:
                                excerpt_disp = excerpt_disp[:150] + "..."
                            message += t('sch.news.excerpt', lang, excerpt=escape_html(excerpt_disp))
                        message += t('sch.news.read_more', lang, url=escape_html(url))

                    message += t('sch.news.footer_uk' if lang == 'uk'
                                 else 'sch.news.footer_en', lang)

                    await self.bot.send_message(
                        chat_id=user['chat_id'],
                        text=message,
                        parse_mode=ParseMode.HTML,
                        disable_web_page_preview=True
                    )
                    sent_count += 1
                except Exception as e:
                    logger.error(f"Failed to send news to {user['user_id']}: {e}")

            # Mark articles as notified (once, language-neutral key = url)
            for article in new_articles[:3]:
                mark_news_notified(article['url'], article['title'])

            logger.info(f"Sent daily news to {sent_count}/{len(subscribers)} subscribers")

            # This whole function only runs once/day (main loop gates it to
            # 10:00 Kyiv), so cleanup just runs every time it does — a
            # dedicated "hour == 5" gate here was dead code, since it would
            # never be true while this method is only entered at hour == 10.
            cleanup_old_news_notifications(days=30)

        except Exception as e:
            logger.error(f"Daily news scheduler error: {e}")

    async def check_meteor_showers(self):
        """Check for upcoming meteor showers and notify subscribers"""
        try:
            logger.info("Checking meteor showers...")

            # Must use Kyiv wall-clock time, not server-local: this function
            # only runs when the main loop's Kyiv-aware clock hits 22:00, but
            # re-checks "now.hour == 22" itself below — on a non-Kyiv server
            # (e.g. a UTC VPS) a naive datetime.now() would never read 22
            # here, silently killing meteor shower notifications entirely.
            now = datetime.now(KYIV_TZ)

            # Get upcoming showers
            showers = MeteorShower.get_upcoming_showers(3)

            if not showers:
                logger.info("No upcoming meteor showers")
                return

            # Get subscribers
            subscribers = get_meteor_subscribers()
            if not subscribers:
                logger.info("No meteor shower subscribers")
                return

            for shower in showers:
                shower_name = shower['name']  # canonical UK name — used as dedup key
                peak_date = shower['peak_datetime']
                days_until = shower['days_until']

                peak_date_str = peak_date.strftime('%Y-%m-%d')

                # Notification 1 day before at 22:00
                if days_until == 1 and now.hour == 22 and now.minute == 0:
                    notification_type = "1day"

                    if is_meteor_notified(shower_name, peak_date_str, notification_type):
                        continue

                    for user in subscribers:
                        try:
                            lang = normalize_lang(user.get('lang'))
                            name_disp = pick(shower, 'name', lang)
                            other_name = shower.get('name_en' if lang == 'uk' else 'name')
                            best_time = pick(shower, 'best_time', lang)
                            direction = pick(shower, 'direction', lang)
                            description = pick(shower, 'description', lang)

                            message = t('sch.meteor.tomorrow_title', lang)
                            message += t('sch.meteor.name', lang, name=name_disp, other=other_name)
                            message += t('sch.meteor.peak', lang, date=peak_date.strftime('%d.%m.%Y'))
                            message += t('sch.meteor.rate', lang, rate=shower['rate'])
                            message += t('sch.meteor.best_time', lang, time=best_time)
                            message += t('sch.meteor.direction', lang, dir=direction)
                            message += t('sch.meteor.desc', lang, desc=description)
                            message += t('sch.meteor.reminder', lang)

                            await self.bot.send_message(
                                chat_id=user['chat_id'],
                                text=message,
                                parse_mode=ParseMode.HTML
                            )
                        except Exception as e:
                            logger.error(f"Failed to notify {user['user_id']} about meteor shower: {e}")

                    mark_meteor_notified(shower_name, peak_date_str, notification_type)
                    logger.info(f"Sent 1-day notification for {shower_name}")

                # Notification on the day at 22:00 (10 PM)
                elif days_until == 0 and now.hour == 22 and now.minute == 0:
                    notification_type = "today"

                    if is_meteor_notified(shower_name, peak_date_str, notification_type):
                        continue

                    for user in subscribers:
                        try:
                            lang = normalize_lang(user.get('lang'))
                            name_disp = pick(shower, 'name', lang)
                            other_name = shower.get('name_en' if lang == 'uk' else 'name')
                            best_time = pick(shower, 'best_time', lang)
                            direction = pick(shower, 'direction', lang)
                            description = pick(shower, 'description', lang)

                            message = t('sch.meteor.today_title', lang)
                            message += t('sch.meteor.name', lang, name=name_disp, other=other_name)
                            message += t('sch.meteor.rate', lang, rate=shower['rate'])
                            message += t('sch.meteor.best_time', lang, time=best_time)
                            message += t('sch.meteor.direction', lang, dir=direction)
                            message += t('sch.meteor.desc', lang, desc=description)
                            message += t('sch.meteor.go_out', lang)
                            message += t('sch.meteor.tip', lang)

                            await self.bot.send_message(
                                chat_id=user['chat_id'],
                                text=message,
                                parse_mode=ParseMode.HTML
                            )
                        except Exception as e:
                            logger.error(f"Failed to notify {user['user_id']} about meteor shower peak: {e}")

                    mark_meteor_notified(shower_name, peak_date_str, notification_type)
                    logger.info(f"Sent today notification for {shower_name}")

            # This function only runs once/day (main loop gates it to 22:00
            # Kyiv), so an "hour == 6" gate here would never fire — just
            # clean up every time this runs, same fix as send_daily_news.
            cleanup_old_meteor_notifications(days=60)

            logger.info("Meteor shower check completed")

        except Exception as e:
            logger.error(f"Meteor shower scheduler error: {e}")

    def _parse_launches(self, launches_data: dict) -> list:
        """Parse launches from API response"""
        launches = []

        try:
            # Handle LaunchLibrary v2.2.0 format
            results = launches_data.get('results', [])

            for result in results:
                try:
                    launch_id = result.get('id')
                    name = result.get('name', 'Unknown Launch')
                    net = result.get('net')  # ISO format datetime

                    if net:
                        # Parse ISO datetime, kept UTC-aware so it can be
                        # compared safely against an aware "now" regardless
                        # of the host machine's system timezone.
                        launch_time = datetime.fromisoformat(net.replace('Z', '+00:00'))
                        if launch_time.tzinfo is None:
                            launch_time = launch_time.replace(tzinfo=timezone.utc)
                        else:
                            launch_time = launch_time.astimezone(timezone.utc)

                        # Get info URL for livestream (SpaceX page or fallback)
                        info_urls = result.get('info_urls', [])
                        live_url = info_urls[0]['url'] if info_urls else 'https://spaceflightnow.com/launch-schedule/'

                        launches.append({
                            'id': str(launch_id),
                            'name': name,
                            'time': launch_time,
                            'url': live_url
                        })
                except Exception as e:
                    logger.warning(f"Failed to parse launch: {e}")
                    continue

        except Exception as e:
            logger.error(f"Error parsing launches: {e}")

        return launches

    async def _send_launch_notification(self, launch: dict, subscribers: list):
        """Send launch notification to subscribers (per-user language)"""
        try:
            launch_name = launch.get('name', 'Rocket Launch')
            launch_time = launch.get('time', datetime.now())
            live_url = launch.get('url', 'https://spaceflightnow.com/launch-schedule/')
            date_str = launch_time.strftime('%d.%m.%Y %H:%M UTC')

            for user in subscribers:
                try:
                    if self._is_quiet_hours_for(user):
                        continue

                    lang = normalize_lang(user.get('lang'))
                    message = t('sch.launch.title', lang)
                    message += t('sch.launch.name_line', lang, name=escape_html(launch_name))
                    message += t('sch.launch.date_line', lang, date=date_str)
                    message += t('sch.launch.watch', lang, url=escape_html(live_url))

                    await self.bot.send_message(
                        chat_id=user['chat_id'],
                        text=message,
                        parse_mode=ParseMode.HTML
                    )
                except Exception as e:
                    logger.error(f"Failed to notify {user['user_id']}: {e}")

            def build_push_message(lang):
                if lang == 'en':
                    return (
                        "🚀 Launch happening now",
                        f"{launch_name} · {date_str}",
                        live_url,
                    )
                return (
                    "🚀 Запуск ракети зараз",
                    f"{launch_name} · {date_str}",
                    live_url,
                )

            await self._notify_push_subscribers('subscribed_launches', build_push_message)

            logger.info(f"Sent launch notification to {len(subscribers)} users for {launch_name}")

        except Exception as e:
            logger.error(f"Launch notification error: {e}")

    @staticmethod
    def _seconds_to_next_minute() -> float:
        """Seconds until the next wall-clock minute boundary (Kyiv time)."""
        now = datetime.now(KYIV_TZ)
        next_minute = (now + timedelta(minutes=1)).replace(second=0, microsecond=0)
        return max(1.0, (next_minute - now).total_seconds())

    async def run_scheduled_tasks(self):
        """Main scheduler loop - runs every minute"""
        logger.info("Scheduler started")

        while True:
            try:
                now = datetime.now(KYIV_TZ)

                # APOD at 09:00 Kyiv time (with 1-minute window)
                if now.hour == 9 and 0 <= now.minute <= 1:
                    await self.send_apod_to_subscribers()
                    # Mirror the last ~7 days of APOD into the photo archive
                    # (idempotent; retries any row missing its local images).
                    await self.poll_apod_archive()

                # Check ISS passes every 10 minutes
                if now.minute % 10 == 0:
                    await self.check_iss_passes()

                # Check launches every 5 minutes
                if now.minute % 5 == 0:
                    await self.check_upcoming_launches()

                # Check hazardous asteroids every hour
                if now.minute == 0:
                    await self.check_hazardous_asteroids()

                # Check solar flares every hour
                if now.minute == 0:
                    await self.check_solar_flares()

                # Check geomagnetic storms every hour
                if now.minute == 0:
                    await self.check_geomagnetic_storms()

                # Check GRB alerts every 30 minutes
                if now.minute % 30 == 0:
                    await self.check_grb_alerts()

                # Poll the SpaceflightNow RSS feed for new articles every 2
                # hours (runs at 00:00, 02:00, 04:00, …). Placed before the
                # 10:00 news digest so the archive is fresh when the bot reads
                # it. Both the website and the bot read news from the DB.
                if now.hour % 2 == 0 and now.minute == 0:
                    await self.poll_news_feed()

                # Weekly galaxies refresh — Mondays at 03:00 Kyiv. Re-fetches
                # NED redshift/type and retries any failed photo mirrors.
                if now.weekday() == 0 and now.hour == 3 and now.minute == 0:
                    await self.poll_galaxies()

                # Daily news at 10:00 Kyiv time
                if now.hour == 10 and now.minute == 0:
                    await self.send_daily_news()

                # Check astronomy events at 10:00
                if now.hour == 10 and now.minute == 0:
                    await self.check_astronomy_events()

                # Check meteor showers at 22:00 (10 PM)
                if now.hour == 22 and now.minute == 0:
                    await self.check_meteor_showers()

                # Sleep until the top of the next minute rather than a flat
                # 60s: a flat sleep drifts by however long the checks above
                # took, and that drift can push an iteration past an
                # exact-minute trigger (now.minute == 0, hour == 22, etc.),
                # silently skipping that day's/hour's notification entirely.
                # Anchoring to the wall clock keeps every iteration aligned.
                await asyncio.sleep(self._seconds_to_next_minute())

            except Exception as e:
                logger.error(f"Scheduler error: {e}")
                await asyncio.sleep(self._seconds_to_next_minute())


async def start_scheduler():
    """Start the notification scheduler"""
    scheduler = NotificationScheduler()
    await scheduler.run_scheduled_tasks()
