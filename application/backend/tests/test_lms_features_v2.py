"""LMS Khidmat Kota Dumai - revision v2: PIC role, webinar proposal/approval, notifications, evaluation lock,
verify-number, JP reports, psy tests, cert preview, eval questions. Cleans up all TEST_ data via Mongo."""
import os
import uuid
from datetime import datetime, timezone, timedelta

import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ADMIN = {"identifier": "admin@dumaikota.go.id", "password": "AdminLMS2026!"}
PEGAWAI = {"identifier": "198504122010011002", "password": "Pegawai2026!"}
WIB = timezone(timedelta(hours=7))


def _env(key):
    for line in open("/app/backend/.env"):
        if line.startswith(key + "="):
            return line.split("=", 1)[1].strip().strip('"')


mdb = MongoClient(_env("MONGO_URL"))[_env("DB_NAME")]
STATE = {}


def _login(creds):
    s = requests.Session()
    r = s.post(f"{BASE_URL}/api/auth/login", json=creds)
    if r.status_code != 200:
        pytest.skip(f"login failed {r.status_code} {r.text}")
    return s


@pytest.fixture(scope="module")
def admin():
    return _login(ADMIN)


@pytest.fixture(scope="module")
def peg():
    return _login(PEGAWAI)


@pytest.fixture(scope="module", autouse=True)
def cleanup():
    yield
    cids = STATE.get("courses", [])
    if cids:
        mdb.enrollments.delete_many({"course_id": {"$in": cids}})
        mdb.evaluations.delete_many({"course_id": {"$in": cids}})
        mdb.courses.delete_many({"id": {"$in": cids}})
        for c in cids:
            mdb.counters.delete_many({"key": f"cert-course-{c}"})
    mdb.users.delete_many({"email": {"$regex": "^test_pic_"}})
    if STATE.get("psy_results"):
        mdb.psy_results.delete_many({"id": {"$in": STATE["psy_results"]}})
    mdb.psy_tests.delete_many({"title": {"$regex": "^TEST_"}})


# ---- Auth ----
def test_login_invalid():
    r = requests.post(f"{BASE_URL}/api/auth/login", json={"identifier": "admin@dumaikota.go.id", "password": "wrong"})
    assert r.status_code in (400, 401)
    assert "detail" in r.json()


def test_roles(admin, peg):
    assert admin.get(f"{BASE_URL}/api/auth/me").json()["role"] == "admin"
    assert peg.get(f"{BASE_URL}/api/auth/me").json()["role"] == "pegawai"


# ---- Verify number ----
def test_verify_number_invalid():
    r = requests.get(f"{BASE_URL}/api/verify-number", params={"no": "TIDAK-ADA-123"})
    assert r.status_code == 404


# ---- PIC creation ----
def test_create_pic_rules(admin):
    opd = f"TEST_OPD_{uuid.uuid4().hex[:6]}"
    base = {"name": "TEST_PIC", "nip": "", "role": "pic", "password": "PicTest2026!", "active": True}
    r = admin.post(f"{BASE_URL}/api/admin/users", json={**base, "email": f"test_pic_a{uuid.uuid4().hex[:5]}@x.id", "unit_kerja": ""})
    assert r.status_code == 400, r.text
    email = f"test_pic_{uuid.uuid4().hex[:6]}@x.id"
    r = admin.post(f"{BASE_URL}/api/admin/users", json={**base, "email": email, "unit_kerja": opd})
    assert r.status_code == 200, r.text
    assert r.json()["role"] == "pic"
    r2 = admin.post(f"{BASE_URL}/api/admin/users", json={**base, "email": f"test_pic_b{uuid.uuid4().hex[:5]}@x.id", "unit_kerja": opd.lower()})
    assert r2.status_code == 400 and "PIC" in r2.json()["detail"]
    STATE["pic_creds"] = {"identifier": email, "password": "PicTest2026!"}


def test_pegawai_cannot_propose(peg):
    r = peg.post(f"{BASE_URL}/api/proposals", json={"title": "TEST_x", "instructor": "x"})
    assert r.status_code == 403
    r = peg.post(f"{BASE_URL}/api/readings", json={"title": "TEST_x"})
    assert r.status_code == 403
    assert peg.get(f"{BASE_URL}/api/proposals/mine").status_code == 403


# ---- PIC webinar proposal + approval ----
def test_pic_proposal_and_approve(admin):
    pic = _login(STATE["pic_creds"])
    STATE["pic"] = pic
    start = (datetime.now(WIB) + timedelta(hours=2)).strftime("%Y-%m-%dT%H:%M")
    body = {"title": "TEST_Webinar PIC", "instructor": "TEST Dinas", "kind": "zoom", "start_at": start, "duration_hours": 2,
            "certificate": {"number_format": "HACK/{n}", "signer_name": "Hacker"}}
    r = pic.post(f"{BASE_URL}/api/proposals", json=body)
    assert r.status_code == 200, r.text
    c = r.json()
    STATE.setdefault("courses", []).append(c["id"])
    assert c["status"] == "pending" and c["published"] is False
    assert c["certificate"]["number_format"] == "" and c["certificate"]["signer_name"] == ""
    # course proposal too
    r = pic.post(f"{BASE_URL}/api/proposals", json={"title": "TEST_Course PIC", "instructor": "TEST", "kind": "course",
                                                     "modules": [{"title": "m1", "body": "x"}]})
    assert r.status_code == 200
    STATE["courses"].append(r.json()["id"])
    mine = pic.get(f"{BASE_URL}/api/proposals/mine").json()
    assert {x["id"] for x in mine} >= set(STATE["courses"])
    # approve without zoom link -> 400
    r = admin.patch(f"{BASE_URL}/api/admin/courses/{c['id']}/review", json={"status": "approved"})
    assert r.status_code == 400
    full = admin.get(f"{BASE_URL}/api/admin/courses/{c['id']}").json()
    full.update({"zoom_url": "https://zoom.us/j/123456", "meeting_id": "123", "passcode": "abc",
                 "certificate": {**full["certificate"], "number_format": "{n}/TEST-WEB/{romawi}/{tahun}", "number_start": 1}})
    full.pop("id", None)
    r = admin.put(f"{BASE_URL}/api/admin/courses/{c['id']}", json=full)
    assert r.status_code == 200, r.text
    r = admin.patch(f"{BASE_URL}/api/admin/courses/{c['id']}/review", json={"status": "approved"})
    assert r.status_code == 200 and r.json()["published"] is True
    STATE["web"] = c["id"]


def test_pic_cannot_edit_approved():
    pic = STATE["pic"]
    r = pic.put(f"{BASE_URL}/api/proposals/{STATE['web']}", json={"title": "TEST_x", "instructor": "x", "kind": "zoom", "start_at": "2030-01-01T10:00"})
    assert r.status_code == 400


# ---- Pegawai registration + notifications + evaluation lock ----
def test_register_and_notification(peg):
    wid = STATE["web"]
    lst = peg.get(f"{BASE_URL}/api/zoom").json()
    item = next(x for x in lst if x["id"] == wid)
    assert "zoom_url" not in item and "certificate" not in item
    r = peg.post(f"{BASE_URL}/api/courses/{wid}/enroll")
    assert r.status_code == 200
    STATE["eid"] = r.json()["id"]
    notifs = peg.get(f"{BASE_URL}/api/my/notifications").json()
    n = [x for x in notifs if x["id"] == f"start-{wid}"]
    assert n and n[0]["type"] == "upcoming" and "jam" in n[0]["message"]
    ev = peg.get(f"{BASE_URL}/api/courses/{wid}/evaluation").json()
    assert ev["available"] is False and ev["submitted"] is False
    r = peg.post(f"{BASE_URL}/api/courses/{wid}/evaluation", json={"answers": {}})
    assert r.status_code == 400


def test_attendance_and_cert_lock(admin, peg):
    wid, eid = STATE["web"], STATE["eid"]
    me = peg.get(f"{BASE_URL}/api/auth/me").json()
    r = admin.post(f"{BASE_URL}/api/admin/courses/{wid}/attendance", json={"user_id": me["id"], "present": True})
    assert r.status_code == 200 and r.json()["status"] == "completed"
    STATE["cert_no"] = r.json()["certificate_no"]
    assert "TEST-WEB" in STATE["cert_no"]
    r = peg.get(f"{BASE_URL}/api/certificates/{eid}/pdf")
    assert r.status_code == 403, r.status_code
    notifs = peg.get(f"{BASE_URL}/api/my/notifications").json()
    assert any(x["id"] == f"eval-{wid}" for x in notifs)
    # admin can still download
    assert admin.get(f"{BASE_URL}/api/certificates/{eid}/pdf").status_code == 200


def test_submit_evaluation(peg):
    wid, eid = STATE["web"], STATE["eid"]
    ev = peg.get(f"{BASE_URL}/api/courses/{wid}/evaluation").json()
    assert ev["available"] is True
    qs = ev["questions"]
    r = peg.post(f"{BASE_URL}/api/courses/{wid}/evaluation", json={"answers": {}})
    assert r.status_code == 400
    bad = {q["id"]: 9 for q in qs if q["type"] == "rating"}
    assert peg.post(f"{BASE_URL}/api/courses/{wid}/evaluation", json={"answers": bad}).status_code == 400
    ans = {q["id"]: (5 if q["type"] == "rating" else "TEST saran") for q in qs}
    r = peg.post(f"{BASE_URL}/api/courses/{wid}/evaluation", json={"answers": ans})
    assert r.status_code == 200, r.text
    assert peg.post(f"{BASE_URL}/api/courses/{wid}/evaluation", json={"answers": ans}).status_code == 400
    r = peg.get(f"{BASE_URL}/api/certificates/{eid}/pdf")
    assert r.status_code == 200 and r.content[:4] == b"%PDF"


def test_verify_number_valid():
    r = requests.get(f"{BASE_URL}/api/verify-number", params={"no": STATE["cert_no"]})
    assert r.status_code == 200 and r.json()["id"] == STATE["eid"]
    v = requests.get(f"{BASE_URL}/api/verify/{STATE['eid']}").json()
    assert v["certificate_no"] == STATE["cert_no"] and v["kind"] == "zoom"


def test_evaluation_admin_views(admin, peg):
    wid = STATE["web"]
    r = admin.get(f"{BASE_URL}/api/webinars/{wid}/evaluation-admin")
    assert r.status_code == 200
    d = r.json()
    assert len(d["responses"]) == 1 and any(s["avg"] == 5 for s in d["summary"])
    pic = STATE["pic"]
    assert pic.get(f"{BASE_URL}/api/webinars/{wid}/evaluation-admin").status_code == 200
    assert peg.get(f"{BASE_URL}/api/webinars/{wid}/evaluation-admin").status_code == 403
    r = pic.put(f"{BASE_URL}/api/webinars/{wid}/evaluation-questions",
                json={"questions": [{"text": "TEST pertanyaan PIC", "type": "rating", "required": True}]})
    assert r.status_code == 200
    d = pic.get(f"{BASE_URL}/api/webinars/{wid}/evaluation-admin").json()
    assert d["custom"] is True and d["questions"][0]["text"] == "TEST pertanyaan PIC"


def test_global_eval_questions(admin, peg):
    r = admin.get(f"{BASE_URL}/api/admin/eval-questions")
    assert r.status_code == 200 and len(r.json()) >= 1
    orig = r.json()
    assert peg.get(f"{BASE_URL}/api/admin/eval-questions").status_code == 403
    assert admin.put(f"{BASE_URL}/api/admin/eval-questions", json={"questions": []}).status_code == 400
    r = admin.put(f"{BASE_URL}/api/admin/eval-questions", json={"questions": orig})
    assert r.status_code == 200 and [q["id"] for q in r.json()] == [q["id"] for q in orig]


# ---- JP reports ----
def test_my_jp(peg):
    y = datetime.now(WIB).year
    d = peg.get(f"{BASE_URL}/api/my/jp", params={"year": y}).json()
    assert any(i["certificate_no"] == STATE["cert_no"] and i["jp"] == 2 for i in d["items"])
    assert len(d["months"]) == 12 and d["total"] >= 2
    for fmt, magic in (("pdf", b"%PDF"), ("xlsx", b"PK")):
        r = peg.get(f"{BASE_URL}/api/my/jp/export", params={"year": y, "format": fmt})
        assert r.status_code == 200 and r.content[:len(magic)] == magic
    assert peg.get(f"{BASE_URL}/api/my/jp/export", params={"year": y, "format": "csv"}).status_code == 422


def test_admin_jp(admin, peg):
    now = datetime.now(WIB)
    rows = admin.get(f"{BASE_URL}/api/admin/reports/jp", params={"year": now.year, "month": now.month, "group": "person"}).json()
    assert rows and rows[0]["rank"] == 1
    opd = admin.get(f"{BASE_URL}/api/admin/reports/jp", params={"year": now.year, "month": now.month, "group": "opd"}).json()
    assert opd and "avg_jp" in opd[0]
    for g in ("person", "opd"):
        for fmt in ("pdf", "xlsx"):
            r = admin.get(f"{BASE_URL}/api/admin/reports/jp/export", params={"year": now.year, "month": now.month, "group": g, "format": fmt})
            assert r.status_code == 200 and len(r.content) > 500
    assert peg.get(f"{BASE_URL}/api/admin/reports/jp", params={"year": now.year}).status_code == 403


# ---- Psy tests ----
def test_psy_pegawai_flow(peg):
    lst = peg.get(f"{BASE_URL}/api/psy-tests").json()
    t = next((x for x in lst if x["title"] == "Tes Gaya Kerja ASN (Contoh)"), None)
    assert t and t["question_count"] == 8
    full = peg.get(f"{BASE_URL}/api/psy-tests/{t['id']}").json()
    assert "scores" not in str(full["questions"])
    qs = full["questions"]
    r = peg.post(f"{BASE_URL}/api/psy-tests/{t['id']}/submit", json={"answers": {qs[0]["id"]: 4}})
    assert r.status_code == 400
    r = peg.post(f"{BASE_URL}/api/psy-tests/{t['id']}/submit", json={"answers": {q["id"]: 4 for q in qs}})
    assert r.status_code == 200
    res = r.json()
    STATE.setdefault("psy_results", []).append(res["id"])
    assert len(res["dimensions"]) == 4 and all(d["percent"] == 100 and d["level"] == "Tinggi" for d in res["dimensions"])
    assert any(x["id"] == res["id"] for x in peg.get(f"{BASE_URL}/api/psy-results/mine").json())


def test_psy_admin_crud(admin, peg):
    body = {"title": "TEST_Psy", "description": "d", "published": True,
            "dimensions": [{"id": "d1", "name": "A"}, {"id": "d2", "name": "B"}],
            "questions": [{"text": "q1", "options": [{"text": "x", "scores": {"d1": 2}}, {"text": "y", "scores": {"d2": 2, "zz": 5}}]}]}
    assert peg.post(f"{BASE_URL}/api/admin/psy-tests", json=body).status_code == 403
    assert admin.post(f"{BASE_URL}/api/admin/psy-tests", json={**body, "questions": []}).status_code == 400
    r = admin.post(f"{BASE_URL}/api/admin/psy-tests", json=body)
    assert r.status_code == 200
    t = r.json()
    assert "zz" not in t["questions"][0]["options"][1]["scores"]
    r = admin.put(f"{BASE_URL}/api/admin/psy-tests/{t['id']}", json={**body, "title": "TEST_Psy2"})
    assert r.status_code == 200 and r.json()["title"] == "TEST_Psy2"
    qid = r.json()["questions"][0]["id"]
    rs = peg.post(f"{BASE_URL}/api/psy-tests/{t['id']}/submit", json={"answers": {qid: 1}}).json()
    STATE.setdefault("psy_results", []).append(rs["id"])
    assert rs["dominant"] == "B"
    res = admin.get(f"{BASE_URL}/api/admin/psy-tests/{t['id']}/results").json()
    assert len(res) == 1 and res[0]["user_name"]
    assert admin.delete(f"{BASE_URL}/api/admin/psy-tests/{t['id']}").status_code == 200
    assert admin.get(f"{BASE_URL}/api/admin/psy-tests/{t['id']}").status_code == 404


# ---- Certificate preview ----
def test_cert_preview(admin, peg):
    r = admin.post(f"{BASE_URL}/api/certificates/preview", json={"title": "TEST", "kind": "zoom"})
    assert r.status_code == 200 and r.content[:4] == b"%PDF"
    assert peg.post(f"{BASE_URL}/api/certificates/preview", json={}).status_code == 403
    assert STATE["pic"].post(f"{BASE_URL}/api/certificates/preview", json={}).status_code == 403


def test_settings_landing_public():
    s = requests.get(f"{BASE_URL}/api/settings").json()
    assert "app_name" in s
    STATE["has_landing"] = "landing" in s
