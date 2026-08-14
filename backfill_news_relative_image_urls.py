#!/usr/bin/env python3
"""One-off backfill for relative news image URLs stored before the urljoin
fix in parsers/news.py.

Some source pages use root-relative `<img src="/article_images/foo.webp">`
paths. `NewsParser` used to store that verbatim instead of resolving it
against the article's own URL. The result: `news_articles.image` /
`news_article_images.source_url` ended up holding a path like
`/article_images/foo.webp` — `download_news_image()` can't fetch a relative
URL (no host), so the local mirror never happens, and the frontend's
fallback to the raw `source_url`/`image` renders `<img src="/article_images/
foo.webp">`, which the browser resolves against *our own* site's origin and
gets a 404.

This script finds already-stored image URLs that aren't absolute, resolves
them against the owning article's URL, retries the local mirror, and updates
the row either way (so at minimum the frontend hotlinks a real URL instead
of a same-origin 404).

Usage:
  python3 backfill_news_relative_image_urls.py             # report + apply
  python3 backfill_news_relative_image_urls.py --dry-run   # report counts only
"""
import argparse
import logging
from urllib.parse import urljoin

import config  # noqa: F401 — side effect: load_dotenv()
from database import get_db_connection
from services.news_images import download_news_image

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("backfill_news_relative_image_urls")


def _is_relative(u: str) -> bool:
    return bool(u) and not u.lower().startswith(("http://", "https://"))


def fix_hero_images(cursor, dry_run: bool) -> int:
    cursor.execute(
        "SELECT id, url, image FROM news_articles "
        "WHERE image IS NOT NULL AND image <> ''"
    )
    rows = [r for r in cursor.fetchall() if _is_relative(r[2])]
    for article_id, article_url, image in rows:
        absolute = urljoin(article_url, image)
        logger.info(f"article id={article_id}: image {image!r} -> {absolute!r}")
        if not dry_run:
            cursor.execute("UPDATE news_articles SET image = %s WHERE id = %s", (absolute, article_id))
    return len(rows)


def fix_body_images(cursor, dry_run: bool) -> int:
    cursor.execute(
        """SELECT ai.article_id, ai.position, ai.source_url, a.url, a.slug
           FROM news_article_images ai
           JOIN news_articles a ON a.id = ai.article_id"""
    )
    rows = [r for r in cursor.fetchall() if _is_relative(r[2])]
    for article_id, position, source_url, article_url, slug in rows:
        absolute = urljoin(article_url, source_url)
        logger.info(f"article id={article_id} pos={position}: {source_url!r} -> {absolute!r}")
        if dry_run:
            continue
        try:
            full_rel, thumb_rel = download_news_image(slug, position, absolute)
        except Exception as e:
            logger.warning(f"download failed for id={article_id} pos={position}: {e}")
            full_rel, thumb_rel = None, None
        cursor.execute(
            "UPDATE news_article_images SET source_url = %s, "
            "full_path = COALESCE(%s, full_path), thumb_path = COALESCE(%s, thumb_path) "
            "WHERE article_id = %s AND position = %s",
            (absolute, full_rel, thumb_rel, article_id, position),
        )
    return len(rows)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="only report counts, write nothing")
    args = parser.parse_args()

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        n1 = fix_hero_images(cursor, args.dry_run)
        n2 = fix_body_images(cursor, args.dry_run)
        if not args.dry_run:
            conn.commit()
        verb = "would fix" if args.dry_run else "fixed"
        logger.info(f"{verb} {n1} relative hero image(s), {n2} relative inline image(s)")
    finally:
        cursor.close()
        conn.close()


if __name__ == "__main__":
    main()
