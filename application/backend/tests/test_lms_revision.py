"""LMS Khidmat Kota Dumai - revision tests: support requests, proposals, zoom, certificates, backup."""
import io
import os
import uuid
import zipfile
from datetime import datetime, timezone

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ADMIN = {"identifier": "admin@dumaikota.go.id", "password": "AdminLMS2026!"}
PEGAWAI = {"identifier": "198504122010011002", "password": "Pegawai2026!"}
ROMAWI = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"]


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


@pytest.fixture(scope="module")
def created(admin):
    ids = {"courses": [], "support": []}
    yield ids
    for cid in ids["courses"]:
        admin.delete(f"{BASE_URL}/api/admin/courses/{cid}")
    for rid in ids["support"]:
        admin.delete(f"{BASE_URL}/api/admin/support-requests/{rid}")


# ---- Auth ----
def test_login_both_roles(admin, peg):
    assert admin.get(f"{BASE_URL}/api/auth/me").json()["role"] == "admin"
    assert peg.get(f"{BASE_URL}/api/auth/me").json()["role"] == "pegawai"


# ---- Support requests ----
def test_support_validation():
    r = requests.post(f"{BASE_URL}/api/support-requests", json={"name": " ", "contact": "x", "message": "y"})
    assert r.status_code == 400


def test_support_flow(admin, peg, created):
    r = requests.post(f"{BASE_URL}/api/support-requests", json={
        "name": "TEST_Support", "nip": "123", "contact": "08123", "category": "Lupa kata sandi", "message": "TEST lupa"})
    assert r.status_code == 200, r.text
    rid = r.json()["id"]
    created["support"].append(rid)
    lst = admin.get(f"{BASE_URL}/api/admin/support-requests").json()
    item = next(x for x in lst if x["id"] == rid)
    assert item["status"] == "new" and "ip" not in item
    r = admin.patch(f"{BASE_URL}/api/admin/support-requests/{rid}", json={"status": "done"})
    assert r.status_code == 200 and r.json()["status"] == "done"
    r = admin.patch(f"{BASE_URL}/api/admin/support-requests/{rid}", json={"status": "new"})
    assert r.json()["status"] == "new"
    assert admin.patch(f"{BASE_URL}/api/admin/support-requests/{rid}", json={"status": "bogus"}).status_code == 400
    assert peg.get(f"{BASE_URL}/api/admin/support-requests").status_code == 403
    assert admin.delete(f"{BASE_URL}/api/admin/support-requests/{rid}").status_code == 200
    assert not any(x["id"] == rid for x in admin.get(f"{BASE_URL}/api/admin/support-requests").json())


# ---- Pegawai course proposal ----
def _course_payload(title, **kw):
    p = {"title": title, "description": "d", "instructor": "Dinas Kominfo", "modules": [
        {"title": "M1", "type": "video", "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ", "body": "", "duration_min": 5}],
        "questions": []}
    p.update(kw)
    return p


def test_proposal_requires_instructor(peg):
    r = peg.post(f"{BASE_URL}/api/proposals", json=_course_payload("TEST_noinstr", instructor=""))
    assert r.status_code == 400
    assert "pengajar" in r.json()["detail"].lower()


def test_proposal_approve_flow(admin, peg, created):
    r = peg.post(f"{BASE_URL}/api/proposals", json=_course_payload("TEST_Usulan " + uuid.uuid4().hex[:5], published=True))
    assert r.status_code == 200, r.text
    c = r.json()
    created["courses"].append(c["id"])
    assert c["status"] == "pending" and c["published"] is False
    mine = peg.get(f"{BASE_URL}/api/proposals/mine").json()
    assert any(x["id"] == c["id"] and x["status"] == "pending" for x in mine)
    # not in catalog yet
    assert not any(x["id"] == c["id"] for x in peg.get(f"{BASE_URL}/api/courses").json())
    pend = admin.get(f"{BASE_URL}/api/admin/courses", params={"status": "pending"}).json()
    assert any(x["id"] == c["id"] for x in pend)
    r = admin.patch(f"{BASE_URL}/api/admin/courses/{c['id']}/review", json={"status": "approved"})
    assert r.status_code == 200 and r.json()["published"] is True
    assert any(x["id"] == c["id"] for x in peg.get(f"{BASE_URL}/api/courses").json())
    # approved proposal cannot be edited by pegawai
    assert peg.put(f"{BASE_URL}/api/proposals/{c['id']}", json=_course_payload("x")).status_code == 400


def test_proposal_reject_note(admin, peg, created):
    c = peg.post(f"{BASE_URL}/api/proposals", json=_course_payload("TEST_Reject")).json()
    created["courses"].append(c["id"])
    r = admin.patch(f"{BASE_URL}/api/admin/courses/{c['id']}/review", json={"status": "rejected", "review_note": "TEST alasan"})
    assert r.status_code == 200
    mine = next(x for x in peg.get(f"{BASE_URL}/api/proposals/mine").json() if x["id"] == c["id"])
    assert mine["status"] == "rejected" and mine["review_note"] == "TEST alasan"


# ---- Custom certificate numbering ----
def test_course_custom_cert_number(admin, peg, created):
    payload = _course_payload("TEST_CertFmt", certificate={"number_format": "{NO}/BKPSDM/{BULAN}/{TAHUN}", "number_start": 41,
                                                           "signer_name": "TEST Signer", "signer_title": "Kepala"})
    c = admin.post(f"{BASE_URL}/api/admin/courses", json=payload).json()
    created["courses"].append(c["id"])
    assert c["certificate"]["number_start"] == 41
    assert peg.post(f"{BASE_URL}/api/courses/{c['id']}/enroll").status_code == 200
    mid = c["modules"][0]["id"]
    e = peg.post(f"{BASE_URL}/api/courses/{c['id']}/modules/{mid}/complete").json()
    now = datetime.now(timezone.utc)
    assert e["status"] == "completed"
    assert e["certificate_no"] == f"041/BKPSDM/{ROMAWI[now.month - 1]}/{now.year}", e["certificate_no"]
    pdf = peg.get(f"{BASE_URL}/api/certificates/{e['id']}/pdf")
    assert pdf.status_code == 200 and pdf.content[:4] == b"%PDF"
    created["cert_enrollment"] = e["id"]


def test_certificate_preview(admin, peg):
    body = {"title": "TEST Preview", "kind": "course", "certificate": {"number_format": "{NO}/X/{TAHUN}", "number_start": 5,
                                                                     "signer_name": "A", "signer_title": "B"}}
    for s in (admin, peg):
        r = s.post(f"{BASE_URL}/api/certificates/preview", json=body)
        assert r.status_code == 200 and r.headers["content-type"].startswith("application/pdf") and r.content[:4] == b"%PDF"
    assert requests.post(f"{BASE_URL}/api/certificates/preview", json=body).status_code == 401


def test_edit_cert_number(admin, peg, created):
    eid = created.get("cert_enrollment")
    if not eid:
        pytest.skip("no cert")
    new_no = "TEST/" + uuid.uuid4().hex[:6]
    r = admin.patch(f"{BASE_URL}/api/admin/certificates/{eid}", json={"certificate_no": new_no})
    assert r.status_code == 200
    certs = admin.get(f"{BASE_URL}/api/admin/certificates").json()
    assert next(x for x in certs if x["id"] == eid)["certificate_no"] == new_no
    other = next((x for x in certs if x["id"] != eid), None)
    if other:
        r = admin.patch(f"{BASE_URL}/api/admin/certificates/{eid}", json={"certificate_no": other["certificate_no"]})
        assert r.status_code == 400
    assert admin.patch(f"{BASE_URL}/api/admin/certificates/{eid}", json={"certificate_no": "  "}).status_code == 400
    assert peg.patch(f"{BASE_URL}/api/admin/certificates/{eid}", json={"certificate_no": "Z"}).status_code == 403


# ---- Zoom ----
def test_zoom_flow(admin, peg, created):
    base = {"title": "TEST_Zoom", "instructor": "Dinas Kominfo", "kind": "zoom", "start_at": "2026-02-01T09:00"}
    assert admin.post(f"{BASE_URL}/api/admin/courses", json={**base, "start_at": ""}).status_code == 400
    # pegawai proposes zoom without link -> admin can't approve until link set
    p = peg.post(f"{BASE_URL}/api/proposals", json=base).json()
    created["courses"].append(p["id"])
    r = admin.patch(f"{BASE_URL}/api/admin/courses/{p['id']}/review", json={"status": "approved"})
    assert r.status_code == 400
    # admin creates zoom class with link
    z = admin.post(f"{BASE_URL}/api/admin/courses", json={**base, "zoom_url": "https://zoom.us/j/123", "passcode": "abc"}).json()
    created["courses"].append(z["id"])
    lst = peg.get(f"{BASE_URL}/api/zoom").json()
    item = next(x for x in lst if x["id"] == z["id"])
    assert "zoom_url" not in item and item["enrollment"] is None
    assert peg.post(f"{BASE_URL}/api/courses/{z['id']}/enroll").status_code == 200
    item = next(x for x in peg.get(f"{BASE_URL}/api/zoom").json() if x["id"] == z["id"])
    assert item["zoom_url"] == "https://zoom.us/j/123"
    parts = admin.get(f"{BASE_URL}/api/admin/courses/{z['id']}/participants").json()
    uid = parts[0]["user_id"]
    r = admin.post(f"{BASE_URL}/api/admin/courses/{z['id']}/attendance", json={"user_id": uid, "present": True})
    assert r.status_code == 200 and r.json()["status"] == "completed" and r.json()["certificate_no"]
    eid = r.json()["id"]
    assert peg.get(f"{BASE_URL}/api/certificates/{eid}/pdf").content[:4] == b"%PDF"
    done = peg.get(f"{BASE_URL}/api/my/enrollments", params={"status": "completed"}).json()
    assert any(x["id"] == eid for x in done)
    assert any(x["id"] == eid for x in admin.get(f"{BASE_URL}/api/admin/certificates").json())
    r = admin.post(f"{BASE_URL}/api/admin/courses/{z['id']}/attendance", json={"user_id": uid, "present": False})
    assert r.json()["status"] == "ongoing" and r.json()["certificate_no"] is None
    # attendance on non-zoom course
    assert admin.post(f"{BASE_URL}/api/admin/courses/nonexistent/attendance", json={"user_id": uid, "present": True}).status_code == 404
    # cleanup enrollment for zoom (ongoing removed on course delete)


# ---- KMS video ----
def test_reading_video(admin):
    r = admin.post(f"{BASE_URL}/api/readings", json={"title": "TEST_Video", "video_url": "https://youtu.be/dQw4w9WgXcQ",
                                                     "link_url": "https://example.com/a.pdf"})
    assert r.status_code == 200
    rid = r.json()["id"]
    g = admin.get(f"{BASE_URL}/api/readings/{rid}").json()
    assert g["video_url"] == "https://youtu.be/dQw4w9WgXcQ"
    admin.delete(f"{BASE_URL}/api/admin/readings/{rid}")


# ---- Backup ----
@pytest.mark.parametrize("kind", ["database", "application", "full"])
def test_backup(admin, kind):
    r = admin.get(f"{BASE_URL}/api/admin/backup/{kind}", timeout=120)
    assert r.status_code == 200, r.text[:200]
    assert r.headers["content-type"] == "application/zip"
    z = zipfile.ZipFile(io.BytesIO(r.content))
    names = z.namelist()
    assert "RESTORE.md" in names
    assert not any(n.endswith("/.env") for n in names)
    if kind in ("database", "full"):
        assert "database/users.json" in names
    if kind in ("application", "full"):
        assert any(n.startswith("application/backend/server.py") for n in names)
        assert not any("node_modules" in n for n in names)


def test_backup_forbidden(peg):
    for k in ("database", "application", "full", "info"):
        assert peg.get(f"{BASE_URL}/api/admin/backup/{k}").status_code == 403
    assert requests.get(f"{BASE_URL}/api/admin/backup/database").status_code == 401
