import { useEffect, useState } from "react";
import { Landmark, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/common";
import { FileUpload } from "@/components/FileUpload";
import { useAuth } from "@/context/AuthContext";
import { api, errMsg, fileUrl } from "@/lib/api";

const KEYS = ["app_name", "tagline", "logo_path", "cover_path", "announcement"];

export default function AdminSettings() {
  const { settings, loadSettings } = useAuth();
  const [f, setF] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (settings) setF(Object.fromEntries(KEYS.map((k) => [k, settings[k] || ""])));
  }, [settings]);

  if (!f) return null;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const save = async () => {
    setBusy(true);
    try {
      await api.put("/admin/settings", f);
      await loadSettings();
      toast.success("Pengaturan disimpan");
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-5xl">
      <PageHeader title="Pengaturan Sistem" subtitle="Atur identitas aplikasi, halaman login, dan sertifikat."
        action={<Button onClick={save} disabled={busy} className="bg-[#0F2942] hover:bg-[#0A1D30]" data-testid="settings-save-button">{busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Simpan Pengaturan</Button>} />
      <div className="grid lg:grid-cols-[1fr_300px] gap-6 items-start">
        <div className="space-y-6">
          <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <h2 className="font-bold">Identitas Aplikasi</h2>
            <div className="grid gap-2"><Label>Nama Aplikasi</Label><Input value={f.app_name} onChange={set("app_name")} data-testid="settings-app-name-input" /></div>
            <div className="grid gap-2"><Label>Tagline (tampil di sampul login)</Label><Input value={f.tagline} onChange={set("tagline")} data-testid="settings-tagline-input" /></div>
            <div className="grid gap-2"><Label>Pengumuman (tampil di header)</Label><Textarea rows={2} value={f.announcement} onChange={set("announcement")} data-testid="settings-announcement-input" /></div>
            <div className="grid gap-2">
              <Label>Logo</Label>
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-lg border border-slate-200 grid place-items-center bg-slate-50">
                  {f.logo_path ? <img src={fileUrl(f.logo_path)} alt="Logo" className="h-14 w-14 object-contain" data-testid="settings-logo-preview" /> : <Landmark className="h-6 w-6 text-slate-400" />}
                </div>
                <FileUpload accept="image/*" kind="public" label="Unggah Logo" testid="settings-logo-upload" onUploaded={(p) => setF((x) => ({ ...x, logo_path: p }))} />
                {f.logo_path && <Button variant="ghost" size="sm" onClick={() => setF({ ...f, logo_path: "" })} data-testid="settings-logo-remove">Hapus</Button>}
              </div>
            </div>
          </section>
          <section className="bg-white rounded-xl border border-slate-200 p-6 text-sm text-slate-600" data-testid="settings-signer-moved">
            Penandatangan sertifikat (nama, jabatan, pangkat, NIP, TTD) kini dikelola di menu <b>Desain Sertifikat</b> dan dapat dipilih per kursus/webinar.
          </section>
        </div>
        <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <h2 className="font-bold">Foto Sampul Login</h2>
          <div className="aspect-[3/4] rounded-xl overflow-hidden bg-slate-100" data-testid="settings-cover-preview">
            {f.cover_path && <img src={fileUrl(f.cover_path)} alt="Sampul" className="w-full h-full object-contain" />}
          </div>
          <FileUpload accept="image/*" kind="public" label="Unggah Sampul" testid="settings-cover-upload" onUploaded={(p) => setF((x) => ({ ...x, cover_path: p }))} />
          <p className="text-xs text-slate-500">Foto ditampilkan utuh (tidak terpotong) di semua ukuran layar.</p>
        </section>
      </div>
    </div>
  );
}
