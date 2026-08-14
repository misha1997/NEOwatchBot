#!/usr/bin/env python3
"""One-off cleanup for ESA "article" rows that are actually photo/video
showcase pages, not text articles: no real prose to speak of, so the site's
article template renders them as a wall of images with little/no translated
text no matter how good the scraper gets. `parsers/news.py: get_news()` now
skips these at ingest (see the URL-pattern check next to `link`), but rows
ingested before that fix are still sitting in the DB.

Matches by URL path, same patterns as the ingest-time skip:
  - /About_Us/Week_in_images/  (weekly photo digest)
  - /ESA_Multimedia/Images/    (single-photo showcase)
  - /ESA_Multimedia/Videos/    (single-video showcase)

Usage:
  python3 backfill_news_remove_gallery_pages.py             # report + delete
  python3 backfill_news_remove_gallery_pages.py --dry-run   # report only
"""
import argparse
import logging

import config  # noqa: F401 — side effect: load_dotenv()
from database import get_db_connection

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("backfill_news_remove_gallery_pages")

URL_PATTERNS = ('/About_Us/Week_in_images/', '/ESA_Multimedia/Images/', '/ESA_Multimedia/Videos/')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="only report, delete nothing")
    args = parser.parse_args()

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        clause = " OR ".join(["url LIKE %s"] * len(URL_PATTERNS))
        params = [f"%{p}%" for p in URL_PATTERNS]
        cursor.execute(f"SELECT id, slug, url FROM news_articles WHERE {clause}", params)
        rows = cursor.fetchall()
    finally:
        cursor.close()
        conn.close()

    logger.info(f"found {len(rows)} gallery-page row(s)")
    for row in rows:
        logger.info(f"  id={row['id']} slug={row['slug']} url={row['url']}")

    if args.dry_run or not rows:
        return

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        ids = [row["id"] for row in rows]
        placeholders = ",".join(["%s"] * len(ids))
        # news_article_images / news_article_videos cascade via FK ON DELETE CASCADE.
        cursor.execute(f"DELETE FROM news_articles WHERE id IN ({placeholders})", ids)
        conn.commit()
        logger.info(f"deleted {cursor.rowcount} row(s)")
    finally:
        cursor.close()
        conn.close()


if __name__ == "__main__":
    main()
