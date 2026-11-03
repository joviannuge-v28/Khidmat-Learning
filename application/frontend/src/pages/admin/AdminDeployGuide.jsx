import { useState } from "react";
import { Check, Copy, Server } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/common";

const Code = ({ children, id }) => {
  const [ok, setOk] = useState(false);
  const copy = () => {
    navigator.clipboard?.writeText(children.trim()).then(() => { setOk(true); toast.success("Perintah disalin"); setTimeout(() => setOk(false), 1500); });
  };
  return (
    <div className="relative group min-w-0 max-w-full" data-testid={`deploy-code-${id}`}>
      <pre className="bg-[#0B1E33] text-slate-100 text-xs sm:text-[13px] leading-relaxed rounded-lg p-4 pr-12 overflow-x-auto max-w-full whitespace-pre"><code>{children.trim()}</code></pre>
      <button onClick={copy} className="absolute top-2 right-2 p-2 rounded-md bg-white/10 hover:bg-white/20 text-white transition-colors" aria-label="Salin" data-testid={`deploy-copy-${id}`}>{ok ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}</button>
    </div>
  );
};

const Step = ({ n, title, children }) => (
  <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-3 min-w-0 overflow-hidden" data-testid={`deploy-step-${n}`}>
    <h2 className="font-bold text-slate-900 flex items-center gap-3"><span className="h-8 w-8 rounded-full bg-amber-500 text-slate-900 grid place-items-center text-sm font-extrabold shrink-0">{n}</span>{title}</h2>
    <div className="text-sm text-slate-600 space-y-3 leading-relaxed min-w-0">{children}</div>
  </section>
);

const STEPS = [
  ["Siapkan server", <>
    <p>Rekomendasi: VPS Ubuntu 22.04 / 24.04 LTS, minimal 2 vCPU, 4 GB RAM, 40 GB SSD, dan domain (mis. <code>lms.dumaikota.go.id</code>) yang A-record-nya mengarah ke IP server.</p>
    <Code id="apt">{`
sudo apt update && sudo apt upgrade -y
sudo apt install -y python3 python3-venv python3-pip postgresql postgresql-contrib nginx git curl unzip ufw
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g yarn`}</Code>
  </>],
  ["Buat database PostgreSQL", <>
    <p>Ganti <code>PASSWORD_KUAT</code> dengan kata sandi acak yang panjang.</p>
    <Code id="pg">{`
sudo -u postgres psql -c "CREATE USER lms WITH PASSWORD 'PASSWORD_KUAT';"
sudo -u postgres psql -c "CREATE DATABASE lms_khidmat OWNER lms;"`}</Code>
    <p>Tabel dibuat otomatis oleh aplikasi saat pertama berjalan (setiap koleksi = satu tabel berisi kolom <code>_id</code> dan <code>doc</code> JSONB).</p>
  </>],
  ["Unggah kode aplikasi", <>
    <p>Unduh <b>Backup Lengkap</b> dari menu Backup &amp; Recovery, lalu salin ke server (mis. dengan WinSCP / scp).</p>
    <Code id="code">{`
sudo mkdir -p /opt/lms && sudo chown $USER:$USER /opt/lms
cd /opt/lms
unzip ~/backup-lengkap-*.zip
mv application/* . && rmdir application
mkdir -p backend/uploads && cp -r files/* backend/uploads/ 2>/dev/null || true`}</Code>
  </>],
  ["Pasang backend (FastAPI)", <>
    <Code id="venv">{`
cd /opt/lms/backend
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements-server.txt`}</Code>
    <p>Buat file <code>/opt/lms/backend/.env</code> (jangan dibagikan):</p>
    <Code id="env">{`
DATABASE_URL="postgresql://lms:PASSWORD_KUAT@localhost:5432/lms_khidmat"
FRONTEND_URL="https://lms.dumaikota.go.id"
JWT_SECRET="ISI_DENGAN_HASIL: openssl rand -hex 32"
ADMIN_EMAIL="admin@dumaikota.go.id"
ADMIN_PASSWORD="KataSandiSuperAdmin!"
DEMO_ADMIN_EMAIL="admin.bkpsdm@dumaikota.go.id"
DEMO_ADMIN_PASSWORD="KataSandiAdmin!"
DEMO_PEGAWAI_NIP="198504122010011002"
DEMO_PEGAWAI_PASSWORD="KataSandiPegawai!"
WEBHOOK_CRON_SECRET="ISI_DENGAN_HASIL: openssl rand -hex 16"`}</Code>
  </>],
  ["Pindahkan data lama ke PostgreSQL", <>
    <p>Pilih salah satu. Data lama tidak dihapus; skrip menampilkan jumlah dokumen per tabel untuk dicocokkan.</p>
    <Code id="migrate-json">{`
# A. Dari folder database/ hasil backup (format JSON)
cd /opt/lms/backend && source venv/bin/activate
python migrate_mongo_to_pg.py --json-dir ../database`}</Code>
    <Code id="migrate-mongo">{`
# B. Langsung dari server MongoDB lama yang masih menyala
python migrate_mongo_to_pg.py --mongo-url "mongodb://IP_LAMA:27017" --mongo-db NAMA_DB`}</Code>
    <p>Tambahkan <code>--replace</code> bila ingin menimpa tabel yang sudah berisi data.</p>
  </>],
  ["Jalankan backend sebagai layanan (systemd)", <>
    <p>Buat file <code>/etc/systemd/system/lms-backend.service</code>:</p>
    <Code id="systemd">{`
[Unit]
Description=LMS Khidmat Kota Dumai - Backend
After=network.target postgresql.service

[Service]
User=www-data
WorkingDirectory=/opt/lms/backend
ExecStart=/opt/lms/backend/venv/bin/uvicorn server:app --host 127.0.0.1 --port 8001 --workers 2
Restart=always

[Install]
WantedBy=multi-user.target`}</Code>
    <Code id="systemd-start">{`
sudo chown -R www-data:www-data /opt/lms/backend/uploads
sudo systemctl daemon-reload
sudo systemctl enable --now lms-backend
sudo systemctl status lms-backend
curl http://127.0.0.1:8001/api/settings`}</Code>
  </>],
  ["Build frontend (React)", <>
    <Code id="frontend">{`
cd /opt/lms/frontend
echo 'REACT_APP_BACKEND_URL=https://lms.dumaikota.go.id' > .env
yarn install
yarn build`}</Code>
    <p>Hasil build ada di <code>/opt/lms/frontend/build</code>. Setiap ada perubahan kode frontend, jalankan ulang <code>yarn build</code>.</p>
  </>],
  ["Konfigurasi Nginx", <>
    <p>Buat file <code>/etc/nginx/sites-available/lms</code>:</p>
    <Code id="nginx">{`
server {
    listen 80;
    server_name lms.dumaikota.go.id;
    client_max_body_size 300M;

    root /opt/lms/frontend/build;
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:8001;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300;
    }

    location / {
        try_files $uri /index.html;
    }
}`}</Code>
    <Code id="nginx-enable">{`
sudo ln -s /etc/nginx/sites-available/lms /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx`}</Code>
  </>],
  ["HTTPS (SSL gratis) & firewall", <>
    <Code id="ssl">{`
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d lms.dumaikota.go.id
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw enable`}</Code>
  </>],
  ["Backup otomatis PostgreSQL", <>
    <p>Selain menu Backup &amp; Recovery, simpan dump harian database (jalankan <code>sudo crontab -e</code>):</p>
    <Code id="cron">{`
0 2 * * * sudo -u postgres pg_dump lms_khidmat | gzip > /var/backups/lms-$(date +\\%F).sql.gz
0 3 * * * find /var/backups -name 'lms-*.sql.gz' -mtime +30 -delete`}</Code>
    <p>Pulihkan dump: <code>gunzip -c lms-TANGGAL.sql.gz | sudo -u postgres psql lms_khidmat</code></p>
  </>],
  ["Pembaruan aplikasi", <>
    <Code id="update">{`
cd /opt/lms/backend && source venv/bin/activate && pip install -r requirements-server.txt
sudo systemctl restart lms-backend
cd /opt/lms/frontend && yarn install && yarn build`}</Code>
  </>],
  ["Jika memakai hosting (bukan VPS)", <>
    <ul className="list-disc pl-5 space-y-1">
      <li>Shared hosting biasa (khusus PHP) <b>tidak dapat</b> menjalankan aplikasi ini. Pilih VPS / Cloud Server, atau hosting yang mendukung Python 3.10+ dan PostgreSQL.</li>
      <li>cPanel dengan fitur <b>Setup Python App</b>: buat aplikasi Python dengan root <code>backend</code>, startup <code>server.py</code>, entry point <code>app</code>, lalu instal <code>requirements-server.txt</code>. Buat database PostgreSQL di menu PostgreSQL Databases dan isi <code>DATABASE_URL</code>.</li>
      <li>Unggah isi folder <code>frontend/build</code> ke <code>public_html</code> dan pastikan permintaan <code>/api</code> diteruskan ke aplikasi Python.</li>
      <li>Database terkelola (mis. PostgreSQL di penyedia cloud) juga bisa dipakai: cukup ganti <code>DATABASE_URL</code>.</li>
    </ul>
  </>],
  ["Pemecahan masalah", <>
    <ul className="list-disc pl-5 space-y-1">
      <li>Log backend: <code>sudo journalctl -u lms-backend -f</code></li>
      <li>Log Nginx: <code>sudo tail -f /var/log/nginx/error.log</code></li>
      <li>Error 403 "Origin tidak diizinkan": pastikan <code>FRONTEND_URL</code> sama persis dengan alamat domain (termasuk https).</li>
      <li>Gagal unggah file besar: naikkan <code>client_max_body_size</code> di Nginx.</li>
      <li>Tidak bisa terhubung ke database: cek <code>sudo systemctl status postgresql</code> dan isi <code>DATABASE_URL</code>.</li>
    </ul>
  </>],
];

export default function AdminDeployGuide() {
  return (
    <div className="max-w-4xl min-w-0 space-y-5">
      <PageHeader title="Panduan Deploy Server" subtitle="Langkah pemasangan LMS Khidmat di server Ubuntu atau hosting dengan database PostgreSQL." />
      <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-sm text-slate-700 flex gap-3" data-testid="deploy-intro">
        <Server className="h-5 w-5 text-amber-700 shrink-0" />
        <p>Ganti contoh domain <code>lms.dumaikota.go.id</code>, kata sandi, dan jalur folder sesuai server Anda. Tekan ikon salin di kanan atas tiap kotak perintah.</p>
      </div>
      {STEPS.map(([t, body], i) => <Step key={t} n={i + 1} title={t}>{body}</Step>)}
    </div>
  );
}
