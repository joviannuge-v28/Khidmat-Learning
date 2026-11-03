import { GuideDoc } from "@/components/GuideDoc";
import { useAuth } from "@/context/AuthContext";

const G = "/img/guide";
const ADMIN = [
  ["peran", "1. Pembagian Peran", ["Super Admin: mengelola seluruh sistem, konfigurasi keamanan, SMTP, backup & recovery, tema, konten login, log aktivitas.", "Admin: mengelola ASN/pengguna, laporan pengguna, kategori, kursus/webinar, KMS & persetujuan, laporan JP, serta sertifikat.", "PIC OPD: hanya mengusulkan materi/webinar, melihat peserta kursusnya, dan mengelola kehadiran webinar yang dia buat. PIC tidak dapat mengikuti kursus."], `${G}/admin-dashboard.png`],
  ["dashboard", "2. Dashboard Admin", ["Lihat statistik pegawai, persentase akun terverifikasi email, sertifikat, dan usulan menunggu.", "Grafik Learning Hours menampilkan total JP per bulan; pilih tahun di pojok kanan.", "Statistik Aktivitas Pengguna Platform (kunjungan 30 hari, hari ini, repositori dilihat) dapat dicetak dengan tombol Cetak Laporan."], `${G}/admin-dashboard.png`],
  ["pengguna", "3. Kelola ASN / Pengguna", ["Cari pegawai dengan NIP, nama, atau email di kolom pencarian.", "Tambah pengguna satu per satu atau impor Excel massal dengan kata sandi default. Akun baru wajib mengganti kata sandi dan mengunggah foto saat pertama login.", "Ikon amplop hijau = setujui email tanpa verifikasi (jika pengguna terkendala). Email dapat diubah melalui tombol Ubah.", "Super Admin dapat mencetak laporan profil ASN lengkap beserta riwayat kursus (ikon dokumen biru)."], `${G}/admin-users.png`],
  ["kursus", "4. Kelola Pelatihan & Webinar", ["Buat pelatihan: isi data, tambah materi (teks/video/PDF), unggah File Pendukung (PPTX, PDF, PNG, bisa banyak file), dan kuis.", "Soal dan pilihan jawaban kuis diacak otomatis untuk setiap peserta.", "Pilih Penandatangan Sertifikat sebelum menyimpan/memposting kursus atau webinar.", "Webinar: unggah materi PPTX/PDF untuk diunduh peserta, lalu kelola peserta & kehadiran."], `${G}/admin-courses.png`],
  ["sertifikat", "5. Desain Sertifikat & Penandatangan", ["Seret elemen untuk mengatur posisi; ubah ukuran, font, dan tebal huruf.", "Tambah Teks untuk menyisipkan teks bebas pada sertifikat.", "Kelola Penanggung Jawab TTD: nama, jabatan, pangkat, NIP, dan gambar TTD. Pangkat dan NIP tampil di bawah nama."], `${G}/admin-cert.png`],
  ["laporan", "6. Laporan Pengguna & Laporan JP", ["Laporan dari halaman login wajib menyertakan nomor WhatsApp; tekan tautan WA untuk menghubungi pelapor.", "Laporan JP dapat diunduh per orang atau per OPD dalam PDF/Excel."], null],
];
const SUPER = [
  ["keamanan", "7. Security Monitoring (Super Admin)", ["Pantau login gagal, akun terkunci (buka kunci dengan ikon gembok), IP mencurigakan, dan kejadian keamanan.", "Pastikan SMTP aktif dan backup terakhir tersedia."], `${G}/admin-security.png`],
  ["backup", "8. Backup & Recovery (Super Admin)", ["Backup otomatis berjalan setiap tanggal 1 (database + file pembelajaran) dan disimpan di penyimpanan terpisah dari server aplikasi.", "Tekan Backup Sekarang untuk salinan manual; unduh salinan dari tabel.", "Recovery: pilih file .zip/.json backup database lalu konfirmasi untuk memulihkan."], `${G}/admin-backup.png`],
  ["log", "9. Log Aktivitas Admin (Super Admin)", ["Semua perubahan oleh Admin/Super Admin/PIC tercatat otomatis.", "Saring tanggal lalu tekan Cetak Laporan PDF atau Excel."], null],
  ["smtp", "10. SMTP, Tema & Konten Login (Super Admin)", ["Konfigurasi SMTP: isi host, port, username, kata sandi, email pengirim; uji kirim email. Tanpa SMTP, pengguna melihat pemberitahuan \"Verifikasi belum bisa digunakan\".", "Tema & Logo: ubah warna tema dan logo Kota Dumai di kartu Selamat Datang Kembali.", "Konten Login: foto sampul multi-slide (interval detik), kata sambutan + 4 foto pejabat (bingkai lingkaran), Tentang Kami (Konsep, Tujuan, Dasar Hukum), dan media sosial footer."], null],
];

export default function AdminGuide() {
  const { user } = useAuth();
  return <GuideDoc title="Panduan 2 · Super Admin & Admin" subtitle="Panduan penggunaan panel Super Admin dan Admin LMS Khidmat Kota Dumai." items={user?.role === "superadmin" ? [...ADMIN, ...SUPER] : ADMIN} testid="admin-guide" />;
}
