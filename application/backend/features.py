import io
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Optional, Any

from fastapi import APIRouter, HTTPException, Depends, Response, Query
from pydantic import BaseModel

from core import db, new_id, now_iso, get_current_user, require_admin, is_admin

router = APIRouter(prefix="/api")
WIB = timezone(timedelta(hours=7))
BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"]


def parse_start(s: str):
    if not s:
        return None
    try:
        d = datetime.fromisoformat(s)
    except ValueError:
        return None
    return d if d.tzinfo else d.replace(tzinfo=WIB)


def webinar_end(c: dict):
    st = parse_start(c.get("start_at"))
    return st + timedelta(minutes=45 * float(c.get("duration_hours") or 1)) if st else None


# ---------- Verifikasi nomor ----------
@router.get("/verify-number")
async def verify_number(no: str):
    e = await db.enrollments.find_one({"certificate_no": no.strip(), "status": "completed"}, {"_id": 0, "id": 1})
    if not e:
        raise HTTPException(status_code=404, detail="Nomor sertifikat tidak ditemukan")
    return {"id": e["id"]}


# ---------- Notifikasi ----------
def _when(mins: float) -> str:
    return f"dalam {max(1, int(mins))} menit" if mins < 60 else f"dalam {round(mins / 60)} jam"


@router.get("/my/notifications")
async def my_notifications(user=Depends(get_current_user)):
    now = datetime.now(timezone.utc)
    enrolls = await db.enrollments.find({"user_id": user["id"]}, {"_id": 0}).to_list(2000)
    ids = [e["course_id"] for e in enrolls]
    courses = {c["id"]: c for c in await db.courses.find({"id": {"$in": ids}}, {"_id": 0, "modules": 0, "questions": 0}).to_list(2000)}
    evaluated = {x["course_id"] for x in await db.evaluations.find({"user_id": user["id"]}, {"_id": 0, "course_id": 1}).to_list(2000)}
    out = []
    for e in enrolls:
        c = courses.get(e["course_id"])
        if not c:
            continue
        zoom = c.get("kind") == "zoom"
        label = "Webinar Zoom" if zoom else "Pelatihan"
        link = "/zoom" if zoom else f"/pelatihan/{c['id']}"
        st, end = parse_start(c.get("start_at")), webinar_end(c)
        if st and e["status"] != "completed":
            mins = (st - now).total_seconds() / 60
            if 0 < mins <= 24 * 60:
                out.append({"id": f"start-{c['id']}", "type": "upcoming", "title": f"{label} segera dimulai",
                            "message": f"{c['title']} dimulai {_when(mins)}", "link": link, "start_at": st.isoformat(), "urgent": mins <= 60})
            elif mins <= 0 and zoom and end and now < end:
                out.append({"id": f"live-{c['id']}", "type": "live", "title": "Webinar sedang berlangsung",
                            "message": f"{c['title']} sedang berlangsung. Segera bergabung.", "link": link, "start_at": st.isoformat(), "urgent": True})
        if zoom and c["id"] not in evaluated and (e["status"] == "completed" or (end and now >= end)):
            out.append({"id": f"eval-{c['id']}", "type": "evaluation", "title": "Evaluasi webinar wajib diisi",
                        "message": f"Isi evaluasi \"{c['title']}\" agar sertifikat dapat diunduh.", "link": "/zoom", "urgent": False})
    out.sort(key=lambda x: (not x["urgent"], x.get("start_at") or "9"))
    if is_admin(user):
        reports = await db.support_requests.find({"status": "new"}, {"_id": 0, "id": 1, "name": 1, "category": 1, "created_at": 1}).sort("created_at", -1).to_list(50)
        out = [{"id": f"support-{r['id']}", "type": "support", "title": "Laporan pengguna baru",
                "message": f"{r.get('name', '-')} · {r.get('category', '')}", "link": "/admin/laporan", "urgent": False,
                "created_at": r.get("created_at")} for r in reports] + out
    return out


# ---------- Evaluasi Webinar ----------
DEFAULT_EVAL = [
    {"id": "q1", "text": "Materi webinar sesuai dengan kebutuhan pekerjaan saya", "type": "rating", "required": True},
    {"id": "q2", "text": "Narasumber menyampaikan materi dengan jelas", "type": "rating", "required": True},
    {"id": "q3", "text": "Kualitas audio, video, dan jalannya webinar baik", "type": "rating", "required": True},
    {"id": "q4", "text": "Saran dan masukan untuk webinar berikutnya", "type": "text", "required": False},
]


class EvalQ(BaseModel):
    id: Optional[str] = None
    text: str
    type: str = "rating"
    required: bool = True


class EvalQsIn(BaseModel):
    questions: List[EvalQ]


class EvalIn(BaseModel):
    answers: Dict[str, Any]


def _clean_qs(qs: List[EvalQ]) -> list:
    out = []
    for q in qs:
        if not q.text.strip():
            raise HTTPException(status_code=400, detail="Teks pertanyaan wajib diisi")
        if q.type not in ("rating", "text"):
            raise HTTPException(status_code=400, detail="Jenis pertanyaan tidak valid")
        out.append({"id": q.id or new_id(), "text": q.text.strip(), "type": q.type, "required": q.required})
    return out


async def global_eval_questions():
    s = await db.settings.find_one({"key": "main"}, {"_id": 0, "eval_questions": 1}) or {}
    return s.get("eval_questions") or DEFAULT_EVAL


async def eval_questions_for(c: dict):
    return c.get("evaluation_questions") or await global_eval_questions()


async def _managed_webinar(cid: str, user: dict) -> dict:
    c = await db.courses.find_one({"id": cid, "kind": "zoom"}, {"_id": 0})
    if not c:
        raise HTTPException(status_code=404, detail="Webinar tidak ditemukan")
    if user["role"] not in ("admin", "superadmin") and not (user["role"] == "pic" and c.get("proposed_by") == user["id"]):
        raise HTTPException(status_code=403, detail="Tidak diizinkan")
    return c


@router.get("/admin/eval-questions")
async def get_global_eval(_=Depends(require_admin)):
    return await global_eval_questions()


@router.put("/admin/eval-questions")
async def put_global_eval(body: EvalQsIn, _=Depends(require_admin)):
    qs = _clean_qs(body.questions)
    if not qs:
        raise HTTPException(status_code=400, detail="Minimal satu pertanyaan")
    await db.settings.update_one({"key": "main"}, {"$set": {"eval_questions": qs}}, upsert=True)
    return qs


@router.get("/webinars/{cid}/evaluation-admin")
async def evaluation_admin(cid: str, user=Depends(get_current_user)):
    c = await _managed_webinar(cid, user)
    qs = await eval_questions_for(c)
    resp = await db.evaluations.find({"course_id": cid}, {"_id": 0}).sort("created_at", -1).to_list(5000)
    users = {u["id"]: u for u in await db.users.find({"id": {"$in": [r["user_id"] for r in resp]}}, {"_id": 0, "id": 1, "name": 1, "unit_kerja": 1}).to_list(5000)}
    for r in resp:
        r["user_name"] = users.get(r["user_id"], {}).get("name", "-")
        r["unit_kerja"] = users.get(r["user_id"], {}).get("unit_kerja", "")
    summary = []
    for q in qs:
        vals = [r["answers"].get(q["id"]) for r in resp if q["type"] == "rating" and isinstance(r["answers"].get(q["id"]), (int, float))]
        summary.append({"id": q["id"], "text": q["text"], "type": q["type"], "count": len(vals),
                        "avg": round(sum(vals) / len(vals), 2) if vals else None})
    return {"title": c["title"], "questions": qs, "custom": bool(c.get("evaluation_questions")), "responses": resp, "summary": summary}


@router.put("/webinars/{cid}/evaluation-questions")
async def put_webinar_eval(cid: str, body: EvalQsIn, user=Depends(get_current_user)):
    await _managed_webinar(cid, user)
    qs = _clean_qs(body.questions)
    await db.courses.update_one({"id": cid}, {"$set": {"evaluation_questions": qs}})
    return qs


@router.get("/courses/{cid}/evaluation")
async def my_evaluation(cid: str, user=Depends(get_current_user)):
    c = await db.courses.find_one({"id": cid, "kind": "zoom"}, {"_id": 0})
    e = await db.enrollments.find_one({"course_id": cid, "user_id": user["id"]}, {"_id": 0})
    if not c or not e:
        raise HTTPException(status_code=404, detail="Anda belum terdaftar di webinar ini")
    end = webinar_end(c)
    available = e["status"] == "completed" or bool(end and datetime.now(timezone.utc) >= end)
    ev = await db.evaluations.find_one({"course_id": cid, "user_id": user["id"]}, {"_id": 0})
    return {"title": c["title"], "questions": await eval_questions_for(c), "available": available, "submitted": bool(ev),
            "answers": (ev or {}).get("answers", {})}


@router.post("/courses/{cid}/evaluation")
async def submit_evaluation(cid: str, body: EvalIn, user=Depends(get_current_user)):
    info = await my_evaluation(cid, user)
    if info["submitted"]:
        raise HTTPException(status_code=400, detail="Evaluasi sudah dikirim")
    if not info["available"]:
        raise HTTPException(status_code=400, detail="Evaluasi dapat diisi setelah webinar selesai")
    answers = {}
    for q in info["questions"]:
        v = body.answers.get(q["id"])
        if q["type"] == "rating":
            if v is None or v == "":
                if q["required"]:
                    raise HTTPException(status_code=400, detail=f"Mohon nilai: {q['text']}")
                continue
            if not isinstance(v, (int, float)) or not 1 <= v <= 5:
                raise HTTPException(status_code=400, detail="Nilai harus 1 sampai 5")
            answers[q["id"]] = int(v)
        else:
            v = str(v or "").strip()[:2000]
            if q["required"] and not v:
                raise HTTPException(status_code=400, detail=f"Mohon isi: {q['text']}")
            answers[q["id"]] = v
    await db.evaluations.insert_one({"id": new_id(), "course_id": cid, "user_id": user["id"], "answers": answers, "created_at": now_iso()})
    return {"ok": True}


# ---------- Laporan JP ----------
async def _completions(year: int, month: int = 0, user_id: Optional[str] = None):
    q = {"status": "completed"}
    if user_id:
        q["user_id"] = user_id
    enrolls = await db.enrollments.find(q, {"_id": 0}).to_list(None)
    courses = {c["id"]: c for c in await db.courses.find({}, {"_id": 0, "id": 1, "title": 1, "duration_hours": 1, "kind": 1}).to_list(None)}
    out = []
    for e in enrolls:
        if not e.get("completed_at") or e["course_id"] not in courses:
            continue
        d = datetime.fromisoformat(e["completed_at"]).astimezone(WIB)
        if d.year != year or (month and d.month != month):
            continue
        c = courses[e["course_id"]]
        out.append({"user_id": e["user_id"], "course_title": c["title"], "kind": c.get("kind", "course"),
                    "jp": float(c.get("duration_hours") or 0), "date": d, "certificate_no": e.get("certificate_no")})
    return out


async def jp_report(year: int, month: int, group: str):
    rows = await _completions(year, month)
    users = {u["id"]: u for u in await db.users.find({}, {"_id": 0, "id": 1, "name": 1, "nip": 1, "unit_kerja": 1}).to_list(None)}
    agg = {}
    for r in rows:
        u = users.get(r["user_id"], {})
        key = r["user_id"] if group == "person" else (u.get("unit_kerja") or "(Tanpa OPD)")
        a = agg.setdefault(key, {"name": u.get("name", "-") if group == "person" else key, "nip": u.get("nip", ""),
                                 "unit_kerja": u.get("unit_kerja", ""), "jp": 0.0, "activities": 0, "people": set()})
        a["jp"] += r["jp"]
        a["activities"] += 1
        a["people"].add(r["user_id"])
    out = sorted(agg.values(), key=lambda x: -x["jp"])
    for i, a in enumerate(out):
        a["rank"] = i + 1
        a["participants"] = len(a.pop("people"))
        a["jp"] = round(a["jp"], 1)
        a["avg_jp"] = round(a["jp"] / a["participants"], 1) if a["participants"] else 0
    return out


def _period(year: int, month: int) -> str:
    return f"{BULAN[month - 1]} {year}" if month else f"Tahun {year}"


def _xlsx(title: str, headers: list, rows: list) -> bytes:
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill
    wb = Workbook()
    ws = wb.active
    ws.title = "Laporan JP"
    ws.append([title])
    ws["A1"].font = Font(bold=True, size=13)
    ws.append([])
    ws.append(headers)
    for cell in ws[3]:
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = PatternFill("solid", fgColor="0F2942")
    for r in rows:
        ws.append(r)
    for i, _ in enumerate(headers):
        ws.column_dimensions[chr(65 + i)].width = 14 if i else 8
    ws.column_dimensions["B"].width = 36
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def _pdf(title: str, subtitle: str, headers: list, rows: list) -> bytes:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=36, rightMargin=36, topMargin=40, bottomMargin=40, title=title)
    st = getSampleStyleSheet()
    data = [headers] + [[Paragraph(str(c), st["BodyText"]) if i == 1 else str(c) for i, c in enumerate(r)] for r in rows]
    t = Table(data, repeatRows=1)
    t.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0F2942")), ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                           ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"), ("FONTSIZE", (0, 0), (-1, -1), 9),
                           ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#CBD5E1")), ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                           ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F1F5F9")])]))
    story = [Paragraph(title, st["Title"]), Paragraph(subtitle, st["Normal"]), Spacer(1, 14), t if rows else Paragraph("Belum ada data.", st["Normal"])]
    doc.build(story)
    return buf.getvalue()


def _file(data: bytes, fmt: str, name: str) -> Response:
    mt = "application/pdf" if fmt == "pdf" else "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    return Response(content=data, media_type=mt, headers={"Content-Disposition": f'attachment; filename="{name}.{fmt}"'})


@router.get("/admin/reports/jp")
async def admin_jp(year: int, month: int = 0, group: str = "person", _=Depends(require_admin)):
    return await jp_report(year, month, group)


@router.get("/admin/reports/jp/export")
async def admin_jp_export(year: int, month: int = 0, group: str = "person", format: str = Query("pdf", pattern="^(pdf|xlsx)$"), _=Depends(require_admin)):
    rows = await jp_report(year, month, group)
    period = _period(year, month)
    if group == "person":
        headers = ["Peringkat", "Nama", "NIP", "OPD", "Kegiatan", "Total JP"]
        data = [[r["rank"], r["name"], r["nip"], r["unit_kerja"], r["activities"], r["jp"]] for r in rows]
        title = f"Leaderboard JP Pegawai - {period}"
    else:
        headers = ["Peringkat", "OPD", "Pegawai", "Kegiatan", "Total JP", "Rata-rata JP"]
        data = [[r["rank"], r["name"], r["participants"], r["activities"], r["jp"], r["avg_jp"]] for r in rows]
        title = f"Laporan JP per OPD - {period}"
    name = f"laporan-jp-{group}-{year}-{month:02d}"
    if format == "xlsx":
        return _file(_xlsx(title, headers, data), "xlsx", name)
    return _file(_pdf(title, "LMS Khidmat Kota Dumai · BKPSDM Kota Dumai", headers, data), "pdf", name)


async def _my_jp(user, year):
    rows = await _completions(year, 0, user["id"])
    months = [{"month": BULAN[i][:3], "jp": 0.0} for i in range(12)]
    for r in rows:
        months[r["date"].month - 1]["jp"] += r["jp"]
    items = [{"course_title": r["course_title"], "kind": r["kind"], "jp": r["jp"], "date": r["date"].isoformat(),
              "certificate_no": r["certificate_no"]} for r in sorted(rows, key=lambda x: x["date"], reverse=True)]
    return {"year": year, "total": round(sum(r["jp"] for r in rows), 1), "months": months, "items": items}


@router.get("/my/jp")
async def my_jp(year: int, user=Depends(get_current_user)):
    return await _my_jp(user, year)


@router.get("/my/jp/export")
async def my_jp_export(year: int, format: str = Query("pdf", pattern="^(pdf|xlsx)$"), user=Depends(get_current_user)):
    d = await _my_jp(user, year)
    headers = ["No", "Kegiatan", "Jenis", "Tanggal", "No. Sertifikat", "JP"]
    data = [[i + 1, it["course_title"], "Webinar" if it["kind"] == "zoom" else "Pelatihan",
             datetime.fromisoformat(it["date"]).strftime("%d-%m-%Y"), it["certificate_no"] or "-", it["jp"]] for i, it in enumerate(d["items"])]
    title = f"Laporan JP {user['name']} - Tahun {year}"
    name = f"laporan-jp-saya-{year}"
    if format == "xlsx":
        return _file(_xlsx(title, headers, data), "xlsx", name)
    sub = f"NIP {user.get('nip') or '-'} · {user.get('unit_kerja') or '-'} · Total {d['total']} JP"
    return _file(_pdf(title, sub, headers, data), "pdf", name)


# ---------- Tes Kepribadian ----------
class Dim(BaseModel):
    id: Optional[str] = None
    name: str
    color: str = "#2563EB"
    low_text: str = ""
    mid_text: str = ""
    high_text: str = ""


class POption(BaseModel):
    text: str
    scores: Dict[str, float] = {}


class PQuestion(BaseModel):
    id: Optional[str] = None
    text: str
    options: List[POption]


class PsyTestIn(BaseModel):
    title: str
    description: str = ""
    published: bool = True
    dimensions: List[Dim]
    questions: List[PQuestion]


class PsySubmit(BaseModel):
    answers: Dict[str, int]


def _psy_doc(body: PsyTestIn) -> dict:
    d = body.model_dump()
    if not d["title"].strip():
        raise HTTPException(status_code=400, detail="Judul tes wajib diisi")
    if not d["dimensions"] or not d["questions"]:
        raise HTTPException(status_code=400, detail="Minimal satu dimensi dan satu soal")
    for x in d["dimensions"]:
        x["id"] = x.get("id") or new_id()
    dim_ids = {x["id"] for x in d["dimensions"]}
    for q in d["questions"]:
        q["id"] = q.get("id") or new_id()
        if len(q["options"]) < 2 or not q["text"].strip():
            raise HTTPException(status_code=400, detail="Setiap soal butuh teks dan minimal 2 pilihan")
        for o in q["options"]:
            o["scores"] = {k: v for k, v in o["scores"].items() if k in dim_ids}
    return d


@router.get("/admin/psy-tests")
async def admin_psy_list(_=Depends(require_admin)):
    items = await db.psy_tests.find({}, {"_id": 0}).sort("created_at", -1).to_list(200)
    for t in items:
        t["result_count"] = await db.psy_results.count_documents({"test_id": t["id"]})
    return items


@router.get("/admin/psy-tests/{tid}")
async def admin_psy_get(tid: str, _=Depends(require_admin)):
    t = await db.psy_tests.find_one({"id": tid}, {"_id": 0})
    if not t:
        raise HTTPException(status_code=404, detail="Tes tidak ditemukan")
    return t


@router.post("/admin/psy-tests")
async def admin_psy_create(body: PsyTestIn, _=Depends(require_admin)):
    doc = {"id": new_id(), **_psy_doc(body), "created_at": now_iso()}
    await db.psy_tests.insert_one(dict(doc))
    return doc


@router.put("/admin/psy-tests/{tid}")
async def admin_psy_update(tid: str, body: PsyTestIn, _=Depends(require_admin)):
    res = await db.psy_tests.update_one({"id": tid}, {"$set": _psy_doc(body)})
    if not res.matched_count:
        raise HTTPException(status_code=404, detail="Tes tidak ditemukan")
    return await db.psy_tests.find_one({"id": tid}, {"_id": 0})


@router.delete("/admin/psy-tests/{tid}")
async def admin_psy_delete(tid: str, _=Depends(require_admin)):
    await db.psy_tests.delete_one({"id": tid})
    await db.psy_results.delete_many({"test_id": tid})
    return {"ok": True}


@router.get("/admin/psy-tests/{tid}/results")
async def admin_psy_results(tid: str, _=Depends(require_admin)):
    items = await db.psy_results.find({"test_id": tid}, {"_id": 0}).sort("created_at", -1).to_list(5000)
    users = {u["id"]: u for u in await db.users.find({"id": {"$in": [r["user_id"] for r in items]}}, {"_id": 0, "id": 1, "name": 1, "nip": 1, "unit_kerja": 1}).to_list(5000)}
    for r in items:
        u = users.get(r["user_id"], {})
        r.update({"user_name": u.get("name", "-"), "nip": u.get("nip", ""), "unit_kerja": u.get("unit_kerja", "")})
    return items


@router.get("/psy-tests")
async def psy_list(user=Depends(get_current_user)):
    items = await db.psy_tests.find({"published": True}, {"_id": 0, "questions": 0}).sort("created_at", -1).to_list(200)
    for t in items:
        full = await db.psy_tests.find_one({"id": t["id"]}, {"_id": 0, "questions.id": 1})
        t["question_count"] = len(full.get("questions", []))
        last = await db.psy_results.find_one({"test_id": t["id"], "user_id": user["id"]}, {"_id": 0}, sort=[("created_at", -1)])
        t["last_result"] = last
    return items


@router.get("/psy-tests/{tid}")
async def psy_get(tid: str, _=Depends(get_current_user)):
    t = await db.psy_tests.find_one({"id": tid, "published": True}, {"_id": 0})
    if not t:
        raise HTTPException(status_code=404, detail="Tes tidak ditemukan")
    t["questions"] = [{"id": q["id"], "text": q["text"], "options": [o["text"] for o in q["options"]]} for q in t["questions"]]
    t["dimensions"] = [{"id": d["id"], "name": d["name"], "color": d["color"]} for d in t["dimensions"]]
    return t


@router.post("/psy-tests/{tid}/submit")
async def psy_submit(tid: str, body: PsySubmit, user=Depends(get_current_user)):
    t = await db.psy_tests.find_one({"id": tid, "published": True}, {"_id": 0})
    if not t:
        raise HTTPException(status_code=404, detail="Tes tidak ditemukan")
    got = {d["id"]: 0.0 for d in t["dimensions"]}
    mx = {d["id"]: 0.0 for d in t["dimensions"]}
    for q in t["questions"]:
        idx = body.answers.get(q["id"])
        if idx is None or not 0 <= idx < len(q["options"]):
            raise HTTPException(status_code=400, detail="Jawab semua soal terlebih dahulu")
        for did in got:
            mx[did] += max(o["scores"].get(did, 0) for o in q["options"])
            got[did] += q["options"][idx]["scores"].get(did, 0)
    dims = []
    for d in t["dimensions"]:
        pct = round(got[d["id"]] * 100 / mx[d["id"]]) if mx[d["id"]] else 0
        level = "Rendah" if pct < 40 else "Sedang" if pct < 70 else "Tinggi"
        text = {"Rendah": d.get("low_text"), "Sedang": d.get("mid_text"), "Tinggi": d.get("high_text")}[level] or ""
        dims.append({"id": d["id"], "name": d["name"], "color": d["color"], "score": got[d["id"]], "max": mx[d["id"]],
                     "percent": pct, "level": level, "text": text})
    doc = {"id": new_id(), "test_id": tid, "test_title": t["title"], "user_id": user["id"], "dimensions": dims,
           "dominant": max(dims, key=lambda x: x["percent"])["name"] if dims else "", "created_at": now_iso()}
    await db.psy_results.insert_one(dict(doc))
    return doc


@router.get("/psy-results/mine")
async def psy_mine(user=Depends(get_current_user)):
    return await db.psy_results.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)


LIKERT = ["Sangat Tidak Setuju", "Tidak Setuju", "Netral", "Setuju", "Sangat Setuju"]


async def seed_psy():
    if await db.psy_tests.count_documents({}) > 0:
        return
    dims = [("Ketelitian", "#2563EB"), ("Kolaborasi", "#059669"), ("Inisiatif", "#D97706"), ("Ketahanan Stres", "#DB2777")]
    dims = [{"id": new_id(), "name": n, "color": c, "low_text": f"{n} Anda masih dapat dikembangkan.",
             "mid_text": f"{n} Anda cukup baik dan stabil.", "high_text": f"{n} Anda menonjol dan menjadi kekuatan kerja."} for n, c in dims]
    stmts = [(0, "Saya memeriksa ulang pekerjaan sebelum menyerahkannya."), (0, "Saya mencatat detail tugas dengan rapi."),
             (1, "Saya senang bekerja sama dalam tim lintas bidang."), (1, "Saya mudah membantu rekan yang kesulitan."),
             (2, "Saya mengusulkan perbaikan tanpa menunggu diminta."), (2, "Saya cepat memulai pekerjaan baru."),
             (3, "Saya tetap tenang saat tenggat waktu mendesak."), (3, "Saya mampu bangkit setelah menghadapi kegagalan.")]
    qs = [{"id": new_id(), "text": s, "options": [{"text": t, "scores": {dims[d]["id"]: i + 1}} for i, t in enumerate(LIKERT)]} for d, s in stmts]
    await db.psy_tests.insert_one({"id": new_id(), "title": "Tes Gaya Kerja ASN (Contoh)", "published": True,
                                   "description": "Tes contoh untuk mengenali gaya kerja Anda. Soal, dimensi, dan skor dapat diubah admin.",
                                   "dimensions": dims, "questions": qs, "created_at": now_iso()})
