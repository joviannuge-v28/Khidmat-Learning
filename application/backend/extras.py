import io
import os
import asyncio
import zipfile
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import Optional

from bson import json_util
from fastapi import APIRouter, Request, Response, HTTPException, Depends
from pydantic import BaseModel

from core import db, logger, new_id, now_iso, require_admin, require_superadmin, get_object

router = APIRouter(prefix="/api")
APP_ROOT = Path(__file__).parent.parent
SKIP_DIRS = {"node_modules", "build", "__pycache__", ".git", ".pytest_cache", ".cache"}
SKIP_FILES = {".env"}


# ---------- Lapor admin (dari halaman login) ----------
class SupportIn(BaseModel):
    name: str
    nip: str = ""
    contact: str = ""
    whatsapp: str
    category: str = "Lupa kata sandi"
    message: str


class SupportUpdate(BaseModel):
    status: str
    admin_note: str = ""


@router.post("/support-requests")
async def create_support_request(body: SupportIn, request: Request):
    import re
    if not body.name.strip() or not body.whatsapp.strip() or not body.message.strip():
        raise HTTPException(status_code=400, detail="Nama, nomor WhatsApp, dan pesan wajib diisi")
    if not re.match(r"^\+?[0-9 \-]{9,16}$", body.whatsapp.strip()):
        raise HTTPException(status_code=400, detail="Format nomor WhatsApp tidak valid (contoh: 081234567890)")
    if len(body.message) > 2000 or len(body.name) > 120 or len(body.contact) > 120:
        raise HTTPException(status_code=400, detail="Isian terlalu panjang")
    ip = (request.headers.get("x-forwarded-for") or (request.client.host if request.client else "")).split(",")[-1].strip()
    since = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    if await db.support_requests.count_documents({"ip": ip, "created_at": {"$gte": since}}) >= 5:
        raise HTTPException(status_code=429, detail="Terlalu banyak laporan. Coba lagi dalam 1 jam.")
    doc = {"id": new_id(), **body.model_dump(), "status": "new", "admin_note": "", "ip": ip, "created_at": now_iso()}
    await db.support_requests.insert_one(dict(doc))
    return {"ok": True, "id": doc["id"]}


@router.get("/admin/support-requests")
async def list_support_requests(status: Optional[str] = None, _=Depends(require_admin)):
    q = {"status": status} if status else {}
    return await db.support_requests.find(q, {"_id": 0, "ip": 0}).sort("created_at", -1).to_list(1000)


@router.patch("/admin/support-requests/{rid}")
async def update_support_request(rid: str, body: SupportUpdate, _=Depends(require_admin)):
    if body.status not in ("new", "done"):
        raise HTTPException(status_code=400, detail="Status tidak valid")
    await db.support_requests.update_one({"id": rid}, {"$set": {**body.model_dump(), "updated_at": now_iso()}})
    return await db.support_requests.find_one({"id": rid}, {"_id": 0, "ip": 0})


@router.delete("/admin/support-requests/{rid}")
async def delete_support_request(rid: str, _=Depends(require_admin)):
    await db.support_requests.delete_one({"id": rid})
    return {"ok": True}


# ---------- Backup ----------
RESTORE_MD = """# Cara memulihkan backup LMS Khidmat Kota Dumai

## Database (folder database/)
Setiap file JSON = satu tabel PostgreSQL (kolom _id + doc JSONB).
Impor: cd backend && python migrate_mongo_to_pg.py --json-dir ../database --replace
(atau unggah ZIP ini di menu Backup & Recovery > Pulihkan).

## Aplikasi (folder application/)
Kode backend (FastAPI) dan frontend (React). File .env TIDAK disertakan demi keamanan;
salin backend/.env.example dan frontend/.env.example lalu isi nilainya. Lihat PROJECT_CONTEXT.md.

## File unggahan (folder files/, hanya di backup lengkap)
Berisi file asli (foto, video, PDF) sesuai path di koleksi `files`. Unggah ulang ke penyimpanan dengan path yang sama.
"""


async def _db_dump() -> dict:
    out = {}
    for name in sorted(await db.list_collection_names()):
        out[name] = await db[name].find({}).to_list(None)
    return out


def _write_db(z: zipfile.ZipFile, dump: dict, prefix: str):
    for name, docs in dump.items():
        z.writestr(f"{prefix}{name}.json", json_util.dumps(docs, indent=1, ensure_ascii=False))


def _write_app(z: zipfile.ZipFile, prefix: str):
    for item in ["backend", "frontend", "memory", "PROJECT_CONTEXT.md", "README.md", "design_guidelines.json"]:
        p = APP_ROOT / item
        if p.is_file():
            z.write(p, f"{prefix}{item}")
            continue
        if not p.is_dir():
            continue
        for root, dirs, files in os.walk(p):
            dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
            for f in files:
                if f in SKIP_FILES or f.endswith(".pyc"):
                    continue
                fp = Path(root) / f
                z.write(fp, f"{prefix}{fp.relative_to(APP_ROOT)}")


def _zip_response(data: bytes, label: str) -> Response:
    name = f"backup-{label}-{datetime.now(timezone.utc).strftime('%Y-%m-%d-%H%M')}.zip"
    return Response(content=data, media_type="application/zip", headers={"Content-Disposition": f'attachment; filename="{name}"'})


def _build_zip(dump: Optional[dict], app: bool, files: Optional[list]) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("RESTORE.md", RESTORE_MD)
        if dump is not None:
            _write_db(z, dump, "database/")
        if app:
            _write_app(z, "application/")
        for path in files or []:
            try:
                data, _ = get_object(path)
                z.writestr(f"files/{path}", data)
            except Exception as e:
                logger.warning(f"backup skip file {path}: {e}")
    return buf.getvalue()


@router.get("/admin/backup/info")
async def backup_info(_=Depends(require_superadmin)):
    files = await db.files.find({"is_deleted": False}, {"_id": 0, "size": 1}).to_list(None)
    cols = await db.list_collection_names()
    return {"collections": len(cols), "files": len(files), "files_size": sum(f.get("size", 0) for f in files)}


@router.get("/admin/backup/database")
async def backup_database(_=Depends(require_superadmin)):
    dump = await _db_dump()
    return _zip_response(await asyncio.to_thread(_build_zip, dump, False, None), "database")


@router.get("/admin/backup/application")
async def backup_application(_=Depends(require_superadmin)):
    return _zip_response(await asyncio.to_thread(_build_zip, None, True, None), "aplikasi")


@router.get("/admin/backup/full")
async def backup_full(_=Depends(require_superadmin)):
    dump = await _db_dump()
    paths = [f["storage_path"] for f in await db.files.find({"is_deleted": False}, {"_id": 0, "storage_path": 1}).to_list(None)]
    return _zip_response(await asyncio.to_thread(_build_zip, dump, True, paths), "lengkap")
