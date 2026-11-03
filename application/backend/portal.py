import io
import os
import re
from datetime import datetime, timezone
from typing import List, Optional

import qrcode
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field

from core import db, new_id, now_iso, get_current_user, require_admin, is_admin
from features import _completions, _file, BULAN, WIB

FRONTEND_URL = os.environ["FRONTEND_URL"]

router = APIRouter(prefix="/api")


class SurveyItem(BaseModel):
    label: str = ""
    url: str = ""
    qr_path: str = ""
    description: str = ""


class SurveyIn(BaseModel):
    title: str = "Survei Kepuasan Masyarakat"
    description: str = ""
    items: List[SurveyItem] = []
    show_in_footer: bool = True


SURVEY_DEFAULT = {"title": "Survei Kepuasan Masyarakat", "description": "Bantu kami meningkatkan layanan LMS Khidmat Kota Dumai dengan mengisi survei singkat berikut.",
                  "items": [], "show_in_footer": True}


async def _survey() -> dict:
    s = await db.settings.find_one({"key": "main"}, {"_id": 0, "survey": 1})
    return {**SURVEY_DEFAULT, **((s or {}).get("survey") or {})}


@router.get("/public/survey")
async def public_survey():
    return await _survey()


@router.put("/admin/survey")
async def update_survey(body: SurveyIn, _=Depends(require_admin)):
    for it in body.items:
        if it.url and not it.url.startswith(("http://", "https://")):
            raise HTTPException(status_code=400, detail="Tautan survei harus diawali http:// atau https://")
        if not it.url and not it.qr_path:
            raise HTTPException(status_code=400, detail="Setiap survei wajib memiliki tautan atau gambar barcode")
    data = {**body.model_dump(), "updated_at": now_iso()}
    await db.settings.update_one({"key": "main"}, {"$set": {"survey": data}}, upsert=True)
    return data


@router.get("/public/survey/{idx}/qr")
async def survey_qr(idx: int):
    items = (await _survey())["items"]
    if idx < 0 or idx >= len(items) or not items[idx].get("url"):
        raise HTTPException(status_code=404, detail="Survei tidak ditemukan")
    buf = io.BytesIO()
    qrcode.make(f"{FRONTEND_URL.rstrip('/')}/api/public/survey/{idx}/go?src=qr", box_size=10, border=2).save(buf, format="PNG")
    return Response(content=buf.getvalue(), media_type="image/png", headers={"Cache-Control": "public, max-age=300"})


@router.get("/public/survey/{idx}/go")
async def survey_go(idx: int, request: Request, src: str = "link"):
    items = (await _survey())["items"]
    if idx < 0 or idx >= len(items) or not items[idx].get("url"):
        raise HTTPException(status_code=404, detail="Survei tidak ditemukan")
    vid = re.sub(r"[^a-zA-Z0-9]", "", request.cookies.get("sv_vid", ""))[:40] or new_id().replace("-", "")
    now = datetime.now(WIB)
    src = "qr" if src == "qr" else "link"
    await db.survey_clicks.update_one({"date": now.strftime("%Y-%m-%d"), "idx": idx, "visitor_id": vid},
                                      {"$setOnInsert": {"month": now.strftime("%Y-%m"), "source": src, "label": items[idx].get("label", ""), "created_at": now_iso()}}, upsert=True)
    resp = RedirectResponse(items[idx]["url"], status_code=302)
    resp.set_cookie("sv_vid", vid, max_age=60 * 60 * 24 * 365, httponly=True, samesite="lax")
    return resp


class ManualCountIn(BaseModel):
    year: int = Field(ge=2000, le=2100)
    month: int = Field(ge=1, le=12)
    count: Optional[int] = Field(default=None, ge=0, le=10_000_000)


@router.put("/admin/survey/respondents")
async def set_respondents(body: ManualCountIn, _=Depends(require_admin)):
    key = f"{body.year}-{body.month:02d}"
    if body.count is None:
        await db.survey_respondents.delete_one({"month": key})
        return {"month": key, "count": None}
    await db.survey_respondents.update_one({"month": key}, {"$set": {"month": key, "count": body.count, "updated_at": now_iso()}}, upsert=True)
    return {"month": key, "count": body.count}


@router.get("/admin/survey/stats")
async def survey_stats(year: int, _=Depends(require_admin)):
    months = [{"month": m, "bulan": BULAN[m - 1][:3], "link": 0, "qr": 0, "pengisi": None} for m in range(1, 13)]
    for c in await db.survey_clicks.find({"month": {"$regex": f"^{year}-"}}, {"_id": 0, "month": 1, "source": 1}).to_list(None):
        months[int(c["month"][5:7]) - 1]["qr" if c.get("source") == "qr" else "link"] += 1
    for r in await db.survey_respondents.find({"month": {"$regex": f"^{year}-"}}, {"_id": 0}).to_list(None):
        months[int(r["month"][5:7]) - 1]["pengisi"] = r["count"]
    return {"year": year, "months": months, "total_visits": sum(m["link"] + m["qr"] for m in months),
            "total_respondents": sum(m["pengisi"] or 0 for m in months)}


@router.get("/admin/users/opd-report")
async def opd_report(unit: str = "", search: str = "", year: int = 0, _=Depends(require_admin)):
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
    q = {"role": {"$in": ["pegawai", "pic"]}}
    if unit.strip():
        q["unit_kerja"] = {"$regex": re.escape(unit.strip()), "$options": "i"}
    if search.strip():
        rx = {"$regex": re.escape(search.strip()), "$options": "i"}
        q["$or"] = [{"name": rx}, {"nip": rx}, {"email": rx}, {"jabatan": rx}]
    users = await db.users.find(q, {"_id": 0, "id": 1, "name": 1, "nip": 1, "jabatan": 1, "unit_kerja": 1}).sort("name", 1).to_list(None)
    ids = {u["id"] for u in users}
    enrolls = await db.enrollments.find({"user_id": {"$in": list(ids)}}, {"_id": 0, "user_id": 1, "status": 1, "started_at": 1}).to_list(None) if ids else []
    years = [year] if year else sorted({int((e.get("started_at") or "0000")[:4]) for e in enrolls} | {datetime.now(WIB).year})
    comps = [c for y in years for c in await _completions(y) if c["user_id"] in ids]
    st = getSampleStyleSheet()
    P = lambda t: Paragraph(str(t), st["BodyText"])
    rows = [["No", "Nama", "NIP", "Jabatan", "OPD / Unit Kerja", "Diikuti", "Berjalan", "Selesai", "Total JP"]]
    tot = [0, 0, 0, 0.0]
    for i, u in enumerate(users, 1):
        done = [c for c in comps if c["user_id"] == u["id"]]
        done_years = {c["date"].year for c in done}
        mine = [e for e in enrolls if e["user_id"] == u["id"] and (not year or (e.get("started_at") or "").startswith(str(year))
                or (e["status"] == "completed" and year in done_years and (e.get("started_at") or "")[:4] < str(year)))]
        ongoing = sum(1 for e in mine if e["status"] == "ongoing")
        jp = round(sum(c["jp"] for c in done), 1)
        tot = [tot[0] + len(mine), tot[1] + ongoing, tot[2] + len(done), tot[3] + jp]
        rows.append([i, P(u.get("name", "-")), u.get("nip") or "-", P(u.get("jabatan") or "-"), P(u.get("unit_kerja") or "-"), len(mine), ongoing, len(done), f"{jp:g}"])
    rows.append(["", P("<b>TOTAL</b>"), f"{len(users)} ASN", "", "", tot[0], tot[1], tot[2], f"{round(tot[3], 1):g}"])
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=landscape(A4), leftMargin=28, rightMargin=28, topMargin=32, bottomMargin=32, title="Rekap ASN per OPD")
    t = Table(rows, repeatRows=1, colWidths=[26, 170, 110, 140, 160, 50, 52, 50, 52])
    t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0F2942")), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                           ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"), ("FONTSIZE", (0, 0), (-1, -1), 8.5),
                           ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#CBD5E1")), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                           ("ALIGN", (5, 0), (-1, -1), "CENTER"), ("ROWBACKGROUNDS", (0, 1), (-1, -2), [colors.white, colors.HexColor("#F1F5F9")]),
                           ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#FEF3C7")), ("FONTNAME", (0, -1), (-1, -1), "Helvetica-Bold")]))
    period = f"Tahun {year}" if year else "Semua tahun"
    sub = f"OPD: {unit.strip() or 'Semua OPD'}{f' · Kata kunci: {search.strip()}' if search.strip() else ''} · Periode: {period} · Dicetak {datetime.now(WIB).strftime('%d-%m-%Y %H:%M')} WIB"
    doc.build([Paragraph("Rekap ASN &amp; Jam Pelatihan per OPD", st["Title"]), Paragraph("LMS Khidmat Kota Dumai · BKPSDM Kota Dumai", st["Normal"]),
               Paragraph(sub, st["Normal"]), Spacer(1, 12), t])
    slug = re.sub(r"[^a-z0-9]+", "-", (unit.strip() or "semua-opd").lower()).strip("-")[:50]
    return _file(buf.getvalue(), "pdf", f"rekap-asn-{slug}-{year or 'semua'}")


@router.get("/my/badges")
async def my_badges(user=Depends(get_current_user)):
    out = {"ongoing": await db.enrollments.count_documents({"user_id": user["id"], "status": "ongoing"})}
    if is_admin(user):
        out["support_new"] = await db.support_requests.count_documents({"status": "new"})
    return out
