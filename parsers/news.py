"""Generic news aggregator and parser for space news RSS feeds"""
import requests
import re
import logging
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from typing import List, Dict, Optional
from urllib.parse import urljoin, urlparse
from utils.i18n import t, DEFAULT_LANG

logger = logging.getLogger(__name__)

_IMG_PLACEHOLDER_RE = re.compile(r'^\[IMG:\d+\]$')
_VIDEO_PLACEHOLDER_RE = re.compile(r'^\[VIDEO:\d+\]$')
_MEDIA_TAIL_RE = re.compile(r'\[(?:IMG|VIDEO):\d*$')
# Safety valve against photo-gallery/"related articles" widgets that a page
# scrape can sweep in alongside the real prose (seen on esa.int: an 11-card
# related-links strip and a 20+ photo eclipse gallery, both harvested as if
# they were inline article images before this cap existed).
_MAX_BODY_IMAGES = 8
_MAX_BODY_VIDEOS = 4


_AVATAR_CLASS_RE = re.compile(r'class="[^"]*\bavatar\b[^"]*"', re.IGNORECASE)


def _is_junk_image(src: str, tag_html: str = '') -> bool:
    """True for images that are never real article content:
    - vector icons/logos (menu toggles, arrows, play buttons). Site chrome
      that isn't wrapped in a real ``<header>``/``<nav>`` tag (e.g.
      esa.int's nav lives in a plain ``<section id="esa-header">``)
      otherwise slips through as the "hero image" or an inline body photo.
    - the author's byline avatar and generic "related topics"/promo card
      thumbnails — some sites (NASA/science.nasa.gov's Gravatar + "related
      topics" cards, universetoday.com's own byline avatar + Patreon CTA
      thumbnail) embed these directly inside the article's own HTML
      container (WordPress/Gutenberg post body, or an <article> that also
      wraps the byline/CTA widgets) — there's no clean HTML boundary to
      scope around like there is for page-wide chrome, so they have to be
      recognized by what they are. Some byline photos have no "avatar" in
      the filename at all (nasa.gov falls back to a generic NASA-insignia
      image when an author has no headshot uploaded) — those are only
      recognizable via the standard WordPress ``class="avatar"`` marker on
      the ``<img>`` tag itself, hence the optional ``tag_html`` param.
    - project/mission logos in a "Learn More and Get Involved" style CTA
      block (e.g. science.nasa.gov's ``wp-block-nasa-blocks-featured-link-
      list``) — same story as above, baked straight into ``content:encoded``
      alongside the real prose. These reliably have "logo" in the filename."""
    if tag_html and _AVATAR_CLASS_RE.search(tag_html):
        return True
    try:
        parsed = urlparse(src)
    except Exception:
        return False
    if parsed.path.lower().endswith('.svg'):
        return True
    host = parsed.netloc.lower()
    if 'gravatar.com' in host:
        return True
    path = parsed.path.lower()
    if '/wp-content/plugins/' in path or '/wp-content/themes/' in path:
        return True
    # NASA "explore more"/topic-card related-content widgets (e.g.
    # .../ui/explore-more-cards/explore-card_the-sun.png) — same story as
    # the featured-link-list logo above, just a different card block.
    if 'explore-more' in path or 'topic-card' in path:
        return True
    filename = path.rsplit('/', 1)[-1]
    return 'avatar' in filename or 'logo' in filename or 'patreon' in path


# An inline content photo, optionally wrapped in an <a href="..."> link to
# its full-size version (universetoday.com does this for every figure) — the
# wrapper is consumed too so it doesn't end up as a dangling empty link.
_INLINE_IMG_RE = re.compile(
    r'(?:<a[^>]*>\s*)?<img[^>]+src="([^"]+)"[^>]*>(?:\s*</a>)?',
    re.IGNORECASE | re.DOTALL
)
# Opening <div> of a NASA/science.nasa.gov Gutenberg "related topics"/CTA
# block (see NewsParser._strip_nasa_promo_blocks for why these can't be
# recognized by image filename alone).
_NASA_PROMO_BLOCK_RE = re.compile(
    r'<div[^>]*class="[^"]*\bwp-block-nasa-blocks-(?:topic-cards?|featured-link-list)\b[^"]*"[^>]*>',
    re.IGNORECASE
)
# Embedded video players (YouTube/Vimeo <iframe>) found inline in article
# HTML, optionally wrapped in a Jetpack/WordPress "embed-container" <div>.
# Other iframes (ads, tweets, forms, ...) are intentionally left alone.
_VIDEO_IFRAME_RE = re.compile(
    r'(?:<div[^>]*>\s*)?'
    r'<iframe[^>]+src="([^"]*(?:youtube(?:-nocookie)?\.com/embed|player\.vimeo\.com/video)[^"]*)"[^>]*>'
    r'\s*(?:</iframe>)?'
    r'(?:\s*</div>)?',
    re.IGNORECASE | re.DOTALL
)
# Self-hosted HTML5 <video><source src="....mp4"> players (NASA/
# science.nasa.gov's own video blocks — not a YouTube/Vimeo embed at all).
# Matched through to the real </video> close so the "enable JavaScript to
# view this video" vjs-no-js fallback text inside it doesn't leak into the
# body as if it were a real paragraph.
_VIDEO_TAG_RE = re.compile(
    r'<video[^>]*>.*?<source[^>]+src="([^"]+\.(?:mp4|webm|ogv|ogg))"[^>]*>.*?</video>',
    re.IGNORECASE | re.DOTALL
)


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
            # universetoday.com/feed/ now 301-redirects here; requests()
            # follows it transparently either way, but point at the
            # canonical URL directly to save the extra round trip.
            "source": "Universe Today",
            "url": "https://www.universetoday.com/rss.xml",
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
                        # ESA's feed mixes real articles with photo/video
                        # showcase pages that have no real prose at all —
                        # "Week in images" is a weekly digest of images with
                        # captions, ESA_Multimedia/Images|Videos are a single
                        # photo or clip. Ingesting these produces a "news
                        # article" page that's just an image wall with no
                        # translatable text, however good the scraper gets.
                        if any(p in link for p in
                               ('/About_Us/Week_in_images/', '/ESA_Multimedia/Images/', '/ESA_Multimedia/Videos/')):
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

                        # Body and Image. No `content:encoded` (ESA, SpaceNews,
                        # Universe Today) -> leave body empty rather than the
                        # excerpt, so the site's lazy full-text fetch (which
                        # only fires when body is falsy) can still pull the
                        # real article on first view instead of being blocked
                        # forever by a non-empty excerpt-as-body placeholder.
                        encoded = find_text(item, 'encoded') or find_text(item, 'content')
                        if encoded:
                            body, body_images, body_videos = NewsParser._clean_body_html(encoded, link)
                        else:
                            body, body_images, body_videos = '', [], []

                        def _first_real_image(html_src, base):
                            for img_match in re.finditer(r'<img[^>]+src="([^"]+)"[^>]*>', html_src, re.IGNORECASE):
                                candidate = urljoin(base, img_match.group(1))
                                if not _is_junk_image(candidate, img_match.group(0)):
                                    return candidate
                            return ''

                        image = _first_real_image(encoded, link) if encoded else ''
                        # Fallback for hero image search if empty
                        if not image and desc:
                            image = _first_real_image(desc, link)

                        bucket = NewsParser._classify(raw_category, title + " " + excerpt)

                        # Parse date object for sorting. Always normalize to
                        # tz-aware UTC: parsedate_to_datetime() returns naive
                        # datetimes when the RSS pubDate has no offset, and
                        # mixing naive/aware values in the sort() below raises
                        # TypeError, which would silently zero out the whole
                        # merged article list for every feed in this poll.
                        parsed_dt = None
                        if pub:
                            try:
                                parsed_dt = parsedate_to_datetime(pub)
                                if parsed_dt.tzinfo is None:
                                    parsed_dt = parsed_dt.replace(tzinfo=timezone.utc)
                            except Exception:
                                pass
                        if not parsed_dt:
                            parsed_dt = datetime.now(timezone.utc)

                        all_articles.append({
                            'title': title,
                            'url': link,
                            'date': date_str,
                            'excerpt': excerpt,
                            'category': raw_category,
                            'category_bucket': bucket,
                            'body': body,
                            'body_images': body_images,
                            'body_videos': body_videos,
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
                        content_html = NewsParser._extract_balanced_div(html[open_match.end():])
            elif "spacenews.com" in url:
                open_match = re.search(r'<div[^>]*class="[^"]*\b(?:post-content|entry-content)\b[^"]*"[^>]*>', html, re.IGNORECASE)
                if open_match:
                    content_html = NewsParser._extract_balanced_div(html[open_match.end():])
            
            # Fallback if no specific section is found
            if not content_html:
                # Prefer a semantic <article> container when the page has
                # one: site chrome isn't always wrapped in a real <header>/
                # <nav> tag (esa.int's top nav is a plain <section
                # id="esa-header">, invisible to the strip below), and
                # "related articles" widgets normally sit as siblings right
                # after </article> — a whole-<body> scrape sweeps both in
                # as if they were part of the story.
                article_match = re.search(r'<article[^>]*>.*?</article>', html, re.DOTALL | re.IGNORECASE)
                if article_match:
                    content_html = article_match.group(0)
                else:
                    # Strip menus, sidebars, headers, footers
                    clean_html = re.sub(r'<(header|footer|aside|nav|noscript|script|style)[^>]*>.*?</\1>', '', html, flags=re.DOTALL | re.IGNORECASE)
                    # Find the main container or use the cleaned body
                    body_match = re.search(r'<body[^>]*>(.*?)</body>', clean_html, re.DOTALL | re.IGNORECASE)
                    content_html = body_match.group(1) if body_match else clean_html

            if content_html:
                content_html = NewsParser._strip_nasa_promo_blocks(content_html)

            # Extract first (non-icon) image inside content_html
            if content_html:
                for img_match in re.finditer(r'<img[^>]+src="([^"]+)"[^>]*>', content_html, re.IGNORECASE):
                    candidate = urljoin(url, img_match.group(1))
                    if not _is_junk_image(candidate, img_match.group(0)):
                        img = candidate
                        break

            # Pull inline images and embedded videos out before the
            # paragraph pass below: both are often nested *inside* a
            # <p>...</p> (universetoday.com wraps every figure in <p><a
            # href="..."><img ...></a></p>; a video iframe is often preceded
            # by a Jetpack embed-container in the same paragraph as its
            # caption), so a naive "<p>...</p> or standalone <img>" regex
            # would let the <p> branch win first and swallow the media
            # whole, stripping the src along with it — the paragraph then
            # has nothing left but attributes, fails the length filter, and
            # both the image/video *and* the sentence around it vanish
            # silently. Splitting the surrounding paragraph around each
            # placeholder — even where there was no real enclosing <p> —
            # keeps it isolated on its own line instead.
            body_images = []

            def _capture_inline_img(m):
                candidate = urljoin(url, m.group(1))
                # Skip a repeat of the hero image: sites that put the
                # featured-image <figure> inside <article> (not wrapped in a
                # <p>) otherwise get it twice — once as the hero, once again
                # as the first inline photo.
                if candidate == img or _is_junk_image(candidate, m.group(0)) or len(body_images) >= _MAX_BODY_IMAGES:
                    return ''
                body_images.append(candidate)
                return f'</p><p>[IMG:{len(body_images) - 1}]</p><p>'

            body_videos = []

            def _capture_video(m):
                if len(body_videos) >= _MAX_BODY_VIDEOS:
                    return ''
                body_videos.append(urljoin(url, m.group(1)))
                return f'</p><p>[VIDEO:{len(body_videos) - 1}]</p><p>'

            if content_html:
                content_html = _INLINE_IMG_RE.sub(_capture_inline_img, content_html)
                content_html = _VIDEO_IFRAME_RE.sub(_capture_video, content_html)
                content_html = _VIDEO_TAG_RE.sub(_capture_video, content_html)

            # Extract paragraphs, in document order, so the [IMG:n]/
            # [VIDEO:n] placeholders land at their real position in the body.
            paragraphs = []
            if content_html:
                for m in re.finditer(r'<p[^>]*>(.*?)</p>', content_html, re.DOTALL | re.IGNORECASE):
                    p_text = re.sub(r'<[^>]+>', '', m.group(1))  # Strip nested tags
                    p_text = NewsParser._clean_html_entities(p_text.strip())
                    if _IMG_PLACEHOLDER_RE.match(p_text) or _VIDEO_PLACEHOLDER_RE.match(p_text) or (
                        len(p_text) > 30 and not any(
                            k in p_text.lower() for k in
                            ("follow us on", "read more:", "copyright ©", "you have already liked this page")
                        )
                    ):
                        paragraphs.append(p_text)

            body_text = "\n\n".join(paragraphs)
            if len(body_text) > 6000:
                body_text = _MEDIA_TAIL_RE.sub('', body_text[:6000]) + "..."

            return {"body": body_text, "image": img, "body_images": body_images, "body_videos": body_videos}
        except Exception as e:
            logger.warning(f"Generic content parse failed for {url}: {e}")
            return {"body": "", "image": "", "body_images": [], "body_videos": []}

    @staticmethod
    def _extract_balanced_div(html: str) -> str:
        """Given HTML starting right after an opening ``<div ...>``, return
        everything up to (not including) that div's own matching
        ``</div>`` — correctly handling nested ``<div>`` tags.

        A naive ``html.split('</div>', 1)[0]`` cuts off at the *first*
        nested div's close tag instead of the real end of the container
        (near-guaranteed on real article pages: image wrappers, embeds and
        ad slots are all nested divs), silently truncating the article body
        far short of its actual end."""
        depth = 0
        for m in re.finditer(r'<div\b|</div>', html, re.IGNORECASE):
            if m.group(0)[1] == '/':
                if depth == 0:
                    return html[:m.start()]
                depth -= 1
            else:
                depth += 1
        return html

    @staticmethod
    def _skip_balanced_div(html: str) -> int:
        """Sibling of ``_extract_balanced_div``: given HTML starting right
        after an opening ``<div ...>``, return the index just past that
        div's own matching ``</div>`` (``len(html)`` if unterminated), for
        callers that need to skip over a block rather than read its content."""
        depth = 0
        for m in re.finditer(r'<div\b|</div>', html, re.IGNORECASE):
            if m.group(0)[1] == '/':
                if depth == 0:
                    return m.end()
                depth -= 1
            else:
                depth += 1
        return len(html)

    @staticmethod
    def _strip_nasa_promo_blocks(html: str) -> str:
        """Remove NASA/science.nasa.gov Gutenberg "related topics"/CTA
        widgets ("Keep Exploring" topic-card grids, "Learn More and Get
        Involved" featured-link lists) wherever they appear in the HTML.

        These embed real, normally-named project photos as card thumbnails
        (unlike the byline avatar/logo filler ``_is_junk_image`` already
        catches by filename) directly inside the same container as the real
        prose — with no naming clue, the only reliable signal is the
        block's own wrapper class. Each match is skipped to its *real*
        matching ``</div>`` (nested divs are the norm for a card grid), not
        the first nested one."""
        if 'wp-block-nasa-blocks-' not in html:
            return html
        out = []
        pos = 0
        for m in _NASA_PROMO_BLOCK_RE.finditer(html):
            if m.start() < pos:
                continue  # inside a block already skipped
            out.append(html[pos:m.start()])
            pos = m.end() + NewsParser._skip_balanced_div(html[m.end():])
        out.append(html[pos:])
        return ''.join(out)

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
    def _clean_body_html(html: str, base_url: str = "") -> tuple:
        """Strip tag list, footer, convert blocks to breaks, extract inline
        ``<img>`` tags as ``[IMG:n]`` placeholders and embedded YouTube/Vimeo
        ``<iframe>`` players as ``[VIDEO:n]`` placeholders, both kept at
        their original position in the text, strip remaining tags, cap at
        6000 chars. Returns ``(body_text, image_urls, video_urls)`` where
        ``image_urls[n]``/``video_urls[n]`` are the URLs behind placeholders
        ``[IMG:n]``/``[VIDEO:n]`` (images mirrored to local disk + inserted
        into ``news_article_images`` by ``database.ingest_news_articles``;
        videos stay as external embed URLs — no point mirroring a YouTube
        player). ``base_url`` (the article's own URL) resolves root/relative
        ``src`` values some feeds embed (e.g. ``/article_images/foo.webp``)
        into absolute URLs — otherwise the frontend requests them against
        our own site's origin and gets a 404."""
        if not html:
            return "", [], []
        # Drop entry tags / metadata
        html = re.sub(r'<div[^>]*class="[^"]*\bentry-tags\b[^"]*"[^>]*>.*?</div>', '', html, flags=re.DOTALL | re.IGNORECASE)
        html = re.sub(r'<footer[^>]*class="[^"]*\bentry-(?:meta|footer)\b[^"]*"[^>]*>.*?</footer>', '', html, flags=re.DOTALL | re.IGNORECASE)
        html = NewsParser._strip_nasa_promo_blocks(html)

        # Pull out <img> tags before the generic tag-strip below, replacing
        # each with a positional placeholder so the frontend can splice a
        # real <img> back in at the right spot in the rendered body.
        image_urls = []

        def _capture_img(m):
            candidate = urljoin(base_url, m.group(1)) if base_url else m.group(1)
            if _is_junk_image(candidate, m.group(0)) or len(image_urls) >= _MAX_BODY_IMAGES:
                return ''
            image_urls.append(candidate)
            return f'\n[IMG:{len(image_urls) - 1}]\n'

        html = re.sub(r'<img[^>]+src="([^"]+)"[^>]*>', _capture_img, html, flags=re.IGNORECASE)

        # Same idea for embedded video players.
        video_urls = []

        def _capture_video(m):
            if len(video_urls) >= _MAX_BODY_VIDEOS:
                return ''
            video_urls.append(urljoin(base_url, m.group(1)) if base_url else m.group(1))
            return f'\n[VIDEO:{len(video_urls) - 1}]\n'

        html = _VIDEO_IFRAME_RE.sub(_capture_video, html)
        html = _VIDEO_TAG_RE.sub(_capture_video, html)

        # Convert tags to paragraph breaks
        body = re.sub(r'<(p|br|/p|/div|/h[1-6])[^>]*>', '\n', html, flags=re.IGNORECASE)
        body = re.sub(r'<[^>]+>', '', body)

        # Clean entities
        body = NewsParser._clean_html_entities(body)

        # Normalize whitespace and limit length (always keep [IMG:n]/
        # [VIDEO:n] lines, regardless of the >30-char prose filter).
        paragraphs = [
            p.strip() for p in body.split('\n')
            if len(p.strip()) > 30 or _IMG_PLACEHOLDER_RE.match(p.strip()) or _VIDEO_PLACEHOLDER_RE.match(p.strip())
        ]
        body = "\n\n".join(paragraphs)

        if len(body) > 6000:
            # Don't cut mid-placeholder — drop a dangling "[IMG:"/"[VIDEO:" tail.
            body = _MEDIA_TAIL_RE.sub('', body[:6000]) + "..."
        return body, image_urls, video_urls

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
