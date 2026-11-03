import { useEffect, useState } from "react";
import { AlertTriangle, Award, BadgeCheck, Download, Loader2, MailWarning, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader, UserAvatar } from "@/components/common";
import { FileUpload } from "@/components/FileUpload";
import { useAuth } from "@/context/AuthContext";
import { api, certUrl, downloadCert, errMsg, fmtDate } from "@/lib/api";

function PasswordCard() {
  const { setUser } = useAuth();
  const [f, setF] = useState({ old_password: "", new_password: "" });
  const [busy, setBusy] = useState(false);
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await api.put("/profile/password", f);
      setUser(r.data);
      toast.success("Kata sandi diperbarui");
      setF({ old_password: "", new_password: "" });
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={save} className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
      <h2 className="font-bold text-slate-900">Ubah Kata Sandi</h2>
      <div className="grid gap-2"><Label>Kata sandi lama</Label><Input type="password" value={f.old_password} onChange={(e) => setF({ ...f, old_password: e.target.value })} required data-testid="profile-old-password-input" /></div>
      <div className="grid gap-2"><Label>Kata sandi baru</Label><Input type="password" value={f.new_password} onChange={(e) => setF({ ...f, new_password: e.target.value })} required data-testid="profile-new-password-input" /></div>
      <p className="text-xs text-slate-500" data-testid="password-policy-hint">Minimal 10 karakter, kombinasi huruf, angka, dan simbol. Tidak boleh kata sandi umum, NIP, atau email.</p>
      <Button type="submit" variant="outline" disabled={busy} data-testid="profile-password-save-button">Simpan Kata Sandi</Button>
    </form>
  );
}

function EmailVerifyCard({ user }) {
  const [st, setSt] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api.get("/email-verification/status").then((r) => setSt(r.data));
  }, [user.email_verified]);
  const send = async () => {
    setBusy(true);
    try {
      await api.post("/profile/email/send-verification");
      toast.success(`Tautan verifikasi dikirim ke ${user.email}`);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };
  const pct = user.email_verified ? 100 : 50;
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-3" data-testid="email-verify-card">
      <div className="flex items-center justify-between"><h2 className="font-bold text-slate-900">Verifikasi Akun</h2><span className={`text-sm font-bold ${pct === 100 ? "text-emerald-700" : "text-amber-700"}`} data-testid="verify-percent">{pct}% terverifikasi</span></div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden"><div className={`h-full ${pct === 100 ? "bg-emerald-500" : "bg-amber-500"}`} style={{ width: `${pct}%` }} /></div>
      {user.email_verified ? <p className="text-sm text-emerald-700 flex items-center gap-2"><BadgeCheck className="h-4 w-4" />Email {user.email} sudah terverifikasi.</p> : (
        <>
          {st && !st.available && <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2" data-testid="verify-unavailable"><MailWarning className="h-4 w-4 shrink-0 mt-0.5" />Verifikasi belum bisa digunakan. Jika ada kendala, admin dapat menyetujui email Anda.</p>}
          {st?.available && <Button variant="outline" onClick={send} disabled={busy || !user.email} data-testid="send-verification-button">{busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}Kirim Email Verifikasi</Button>}
          {!user.email && <p className="text-xs text-slate-500">Akun belum memiliki email. Minta admin menambahkannya.</p>}
        </>
      )}
    </div>
  );
}

export default function Profile() {
  const { user, setUser } = useAuth();
  const [f, setF] = useState({ name: user.name, gelar_depan: user.gelar_depan || "", gelar_belakang: user.gelar_belakang || "", whatsapp: user.whatsapp || "", jabatan: user.jabatan || "", unit_kerja: user.unit_kerja || "", photo: user.photo || "" });
  const [busy, setBusy] = useState(false);
  const [certs, setCerts] = useState([]);

  useEffect(() => {
    api.get("/my/enrollments", { params: { status: "completed" } }).then((r) => setCerts(r.data));
  }, []);

  const save = async (data = f) => {
    setBusy(true);
    try {
      const r = await api.put("/profile", data);
      setUser(r.data);
      toast.success("Profil disimpan");
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const onPhoto = (p) => {
    const next = { ...f, photo: p };
    setF(next);
    save(next);
  };

  return (
    <div>
      <PageHeader title="Profil Saya" subtitle="Data pegawai dan sertifikat Anda." />
      {(user.must_change_password || (user.require_photo && !user.photo)) && (
        <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-sm flex gap-3" data-testid="onboarding-banner">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <div><b>Akun baru — wajib dilengkapi sebelum memakai aplikasi:</b><ul className="list-disc pl-5 mt-1">{user.require_photo && !user.photo && <li>Unggah foto profil</li>}{user.must_change_password && <li>Ganti kata sandi default dengan kata sandi baru</li>}<li>Lengkapi data profil (gelar opsional, nomor WhatsApp)</li></ul></div>
        </div>
      )}
      <div className="grid lg:grid-cols-[1fr_380px] gap-6 items-start">
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6" data-testid="profile-card">
            <div className="flex flex-col sm:flex-row sm:items-center gap-5 pb-6 border-b border-slate-100">
              <UserAvatar user={{ ...user, photo: f.photo }} size="h-24 w-24" />
              <div className="space-y-2">
                <div className="text-xl font-bold text-slate-900" data-testid="profile-name">{user.name}</div>
                <div className="text-sm text-slate-500" data-testid="profile-nip">NIP: {user.nip || "-"}</div>
                <FileUpload accept="image/*" label="Ganti Foto" testid="profile-photo-upload" onUploaded={onPhoto} />
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4 pt-6">
              <div className="grid gap-2 sm:col-span-2"><Label>Nama Lengkap</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} data-testid="profile-name-input" /></div>
              <div className="grid gap-2"><Label>Gelar Depan (opsional)</Label><Input value={f.gelar_depan} onChange={(e) => setF({ ...f, gelar_depan: e.target.value })} placeholder="Contoh: Dr. / Ir." data-testid="profile-gelar-depan-input" /></div>
              <div className="grid gap-2"><Label>Gelar Belakang (opsional)</Label><Input value={f.gelar_belakang} onChange={(e) => setF({ ...f, gelar_belakang: e.target.value })} placeholder="Contoh: S.Kom., M.Si." data-testid="profile-gelar-belakang-input" /></div>
              <div className="grid gap-2"><Label>Nomor WhatsApp</Label><Input value={f.whatsapp} onChange={(e) => setF({ ...f, whatsapp: e.target.value })} placeholder="081234567890" data-testid="profile-whatsapp-input" /></div>
              <div className="grid gap-2"><Label>NIP</Label><Input value={user.nip || ""} disabled data-testid="profile-nip-input" /></div>
              <div className="grid gap-2"><Label>Email</Label><Input value={user.email || ""} disabled /></div>
              <div className="grid gap-2"><Label>Jabatan</Label><Input value={f.jabatan} onChange={(e) => setF({ ...f, jabatan: e.target.value })} data-testid="profile-jabatan-input" /></div>
              <div className="grid gap-2"><Label>Unit Kerja / OPD</Label><Input value={f.unit_kerja} onChange={(e) => setF({ ...f, unit_kerja: e.target.value })} data-testid="profile-unit-input" /></div>
            </div>
            <p className="text-xs text-slate-400 mt-3">NIP dan email dikelola oleh admin / SSO.</p>
            <Button onClick={() => save()} disabled={busy} className="mt-5 bg-[#0F2942] hover:bg-[#0A1D30]" data-testid="profile-save-button">
              {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Simpan Profil
            </Button>
          </div>
          <EmailVerifyCard user={user} />
          <PasswordCard />
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-6" data-testid="profile-certificates">
          <h2 className="font-bold text-slate-900 flex items-center gap-2"><Award className="h-5 w-5 text-amber-600" />Sertifikat Saya</h2>
          {certs.length === 0 ? <p className="text-sm text-slate-500 mt-4">Belum ada sertifikat.</p> : (
            <ul className="mt-4 divide-y divide-slate-100">
              {certs.map((e) => (
                <li key={e.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0"><div className="text-sm font-semibold line-clamp-1">{e.course.title}</div><div className="text-xs text-slate-500">{e.certificate_no} · {fmtDate(e.completed_at)}</div></div>
                  <Button asChild size="sm" variant="outline" data-testid={`profile-cert-download-${e.id}`}><a href={certUrl(e.id)} onClick={downloadCert}><Download className="h-4 w-4" /></a></Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
