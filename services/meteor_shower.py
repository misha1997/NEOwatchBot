"""Meteor showers data and utilities"""
import logging
from datetime import datetime
from utils.i18n import t, pick, days, DEFAULT_LANG

logger = logging.getLogger(__name__)

# Major meteor showers data
# Dates are in format (month, day)
# Each entry has Ukrainian (name/best_time/direction/description) and English
# (*_en) fields; pick() selects by user language.
METEOR_SHOWERS = [
    {
        'name': 'Квадрантиди',
        'name_en': 'Quadrantids',
        'start': (1, 1),
        'peak': (1, 3),
        'end': (1, 5),
        'rate': 120,
        'best_time': 'Після півноці до світанку',
        'best_time_en': 'After midnight until dawn',
        'direction': 'Північна частина неба, сузір\'я Волопаса',
        'direction_en': 'Northern sky, constellation Boötes',
        'description': 'Один з найактивніших потоків року',
        'description_en': 'One of the most active showers of the year'
    },
    {
        'name': 'Ліриди',
        'name_en': 'Lyrids',
        'start': (4, 16),
        'peak': (4, 22),
        'end': (4, 25),
        'rate': 18,
        'best_time': '02:00 - 04:00',
        'best_time_en': '02:00 - 04:00',
        'direction': 'Схід, сузір\'я Ліри',
        'direction_en': 'East, constellation Lyra',
        'description': 'Відомі яскравими метеорами-вогниками',
        'description_en': 'Known for bright fireball meteors'
    },
    {
        'name': 'Ета-Аквариди',
        'name_en': 'Eta Aquariids',
        'start': (4, 19),
        'peak': (5, 6),
        'end': (5, 28),
        'rate': 50,
        'best_time': 'Перед світанком (04:00-05:00)',
        'best_time_en': 'Before dawn (04:00-05:00)',
        'direction': 'Південний схід, сузір\'я Водолія',
        'direction_en': 'Southeast, constellation Aquarius',
        'description': 'Залишки комети Галлея, швидкі метеори',
        'description_en': 'Halley\'s comet debris, fast meteors'
    },
    {
        'name': 'Персеїди',
        'name_en': 'Perseids',
        'start': (7, 17),
        'peak': (8, 12),
        'end': (8, 24),
        'rate': 100,
        'best_time': '22:00 - 05:00',
        'best_time_en': '22:00 - 05:00',
        'direction': 'Північний схід, сузір\'я Персея',
        'direction_en': 'Northeast, constellation Perseus',
        'description': 'Найпопулярніший потік, яскраві метеори',
        'description_en': 'Most popular shower, bright meteors'
    },
    {
        'name': 'Оріоніди',
        'name_en': 'Orionids',
        'start': (10, 2),
        'peak': (10, 21),
        'end': (11, 7),
        'rate': 20,
        'best_time': 'Після півноці',
        'best_time_en': 'After midnight',
        'direction': 'Південний схід, сузір\'я Оріона',
        'direction_en': 'Southeast, constellation Orion',
        'description': 'Залишки комети Галлея',
        'description_en': 'Halley\'s comet debris'
    },
    {
        'name': 'Леоніди',
        'name_en': 'Leonids',
        'start': (11, 6),
        'peak': (11, 17),
        'end': (11, 30),
        'rate': 15,
        'best_time': 'Після опівночі',
        'best_time_en': 'After midnight',
        'direction': 'Південний схід, сузір\'я Лева',
        'direction_en': 'Southeast, constellation Leo',
        'description': 'Іноді дають метеорний шторм',
        'description_en': 'Sometimes produce a meteor storm'
    },
    {
        'name': 'Гемініди',
        'name_en': 'Geminids',
        'start': (12, 4),
        'peak': (12, 14),
        'end': (12, 17),
        'rate': 150,
        'best_time': '21:00 - 04:00',
        'best_time_en': '21:00 - 04:00',
        'direction': 'Південний схід, сузір\'я Близнят',
        'direction_en': 'Southeast, constellation Gemini',
        'description': 'Найактивніший потік року!',
        'description_en': 'Most active shower of the year!'
    }
]


class MeteorShower:
    """Meteor shower tracking"""
    
    @staticmethod
    def get_date_for_year(month, day, year=None):
        """Get datetime for specific month/day in current or next year"""
        if year is None:
            year = datetime.now().year
        
        try:
            return datetime(year, month, day)
        except ValueError:
            # Leap year issue
            return datetime(year, month, 28)
    
    @staticmethod
    def get_next_shower():
        """Get next upcoming meteor shower"""
        now = datetime.now()
        
        for shower in METEOR_SHOWERS:
            peak_date = MeteorShower.get_date_for_year(
                shower['peak'][0], 
                shower['peak'][1]
            )
            
            # If peak passed this year, check next year
            if peak_date < now:
                peak_date = MeteorShower.get_date_for_year(
                    shower['peak'][0], 
                    shower['peak'][1], 
                    now.year + 1
                )
            
            days_until = (peak_date - now).days
            shower['days_until'] = days_until
            shower['peak_datetime'] = peak_date
            
            if days_until >= 0:
                return shower
        
        return None
    
    @staticmethod
    def get_upcoming_showers(limit=3):
        """Get list of upcoming showers"""
        now = datetime.now()
        upcoming = []
        
        for shower in METEOR_SHOWERS:
            peak_date = MeteorShower.get_date_for_year(
                shower['peak'][0], 
                shower['peak'][1]
            )
            
            # If peak passed, use next year
            if peak_date < now:
                peak_date = MeteorShower.get_date_for_year(
                    shower['peak'][0], 
                    shower['peak'][1], 
                    now.year + 1
                )
            
            days_until = (peak_date - now).days
            shower_copy = shower.copy()
            shower_copy['days_until'] = days_until
            shower_copy['peak_datetime'] = peak_date
            upcoming.append(shower_copy)
        
        # Sort by days until
        upcoming.sort(key=lambda x: x['days_until'])
        
        return upcoming[:limit]
    
    @staticmethod
    def get_shower_status(shower, lang=DEFAULT_LANG):
        """Get status emoji and text for shower"""
        now = datetime.now()
        peak = shower['peak_datetime']

        # Active period
        start = MeteorShower.get_date_for_year(shower['start'][0], shower['start'][1], peak.year)
        end = MeteorShower.get_date_for_year(shower['end'][0], shower['end'][1], peak.year)

        if now >= start and now <= end:
            if abs((now - peak).days) <= 2:
                return t('meteor.status.peak', lang), "fire"
            else:
                return t('meteor.status.active', lang), "active"
        elif shower['days_until'] <= 7:
            return t('meteor.status.soon', lang), "soon"
        else:
            return t('meteor.status.future', lang, n=shower['days_until']), "future"

    @staticmethod
    def format_upcoming_showers(lang=DEFAULT_LANG):
        """Format upcoming meteor showers for Telegram"""
        showers = MeteorShower.get_upcoming_showers(4)

        message = t('meteor.title', lang)
        message += t('meteor.upcoming', lang)

        for i, shower in enumerate(showers):
            status, status_type = MeteorShower.get_shower_status(shower, lang)

            # Emoji based on activity
            if status_type == "fire":
                emoji = "🔥"
            elif status_type == "active":
                emoji = "✨"
            elif status_type == "soon":
                emoji = "⏳"
            else:
                emoji = "📅"

            peak_date = shower['peak_datetime'].strftime('%d.%m.%Y')
            bold_name = pick(shower, 'name', lang)
            other_name = shower['name_en'] if lang == 'uk' else shower['name']

            message += t('meteor.entry', lang, emoji=emoji, name=bold_name,
                          name_en=other_name, date=peak_date,
                          rate=shower['rate'],
                          best_time=pick(shower, 'best_time', lang),
                          status=status)

        # Add tips
        message += t('meteor.tips_header', lang)
        message += t('meteor.tip1', lang)
        message += t('meteor.tip2', lang)
        message += t('meteor.tip3', lang)
        message += t('meteor.tip4', lang)
        message += '\n'

        # Moon phase warning if applicable
        shower = showers[0] if showers else None
        if shower and shower.get('days_until', 999) <= 14:
            message += t('meteor.soon_warning', lang)
        else:
            message += t('meteor.regular', lang)

        return message
    
