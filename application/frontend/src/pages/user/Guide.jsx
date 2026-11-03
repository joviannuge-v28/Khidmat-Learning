import { GuideDoc } from "@/components/GuideDoc";
import { useAuth } from "@/context/AuthContext";

const G = "/img/guide";
const GUIDE = [
  ["masuk", "1. Masuk, Login Pertama & Keluar", ["Buka halaman login, isi NIP atau email serta kata sandi, lalu tekan Masuk.", "Akun baru (login pertama) otomatis diarahkan ke Profil: unggah foto profil dan ganti kata sandi default sebelum memakai menu lain.", "Kata sandi baru minimal 10 karakter dengan kombinasi huruf, angka, dan simbol, serta bukan kata sandi umum.", "Lupa kata sandi atau akun terkunci (5x salah = terkunci 15 menit)? Tekan \"Lapor Admin\" dan isi nomor WhatsApp (wajib).", "Untuk keluar, pilih Keluar di bagian bawah menu samping lalu konfirmasi."], `${G}/login.png`],
  ["dashboard", "2. Dashboard & Laporan JP", ["Dashboard menampilkan pelatihan yang sedang dan sudah diikuti, bacaan terbaru, serta Laporan JP Saya.", "Pilih tahun, lalu tekan PDF atau Excel untuk mengunduh laporan JP Anda."], `${G}/dashboard.png`],
  ["pelatihan", "3. Mengikuti Pelatihan", ["Buka Daftar Pelatihan, cari atau saring per kategori, lalu tekan Ikuti Pelatihan.", "Pelajari setiap materi dan tekan Tandai Selesai. File pendukung (PPTX/PDF/gambar) dapat diunduh di bagian File Pendukung.", "Kuis akhir terbuka setelah semua materi selesai. Urutan soal dan pilihan jawaban diacak untuk setiap peserta.", "Sertifikat terbit otomatis saat lulus dan dapat diunduh di menu Pelatihan Sudah Diikuti."], `${G}/catalog.png`],
  ["webinar", "4. Webinar Zoom & Materi Webinar", ["Buka menu Webinar Zoom, pilih webinar, lalu tekan Daftar Webinar.", "Setelah terdaftar, tautan Zoom, Meeting ID, passcode, dan Materi Webinar (PPTX/PDF) tampil dan dapat diunduh.", "Notifikasi (ikon lonceng) muncul 24 jam dan 1 jam sebelum webinar dimulai. Kehadiran dikonfirmasi admin atau PIC penyelenggara.", "Setelah webinar selesai, isi Evaluasi Webinar (wajib) untuk membuka sertifikat."], `${G}/zoom.png`],
  ["sertifikat", "5. Sertifikat & Cek Keaslian", ["Sertifikat memiliki nomor unik, ditandatangani pejabat yang dipilih untuk kegiatan tersebut (nama, pangkat, dan NIP tercantum).", "Keaslian sertifikat dapat dicek di halaman login (Cek Sertifikat) dengan memindai kode QR atau mengetik nomor sertifikat."], `${G}/verify.png`],
  ["tes", "6. Tes Kepribadian", ["Buka menu Tes Kepribadian, pilih tes, jawab semua pernyataan, lalu tekan Lihat Hasil.", "Hasil berupa grafik radar, skor, dan tafsiran tiap dimensi. Riwayat hasil tersimpan."], `${G}/psy.png`],
  ["kms", "7. KMS · Daftar Bacaan", ["Buka Daftar Bacaan untuk membaca dokumen, artikel, atau menonton video pengetahuan.", "Gunakan kolom cari dan kategori untuk menemukan bacaan."], `${G}/kms.png`],
  ["profil", "8. Profil, Gelar, WhatsApp & Verifikasi Email", ["Di menu Profil ubah foto, nama, gelar depan & belakang (opsional), nomor WhatsApp, jabatan, dan unit kerja. NIP tidak dapat diubah.", "Bagian Verifikasi Akun menunjukkan persentase verifikasi; tekan Kirim Email Verifikasi lalu klik tautan di email untuk mencapai 100%.", "Jika muncul pemberitahuan \"Verifikasi belum bisa digunakan\", server email belum disiapkan; admin dapat menyetujui email Anda secara manual.", "Ganti kata sandi secara berkala di bagian Ubah Kata Sandi."], `${G}/profile.png`],
  ["tampilan", "9. Notifikasi, Mode Malam & Aksesibilitas", ["Ikon lonceng menampilkan pengingat pelatihan/webinar dan evaluasi yang belum diisi.", "Tombol bulat di pojok kanan bawah mengatur ukuran huruf, kontras tinggi, dan Mode Malam."], null],
];

const PIC_GUIDE = ["pic", "10. Khusus PIC OPD", ["Akun PIC khusus usulan: dapat melihat kursus dan webinar, tetapi tidak dapat mengikutinya.", "Buka menu Usulan OPD, tekan Usulkan Pelatihan atau Usulkan Webinar Zoom, isi data, pilih penandatangan, lalu kirim. Usulan tampil setelah disetujui admin.", "Untuk usulan yang sudah disetujui, tekan ikon Peserta (hijau) untuk melihat siapa saja pesertanya; pada webinar, tandai kehadiran peserta untuk menerbitkan sertifikat.", "Tekan tombol Evaluasi pada webinar milik OPD untuk mengatur pertanyaan dan melihat hasil evaluasi."], null];

export default function Guide() {
  const { user } = useAuth();
  const items = ["pic", "admin", "superadmin"].includes(user?.role) ? [...GUIDE, PIC_GUIDE] : GUIDE;
  return <GuideDoc title="Panduan Penggunaan" subtitle="Panduan lengkap memakai LMS Khidmat Kota Dumai, langkah demi langkah, beserta tangkapan layar." items={items} testid="guide" />;
}
