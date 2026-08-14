#!/usr/bin/env python3
"""Ad-hoc diagnostic for the "[IMG:0] shown as literal text" news bug.

Usage (on the server, where the DB is reachable):
  python3 diag_news_img.py <slug>

Prints the raw body/body_uk around every [IMG:n] placeholder plus the rows
in news_article_images, so we can see exactly why the frontend's
"placeholder alone on its own paragraph" match is failing for this article.
"""
import re
import sys

import config  # noqa: F401 — side effect: load_dotenv()
from database import get_db_connection

_IMG_RE = re.compile(r'\[IMG:\d+\]')


def show(label, text):
    print(f"\n=== {label} ===")
    if not text:
        print("(empty)")
        return
    if not _IMG_RE.search(text):
        print("(no [IMG:n] placeholders in this field)")
        return
    for m in _IMG_RE.finditer(text):
        start = max(0, m.start() - 40)
        end = min(len(text), m.end() + 40)
        snippet = text[start:end].replace("\n", "\\n")
        print(f"  pos {m.start()}: ...{snippet}...")


def main():
    if len(sys.argv) != 2:
        print("usage: python3 diag_news_img.py <slug>")
        sys.exit(1)
    slug = sys.argv[1]

    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    try:
        cursor.execute("SELECT * FROM news_articles WHERE slug = %s", (slug,))
        row = cursor.fetchone()
        if not row:
            print(f"no article with slug={slug!r}")
            return

        print(f"id={row['id']} slug={row['slug']}")
        show("body (EN)", row.get("body"))
        show("body_uk", row.get("body_uk"))

        cursor.execute(
            "SELECT position, source_url, full_path, thumb_path FROM news_article_images "
            "WHERE article_id = %s ORDER BY position", (row["id"],)
        )
        images = cursor.fetchall()
        print(f"\n=== news_article_images ({len(images)} row(s)) ===")
        for im in images:
            print(f"  position={im['position']} full_path={im['full_path']} "
                  f"thumb_path={im['thumb_path']} source_url={im['source_url']}")
    finally:
        cursor.close()
        conn.close()


if __name__ == "__main__":
    main()
