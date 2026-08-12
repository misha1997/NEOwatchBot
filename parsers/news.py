"""Generic news aggregator and parser for space news RSS feeds"""
import requests
import re
import logging
import xml.etree.ElementTree as ET
from datetime import datetime
from email.utils import parsedate_to_datetime
from typing import List, Dict, Optional
from utils.i18n import t, DEFAULT_LANG

logger = logging.getLogger(__name__)


class NewsParser:
    """Aggregates and parses space news from multiple RSS feeds"""

    FEEDS = [
        {
            "source": "SpaceflightNow",
            "url": "https://spaceflightnow.com/feed",
            "category": "Spaceflight"
        },
        {
            "source": "NASA",
            "url": "https://www.nasa.gov/news-release/feed/",
            "category": "NASA News"
        },
        {
            "source": "ESA",
            "url": "https://www.esa.int/rssfeed/TopNews",
            "category": "ESA News"
        },
        {
            "source": "SpaceNews",
            "url": "https://spacenews.com/feed/",
            "category": "SpaceNews"
        },
        {
            "source": "Universe Today",
            "url": "https://www.universetoday.com/feed/",
            "category": "Universe Today"
        }
    ]

    @staticmethod
    def get_news() -> List[Dict]:
        """Fetch all configured news feeds, parse them, and return a merged list sorted by date."""
        all_articles = []
        headers = {'User-Agent': 'Mozilla/5.0 (compatible; NEOwatchBot/1.0)'}

        for feed in NewsParser.FEEDS:
            source_name = feed["source"]
            feed_url = feed["url"]
            feed_cat = feed["category"]
            
            try:
                response = requests.get(feed_url, headers=headers, timeout=15)
                if response.status_code != 200:
                    logger.warning(f"Failed to fetch feed {source_name}: HTTP {response.status_code}")
                    continue
                
                # Parse RSS XML
                root = ET.fromstring(response.content)
                
                def localname(el):
                    return el.tag.split('}')[-1]

                def find_text(item, name):
                    for ch in item:
                        if localname(ch) == name:
                            return (ch.text or "").strip()
                    return ""

                def find_all_text(item, name):
                    return [(ch.text or "").strip() for ch in item if localname(ch) == name]

                items = root.findall('.//item')
                for item in items:
                    try:
                        title = NewsParser._clean_html_entities(find_text(item, 'title'))
                        link = find_text(item, 'link')
                        if not title or not link:
                            continue

                        # Parse publish date
                        date_str = ''
                        pub = find_text(item, 'pubDate')
                        if pub:
                            try:
                                dt = parsedate_to_datetime(pub)
                                date_str = dt.strftime('%d.%m.%Y')
                            except Exception:
                                date_str = ''
                        if not date_str:
                            url_date = re.search(r'/(\d{4})/(\d{2})/(\d{2})/', link)
                            if url_date:
                                y, mo, da = url_date.group(1), url_date.group(2), url_date.group(3)
                                try:
                                    date_str = datetime(int(y), int(mo), int(da)).strftime('%d.%m.%Y')
                                except ValueError:
                                    date_str = f"{da}.{mo}.{y}"
                            else:
                                date_str = datetime.now().strftime('%d.%m.%Y')

                        # Excerpt from <description>
                        desc = find_text(item, 'description')
                        excerpt = re.sub(r'<[^>]+>', '', desc)
                        excerpt = NewsParser._clean_html_entities(excerpt.strip())
                        if len(excerpt) > 300:
                            excerpt = excerpt[:300] + '...'

                        # Categories
                        cats = find_all_text(item, 'category')
                        raw_category = cats[0] if cats else feed_cat

                        # Body and Image
                        encoded = find_text(item, 'encoded') or find_text(item, 'content')
                        body = NewsParser._clean_body_html(encoded) if encoded else excerpt
                        
                        image = ''
                        if encoded:
                            img_match = re.search(r'<img[^>]+src="([^"]+)"', encoded, re.IGNORECASE)
                            if img_match:
                                image = img_match.group(1)
                        
                        # Fallback for hero image search if empty
                        if not image and desc:
                            img_match = re.search(r'<img[^>]+src="([^"]+)"', desc, re.IGNORECASE)
                            if img_match:
                                image = img_match.group(1)

                        bucket = NewsParser._classify(raw_category, title + " " + excerpt)

                        # Parse date object for sorting
                        parsed_dt = None
                        if pub:
                            try:
                                parsed_dt = parsedate_to_datetime(pub)
                            except Exception:
                                pass
                        if not parsed_dt:
                            parsed_dt = datetime.now()

                        all_articles.append({
                            'title': title,
                            'url': link,
                            'date': date_str,
                            'excerpt': excerpt,
                            'category': raw_category,
                            'category_bucket': bucket,
                            'body': body,
                            'image': image,
                            'author': find_text(item, 'creator') or source_name,
                            'source': source_name,
                            '_datetime': parsed_dt
                        })
                    except Exception as item_err:
                        logger.warning(f"Failed to parse item from feed {source_name}: {item_err}")
                        continue

            except Exception as e:
                logger.error(f"Error fetching/parsing feed {source_name}: {e}")
                continue

        # Sort all aggregated articles by publication date descending
        all_articles.sort(key=lambda x: x['_datetime'], reverse=True)
        
        # Remove helper sorting key before returning
        for a in all_articles:
            a.pop('_datetime', None)

        return all_articles

    @staticmethod
    def get_article_content(url: str) -> Dict:
        """Fetch a single article page and extract its main body text + hero image."""
        try:
            headers = {'User-Agent': 'Mozilla/5.0 (compatible; NEOwatchBot/1.0)'}
            response = requests.get(url, headers=headers, timeout=15)
            if response.status_code != 200:
                raise Exception(f"HTTP {response.status_code}")
            
            html = response.text
            
            # Domain-specific selectors
            content_html = ""
            img = ""
            
            if "spaceflightnow.com" in url:
                # Reuse entry-content selector
                open_match = re.search(r'<div[^>]*class="[^"]*\bentry-content\b[^"]*"[^>]*>', html, re.IGNORECASE)
                if open_match:
                    rest = html[open_match.end():]
                    terminators = ["</article>", "</footer>", '<section id="comments"', '<div class="mh-post-prev-next"', '<aside']
                    end_idx = len(rest)
                    for term in terminators:
                        term_match = re.search(re.escape(term), rest, re.IGNORECASE)
                        if term_match and term_match.start() < end_idx:
                            end_idx = term_match.start()
                    content_html = rest[:end_idx]
            elif "nasa.gov" in url:
                # NASA uses entry-content or specific containers
                article_match = re.search(r'<article[^>]*>.*?</article>', html, re.DOTALL | re.IGNORECASE)
                if article_match:
                    content_html = article_match.group(0)
                else:
                    open_match = re.search(r'<div[^>]*class="[^"]*\b(?:entry-content|nasa-content|post-content)\b[^"]*"[^>]*>', html, re.IGNORECASE)
                    if open_match:
                        rest = html[open_match.end():]
                        content_html = rest.split('</div>', 1)[0]
            elif "spacenews.com" in url:
                open_match = re.search(r'<div[^>]*class="[^"]*\b(?:post-content|entry-content)\b[^"]*"[^>]*>', html, re.IGNORECASE)
                if open_match:
                    rest = html[open_match.end():]
                    content_html = rest.split('</div>', 1)[0]
            
            # Fallback if no specific section is found
            if not content_html:
                # Strip menus, sidebars, headers, footers
                clean_html = re.sub(r'<(header|footer|aside|nav|noscript|script|style)[^>]*>.*?</\1>', '', html, flags=re.DOTALL | re.IGNORECASE)
                # Find the main container or use the cleaned body
                body_match = re.search(r'<body[^>]*>(.*?)</body>', clean_html, re.DOTALL | re.IGNORECASE)
                content_html = body_match.group(1) if body_match else clean_html

            # Extract first image inside content_html
            if content_html:
                img_match = re.search(r'<img[^>]+src="([^"]+)"', content_html, re.IGNORECASE)
                if img_match:
                    img = img_match.group(1)
            
            # Extract paragraphs
            paragraphs = []
            if content_html:
                # Match <p>...</p> tags
                p_matches = re.finditer(r'<p[^>]*>(.*?)</p>', content_html, re.DOTALL | re.IGNORECASE)
                for p in p_matches:
                    p_text = re.sub(r'<[^>]+>', '', p.group(1)) # Strip nested tags
                    p_text = NewsParser._clean_html_entities(p_text.strip())
                    if len(p_text) > 30 and not any(k in p_text.lower() for k in ("follow us on", "read more:", "copyright ©")):
                        paragraphs.append(p_text)

            body_text = "\n\n".join(paragraphs)
            if len(body_text) > 6000:
                body_text = body_text[:6000] + "..."

            return {"body": body_text, "image": img}
        except Exception as e:
            logger.warning(f"Generic content parse failed for {url}: {e}")
            return {"body": "", "image": ""}

    @staticmethod
    def _classify(cat_raw: str, text: str) -> str:
        """Map raw category label + text to launches, discoveries, tech, or missions."""
        hay = ((cat_raw or "") + " " + (text or "")).lower()
        if any(k in hay for k in (
            "launch", "falcon", "starship", "ariane", "electron", "neutron",
            "rocket", "heavy", "debut", "maiden", "atlas", "vulcan", "h3",
            "soyuz", "союз", "space transportation"
        )):
            return "launches"
        if any(k in hay for k in (
            "discover", "detected", "found", "evidence", "supernova", "exoplanet",
            "water vapor", "water vapour", "organic", "signal", "confirm",
            "black hole", "galaxy", "cosmic", "universe", "planet found", "space science",
            "nebula", "telescope"
        )):
            return "discoveries"
        if any(k in hay for k in (
            "test", "technology", "engine", "heat shield", "detector", "prototype",
            "nuclear", "patent", "design", "antenna", "solar sail", "material", "instrument"
        )):
            return "tech"
        return "missions"

    @staticmethod
    def _clean_body_html(html: str) -> str:
        """Strip tag list, footer, convert blocks to breaks, strip remaining tags, cap at 6000 chars."""
        if not html:
            return ""
        # Drop entry tags / metadata
        html = re.sub(r'<div[^>]*class="[^"]*\bentry-tags\b[^"]*"[^>]*>.*?</div>', '', html, flags=re.DOTALL | re.IGNORECASE)
        html = re.sub(r'<footer[^>]*class="[^"]*\bentry-(?:meta|footer)\b[^"]*"[^>]*>.*?</footer>', '', html, flags=re.DOTALL | re.IGNORECASE)
        
        # Convert tags to paragraph breaks
        body = re.sub(r'<(p|br|/p|/div|/h[1-6])[^>]*>', '\n', html, flags=re.IGNORECASE)
        body = re.sub(r'<[^>]+>', '', body)
        
        # Clean entities
        body = NewsParser._clean_html_entities(body)
        
        # Normalize whitespace and limit length
        paragraphs = [p.strip() for p in body.split('\n') if len(p.strip()) > 30]
        body = "\n\n".join(paragraphs)
        
        if len(body) > 6000:
            body = body[:6000] + "..."
        return body

    @staticmethod
    def _clean_html_entities(text: str) -> str:
        """Perform simple replacements of common HTML entities."""
        if not text:
            return ""
        repl = {
            '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>',
            '&quot;': '"', '&#39;': "'", '&rsquo;': "'", '&lsquo;': "'",
            '&ldquo;': '"', '&rdquo;': '"', '&ndash;': '–', '&mdash;': '—',
            '&#8217;': "'", '&#8216;': "'", '&#8220;': '"', '&#8221;': '"',
            '&#8211;': '–', '&#8212;': '—'
        }
        for ent, val in repl.items():
            text = text.replace(ent, val)
        # Regex for numeric HTML entities (e.g. &#1234;)
        text = re.sub(r'&#(\d+);', lambda m: chr(int(m.group(1))), text)
        text = re.sub(r'&#x([a-fA-F0-9]+);', lambda m: chr(int(m.group(1), 16)), text)
        return text
