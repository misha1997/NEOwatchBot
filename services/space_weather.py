"""Space Weather API Service - NOAA SWPC data"""
import requests
import logging
from utils.i18n import t, DEFAULT_LANG

logger = logging.getLogger(__name__)

NOAA_KP_URL = "https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json"
NOAA_SOLAR_WIND_URL = "https://services.swpc.noaa.gov/json/rtsw/rtsw_wind_1m.json"
NOAA_MAG_URL = "https://services.swpc.noaa.gov/json/rtsw/rtsw_mag_1m.json"
NOAA_XRAY_URL = "https://services.swpc.noaa.gov/json/goes/primary/xrays-6-hour.json"
NOAA_KP_FORECAST = "https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json"
NOAA_AURORA_MAP = "https://services.swpc.noaa.gov/images/animations/ovation/north/latest.jpg"

# X-ray energy band (1-8 Angstrom / 0.1-0.8 nm) — the standard channel used
# to classify flares into A/B/C/M/X. The GOES primary feed interleaves two
# bands, so we must filter on this field.
XRAY_LONG_BAND = "0.1-0.8nm"


class SpaceWeatherAPI:
    """NOAA Space Weather API client"""

    @staticmethod
    def get_space_weather(user_lat=None, user_lon=None, lang=DEFAULT_LANG):
        """Get space weather in compact format"""
        try:
            message = t('weather.title', lang)

            # Kp index
            kp_index, kp_time = SpaceWeatherAPI._get_kp_index()
            if kp_index is not None:
                g_scale_key = SpaceWeatherAPI._get_g_scale(kp_index)
                g_scale = t(f'weather.g_scale.{g_scale_key}', lang)
                kp_emoji = SpaceWeatherAPI._get_kp_emoji_simple(kp_index)
                message += t('weather.geo_activity', lang)
                message += t('weather.kp_index', lang, kp=f"{kp_index:.1f}")
                message += t('weather.kp_line', lang, emoji=kp_emoji, g_scale=g_scale)

            # Solar wind
            solar_data = SpaceWeatherAPI._get_solar_wind()
            if solar_data:
                speed_emoji = "🟢" if solar_data['speed'] < 400 else "🟡" if solar_data['speed'] < 500 else "🔴"
                wind_status = t(f'weather.wind.{SpaceWeatherAPI._get_solar_wind_status(solar_data["speed"])}', lang)
                message += t('weather.solar_wind', lang)
                message += t('weather.speed', lang, speed=f"{solar_data['speed']:.0f}",
                              emoji=speed_emoji, status=wind_status)
                message += t('weather.density', lang, density=f"{solar_data['density']:.1f}")
                message += t('weather.temp', lang, temp=f"{solar_data['temp']/1000:.1f}")

            # Magnetic field
            bz_data = SpaceWeatherAPI._get_bz_component()
            if bz_data is not None:
                bz_emoji = SpaceWeatherAPI._get_bz_emoji(bz_data)
                bz_status = t(f'weather.bz.{SpaceWeatherAPI._get_bz_status(bz_data)}', lang)
                message += t('weather.mag_field', lang)
                message += t('weather.bz', lang, bz=f"{bz_data:.1f}")
                message += t('weather.bz_line', lang, emoji=bz_emoji, status=bz_status)

            # X-ray
            xray_data = SpaceWeatherAPI._get_xray_flux()
            if xray_data and xray_data[0]:
                xclass, xstatus_key = xray_data
                x_emoji = SpaceWeatherAPI._get_xray_emoji(xclass)
                xstatus = t(f'weather.xray.{xstatus_key}', lang)
                message += t('weather.sun_activity', lang)
                message += t('weather.xray', lang, xclass=xclass)
                message += t('weather.xray_line', lang, emoji=x_emoji, status=xstatus)
            else:
                message += t('weather.sun_activity', lang)
                message += t('weather.xray_calm', lang)

            # Aurora
            if user_lat is not None and kp_index is not None:
                aurora_key = SpaceWeatherAPI._can_see_aurora_simple(kp_index, user_lat)
                aurora_status = t(f'weather.aurora_status.{aurora_key}', lang)
                message += t('weather.aurora_section', lang)
                message += t('weather.aurora_line', lang, status=aurora_status)
                message += t('weather.your_lat', lang, lat=f"{abs(user_lat):.1f}")

            # Forecast
            forecast = SpaceWeatherAPI._get_kp_forecast_simple()
            if forecast:
                message += t('weather.forecast_title', lang)
                for day_key in ('today', 'tomorrow', 'day_after'):
                    if day_key in forecast:
                        kp_val = forecast[day_key]
                        emoji = SpaceWeatherAPI._get_kp_emoji_simple(kp_val)
                        day_name = t(f'weather.day.{day_key}', lang)
                        message += t('weather.forecast_line', lang, emoji=emoji,
                                      day=day_name, kp=f"{kp_val:.0f}")

            message += t('weather.kp_scale', lang)
            message += t('weather.kp_scale_lines', lang)
            message += t('weather.data_source', lang)
            return message

        except Exception as e:
            logger.error(f"Space weather error: {e}")
            return t('weather.partial', lang)

    @staticmethod
    def get_aurora_map_url():
        """Get NOAA OVATION aurora forecast map URL."""
        return NOAA_AURORA_MAP

    @staticmethod
    def _get_kp_index():
        """Get current Kp index.

        NOAA SWPC restructured the planetary-K endpoint into a list of objects
        ``{"time_tag", "Kp", "a_running", "station_count"}`` ordered oldest-first,
        so the newest reading is the last element.
        """
        try:
            response = requests.get(NOAA_KP_URL, timeout=10)
            data = response.json()

            if data and len(data) >= 1:
                latest = data[-1]
                kp = float(latest.get("Kp"))
                time_str = latest.get("time_tag", "—")
                return kp, time_str
            return None, None
        except:
            return None, None

    @staticmethod
    def _get_solar_wind():
        """Get solar wind data (proton speed/density/temperature).

        The RTSW ``rtsw_wind_1m`` feed is a list of objects ordered
        **newest-first**, so the most recent reading is ``data[0]``. Individual
        fields can be ``null`` during gaps, so we scan for the first record that
        actually carries the values we need.
        """
        try:
            response = requests.get(NOAA_SOLAR_WIND_URL, timeout=10)
            data = response.json()

            if not data:
                return None
            for rec in data:
                speed = rec.get("proton_speed")
                density = rec.get("proton_density")
                temp = rec.get("proton_temperature")
                if speed is None or density is None or temp is None:
                    continue
                return {
                    'density': float(density),
                    'speed': float(speed),
                    'temp': float(temp),
                }
            return None
        except:
            return None

    @staticmethod
    def _get_bz_component():
        """Get magnetic field Bz component (GSM).

        RTSW ``rtsw_mag_1m`` is newest-first; ``bz_gsm`` may be ``null`` during
        gaps, so we take the first record with a usable value.
        """
        try:
            response = requests.get(NOAA_MAG_URL, timeout=10)
            data = response.json()

            if not data:
                return None
            for rec in data:
                bz = rec.get("bz_gsm")
                if bz is None:
                    continue
                return float(bz)
            return None
        except:
            return None

    @staticmethod
    def _fetch_xray_long_series():
        """Fetch the GOES 1-8 Angstrom (0.1-0.8 nm) X-ray flux series.

        The primary GOES feed interleaves two energy bands per timestamp, so we
        filter to ``XRAY_LONG_BAND``. Returns a list of ``(time_tag, flux)``
        tuples in the feed's native oldest-first order, or ``[]`` on failure.
        """
        try:
            response = requests.get(NOAA_XRAY_URL, timeout=10)
            data = response.json()
            if not data:
                return []
            series = []
            for rec in data:
                if rec.get("energy") != XRAY_LONG_BAND:
                    continue
                flux = rec.get("flux")
                if flux is None:
                    continue
                series.append((rec.get("time_tag", "—"), float(flux)))
            return series
        except:
            return []

    @staticmethod
    def _get_xray_flux():
        """Get X-ray flux and classification. Returns (class, status_key)."""
        series = SpaceWeatherAPI._fetch_xray_long_series()
        if series:
            _, flux = series[-1]
            return SpaceWeatherAPI._classify_xray(flux)
        return None, None

    @staticmethod
    def _classify_xray(flux):
        """Classify X-ray flux. Returns (class_letter, status_key)."""
        if flux >= 1e-4:
            return "X", "extreme"
        elif flux >= 1e-5:
            return "M", "large"
        elif flux >= 1e-6:
            return "C", "moderate"
        elif flux >= 1e-7:
            return "B", "weak"
        else:
            return "A", "quiet"

    @staticmethod
    def _get_xray_emoji(xray_class):
        """Get emoji for X-ray class"""
        emojis = {
            'A': "🟢",
            'B': "🟢",
            'C': "🟡",
            'M': "🔴",
            'X': "⚠️"
        }
        return emojis.get(xray_class, "⚪")

    @staticmethod
    def check_xclass_flare():
        """Check for X-class solar flare and return alert data if detected."""
        return SpaceWeatherAPI.check_significant_flare(min_class='X')

    @staticmethod
    def check_significant_flare(min_class='M'):
        """Check for solar flares of specified class or higher.

        Args:
            min_class: Minimum flare class to alert on ('M' or 'X')

        Returns:
            dict with flare data if detected and it's a new event, None otherwise
        """
        try:
            series = SpaceWeatherAPI._fetch_xray_long_series()
            if len(series) < 2:
                return None

            # Get latest and previous readings (oldest-first, so last = newest)
            time_str, latest_flux = series[-1]
            _, previous_flux = series[-2]

            latest_class, _ = SpaceWeatherAPI._classify_xray(latest_flux)
            previous_class, _ = SpaceWeatherAPI._classify_xray(previous_flux)

            # Class priority: A < B < C < M < X
            class_priority = {'A': 0, 'B': 1, 'C': 2, 'M': 3, 'X': 4}
            min_priority = class_priority.get(min_class, 3)
            latest_priority = class_priority.get(latest_class, 0)
            previous_priority = class_priority.get(previous_class, 0)

            # Alert only if current meets threshold and previous was below threshold
            # (prevents spamming the same flare)
            if latest_priority >= min_priority and previous_priority < min_priority:
                return {
                    "flux": latest_flux,
                    "time": time_str,
                    "class": latest_class,
                }

            return None
        except Exception as e:
            logger.error(f"Solar flare check error: {e}")
            return None

    @staticmethod
    def get_flare_description(flare_class):
        """Get i18n key suffix for flare class description.

        Returns one of: very_weak / weak / moderate / large / extreme / unknown.
        The caller renders it via ``t(f'weather.flare.{key}', lang)``.
        """
        keys = {
            'A': "very_weak",
            'B': "weak",
            'C': "moderate",
            'M': "large",
            'X': "extreme",
        }
        return keys.get(flare_class, "unknown")

    @staticmethod
    def get_flare_emoji(flare_class):
        """Get emoji for flare class alert"""
        emojis = {
            'A': "🟢",
            'B': "🟢",
            'C': "🟡",
            'M': "🔴",
            'X': "🚨"
        }
        return emojis.get(flare_class, "⚠️")

    @staticmethod
    def _get_g_scale(kp):
        """Get G-scale key for Kp. Returns one of g0..g5."""
        if kp < 5:
            return "g0"
        elif kp < 6:
            return "g1"
        elif kp < 7:
            return "g2"
        elif kp < 8:
            return "g3"
        elif kp < 9:
            return "g4"
        else:
            return "g5"

    @staticmethod
    def _get_g_scale_short(kp):
        """Get short G-scale label (G1-G5) for notifications"""
        if kp < 5:
            return None
        elif kp < 6:
            return "G1"
        elif kp < 7:
            return "G2"
        elif kp < 8:
            return "G3"
        elif kp < 9:
            return "G4"
        else:
            return "G5"

    @staticmethod
    def check_geomagnetic_storm():
        """Check for geomagnetic storm (Kp >= 5).

        Returns dict with storm data if storm detected, None otherwise.
        Includes Kp value, G-scale (key + short label), solar wind, Bz, and forecast info.
        Forecast keys are language-neutral: 'today' / 'tomorrow' / 'day_after'.
        """
        try:
            kp_index, kp_time = SpaceWeatherAPI._get_kp_index()
            if kp_index is None or kp_index < 5:
                return None

            g_scale = SpaceWeatherAPI._get_g_scale_short(kp_index)
            g_scale_key = SpaceWeatherAPI._get_g_scale(kp_index)

            solar_wind = SpaceWeatherAPI._get_solar_wind()
            bz = SpaceWeatherAPI._get_bz_component()
            forecast = SpaceWeatherAPI._get_kp_forecast_simple()

            return {
                "kp": kp_index,
                "kp_time": kp_time,
                "g_scale": g_scale,
                "g_scale_key": g_scale_key,
                "solar_wind": solar_wind,
                "bz": bz,
                "forecast": forecast,
            }
        except Exception as e:
            logger.error(f"Geomagnetic storm check error: {e}")
            return None

    @staticmethod
    def _get_kp_emoji_simple(kp):
        """Simple emoji for Kp"""
        if kp < 4:
            return "🟢"
        elif kp < 5:
            return "🟡"
        elif kp < 7:
            return "🟠"
        else:
            return "🔴"

    @staticmethod
    def _get_solar_wind_status(speed):
        """Get status key for solar wind speed. Returns one of calm/moderate/strong/very_strong."""
        if speed < 400:
            return "calm"
        elif speed < 500:
            return "moderate"
        elif speed < 600:
            return "strong"
        else:
            return "very_strong"

    @staticmethod
    def _get_bz_status(bz):
        """Get status key for Bz. Returns one of calm/weak_aurora/aurora_likely."""
        if bz > -5:
            return "calm"
        elif bz > -10:
            return "weak_aurora"
        else:
            return "aurora_likely"

    @staticmethod
    def _get_bz_emoji(bz):
        """Get emoji for Bz"""
        if bz > -5:
            return "🟢"
        elif bz > -10:
            return "🟡"
        else:
            return "🔴"

    @staticmethod
    def _can_see_aurora_simple(kp, latitude):
        """Simple aurora visibility. Returns a status key:
        everywhere / north / maybe_north / not_visible.
        """
        abs_lat = abs(latitude)

        if kp >= 8:
            return "everywhere"
        elif kp >= 6:
            return "north"
        elif kp >= 5 and abs_lat > 55:
            return "maybe_north"
        else:
            return "not_visible"

    @staticmethod
    def _get_kp_forecast_simple():
        """Get simple 3-day forecast with language-neutral day keys.

        The forecast endpoint is now a list of objects
        ``{"time_tag", "kp", "observed", "noaa_scale"}`` (lowercase ``kp``).
        Returns dict {'today': kp, 'tomorrow': kp, 'day_after': kp} or None.
        """
        try:
            response = requests.get(NOAA_KP_FORECAST, timeout=10)
            data = response.json()

            if not data:
                return None

            from datetime import datetime

            # Today (UTC date matching NOAA data)
            today = datetime.utcnow().date()

            # Build dictionary of max Kp per date
            daily_kp = {}
            for row in data:
                time_tag = row.get("time_tag")
                kp_raw = row.get("kp")
                if time_tag is None or kp_raw is None:
                    continue
                # Handle both formats: "2026-03-01T00:00:00" and "2026-03-01 00:00:00"
                date_part = str(time_tag).split("T")[0].split()[0]
                kp = float(kp_raw)

                if date_part not in daily_kp or daily_kp[date_part] < kp:
                    daily_kp[date_part] = kp

            # Create result with relative day keys
            result = {}

            for date_str, kp in daily_kp.items():
                date_obj = datetime.strptime(date_str, '%Y-%m-%d').date()
                days_diff = (date_obj - today).days

                if days_diff == 0:
                    result['today'] = kp
                elif days_diff == 1:
                    result['tomorrow'] = kp
                elif days_diff == 2:
                    result['day_after'] = kp

            return result if result else None

        except Exception as e:
            logger.error(f"Forecast error: {e}")
            return None