import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileUpload } from "@/components/FileUpload";
import { CertificateConfigEditor, CERT_DEFAULT } from "@/components/CertificateConfigEditor";
import { DateTimePicker } from "@/components/DateTimePicker";
import { api, errMsg, fileUrl } from "@/lib/api";
import { MaterialsEditor } from "@/components/MaterialsEditor";
import { SignerSelect } from "@/components/SignerSelect";

const EMPTY = { title: "", description: "", category_id: "", thumbnail: "", instructor: "", duration_hours: 2, start_at: "", zoom_url: "", meeting_id: "", passcode: "", certificate: CERT_DEFAULT, materials: [], signer_id: "" };
const KEYS = Object.keys(EMPTY);

export const ZoomFormDialog = ({ open, onOpenChange, initial, onSaved, mode = "admin" }) => {
  const [f, setF] = useState(EMPTY);
  const [cats, setCats] = useState([]);
  const [busy, setBusy] = useState(false);
  const propose = mode === "propose";

  useEffect(() => {
    if (open) {
      setF({ ...EMPTY, ...(initial || {}), certificate: { ...CERT_DEFAULT, ...(initial?.certificate || {}) } });
      api.get("/categories?type=course").then((r) => setCats(r.data));
    }
  }, [open, initial]);

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const save = async () => {
    if (!f.title.trim()) return toast.error("Judul wajib diisi");
    if (!f.instructor.trim()) return toast.error("Nama pengajar / narasumber wajib diisi");
    if (!f.start_at) return toast.error("Jadwal wajib diisi");
    setBusy(true);
    try {
      const body = { ...Object.fromEntries(KEYS.map((k) => [k, f[k]])), kind: "zoom", published: true, duration_hours: Number(f.duration_hours) || 1,
        certificate: { ...f.certificate, number_start: Number(f.certificate.number_start) || 1 } };
      const base = propose ? "/proposals" : "/admin/courses";
      if (initial?.id) await api.put(`${base}/${initial.id}`, body);
      else await api.post(base, body);
      toast.success(propose ? "Usulan webinar terkirim, menunggu persetujuan admin LMS" : "Webinar disimpan");
      onOpenChange(false);
      onSaved?.();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="zoom-form-dialog">
        <DialogHeader><DialogTitle>{initial?.id ? "Ubah Webinar Zoom" : propose ? "Usulkan Webinar Zoom" : "Tambah Webinar Zoom"}</DialogTitle></DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2"><Label>Judul *</Label><Input value={f.title} onChange={set("title")} data-testid="zoom-title-input" /></div>
          <div className="grid gap-2"><Label>Deskripsi</Label><Textarea rows={3} value={f.description} onChange={set("description")} data-testid="zoom-description-input" /></div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="grid gap-2"><Label>Pengajar / Narasumber *</Label><Input value={f.instructor} onChange={set("instructor")} placeholder="Contoh: Dinas Kominfo Kota Dumai" data-testid="zoom-instructor-input" /></div>
            <div className="grid gap-2">
              <Label>Kategori</Label>
              <Select value={f.category_id || undefined} onValueChange={(v) => setF({ ...f, category_id: v })}>
                <SelectTrigger data-testid="zoom-category-select"><SelectValue placeholder="Pilih kategori" /></SelectTrigger>
                <SelectContent>{cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-2 sm:col-span-2"><Label>Jadwal Mulai *</Label><DateTimePicker value={f.start_at} onChange={(v) => setF((x) => ({ ...x, start_at: v }))} testid="zoom-start" /></div>
            <div className="grid gap-2"><Label>Durasi (JP)</Label><Input type="number" value={f.duration_hours} onChange={set("duration_hours")} data-testid="zoom-duration-input" /></div>
          </div>
          <div className="grid gap-2"><Label>Tautan Zoom Meeting {propose ? "(opsional, dapat diisi admin)" : "*"}</Label><Input value={f.zoom_url} onChange={set("zoom_url")} placeholder="https://zoom.us/j/..." data-testid="zoom-url-input" /></div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="grid gap-2"><Label>Meeting ID</Label><Input value={f.meeting_id} onChange={set("meeting_id")} data-testid="zoom-meeting-id-input" /></div>
            <div className="grid gap-2"><Label>Passcode</Label><Input value={f.passcode} onChange={set("passcode")} data-testid="zoom-passcode-input" /></div>
          </div>
          <div className="flex items-center gap-4">
            {f.thumbnail ? <img src={fileUrl(f.thumbnail)} alt="" className="h-16 w-28 object-cover rounded-lg" /> : <div className="h-16 w-28 rounded-lg bg-slate-100" />}
            <FileUpload accept="image/*" label="Unggah Gambar" testid="zoom-thumbnail-upload" onUploaded={(p) => setF((x) => ({ ...x, thumbnail: p }))} />
          </div>
          <div className="grid gap-2">
            <Label>Materi Webinar untuk Peserta (PPTX / PDF, bisa banyak file)</Label>
            <MaterialsEditor value={f.materials || []} onChange={(fn) => setF((x) => ({ ...x, materials: fn(x.materials || []) }))} testid="zoom-materials" />
          </div>
          <SignerSelect value={f.signer_id} onChange={(v) => setF((x) => ({ ...x, signer_id: v }))} testid="zoom-signer-select" />
          {!propose && (
            <div className="pt-4 border-t border-slate-200">
              <h3 className="font-bold mb-3">Penomoran Sertifikat Webinar</h3>
              <CertificateConfigEditor value={f.certificate} onChange={(v) => setF((x) => ({ ...x, certificate: v }))} />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={save} disabled={busy} className="bg-[#0F2942] hover:bg-[#0A1D30]" data-testid="zoom-save-button">
            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{propose ? "Kirim Usulan" : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
