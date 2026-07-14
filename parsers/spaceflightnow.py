"""SpaceFlightNow.com parser - Rocket launches and news"""
import requests
import re
import logging
from datetime import datetime
from email.utils import parsedate_to_datetime
from xml.etree import ElementTree as ET
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
        """Parse latest news from spaceflightnow.com.

        Primary source is the RSS feed (``get_news_feed``) — one request
        returns the 10 most recent articles with their full body + image.
        Falls back to the HTML scrape (``_parse_news_html``) only if the feed
        is unreachable or returns nothing."""
        items = SpaceflightNowParser.get_news_feed()
        if items:
            return items
        try:
            url = "https://spaceflightnow.com/category/news-archive/"
            headers = {'User-Agent': 'Mozilla/5.0 (compatible: NEOwatchBot/1.0)'}
            response = requests.get(url, headers=headers, timeout=15)
            if response.status_code != 200:
                raise Exception(f"HTTP {response.status_code}")
            articles = SpaceflightNowParser._parse_news_html(response.text)
            return articles[:5] if articles else []
        except Exception as e:
            logger.error(f"Spaceflightnow news parsing failed: {e}")
            return []

    @staticmethod
    def _clean_body_html(html: str) -> str:
        """Turn article HTML (from the RSS ``content:encoded`` or the scraped
        ``entry-content``) into clean paragraph text.

        Shared by ``get_news_feed`` and ``get_article_content``. Drops the
        article's own tag list / entry footer (WordPress metadata, not prose —
        would otherwise render as a garbled "B1085Falcon 9SiriusXM…" string),
        converts block tags to paragraph breaks, strips the rest, and caps at
        6000 chars."""
        if not html:
            return ""
        # Drop the article's own tag list + entry footer (metadata, not body).
        html = re.sub(
            r'<div[^>]*class="[^"]*\bentry-tags\b[^"]*"[^>]*>.*?</div>',
            '', html, flags=re.DOTALL | re.IGNORECASE
        )
        html = re.sub(
            r'<footer[^>]*class="[^"]*\bentry-(?:meta|footer)\b[^"]*"[^>]*>.*?</footer>',
            '', html, flags=re.DOTALL | re.IGNORECASE
        )
        # Block tags → paragraph breaks; strip the rest.
        body = re.sub(r'<(p|br|/p|/div|/h[1-6])[^>]*>', '\n', html, flags=re.IGNORECASE)
        body = re.sub(r'<[^>]+>', '', body)
        body = SpaceflightNowParser._clean_html_entities(body)
        # Drop any leftover speculation-rules JSON that slipped through.
        body = re.sub(r'\{"prefetch".*$', '', body, flags=re.DOTALL)
        lines = [re.sub(r'[ \t]+', ' ', ln).strip() for ln in body.split('\n')]
        lines = [ln for ln in lines if ln]
        body = '\n\n'.join(lines)
        if len(body) > 6000:
            body = body[:6000] + '...'
        return body

    @staticmethod
    def get_news_feed() -> List[Dict]:
        """Parse the SpaceflightNow RSS feed (``/feed``) into article dicts.

        One request returns the 10 most recent posts, each with the full body
        (``content:encoded``) + hero image — so the caller (ingest) gets body
        and image without a per-article HTTP fetch. Each item has the same
        keys the HTML parser produces (``title``, ``url``, ``date``,
        ``excerpt``, ``category``, ``category_bucket``) plus ``body`` /
        ``image`` / ``author``. Returns ``[]`` on any failure (log + return,
        never raises) so callers can fall back to the HTML scrape."""
        try:
            url = "https://spaceflightnow.com/feed"
            headers = {'User-Agent': 'Mozilla/5.0 (compatible: NEOwatchBot/1.0)'}
            response = requests.get(url, headers=headers, timeout=20)
            if response.status_code != 200:
                raise Exception(f"HTTP {response.status_code}")
            root = ET.fromstring(response.text)

            def localname(el):
                return el.tag.split('}')[-1]

            def find_text(item, name):
                # Items use namespaced children (dc:creator, content:encoded).
                for ch in item:
                    if localname(ch) == name:
                        return (ch.text or "").strip()
                return ""

            def find_all_text(item, name):
                return [(ch.text or "").strip()
                        for ch in item if localname(ch) == name]

            items = root.findall('.//item')
            articles = []
            for item in items:
                try:
                    title = SpaceflightNowParser._clean_html_entities(
                        find_text(item, 'title')
                    )
                    link = find_text(item, 'link')
                    if not title or not link:
                        continue

                    # pubDate is RFC822 ("Mon, 13 Jul 2026 19:53:23 +0000").
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
                            date_str = 'Unknown'

                    # Excerpt from <description>; strip tags, cap 300 chars.
                    desc = find_text(item, 'description')
                    excerpt = re.sub(r'<[^>]+>', '', desc)
                    excerpt = SpaceflightNowParser._clean_html_entities(excerpt.strip())
                    if len(excerpt) > 300:
                        excerpt = excerpt[:300] + '...'

                    # First <category> as the raw category label.
                    cats = find_all_text(item, 'category')
                    category = cats[0] if cats else ''

                    # Full body from content:encoded (HTML); first <img> = hero.
                    encoded = find_text(item, 'encoded') or find_text(item, 'content')
                    body = SpaceflightNowParser._clean_body_html(encoded)
                    image = ''
                    if encoded:
                        img_match = re.search(r'<img[^>]+src="([^"]+)"', encoded, re.IGNORECASE)
                        if img_match:
                            image = img_match.group(1)

                    bucket = SpaceflightNowParser._classify(category, title + " " + excerpt)

                    articles.append({
                        'title': title,
                        'url': link,
                        'date': date_str,
                        'excerpt': excerpt,
                        'category': category,
                        'category_bucket': bucket,
                        'body': body,
                        'image': image,
                        'author': find_text(item, 'creator'),
                    })
                except Exception as e:
                    logger.warning(f"Failed to parse feed item: {e}")
                    continue

            return articles
        except Exception as e:
            logger.error(f"Spaceflightnow RSS feed parsing failed: {e}")
            return []

    @staticmethod
    def _classify(cat_raw: str, text: str) -> str:
        """Map a scraped category label + article text into one of four buckets
        used by the website news page: launches / missions / discoveries / tech.
        Default is 'missions' (the most common SpaceflightNow topic)."""
        hay = ((cat_raw or "") + " " + (text or "")).lower()
        if any(k in hay for k in (
            "launch", "falcon", "starship", "ariane", "electron", "neutron",
            "rocket", "heavy", "debut", "maiden", "atlas", "vulcan", "h3",
            "soyuz", "союз", "союз",
        )):
            return "launches"
        if any(k in hay for k in (
            "discover", "detected", "found", "evidence", "supernova", "exoplanet",
            "water vapor", "water vapour", "organic", "signal", "confirm",
            "black hole", "galaxy", "cosmic", "universe", "planet found",
        )):
            return "discoveries"
        if any(k in hay for k in (
            "test", "technology", "engine", "heat shield", "detector", "prototype",
            "nuclear", "patent", "design", "antenna", "solar sail", "material",
        )):
            return "tech"
        return "missions"

    @staticmethod
    def _parse_news_html(html: str) -> List[Dict]:
        """Extract news articles from HTML.

        Each article's date / excerpt / category are searched WITHIN the
        article's own HTML block (m.group(0)), not the whole document — the
        old code searched `html` and so every article ended up with the same
        first-match date/excerpt/category."""
        articles = []

        # Two candidate block patterns (MH Magazine theme). finditer so we
        # get the full match object and can re-search inside m.group(0).
        patterns = [
            re.compile(
                r'<article[^>]*class="[^"]*post[^"]*"[^>]*>.*?<h3[^>]*class="[^"]*entry-title[^"]*">'
                r'\s*<a\s+href="([^"]+)"[^>]*>([^<]+)</a>.*?</article>',
                re.DOTALL | re.IGNORECASE
            ),
            re.compile(
                r'<div[^>]*class="[^"]*mh-posts-large-item[^"]*"[^>]*>.*?<h3[^>]*>'
                r'\s*<a\s+href="([^"]+)"[^>]*>([^<]+)</a>.*?</div>',
                re.DOTALL | re.IGNORECASE
            ),
        ]

        matches = []
        for pat in patterns:
            matches = list(pat.finditer(html))
            if matches:
                break

        for i, m in enumerate(matches):
            try:
                url = m.group(1)
                title = SpaceflightNowParser._clean_html_entities(m.group(2).strip())
                block = m.group(0)

                # Extract date — within this article's block
                date_match = re.search(
                    r'<span[^>]*class="[^"]*mh-meta-date[^"]*"[^>]*>.*?<a[^>]*>([^<]+)</a>',
                    block, re.DOTALL | re.IGNORECASE
                )
                date_str = date_match.group(1).strip() if date_match else ''
                # Fallback: SpaceflightNow article URLs embed /YYYY/MM/DD/.
                if not date_str or date_str.lower() == 'unknown':
                    url_date = re.search(r'/(\d{4})/(\d{2})/(\d{2})/', url)
                    if url_date:
                        y, mo, da = url_date.group(1), url_date.group(2), url_date.group(3)
                        try:
                            dt = datetime(int(y), int(mo), int(da))
                            date_str = dt.strftime('%d.%m.%Y')
                        except ValueError:
                            date_str = f"{da}.{mo}.{y}"
                    else:
                        date_str = 'Unknown'

                # Extract excerpt/summary — within this article's block
                excerpt_match = re.search(
                    r'<div[^>]*class="[^"]*mh-excerpt[^"]*"[^>]*>(.*?)</div>',
                    block, re.DOTALL | re.IGNORECASE
                )
                if not excerpt_match:
                    excerpt_match = re.search(
                        r'<div[^>]*class="entry-summary"[^>]*>(.*?)</div>',
                        block, re.DOTALL | re.IGNORECASE
                    )

                excerpt = ''
                if excerpt_match:
                    excerpt = re.sub(r'<[^>]+>', '', excerpt_match.group(1))  # Remove HTML tags
                    excerpt = SpaceflightNowParser._clean_html_entities(excerpt.strip())
                    excerpt = excerpt[:300] + '...' if len(excerpt) > 300 else excerpt

                # Extract category — within this article's block
                category_match = re.search(
                    r'<span[^>]*class="[^"]*mh-meta-category[^"]*"[^>]*>(.*?)</span>',
                    block, re.DOTALL | re.IGNORECASE
                )
                category = ''
                if category_match:
                    category = re.sub(r'<[^>]+>', '', category_match.group(1)).strip()

                bucket = SpaceflightNowParser._classify(category, title + " " + excerpt)

                articles.append({
                    'title': title,
                    'url': url,
                    'date': date_str,
                    'excerpt': excerpt,
                    'category': category,
                    'category_bucket': bucket,
                })
            except Exception as e:
                logger.warning(f"Failed to parse article {i}: {e}")
                continue

        return articles

    @staticmethod
    def slug_from_url(url: str) -> str:
        """Derive a URL-safe slug from a SpaceflightNow article URL.

        Uses the last path segment (already lowercase + dash-separated, e.g.
        ``live-coverage-starlink-10-50-falcon-9-launch``). Falls back to
        ``article-<hash>`` for unusual URLs so the column always has a value.
        """
        if not url:
            return ""
        # Strip query/fragment, take the last non-empty path segment.
        path = url.split("?", 1)[0].split("#", 1)[0].rstrip("/")
        seg = path.rsplit("/", 1)[-1] if "/" in path else path
        seg = seg.strip().lower()
        # Keep only [a-z0-9-]; collapse runs of dashes.
        seg = re.sub(r"[^a-z0-9]+", "-", seg).strip("-")
        if not seg:
            # Last resort — stable hash of the URL so it's still unique.
            import hashlib
            seg = "article-" + hashlib.md5(url.encode("utf-8")).hexdigest()[:10]
        return seg[:200]

    @staticmethod
    def _extract_entry_content(html: str) -> str:
        """Return the inner HTML of the article's ``entry-content`` div.

        SpaceflightNow wraps the post body in ``<div class="entry-content">``
        inside an ``<article>``. The div contains nested divs/figures, so a
        naive ``(.*?)</div>`` stops at the first nested close-tag and a greedy
        fallback then swallows the whole rest of the page (related-articles
        section, sidebar, footer, speculation-rules JSON). Instead we bound the
        content to the first reliable *post-body* terminator: ``</article>``,
        the entry-meta ``<footer>``, the related-content section, the sidebar
        ``<aside>``, or the comments block. The first ``<img>`` inside this
        slice is the hero image.
        """
        # The real element — match class="...entry-content..." on a <div>.
        # (Word boundary so we don't match the CSS rule ``.entry-content a``
        # inside the page's <style> block, which is a false positive.)
        open_match = re.search(
            r'<div[^>]*class="[^"]*\bentry-content\b[^"]*"[^>]*>',
            html, re.IGNORECASE
        )
        if not open_match:
            return ""
        rest = html[open_match.end():]
        # Earliest terminator = end of the article body. Order matters: scan
        # for the first occurrence of any marker and cut at the minimum.
        markers = (
            "</article>",
            "<footer",
            'class="mh-related-content',
            'mh-related-content',
            '<aside',
            'id="comments"',
            'class="mh-comments-wrap',
            'class="mh-sidebar',
            'id="respond"',
        )
        cut = len(rest)
        for mk in markers:
            p = rest.find(mk)
            if -1 < p < cut:
                cut = p
        rest = rest[:cut]
        # Drop the article's own tag list (``entry-tags``) and entry footer —
        # these are WordPress metadata, not body prose, and they render as a
        # garbled concatenated string ("B1085Falcon 9SiriusXM…") once tags are
        # stripped. We derive our own topic tags on the article page instead.
        rest = re.sub(
            r'<div[^>]*class="[^"]*\bentry-tags\b[^"]*"[^>]*>.*?</div>',
            '', rest, flags=re.DOTALL | re.IGNORECASE
        )
        rest = re.sub(
            r'<footer[^>]*class="[^"]*\bentry-(?:meta|footer)\b[^"]*"[^>]*>.*?</footer>',
            '', rest, flags=re.DOTALL | re.IGNORECASE
        )
        return rest

    @staticmethod
    def get_article_image(url: str) -> str:
        """Fetch just the article's hero image (first <img> in entry-content).

        Lighter than ``get_article_content`` (no body extraction/processing)
        — used at ingest time so the news list can show preview thumbnails
        without waiting for someone to open the article. Best-effort: any
        failure returns "" (the card then shows a gradient placeholder).
        """
        try:
            headers = {'User-Agent': 'Mozilla/5.0 (compatible; NEOwatchBot/1.0)'}
            response = requests.get(url, headers=headers, timeout=12)
            if response.status_code != 200:
                return ""
            content = SpaceflightNowParser._extract_entry_content(response.text)
            if not content:
                return ""
            img_match = re.search(r'<img[^>]+src="([^"]+)"', content, re.IGNORECASE)
            return img_match.group(1) if img_match else ""
        except Exception as e:
            logger.warning(f"Article image fetch failed for {url}: {e}")
            return ""

    @staticmethod
    def get_article_content(url: str) -> Dict:
        """Fetch a single article page and extract its main body text + hero
        image. Best-effort, regex-only (consistent with the rest of this
        module — no BeautifulSoup dependency). Returns {"body": str, "image":
        str}; both empty on any failure (the news article page then falls back
        to the excerpt + a source link)."""
        try:
            headers = {'User-Agent': 'Mozilla/5.0 (compatible; NEOwatchBot/1.0)'}
            response = requests.get(url, headers=headers, timeout=15)
            if response.status_code != 200:
                raise Exception(f"HTTP {response.status_code}")
            content = SpaceflightNowParser._extract_entry_content(response.text)

            # First image inside the content = hero image.
            img = ''
            if content:
                img_match = re.search(
                    r'<img[^>]+src="([^"]+)"', content, re.IGNORECASE
                )
                if img_match:
                    img = img_match.group(1)

            # Strip tags / clean via the shared helper used by the feed parser.
            return {"body": SpaceflightNowParser._clean_body_html(content), "image": img}
        except Exception as e:
            logger.warning(f"Article content parse failed for {url}: {e}")
            return {"body": "", "image": ""}

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
