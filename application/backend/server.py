from dotenv import load_dotenv
from pathlib import Path
load_dotenv(Path(__file__).parent / ".env")

import os
import re
import random
import asyncio
import logging
from urllib.parse import urlparse
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any

import jwt
from fastapi import FastAPI, APIRouter, Request, Response, HTTPException, Depends, UploadFile, File, Query
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from core import (db, client, logger, APP_NAME, new_id, now_iso, hash_password, verify_password, set_auth_cookies,
                  public_user, get_current_user, require_admin, require_superadmin, is_admin, ADMIN_ROLES, client_ip,
                  init_storage, put_object, get_object, JWT_ALGORITHM)
from seed import seed_users, seed_content, DEFAULT_SETTINGS
from certificate import build_layout_certificate, format_cert_no, merge_layout
from extras import router as extras_router
from features import router as features_router, seed_psy
from portal import router as portal_router
from admin_ext import (router as ext_router, validate_password, check_upload, safe_filename, log_event, record_activity,
                       resolve_signer)

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")

app = FastAPI()
api = APIRouter(prefix="/api")
FRONTEND_URL = os.environ["FRONTEND_URL"]


# ---------- Models ----------
class LoginIn(BaseModel):
    identifier: str
    password: str


class ProfileIn(BaseModel):
    name: str
    gelar_depan: str = ""
    gelar_belakang: str = ""
    whatsapp: str = ""
    jabatan: str = ""
    unit_kerja: str = ""
    photo: str = ""


class PasswordIn(BaseModel):
    old_password: str
    new_password: str


class UserIn(BaseModel):
    name: str
    nip: str = ""
    email: str = ""
    role: str = "pegawai"
    gelar_depan: str = ""
    gelar_belakang: str = ""
    whatsapp: str = ""
    jabatan: str = ""
    unit_kerja: str = ""
    photo: str = ""
    active: bool = True
    password: Optional[str] = None


class CategoryIn(BaseModel):
    name: str
    type: str = "course"


class ModuleIn(BaseModel):
    id: Optional[str] = None
    title: str
    type: str = "text"
    url: str = ""
    body: str = ""
    duration_min: int = 10


class QuestionIn(BaseModel):
    id: Optional[str] = None
    question: str
    options: List[str]
    answer_index: int


class CertificateCfg(BaseModel):
    template_path: str = ""
    number_format: str = ""
    number_start: int = 1
    signer_name: str = ""
    signer_title: str = ""
    signature_path: str = ""
    text_color: str = "#0F172A"
    name_y: int = 52
    show_qr: bool = True


class CourseIn(BaseModel):
    title: str
    description: str = ""
    category_id: str = ""
    thumbnail: str = ""
    level: str = "Dasar"
    duration_hours: float = 1
    instructor: str = ""
    passing_score: int = 70
    published: bool = True
    modules: List[ModuleIn] = []
    questions: List[QuestionIn] = []
    kind: str = "course"
    certificate: CertificateCfg = CertificateCfg()
    start_at: str = ""
    zoom_url: str = ""
    meeting_id: str = ""
    passcode: str = ""
    materials: List[Dict[str, str]] = []
    signer_id: str = ""


class CertNoIn(BaseModel):
    certificate_no: str


class PreviewIn(BaseModel):
    title: str = "Judul Pelatihan"
    kind: str = "course"
    layout: Optional[Dict[str, Any]] = None
    signer_id: str = ""


class AttendanceIn(BaseModel):
    user_id: str
    present: bool


class QuizIn(BaseModel):
    answers: Dict[str, int]


class ReadingIn(BaseModel):
    title: str
    author: str = ""
    category_id: str = ""
    summary: str = ""
    content: str = ""
    cover: str = ""
    file_path: str = ""
    file_name: str = ""
    link_url: str = ""
    video_url: str = ""


class ReviewIn(BaseModel):
    status: str
    review_note: str = ""


class SettingsIn(BaseModel):
    app_name: str
    tagline: str = ""
    logo_path: str = ""
    cover_path: str = ""
    announcement: str = ""
    signer_name: str = ""
    signer_title: str = ""
    signature_path: str = ""
    landing: Dict[str, Any] = {}
    cert_layout: Dict[str, Any] = {}
    theme: Dict[str, Any] = {}
    social: Dict[str, Any] = {}
    cover_slides: List[str] = []
    slide_interval: int = 10
    welcome_logo_path: str = ""
    officials: List[Dict[str, Any]] = []


# ---------- Auth ----------
@api.post("/auth/login")
async def login(body: LoginIn, request: Request, response: Response):
    ident = body.identifier.strip().lower()
    user = await db.users.find_one({"$or": [{"email": ident}, {"nip": body.identifier.strip()}]})
    if not user or not verify_password(body.password, user["password_hash"]) or not user.get("active", True):
        await log_event("login_failed", request, ident, user)
        raise HTTPException(status_code=401, detail="NIP/email atau kata sandi salah")
    await db.users.update_one({"id": user["id"]}, {"$set": {"last_login": now_iso()}})
    await log_event("login_success", request, ident, user)
    set_auth_cookies(response, user["id"])
    return public_user(user)


@api.post("/auth/refresh")
async def refresh(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="Tidak ada sesi")
    try:
        payload = jwt.decode(token, os.environ["JWT_SECRET"], algorithms=[JWT_ALGORITHM])
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Sesi tidak valid")
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Sesi tidak valid")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user or not user.get("active", True):
        raise HTTPException(status_code=401, detail="Pengguna tidak ditemukan")
    set_auth_cookies(response, user["id"])
    return user


@api.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/", secure=False, samesite="lax")
    response.delete_cookie("refresh_token", path="/", secure=False, samesite="lax")
    return {"ok": True}


@api.get("/auth/me")
async def me(user=Depends(get_current_user)):
    return user


# ---------- Settings ----------
@api.get("/settings")
async def get_settings():
    s = await db.settings.find_one({"key": "main"}, {"_id": 0})
    return s or DEFAULT_SETTINGS


@api.put("/admin/settings")
async def update_settings(body: SettingsIn, _=Depends(require_superadmin)):
    await db.settings.update_one({"key": "main"}, {"$set": body.model_dump(exclude_unset=True)}, upsert=True)
    return await db.settings.find_one({"key": "main"}, {"_id": 0})


# ---------- Files ----------
MIME = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "webp": "image/webp", "gif": "image/gif",
        "pdf": "application/pdf", "mp4": "video/mp4", "webm": "video/webm", "svg": "image/svg+xml",
        "doc": "application/msword", "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "ppt": "application/vnd.ms-powerpoint", "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation"}
MAX_SIZE = 50 * 1024 * 1024


@api.post("/upload")
async def upload(file: UploadFile = File(...), kind: str = Query("private"), user=Depends(get_current_user)):
    ext = file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in MIME:
        raise HTTPException(status_code=400, detail="Jenis file tidak didukung")
    if kind == "public" and not is_admin(user):
        raise HTTPException(status_code=403, detail="Akses khusus admin")
    if ext == "svg" and not is_admin(user):
        raise HTTPException(status_code=400, detail="File SVG hanya dapat diunggah admin")
    data = await file.read()
    if len(data) > MAX_SIZE:
        raise HTTPException(status_code=400, detail="Ukuran file maksimal 50MB")
    check_upload(ext, data)
    original = safe_filename(file.filename)
    folder = "public" if kind == "public" else f"uploads/{user['id']}"
    path = f"{APP_NAME}/{folder}/{new_id()}.{ext}"
    try:
        result = await asyncio.to_thread(put_object, path, data, MIME[ext])
    except Exception as e:
        logger.error(f"upload failed: {e}")
        raise HTTPException(status_code=502, detail="Gagal mengunggah file")
    await db.files.insert_one({"id": new_id(), "storage_path": result["path"], "original_filename": original,
                               "content_type": MIME[ext], "size": len(data), "owner_id": user["id"],
                               "is_deleted": False, "created_at": now_iso()})
    return {"path": result["path"], "name": original}


@api.get("/files/{path:path}")
async def download(path: str, request: Request):
    if not path.startswith(f"{APP_NAME}/public/"):
        await get_current_user(request)
    record = await db.files.find_one({"storage_path": path, "is_deleted": False})
    if not record:
        raise HTTPException(status_code=404, detail="File tidak ditemukan")
    data, ct = await asyncio.to_thread(get_object, path)
    if data is None:
        raise HTTPException(status_code=404, detail="File fisik tidak ditemukan")
    ct_rec = record.get("content_type", ct)
    inline = ct_rec.startswith(("image/", "video/", "application/pdf")) and ct_rec != "image/svg+xml"
    headers = {"Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff",
               "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
               "Content-Disposition": f'{"inline" if inline else "attachment"}; filename="{safe_filename(record["original_filename"])}"'}
    return Response(content=data, media_type=record.get("content_type", ct), headers=headers)


# ---------- Profile ----------
@api.put("/profile")
async def update_profile(body: ProfileIn, user=Depends(get_current_user)):
    if not body.name.strip():
        raise HTTPException(status_code=400, detail="Nama wajib diisi")
    d = {k: v.strip()[:150] if isinstance(v, str) else v for k, v in body.model_dump().items()}
    if d["whatsapp"] and not re.match(r"^\+?[0-9 \-]{9,16}$", d["whatsapp"]):
        raise HTTPException(status_code=400, detail="Format nomor WhatsApp tidak valid (contoh: 081234567890)")
    await db.users.update_one({"id": user["id"]}, {"$set": d})
    return await db.users.find_one({"id": user["id"]}, {"_id": 0, "password_hash": 0})


@api.put("/profile/password")
async def change_password(body: PasswordIn, request: Request, user=Depends(get_current_user)):
    full = await db.users.find_one({"id": user["id"]})
    if not verify_password(body.old_password, full["password_hash"]):
        raise HTTPException(status_code=400, detail="Kata sandi lama salah")
    validate_password(body.new_password, full)
    if verify_password(body.new_password, full["password_hash"]):
        raise HTTPException(status_code=400, detail="Kata sandi baru harus berbeda dari kata sandi lama")
    await db.users.update_one({"id": user["id"]}, {"$set": {"password_hash": hash_password(body.new_password), "must_change_password": False,
                                                           "password_changed_at": now_iso()}})
    await log_event("password_changed", request, user.get("email") or user.get("nip", ""), user)
    return await db.users.find_one({"id": user["id"]}, {"_id": 0, "password_hash": 0})


# ---------- Categories ----------
@api.get("/categories")
async def list_categories(type: Optional[str] = None, _=Depends(get_current_user)):
    q = {"type": type} if type else {}
    return await db.categories.find(q, {"_id": 0}).sort("name", 1).to_list(500)


@api.post("/admin/categories")
async def create_category(body: CategoryIn, _=Depends(require_admin)):
    doc = {"id": new_id(), **body.model_dump(), "created_at": now_iso()}
    await db.categories.insert_one(dict(doc))
    return doc


@api.put("/admin/categories/{cid}")
async def update_category(cid: str, body: CategoryIn, _=Depends(require_admin)):
    await db.categories.update_one({"id": cid}, {"$set": body.model_dump()})
    return await db.categories.find_one({"id": cid}, {"_id": 0})


@api.delete("/admin/categories/{cid}")
async def delete_category(cid: str, _=Depends(require_admin)):
    await db.categories.delete_one({"id": cid})
    return {"ok": True}


# ---------- Courses (user) ----------
def course_summary(c: dict) -> dict:
    out = {k: v for k, v in c.items() if k not in ("modules", "questions", "_id")}
    out["module_count"] = len(c.get("modules", []))
    out["question_count"] = len(c.get("questions", []))
    return out


def progress_of(c: dict, e: Optional[dict]) -> int:
    if not e:
        return 0
    if e["status"] == "completed":
        return 100
    total = len(c.get("modules", [])) + (1 if c.get("questions") else 0)
    done = len([m for m in c.get("modules", []) if m["id"] in e.get("completed_modules", [])])
    return int(done * 100 / total) if total else 0


async def cat_map():
    return {c["id"]: c["name"] for c in await db.categories.find({}, {"_id": 0}).to_list(500)}


@api.get("/courses")
async def list_courses(search: str = "", category_id: str = "", user=Depends(get_current_user)):
    q = {"published": True, "kind": "course", "status": "approved"}
    if search:
        q["title"] = {"$regex": re.escape(search), "$options": "i"}
    if category_id:
        q["category_id"] = category_id
    courses = await db.courses.find(q, {"_id": 0}).sort("created_at", -1).to_list(500)
    enrolls = {e["course_id"]: e for e in await db.enrollments.find({"user_id": user["id"]}, {"_id": 0}).to_list(1000)}
    cats = await cat_map()
    out = []
    for c in courses:
        s = course_summary(c)
        e = enrolls.get(c["id"])
        s["category_name"] = cats.get(c.get("category_id"), "")
        s["enrollment_status"] = e["status"] if e else None
        s["progress"] = progress_of(c, e)
        s["participants"] = await db.enrollments.count_documents({"course_id": c["id"]})
        out.append(s)
    return out


@api.get("/courses/{course_id}")
async def get_course(course_id: str, user=Depends(get_current_user)):
    c = await db.courses.find_one({"id": course_id}, {"_id": 0})
    visible = c and c.get("published") and c.get("status") == "approved"
    if not c or (not visible and not is_admin(user) and c.get("proposed_by") != user["id"]):
        raise HTTPException(status_code=404, detail="Pelatihan tidak ditemukan")
    e = await db.enrollments.find_one({"user_id": user["id"], "course_id": course_id}, {"_id": 0})
    if not e and not is_admin(user):
        c.pop("zoom_url", None)
        c.pop("passcode", None)
    cats = await cat_map()
    c["category_name"] = cats.get(c.get("category_id"), "")
    qs = []
    for q in c.get("questions", []):
        order = list(range(len(q["options"])))
        random.shuffle(order)
        qs.append({"id": q["id"], "question": q["question"], "options": [q["options"][i] for i in order], "option_ids": order})
    random.shuffle(qs)
    c["questions"] = qs
    c["enrollment"] = e
    c["progress"] = progress_of(c, e)
    c["participants"] = await db.enrollments.count_documents({"course_id": course_id})
    return c


@api.post("/courses/{course_id}/enroll")
async def enroll(course_id: str, user=Depends(get_current_user)):
    if user["role"] == "pic":
        raise HTTPException(status_code=403, detail="Akun PIC hanya dapat melihat kursus dan mengusulkan, tidak dapat mengikuti kursus")
    c = await db.courses.find_one({"id": course_id, "published": True, "status": "approved"})
    if not c:
        raise HTTPException(status_code=404, detail="Pelatihan tidak ditemukan")
    e = await db.enrollments.find_one({"user_id": user["id"], "course_id": course_id}, {"_id": 0})
    if e:
        return e
    doc = {"id": new_id(), "user_id": user["id"], "course_id": course_id, "completed_modules": [], "status": "ongoing",
           "quiz_score": None, "quiz_attempts": 0, "started_at": now_iso(), "completed_at": None, "certificate_no": None}
    await db.enrollments.insert_one(dict(doc))
    return doc


async def _get_enrollment(user, course_id):
    e = await db.enrollments.find_one({"user_id": user["id"], "course_id": course_id}, {"_id": 0})
    if not e:
        raise HTTPException(status_code=400, detail="Anda belum terdaftar di pelatihan ini")
    return e


async def _issue_certificate(e: dict, score: int):
    claimed = await db.enrollments.update_one({"id": e["id"], "status": {"$ne": "completed"}}, {"$set": {"status": "issuing"}})
    if not claimed.modified_count:
        return
    try:
        await _assign_certificate(e, score)
    except Exception:
        await db.enrollments.update_one({"id": e["id"]}, {"$set": {"status": e["status"]}})
        raise


async def _assign_certificate(e: dict, score: int):
    now = datetime.now(timezone.utc)
    c = await db.courses.find_one({"id": e["course_id"]}, {"_id": 0, "certificate": 1})
    cfg = (c or {}).get("certificate") or {}
    if e.get("prev_certificate_no"):
        cert_no = e["prev_certificate_no"]
    else:
        while True:
            if cfg.get("number_format"):
                seq = await db.counters.find_one_and_update({"key": f"cert-course-{e['course_id']}"}, {"$inc": {"seq": 1}}, upsert=True, return_document=True)
                cert_no = format_cert_no(cfg["number_format"], int(cfg.get("number_start") or 1) - 1 + seq["seq"], now)
            else:
                seq = await db.counters.find_one_and_update({"key": f"cert-{now.year}"}, {"$inc": {"seq": 1}}, upsert=True, return_document=True)
                cert_no = f"LMSKD/{now.year}/{seq['seq']:05d}"
            if not await db.enrollments.find_one({"certificate_no": cert_no}, {"_id": 1}):
                break
    await db.enrollments.update_one({"id": e["id"]}, {"$set": {"status": "completed", "completed_at": now_iso(),
                                                               "certificate_no": cert_no, "quiz_score": score}})


@api.post("/courses/{course_id}/modules/{module_id}/complete")
async def complete_module(course_id: str, module_id: str, user=Depends(get_current_user)):
    c = await db.courses.find_one({"id": course_id}, {"_id": 0})
    if not c or module_id not in [m["id"] for m in c.get("modules", [])]:
        raise HTTPException(status_code=404, detail="Materi tidak ditemukan")
    e = await _get_enrollment(user, course_id)
    await db.enrollments.update_one({"id": e["id"]}, {"$addToSet": {"completed_modules": module_id}})
    e = await db.enrollments.find_one({"id": e["id"]}, {"_id": 0})
    all_done = all(m["id"] in e["completed_modules"] for m in c["modules"])
    if all_done and not c.get("questions") and e["status"] != "completed":
        await _issue_certificate(e, 100)
        e = await db.enrollments.find_one({"id": e["id"]}, {"_id": 0})
    return e


@api.post("/courses/{course_id}/quiz")
async def submit_quiz(course_id: str, body: QuizIn, user=Depends(get_current_user)):
    c = await db.courses.find_one({"id": course_id}, {"_id": 0})
    if not c or not c.get("questions"):
        raise HTTPException(status_code=404, detail="Kuis tidak tersedia")
    e = await _get_enrollment(user, course_id)
    if e["status"] == "completed":
        raise HTTPException(status_code=400, detail="Pelatihan sudah selesai")
    if not all(m["id"] in e.get("completed_modules", []) for m in c.get("modules", [])):
        raise HTTPException(status_code=400, detail="Selesaikan semua materi terlebih dahulu")
    qs = c["questions"]
    correct = sum(1 for q in qs if body.answers.get(q["id"]) == q["answer_index"])
    score = round(correct * 100 / len(qs))
    passed = score >= c.get("passing_score", 70)
    await db.enrollments.update_one({"id": e["id"]}, {"$inc": {"quiz_attempts": 1}, "$set": {"quiz_score": score}})
    if passed:
        await _issue_certificate(e, score)
    e = await db.enrollments.find_one({"id": e["id"]}, {"_id": 0})
    return {"score": score, "correct": correct, "total": len(qs), "passed": passed,
            "passing_score": c.get("passing_score", 70), "enrollment": e}


@api.get("/my/enrollments")
async def my_enrollments(status: Optional[str] = None, user=Depends(get_current_user)):
    q = {"user_id": user["id"]}
    if status:
        q["status"] = status
    enrolls = await db.enrollments.find(q, {"_id": 0}).sort("started_at", -1).to_list(500)
    cats = await cat_map()
    out = []
    for e in enrolls:
        c = await db.courses.find_one({"id": e["course_id"]}, {"_id": 0})
        if not c:
            continue
        s = course_summary(c)
        s["category_name"] = cats.get(c.get("category_id"), "")
        out.append({**e, "course": s, "progress": progress_of(c, e)})
    return out


@api.get("/my/dashboard")
async def my_dashboard(user=Depends(get_current_user)):
    enrolls = await my_enrollments(None, user)
    readings = await db.readings.find({"status": "approved"}, {"_id": 0, "content": 0}).sort("created_at", -1).to_list(4)
    return {
        "ongoing": [e for e in enrolls if e["status"] == "ongoing"],
        "completed": [e for e in enrolls if e["status"] == "completed"],
        "readings": readings,
        "reading_total": await db.readings.count_documents({"status": "approved"}),
        "my_proposals": await db.readings.count_documents({"proposed_by": user["id"]}),
    }


# ---------- Certificates ----------
async def _stored_bytes(path: str):
    if not path or path.startswith(("/", "http")):
        return None
    try:
        data, _ = await asyncio.to_thread(get_object, path)
        return data
    except Exception:
        return None


async def _render_cert(*, kind: str, name: str, nip: str, title: str, score, completed_at: str, cert_no: str, verify_url: str,
                       layout: Optional[dict] = None, signer_id: str = "") -> bytes:
    s = await db.settings.find_one({"key": "main"}, {"_id": 0}) or DEFAULT_SETTINGS
    lay = merge_layout(layout if layout is not None else s.get("cert_layout"))
    logos = [await _stored_bytes(lg.get("path", "")) for lg in lay["logos"]]
    sg = await resolve_signer(s, signer_id)
    return build_layout_certificate(layout=lay, app_name=s.get("app_name", ""), name=name, nip=nip, course_title=title, score=score,
                                    completed_at=completed_at, cert_no=cert_no, verify_url=verify_url,
                                    signer_name=sg.get("name", ""), signer_title=sg.get("title", ""),
                                    signer_pangkat=sg.get("pangkat", ""), signer_nip=sg.get("nip", ""),
                                    template_bytes=await _stored_bytes(lay.get("template_path", "")),
                                    signature_bytes=await _stored_bytes(sg.get("signature_path", "")), logo_images=logos, activity_kind=kind)


def _full_name(u: dict) -> str:
    n = " ".join(x for x in [u.get("gelar_depan", "").strip(), u.get("name", "")] if x)
    return f"{n}, {u['gelar_belakang'].strip()}" if u.get("gelar_belakang", "").strip() else n


async def _cert_pdf(e: dict) -> bytes:
    u = await db.users.find_one({"id": e["user_id"]}, {"_id": 0})
    c = await db.courses.find_one({"id": e["course_id"]}, {"_id": 0}) or {}
    kind = c.get("kind", "course")
    score = None if kind == "zoom" else (e.get("quiz_score") or 100)
    return await _render_cert(kind=kind, name=_full_name(u) if u else "-", nip=(u or {}).get("nip", ""),
                              title=c.get("title", "-"), score=score, completed_at=e["completed_at"], cert_no=e["certificate_no"],
                              verify_url=f"{FRONTEND_URL}/verifikasi/{e['id']}", signer_id=c.get("signer_id", ""))


@api.post("/certificates/preview")
async def certificate_preview(body: PreviewIn, user=Depends(require_admin)):
    now = datetime.now(timezone.utc)
    no = f"001/BKPSDM-DMI/{['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'][now.month - 1]}/{now.year}"
    pdf = await _render_cert(layout=body.layout, kind=body.kind, name=user["name"], nip=user.get("nip", ""), title=body.title or "Judul Pelatihan",
                             score=None if body.kind == "zoom" else 100, completed_at=now.isoformat(), cert_no=no,
                             verify_url=f"{FRONTEND_URL}/verifikasi/contoh", signer_id=body.signer_id)
    return Response(content=pdf, media_type="application/pdf", headers={"Content-Disposition": 'inline; filename="pratinjau-sertifikat.pdf"'})


@api.patch("/admin/certificates/{enrollment_id}")
async def edit_certificate_no(enrollment_id: str, body: CertNoIn, _=Depends(require_admin)):
    no = body.certificate_no.strip()
    if not no:
        raise HTTPException(status_code=400, detail="Nomor sertifikat wajib diisi")
    if await db.enrollments.find_one({"certificate_no": no, "id": {"$ne": enrollment_id}}):
        raise HTTPException(status_code=400, detail="Nomor sertifikat sudah dipakai")
    res = await db.enrollments.update_one({"id": enrollment_id, "status": "completed"}, {"$set": {"certificate_no": no}})
    if not res.matched_count:
        raise HTTPException(status_code=404, detail="Sertifikat tidak ditemukan")
    return {"ok": True, "certificate_no": no}


@api.get("/certificates/{enrollment_id}/pdf")
async def certificate_pdf(enrollment_id: str, user=Depends(get_current_user)):
    e = await db.enrollments.find_one({"id": enrollment_id}, {"_id": 0})
    if not e or e["status"] != "completed":
        raise HTTPException(status_code=404, detail="Sertifikat tidak ditemukan")
    if e["user_id"] != user["id"] and not is_admin(user) and not await db.courses.find_one({"id": e["course_id"], "proposed_by": user["id"]}, {"_id": 1}):
        raise HTTPException(status_code=403, detail="Tidak diizinkan")
    if e["user_id"] == user["id"] and not is_admin(user) and await db.courses.find_one({"id": e["course_id"], "kind": "zoom"}, {"_id": 1}) \
            and not await db.evaluations.find_one({"course_id": e["course_id"], "user_id": user["id"]}, {"_id": 1}):
        raise HTTPException(status_code=403, detail="Isi Evaluasi Webinar terlebih dahulu untuk membuka sertifikat")
    pdf = await _cert_pdf(e)
    fname = e["certificate_no"].replace("/", "-")
    return Response(content=pdf, media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="Sertifikat-{fname}.pdf"'})


@api.get("/verify/{enrollment_id}")
async def verify_certificate(enrollment_id: str):
    e = await db.enrollments.find_one({"id": enrollment_id, "status": "completed"}, {"_id": 0})
    if not e:
        raise HTTPException(status_code=404, detail="Sertifikat tidak valid")
    u = await db.users.find_one({"id": e["user_id"]}, {"_id": 0})
    c = await db.courses.find_one({"id": e["course_id"]}, {"_id": 0})
    return {"certificate_no": e["certificate_no"], "name": u["name"] if u else "-", "course_title": c["title"] if c else "-",
            "kind": (c or {}).get("kind", "course"),
            "completed_at": e["completed_at"], "score": e.get("quiz_score")}


# ---------- Readings (KMS) ----------
@api.get("/readings")
async def list_readings(search: str = "", category_id: str = "", _=Depends(get_current_user)):
    q = {"status": "approved"}
    if search:
        q["title"] = {"$regex": re.escape(search), "$options": "i"}
    if category_id:
        q["category_id"] = category_id
    items = await db.readings.find(q, {"_id": 0, "content": 0}).sort("created_at", -1).to_list(500)
    cats = await cat_map()
    for r in items:
        r["category_name"] = cats.get(r.get("category_id"), "")
    return items


@api.get("/readings/mine")
async def my_readings(user=Depends(get_current_user)):
    return await db.readings.find({"proposed_by": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)


@api.get("/readings/{rid}")
async def get_reading(rid: str, user=Depends(get_current_user)):
    r = await db.readings.find_one({"id": rid}, {"_id": 0})
    if not r or (r["status"] != "approved" and not is_admin(user) and r.get("proposed_by") != user["id"]):
        raise HTTPException(status_code=404, detail="Bacaan tidak ditemukan")
    if not is_admin(user) and r.get("proposed_by") != user["id"]:
        await db.readings.update_one({"id": rid}, {"$inc": {"views": 1}})
    r["category_name"] = (await cat_map()).get(r.get("category_id"), "")
    return r


@api.post("/readings")
async def propose_reading(body: ReadingIn, user=Depends(get_current_user)):
    if not body.title.strip():
        raise HTTPException(status_code=400, detail="Judul wajib diisi")
    if user["role"] not in (*ADMIN_ROLES, "pic"):
        raise HTTPException(status_code=403, detail="Usulan hanya dapat dikirim oleh akun PIC OPD")
    adm = is_admin(user)
    doc = {"id": new_id(), **body.model_dump(), "status": "approved" if adm else "pending",
           "proposed_by": None if adm else user["id"], "proposer_name": user["name"], "review_note": "",
           "views": 0, "created_at": now_iso()}
    await db.readings.insert_one(dict(doc))
    return doc


@api.get("/admin/readings")
async def admin_readings(status: Optional[str] = None, _=Depends(require_admin)):
    q = {"status": status} if status else {}
    items = await db.readings.find(q, {"_id": 0}).sort("created_at", -1).to_list(1000)
    cats = await cat_map()
    for r in items:
        r["category_name"] = cats.get(r.get("category_id"), "")
    return items


@api.put("/admin/readings/{rid}")
async def update_reading(rid: str, body: ReadingIn, _=Depends(require_admin)):
    await db.readings.update_one({"id": rid}, {"$set": body.model_dump()})
    return await db.readings.find_one({"id": rid}, {"_id": 0})


@api.patch("/admin/readings/{rid}/review")
async def review_reading(rid: str, body: ReviewIn, _=Depends(require_admin)):
    if body.status not in ("approved", "rejected", "pending"):
        raise HTTPException(status_code=400, detail="Status tidak valid")
    await db.readings.update_one({"id": rid}, {"$set": body.model_dump()})
    return await db.readings.find_one({"id": rid}, {"_id": 0})


@api.delete("/admin/readings/{rid}")
async def delete_reading(rid: str, _=Depends(require_admin)):
    await db.readings.delete_one({"id": rid})
    return {"ok": True}


# ---------- Admin: courses ----------
def _course_doc(body: CourseIn) -> dict:
    d = body.model_dump()
    for m in d["modules"]:
        m["id"] = m.get("id") or new_id()
    for q in d["questions"]:
        q["id"] = q.get("id") or new_id()
        if not (0 <= q["answer_index"] < len(q["options"])):
            raise HTTPException(status_code=400, detail=f"Kunci jawaban tidak valid: {q['question'][:40]}")
    if not d["title"].strip():
        raise HTTPException(status_code=400, detail="Judul wajib diisi")
    if not d["instructor"].strip():
        raise HTTPException(status_code=400, detail="Nama pengajar / narasumber wajib diisi (mis. Dinas Kominfo)")
    if d["kind"] not in ("course", "zoom"):
        raise HTTPException(status_code=400, detail="Jenis tidak valid")
    if d["kind"] == "zoom":
        if not d["start_at"]:
            raise HTTPException(status_code=400, detail="Jadwal webinar wajib diisi")
        d["modules"], d["questions"] = [], []
    return d


@api.get("/admin/courses")
async def admin_courses(kind: str = "course", status: Optional[str] = None, _=Depends(require_admin)):
    q = {"kind": kind}
    if status:
        q["status"] = status
    courses = await db.courses.find(q, {"_id": 0}).sort("created_at", -1).to_list(1000)
    cats = await cat_map()
    out = []
    for c in courses:
        s = course_summary(c)
        s["category_name"] = cats.get(c.get("category_id"), "")
        s["participants"] = await db.enrollments.count_documents({"course_id": c["id"]})
        s["completed"] = await db.enrollments.count_documents({"course_id": c["id"], "status": "completed"})
        out.append(s)
    return out


@api.get("/admin/courses/{cid}")
async def admin_course(cid: str, _=Depends(require_admin)):
    c = await db.courses.find_one({"id": cid}, {"_id": 0})
    if not c:
        raise HTTPException(status_code=404, detail="Pelatihan tidak ditemukan")
    return c


@api.post("/admin/courses")
async def create_course(body: CourseIn, _=Depends(require_admin)):
    doc = {"id": new_id(), **_course_doc(body), "status": "approved", "proposed_by": None, "proposer_name": "",
           "review_note": "", "created_at": now_iso()}
    await db.courses.insert_one(dict(doc))
    return doc


@api.patch("/admin/courses/{cid}/review")
async def review_course(cid: str, body: ReviewIn, _=Depends(require_admin)):
    if body.status not in ("approved", "rejected"):
        raise HTTPException(status_code=400, detail="Status tidak valid")
    c = await db.courses.find_one({"id": cid}, {"_id": 0})
    if not c:
        raise HTTPException(status_code=404, detail="Pelatihan tidak ditemukan")
    if body.status == "approved" and c.get("kind") == "zoom" and not c.get("zoom_url"):
        raise HTTPException(status_code=400, detail="Isi tautan Zoom terlebih dahulu sebelum menyetujui")
    await db.courses.update_one({"id": cid}, {"$set": {"status": body.status, "review_note": body.review_note,
                                                     "published": body.status == "approved"}})
    return await db.courses.find_one({"id": cid}, {"_id": 0})


async def _can_manage(cid: str, user: dict) -> dict:
    c = await db.courses.find_one({"id": cid}, {"_id": 0})
    if not c or not (is_admin(user) or (user["role"] == "pic" and c.get("proposed_by") == user["id"])):
        raise HTTPException(status_code=404, detail="Kegiatan tidak ditemukan")
    return c


@api.get("/admin/courses/{cid}/participants")
async def course_participants(cid: str, user=Depends(get_current_user)):
    await _can_manage(cid, user)
    enrolls = await db.enrollments.find({"course_id": cid}, {"_id": 0}).sort("started_at", 1).to_list(5000)
    ids = [e["user_id"] for e in enrolls]
    users = {u["id"]: u for u in await db.users.find({"id": {"$in": ids}}, {"_id": 0, "password_hash": 0}).to_list(5000)}
    return [{**e, "user_name": users.get(e["user_id"], {}).get("name", "-"), "nip": users.get(e["user_id"], {}).get("nip", ""),
             "unit_kerja": users.get(e["user_id"], {}).get("unit_kerja", "")} for e in enrolls]


@api.post("/admin/courses/{cid}/attendance")
async def set_attendance(cid: str, body: AttendanceIn, user=Depends(get_current_user)):
    c = await _can_manage(cid, user)
    if c.get("kind") != "zoom":
        raise HTTPException(status_code=404, detail="Webinar tidak ditemukan")
    e = await db.enrollments.find_one({"course_id": cid, "user_id": body.user_id}, {"_id": 0})
    if not e:
        raise HTTPException(status_code=404, detail="Peserta tidak terdaftar")
    if body.present:
        await _issue_certificate(e, 100)
    else:
        await db.enrollments.update_one({"id": e["id"]}, {"$set": {"status": "ongoing", "completed_at": None, "certificate_no": None,
                                                                   "prev_certificate_no": e.get("certificate_no") or e.get("prev_certificate_no")}})
    return await db.enrollments.find_one({"id": e["id"]}, {"_id": 0})


# ---------- Zoom (pegawai) ----------
@api.get("/zoom")
async def list_zoom(user=Depends(get_current_user)):
    items = await db.courses.find({"kind": "zoom", "status": "approved", "published": True}, {"_id": 0}).sort("start_at", -1).to_list(500)
    enrolls = {e["course_id"]: e for e in await db.enrollments.find({"user_id": user["id"]}, {"_id": 0}).to_list(2000)}
    evaluated = {x["course_id"] for x in await db.evaluations.find({"user_id": user["id"]}, {"_id": 0, "course_id": 1}).to_list(2000)}
    cats = await cat_map()
    out = []
    for c in items:
        e = enrolls.get(c["id"])
        s_eval = c["id"] in evaluated
        s = course_summary(c)
        if not e:
            s.pop("zoom_url", None)
            s.pop("passcode", None)
        s.pop("certificate", None)
        s["category_name"] = cats.get(c.get("category_id"), "")
        s["enrollment"] = e
        s["evaluated"] = s_eval
        s.pop("evaluation_questions", None)
        s["participants"] = await db.enrollments.count_documents({"course_id": c["id"]})
        out.append(s)
    return out


# ---------- Proposals (PIC OPD) ----------
async def require_pic(user=Depends(get_current_user)):
    if user["role"] != "pic":
        raise HTTPException(status_code=403, detail="Fitur usulan khusus akun PIC OPD")
    return user


@api.get("/proposals/mine")
async def my_proposals(user=Depends(require_pic)):
    items = await db.courses.find({"proposed_by": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(500)
    return [course_summary(c) for c in items]


@api.get("/proposals/{cid}")
async def get_proposal(cid: str, user=Depends(require_pic)):
    c = await db.courses.find_one({"id": cid, "proposed_by": user["id"]}, {"_id": 0})
    if not c:
        raise HTTPException(status_code=404, detail="Usulan tidak ditemukan")
    return c


@api.post("/proposals")
async def create_proposal(body: CourseIn, user=Depends(require_pic)):
    d = _course_doc(body)
    d["certificate"] = CertificateCfg().model_dump()
    d["published"] = False
    doc = {"id": new_id(), **d, "status": "pending", "proposed_by": user["id"], "proposer_name": user["name"],
           "review_note": "", "created_at": now_iso()}
    await db.courses.insert_one(dict(doc))
    return doc


@api.put("/proposals/{cid}")
async def update_proposal(cid: str, body: CourseIn, user=Depends(require_pic)):
    c = await db.courses.find_one({"id": cid, "proposed_by": user["id"]}, {"_id": 0})
    if not c:
        raise HTTPException(status_code=404, detail="Usulan tidak ditemukan")
    if c["status"] == "approved":
        raise HTTPException(status_code=400, detail="Usulan yang sudah disetujui hanya dapat diubah admin")
    d = _course_doc(body)
    d["certificate"] = c.get("certificate") or CertificateCfg().model_dump()
    d.update({"published": False, "status": "pending", "review_note": ""})
    await db.courses.update_one({"id": cid}, {"$set": d})
    return await db.courses.find_one({"id": cid}, {"_id": 0})


@api.put("/admin/courses/{cid}")
async def update_course(cid: str, body: CourseIn, _=Depends(require_admin)):
    res = await db.courses.update_one({"id": cid}, {"$set": _course_doc(body)})
    if not res.matched_count:
        raise HTTPException(status_code=404, detail="Pelatihan tidak ditemukan")
    return await db.courses.find_one({"id": cid}, {"_id": 0})


@api.delete("/admin/courses/{cid}")
async def delete_course(cid: str, _=Depends(require_admin)):
    await db.courses.delete_one({"id": cid})
    await db.enrollments.delete_many({"course_id": cid, "status": "ongoing"})
    return {"ok": True}


# ---------- Admin: users ----------
async def _check_unique(body: UserIn, exclude_id: Optional[str] = None):
    ex = {"id": {"$ne": exclude_id}} if exclude_id else {}
    if body.email and await db.users.find_one({"email": body.email.lower(), **ex}):
        raise HTTPException(status_code=400, detail="Email sudah digunakan")
    if body.nip and await db.users.find_one({"nip": body.nip, **ex}):
        raise HTTPException(status_code=400, detail="NIP sudah digunakan")
    if not body.email and not body.nip:
        raise HTTPException(status_code=400, detail="Isi NIP atau email")
    if body.role not in ("superadmin", "admin", "pegawai", "pic"):
        raise HTTPException(status_code=400, detail="Peran tidak valid")
    if body.email and not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", body.email):
        raise HTTPException(status_code=400, detail="Format email tidak valid")
    if body.role == "pic":
        if not body.unit_kerja.strip():
            raise HTTPException(status_code=400, detail="Akun PIC wajib mengisi OPD / Unit Kerja")
        rx = {"$regex": f"^{re.escape(body.unit_kerja.strip())}$", "$options": "i"}
        if await db.users.find_one({"role": "pic", "unit_kerja": rx, **ex}):
            raise HTTPException(status_code=400, detail="OPD ini sudah memiliki akun PIC (1 akun PIC per OPD)")


def _users_query(search: str = "", unit: str = "") -> dict:
    q = {}
    if search:
        rx = {"$regex": re.escape(search.strip()), "$options": "i"}
        q["$or"] = [{"name": rx}, {"nip": rx}, {"email": rx}, {"jabatan": rx}]
    if unit.strip():
        q["unit_kerja"] = {"$regex": re.escape(unit.strip()), "$options": "i"}
    return q


@api.get("/admin/users/opd")
async def admin_users_opd(_=Depends(require_admin)):
    counts: Dict[str, int] = {}
    for u in await db.users.find({}, {"_id": 0, "unit_kerja": 1}).to_list(None):
        name = (u.get("unit_kerja") or "").strip()
        if name:
            counts[name] = counts.get(name, 0) + 1
    return [{"name": k, "count": v} for k, v in sorted(counts.items(), key=lambda x: x[0].lower())]


@api.get("/admin/users")
async def admin_users(search: str = "", unit: str = "", _=Depends(require_admin)):
    q = _users_query(search, unit)
    users = await db.users.find(q, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(2000)
    for u in users:
        u["completed_count"] = await db.enrollments.count_documents({"user_id": u["id"], "status": "completed"})
        u["ongoing_count"] = await db.enrollments.count_documents({"user_id": u["id"], "status": "ongoing"})
    return users


def _guard_role(admin: dict, role: str, target: Optional[dict] = None):
    if admin["role"] != "superadmin" and (role == "superadmin" or (target or {}).get("role") == "superadmin"):
        raise HTTPException(status_code=403, detail="Hanya Super Admin yang dapat mengelola akun Super Admin")


NEW_ACCOUNT = {"must_change_password": True, "require_photo": True, "email_verified": False}


@api.post("/admin/users")
async def create_user(body: UserIn, admin=Depends(require_admin)):
    _guard_role(admin, body.role)
    await _check_unique(body)
    if not body.password or len(body.password) < 6:
        raise HTTPException(status_code=400, detail="Kata sandi awal (default) minimal 6 karakter")
    d = body.model_dump(exclude={"password"})
    d["email"] = d["email"].lower()
    doc = {"id": new_id(), **d, **NEW_ACCOUNT, "password_hash": hash_password(body.password), "created_at": now_iso()}
    await db.users.insert_one(dict(doc))
    return public_user(doc)


IMPORT_COLS = ["Nama", "NIP", "Email", "Jabatan", "Unit Kerja", "Peran", "Kata Sandi"]
ROLE_MAP = {"pegawai": "pegawai", "pic": "pic", "pic opd": "pic", "admin": "admin"}


@api.get("/admin/users/import-template")
async def import_template(_=Depends(require_admin)):
    import io
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill
    wb = Workbook()
    ws = wb.active
    ws.title = "Pegawai"
    ws.append(IMPORT_COLS)
    for c in ws[1]:
        c.font = Font(bold=True, color="FFFFFF")
        c.fill = PatternFill("solid", fgColor="0F2942")
    ws.append(["Contoh Nama Pegawai", "199001012020011001", "contoh@dumaikota.go.id", "Analis", "Dinas Kominfo", "pegawai", ""])
    for col, w in zip("ABCDEFG", [30, 22, 30, 22, 26, 12, 16]):
        ws.column_dimensions[col].width = w
    for r in range(2, 2002):
        ws.cell(row=r, column=2).number_format = "@"
        ws.cell(row=r, column=7).number_format = "@"
    buf = io.BytesIO()
    wb.save(buf)
    return Response(content=buf.getvalue(), media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    headers={"Content-Disposition": 'attachment; filename="template-impor-pegawai.xlsx"'})


@api.get("/admin/users/export")
async def export_users(search: str = "", unit: str = "", _=Depends(require_admin)):
    import io
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill
    users = await db.users.find(_users_query(search, unit), {"_id": 0, "password_hash": 0}).sort("name", 1).to_list(None)
    done = {}
    async for e in db.enrollments.find({"status": "completed"}, {"_id": 0, "user_id": 1}):
        done[e["user_id"]] = done.get(e["user_id"], 0) + 1
    wb = Workbook()
    ws = wb.active
    ws.title = "Pegawai"
    ws.append(["Nama", "NIP", "Email", "Jabatan", "Unit Kerja", "Peran", "Status", "Pelatihan Selesai", "Terdaftar"])
    for c in ws[1]:
        c.font = Font(bold=True, color="FFFFFF")
        c.fill = PatternFill("solid", fgColor="0F2942")
    roles = {"pegawai": "pegawai", "pic": "pic", "admin": "admin"}
    for u in users:
        ws.append([u.get("name", ""), u.get("nip", ""), u.get("email", ""), u.get("jabatan", ""), u.get("unit_kerja", ""),
                   roles.get(u.get("role"), u.get("role", "")), "Aktif" if u.get("active", True) else "Nonaktif",
                   done.get(u["id"], 0), (u.get("created_at") or "")[:10]])
        ws.cell(row=ws.max_row, column=2).number_format = "@"
    for col, w in zip("ABCDEFGHI", [30, 22, 30, 22, 26, 10, 10, 16, 12]):
        ws.column_dimensions[col].width = w
    ws.freeze_panes = "A2"
    buf = io.BytesIO()
    wb.save(buf)
    name = f"daftar-pegawai-{datetime.now(timezone.utc).strftime('%Y-%m-%d')}.xlsx"
    return Response(content=buf.getvalue(), media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    headers={"Content-Disposition": f'attachment; filename="{name}"'})


@api.post("/admin/users/import")
async def import_users(file: UploadFile = File(...), default_password: str = Query(""), update_existing: bool = Query(True), admin=Depends(require_admin)):
    import io
    from openpyxl import load_workbook
    if not file.filename.lower().endswith(".xlsx"):
        raise HTTPException(status_code=400, detail="Gunakan file Excel .xlsx")
    data = await file.read()
    if len(data) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Ukuran file maksimal 5MB")
    try:
        ws = load_workbook(io.BytesIO(data), read_only=True, data_only=True).active
        rows = list(ws.iter_rows(values_only=True))
    except Exception:
        raise HTTPException(status_code=400, detail="File Excel tidak dapat dibaca")
    if not rows:
        raise HTTPException(status_code=400, detail="File kosong")
    header = [str(h or "").strip().lower() for h in rows[0]]
    idx = {c: header.index(c.lower()) if c.lower() in header else None for c in IMPORT_COLS}
    if idx["Nama"] is None:
        raise HTTPException(status_code=400, detail="Kolom 'Nama' tidak ditemukan. Gunakan template yang disediakan.")
    if len(rows) > 2001:
        raise HTTPException(status_code=400, detail="Maksimal 2000 baris per impor")

    def cell(r, c):
        i = idx[c]
        v = r[i] if i is not None and i < len(r) else None
        if isinstance(v, float):
            if c == "NIP" and abs(v) >= 1e15:
                raise HTTPException(status_code=400, detail="NIP tersimpan sebagai angka sehingga digit rusak. Format kolom NIP sebagai Teks lalu ketik ulang.")
            if v.is_integer():
                v = int(v)
        return str(v).strip() if v is not None else ""

    created, updated, errors, changed = 0, 0, [], []
    for n, r in enumerate(rows[1:], start=2):
        if not any(v not in (None, "") for v in r):
            continue
        name = cell(r, "Nama")
        if name.startswith("Contoh Nama"):
            continue
        try:
            nip = cell(r, "NIP")
            existing = await db.users.find_one({"nip": nip}, {"_id": 0, "password_hash": 0}) if nip else None
            if existing:
                if not update_existing:
                    raise HTTPException(status_code=400, detail="NIP sudah digunakan")
                changes = {k: v for k, v in (("jabatan", cell(r, "Jabatan")), ("unit_kerja", cell(r, "Unit Kerja"))) if v and v != existing.get(k, "")}
                if changes.get("unit_kerja") and existing.get("role") == "pic":
                    rx = {"$regex": f"^{re.escape(changes['unit_kerja'])}$", "$options": "i"}
                    if await db.users.find_one({"role": "pic", "unit_kerja": rx, "id": {"$ne": existing["id"]}}):
                        raise HTTPException(status_code=400, detail="OPD ini sudah memiliki akun PIC (1 akun PIC per OPD)")
                if changes:
                    await db.users.update_one({"id": existing["id"]}, {"$set": changes})
                    updated += 1
                    changed.append({"action": "updated", "name": existing.get("name", "-"), "nip": nip, "fields": list(changes)})
                continue
            role = ROLE_MAP.get(cell(r, "Peran").lower() or "pegawai")
            pw = cell(r, "Kata Sandi") or default_password
            if not name:
                raise HTTPException(status_code=400, detail="Nama wajib diisi")
            if not role:
                raise HTTPException(status_code=400, detail="Peran harus pegawai / pic / admin")
            if len(pw) < 6:
                raise HTTPException(status_code=400, detail="Kata sandi kosong atau kurang dari 6 karakter")
            body = UserIn(name=name, nip=cell(r, "NIP"), email=cell(r, "Email").lower(), role=role,
                          jabatan=cell(r, "Jabatan"), unit_kerja=cell(r, "Unit Kerja"), password=pw)
            await _check_unique(body)
            d = body.model_dump(exclude={"password"})
            if role == "superadmin" or (role == "admin" and admin["role"] != "superadmin"):
                raise HTTPException(status_code=400, detail="Peran admin hanya dapat dibuat Super Admin")
            await db.users.insert_one({"id": new_id(), **d, **NEW_ACCOUNT, "password_hash": hash_password(pw), "created_at": now_iso()})
            created += 1
            changed.append({"action": "created", "name": name, "nip": body.nip, "fields": []})
        except HTTPException as ex:
            errors.append({"row": n, "name": name or "-", "error": ex.detail})
    await db.import_logs.insert_one({"id": new_id(), "admin_id": admin["id"], "admin_name": admin["name"], "filename": file.filename[:200],
                                     "update_existing": update_existing, "created": created, "updated": updated, "failed": len(errors),
                                     "changes": changed[:1000], "errors": errors[:1000], "created_at": now_iso()})
    return {"created": created, "updated": updated, "failed": len(errors), "errors": errors}


@api.get("/admin/users/import-logs")
async def import_logs(_=Depends(require_admin)):
    return await db.import_logs.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)


@api.put("/admin/users/{uid}")
async def update_user(uid: str, body: UserIn, admin=Depends(require_admin)):
    target = await db.users.find_one({"id": uid}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="Pengguna tidak ditemukan")
    _guard_role(admin, body.role, target)
    await _check_unique(body, uid)
    d = body.model_dump(exclude={"password"})
    d["email"] = d["email"].lower()
    if d["email"] != (target.get("email") or ""):
        d["email_verified"] = False
    if uid == admin["id"]:
        d["role"] = admin["role"]
        d["active"] = True
    if body.password:
        if len(body.password) < 6:
            raise HTTPException(status_code=400, detail="Kata sandi minimal 6 karakter")
        d["password_hash"] = hash_password(body.password)
        d["must_change_password"] = True
    await db.users.update_one({"id": uid}, {"$set": d})
    return await db.users.find_one({"id": uid}, {"_id": 0, "password_hash": 0})


@api.delete("/admin/users/{uid}")
async def delete_user(uid: str, admin=Depends(require_admin)):
    if uid == admin["id"]:
        raise HTTPException(status_code=400, detail="Tidak dapat menghapus akun sendiri")
    _guard_role(admin, "", await db.users.find_one({"id": uid}, {"_id": 0, "role": 1}))
    await db.users.delete_one({"id": uid})
    await db.enrollments.delete_many({"user_id": uid})
    await db.evaluations.delete_many({"user_id": uid})
    await db.psy_results.delete_many({"user_id": uid})
    return {"ok": True}


# ---------- Admin: stats & certificates ----------
@api.get("/admin/stats")
async def admin_stats(_=Depends(require_admin)):
    courses = await db.courses.find({}, {"_id": 0, "id": 1, "title": 1}).to_list(1000)
    chart = []
    for c in courses:
        chart.append({"name": c["title"][:28], "peserta": await db.enrollments.count_documents({"course_id": c["id"]}),
                      "lulus": await db.enrollments.count_documents({"course_id": c["id"], "status": "completed"})})
    recent = await admin_certificates(_)
    total = await db.users.count_documents({})
    verified = await db.users.count_documents({"email_verified": True})
    return {
        "verified": verified, "total_users": total, "verified_pct": round(verified * 100 / total) if total else 0,
        "users": await db.users.count_documents({"role": "pegawai"}),
        "courses": await db.courses.count_documents({"kind": "course", "status": "approved"}),
        "readings": await db.readings.count_documents({"status": "approved"}),
        "pending_readings": await db.readings.count_documents({"status": "pending"}) + await db.courses.count_documents({"status": "pending"}),
        "certificates": await db.enrollments.count_documents({"status": "completed"}),
        "ongoing": await db.enrollments.count_documents({"status": "ongoing"}),
        "chart": chart,
        "recent_certificates": recent[:6],
    }


@api.get("/admin/certificates")
async def admin_certificates(_=Depends(require_admin)):
    enrolls = await db.enrollments.find({"status": "completed"}, {"_id": 0}).sort("completed_at", -1).to_list(2000)
    users = {u["id"]: u for u in await db.users.find({}, {"_id": 0, "id": 1, "name": 1, "nip": 1}).to_list(5000)}
    courses = {c["id"]: c["title"] for c in await db.courses.find({}, {"_id": 0, "id": 1, "title": 1}).to_list(1000)}
    return [{"id": e["id"], "certificate_no": e["certificate_no"], "completed_at": e["completed_at"], "score": e.get("quiz_score"),
             "user_name": users.get(e["user_id"], {}).get("name", "-"), "nip": users.get(e["user_id"], {}).get("nip", ""),
             "course_title": courses.get(e["course_id"], "(dihapus)")} for e in enrolls]


app.include_router(api)
app.include_router(extras_router)
app.include_router(features_router)
app.include_router(ext_router)
app.include_router(portal_router)

ALLOWED_ORIGINS = [FRONTEND_URL, "http://localhost:3000"]
AUDITED = ("/api/admin/", "/api/proposals")


def _token_user_id(request: Request) -> Optional[str]:
    token = request.cookies.get("access_token") or request.headers.get("Authorization", "")[7:]
    try:
        return jwt.decode(token, os.environ["JWT_SECRET"], algorithms=[JWT_ALGORITHM]).get("sub") if token else None
    except jwt.InvalidTokenError:
        return None


@app.middleware("http")
async def origin_guard(request: Request, call_next):
    origin = request.headers.get("origin")
    host = request.headers.get("x-forwarded-host") or request.headers.get("host")
    if request.method in ("POST", "PUT", "PATCH", "DELETE") and origin and origin not in ALLOWED_ORIGINS and urlparse(origin).netloc != host:
        return JSONResponse({"detail": "Origin tidak diizinkan"}, status_code=403)
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "SAMEORIGIN")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
    path = request.url.path
    sensitive_get = request.method == "GET" and ("/backup" in path or path.endswith("/report") or "/export" in path)
    if path.startswith(AUDITED) and (request.method in ("POST", "PUT", "PATCH", "DELETE") or sensitive_get) and response.status_code < 500:
        uid = _token_user_id(request)
        u = await db.users.find_one({"id": uid}, {"_id": 0, "id": 1, "name": 1, "role": 1}) if uid else None
        if u and u.get("role") in (*ADMIN_ROLES, "pic"):
            await record_activity(u, request, response.status_code)
    return response


app.add_middleware(CORSMiddleware, allow_origins=ALLOWED_ORIGINS, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])


@app.on_event("startup")
async def startup():
    if os.environ.get("PG_AUTOSTART_SCRIPT"):
        import subprocess
        await asyncio.to_thread(subprocess.run, ["bash", os.environ["PG_AUTOSTART_SCRIPT"]], check=False)
    await db.users.create_index("id", unique=True)
    await db.users.create_index("unit_kerja")
    await db.login_attempts.delete_many({})
    await db.survey_clicks.create_index([("date", 1), ("idx", 1), ("visitor_id", 1)], unique=True)
    await db.survey_respondents.create_index("month", unique=True)
    if not await db.settings.find_one({"key": "roles_v2"}):
        await db.users.update_many({"role": "admin"}, {"$set": {"role": "superadmin"}})
        await db.settings.insert_one({"key": "roles_v2", "at": now_iso()})
    await seed_users()
    await seed_content()
    await db.activity_logs.create_index("created_at")
    await db.security_events.create_index("created_at")
    await db.visits.create_index([("date", 1), ("visitor_id", 1)], unique=True)
    await db.email_tokens.create_index("hash")
    await seed_psy()
    await db.courses.update_many({"kind": {"$exists": False}}, {"$set": {"kind": "course"}})
    await db.courses.update_many({"status": {"$exists": False}}, {"$set": {"status": "approved", "proposed_by": None}})
    try:
        init_storage()
        logger.info("Storage initialized")
    except Exception as e:
        logger.error(f"Storage init failed: {e}")


@app.on_event("shutdown")
async def shutdown():
    client.close()
