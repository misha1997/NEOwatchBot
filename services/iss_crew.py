"""ISS Crew API Service - using corquaid's International Space Station APIs"""
import logging
import requests

logger = logging.getLogger(__name__)

API_URL = "https://corquaid.github.io/international-space-station-APIs/JSON/people-in-space.json"

# Mapping tables for Ukrainian output
_COUNTRY_NAMES = {
    'Russia': 'Росія',
    'United States': 'США',
    'France': 'Франція',
    'China': 'Китай',
    'Japan': 'Японія',
    'Germany': 'Німеччина',
    'Italy': 'Італія',
    'Canada': 'Канада',
    'United Kingdom': 'Велика Британія',
    'Spain': 'Іспанія',
    'Netherlands': 'Нідерланди',
    'Belgium': 'Бельгія',
    'Sweden': 'Швеція',
    'Denmark': 'Данія',
    'Norway': 'Норвегія',
    'Switzerland': 'Швейцарія',
    'Austria': 'Австрія',
    'Poland': 'Польща',
    'Czech Republic': 'Чехія',
    'Hungary': 'Угорщина',
    'Romania': 'Румунія',
    'Bulgaria': 'Болгарія',
    'Greece': 'Греція',
    'Portugal': 'Португалія',
    'Finland': 'Фінляндія',
    'Ireland': 'Ірландія',
    'Slovakia': 'Словаччина',
    'Slovenia': 'Словенія',
    'Croatia': 'Хорватія',
    'Lithuania': 'Литва',
    'Latvia': 'Латвія',
    'Estonia': 'Естонія',
    'Luxembourg': 'Люксембург',
    'Malta': 'Мальта',
    'Cyprus': 'Кіпр',
    'India': 'Індія',
    'United Arab Emirates': 'ОАЕ',
    'Kazakhstan': 'Казахстан',
    'Belarus': 'Білорусь',
    'Turkey': 'Туреччина',
    'South Korea': 'Південна Корея',
    'Australia': 'Австралія',
    'Brazil': 'Бразилія',
    'Argentina': 'Аргентина',
    'Mexico': 'Мексика',
    'Israel': 'Ізраїль',
    'South Africa': 'ПАР',
    'Malaysia': 'Малайзія',
    'Ukraine': 'Україна',
}

_POSITION_NAMES = {
    'Commander': 'Командир',
    'Flight Engineer': 'Бортінженер',
    'Pilot': 'Пілот',
    'Mission Specialist': 'Фахівець місії',
    'Payload Specialist': 'Спеціаліст з корисного навантаження',
    'Spaceflight Participant': 'Учасник космічного польоту',
    'Tourist': 'Космічний турист',
}

_FLAG_EMOJI = {
    'ru': '🇷🇺',
    'us': '🇺🇸',
    'fr': '🇫🇷',
    'cn': '🇨🇳',
    'jp': '🇯🇵',
    'de': '🇩🇪',
    'it': '🇮🇹',
    'ca': '🇨🇦',
    'gb': '🇬🇧',
    'es': '🇪🇸',
    'nl': '🇳🇱',
    'be': '🇧🇪',
    'se': '🇸🇪',
    'dk': '🇩🇰',
    'no': '🇳🇴',
    'ch': '🇨🇭',
    'at': '🇦🇹',
    'pl': '🇵🇱',
    'cz': '🇨🇿',
    'hu': '🇭🇺',
    'ro': '🇷🇴',
    'bg': '🇧🇬',
    'gr': '🇬🇷',
    'pt': '🇵🇹',
    'fi': '🇫🇮',
    'ie': '🇮🇪',
    'sk': '🇸🇰',
    'si': '🇸🇮',
    'hr': '🇭🇷',
    'lt': '🇱🇹',
    'lv': '🇱🇻',
    'ee': '🇪🇪',
    'lu': '🇱🇺',
    'mt': '🇲🇹',
    'cy': '🇨🇾',
    'in': '🇮🇳',
    'ae': '🇦🇪',
    'kz': '🇰🇿',
    'by': '🇧🇾',
    'tr': '🇹🇷',
    'kr': '🇰🇷',
    'au': '🇦🇺',
    'br': '🇧🇷',
    'ar': '🇦🇷',
    'mx': '🇲🇽',
    'il': '🇮🇱',
    'za': '🇿🇦',
    'my': '🇲🇾',
    'ua': '🇺🇦',
}


def _country_name(raw: str) -> str:
    return _COUNTRY_NAMES.get(raw, raw)


def _position_name(raw: str) -> str:
    return _POSITION_NAMES.get(raw, raw)


def _flag_emoji(code: str) -> str:
    return _FLAG_EMOJI.get(code.lower(), '🏳️')


class ISSCrewAPI:
    """ISS crew data from corquaid's International Space Station APIs"""

    @staticmethod
    def get_iss_crew():
        """Get ISS crew data from API.

        Returns dict with keys:
            - number: int
            - expedition: int
            - expedition_patch: str (url)
            - expedition_url: str (url)
            - expedition_image: str (url)
            - expedition_start_date: int (unix timestamp)
            - crew: list of person dicts (filtered to ISS only)
        """
        try:
            response = requests.get(API_URL, timeout=15)
            response.raise_for_status()
            data = response.json()
        except Exception as e:
            logger.error(f"ISS crew API request failed: {e}")
            return None

        people = data.get('people', [])
        iss_crew = [p for p in people if p.get('iss') is True]

        return {
            'number': data.get('number', 0),
            'expedition': data.get('iss_expedition'),
            'expedition_patch': data.get('expedition_patch', ''),
            'expedition_url': data.get('expedition_url', ''),
            'expedition_image': data.get('expedition_image', ''),
            'expedition_start_date': data.get('expedition_start_date'),
            'crew': iss_crew,
        }

    @staticmethod
    def format_crew_for_telegram(data):
        """Format crew data into a rich Telegram HTML message and patch URL.

        Returns dict with keys:
            - text: str (HTML formatted message)
            - patch_url: str or None
            - expedition_url: str or None
        """
        if not data or not data.get('crew'):
            return {
                'text': (
                    "👨‍🚀 <b>Екіпаж МКС</b>\n\n"
                    "❌ Інформація про екіпаж тимчасово недоступна.\n"
                    "<i>Спробуй пізніше.</i>"
                ),
                'patch_url': None,
                'expedition_url': None,
            }

        crew = data['crew']
        expedition = data.get('expedition')
        patch_url = data.get('expedition_patch') or data.get('expedition_image')
        expedition_url = data.get('expedition_url')
        start_ts = data.get('expedition_start_date')

        # Header
        lines = [f"👨‍🚀 <b>Екіпаж МКС</b>"]
        if expedition:
            lines.append(f"Експедиція {expedition}")
        lines.append("")

        # Group by spacecraft
        by_spacecraft = {}
        for person in crew:
            craft = person.get('spacecraft', 'Невідомий корабель')
            by_spacecraft.setdefault(craft, []).append(person)

        for spacecraft, members in by_spacecraft.items():
            lines.append(f"🚀 <b>{spacecraft}</b>")
            for person in members:
                name = person.get('name', 'Невідомо')
                flag = _flag_emoji(person.get('flag_code', ''))
                country = _country_name(person.get('country', ''))
                position = _position_name(person.get('position', ''))
                agency = person.get('agency', '')
                days = person.get('days_in_space', 0)

                lines.append(
                    f"{flag} {name} — <i>{position}</i>"
                )
                detail_parts = []
                if agency:
                    detail_parts.append(agency)
                if days is not None:
                    word = "днів" if days == 0 or (11 <= days % 100 <= 14) else \
                           "день" if days % 10 == 1 else \
                           "дні" if 2 <= days % 10 <= 4 else "днів"
                    detail_parts.append(f"{days} {word} у космосі")
                if detail_parts:
                    lines.append(f"   <code>{' • '.join(detail_parts)}</code>")
            lines.append("")

        # Footer
        total_iss = len(crew)
        total_space = data.get('number', 0)
        if total_space > total_iss:
            lines.append(
                f"<i>Загалом у космосі: {total_space} людей "
                f"(на МКС: {total_iss})</i>"
            )
        else:
            lines.append(f"<i>Всього на МКС: {total_iss} {ISSCrewAPI._plural_astronauts(total_iss)}</i>")

        if expedition_url:
            lines.append(f'\n<a href="{expedition_url}">📖 Детальніше про Експедицію {expedition}</a>')

        return {
            'text': '\n'.join(lines),
            'patch_url': patch_url,
            'expedition_url': expedition_url,
        }

    @staticmethod
    def _plural_astronauts(n: int) -> str:
        if n == 1:
            return 'астронавт'
        if 2 <= n % 10 <= 4 and not (12 <= n % 100 <= 14):
            return 'астронавти'
        return 'астронавтів'
