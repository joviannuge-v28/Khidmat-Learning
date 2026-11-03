# Regression tests: PostgreSQL migration (pgdb layer), lockout removal, admin notifications/badges, survey, OPD filter
import io
import os
import time
import zipfile
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
ST = {}


def login(ident, pw):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"identifier": ident, "password": pw})
    assert r.status_code == 200, f"login {ident} {r.status_code} {r.text}"
    return s


@pytest.fixture(scope="module")
def sup():
    return login(*SUPER)


@pytest.fixture(scope="module")
def adm():
    return login(*ADMIN)


@pytest.fixture(scope="module")
def peg():
    return login(*PEG)


# ---- Auth ----
class TestAuth:
    def test_login_email_and_me(self, sup):
        r = sup.get(f"{API}/auth/me")
        assert r.status_code == 200 and r.json()["role"] == "superadmin"
        assert "password_hash" not in r.json() and "_id" not in r.json()

    def test_login_nip(self, peg):
        r = peg.get(f"{API}/auth/me")
        assert r.status_code == 200 and r.json()["nip"] == PEG[0]

    def test_no_lockout_after_7_failures(self):
        # use a TEST_ user to avoid polluting real accounts
        s = login(*SUPER)
        email = f"test_lock_{TS}@example.com"
        r = s.post(f"{API}/admin/users", json={"name": f"TEST_Lock {TS}", "email": email, "nip": f"9999{TS}01", "role": "pegawai",
                                               "unit_kerja": "TEST_OPD", "password": "TestPass123!"})
        assert r.status_code == 200, r.text
        uid = r.json()["id"]
        try:
            codes = [requests.post(f"{API}/auth/login", json={"identifier": email, "password": "wrong!"}).status_code for _ in range(7)]
            assert codes == [401] * 7, codes
            ok = requests.post(f"{API}/auth/login", json={"identifier": email, "password": "TestPass123!"})
            assert ok.status_code == 200, ok.text
        finally:
            s.delete(f"{API}/admin/users/{uid}")

    def test_wrong_password_401(self):
        r = requests.post(f"{API}/auth/login", json={"identifier": "nobody_x@example.com", "password": "x"})
        assert r.status_code == 401


# ---- Core read endpoints ----
class TestCore:
    def test_settings(self):
        r = requests.get(f"{API}/settings")
        assert r.status_code == 200 and r.json().get("key") == "main"

    def test_courses_and_categories(self, peg):
        r = peg.get(f"{API}/courses")
        assert r.status_code == 200 and isinstance(r.json(), list) and len(r.json()) >= 1
        ST["course_id"] = r.json()[0]["id"]
        c = peg.get(f"{API}/categories")
        assert c.status_code == 200 and len(c.json()) >= 1

    def test_course_detail(self, peg):
        r = peg.get(f"{API}/courses/{ST['course_id']}")
        assert r.status_code == 200 and r.json()["id"] == ST["course_id"]

    def test_readings(self, peg, adm):
        assert peg.get(f"{API}/readings").status_code == 200
        assert adm.get(f"{API}/admin/readings").status_code == 200

    def test_admin_misc(self, sup):
        for p in ["/admin/stats", "/admin/certificates", "/admin/reports/jp?year=2026", "/admin/reports/jp/export?year=2026", "/admin/users/import-logs", "/admin/support-requests", "/public/stats", "/admin/stats/learning-hours?year=2026", "/signers", "/admin/backup/info", "/psy-tests", "/admin/activity-logs",
                  "/admin/security/overview", "/admin/backups", "/admin/courses", "/my/enrollments", "/my/dashboard"]:
            r = sup.get(f"{API}{p}")
            assert r.status_code == 200, f"{p} {r.status_code} {r.text[:200]}"

    def test_security_overview_no_locked(self, sup):
        d = sup.get(f"{API}/admin/security/overview").json()
        assert "locked" not in d and "locked_accounts" not in d, list(d.keys())

    def test_backup_database_zip(self, sup):
        r = sup.get(f"{API}/admin/backup/database")
        assert r.status_code == 200
        z = zipfile.ZipFile(io.BytesIO(r.content))
        assert any("users" in n for n in z.namelist()), z.namelist()[:20]


# ---- Users CRUD + OPD filter + enroll/badges ----
class TestUsers:
    def test_create_user(self, adm):
        r = adm.post(f"{API}/admin/users", json={"name": f"TEST_User {TS}", "email": f"test_u_{TS}@example.com", "nip": f"9999{TS}02",
                                                 "role": "pegawai", "unit_kerja": "TEST_OPD Zeta", "password": "TestPass123!"})
        assert r.status_code == 200, r.text
        ST["uid"] = r.json()["id"]

    def test_update_user_persist(self, adm):
        r = adm.put(f"{API}/admin/users/{ST['uid']}", json={"name": f"TEST_User {TS} Upd", "email": f"test_u_{TS}@example.com",
                                                            "nip": f"9999{TS}02", "role": "pegawai", "unit_kerja": "TEST_OPD Zeta"})
        assert r.status_code == 200 and r.json()["name"].endswith("Upd")
        lst = adm.get(f"{API}/admin/users", params={"search": f"TEST_User {TS}"}).json()
        assert any(u["id"] == ST["uid"] and u["name"].endswith("Upd") for u in lst)

    def test_opd_list(self, adm):
        r = adm.get(f"{API}/admin/users/opd")
        assert r.status_code == 200
        names = {o["name"]: o["count"] for o in r.json()}
        assert names.get("TEST_OPD Zeta") == 1

    def test_unit_filter_case_insensitive(self, adm):
        r = adm.get(f"{API}/admin/users", params={"unit": "test_opd zeta"})
        assert r.status_code == 200 and [u["id"] for u in r.json()] == [ST["uid"]]
        r2 = adm.get(f"{API}/admin/users", params={"unit": "bkpsdm"})
        assert r2.status_code == 200 and all("bkpsdm" in (u.get("unit_kerja") or "").lower() for u in r2.json())

    def test_export_with_unit(self, adm):
        r = adm.get(f"{API}/admin/users/export", params={"search": "", "unit": "TEST_OPD Zeta"})
        assert r.status_code == 200 and r.content[:2] == b"PK"
        from openpyxl import load_workbook
        ws = load_workbook(io.BytesIO(r.content)).active
        assert ws.max_row == 2 and ws.cell(row=2, column=1).value.startswith("TEST_User")

    def test_enroll_and_badges(self):
        s = login(f"test_u_{TS}@example.com", "TestPass123!")
        b0 = s.get(f"{API}/my/badges").json()
        assert b0 == {"ongoing": 0}
        r = s.post(f"{API}/courses/{ST['course_id']}/enroll")
        assert r.status_code == 200 and r.json()["status"] == "ongoing"
        b1 = s.get(f"{API}/my/badges").json()
        assert b1["ongoing"] == 1 and "support_new" not in b1

    def test_pegawai_cannot_admin(self, peg):
        assert peg.get(f"{API}/admin/users").status_code == 403

    def test_delete_user(self, adm):
        r = adm.delete(f"{API}/admin/users/{ST['uid']}")
        assert r.status_code == 200
        lst = adm.get(f"{API}/admin/users", params={"search": f"TEST_User {TS}"}).json()
        assert not any(u["id"] == ST["uid"] for u in lst)


# ---- Support requests + admin notifications ----
class TestSupport:
    def test_create_and_notify(self, adm):
        before = adm.get(f"{API}/my/badges").json()["support_new"]
        r = requests.post(f"{API}/support-requests", json={"name": f"TEST_Lapor {TS}", "whatsapp": "081234567890", "category": "Lupa kata sandi",
                                                          "message": "TEST message"})
        assert r.status_code == 200, r.text
        ST["sid"] = r.json()["id"]
        after = adm.get(f"{API}/my/badges").json()["support_new"]
        assert after == before + 1
        notes = adm.get(f"{API}/my/notifications").json()
        sup_notes = [n for n in notes if n["type"] == "support"]
        assert any(n["id"] == f"support-{ST['sid']}" and n["link"] == "/admin/laporan" for n in sup_notes)
        assert len(sup_notes) == after

    def test_pegawai_no_support_notes(self, peg):
        notes = peg.get(f"{API}/my/notifications").json()
        assert not any(n["type"] == "support" for n in notes)

    def test_list_and_patch(self, adm):
        lst = adm.get(f"{API}/admin/support-requests").json()
        assert any(x["id"] == ST["sid"] for x in lst) and all("ip" not in x for x in lst)
        r = adm.patch(f"{API}/admin/support-requests/{ST['sid']}", json={"status": "done", "admin_note": "ok"})
        assert r.status_code == 200 and r.json()["status"] == "done"
        notes = adm.get(f"{API}/my/notifications").json()
        assert not any(n["id"] == f"support-{ST['sid']}" for n in notes)

    def test_delete(self, adm):
        assert adm.delete(f"{API}/admin/support-requests/{ST['sid']}").status_code == 200


# ---- Survey ----
class TestSurvey:
    def test_get_public(self):
        r = requests.get(f"{API}/public/survey")
        assert r.status_code == 200 and "items" in r.json()
        ST["survey_orig"] = r.json()

    def test_reject_bad_url(self, adm):
        r = adm.put(f"{API}/admin/survey", json={"title": "T", "items": [{"label": "x", "url": "ftp://x"}]})
        assert r.status_code == 400

    def test_reject_empty(self, adm):
        r = adm.put(f"{API}/admin/survey", json={"title": "T", "items": [{"label": "x", "url": ""}]})
        assert r.status_code == 400

    def test_pegawai_forbidden(self, peg):
        assert peg.put(f"{API}/admin/survey", json={"items": []}).status_code == 403

    def test_save_and_qr(self, adm):
        r = adm.put(f"{API}/admin/survey", json={"title": "TEST_Survei", "description": "d", "show_in_footer": True,
                                                  "items": [{"label": "TEST_SKM", "url": "https://example.com/skm"}]})
        assert r.status_code == 200
        pub = requests.get(f"{API}/public/survey").json()
        assert pub["items"][0]["url"] == "https://example.com/skm" and pub["title"] == "TEST_Survei"
        q = requests.get(f"{API}/public/survey/0/qr")
        assert q.status_code == 200 and q.headers["content-type"] == "image/png" and q.content[:4] == b"\x89PNG"
        assert requests.get(f"{API}/public/survey/5/qr").status_code == 404
        # settings still intact (survey stored inside settings main)
        s = requests.get(f"{API}/settings").json()
        assert s.get("key") == "main" and "app_name" in s or "landing" in s

    def test_restore(self, adm):
        o = ST.get("survey_orig") or {}
        r = adm.put(f"{API}/admin/survey", json={"title": o.get("title", "Survei Kepuasan Masyarakat"), "description": o.get("description", ""),
                                                  "items": o.get("items", []), "show_in_footer": o.get("show_in_footer", True)})
        assert r.status_code == 200
