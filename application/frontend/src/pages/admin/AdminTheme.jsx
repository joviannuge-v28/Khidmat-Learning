import { useEffect, useState } from "react";
import { Loader2, Palette, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/common";
import { FileUpload } from "@/components/FileUpload";
import { useAuth } from "@/context/AuthContext";
import { THEME_DEFAULT } from "@/lib/theme";
import { api, errMsg, fileUrl } from "@/lib/api";

const COLORS = [["primary", "Warna Utama (tombol, kartu sambutan)"], ["sidebar", "Warna Menu Samping"], ["nav", "Warna Menu Aktif"], ["accent", "Warna Aksen"]];
const PRESETS = [["Biru Dumai", THEME_DEFAULT], ["Hijau Melayu", { primary: "#14532D", sidebar: "#0B2A1A", nav: "#16A34A", accent: "#EAB308" }], ["Merah Marun", { primary: "#7F1D1D", sidebar: "#3B0A0A", nav: "#DC2626", accent: "#F59E0B" }], ["Ungu Tua", { primary: "#3B0764", sidebar: "#1E0336", nav: "#7C3AED", accent: "#F59E0B" }]];

export default function AdminTheme() {
  const { settings, loadSettings } = useAuth();
  const [t, setT] = useState(null);
  const [logo, setLogo] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (settings && !t) {
      setT({ ...THEME_DEFAULT, ...(settings.theme || {}) });
      setLogo(settings.welcome_logo_path || "");
    }
  }, [settings, t]);
  if (!t) return null;
  const save = async () => {
    setBusy(true);
    try {
      await api.put("/admin/settings", { app_name: settings.app_name, theme: t, welcome_logo_path: logo });
      await loadSettings();
      toast.success("Tema & logo disimpan");
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader title="Tema & Logo" subtitle="Ubah warna tema aplikasi dan logo di kartu Selamat Datang Kembali."
        action={<Button onClick={save} disabled={busy} className="bg-[#0F2942] hover:bg-[#0A1D30]" data-testid="theme-save-button">{busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Simpan</Button>} />
      <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-5">
        <h2 className="font-bold flex items-center gap-2"><Palette className="h-4 w-4" />Warna Tema</h2>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map(([name, p]) => (
            <button key={name} onClick={() => setT({ ...p })} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 hover:border-slate-400 text-sm" data-testid={`theme-preset-${name}`}>
              <span className="h-4 w-4 rounded-full" style={{ background: p.primary }} /><span className="h-4 w-4 rounded-full" style={{ background: p.accent }} />{name}
            </button>
          ))}
          <Button variant="ghost" size="sm" onClick={() => setT({ ...THEME_DEFAULT })} data-testid="theme-reset"><RotateCcw className="h-4 w-4 mr-1" />Bawaan</Button>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          {COLORS.map(([k, label]) => (
            <div key={k} className="grid gap-2"><Label>{label}</Label><div className="flex gap-2"><Input type="color" value={t[k]} onChange={(e) => setT({ ...t, [k]: e.target.value })} className="h-10 w-16 p-1" data-testid={`theme-${k}-color`} /><Input value={t[k]} onChange={(e) => setT({ ...t, [k]: e.target.value })} className="font-mono" /></div></div>
          ))}
        </div>
        <div className="rounded-xl p-5 text-white flex items-center justify-between" style={{ background: t.primary }} data-testid="theme-preview">
          <div><div className="text-xs uppercase tracking-widest" style={{ color: t.accent }}>Pratinjau</div><div className="text-lg font-bold">Selamat datang kembali</div></div>
          <span className="px-3 py-1.5 rounded-lg text-sm" style={{ background: t.nav }}>Menu aktif</span>
        </div>
      </section>
      <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <h2 className="font-bold">Logo Kota Dumai (kanan kartu Selamat Datang Kembali)</h2>
        <div className="flex items-center gap-4">
          <div className="h-20 w-20 rounded-xl border border-slate-200 bg-slate-50 grid place-items-center">{logo ? <img src={fileUrl(logo)} alt="Logo" className="h-16 w-16 object-contain" data-testid="theme-welcome-logo-preview" /> : <span className="text-[10px] text-slate-400">Belum ada</span>}</div>
          <FileUpload accept="image/png,image/jpeg,image/webp,image/svg+xml" kind="public" label="Unggah Logo" maxMB={10} testid="theme-welcome-logo-upload" onUploaded={setLogo} />
          {logo && <Button variant="ghost" size="sm" onClick={() => setLogo("")} data-testid="theme-welcome-logo-remove">Hapus</Button>}
        </div>
      </section>
    </div>
  );
}
