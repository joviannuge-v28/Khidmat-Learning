# Iteration 2: survey redirect tracking, survey stats, manual respondents, OPD PDF report
import io
import os
import subprocess
from datetime import datetime, timedelta, timezone

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    for line in open("/app/frontend/.env"):
        if line.startswith("REACT_APP_BACKEND_URL="):
            BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
API = f"{BASE_URL}/api"
SURVEY_URL = "https://example.com/TEST_survey_form"
NOW = datetime.now(timezone(timedelta(hours=7)))
YEAR, MONTH = NOW.year, NOW.month


def login(identifier, password):
    s = requests.Session()
    r = s.post(f"{API}/auth/login", json={"identifier": identifier, "password": password})
    assert r.status_code == 200, r.text
    return s


@pytest.fixture(scope="module")
def admin():
    return login("admin.bkpsdm@dumaikota.go.id", "AdminBKPSDM2026!")


@pytest.fixture(scope="module")
def pegawai():
    return login("198504122010011002", "Pegawai2026!")


@pytest.fixture(scope="module")
def survey_item(admin):
    orig = admin.get(f"{API}/public/survey").json()
    payload = {"title": orig.get("title"), "description": orig.get("description", ""), "show_in_footer": orig.get("show_in_footer", True),
               "items": [{"label": "TEST_Survei", "url": SURVEY_URL, "qr_path": "", "description": "TEST"}]}
    r = admin.put(f"{API}/admin/survey", json=payload)
    assert r.status_code == 200, r.text
    yield
    restore = {k: orig.get(k) for k in ("title", "description", "show_in_footer")}
    restore["items"] = orig.get("items", [])
    admin.put(f"{API}/admin/survey", json=restore)
    subprocess.run(["su", "postgres", "-c", "psql -h /var/run/postgresql -d lms_khidmat -c 'DELETE FROM survey_clicks; DELETE FROM survey_respondents;'"], capture_output=True)


def stats(admin, year=YEAR):
    r = admin.get(f"{API}/admin/survey/stats", params={"year": year})
    assert r.status_code == 200, r.text
    return r.json()


class TestSurveyRedirect:
    def test_go_redirect_and_unique(self, admin, survey_item):
        before = stats(admin)
        anon = requests.Session()
        r = anon.get(f"{API}/public/survey/0/go?src=link", allow_redirects=False)
        assert r.status_code == 302
        assert r.headers["location"] == SURVEY_URL
        assert "sv_vid" in anon.cookies
        # same visitor same day -> not counted again
        r2 = anon.get(f"{API}/public/survey/0/go?src=qr", allow_redirects=False)
        assert r2.status_code == 302
        after = stats(admin)
        m_b, m_a = before["months"][MONTH - 1], after["months"][MONTH - 1]
        assert m_a["link"] == m_b["link"] + 1
        assert m_a["qr"] == m_b["qr"]
        assert after["total_visits"] == before["total_visits"] + 1

    def test_go_qr_new_visitor(self, admin, survey_item):
        before = stats(admin)["months"][MONTH - 1]["qr"]
        r = requests.get(f"{API}/public/survey/0/go?src=qr", allow_redirects=False)
        assert r.status_code == 302
        assert stats(admin)["months"][MONTH - 1]["qr"] == before + 1

    def test_go_bogus_src_counts_as_link(self, admin, survey_item):
        before = stats(admin)["months"][MONTH - 1]["link"]
        r = requests.get(f"{API}/public/survey/0/go?src=xyz", allow_redirects=False)
        assert r.status_code == 302
        assert stats(admin)["months"][MONTH - 1]["link"] == before + 1

    def test_go_invalid_idx(self, survey_item):
        assert requests.get(f"{API}/public/survey/5/go", allow_redirects=False).status_code == 404
        assert requests.get(f"{API}/public/survey/-1/go", allow_redirects=False).status_code == 404

    def test_qr_png_encodes_go(self, survey_item):
        r = requests.get(f"{API}/public/survey/0/qr")
        assert r.status_code == 200
        assert r.headers["content-type"] == "image/png"
        try:
            from PIL import Image
            from pyzbar.pyzbar import decode
        except Exception:
            pytest.skip("pyzbar not installed")
        data = decode(Image.open(io.BytesIO(r.content)))[0].data.decode()
        assert data.endswith("/api/public/survey/0/go?src=qr")


class TestSurveyStats:
    def test_stats_shape(self, admin):
        d = stats(admin)
        assert d["year"] == YEAR and len(d["months"]) == 12
        assert {"month", "bulan", "link", "qr", "pengisi"} <= set(d["months"][0])
        assert isinstance(d["total_visits"], int) and isinstance(d["total_respondents"], int)

    def test_stats_pegawai_forbidden(self, pegawai):
        assert pegawai.get(f"{API}/admin/survey/stats", params={"year": YEAR}).status_code == 403
        assert pegawai.put(f"{API}/admin/survey/respondents", json={"year": YEAR, "month": 1, "count": 5}).status_code == 403

    def test_stats_unauth(self):
        assert requests.get(f"{API}/admin/survey/stats", params={"year": YEAR}).status_code == 401

    def test_respondents_upsert(self, admin, survey_item):
        r = admin.put(f"{API}/admin/survey/respondents", json={"year": YEAR, "month": 2, "count": 17})
        assert r.status_code == 200 and r.json()["count"] == 17
        admin.put(f"{API}/admin/survey/respondents", json={"year": YEAR, "month": 2, "count": 23})
        admin.put(f"{API}/admin/survey/respondents", json={"year": YEAR, "month": 3, "count": 0})
        d = stats(admin)
        assert d["months"][1]["pengisi"] == 23
        assert d["months"][2]["pengisi"] == 0
        assert d["total_respondents"] == 23
        # other year unaffected
        assert stats(admin, YEAR - 1)["months"][1]["pengisi"] is None

    @pytest.mark.parametrize("body", [{"year": YEAR, "month": 0, "count": 1}, {"year": YEAR, "month": 13, "count": 1},
                                      {"year": YEAR, "month": 1, "count": -1}, {"year": YEAR, "month": 1}])
    def test_respondents_validation(self, admin, body):
        assert admin.put(f"{API}/admin/survey/respondents", json=body).status_code == 422


class TestOpdReport:
    def test_pdf_all(self, admin):
        r = admin.get(f"{API}/admin/users/opd-report", params={"unit": "", "search": "", "year": 0})
        assert r.status_code == 200, r.text
        assert r.content[:4] == b"%PDF"
        assert "pdf" in r.headers.get("content-type", "")

    def test_pdf_filtered_year(self, admin):
        r = admin.get(f"{API}/admin/users/opd-report", params={"unit": "BKPSDM", "year": YEAR})
        assert r.status_code == 200 and r.content[:4] == b"%PDF"
        cd = r.headers.get("content-disposition", "")
        assert "bkpsdm" in cd.lower() and str(YEAR) in cd

    def test_pdf_landscape_and_content(self, admin):
        r = admin.get(f"{API}/admin/users/opd-report", params={"unit": "", "year": 0})
        try:
            from pypdf import PdfReader
        except Exception:
            try:
                from PyPDF2 import PdfReader
            except Exception:
                pytest.skip("pypdf not installed")
        rd = PdfReader(io.BytesIO(r.content))
        box = rd.pages[0].mediabox
        assert float(box.width) > float(box.height)
        txt = "".join(p.extract_text() for p in rd.pages)
        for word in ("Diikuti", "Berjalan", "Selesai", "Total JP", "TOTAL", "Semua OPD"):
            assert word in txt

    def test_pdf_no_match(self, admin):
        r = admin.get(f"{API}/admin/users/opd-report", params={"unit": "ZZZ_TEST_NONE"})
        assert r.status_code == 200 and r.content[:4] == b"%PDF"

    def test_pdf_pegawai_forbidden(self, pegawai):
        assert pegawai.get(f"{API}/admin/users/opd-report").status_code == 403
