# Helper to set up / clean TEST_ data for UI tests (python ui_setup_helper.py setup|cleanup)
import sys
import requests
from test_lms_revision36 import API, login, SUPER, PEG, PNG

s = login(*SUPER)
if sys.argv[1] == "info":
    p = login(*PEG)
    print({k: p.user.get(k) for k in ("email_verified", "must_change_password", "require_photo", "photo", "role")})
elif sys.argv[1] == "setup":
    r = s.post(f"{API}/admin/users", json={"name": "TEST_UI PIC", "nip": "TESTUI99002", "role": "pic", "password": "abc123", "unit_kerja": "TEST_OPD"})
    print("pic", r.status_code, r.text[:120])
    r = s.post(f"{API}/admin/users", json={"name": "TEST_UI Unverif", "nip": "TESTUI99003", "email": "test_ui99003@example.com", "role": "pegawai", "password": "abc123"})
    print("unverif", r.status_code)
    for nip in ("TESTUI99002", "TESTUI99003"):
        u = login(nip, "abc123")
        ph = u.post(f"{API}/upload", files={"file": ("p.png", PNG, "image/png")}).json()["path"]
        u.put(f"{API}/profile", json={"name": u.user["name"], "photo": ph, "unit_kerja": u.user.get("unit_kerja", "")})
        print(nip, u.put(f"{API}/profile/password", json={"old_password": "abc123", "new_password": "Dumai#Kuat2026x"}).status_code)
elif sys.argv[1] == "cleanup":
    for u in s.get(f"{API}/admin/users", params={"search": "TEST"}).json():
        if u["name"].startswith("TEST_"):
            print("del user", u["name"], s.delete(f"{API}/admin/users/{u['id']}").status_code)
    for kind in ("course", "zoom"):
        for c in s.get(f"{API}/admin/courses", params={"kind": kind}).json():
            if c["title"].startswith("TEST_"):
                print("del course", c["title"], s.delete(f"{API}/admin/courses/{c['id']}").status_code)
    for r in s.get(f"{API}/admin/support-requests").json():
        if r["name"].startswith("TEST_"):
            print("del support", s.delete(f"{API}/admin/support-requests/{r['id']}").status_code)
