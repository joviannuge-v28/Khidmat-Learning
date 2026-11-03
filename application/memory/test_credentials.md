# Test Credentials
- Super Admin: admin@dumaikota.go.id / AdminLMS2026!  (role superadmin)
- Admin (demo): admin.bkpsdm@dumaikota.go.id / AdminBKPSDM2026!  (role admin)
- Pegawai demo: NIP 198504122010011002 / Pegawai2026!  (role pegawai)
- PIC OPD: none seeded — admin creates via Kelola Pengguna (role "pic"). Tests must use TEST_ prefixed names and delete afterwards.
- Login: POST /api/auth/login {"identifier": email or NIP, "password"} (httpOnly cookies). Login lockout after failed attempts has been REMOVED.
- Database: PostgreSQL (DATABASE_URL in backend/.env, postgresql://lms:lms_dev_pass@localhost:5432/lms_khidmat). Start with `service postgresql start` if backend fails to connect.
- Cron: POST /api/cron/monthly-backup with Authorization: Bearer $WEBHOOK_CRON_SECRET (backend/.env)
