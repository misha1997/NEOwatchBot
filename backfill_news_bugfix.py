#!/usr/bin/env python3
"""One-off backfill for two news-pipeline bugs fixed in this session.

Both bugs only affected the *storage* step, so `news_articles` rows ingested
before the fix are still broken and won't self-heal on their own:

1. ESA / SpaceNews / Universe Today articles used to get `body` filled with a
   copy of `excerpt` (their RSS feeds have no `content:encoded`). Because the
   site's lazy full-body fetch only fires when `body` is empty
   (`web/data.py:_news_article_raw`), a non-empty excerpt-as-body permanently
   blocked it from ever pulling the real article text. This script resets
   `body`/`body_uk` to NULL for those rows so the next article page view
   re-fetches + retranslates for real.

2. `title_uk`/`excerpt_uk`/`body_uk` used to get permanently set to the
   English original whenever DeepL translation failed (quota, outage, or a
   missing `DEEPL_API_KEY`) — a copy of the source text, stored as if it were
   the Ukrainian translation, with no retry. `body_uk` self-heals lazily on
   the next article page view once reset (see above), but `title_uk`/
   `excerpt_uk` have no such lazy path (the site's list/card views just
   render whatever is stored), so this script re-translates them immediately
   and writes the result back, batched into as few DeepL calls as possible.

Usage:
  python3 backfill_news_bugfix.py             # report + apply
  python3 backfill_news_bugfix.py --dry-run   # report counts only, no writes
"""
import argparse
import logging

import config  # noqa: F401 — side effect: load_dotenv()
from database import get_db_connection
from utils.translator import Translator

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("backfill_news_bugfix")

EXCERPT_ONLY_SOURCES = ("ESA", "SpaceNews", "Universe Today")
DEEPL_CHUNK = 50  # keep individual API calls small/safe


def _update_by_ids(cursor, ids, sql_suffix):
    if not ids:
        return
    placeholders = ",".join(["%s"] * len(ids))
    cursor.execute(f"UPDATE news_articles SET {sql_suffix} WHERE id IN ({placeholders})", ids)


def reset_body_placeholders(cursor, dry_run: bool) -> int:
    """Rows from the 3 excerpt-only sources where body is just a copy of excerpt."""
    cursor.execute(
        "SELECT id FROM news_articles WHERE source IN (%s, %s, %s) "
        "AND body IS NOT NULL AND body = excerpt",
        EXCERPT_ONLY_SOURCES,
    )
    ids = [row[0] for row in cursor.fetchall()]
    if not dry_run:
        _update_by_ids(cursor, ids, "body = NULL, body_uk = NULL")
    return len(ids)


def reset_failed_body_translations(cursor, dry_run: bool) -> int:
    """Rows (any source) where body_uk was stamped equal to body (failed translation).

    Excludes rows already caught by reset_body_placeholders (those already
    have body_uk = NULL by the time this runs)."""
    cursor.execute(
        "SELECT id FROM news_articles WHERE body IS NOT NULL "
        "AND body_uk IS NOT NULL AND body_uk = body"
    )
    ids = [row[0] for row in cursor.fetchall()]
    if not dry_run:
        _update_by_ids(cursor, ids, "body_uk = NULL")
    return len(ids)


def _translate_chunked(texts: list) -> list:
    out = []
    for i in range(0, len(texts), DEEPL_CHUNK):
        out.extend(Translator.translate_batch(texts[i:i + DEEPL_CHUNK], "uk"))
    return out


def retranslate_titles_excerpts(cursor, dry_run: bool) -> int:
    cursor.execute(
        "SELECT id, title, title_uk, excerpt, excerpt_uk FROM news_articles "
        "WHERE (title_uk IS NOT NULL AND title_uk = title) "
        "OR (excerpt_uk IS NOT NULL AND excerpt_uk <> '' AND excerpt_uk = excerpt)"
    )
    rows = cursor.fetchall()
    if not rows or dry_run:
        return len(rows)

    texts = []
    spans = []  # (row_id, title, excerpt, title_idx, excerpt_idx)
    for row_id, title, title_uk, excerpt, excerpt_uk in rows:
        need_title = title_uk == title
        need_excerpt = bool(excerpt) and excerpt_uk == excerpt
        t_idx = e_idx = None
        if need_title:
            t_idx = len(texts)
            texts.append(title)
        if need_excerpt:
            e_idx = len(texts)
            texts.append(excerpt)
        spans.append((row_id, title, excerpt, t_idx, e_idx))

    translated = _translate_chunked(texts) if texts else []

    for row_id, title, excerpt, t_idx, e_idx in spans:
        new_title_uk = translated[t_idx] if t_idx is not None and translated[t_idx] != title else None
        new_excerpt_uk = translated[e_idx] if e_idx is not None and translated[e_idx] != excerpt else None
        cursor.execute(
            "UPDATE news_articles SET title_uk = %s, excerpt_uk = %s WHERE id = %s",
            (new_title_uk, new_excerpt_uk, row_id),
        )
    return len(rows)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true", help="only report counts, write nothing")
    args = parser.parse_args()

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        n1 = reset_body_placeholders(cursor, args.dry_run)
        n2 = reset_failed_body_translations(cursor, args.dry_run)
        n3 = retranslate_titles_excerpts(cursor, args.dry_run)
        if not args.dry_run:
            conn.commit()
        verb = "would reset" if args.dry_run else "reset"
        logger.info(f"{verb} body on {n1} excerpt-placeholder row(s) (ESA/SpaceNews/Universe Today)")
        logger.info(f"{verb} body_uk on {n2} failed-translation row(s)")
        verb2 = "would re-translate" if args.dry_run else "re-translated"
        logger.info(f"{verb2} title/excerpt on {n3} row(s)")
    finally:
        cursor.close()
        conn.close()


if __name__ == "__main__":
    main()
