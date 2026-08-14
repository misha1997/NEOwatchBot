#!/usr/bin/env python3
"""One-off backfill for a translation bug that broke inline [IMG:n] placeholders.

`Translator.translate_body()` (utils/translator.py) splits a news article body
around `[IMG:n]` placeholders, translates only the surrounding prose, and
stitches the untouched placeholders back in. The prose chunks were sent to
DeepL via `_translate()`, which calls `.strip()` on each chunk before the API
call and never restored the stripped whitespace — so the "\\n\\n" that kept a
placeholder alone on its own paragraph line was lost. The result: `body_uk`
rows translated before the fix have `[IMG:n]` glued onto the end of the
previous paragraph instead of standing alone, so the frontend's "whole
paragraph is just the placeholder" match (my-app/src/pages/NewsArticle.js)
fails and the site literally prints "[IMG:n]" instead of rendering the image.

This script finds `news_articles` rows where `body_uk` has a placeholder that
is NOT alone on its own paragraph, and resets `body_uk` to NULL so the site's
existing lazy-retranslate path (web/data.py, on next article page view)
regenerates it with the now-fixed translator.

Usage:
  python3 backfill_news_img_placeholder.py             # report + apply
  python3 backfill_news_img_placeholder.py --dry-run   # report counts only
"""
import argparse
import logging
import re

import config  # noqa: F401 — side effect: load_dotenv()
from database import get_db_connection

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("backfill_news_img_placeholder")

_IMG_RE = re.compile(r'\[IMG:\d+\]')
_IMG_ALONE_RE = re.compile(r'^\[IMG:\d+\]$')


def _is_broken(body_uk: str) -> bool:
    """True if any [IMG:n] placeholder is not alone on its own paragraph."""
    paragraphs = [p.strip() for p in body_uk.split("\n\n")]
    placeholder_paragraphs = sum(1 for p in paragraphs if _IMG_ALONE_RE.match(p))
    total_placeholders = len(_IMG_RE.findall(body_uk))
    return placeholder_paragraphs < total_placeholders


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="only report counts, write nothing")
    args = parser.parse_args()

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "SELECT id, body_uk FROM news_articles "
            "WHERE body_uk IS NOT NULL AND body_uk LIKE '%[IMG:%'"
        )
        rows = cursor.fetchall()
        broken_ids = [row_id for row_id, body_uk in rows if _is_broken(body_uk)]

        if broken_ids and not args.dry_run:
            placeholders = ",".join(["%s"] * len(broken_ids))
            cursor.execute(
                f"UPDATE news_articles SET body_uk = NULL WHERE id IN ({placeholders})",
                broken_ids,
            )
            conn.commit()

        verb = "would reset" if args.dry_run else "reset"
        logger.info(f"{verb} body_uk on {len(broken_ids)}/{len(rows)} row(s) with broken [IMG:n] placeholders")
    finally:
        cursor.close()
        conn.close()


if __name__ == "__main__":
    main()
