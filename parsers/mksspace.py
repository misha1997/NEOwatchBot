"""MKS.Space parser - Ukrainian ISS website"""
import requests
import re
import logging
from utils.constants import ISS_CREW_CACHE

logger = logging.getLogger(__name__)


class MksSpaceParser:
    """HTML parser for mks.space/uk/"""
    
    @staticmethod
    def get_crew():
        """Parse ISS crew from mks.space"""
        try:
            url = "https://mks.space/uk/"
            headers = {'User-Agent': 'Mozilla/5.0 (compatible; NEOwatchBot/1.0)'}
            response = requests.get(url, headers=headers, timeout=15)
            
            if response.status_code != 200:
                raise Exception(f"HTTP {response.status_code}")
            
            return MksSpaceParser._parse_crew(response.text)
            
        except Exception as e:
            logger.error(f"mks.space parsing failed: {e}")
            return None
    
    @staticmethod
    def _parse_crew(html):
        """Extract crew names from HTML - mks.space format"""
        crew = []
        
        # Find section between "Наразі на борту" and "Міжнародна космічна станція"
        idx_start = html.find('Наразі на борту')
        idx_end = html.find('Міжнародна космічна станція')
        
        if idx_start > 0 and idx_end > idx_start:
            section = html[idx_start:idx_end]
            
            # Extract all names from post-title-middle <strong> tags
            pattern = r'<div class="post-title-middle"><p><strong>([^\u003c]+)</strong>'
            matches = re.findall(pattern, section)
            
            for name in matches:
                name = name.strip()
                if name and len(name) > 3:
                    # Match with cache for flags
                    matched = MksSpaceParser._match_name(name)
                    if matched:
                        crew.append({
                            'name': matched['name_en'],
                            'flag': matched['flag'],
                            'nationality': matched['nationality'],
                            'agency': matched.get('agency', '')
                        })
                    else:
                        # Unknown person
                        flag, nationality = MksSpaceParser._guess_nationality(name)
                        crew.append({
                            'name': name,
                            'flag': flag,
                            'nationality': nationality,
                            'agency': ''
                        })
        
        return crew if crew else None
    
    @staticmethod
    def _match_name(name):
        """Match name from mks.space to ISS_CREW_CACHE"""
        name_clean = name.lower().strip()
        
        # Direct match
        if name_clean in ISS_CREW_CACHE:
            return ISS_CREW_CACHE[name_clean]
        
        # Check if any cache key matches parts of the name
        for cache_name, data in ISS_CREW_CACHE.items():
            # Check if last name matches
            cache_parts = cache_name.split()
            name_parts = name_clean.split()
            
            if len(cache_parts) > 1 and len(name_parts) > 1:
                # Match by last name
                if cache_parts[-1] == name_parts[-1]:
                    return data
                # Match by first name
                if cache_parts[0] == name_parts[0]:
                    return data
        
        return None
    
    @staticmethod
    def _guess_nationality(name):
        """Guess nationality by name"""
        name_lower = name.lower()
        
        # Russian/Cyrillic patterns
        russian_names = ['sergey', 'andrey', 'mikhail', 'aleksandr', 'dmitry', 'ivan', 'oleg']
        for rname in russian_names:
            if rname in name_lower:
                return '🏳️', 'Росія'
        
        # Common US names
        us_names = ['jessica', 'jack', 'chris', 'john', 'michael', 'david', 'robert']
        for uname in us_names:
            if uname in name_lower:
                return '🏳️', 'США'
        
        # Common European names
        if 'sophie' in name_lower:
            return '🏳️', 'Франція'
        
        return '🏳️', 'Невідомо'
