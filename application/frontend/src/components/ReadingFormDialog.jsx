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
import { MediaInput } from "@/components/MediaInput";
import { api, errMsg, fileUrl } from "@/lib/api";

const EMPTY = { title: "", author: "", category_id: "", summary: "", content: "", cover: "", file_path: "", file_name: "", link_url: "", video_url: "" };

export const ReadingFormDialog = ({ open, onOpenChange, initial, onSaved, mode = "propose" }) => {
  const [f, setF] = useState(EMPTY);
  const [cats, setCats] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setF({ ...EMPTY, ...(initial || {}) });
      api.get("/categories?type=kms").then((r) => setCats(r.data));
    }
  }, [open, initial]);

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const save = async () => {
    if (!f.title.trim()) return toast.error("Judul wajib diisi");
    setBusy(true);
    try {
      const body = Object.fromEntries(Object.keys(EMPTY).map((k) => [k, f[k] || ""]));
      if (initial?.id) await api.put(`/admin/readings/${initial.id}`, body);
      else await api.post("/readings", body);
      toast.success(mode === "propose" ? "Usulan bacaan terkirim, menunggu persetujuan admin" : "Bacaan disimpan");
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="reading-form-dialog">
        <DialogHeader><DialogTitle>{initial?.id ? "Ubah Bacaan" : mode === "propose" ? "Usulkan Bacaan Baru" : "Tambah Bacaan"}</DialogTitle></DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-2"><Label>Judul *</Label><Input value={f.title} onChange={set("title")} data-testid="reading-title-input" /></div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="grid gap-2"><Label>Penulis / Sumber</Label><Input value={f.author} onChange={set("author")} data-testid="reading-author-input" /></div>
            <div className="grid gap-2">
              <Label>Kategori</Label>
              <Select value={f.category_id || undefined} onValueChange={(v) => setF({ ...f, category_id: v })}>
                <SelectTrigger data-testid="reading-category-select"><SelectValue placeholder="Pilih kategori" /></SelectTrigger>
                <SelectContent>{cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-2"><Label>Ringkasan</Label><Textarea rows={2} value={f.summary} onChange={set("summary")} data-testid="reading-summary-input" /></div>
          <div className="grid gap-2"><Label>Isi Bacaan</Label><Textarea rows={6} value={f.content} onChange={set("content")} data-testid="reading-content-input" /></div>
          <div className="grid gap-2"><Label>Tautan Eksternal (opsional)</Label><Input value={f.link_url} onChange={set("link_url")} placeholder="https://" data-testid="reading-link-input" /></div>
          <div className="grid gap-2"><Label>Video (opsional)</Label><MediaInput type="video" value={f.video_url} onChange={(v) => setF((x) => ({ ...x, video_url: v }))} testid="reading-video" /></div>
          <div className="flex flex-wrap items-center gap-3">
            <FileUpload accept=".pdf,.doc,.docx,.ppt,.pptx" label="Unggah Dokumen PDF/Office" testid="reading-file-upload" onUploaded={(p, n) => setF((x) => ({ ...x, file_path: p, file_name: n }))} />
            {f.file_name && <span className="text-sm text-slate-600 truncate max-w-[220px]">{f.file_name}</span>}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <FileUpload accept="image/*" label="Unggah Sampul" testid="reading-cover-upload" onUploaded={(p) => setF((x) => ({ ...x, cover: p }))} />
            {f.cover && <img src={fileUrl(f.cover)} alt="" className="h-14 w-10 object-cover rounded" />}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={save} disabled={busy} className="bg-[#0F2942] hover:bg-[#0A1D30]" data-testid="reading-save-button">
            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{mode === "propose" && !initial?.id ? "Kirim Usulan" : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
