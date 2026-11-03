# Regression tests for LMS Khidmat Kota Dumai - 36 improvements revision (roles, password policy, PIC, webinars, cert, backup, security)
# NOTE: tests share state sequentially -> run with `-n 0` (pytest.ini enables xdist)
import io
import os
import time
import json
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    for line in open("/app/frontend/.env"):
        if line.startswith("REACT_APP_BACKEND_URL="):
            BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
API = f"{BASE_URL}/api"

SUPER = ("admin@dumaikota.go.id", "AdminLMS2026!")
ADMIN = ("admin.bkpsdm@dumaikota.go.id", "AdminBKPSDM2026!")
PEG = ("198504122010011002", "Pegawai2026!")
TS = str(int(time.time()))[-6:]
STRONG = "Dumai#Kuat2026x"
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 64
STATE = {}


def login(ident, pw):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"identifier": ident, "password": pw})
    assert r.status_code == 200, f"login {ident} failed {r.status_code} {r.text}"
    tok = s.cookies.get("access_token")
    if tok:
        s.headers["Authorization"] = f"Bearer {tok}"
    s.user = r.json()
    return s


@pytest.fixture(scope="session")
def sup():
    return login(*SUPER)


@pytest.fixture(scope="session")
def adm():
    return login(*ADMIN)


@pytest.fixture(scope="session", autouse=True)
def cleanup(request):
    yield
    try:
        s = login(*SUPER)
        for u in s.get(f"{API}/admin/users", params={"search": "TEST_"}).json():
            if u["name"].startswith("TEST_"):
                s.delete(f"{API}/admin/users/{u['id']}")
        for kind in ("course", "zoom"):
            for c in s.get(f"{API}/admin/courses", params={"kind": kind}).json():
                if c["title"].startswith("TEST_"):
                    s.delete(f"{API}/admin/courses/{c['id']}")
        for r in s.get(f"{API}/admin/support-requests").json():
            if r["name"].startswith("TEST_"):
                s.delete(f"{API}/admin/support-requests/{r['id']}")
        if "orig_cert" in STATE:
            o = STATE["orig_cert"]
            s.put(f"{API}/admin/cert-design", json={"cert_layout": o.get("cert_layout") or {}, "signers": o.get("signers") or []})
            # cert-design keeps legacy signer_name/title from first signer -> restore them explicitly
            s.put(f"{API}/admin/settings", json={"app_name": o["app_name"], "signer_name": o["signer_name"],
                                                 "signer_title": o["signer_title"], "signature_path": o["signature_path"]})
    except Exception as e:
        print("cleanup error", e)


# --- Roles & RBAC
class TestRoles:
    def test_roles(self, sup, adm):
        assert sup.user["role"] == "superadmin"
        assert adm.user["role"] == "admin"

    @pytest.mark.parametrize("method,path", [("put", "/admin/settings"), ("get", "/admin/backups"), ("get", "/admin/smtp"),
                                             ("get", "/admin/security/overview"), ("get", "/admin/activity-logs")])
    def test_admin_forbidden_super_endpoints(self, adm, method, path):
        kw = {"json": {"app_name": "x"}} if method == "put" else {}
        r = getattr(adm, method)(f"{API}{path}", **kw)
        assert r.status_code == 403, r.text

    def test_admin_forbidden_asn_report(self, adm, sup):
        uid = sup.user["id"]
        assert adm.get(f"{API}/admin/users/{uid}/report").status_code == 403
        r = sup.get(f"{API}/admin/users/{uid}/report")
        assert r.status_code == 200 and r.content[:4] == b"%PDF"

    def test_cron_unauth(self):
        assert requests.post(f"{API}/cron/monthly-backup").status_code == 401
        assert requests.post(f"{API}/cron/monthly-backup", headers={"Authorization": "Bearer wrong"}).status_code == 401

    def test_security_headers(self):
        r = requests.get(f"{API}/settings")
        assert r.headers.get("X-Content-Type-Options") == "nosniff"
        assert "X-Frame-Options" in r.headers


# --- New user onboarding & password policy
class TestPasswordPolicy:
    def test_create_simple_default(self, adm):
        nip = f"TEST{TS}01"
        r = adm.post(f"{API}/admin/users", json={"name": f"TEST_Pegawai {TS}", "nip": nip, "email": f"test_peg{TS}@example.com",
                                                 "role": "pegawai", "password": "abc123", "unit_kerja": "TEST_UNIT"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d.get("must_change_password") is True
        STATE["peg_id"], STATE["peg_nip"] = d["id"], nip

    def test_weak_rejected_strong_ok(self):
        s = login(STATE["peg_nip"], "abc123")
        assert s.user.get("must_change_password") is True
        for weak in ("password123", "short1!", "abcdefghijk", "Abcdefghij12"):
            r = s.put(f"{API}/profile/password", json={"old_password": "abc123", "new_password": weak})
            assert r.status_code == 400, f"{weak} accepted"
        r = s.put(f"{API}/profile/password", json={"old_password": "abc123", "new_password": STRONG})
        assert r.status_code == 200, r.text
        assert r.json()["must_change_password"] is False
        STATE["peg"] = login(STATE["peg_nip"], STRONG)

    def test_profile_gelar_whatsapp(self):
        s = STATE["peg"]
        r = s.put(f"{API}/profile", json={"name": f"TEST_Pegawai {TS}", "gelar_depan": "Dr.", "gelar_belakang": "S.Kom",
                                          "whatsapp": "081234567890", "jabatan": "Staf", "unit_kerja": "TEST_UNIT"})
        assert r.status_code == 200, r.text
        assert r.json()["whatsapp"] == "081234567890" and r.json()["gelar_depan"] == "Dr."
        r = s.put(f"{API}/profile", json={"name": f"TEST_Pegawai {TS}", "whatsapp": "abc"})
        assert r.status_code == 400
        r = s.put(f"{API}/profile", json={"name": f"TEST_Pegawai {TS}", "whatsapp": "081234567890"})
        assert r.status_code == 200 and r.json()["gelar_depan"] == ""

    def test_email_verification_unavailable(self):
        s = STATE["peg"]
        st = s.get(f"{API}/email-verification/status").json()
        assert st["available"] is False
        r = s.post(f"{API}/profile/email/send-verification")
        assert r.status_code == 400 and "belum bisa digunakan" in r.json()["detail"]

    def test_admin_approve_email_and_search_nip(self, adm):
        before = adm.get(f"{API}/admin/stats").json()
        r = adm.patch(f"{API}/admin/users/{STATE['peg_id']}/email", json={"approve": True})
        assert r.status_code == 200 and r.json()["email_verified"] is True
        after = adm.get(f"{API}/admin/stats").json()
        assert after["verified"] == before["verified"] + 1
        res = adm.get(f"{API}/admin/users", params={"search": STATE["peg_nip"]}).json()
        assert len(res) == 1 and res[0]["id"] == STATE["peg_id"]


# --- Upload security
class TestUpload:
    def test_fake_png_rejected(self, adm):
        r = adm.post(f"{API}/upload", files={"file": ("x.png", b"hello this is text", "image/png")})
        assert r.status_code == 400

    def test_real_png_ok(self, adm):
        r = adm.post(f"{API}/upload", files={"file": ("ok.png", PNG, "image/png")})
        assert r.status_code == 200, r.text
        STATE["png_path"] = r.json()["path"]

    def test_pdf_material_ok(self, adm):
        r = adm.post(f"{API}/upload", files={"file": ("m.pdf", b"%PDF-1.4\n%test\n", "application/pdf")})
        assert r.status_code == 200, r.text
        STATE["pdf_path"] = r.json()["path"]


# --- Lapor Admin
class TestSupport:
    def test_missing_whatsapp(self):
        r = requests.post(f"{API}/support-requests", json={"name": "TEST_x", "message": "tolong"})
        assert r.status_code in (400, 422)

    def test_invalid_whatsapp(self):
        r = requests.post(f"{API}/support-requests", json={"name": "TEST_x", "whatsapp": "abc", "message": "tolong"})
        assert r.status_code == 400

    def test_valid(self):
        r = requests.post(f"{API}/support-requests", json={"name": f"TEST_lapor{TS}", "whatsapp": "081234567890", "message": "tolong reset"})
        assert r.status_code == 200, r.text


# --- Course quiz shuffle & webinar materials
class TestCourses:
    def test_course_quiz_shuffle_and_pass(self, adm):
        body = {"title": f"TEST_Course {TS}", "instructor": "TEST", "duration_hours": 2, "kind": "course", "published": True,
                "materials": [{"path": STATE.get("pdf_path", ""), "name": "m.pdf"}],
                "modules": [{"title": "M1", "type": "text", "body": "x"}],
                "questions": [{"question": f"Q{i}", "options": ["a", "b", "c", "d"], "answer_index": i % 4} for i in range(4)]}
        r = adm.post(f"{API}/admin/courses", json=body)
        assert r.status_code == 200, r.text
        c = r.json()
        STATE["course_id"] = c["id"]
        key = {q["question"]: q["answer_index"] for q in c["questions"]}
        s = STATE["peg"]
        d = s.get(f"{API}/courses/{c['id']}").json()
        assert all("answer_index" not in q for q in d["questions"])
        assert all(sorted(q["option_ids"]) == [0, 1, 2, 3] for q in d["questions"])
        assert s.post(f"{API}/courses/{c['id']}/enroll").status_code == 200
        mid = c["modules"][0]["id"]
        assert s.post(f"{API}/courses/{c['id']}/modules/{mid}/complete").status_code == 200
        answers = {}
        for q in d["questions"]:
            orig = key[q["question"]]
            pos = q["option_ids"].index(orig)
            answers[q["id"]] = q["option_ids"][pos]
        r = s.post(f"{API}/courses/{c['id']}/quiz", json={"answers": answers})
        assert r.status_code == 200 and r.json()["passed"] is True and r.json()["score"] == 100


# --- PIC flows
class TestPIC:
    def test_create_pic(self, adm):
        r = adm.post(f"{API}/admin/users", json={"name": f"TEST_PIC {TS}", "nip": f"TEST{TS}02", "role": "pic",
                                                 "password": "abc123", "unit_kerja": f"TEST_OPD{TS}"})
        assert r.status_code == 200, r.text
        STATE["pic_id"] = r.json()["id"]
        STATE["pic"] = login(f"TEST{TS}02", "abc123")

    def test_pic_cannot_enroll(self):
        r = STATE["pic"].post(f"{API}/courses/{STATE['course_id']}/enroll")
        assert r.status_code == 403

    def test_pic_proposes_webinar_and_manages(self, sup):
        pic = STATE["pic"]
        r = pic.post(f"{API}/proposals", json={"title": f"TEST_Webinar {TS}", "instructor": "TEST OPD", "kind": "zoom",
                                              "start_at": "2026-02-01T09:00", "zoom_url": "https://zoom.us/j/123",
                                              "materials": [{"path": STATE.get("pdf_path", ""), "name": "m.pdf"}]})
        assert r.status_code == 200, r.text
        wid = r.json()["id"]
        STATE["web_id"] = wid
        r = sup.patch(f"{API}/admin/courses/{wid}/review", json={"status": "approved"})
        assert r.status_code == 200 and r.json()["published"] is True
        peg = STATE["peg"]
        assert peg.post(f"{API}/courses/{wid}/enroll").status_code == 200
        z = [x for x in peg.get(f"{API}/zoom").json() if x["id"] == wid][0]
        assert z["materials"] and z["materials"][0]["name"] == "m.pdf"
        parts = pic.get(f"{API}/admin/courses/{wid}/participants")
        assert parts.status_code == 200 and any(p["user_id"] == STATE["peg_id"] for p in parts.json())
        r = pic.post(f"{API}/admin/courses/{wid}/attendance", json={"user_id": STATE["peg_id"], "present": True})
        assert r.status_code == 200 and r.json()["status"] == "completed"
        r = pic.post(f"{API}/admin/courses/{wid}/attendance", json={"user_id": STATE["peg_id"], "present": False})
        assert r.status_code == 200 and r.json()["status"] == "ongoing"
        assert pic.get(f"{API}/admin/courses/{STATE['course_id']}/participants").status_code == 404
        assert pic.post(f"{API}/admin/courses/{STATE['course_id']}/attendance", json={"user_id": STATE["peg_id"], "present": True}).status_code == 404


# --- Certificate design
class TestCert:
    def test_cert_design_admin(self, adm):
        orig = adm.get(f"{API}/settings").json()
        STATE["orig_cert"] = {"cert_layout": orig.get("cert_layout") or {}, "signers": orig.get("signers") or [],
                              **{k: orig.get(k) or "" for k in ("app_name", "signer_name", "signer_title", "signature_path")}}
        signers = list(orig.get("signers") or []) + [{"name": f"TEST_Signer {TS}", "title": "Kepala", "pangkat": "Pembina", "nip": "197001012000011001"}]
        layout = dict(orig.get("cert_layout") or {})
        layout["custom_texts"] = [{"id": "t1", "text": "TEST custom", "x": 50, "y": 80, "size": 14, "font": "Times-Roman", "color": "#000000"}]
        r = adm.put(f"{API}/admin/cert-design", json={"cert_layout": layout, "signers": signers})
        assert r.status_code == 200, r.text
        sg = [x for x in r.json()["signers"] if x["name"] == f"TEST_Signer {TS}"][0]
        assert sg["pangkat"] == "Pembina" and sg["nip"] == "197001012000011001"
        lst = adm.get(f"{API}/signers").json()
        assert any(x["id"] == sg["id"] for x in lst)
        r = adm.post(f"{API}/certificates/preview", json={"title": "TEST", "kind": "course", "layout": layout, "signer_id": sg["id"]})
        assert r.status_code == 200 and r.content[:4] == b"%PDF"


# --- Superadmin tools
class TestSuperTools:
    def test_security_overview(self, sup):
        r = sup.get(f"{API}/admin/security/overview")
        assert r.status_code == 200 and "failed_24h" in r.json() and r.json()["smtp_configured"] is False

    def test_activity_logs_export(self, sup):
        logs = sup.get(f"{API}/admin/activity-logs").json()
        assert isinstance(logs, list) and len(logs) > 0
        r = sup.get(f"{API}/admin/activity-logs/export", params={"format": "pdf"})
        assert r.status_code == 200 and r.content[:4] == b"%PDF"
        r = sup.get(f"{API}/admin/activity-logs/export", params={"format": "xlsx"})
        assert r.status_code == 200 and r.content[:2] == b"PK"

    def test_backup_create_download(self, sup):
        r = sup.post(f"{API}/admin/backups", timeout=180)
        assert r.status_code == 200, r.text
        bid = r.json()["id"]
        assert any(b["id"] == bid for b in sup.get(f"{API}/admin/backups").json())
        d = sup.get(f"{API}/admin/backups/{bid}/download", timeout=180)
        assert d.status_code == 200 and d.content[:2] == b"PK"

    def test_restore_categories_json(self, sup):
        cats = sup.get(f"{API}/categories").json()
        assert cats, "no categories to restore"
        payload = json.dumps({"categories": cats}).encode()
        r = sup.post(f"{API}/admin/backups/restore", files={"file": ("cats.json", payload, "application/json")})
        assert r.status_code == 200, r.text
        assert r.json()["collections"] == ["categories"]
        after = sup.get(f"{API}/categories").json()
        assert len(after) == len(cats)

    def test_stats_and_visits(self, adm):
        assert requests.post(f"{API}/public/visit", json={"visitor_id": f"test-{TS}"}).status_code == 200
        s = requests.get(f"{API}/public/stats").json()
        assert s["today"] >= 1 and "kms_views" in s and "last30" in s
        r = adm.get(f"{API}/admin/stats/learning-hours", params={"year": 2026})
        assert r.status_code == 200 and len(r.json()["months"]) == 12
        r = adm.get(f"{API}/admin/reports/visits/export")
        assert r.status_code == 200 and r.content[:4] == b"%PDF"

    def test_admin_cannot_edit_superadmin(self, adm, sup):
        r = adm.patch(f"{API}/admin/users/{sup.user['id']}/email", json={"approve": True})
        assert r.status_code == 403
