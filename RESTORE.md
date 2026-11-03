# Cara memulihkan backup LMS Khidmat Kota Dumai

## Database (folder database/)
Setiap file JSON = satu tabel PostgreSQL (kolom _id + doc JSONB).
Impor: cd backend && python migrate_mongo_to_pg.py --json-dir ../database --replace
(atau unggah ZIP ini di menu Backup & Recovery > Pulihkan).

## Aplikasi (folder application/)
Kode backend (FastAPI) dan frontend (React). File .env TIDAK disertakan demi keamanan;
salin backend/.env.example dan frontend/.env.example lalu isi nilainya. Lihat PROJECT_CONTEXT.md.

## File unggahan (folder files/, hanya di backup lengkap)
Berisi file asli (foto, video, PDF) sesuai path di koleksi `files`. Unggah ulang ke penyimpanan dengan path yang sama.
