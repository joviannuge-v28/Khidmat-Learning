import os
import uuid
import logging
from datetime import datetime, timezone, timedelta

import bcrypt
import jwt
from fastapi import Request, HTTPException, Depends
from pgdb import Database

logger = logging.getLogger("lms")

db = Database(os.environ["DATABASE_URL"])
client = db

JWT_ALGORITHM = "HS256"
APP_NAME = "lms-khidmat-dumai"


def new_id() -> str:
    return str(uuid.uuid4())


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(user_id: str) -> str:
    payload = {"sub": user_id, "exp": datetime.now(timezone.utc) + timedelta(minutes=15), "type": "access"}
    return jwt.encode(payload, os.environ["JWT_SECRET"], algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    payload = {"sub": user_id, "exp": datetime.now(timezone.utc) + timedelta(days=7), "type": "refresh"}
    return jwt.encode(payload, os.environ["JWT_SECRET"], algorithm=JWT_ALGORITHM)


def set_auth_cookies(response, user_id: str):
    response.set_cookie("access_token", create_access_token(user_id), httponly=True, secure=False, samesite="lax", max_age=900, path="/")
    response.set_cookie("refresh_token", create_refresh_token(user_id), httponly=True, secure=False, samesite="lax", max_age=604800, path="/")


def public_user(u: dict) -> dict:
    return {k: v for k, v in u.items() if k not in ("_id", "password_hash")}


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Belum login")
    try:
        payload = jwt.decode(token, os.environ["JWT_SECRET"], algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Sesi kedaluwarsa")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token tidak valid")
    if payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Token tidak valid")
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    if not user or not user.get("active", True):
        raise HTTPException(status_code=401, detail="Pengguna tidak ditemukan")
    return user


ADMIN_ROLES = ("admin", "superadmin")


def is_admin(user: dict) -> bool:
    return (user or {}).get("role") in ADMIN_ROLES


def client_ip(request: Request) -> str:
    return (request.headers.get("x-forwarded-for") or (request.client.host if request.client else "")).split(",")[0].strip()


async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    if not is_admin(user):
        raise HTTPException(status_code=403, detail="Akses khusus admin")
    return user


async def require_superadmin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "superadmin":
        raise HTTPException(status_code=403, detail="Akses khusus Super Admin")
    return user


# ===== Penyimpanan file lokal (folder backend/uploads) =====
import pathlib
UPLOAD_DIR = pathlib.Path(__file__).parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

def init_storage(force: bool = False):
    return "local"

def put_object(path: str, data: bytes, content_type: str) -> dict:
    dest = UPLOAD_DIR / path
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(data)
    return {"path": path}

def get_object(path: str):
    dest = UPLOAD_DIR / path
    if not dest.exists():
        return None, "application/octet-stream"
    import mimetypes
    ct = mimetypes.guess_type(str(dest))[0] or "application/octet-stream"
    return dest.read_bytes(), ct
