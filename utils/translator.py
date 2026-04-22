"""Translator using DeepL API with in-memory cache"""
import requests
import logging
from typing import List
from config import DEEPL_API_KEY

logger = logging.getLogger(__name__)

DEEPL_API_URL = "https://api-free.deepl.com/v2/translate"

# In-memory translation cache: (text, src, tgt) -> translated
translation_cache = {}


def _translate(texts: List[str], source: str = "EN", target: str = "UK") -> List[str]:
    """Translate list of texts via DeepL API. Returns originals on failure."""
    if not texts or not DEEPL_API_KEY:
        return texts

    # Filter out empty strings and already-cached entries
    to_translate = []
    indices = []
    results = list(texts)

    for i, text in enumerate(texts):
        if not text or len(text.strip()) < 3:
            results[i] = text
            continue
        key = (text.strip(), source.upper(), target.upper())
        if key in translation_cache:
            results[i] = translation_cache[key]
            continue
        to_translate.append(text.strip())
        indices.append(i)

    if not to_translate:
        return results

    try:
        response = requests.post(
            DEEPL_API_URL,
            headers={"Authorization": f"DeepL-Auth-Key {DEEPL_API_KEY}"},
            data={
                "text": to_translate,
                "source_lang": source.upper(),
                "target_lang": target.upper(),
                "split_sentences": "1",
            },
            timeout=15,
        )
        response.raise_for_status()
        data = response.json()

        translations = data.get("translations", [])
        for idx, trans in zip(indices, translations):
            translated = trans.get("text", results[idx])
            results[idx] = translated
            key = (texts[idx].strip(), source.upper(), target.upper())
            translation_cache[key] = translated

    except Exception as e:
        logger.error(f"DeepL translation error: {e}")
        # Return originals for failed items

    return results


class Translator:
    """Translator for APOD and news using DeepL API with caching."""

    @staticmethod
    def translate(text: str, source: str = "en", target: str = "uk") -> str:
        """Translate a single text."""
        if not text or len(text.strip()) < 10:
            return text
        return _translate([text], source, target)[0]

    @staticmethod
    def translate_apod(explanation: str) -> str:
        """Translate APOD explanation with fallback."""
        if not explanation:
            return explanation

        # Skip if already mostly Ukrainian
        cyrillic_count = sum(
            1 for c in explanation if "А" <= c <= "я" or c in "іїєҐґ"
        )
        if cyrillic_count > len(explanation) * 0.3:
            return explanation

        translated = Translator.translate(explanation, "en", "uk")
        if translated != explanation:
            return f"{translated}\n\n<i>📝 Перекладено з англійської</i>"
        return f"{explanation}\n\n<i>📝 Опис англійською</i>"

    @staticmethod
    def translate_news(text: str) -> str:
        """Translate news text with fallback."""
        if not text or len(text.strip()) < 5:
            return text

        # Skip if already mostly Ukrainian
        cyrillic_count = sum(
            1 for c in text if "А" <= c <= "я" or c in "іїєҐґ"
        )
        if cyrillic_count > len(text) * 0.3:
            return text

        return Translator.translate(text, "en", "uk")

    @staticmethod
    def translate_batch(texts: List[str]) -> List[str]:
        """Translate multiple texts in a single API call (used by scheduler for news)."""
        if not texts:
            return texts
        return _translate(texts, "en", "uk")
