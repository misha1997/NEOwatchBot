#!/usr/bin/env python3
"""One-off backfill for old news articles missing a hero/preview image
and/or inline body photos.

Two independent gaps in the news pipeline left some archived rows without
images, and neither self-heals on its own:

1. `image` (used as both the article-page hero and the news-list card
   "preview") comes straight from the RSS feed item at ingest time
   (`database.ingest_news_articles`) with no fallback. The site's lazy
   full-content fetch (`web/data.py: _news_article_raw`) only fires when
   `body` is *empty* — so a row that already had a usable RSS body
   permanently keeps `image = NULL` if that RSS item simply had no image,
   since it never gets a chance to pull one from the live article page.

2. The RSS `content:encoded` body can likewise have no inline `<img>` tags
   at all, so `news_article_images` stays empty for that article — even
   though the live article page usually has photos in it.

Both are fixed the same way the site already does lazily for body-less rows
(`parsers.news.NewsParser.get_article_content`): this script just runs that
fetch explicitly for rows that will never trigger it on their own, without
touching rows that already have a working hero image and inline photos.

Usage:
  python3 backfill_news_missing_images.py             # report + apply
  python3 backfill_news_missing_images.py --dry-run    # report counts only
  python3 backfill_news_missing_images.py --limit 50   # cap rows fetched this run
"""
import argparse
import logging
import time

import config  # noqa: F401 — side effect: load_dotenv()
from database import (
    get_db_connection, set_news_article_body, set_news_article_images, set_news_article_videos,
)
from parsers.news import NewsParser

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("backfill_news_missing_images")

FETCH_DELAY = 1.0  # seconds between live HTTP fetches — polite to source sites


def _find_candidates(cursor):
    cursor.execute(
        """
        SELECT a.id, a.slug, a.url, a.image,
               COALESCE(i.cnt, 0) AS image_rows
        FROM news_articles a
        LEFT JOIN (
            SELECT article_id, COUNT(*) AS cnt FROM news_article_images GROUP BY article_id
        ) i ON i.article_id = a.id
        WHERE (a.image IS NULL OR a.image = '')
           OR COALESCE(i.cnt, 0) = 0
        ORDER BY a.id
        """
    )
    return cursor.fetchall()


def _set_image_only(article_id: int, image: str) -> None:
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "UPDATE news_articles SET image = %s WHERE id = %s AND (image IS NULL OR image = '')",
            (image, article_id),
        )
        conn.commit()
    finally:
        cursor.close()
        conn.close()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="only report counts, write nothing")
    parser.add_argument("--limit", type=int, default=None, help="max rows to actually re-fetch this run")
    args = parser.parse_args()

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        rows = _find_candidates(cursor)
    finally:
        cursor.close()
        conn.close()

    missing_image = sum(1 for r in rows if not r["image"])
    missing_photos = sum(1 for r in rows if r["image_rows"] == 0)
    logger.info(f"found {len(rows)} candidate row(s): {missing_image} missing hero image, "
                f"{missing_photos} missing inline photos")

    if args.dry_run:
        return

    if args.limit:
        rows = rows[:args.limit]

    fixed_body = fixed_image = failed = 0
    for row in rows:
        try:
            content = NewsParser.get_article_content(row["url"])
        except Exception as e:
            logger.warning(f"fetch failed for id={row['id']} url={row['url']}: {e}")
            failed += 1
            time.sleep(FETCH_DELAY)
            continue

        new_image = (content.get("image") or "").strip() or None
        new_body = (content.get("body") or "").strip()
        new_body_images = content.get("body_images") or []

        if row["image_rows"] == 0 and new_body and new_body_images:
            # body_uk left NULL on purpose: the site's lazy translate path
            # (web/data.py) regenerates it on the next page view, using the
            # [IMG:n]/[VIDEO:n]-preserving translator.
            set_news_article_body(row["id"], new_body, None, new_image)
            set_news_article_images(row["id"], row["slug"], new_body_images)
            if content.get("body_videos"):
                set_news_article_videos(row["id"], content["body_videos"])
            fixed_body += 1
            logger.info(f"id={row['id']} slug={row['slug']}: replaced body "
                        f"({len(new_body_images)} inline photo(s))")
        elif new_image and not row["image"]:
            _set_image_only(row["id"], new_image)
            fixed_image += 1
            logger.info(f"id={row['id']} slug={row['slug']}: filled hero image")

        time.sleep(FETCH_DELAY)

    logger.info(f"done: {fixed_body} row(s) got a re-fetched body+photos, "
                f"{fixed_image} row(s) got just the hero image, {failed} fetch failure(s)")


if __name__ == "__main__":
    main()
