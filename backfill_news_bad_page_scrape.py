#!/usr/bin/env python3
"""One-off backfill for articles poisoned by junk-image bugs fixed in
``parsers/news.py`` (see ``_is_junk_image`` / ``_MAX_BODY_IMAGES``):

1. Page-scrape flood (``get_article_content``, the live-page fetch used for
   excerpt-only sources — ESA and Universe Today have no ``content:encoded``
   in their RSS, so every one of their stored bodies came from this path).
   Sites whose site-chrome wasn't wrapped in a real ``<header>``/``<nav>``
   tag (esa.int uses a plain ``<section id="esa-header">``) leaked into the
   scrape: the hero `image` could end up being a nav-bar icon
   (``ESA_Menu.svg``) instead of a real photo, and `news_article_images`
   could balloon to 40+ rows — an entire "Related Links" widget and/or full
   photo gallery harvested as if it were inline article content, no cap.

2. CMS filler baked into the RSS content itself (``_clean_body_html``, the
   ``content:encoded`` path — this is how NASA/science.nasa.gov bodies are
   built). Their WordPress/Gutenberg post body embeds the author's Gravatar
   byline photo and generic "related topics" card thumbnails as plain
   ``<img>`` tags in the very same HTML as the real prose — no page-chrome
   boundary to scope around, they just look like more inline photos.

This script finds rows exhibiting any of these symptoms (svg "photo",
gravatar/plugin/theme filler, or an inline image count blown past the new
cap of 8) and resets `body`/`body_uk`/`image` to NULL plus wipes the stale
`news_article_images`/`news_article_videos` rows (and their mirrored files
on disk) — so the site's existing lazy full-content fetch (`web/data.py`)
regenerates everything on the next page view, this time through the fixed,
capped, filtered parser.

Usage:
  python3 backfill_news_bad_page_scrape.py             # report + apply
  python3 backfill_news_bad_page_scrape.py --dry-run   # report counts only
"""
import argparse
import logging
import shutil
from pathlib import Path

import config  # noqa: F401 — side effect: load_dotenv()
from database import get_db_connection

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("backfill_news_bad_page_scrape")

DATA_NEWS_DIR = Path("data/news")
IMAGE_CAP = 8  # matches parsers.news._MAX_BODY_IMAGES


def _find_candidates(cursor):
    cursor.execute(
        """
        SELECT DISTINCT a.id, a.slug, a.url, a.image
        FROM news_articles a
        LEFT JOIN news_article_images i ON i.article_id = a.id
        WHERE a.image LIKE '%.svg'
           OR i.source_url LIKE '%.svg%'
           OR i.source_url LIKE '%gravatar.com%'
           OR i.source_url LIKE '%/wp-content/plugins/%'
           OR i.source_url LIKE '%/wp-content/themes/%'
           OR a.id IN (
                SELECT article_id FROM news_article_images
                GROUP BY article_id
                HAVING COUNT(*) > %s
           )
        """,
        (IMAGE_CAP,),
    )
    return cursor.fetchall()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="only report counts, write nothing")
    args = parser.parse_args()

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        rows = _find_candidates(cursor)
    finally:
        cursor.close()
        conn.close()

    logger.info(f"found {len(rows)} candidate row(s) with a bad page scrape")
    for row in rows:
        logger.info(f"  id={row['id']} slug={row['slug']} image={row['image']!r}")

    if args.dry_run or not rows:
        return

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        for row in rows:
            article_id = row["id"]
            cursor.execute("DELETE FROM news_article_images WHERE article_id = %s", (article_id,))
            cursor.execute("DELETE FROM news_article_videos WHERE article_id = %s", (article_id,))
            cursor.execute(
                "UPDATE news_articles SET body = NULL, body_uk = NULL, image = NULL WHERE id = %s",
                (article_id,),
            )
            slug_dir = DATA_NEWS_DIR / (row["slug"] or "")
            if row["slug"] and slug_dir.is_dir():
                shutil.rmtree(slug_dir, ignore_errors=True)
        conn.commit()
        logger.info(f"reset {len(rows)} row(s) — bodies/images will regenerate on next page view")
    finally:
        cursor.close()
        conn.close()


if __name__ == "__main__":
    main()
