"""Meteor showers data and utilities"""
import logging
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)

# Major meteor showers data
# Dates are in format (month, day)
METEOR_SHOWERS = [
    {
        'name': 'Квадрантиди',
        'name_en': 'Quadrantids',
        'start': (1, 1),
        'peak': (1, 3),
        'end': (1, 5),
        'rate': 120,
        'best_time': 'Після півноці до світанку',
        'direction': 'Північна частина неба, сузір\'я Волопаса',
        'description': 'Один з найактивніших потоків року'
    },
    {
        'name': 'Ліриди',
        'name_en': 'Lyrids',
        'start': (4, 16),
        'peak': (4, 22),
        'end': (4, 25),
        'rate': 18,
        'best_time': '02:00 - 04:00',
        'direction': 'Схід, сузір\'я Ліри',
        'description': 'Відомі яскравими метеорами-вогниками'
    },
    {
        'name': 'Ета-Аквариди',
        'name_en': 'Eta Aquariids',
        'start': (4, 19),
        'peak': (5, 6),
        'end': (5, 28),
        'rate': 50,
        'best_time': 'Перед світанком (04:00-05:00)',
        'direction': 'Південний схід, сузір\'я Водолія',
        'description': 'Залишки комети Галлея, швидкі метеори'
    },
    {
        'name': 'Персеїди',
        'name_en': 'Perseids',
        'start': (7, 17),
        'peak': (8, 12),
        'end': (8, 24),
        'rate': 100,
        'best_time': '22:00 - 05:00',
        'direction': 'Північний схід, сузір\'я Персея',
        'description': 'Найпопулярніший потік, яскраві метеори'
    },
    {
        'name': 'Оріоніди',
        'name_en': 'Orionids',
        'start': (10, 2),
        'peak': (10, 21),
        'end': (11, 7),
        'rate': 20,
        'best_time': 'Після півноці',
        'direction': 'Південний схід, сузір\'я Оріона',
        'description': 'Залишки комети Галлея'
    },
    {
        'name': 'Леоніди',
        'name_en': 'Leonids',
        'start': (11, 6),
        'peak': (11, 17),
        'end': (11, 30),
        'rate': 15,
        'best_time': 'Після опівночі',
        'direction': 'Південний схід, сузір\'я Лева',
        'description': 'Іноді дають метеорний шторм'
    },
    {
        'name': 'Гемініди',
        'name_en': 'Geminids',
        'start': (12, 4),
        'peak': (12, 14),
        'end': (12, 17),
        'rate': 150,
        'best_time': '21:00 - 04:00',
        'direction': 'Південний схід, сузір\'я Близнят',
        'description': 'Найактивніший потік року!'
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
    def get_shower_status(shower):
        """Get status emoji and text for shower"""
        now = datetime.now()
        peak = shower['peak_datetime']
        
        # Active period
        start = MeteorShower.get_date_for_year(shower['start'][0], shower['start'][1], peak.year)
        end = MeteorShower.get_date_for_year(shower['end'][0], shower['end'][1], peak.year)
        
        if now >= start and now <= end:
            if abs((now - peak).days) <= 2:
                return "🔥 ПІК ЗАРАЗ!", "fire"
            else:
                return "✨ Активно", "active"
        elif shower['days_until'] <= 7:
            return "⏳ Скоро", "soon"
        else:
            return f"📅 Через {shower['days_until']} дн.", "future"
    
    @staticmethod
    def format_upcoming_showers():
        """Format upcoming meteor showers for Telegram"""
        showers = MeteorShower.get_upcoming_showers(4)
        
        message = "🌠 <b>Метеорні потоки</b>\n\n"
        message += "📈 <b>Найближчі події:</b>\n\n"
        
        for i, shower in enumerate(showers):
            status, status_type = MeteorShower.get_shower_status(shower)
            
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
            
            message += f"{emoji} <b>{shower['name']}</b> ({shower['name_en']})\n"
            message += f"   📅 Пік: {peak_date}\n"
            message += f"   📊 Інтенсивність: до {shower['rate']} метеорів/год\n"
            message += f"   🕐 {shower['best_time']}\n"
            message += f"   {status}\n\n"
        
        # Add tips
        message += "💡 <b>Поради для спостереження:</b>\n"
        message += "• Знайдіть місце без світлового забруднення\n"
        message += "• Дайте очам адаптуватись 15-20 хв\n"
        message += "• Лежіть на спині, щоб бачити все небо\n"
        message += "• Спокійно очікуйте, метеори з'являться\n\n"
        
        # Moon phase warning if applicable
        shower = showers[0] if showers else None
        if shower and shower.get('days_until', 999) <= 14:
            message += "⚠️ До піку <b>менше 2 тижнів</b> — плануйте спостереження!"
        else:
            message += "🌠 Дані оновлюються регулярно"
        
        return message
    
    @staticmethod
    def should_notify():
        """Check if we should send notification today"""
        now = datetime.now()
        next_shower = MeteorShower.get_next_shower()
        
        if not next_shower:
            return None
        
        days = next_shower['days_until']
        
        # Notify at 7, 3, 1 days before
        if days in [7, 3, 1]:
            return next_shower
        
        # Notify on peak day
        if days == 0:
            return next_shower
        
        return None
    
    @staticmethod
    def get_notification_message(shower):
        """Get notification message for a shower"""
        days = shower['days_until']
        
        if days == 0:
            message = f"🔥 <b>СЬОГОДНІ ПІК {shower['name'].upper()}!</b>\n\n"
            message += f"💫 До {shower['rate']} метеорів за годину\n"
            message += f"🕐 Найкращий час: {shower['best_time']}\n"
            message += f"📍 Дивіться: {shower['direction']}\n\n"
            message += "✨ Не пропустіть!"
        elif days == 1:
            message = f"⏳ <b>ЗАВТРА {shower['name'].upper()}!</b>\n\n"
            message += f"💫 Пік активності з {shower['rate']} метеорів/год\n"
            message += f"🕐 {shower['best_time']}\n\n"
            message += "🎒 Приготуйтеся ввечері!"
        else:
            message = f"📅 <b>Через {days} днів: {shower['name']}</b>\n\n"
            message += f"🔥 {shower['description']}\n"
            message += f"💫 До {shower['rate']} метеорів/год\n"
            message += f"📅 Пік: {shower['peak_datetime'].strftime('%d.%m')}\n\n"
            message += "📝 Заплануйте вечір!"
        
        return message
