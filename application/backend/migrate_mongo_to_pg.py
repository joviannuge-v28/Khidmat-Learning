"""Migrasi data MongoDB -> PostgreSQL tanpa kehilangan data.

Sumber data (pilih salah satu):
  1) Folder ekspor JSON (hasil Backup & Recovery / mongoexport --jsonArray):
       python migrate_mongo_to_pg.py --json-dir ../migration/mongo_export
  2) Langsung dari server MongoDB yang masih berjalan:
       python migrate_mongo_to_pg.py --mongo-url mongodb://localhost:27017 --mongo-db nama_db

Tujuan diambil dari DATABASE_URL di backend/.env.
Tambahkan --replace untuk mengosongkan tabel tujuan sebelum impor (default: lewati jika tabel sudah berisi data).
"""
import argparse
import asyncio
import os
from pathlib import Path

from bson import json_util
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")

from pgdb import Database  # noqa: E402


def _fix(doc):
    if isinstance(doc, dict):
        return {k: _fix(v) for k, v in doc.items()}
    if isinstance(doc, list):
        return [_fix(v) for v in doc]
    if type(doc).__name__ in ("ObjectId", "Decimal128", "Int64"):
        return str(doc) if type(doc).__name__ == "ObjectId" else float(str(doc))
    return doc


def load_json_dir(folder: str) -> dict:
    out = {}
    for f in sorted(Path(folder).glob("*.json")):
        out[f.stem] = json_util.loads(f.read_text(encoding="utf-8"))
    return out


def load_mongo(url: str, name: str) -> dict:
    from pymongo import MongoClient
    mdb = MongoClient(url)[name]
    return {c: list(mdb[c].find({})) for c in mdb.list_collection_names()}


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--json-dir")
    ap.add_argument("--mongo-url")
    ap.add_argument("--mongo-db")
    ap.add_argument("--replace", action="store_true")
    a = ap.parse_args()
    if a.json_dir:
        data = load_json_dir(a.json_dir)
    elif a.mongo_url and a.mongo_db:
        data = load_mongo(a.mongo_url, a.mongo_db)
    else:
        ap.error("isi --json-dir ATAU --mongo-url dan --mongo-db")
    db = Database(os.environ["DATABASE_URL"])
    total = 0
    for name, docs in data.items():
        col = db[name]
        existing = await col.count_documents({})
        if existing and not a.replace:
            print(f"- {name}: dilewati (sudah ada {existing} baris, pakai --replace untuk menimpa)")
            continue
        await col.delete_many({})
        docs = [_fix(d) for d in docs]
        if docs:
            await col.insert_many(docs)
        check = await col.count_documents({})
        total += check
        print(f"- {name}: {len(docs)} dokumen -> {check} baris PostgreSQL {'OK' if check == len(docs) else 'TIDAK COCOK!'}")
    print(f"Selesai. Total {total} baris dimigrasikan.")


if __name__ == "__main__":
    asyncio.run(main())
