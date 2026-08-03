#!/usr/bin/env python3
"""Оновлення каталогу галактик на сервері (run manually or via cron/systemd).

Переробляє живі дані NED (redshift/type) + повторно дзеркалити фото з
Wikimedia Commons (з fallback на NASA Image Library) у БД та в
``data/galaxies/<key>/``. Записи в ``galaxies`` + ``galaxy_photos``
оновлюються через UPSERT — ідемпотентно.

Режими:
  (за замовч.)  легке оновлення: NED + повторна спроба завантажити фото,
                в яких раніше не змоглося дзеркалити (рядки з already-mirrored
                thumb_path+full_path пропускаються — без реранжирування).
  --reset       повний перебілд фото для вказаних галактик: видаляє рядки
                galaxy_photos + скидає preview + видаляє data/galaxies/<key>,
                потім заново будує та дзеркалити. Це потрібно, щоб підняти
                нові фото з Commons та переранжувати їх (плейн backfill цього
                не робить через skip-логіку ingest_galaxy_photos).
  --key KEY    обмежити дію однією галактикою (можна вказати кілька разів).
  --no-photos  оновити лише записи каталогу (NED), без фото.

Використання:
  python3 update_galaxies.py                # легке оновлення всіх 21
  python3 update_galaxies.py --reset         # повний перебілд фото всіх 21
  python3 update_galaxies.py --reset --key andromeda --key pinwheel
  python3 update_galaxies.py --no-photos

Логує в stdout + дописує в update_galaxies.log. Ніколи не raise — best-effort,
як і scheduler.poll_galaxies / database.backfill_galaxies.
"""
import argparse
import logging
import os
import shutil
import sys
import time

# Importing config loads .env (DB creds, NASA key, ...).
import config  # noqa: F401  — side effect: load_dotenv()
from database import (
    init_db,
    ingest_galaxies,
    ingest_galaxy_photos,
    get_db_connection,
)
from services.galaxies import (
    GALAXIES,
    build_galaxy_records,
    build_galaxy_photos,
)

LOG_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "update_galaxies.log")
DATA_GALAXIES_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "galaxies")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(name)s %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[logging.StreamHandler(sys.stdout), logging.FileHandler(LOG_FILE, encoding="utf-8")],
)
log = logging.getLogger("update_galaxies")


def _reset_galaxy(galaxy_key: str) -> None:
    """DELETE galaxy_photos + reset preview + rm data/galaxies/<key>.

    Так ingest_galaxy_photos не пропустить вже-дзеркалені рядки й знову
    побудує/проранжує фото (плейн backfill пропускає рядки з thumb+full).
    """
    # 1) Видалити рядки фото (galaxy_key не є reserved word).
    conn = get_db_connection()
    cur = conn.cursor()
    try:
        cur.execute("DELETE FROM galaxy_photos WHERE galaxy_key=%s", (galaxy_key,))
        # 2) Скинути preview на картці хаба (`key` — зарезервоване слово → backtick).
        cur.execute(
            "UPDATE galaxies SET preview_nasa_id=NULL, preview_thumb=NULL "
            "WHERE `key`=%s",
            (galaxy_key,),
        )
        conn.commit()
    except Exception as e:
        log.error("reset failed for %s: %s", galaxy_key, e)
        conn.rollback()
    finally:
        cur.close()
        conn.close()

    # 3) Видалити локальні дзеркала.
    gdir = os.path.join(DATA_GALAXIES_DIR, galaxy_key)
    if os.path.isdir(gdir):
        shutil.rmtree(gdir, ignore_errors=True)
        log.info("reset %s: removed photo rows + preview + %s", galaxy_key, gdir)
    else:
        log.info("reset %s: removed photo rows + preview", galaxy_key)


def main() -> int:
    ap = argparse.ArgumentParser(description="Оновити галактики на сервері")
    ap.add_argument("--reset", action="store_true",
                    help="повний перебілд фото (delete + rebuild, з реранжируванням)")
    ap.add_argument("--key", action="append", default=[], metavar="KEY",
                    help="обмежити дію цією галактикою (можна кілька разів)")
    ap.add_argument("--no-photos", action="store_true",
                    help="оновити лише записи каталогу (NED), без фото")
    args = ap.parse_args()

    valid_keys = {g["key"] for g in GALAXIES}
    targets = [k for k in args.key if k in valid_keys]
    bad = [k for k in args.key if k not in valid_keys]
    if bad:
        log.error("unknown galaxy key(s): %s (valid: %s)", bad, sorted(valid_keys))

    t0 = time.time()
    init_db()

    # 1) Записи каталогу + live NED.
    records = build_galaxy_records()
    if not records:
        log.error("build_galaxy_records returned nothing — aborting")
        return 1

    if targets:
        records = [r for r in records if r["key"] in targets]

    rows = ingest_galaxies(records)
    log.info("Ingested/updated %d galaxy row(s)", rows)

    # 2) Фото.
    total_photos = 0
    if not args.no_photos:
        if args.reset:
            for r in records:
                _reset_galaxy(r["key"])

        for r in records:
            key = r["key"]
            try:
                photos = build_galaxy_photos(key, r.get("nasa_query"))
            except Exception as e:
                log.error("build_galaxy_photos error for %s: %s", key, e)
                continue
            if not photos:
                log.info("no photos for %s", key)
                continue
            n = ingest_galaxy_photos(key, photos)
            total_photos += n
            log.info("  %-16s photos_ingested=%d", key, n)
    else:
        log.info("skipping photos (--no-photos)")

    dt = time.time() - t0
    log.info("UPDATE DONE: %d galaxy row(s), %d photo(s) in %ds",
             rows, total_photos, int(dt))
    return 0


if __name__ == "__main__":
    sys.exit(main())