"""ISS Crew API Service - Using only mks.space parser"""
import logging
from parsers.mksspace import MksSpaceParser

logger = logging.getLogger(__name__)


class ISSCrewAPI:
    """ISS crew data from mks.space only"""
    
    @staticmethod
    def get_iss_crew():
        """Get ISS crew from mks.space parser"""
        return MksSpaceParser.get_crew()
    
    @staticmethod
    def format_crew_for_telegram(crew):
        """Format crew list for Telegram"""
        if not crew:
            return "👨‍🚀 <b>Екіпаж МКС</b>\n\n<i>(дані з mks.space)</i>\n\n❌ Інформація недоступна"
        
        by_country = {}
        for person in crew:
            country = person['nationality']
            if country not in by_country:
                by_country[country] = []
            by_country[country].append(person)
        
        message = f"👨‍🚀 <b>Екіпаж МКС ({len(crew)} астронавтів)</b>\n"
        message += "<i>(дані з mks.space)</i>\n\n"
        
        for country, people in by_country.items():
            flag = people[0]['flag']
            message += f"{flag} <b>{country}</b>:\n"
            for person in people:
                message += f"  • {person['name']}\n"
            message += "\n"
        
        return message
