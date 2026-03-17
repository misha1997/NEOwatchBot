"""Simple translator using free translation APIs"""
import requests
import logging
import json

logger = logging.getLogger(__name__)

# Try multiple free translation services
TRANSLATE_APIS = [
    "https://api.mymemory.translated.net/get",  # Free, no key needed
]

class Translator:
    """Simple translator for APOD descriptions"""
    
    @staticmethod
    def translate(text: str, source: str = 'en', target: str = 'uk') -> str:
        """Translate text using free API"""
        if not text or len(text.strip()) < 10:
            return text
        
        # Try MyMemory API (free, 1000 words/day)
        try:
            response = requests.get(
                "https://api.mymemory.translated.net/get",
                params={
                    "q": text[:500],  # Limit to 500 chars for free tier
                    "langpair": f"{source}|{target}"
                },
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                translated = data.get('responseData', {}).get('translatedText', '')
                if translated and translated != text:
                    return translated
                    
        except Exception as e:
            logger.error(f"Translation API error: {e}")
        
        return text
    
    @staticmethod
    def translate_apod(explanation: str) -> str:
        """Translate APOD explanation with fallback"""
        # If text is already mostly Ukrainian, skip
        cyrillic_count = sum(1 for c in explanation if 'А' <= c <= 'я' or c in 'іїєҐґ')
        if cyrillic_count > len(explanation) * 0.3:
            return explanation  # Already Ukrainian
        
        translated = Translator.translate(explanation, 'en', 'uk')
        
        # Add note if translation happened
        if translated != explanation:
            return f"{translated}\n\n<i>📝 Перекладено з англійської</i>"
        
        # If translation failed, add note about original
        return f"{explanation}\n\n<i>📝 Опис англійською</i>"

    @staticmethod
    def translate_news(text: str) -> str:
        """Translate news text with fallback"""
        if not text or len(text.strip()) < 5:
            return text

        # If text is already mostly Ukrainian, skip
        cyrillic_count = sum(1 for c in text if 'А' <= c <= 'я' or c in 'іїєҐґ')
        if cyrillic_count > len(text) * 0.3:
            return text  # Already Ukrainian

        translated = Translator.translate(text, 'en', 'uk')

        # Add note if translation happened
        if translated != text:
            return translated

        return text
