import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/common";
import { FileUpload } from "@/components/FileUpload";
import { useAuth } from "@/context/AuthContext";
import { landingOf } from "@/lib/landing";
import { api, errMsg, fileUrl } from "@/lib/api";

const Card = ({ title, children }) => <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-4"><h2 className="font-bold">{title}</h2>{children}</section>;
const Lines = ({ value, onChange, testid }) => <Textarea rows={4} value={value.join("\n")} onChange={(e) => onChange(e.target.value.split("\n"))} data-testid={testid} />;

function Photo({ label, path, onChange, testid }) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-4">
        <img src={fileUrl(path)} alt="" className="h-24 w-32 object-cover rounded-lg bg-slate-100" data-testid={`${testid}-preview`} />
        <FileUpload accept="image/*" kind="public" label="Ganti Foto" testid={testid} onUploaded={onChange} />
      </div>
    </div>
  );
}

export default function AdminLanding() {
  const { settings, loadSettings } = useAuth();
  const [f, setF] = useState(null);
  const [cover, setCover] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (settings && !f) {
      setF(landingOf(settings));
      setCover(settings.cover_path || "");
    }
  }, [settings, f]);
  if (!f) return null;
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v?.target ? v.target.value : v }));
  const setFeat = (i, k, v) => setF((x) => ({ ...x, features: x.features.map((ft, j) => (j === i ? { ...ft, [k]: v } : ft)) }));
  const setOff = (i, k, v) => setF((x) => ({ ...x, officials: x.officials.map((o, j) => (j === i ? { ...o, [k]: v } : o)) }));
  const setSoc = (k) => (e) => setF((x) => ({ ...x, social: { ...(x.social || {}), [k]: e.target.value } }));

  const save = async () => {
    setBusy(true);
    try {
      const clean = { ...f, steps: f.steps.filter((s) => s.trim()), kms_points: f.kms_points.filter((s) => s.trim()), zoom_points: f.zoom_points.filter((s) => s.trim()),
        legal_basis: f.legal_basis.filter((s) => s.trim()), slide_interval: Math.max(3, Number(f.slide_interval) || 10) };
      await api.put("/admin/settings", { app_name: settings.app_name, landing: clean, cover_path: f.cover_slides?.[0] || cover });
      await loadSettings();
      toast.success("Konten halaman login disimpan");
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader title="Konten Halaman Login" subtitle="Ubah teks dan foto yang tampil di halaman login (Tentang, Fitur, KMS, Webinar, Bantuan)."
        action={<Button onClick={save} disabled={busy} className="bg-[#0F2942] hover:bg-[#0A1D30]" data-testid="landing-save-button">{busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Simpan Konten</Button>} />
      <Card title="Foto Sampul Login (Slide Otomatis)">
        <p className="text-sm text-slate-500 -mt-2">Unggah satu atau beberapa foto. Jika lebih dari satu, foto berganti otomatis sesuai interval.</p>
        <div className="flex flex-wrap gap-3" data-testid="landing-slides">
          {(f.cover_slides.length ? f.cover_slides : [cover].filter(Boolean)).map((p, i) => (
            <div key={p + i} className="relative">
              <img src={fileUrl(p)} alt="" className="h-24 w-36 object-cover rounded-lg bg-slate-100" data-testid={`landing-slide-${i}`} />
              {f.cover_slides.length > 0 && <button type="button" onClick={() => setF((x) => ({ ...x, cover_slides: x.cover_slides.filter((_, j) => j !== i) }))} className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-rose-600 text-white text-xs" data-testid={`landing-slide-remove-${i}`}>×</button>}
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <FileUpload multiple accept="image/*" kind="public" label="Tambah Foto Slide" testid="landing-slide-upload"
            onUploaded={(p) => setF((x) => ({ ...x, cover_slides: [...(x.cover_slides.length ? x.cover_slides : [cover].filter(Boolean)), p] }))} />
          <div className="grid gap-1"><Label className="text-xs">Interval (detik)</Label><Input type="number" min={3} value={f.slide_interval} onChange={set("slide_interval")} className="w-28" data-testid="landing-slide-interval" /></div>
        </div>
      </Card>
      <Card title="Kata Sambutan & Foto Pejabat">
        <div className="grid gap-2"><Label>Judul</Label><Input value={f.welcome_title} onChange={set("welcome_title")} data-testid="landing-welcome-title-input" /></div>
        <div className="grid gap-2"><Label>Kata sambutan</Label><Textarea rows={5} value={f.welcome_speech} onChange={set("welcome_speech")} data-testid="landing-welcome-speech-input" /></div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {f.officials.map((o, i) => (
            <div key={i} className="p-3 rounded-lg border border-slate-200 space-y-2 text-center" data-testid={`landing-official-edit-${i}`}>
              <img src={fileUrl(o.photo) || "/favicon.svg"} alt="" className="mx-auto h-20 w-20 rounded-full object-cover bg-slate-100" />
              <FileUpload accept="image/*" kind="public" label="Foto" testid={`landing-official-photo-${i}`} onUploaded={(p) => setOff(i, "photo", p)} />
              <Input value={o.name} onChange={(e) => setOff(i, "name", e.target.value)} placeholder="Nama" data-testid={`landing-official-name-${i}`} />
              <Input value={o.title} onChange={(e) => setOff(i, "title", e.target.value)} placeholder="Jabatan" data-testid={`landing-official-title-${i}`} />
            </div>
          ))}
        </div>
      </Card>
      <Card title="Tentang Kami (Konsep, Tujuan, Dasar Hukum)">
        <div className="grid gap-2"><Label>Judul</Label><Input value={f.about_us_title} onChange={set("about_us_title")} data-testid="landing-about-us-title-input" /></div>
        <div className="grid gap-2"><Label>Penjelasan singkat (kiri)</Label><Textarea rows={4} value={f.about_us} onChange={set("about_us")} data-testid="landing-about-us-input" /></div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="grid gap-2"><Label>Konsep</Label><Textarea rows={3} value={f.concept} onChange={set("concept")} data-testid="landing-concept-input" /></div>
          <div className="grid gap-2"><Label>Tujuan</Label><Textarea rows={3} value={f.goal} onChange={set("goal")} data-testid="landing-goal-input" /></div>
        </div>
        <div className="grid gap-2"><Label>Dasar hukum (satu per baris)</Label><Lines value={f.legal_basis} onChange={set("legal_basis")} testid="landing-legal-input" /></div>
      </Card>
      <Card title="Media Sosial (Footer)">
        <div className="grid sm:grid-cols-3 gap-4">
          {[["website", "Website"], ["instagram", "Instagram"], ["facebook", "Facebook"]].map(([k, l]) => (
            <div key={k} className="grid gap-2"><Label>{l}</Label><Input value={f.social?.[k] || ""} onChange={setSoc(k)} placeholder="https://..." data-testid={`landing-social-${k}-input`} /></div>
          ))}
        </div>
      </Card>
      <Card title="Alamat Kantor & Google Maps (Footer)">
        <div className="grid gap-2"><Label>Nama kantor</Label><Input value={f.office_name} onChange={set("office_name")} data-testid="landing-office-name-input" /></div>
        <div className="grid gap-2"><Label>Alamat lengkap (opsional)</Label><Textarea rows={2} value={f.office_address} onChange={set("office_address")} data-testid="landing-office-address-input" /></div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="grid gap-2"><Label>Tautan Google Maps</Label><Input value={f.maps_link} onChange={set("maps_link")} placeholder="https://maps.app.goo.gl/..." data-testid="landing-maps-link-input" /></div>
          <div className="grid gap-2"><Label>URL sematan peta (embed)</Label><Input value={f.maps_embed} onChange={set("maps_embed")} placeholder="https://www.google.com/maps?q=LAT,LNG&output=embed" data-testid="landing-maps-embed-input" /></div>
        </div>
        <p className="text-xs text-slate-500">URL embed: Google Maps → Bagikan → Sematkan peta → salin isi src, atau format https://www.google.com/maps?q=LAT,LNG&z=17&output=embed. Kosongkan untuk menyembunyikan peta.</p>
      </Card>
      <Card title="Tentang LMS">
        <div className="grid gap-2"><Label>Teks tentang</Label><Textarea rows={3} value={f.about_text} onChange={set("about_text")} data-testid="landing-about-input" /></div>
        <div className="grid gap-2"><Label>Langkah penggunaan (satu per baris)</Label><Lines value={f.steps} onChange={set("steps")} testid="landing-steps-input" /></div>
      </Card>
      <Card title="Fitur">
        <div className="grid sm:grid-cols-2 gap-4">
          {f.features.map((ft, i) => (
            <div key={i} className="p-3 rounded-lg border border-slate-200 space-y-2" data-testid={`landing-feature-${i}`}>
              <Input value={ft.title} onChange={(e) => setFeat(i, "title", e.target.value)} placeholder="Judul fitur" />
              <Textarea rows={2} value={ft.text} onChange={(e) => setFeat(i, "text", e.target.value)} placeholder="Keterangan" />
            </div>
          ))}
        </div>
      </Card>
      {[["kms", "Bagian KMS"], ["zoom", "Bagian Webinar Zoom"]].map(([k, t]) => (
        <Card key={k} title={t}>
          <div className="grid gap-2"><Label>Judul</Label><Input value={f[`${k}_title`]} onChange={set(`${k}_title`)} data-testid={`landing-${k}-title-input`} /></div>
          <div className="grid gap-2"><Label>Teks</Label><Textarea rows={3} value={f[`${k}_text`]} onChange={set(`${k}_text`)} data-testid={`landing-${k}-text-input`} /></div>
          <div className="grid gap-2"><Label>Poin (satu per baris)</Label><Lines value={f[`${k}_points`]} onChange={set(`${k}_points`)} testid={`landing-${k}-points-input`} /></div>
          <Photo label="Foto" path={f[`${k}_image`]} onChange={set(`${k}_image`)} testid={`landing-${k}-image-upload`} />
        </Card>
      ))}
      <Card title="Bantuan">
        <Textarea rows={2} value={f.help_text} onChange={set("help_text")} data-testid="landing-help-input" />
      </Card>
    </div>
  );
}
