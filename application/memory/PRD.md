# PRD — LMS Khidmat Kota Dumai

## Original problem statement
- migrasi kan web aplikasi ini untuk database nya menggunakan PostgreSQL tanpa menghilangkan isi data di dalamnya
- notif laporan pengguna di admin
- tambah navbar untuk konten tentang survey kepuasan berupa barcode atau link yang bisa dikelola oleh admin atau super admin
- survey kepuasan juga di sediakan di footer ASN yang simple
- tambah footer google maps alamat kantor
- untuk yang tidak bisa login berulang kali itu dihapus saja system nya
- Ketika edit sertifikat bisa arah memakai keyboard dan ada system perapiannya
- di super admin, berikan tutorial pemasangan/deploy di server ubuntu atau ketika hosting
- pada kelola pengguna asn, ada filter untuk ASN per OPD dengan memakai kata kunci agar mempermudah buat laporan

User choices: PostgreSQL on own Ubuntu server/hosting; bell with number + number badge next to "Pelatihan Sedang Diikuti" (unfinished); maps link https://maps.app.goo.gl/HkJLtxu6voxbmR3x6; survey page visible to all visitors.

## Architecture
- FastAPI backend (/app/backend) + React (CRA/craco) frontend.
- Database: PostgreSQL via `pgdb.py` — Mongo-compatible async layer on asyncpg; each collection = table (`_id TEXT`, `doc JSONB`, GIN index). App code unchanged.
- `migrate_mongo_to_pg.py`: imports from JSON export folder or live MongoDB.
- Files stored locally in backend/uploads.
- Preview only: `scripts/start_pg.sh` (PG_AUTOSTART_SCRIPT) keeps PostgreSQL data in /app/pgdata.

## User personas
Super Admin BKPSDM, Admin LMS, PIC OPD, Pegawai/ASN, public visitors.

## Implemented (2026-11-02)
- PostgreSQL migration (405 rows migrated, counts verified); snapshot at /app/migration/lms_pg_snapshot.dump
- Login lockout removed (backend + Security Monitoring UI)
- Admin bell lists new user reports; sidebar badges: Laporan Pengguna (new reports), Pelatihan Sedang Diikuti (ongoing)
- Survei Kepuasan: admin page /admin/survei (links + auto QR or uploaded barcode), public /survei, login navbar item, ASN footer
- Office Google Maps footer on landing/survey (editable in Konten Login)
- Certificate design: arrow keys (Shift 5%, Alt 0.1%), snap guides, center H/V, distribute, auto-tidy, grid
- Super admin Panduan Deploy Server (Ubuntu + hosting), requirements-server.txt
- Kelola Pengguna: OPD keyword filter + suggestions, filtered Excel export
- Rekap Survei Kepuasan on Admin Dashboard: monthly chart of survey visits (tracked via /api/public/survey/{i}/go redirect, unique per visitor/day, link vs QR) + manual monthly respondent count input
- Cetak PDF Rekap ASN / OPD (landscape): per-ASN Diikuti/Berjalan/Selesai/Total JP with TOTAL row, year filter, follows OPD + keyword filter

## Known gaps
- Only 10 of 48 uploaded files were in the provided backup; missing photos now fall back to initials.

## Backlog
- P1: Email notification for new reports
- P2: Import survey respondents automatically from Google Sheets
