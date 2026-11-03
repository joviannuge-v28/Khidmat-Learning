import { useEffect, useState } from "react";
import { ExternalLink, Loader2, Plus, QrCode, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/common";
import { FileUpload } from "@/components/FileUpload";
import { surveyQr } from "@/components/Survey";
import { api, errMsg } from "@/lib/api";

const BLANK = { label: "", url: "", qr_path: "", description: "" };

function ItemEditor({ it, i, saved, onChange, onRemove }) {
  const set = (k) => (e) => onChange({ ...it, [k]: e.target.value });
  const qr = it.qr_path ? surveyQr(it, i) : saved ? surveyQr(it, i) : "";
  return (
    <div className="p-4 rounded-xl border border-slate-200 grid md:grid-cols-[1fr_160px] gap-4" data-testid={`survey-item-${i}`}>
      <div className="space-y-3">
        <div className="grid gap-1"><Label>Nama survei</Label><Input value={it.label} onChange={set("label")} placeholder="Mis. Survei Kepuasan Layanan BKPSDM" data-testid={`survey-item-label-${i}`} /></div>
        <div className="grid gap-1"><Label>Tautan survei</Label><Input value={it.url} onChange={set("url")} placeholder="https://forms.gle/..." data-testid={`survey-item-url-${i}`} /></div>
        <div className="grid gap-1"><Label>Keterangan (opsional)</Label><Input value={it.description} onChange={set("description")} data-testid={`survey-item-desc-${i}`} /></div>
        <div className="flex flex-wrap items-center gap-2">
          <FileUpload accept="image/png,image/jpeg,image/webp" kind="public" label="Unggah Gambar Barcode" maxMB={5} testid={`survey-item-qr-upload-${i}`} onUploaded={(p) => onChange({ ...it, qr_path: p })} />
          {it.qr_path && <Button size="sm" variant="ghost" onClick={() => onChange({ ...it, qr_path: "" })} data-testid={`survey-item-qr-remove-${i}`}>Pakai barcode otomatis</Button>}
          {it.url && <Button size="sm" variant="ghost" asChild><a href={it.url} target="_blank" rel="noreferrer noopener"><ExternalLink className="h-4 w-4 mr-1" />Uji tautan</a></Button>}
          <Button size="sm" variant="ghost" onClick={onRemove} data-testid={`survey-item-remove-${i}`}><Trash2 className="h-4 w-4 mr-1 text-rose-600" />Hapus</Button>
        </div>
      </div>
      <div className="grid place-items-center rounded-lg bg-slate-50 border border-slate-200 p-2 h-40 self-start">
        {qr ? <img src={qr} alt="Barcode" className="h-full w-full object-contain" data-testid={`survey-item-qr-preview-${i}`} /> : (
          <div className="text-center text-xs text-slate-400"><QrCode className="h-10 w-10 mx-auto mb-1" />Barcode dibuat otomatis dari tautan setelah disimpan</div>
        )}
      </div>
    </div>
  );
}

export default function AdminSurvey() {
  const [f, setF] = useState(null);
  const [savedCount, setSavedCount] = useState(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api.get("/public/survey").then((r) => { setF(r.data); setSavedCount(r.data.items.length); });
  }, []);
  if (!f) return <div className="text-slate-500">Memuat...</div>;
  const setItem = (i, v) => setF((x) => ({ ...x, items: x.items.map((it, j) => (j === i ? v : it)) }));

  const save = async () => {
    setBusy(true);
    try {
      const { data } = await api.put("/admin/survey", { ...f, items: f.items.map((it) => ({ ...it, url: it.url.trim() })) });
      setF(data);
      setSavedCount(data.items.length);
      window.dispatchEvent(new Event("survey:updated"));
      toast.success("Survei kepuasan disimpan");
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader title="Survei Kepuasan" subtitle="Kelola barcode dan tautan survei yang tampil di menu navbar halaman depan, halaman /survei, dan footer ASN."
        action={<Button onClick={save} disabled={busy} className="bg-[#0F2942] hover:bg-[#0A1D30]" data-testid="survey-save-button">{busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}Simpan</Button>} />
      <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <div className="grid gap-1"><Label>Judul halaman</Label><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} data-testid="survey-title-input" /></div>
        <div className="grid gap-1"><Label>Deskripsi</Label><Textarea rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} data-testid="survey-description-input" /></div>
        <label className="flex items-center gap-3 text-sm"><Switch checked={f.show_in_footer} onCheckedChange={(v) => setF({ ...f, show_in_footer: v })} data-testid="survey-footer-switch" />Tampilkan di footer ASN (setelah login)</label>
      </section>
      <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">Daftar Survei ({f.items.length})</h2>
          <Button size="sm" variant="outline" onClick={() => setF({ ...f, items: [...f.items, { ...BLANK }] })} data-testid="survey-add-button"><Plus className="h-4 w-4 mr-1" />Tambah Survei</Button>
        </div>
        <p className="text-xs text-slate-500">Isi tautan survei (Google Form, SKM, dll). Barcode dibuat otomatis dari tautan, atau unggah gambar barcode sendiri. Catatan: scan dari barcode otomatis & klik tombol "Isi Survei" tercatat di Rekap Survei Dashboard; barcode hasil unggah sendiri tidak dapat dihitung.</p>
        {f.items.length === 0 && <p className="text-sm text-slate-500 py-6 text-center" data-testid="survey-admin-empty">Belum ada survei. Klik "Tambah Survei".</p>}
        {f.items.map((it, i) => (
          <ItemEditor key={i} it={it} i={i} saved={i < savedCount} onChange={(v) => setItem(i, v)} onRemove={() => setF({ ...f, items: f.items.filter((_, j) => j !== i) })} />
        ))}
      </section>
    </div>
  );
}
