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

2. CMS/theme filler baked into the article's own HTML container (NASA's
   Gravatar byline + "related topics" cards in ``content:encoded``,
   universetoday.com's byline avatar + Patreon CTA thumbnail, and a
   duplicated hero image when a featured-image <figure> sits inside
   <article> unwrapped by a <p>) — no page-chrome boundary to scope around,
   they just look like more inline photos.

Unlike the first version of this script, this one does NOT reset `image`
to NULL and wait for a visitor: the news-list page reads `image` straight
from the DB for its preview cards, so blanking it was itself a regression
(cards went from "wrong photo" to "no photo" for every row until someone
happened to open that exact article). Instead it re-fetches each candidate
right here and writes the corrected body/image/inline media immediately —
same one step, no visible gap. `--limit` paces it since each row is a live
HTTP fetch.

Some junk (e.g. nasa.gov falling back to a generic NASA-insignia image as an
author's byline photo when they have no headshot uploaded) is only
recognizable from the ``class="avatar"`` attribute on the live ``<img>`` tag
— once mirrored down to a bare URL in the DB it's indistinguishable from a
real photo, so the SQL candidate search below can't find it by pattern.
Every NASA article is re-fetched unconditionally for that reason (still
capped/paced by ``--limit``); everything else only gets fixed if it matches
a known junk signal. Use ``--slug`` to force-refresh one specific article
regardless of the heuristics, e.g. right after spotting a bad photo on it.

Usage:
  python3 backfill_news_bad_page_scrape.py               # report + apply
  python3 backfill_news_bad_page_scrape.py --dry-run      # report counts only
  python3 backfill_news_bad_page_scrape.py --limit 50     # cap rows fetched this run
  python3 backfill_news_bad_page_scrape.py --slug some-article-slug
"""
import argparse
import logging
import shutil
import time
from pathlib import Path

import config  # noqa: F401 — side effect: load_dotenv()
from database import (
    get_db_connection, set_news_article_body, set_news_article_images, set_news_article_videos,
)
from parsers.news import NewsParser

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("backfill_news_bad_page_scrape")

DATA_NEWS_DIR = Path("data/news")
IMAGE_CAP = 8  # matches parsers.news._MAX_BODY_IMAGES
FETCH_DELAY = 1.0  # seconds between live HTTP fetches — polite to source sites


def _find_candidates(cursor, slug=None):
    if slug:
        cursor.execute(
            "SELECT id, slug, url, image FROM news_articles WHERE slug = %s", (slug,)
        )
        return cursor.fetchall()
    cursor.execute(
        """
        SELECT DISTINCT a.id, a.slug, a.url, a.image
        FROM news_articles a
        LEFT JOIN news_article_images i ON i.article_id = a.id
        WHERE a.source = 'NASA'
           OR a.image IS NULL
           OR a.image = ''
           OR a.image LIKE '%.svg'
           OR i.source_url LIKE '%.svg%'
           OR i.source_url LIKE '%gravatar.com%'
           OR i.source_url LIKE '%/wp-content/plugins/%'
           OR i.source_url LIKE '%/wp-content/themes/%'
           OR i.source_url LIKE '%avatar%'
           OR i.source_url LIKE '%patreon%'
           OR i.source_url = a.image
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
    parser.add_argument("--limit", type=int, default=None, help="max rows to actually re-fetch this run")
    parser.add_argument("--slug", type=str, default=None, help="force-refresh one article by slug, ignoring the heuristics")
    args = parser.parse_args()

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        rows = _find_candidates(cursor, args.slug)
    finally:
        cursor.close()
        conn.close()

    if args.slug and not rows:
        logger.warning(f"no article with slug={args.slug!r}")
        return

    logger.info(f"found {len(rows)} candidate row(s) with a bad page scrape")
    for row in rows:
        logger.info(f"  id={row['id']} slug={row['slug']} image={row['image']!r}")

    if args.dry_run or not rows:
        return

    if args.limit:
        rows = rows[:args.limit]

    fixed = failed = 0
    for row in rows:
        try:
            content = NewsParser.get_article_content(row["url"])
        except Exception as e:
            logger.warning(f"fetch failed for id={row['id']} url={row['url']}: {e}")
            failed += 1
            time.sleep(FETCH_DELAY)
            continue

        new_body = (content.get("body") or "").strip()
        new_image = (content.get("image") or "").strip() or None
        if not new_body:
            logger.warning(f"id={row['id']} slug={row['slug']}: re-fetch returned no body, skipping")
            failed += 1
            time.sleep(FETCH_DELAY)
            continue

        # Wipe the old (possibly bloated/wrong) mirrored images before
        # re-mirroring under the same position numbers, so a stale on-disk
        # file can't get served under a position that now means something
        # else.
        slug_dir = DATA_NEWS_DIR / (row["slug"] or "")
        if row["slug"] and slug_dir.is_dir():
            shutil.rmtree(slug_dir, ignore_errors=True)

        conn = get_db_connection()
        cursor = conn.cursor()
        try:
            cursor.execute("DELETE FROM news_article_images WHERE article_id = %s", (row["id"],))
            cursor.execute("DELETE FROM news_article_videos WHERE article_id = %s", (row["id"],))
            conn.commit()
        finally:
            cursor.close()
            conn.close()

        # body_uk left NULL on purpose: the site's lazy translate path
        # (web/data.py) regenerates it on the next page view.
        set_news_article_body(row["id"], new_body, None, new_image)
        if content.get("body_images"):
            set_news_article_images(row["id"], row["slug"], content["body_images"])
        if content.get("body_videos"):
            set_news_article_videos(row["id"], content["body_videos"])
        fixed += 1
        logger.info(f"id={row['id']} slug={row['slug']}: refreshed "
                    f"(image={'yes' if new_image else 'no'}, "
                    f"{len(content.get('body_images') or [])} photo(s), "
                    f"{len(content.get('body_videos') or [])} video(s))")
        time.sleep(FETCH_DELAY)

    logger.info(f"done: {fixed} row(s) refreshed, {failed} fetch failure(s)")


if __name__ == "__main__":
    main()
