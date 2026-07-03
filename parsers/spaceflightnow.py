"""SpaceFlightNow.com parser - Rocket launches and news"""
import requests
import re
import logging
from datetime import datetime
from typing import List, Dict, Optional
from utils.i18n import t, DEFAULT_LANG

logger = logging.getLogger(__name__)


class SpaceflightNowParser:
    """HTML parser for spaceflightnow.com/launch-schedule/"""

    @staticmethod
    def get_launches(lang=DEFAULT_LANG):
        """Parse upcoming launches from spaceflightnow.com"""
        try:
            url = "https://spaceflightnow.com/launch-schedule/"
            headers = {'User-Agent': 'Mozilla/5.0 (compatible; NEOwatchBot/1.0)'}
            response = requests.get(url, headers=headers, timeout=15)

            if response.status_code != 200:
                raise Exception(f"HTTP {response.status_code}")

            launches = SpaceflightNowParser._parse_html(response.text)

            if launches:
                return SpaceflightNowParser._format_launches(launches, lang=lang)
            else:
                raise Exception("No launches found")

        except Exception as e:
            logger.error(f"Spaceflightnow parsing failed: {e}")
            return SpaceflightNowParser._format_fallback(lang=lang)
    
    @staticmethod
    def _parse_html(html):
        """Extract launch data from HTML"""
        launches = []
        
        # Pattern: datename div contains launchdate + mission
        # missiondata div contains time and site
        launch_blocks = re.findall(
            r'<div class="datename">\s*<span class="launchdate">\s*([^<]+)</span>'
            r'\s*<span class="mission">\s*([^<]+)</span>\s*</div>'
            r'\s*<div class="missiondata">(.*?)</div>',
            html, re.DOTALL
        )
        
        for date, mission, details in launch_blocks:
            date = date.strip()
            mission = mission.strip()
            
            # Extract launch time
            time_match = re.search(r'Launch time:</span>\s*([^<]+)', details)
            launch_time = time_match.group(1).strip() if time_match else 'TBD'
            
            # Extract launch site
            site_match = re.search(r'Launch site:</span>\s*([^<]+)', details)
            launch_site = site_match.group(1).strip() if site_match else 'TBD'
            
            # Clean HTML entities
            mission = SpaceflightNowParser._clean_html_entities(mission)
            date = SpaceflightNowParser._clean_html_entities(date)
            
            launches.append({
                'date': date,
                'mission': mission,
                'time': launch_time,
                'site': launch_site
            })
        
        return launches
    
    @staticmethod
    def _clean_html_entities(text):
        """Clean HTML entities from text"""
        replacements = {
            '&#8216;': "'",
            '&#8217;': "'",
            '&#8220;': '"',
            '&#8221;': '"',
            '&amp;': '&',
            '&#171;': '"',
            '&#187;': '"',
            '&#39;': "'",
            '&quot;': '"'
        }
        for old, new in replacements.items():
            text = text.replace(old, new)
        return text
    
    @staticmethod
    def _format_launches(launches, max_count=8, lang=DEFAULT_LANG):
        """Format launches for Telegram"""
        message = t('sfn.title', lang)
        message += t('sfn.subtitle', lang) + "\n\n"

        current_launch_date = None
        for launch in launches[:max_count]:
            if launch['date'] != current_launch_date:
                current_launch_date = launch['date']
                message += t('sfn.date_line', lang, date=current_launch_date)

            mission = launch['mission'].replace('•', '|')
            message += t('sfn.mission_line', lang, mission=mission)
            message += t('sfn.time_line', lang, time=launch['time'])
            message += t('sfn.site_line', lang, site=launch['site'])

        return {'text': message, 'image': None}

    @staticmethod
    def get_news():
        """Parse latest news from spaceflightnow.com"""
        try:
            url = "https://spaceflightnow.com/category/news-archive/"
            headers = {'User-Agent': 'Mozilla/5.0 (compatible; NEOwatchBot/1.0)'}
            response = requests.get(url, headers=headers, timeout=15)

            if response.status_code != 200:
                raise Exception(f"HTTP {response.status_code}")

            articles = SpaceflightNowParser._parse_news_html(response.text)

            if articles:
                return articles[:5]  # Return top 5 articles
            else:
                return []

        except Exception as e:
            logger.error(f"Spaceflightnow news parsing failed: {e}")
            return []

    @staticmethod
    def _parse_news_html(html: str) -> List[Dict]:
        """Extract news articles from HTML"""
        articles = []

        # Pattern for article entries in MH Magazine theme
        # Each article is in <article class="post"> or similar structure
        article_blocks = re.findall(
            r'<article[^>]*class="[^"]*post[^"]*"[^>]*>.*?<h3[^>]*class="[^"]*entry-title[^"]*">'
            r'\s*<a\s+href="([^"]+)"[^>]*>([^<]+)</a>.*?</article>',
            html, re.DOTALL | re.IGNORECASE
        )

        if not article_blocks:
            # Try alternative pattern
            article_blocks = re.findall(
                r'<div[^>]*class="[^"]*mh-posts-large-item[^"]*"[^>]*>.*?<h3[^>]*>'
                r'\s*<a\s+href="([^"]+)"[^>]*>([^<]+)</a>.*?</div>',
                html, re.DOTALL | re.IGNORECASE
            )

        for i, (url, title) in enumerate(article_blocks):
            try:
                title = SpaceflightNowParser._clean_html_entities(title.strip())

                # Extract date
                date_match = re.search(
                    r'<span[^>]*class="[^"]*mh-meta-date[^"]*"[^>]*>.*?<a[^>]*>([^<]+)</a>',
                    html, re.DOTALL | re.IGNORECASE
                )
                date_str = date_match.group(1).strip() if date_match else 'Unknown'

                # Extract excerpt/summary
                excerpt_match = re.search(
                    r'<div[^>]*class="[^"]*mh-excerpt[^"]*"[^>]*>(.*?)</div>',
                    html, re.DOTALL | re.IGNORECASE
                )
                if not excerpt_match:
                    excerpt_match = re.search(
                        r'<div[^>]*class="entry-summary"[^>]*>(.*?)</div>',
                        html, re.DOTALL | re.IGNORECASE
                    )

                excerpt = ''
                if excerpt_match:
                    excerpt = re.sub(r'<[^>]+>', '', excerpt_match.group(1))  # Remove HTML tags
                    excerpt = SpaceflightNowParser._clean_html_entities(excerpt.strip())
                    excerpt = excerpt[:300] + '...' if len(excerpt) > 300 else excerpt

                # Extract category
                category_match = re.search(
                    r'<span[^>]*class="[^"]*mh-meta-category[^"]*"[^>]*>(.*?)</span>',
                    html, re.DOTALL | re.IGNORECASE
                )
                category = ''
                if category_match:
                    category = re.sub(r'<[^>]+>', '', category_match.group(1)).strip()

                articles.append({
                    'title': title,
                    'url': url,
                    'date': date_str,
                    'excerpt': excerpt,
                    'category': category
                })
            except Exception as e:
                logger.warning(f"Failed to parse article {i}: {e}")
                continue

        return articles

    @staticmethod
    def _format_fallback(lang=DEFAULT_LANG):
        """Format fallback message when parsing fails"""
        current_date = datetime.now()
        message = t('sfn.fallback_title', lang)
        message += t('sfn.fallback_sub', lang) + "\n\n"
        message += t('sfn.fallback_check', lang)
        message += t('sfn.fallback_link1', lang)
        message += t('sfn.fallback_link2', lang) + "\n"
        message += t('sfn.fallback_today', lang, date=current_date.strftime('%d.%m.%Y'))
        message += t('sfn.fallback_wait', lang)

        return {'text': message, 'image': None}
