import os
from core import db, hash_password, verify_password, new_id, now_iso

DEFAULT_SETTINGS = {
    "key": "main",
    "app_name": "LMS Khidmat Kota Dumai",
    "tagline": "Learning & Knowledge Management System Aparatur Pemerintah Kota Dumai",
    "logo_path": "",
    "cover_path": "/img/cover.jpg",
    "announcement": "Selamat datang di LMS Khidmat Kota Dumai. Ikuti pelatihan dan raih sertifikat Anda.",
    "signer_name": "[Nama Pejabat Penandatangan]",
    "signer_title": "[Jabatan Penandatangan]",
}


async def seed_users():
    admin_email = os.environ["ADMIN_EMAIL"].lower()
    admin_pw = os.environ["ADMIN_PASSWORD"]
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({
            "id": new_id(), "email": admin_email, "nip": "", "name": "Super Administrator LMS", "role": "superadmin",
            "jabatan": "Administrator Sistem", "unit_kerja": "BKPSDM Kota Dumai", "photo": "", "active": True,
            "email_verified": True, "password_hash": hash_password(admin_pw), "created_at": now_iso(),
        })
    demo_email = os.environ["DEMO_ADMIN_EMAIL"].lower()
    demo_pw = os.environ["DEMO_ADMIN_PASSWORD"]
    demo = await db.users.find_one({"email": demo_email})
    if not demo:
        await db.users.insert_one({
            "id": new_id(), "email": demo_email, "nip": "", "name": "Admin BKPSDM (Contoh)", "role": "admin",
            "jabatan": "Admin LMS", "unit_kerja": "BKPSDM Kota Dumai", "photo": "", "active": True, "email_verified": True,
            "password_hash": hash_password(demo_pw), "created_at": now_iso(),
        })
    elif not verify_password(demo_pw, demo["password_hash"]):
        await db.users.update_one({"email": demo_email}, {"$set": {"password_hash": hash_password(demo_pw)}})
    elif not verify_password(admin_pw, existing["password_hash"]):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_pw)}})

    nip = os.environ["DEMO_PEGAWAI_NIP"]
    pw = os.environ["DEMO_PEGAWAI_PASSWORD"]
    existing = await db.users.find_one({"nip": nip})
    if not existing:
        await db.users.insert_one({
            "id": new_id(), "email": "pegawai.demo@dumaikota.go.id", "nip": nip, "name": "Rahmat Hidayat (Contoh)",
            "role": "pegawai", "jabatan": "Analis Kebijakan", "unit_kerja": "Sekretariat Daerah", "photo": "", "active": True,
            "password_hash": hash_password(pw), "created_at": now_iso(),
        })
    elif not verify_password(pw, existing["password_hash"]):
        await db.users.update_one({"nip": nip}, {"$set": {"password_hash": hash_password(pw)}})


def _q(question, options, answer):
    return {"id": new_id(), "question": question, "options": options, "answer_index": answer}


async def seed_content():
    if not await db.settings.find_one({"key": "main"}):
        await db.settings.insert_one(dict(DEFAULT_SETTINGS))
    if await db.categories.count_documents({}) > 0:
        return
    cats = {}
    for name, typ in [("Manajemen ASN", "course"), ("Pelayanan Publik", "course"), ("Transformasi Digital", "course"),
                      ("Regulasi", "kms"), ("Panduan Teknis", "kms"), ("Artikel", "kms")]:
        cid = new_id()
        cats[name] = cid
        await db.categories.insert_one({"id": cid, "name": name, "type": typ, "created_at": now_iso()})

    courses = [
        {
            "title": "Dasar-Dasar Manajemen Kinerja ASN (Contoh)",
            "category_id": cats["Manajemen ASN"], "thumbnail": "/img/c1.jpg", "level": "Dasar", "duration_hours": 4,
            "instructor": "Tim BKPSDM (Contoh)",
            "description": "Pelatihan contoh tentang perencanaan, pemantauan, dan evaluasi kinerja pegawai. Isi materi dapat diubah di panel admin.",
            "modules": [
                {"id": new_id(), "title": "Pengantar Manajemen Kinerja", "type": "text", "url": "", "duration_min": 10,
                 "body": "Manajemen kinerja adalah proses berkelanjutan untuk merencanakan, memantau, dan menilai capaian kerja pegawai.\n\nMateri contoh ini dapat diganti oleh admin melalui menu Kelola Pelatihan."},
                {"id": new_id(), "title": "Video: Siklus Kinerja", "type": "video", "url": "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4", "duration_min": 5, "body": "Video contoh. Ganti dengan tautan YouTube atau unggah file video."},
                {"id": new_id(), "title": "Dokumen: Bahan Bacaan", "type": "pdf", "url": "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf", "duration_min": 15, "body": "Dokumen PDF contoh."},
            ],
            "questions": [
                _q("Manajemen kinerja merupakan proses yang...", ["Dilakukan sekali setahun saja", "Berkelanjutan", "Hanya untuk pimpinan", "Tidak perlu dievaluasi"], 1),
                _q("Tahap awal manajemen kinerja adalah...", ["Perencanaan", "Pemberian sanksi", "Pensiun", "Mutasi"], 0),
                _q("Tujuan evaluasi kinerja adalah...", ["Mencari kesalahan", "Menilai capaian dan perbaikan", "Mengurangi pegawai", "Formalitas"], 1),
            ],
        },
        {
            "title": "Pelayanan Publik Prima (Contoh)",
            "category_id": cats["Pelayanan Publik"], "thumbnail": "/img/c2.jpg", "level": "Menengah", "duration_hours": 3,
            "instructor": "Tim Ortala (Contoh)",
            "description": "Pelatihan contoh tentang standar pelayanan dan sikap melayani masyarakat.",
            "modules": [
                {"id": new_id(), "title": "Prinsip Pelayanan Prima", "type": "text", "url": "", "duration_min": 10,
                 "body": "Pelayanan prima menempatkan kepuasan masyarakat sebagai ukuran utama. Materi contoh."},
                {"id": new_id(), "title": "Studi Kasus Layanan", "type": "text", "url": "", "duration_min": 10,
                 "body": "Diskusikan contoh layanan yang baik dan yang perlu diperbaiki di unit kerja Anda."},
            ],
            "questions": [
                _q("Ukuran utama pelayanan prima adalah...", ["Kepuasan masyarakat", "Jumlah berkas", "Lama antrean", "Jumlah pegawai"], 0),
                _q("Sikap yang tepat saat melayani adalah...", ["Acuh", "Ramah dan solutif", "Terburu-buru", "Menunda"], 1),
            ],
        },
        {
            "title": "Literasi Digital untuk Aparatur (Contoh)",
            "category_id": cats["Transformasi Digital"], "thumbnail": "/img/c3.jpg", "level": "Dasar", "duration_hours": 2,
            "instructor": "Tim Diskominfo (Contoh)",
            "description": "Pelatihan contoh tentang keamanan data, etika digital, dan pemanfaatan aplikasi kerja.",
            "modules": [
                {"id": new_id(), "title": "Keamanan Kata Sandi", "type": "text", "url": "", "duration_min": 8,
                 "body": "Gunakan kata sandi yang kuat dan jangan bagikan kepada siapa pun. Materi contoh."},
            ],
            "questions": [
                _q("Kata sandi yang baik adalah...", ["Tanggal lahir", "123456", "Kombinasi huruf, angka, simbol", "Nama sendiri"], 2),
            ],
        },
    ]
    for c in courses:
        c.update({"id": new_id(), "passing_score": 70, "published": True, "created_at": now_iso()})
        await db.courses.insert_one(c)

    readings = [
        ("Panduan Penyusunan Sasaran Kinerja Pegawai (Contoh)", "Panduan Teknis", "/img/k1.jpg"),
        ("Ringkasan Regulasi Manajemen ASN (Contoh)", "Regulasi", "/img/k2.jpg"),
        ("Budaya Kerja BerAKHLAK di Lingkungan Pemkot (Contoh)", "Artikel", "/img/k1.jpg"),
    ]
    for title, cat, cover in readings:
        await db.readings.insert_one({
            "id": new_id(), "title": title, "author": "Tim KMS (Contoh)", "category_id": cats[cat], "cover": cover,
            "summary": "Bahan bacaan contoh untuk Knowledge Management System. Ubah atau hapus di panel admin.",
            "content": "Ini adalah isi bacaan contoh. Admin dapat mengganti teks ini, menambahkan tautan, atau mengunggah dokumen PDF.",
            "file_path": "", "file_name": "", "link_url": "", "status": "approved", "proposed_by": None,
            "proposer_name": "Admin", "review_note": "", "views": 0, "created_at": now_iso(),
        })
