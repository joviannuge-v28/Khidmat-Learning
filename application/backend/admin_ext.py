import io
import os
import re
import hmac
import json
import asyncio
import hashlib
import secrets
import smtplib
import zipfile
from email.message import EmailMessage
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any

from bson import json_util
from fastapi import APIRouter, Request, Response, HTTPException, Depends, UploadFile, File
from pydantic import BaseModel

from core import (db, logger, new_id, now_iso, get_current_user, require_admin, require_superadmin, is_admin,
                  client_ip, put_object, get_object, APP_NAME)
from extras import _db_dump, _build_zip
from features import _pdf, _file

router = APIRouter(prefix="/api")
FRONTEND_URL = os.environ["FRONTEND_URL"]

# ---------- Password policy ----------
COMMON = {"password", "password1", "password123", "123456", "1234567890", "12345678", "qwerty", "qwerty123", "admin123",
          "abc123", "iloveyou", "welcome", "letmein", "passw0rd", "rahasia", "bismillah", "indonesia", "sayang", "dumai",
          "dumaikota", "pemkot", "asn12345", "pegawai", "bkpsdm"}


def validate_password(pw: str, user: Optional[dict] = None):
    if len(pw) < 10 or len(pw) > 128:
        raise HTTPException(status_code=400, detail="Kata sandi minimal 10 karakter")
    if not re.search(r"[A-Za-z]", pw) or not re.search(r"\d", pw) or not re.search(r"[^A-Za-z0-9]", pw):
        raise HTTPException(status_code=400, detail="Kata sandi wajib kombinasi huruf, angka, dan simbol")
    low = re.sub(r"[^a-z]", "", pw.lower())
    if pw.lower() in COMMON or low in COMMON or any(w in pw.lower() for w in ("password", "qwerty", "123456")):
        raise HTTPException(status_code=400, detail="Kata sandi terlalu umum, gunakan kombinasi lain")
    if user and ((user.get("nip") and user["nip"] in pw) or (user.get("email") and user["email"].split("@")[0].lower() in pw.lower())):
        raise HTTPException(status_code=400, detail="Kata sandi tidak boleh memuat NIP atau email")


# ---------- Secure upload ----------
SIGNATURES = {
    "jpg": [b"\xff\xd8\xff"], "jpeg": [b"\xff\xd8\xff"], "png": [b"\x89PNG"], "gif": [b"GIF8"], "pdf": [b"%PDF"],
    "webm": [b"\x1a\x45\xdf\xa3"], "docx": [b"PK\x03\x04"], "pptx": [b"PK\x03\x04"], "xlsx": [b"PK\x03\x04"],
    "doc": [b"\xd0\xcf\x11\xe0"], "ppt": [b"\xd0\xcf\x11\xe0"],
}


def check_upload(ext: str, data: bytes):
    ok = True
    if ext in SIGNATURES:
        ok = any(data.startswith(s) for s in SIGNATURES[ext])
    elif ext == "webp":
        ok = data[:4] == b"RIFF" and data[8:12] == b"WEBP"
    elif ext == "mp4":
        ok = data[4:8] == b"ftyp"
    elif ext == "svg":
        head = data[:200000].decode("utf-8", "ignore").lower()
        ok = "<svg" in head and not re.search(r"<script|javascript:|\son\w+\s*=|<foreignobject|<iframe", head)
    if not ok:
        raise HTTPException(status_code=400, detail="Isi file tidak sesuai dengan ekstensinya atau mengandung kode berbahaya")


def safe_filename(name: str) -> str:
    name = os.path.basename(name or "file").replace("\\", "_")
    return re.sub(r"[^\w.\- ()]", "_", name)[:150] or "file"


# ---------- Security events & activity ----------
async def log_event(type_: str, request: Optional[Request], identifier: str = "", user: Optional[dict] = None, detail: str = ""):
    await db.security_events.insert_one({
        "id": new_id(), "type": type_, "identifier": identifier[:120], "user_id": (user or {}).get("id"),
        "user_name": (user or {}).get("name", ""), "ip": client_ip(request) if request else "",
        "ua": (request.headers.get("user-agent", "")[:200] if request else ""), "detail": detail[:300], "created_at": now_iso()})


ACTION = {"POST": "Tambah/Proses", "PUT": "Ubah", "PATCH": "Perbarui", "DELETE": "Hapus", "GET": "Unduh/Lihat"}
RESOURCE = {"users": "Pengguna", "courses": "Pelatihan/Webinar", "readings": "KMS", "categories": "Kategori", "settings": "Pengaturan",
            "certificates": "Sertifikat", "support-requests": "Laporan Pengguna", "backup": "Backup", "smtp": "SMTP", "psy-tests": "Tes Kepribadian",
            "eval-questions": "Evaluasi", "cert-design": "Desain Sertifikat", "reports": "Laporan", "activity-logs": "Log Aktivitas", "proposals": "Usulan"}


async def record_activity(user: dict, request: Request, status: int):
    parts = request.url.path.split("/")
    seg = parts[3] if len(parts) > 3 and parts[2] == "admin" else parts[2] if len(parts) > 2 else ""
    await db.activity_logs.insert_one({
        "id": new_id(), "user_id": user["id"], "user_name": user.get("name", ""), "role": user.get("role", ""),
        "method": request.method, "path": request.url.path[:200], "action": f"{ACTION.get(request.method, request.method)} {RESOURCE.get(seg, seg)}",
        "status": status, "ip": client_ip(request), "created_at": now_iso()})


def _range_q(start: str, end: str) -> dict:
    q = {}
    if start:
        q["$gte"] = start
    if end:
        q["$lte"] = end + "T23:59:59"
    return {"created_at": q} if q else {}


@router.get("/admin/activity-logs")
async def activity_logs(start: str = "", end: str = "", search: str = "", _=Depends(require_superadmin)):
    q = _range_q(start, end)
    if search:
        rx = {"$regex": re.escape(search), "$options": "i"}
        q["$or"] = [{"user_name": rx}, {"action": rx}, {"path": rx}]
    return await db.activity_logs.find(q, {"_id": 0}).sort("created_at", -1).to_list(1000)


@router.get("/admin/activity-logs/export")
async def activity_logs_export(start: str = "", end: str = "", format: str = "pdf", _=Depends(require_superadmin)):
    items = await db.activity_logs.find(_range_q(start, end), {"_id": 0}).sort("created_at", -1).to_list(5000)
    rows = [[i + 1, f"{x['user_name']} ({x['role']})", x["action"], x["path"], x["status"], x["ip"], x["created_at"][:19].replace("T", " ")] for i, x in enumerate(items)]
    period = f"Periode {start or 'awal'} s.d. {end or 'sekarang'}"
    if format == "xlsx":
        from features import _xlsx
        return _file(_xlsx("Log Aktivitas Admin", ["No", "Admin", "Aksi", "Endpoint", "Status", "IP", "Waktu (UTC)"], rows), "xlsx", "log-aktivitas-admin")
    return _file(_pdf("Laporan Log Aktivitas Admin", f"LMS Khidmat Kota Dumai · {period}", ["No", "Admin", "Aksi", "Endpoint", "Status", "IP", "Waktu (UTC)"], rows), "pdf", "log-aktivitas-admin")


@router.get("/admin/security/overview")
async def security_overview(_=Depends(require_superadmin)):
    now = datetime.now(timezone.utc)
    d1, d7 = (now - timedelta(days=1)).isoformat(), (now - timedelta(days=7)).isoformat()
    top_ips = await db.security_events.aggregate([{"$match": {"type": "login_failed", "created_at": {"$gte": d7}}},
                                                  {"$group": {"_id": "$ip", "count": {"$sum": 1}}}, {"$sort": {"count": -1}}, {"$limit": 8}]).to_list(8)
    daily = []
    for i in range(6, -1, -1):
        day = (now - timedelta(days=i)).strftime("%Y-%m-%d")
        rx = {"$regex": f"^{day}"}
        daily.append({"day": day[5:], "gagal": await db.security_events.count_documents({"type": "login_failed", "created_at": rx}),
                      "berhasil": await db.security_events.count_documents({"type": "login_success", "created_at": rx})})
    total = await db.users.count_documents({})
    verified = await db.users.count_documents({"email_verified": True})
    last_backup = await db.backups.find_one({}, {"_id": 0}, sort=[("created_at", -1)])
    return {
        "failed_24h": await db.security_events.count_documents({"type": "login_failed", "created_at": {"$gte": d1}}),
        "failed_7d": await db.security_events.count_documents({"type": "login_failed", "created_at": {"$gte": d7}}),
        "success_24h": await db.security_events.count_documents({"type": "login_success", "created_at": {"$gte": d1}}),
        "admin_actions_24h": await db.activity_logs.count_documents({"created_at": {"$gte": d1}}),
        "top_ips": [{"ip": x["_id"] or "-", "count": x["count"]} for x in top_ips], "daily": daily,
        "must_change": await db.users.count_documents({"must_change_password": True}),
        "inactive": await db.users.count_documents({"active": False}),
        "verified_pct": round(verified * 100 / total) if total else 0,
        "smtp_configured": await smtp_configured(), "last_backup": last_backup,
        "events": await db.security_events.find({}, {"_id": 0, "ua": 0}).sort("created_at", -1).to_list(40),
    }




# ---------- SMTP & email verification ----------
class SmtpIn(BaseModel):
    host: str = ""
    port: int = 587
    username: str = ""
    password: str = ""
    security: str = "starttls"
    from_email: str = ""
    from_name: str = "LMS Khidmat Kota Dumai"
    enabled: bool = True


async def _smtp() -> dict:
    return await db.smtp_config.find_one({"key": "main"}, {"_id": 0}) or {}


async def smtp_configured() -> bool:
    c = await _smtp()
    return bool(c.get("enabled") and c.get("host") and c.get("from_email"))


def _send_mail(cfg: dict, to: str, subject: str, html: str):
    msg = EmailMessage()
    msg["Subject"], msg["From"], msg["To"] = subject, f"{cfg.get('from_name') or ''} <{cfg['from_email']}>", to
    msg.set_content(re.sub(r"<[^>]+>", "", html))
    msg.add_alternative(html, subtype="html")
    port = int(cfg.get("port") or 587)
    if cfg.get("security") == "ssl":
        s = smtplib.SMTP_SSL(cfg["host"], port, timeout=20)
    else:
        s = smtplib.SMTP(cfg["host"], port, timeout=20)
        if cfg.get("security") == "starttls":
            s.starttls()
    try:
        if cfg.get("username"):
            s.login(cfg["username"], cfg.get("password", ""))
        s.send_message(msg)
    finally:
        s.quit()


@router.get("/admin/smtp")
async def get_smtp(_=Depends(require_superadmin)):
    c = await _smtp()
    has = bool(c.pop("password", ""))
    return {**SmtpIn().model_dump(), **c, "password": "", "has_password": has}


@router.put("/admin/smtp")
async def put_smtp(body: SmtpIn, _=Depends(require_superadmin)):
    d = body.model_dump()
    if body.security not in ("starttls", "ssl", "none"):
        raise HTTPException(status_code=400, detail="Mode keamanan tidak valid")
    if not d["password"]:
        d.pop("password")
    await db.smtp_config.update_one({"key": "main"}, {"$set": d}, upsert=True)
    return await get_smtp(_)


class TestMailIn(BaseModel):
    to: str


@router.post("/admin/smtp/test")
async def test_smtp(body: TestMailIn, _=Depends(require_superadmin)):
    if not await smtp_configured():
        raise HTTPException(status_code=400, detail="Lengkapi konfigurasi SMTP terlebih dahulu")
    try:
        await asyncio.to_thread(_send_mail, await _smtp(), body.to, "Uji SMTP LMS Khidmat Kota Dumai", "<p>Konfigurasi SMTP berhasil. Email uji ini dikirim dari LMS Khidmat Kota Dumai.</p>")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Gagal mengirim email: {str(e)[:200]}")
    return {"ok": True}


@router.get("/email-verification/status")
async def email_status(user=Depends(get_current_user)):
    return {"available": await smtp_configured(), "verified": bool(user.get("email_verified")), "email": user.get("email", "")}


@router.post("/profile/email/send-verification")
async def send_verification(request: Request, user=Depends(get_current_user)):
    if not await smtp_configured():
        raise HTTPException(status_code=400, detail="Verifikasi email belum bisa digunakan. Hubungi admin.")
    if not user.get("email"):
        raise HTTPException(status_code=400, detail="Akun belum memiliki email. Minta admin menambahkan email Anda.")
    if user.get("email_verified"):
        return {"ok": True, "already": True}
    since = (datetime.now(timezone.utc) - timedelta(seconds=60)).isoformat()
    if await db.email_tokens.find_one({"user_id": user["id"], "created_at": {"$gte": since}}):
        raise HTTPException(status_code=429, detail="Tunggu 1 menit sebelum mengirim ulang")
    token = secrets.token_urlsafe(32)
    await db.email_tokens.delete_many({"user_id": user["id"]})
    await db.email_tokens.insert_one({"hash": hashlib.sha256(token.encode()).hexdigest(), "user_id": user["id"], "email": user["email"],
                                      "expires": (datetime.now(timezone.utc) + timedelta(hours=24)).isoformat(), "created_at": now_iso()})
    link = f"{FRONTEND_URL}/verifikasi-email/{token}"
    html = f"<p>Halo {user['name']},</p><p>Klik tautan berikut untuk memverifikasi email akun LMS Khidmat Kota Dumai Anda (berlaku 24 jam):</p><p><a href='{link}'>{link}</a></p>"
    try:
        await asyncio.to_thread(_send_mail, await _smtp(), user["email"], "Verifikasi Email LMS Khidmat Kota Dumai", html)
    except Exception as e:
        logger.error(f"verification mail failed: {e}")
        raise HTTPException(status_code=502, detail="Gagal mengirim email verifikasi. Hubungi admin.")
    return {"ok": True}


class TokenIn(BaseModel):
    token: str


@router.post("/auth/verify-email")
async def verify_email(body: TokenIn, request: Request):
    t = await db.email_tokens.find_one({"hash": hashlib.sha256(body.token.encode()).hexdigest()})
    if not t or t["expires"] < now_iso():
        raise HTTPException(status_code=400, detail="Tautan verifikasi tidak valid atau kedaluwarsa")
    u = await db.users.find_one({"id": t["user_id"]}, {"_id": 0, "password_hash": 0})
    if not u or u.get("email") != t["email"]:
        raise HTTPException(status_code=400, detail="Email akun sudah berubah, kirim ulang verifikasi")
    await db.users.update_one({"id": u["id"]}, {"$set": {"email_verified": True, "email_verified_at": now_iso(), "email_verified_by": "email"}})
    await db.email_tokens.delete_many({"user_id": u["id"]})
    await log_event("email_verified", request, u.get("email", ""), u)
    return {"ok": True, "email": u["email"]}


class EmailAdminIn(BaseModel):
    email: Optional[str] = None
    approve: bool = False


@router.patch("/admin/users/{uid}/email")
async def admin_email(uid: str, body: EmailAdminIn, request: Request, admin=Depends(require_admin)):
    u = await db.users.find_one({"id": uid}, {"_id": 0})
    if not u:
        raise HTTPException(status_code=404, detail="Pengguna tidak ditemukan")
    if u.get("role") == "superadmin" and admin["role"] != "superadmin":
        raise HTTPException(status_code=403, detail="Tidak dapat mengubah akun Super Admin")
    upd = {}
    if body.email is not None:
        email = body.email.strip().lower()
        if email and not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
            raise HTTPException(status_code=400, detail="Format email tidak valid")
        if email and await db.users.find_one({"email": email, "id": {"$ne": uid}}):
            raise HTTPException(status_code=400, detail="Email sudah digunakan")
        if email != u.get("email"):
            upd.update({"email": email, "email_verified": False})
    if body.approve:
        if not (upd.get("email") or u.get("email")):
            raise HTTPException(status_code=400, detail="Isi email terlebih dahulu")
        upd.update({"email_verified": True, "email_verified_at": now_iso(), "email_verified_by": f"admin:{admin['name']}"})
    if upd:
        await db.users.update_one({"id": uid}, {"$set": upd})
        await log_event("email_approved" if body.approve else "email_changed", request, upd.get("email", u.get("email", "")), admin, f"untuk {u['name']}")
    return await db.users.find_one({"id": uid}, {"_id": 0, "password_hash": 0})


# ---------- Backup otomatis & pemulihan ----------
async def run_backup(trigger: str, by: str = "Sistem") -> dict:
    dump = await _db_dump()
    paths = [f["storage_path"] for f in await db.files.find({"is_deleted": False}, {"_id": 0, "storage_path": 1}).to_list(None)]
    data = await asyncio.to_thread(_build_zip, dump, False, paths)
    name = f"backup-{trigger}-{datetime.now(timezone.utc).strftime('%Y-%m-%d-%H%M%S')}.zip"
    path = f"{APP_NAME}/backups/{name}"
    await asyncio.to_thread(put_object, path, data, "application/zip")
    doc = {"id": new_id(), "name": name, "path": path, "size": len(data), "trigger": trigger, "by": by,
           "collections": len(dump), "files": len(paths), "created_at": now_iso()}
    await db.backups.insert_one(dict(doc))
    return doc


@router.get("/admin/backups")
async def list_backups(_=Depends(require_superadmin)):
    return await db.backups.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)


@router.post("/admin/backups")
async def create_backup(admin=Depends(require_superadmin)):
    try:
        return await run_backup("manual", admin["name"])
    except Exception as e:
        logger.error(f"backup failed: {e}")
        raise HTTPException(status_code=502, detail="Gagal membuat backup")


@router.get("/admin/backups/{bid}/download")
async def download_backup(bid: str, _=Depends(require_superadmin)):
    b = await db.backups.find_one({"id": bid}, {"_id": 0})
    if not b:
        raise HTTPException(status_code=404, detail="Backup tidak ditemukan")
    data, _ct = await asyncio.to_thread(get_object, b["path"])
    return Response(content=data, media_type="application/zip", headers={"Content-Disposition": f'attachment; filename="{b["name"]}"'})


SKIP_RESTORE = {"backups", "activity_logs", "security_events", "smtp_config", "cron_runs", "email_tokens"}


@router.post("/admin/backups/restore")
async def restore_database(request: Request, file: UploadFile = File(...), admin=Depends(require_superadmin)):
    raw = await file.read()
    if len(raw) > 300 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File terlalu besar")
    cols: Dict[str, list] = {}
    try:
        if file.filename.lower().endswith(".zip"):
            with zipfile.ZipFile(io.BytesIO(raw)) as z:
                for n in z.namelist():
                    if n.startswith("database/") and n.endswith(".json"):
                        cols[n[9:-5]] = json_util.loads(z.read(n).decode("utf-8"))
        else:
            parsed = json_util.loads(raw.decode("utf-8"))
            if isinstance(parsed, list):
                cols[re.sub(r"\.json$", "", os.path.basename(file.filename))] = parsed
            else:
                cols = parsed
    except Exception:
        raise HTTPException(status_code=400, detail="File JSON/ZIP tidak dapat dibaca")
    cols = {k: v for k, v in cols.items() if re.match(r"^[a-z_]+$", k) and isinstance(v, list) and k not in SKIP_RESTORE}
    if not cols:
        raise HTTPException(status_code=400, detail="Tidak ada koleksi database di dalam file")
    if "users" in cols and not any(u.get("role") == "superadmin" for u in cols["users"]):
        cols["users"] = [u for u in cols["users"] if u.get("id") != admin["id"]] + [await db.users.find_one({"id": admin["id"]}, {"_id": 0})]
    for name, docs in cols.items():
        await db[name].delete_many({})
        if docs:
            await db[name].insert_many(docs)
    await log_event("restore", request, file.filename, admin, f"{len(cols)} koleksi dipulihkan")
    return {"ok": True, "collections": sorted(cols), "documents": sum(len(v) for v in cols.values())}


@router.post("/cron/monthly-backup")
async def cron_backup(request: Request):
    # Cron endpoints must ack 2xx immediately; enqueue/background the actual work.
    secret = os.environ.get("WEBHOOK_CRON_SECRET", "")
    auth = request.headers.get("authorization", "")
    if not secret or not auth.startswith("Bearer ") or not hmac.compare_digest(auth[7:], secret):
        raise HTTPException(status_code=401, detail="Unauthorized")
    try:
        body = await request.json()
    except Exception:
        body = {}
    if body is not None and not isinstance(body, dict):
        raise HTTPException(status_code=400, detail="Invalid body")
    run_id = request.headers.get("x-webhook-id") or (body or {}).get("run_id") or new_id()
    res = await db.cron_runs.update_one({"run_id": run_id}, {"$setOnInsert": {"run_id": run_id, "created_at": now_iso()}}, upsert=True)
    if res.upserted_id is not None:
        asyncio.create_task(_safe_backup())
    return {"accepted": True}


async def _safe_backup():
    try:
        await run_backup("otomatis")
    except Exception as e:
        logger.error(f"auto backup failed: {e}")


# ---------- Laporan profil ASN (Super Admin) ----------
@router.get("/admin/users/{uid}/report")
async def asn_report(uid: str, _=Depends(require_superadmin)):
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    u = await db.users.find_one({"id": uid}, {"_id": 0, "password_hash": 0})
    if not u:
        raise HTTPException(status_code=404, detail="Pengguna tidak ditemukan")
    enrolls = await db.enrollments.find({"user_id": uid}, {"_id": 0}).sort("started_at", 1).to_list(2000)
    courses = {c["id"]: c for c in await db.courses.find({"id": {"$in": [e["course_id"] for e in enrolls]}}, {"_id": 0, "id": 1, "title": 1, "kind": 1, "duration_hours": 1, "instructor": 1}).to_list(2000)}
    st = getSampleStyleSheet()
    P = lambda t: Paragraph(str(t), st["BodyText"])
    full = " ".join(x for x in [u.get("gelar_depan", ""), u.get("name", ""), ""] if x).strip() + (f", {u['gelar_belakang']}" if u.get("gelar_belakang") else "")
    prof = [["Nama", full], ["NIP", u.get("nip") or "-"], ["Email", f"{u.get('email') or '-'} ({'terverifikasi' if u.get('email_verified') else 'belum verifikasi'})"],
            ["No. WhatsApp", u.get("whatsapp") or "-"], ["Jabatan", u.get("jabatan") or "-"], ["Unit Kerja", u.get("unit_kerja") or "-"],
            ["Peran", u.get("role", "")], ["Status", "Aktif" if u.get("active", True) else "Nonaktif"], ["Terdaftar", (u.get("created_at") or "")[:10]]]
    total_jp = sum(float(courses.get(e["course_id"], {}).get("duration_hours") or 0) for e in enrolls if e["status"] == "completed")
    rows = [["No", "Kegiatan", "Jenis", "JP", "Status", "Nilai", "Mulai", "Selesai", "No. Sertifikat"]]
    for i, e in enumerate(enrolls, 1):
        c = courses.get(e["course_id"], {})
        rows.append([i, P(c.get("title", "(dihapus)")), "Webinar" if c.get("kind") == "zoom" else "Pelatihan", c.get("duration_hours", "-"),
                     "Selesai" if e["status"] == "completed" else "Berjalan", e.get("quiz_score") if e.get("quiz_score") is not None else "-",
                     (e.get("started_at") or "")[:10], (e.get("completed_at") or "-")[:10], P(e.get("certificate_no") or "-")])
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=30, rightMargin=30, topMargin=36, bottomMargin=36, title=f"Laporan ASN {u.get('name')}")
    t1 = Table([[a, P(b)] for a, b in prof], colWidths=[110, 420])
    t1.setStyle(TableStyle([("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"), ("FONTSIZE", (0, 0), (-1, -1), 9), ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#CBD5E1")),
                            ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#F1F5F9"))]))
    t2 = Table(rows, repeatRows=1, colWidths=[22, 140, 50, 26, 46, 32, 56, 56, 107])
    t2.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0F2942")), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"), ("FONTSIZE", (0, 0), (-1, -1), 7.5), ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#CBD5E1")), ("VALIGN", (0, 0), (-1, -1), "MIDDLE")]))
    story = [Paragraph("Laporan Profil & Riwayat Pembelajaran ASN", st["Title"]), Paragraph(f"LMS Khidmat Kota Dumai · dicetak {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M')} UTC · RAHASIA", st["Normal"]),
             Spacer(1, 12), t1, Spacer(1, 14),
             Paragraph(f"Ringkasan: {len(enrolls)} kegiatan diikuti · {sum(1 for e in enrolls if e['status'] == 'completed')} selesai · total {total_jp:g} JP", st["Heading4"]), Spacer(1, 6),
             t2 if len(rows) > 1 else Paragraph("Belum mengikuti kegiatan.", st["Normal"])]
    doc.build(story)
    return _file(buf.getvalue(), "pdf", f"laporan-asn-{u.get('nip') or u['id'][:8]}")


# ---------- Statistik pengunjung ----------
class VisitIn(BaseModel):
    visitor_id: str


@router.post("/public/visit")
async def public_visit(body: VisitIn):
    vid = re.sub(r"[^a-zA-Z0-9-]", "", body.visitor_id)[:64]
    if not vid:
        raise HTTPException(status_code=400, detail="visitor_id kosong")
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    await db.visits.update_one({"date": today, "visitor_id": vid}, {"$setOnInsert": {"date": today, "visitor_id": vid, "created_at": now_iso()}}, upsert=True)
    return {"ok": True}


async def visit_stats() -> dict:
    now = datetime.now(timezone.utc)
    days = [(now - timedelta(days=i)).strftime("%Y-%m-%d") for i in range(29, -1, -1)]
    agg = {x["_id"]: x["n"] for x in await db.visits.aggregate([{"$match": {"date": {"$gte": days[0]}}}, {"$group": {"_id": "$date", "n": {"$sum": 1}}}]).to_list(40)}
    views = await db.readings.aggregate([{"$match": {"status": "approved"}}, {"$group": {"_id": None, "v": {"$sum": "$views"}}}]).to_list(1)
    return {"today": agg.get(days[-1], 0), "last30": sum(agg.values()), "kms_views": (views[0]["v"] if views else 0),
            "kms_total": await db.readings.count_documents({"status": "approved"}), "total_visits": await db.visits.count_documents({}),
            "users": await db.users.count_documents({"active": True}), "daily": [{"date": d[5:], "kunjungan": agg.get(d, 0)} for d in days],
            "updated_at": now_iso()}


@router.get("/public/stats")
async def public_stats():
    return await visit_stats()


@router.get("/admin/reports/visits/export")
async def visits_export(_=Depends(require_admin)):
    s = await visit_stats()
    rows = [[i + 1, d["date"], d["kunjungan"]] for i, d in enumerate(s["daily"])]
    sub = (f"Kunjungan 30 hari terakhir: {s['last30']} · Hari ini: {s['today']} · Total dilihat repositori pengetahuan: {s['kms_views']} "
           f"({s['kms_total']} bacaan) · Dicetak {s['updated_at'][:16].replace('T', ' ')} UTC")
    return _file(_pdf("Statistik Aktivitas Pengguna Platform", sub, ["No", "Tanggal", "Kunjungan Landing Page"], rows), "pdf", "statistik-kunjungan")


# ---------- Learning hours ----------
@router.get("/admin/stats/learning-hours")
async def learning_hours(year: int, _=Depends(require_admin)):
    enrolls = await db.enrollments.find({"status": "completed", "completed_at": {"$regex": f"^{year}-"}}, {"_id": 0, "course_id": 1, "completed_at": 1, "user_id": 1}).to_list(None)
    hours = {c["id"]: float(c.get("duration_hours") or 0) for c in await db.courses.find({}, {"_id": 0, "id": 1, "duration_hours": 1}).to_list(None)}
    months = [{"month": m, "jam": 0.0, "kegiatan": 0, "peserta": set()} for m in range(1, 13)]
    for e in enrolls:
        m = months[int(e["completed_at"][5:7]) - 1]
        m["jam"] += hours.get(e["course_id"], 0)
        m["kegiatan"] += 1
        m["peserta"].add(e["user_id"])
    out = [{**m, "jam": round(m["jam"], 1), "peserta": len(m["peserta"])} for m in months]
    return {"year": year, "months": out, "total": round(sum(m["jam"] for m in out), 1)}


# ---------- Penandatangan ----------
@router.get("/signers")
async def list_signers(_=Depends(get_current_user)):
    s = await db.settings.find_one({"key": "main"}, {"_id": 0, "signers": 1}) or {}
    return [{k: x.get(k, "") for k in ("id", "name", "title", "pangkat", "nip")} for x in s.get("signers") or []]


class CertDesignIn(BaseModel):
    cert_layout: Dict[str, Any] = {}
    signers: List[Dict[str, Any]] = []


@router.put("/admin/cert-design")
async def save_cert_design(body: CertDesignIn, _=Depends(require_admin)):
    signers = []
    for x in body.signers:
        if not str(x.get("name", "")).strip():
            raise HTTPException(status_code=400, detail="Nama penandatangan wajib diisi")
        signers.append({"id": x.get("id") or new_id(), **{k: str(x.get(k, ""))[:200] for k in ("name", "title", "pangkat", "nip", "signature_path")}})
    upd = {"cert_layout": body.cert_layout, "signers": signers}
    if signers:
        upd.update({"signer_name": signers[0]["name"], "signer_title": signers[0]["title"], "signature_path": signers[0]["signature_path"]})
    await db.settings.update_one({"key": "main"}, {"$set": upd}, upsert=True)
    return await db.settings.find_one({"key": "main"}, {"_id": 0})


async def resolve_signer(settings: dict, signer_id: str = "") -> dict:
    signers = settings.get("signers") or []
    s = next((x for x in signers if x.get("id") == signer_id), None) or (signers[0] if signers else None)
    if s:
        return s
    return {"name": settings.get("signer_name", ""), "title": settings.get("signer_title", ""), "pangkat": "", "nip": "",
            "signature_path": settings.get("signature_path", "")}
