import { useRef, useState } from "react";
import { CheckCircle2, Download, FileSpreadsheet, Loader2, RefreshCw, Upload, XCircle } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ImportHistory } from "@/pages/admin/ImportHistory";
import { api, downloadFromApi, errMsg } from "@/lib/api";

export const ImportUsersDialog = ({ open, onOpenChange, onDone }) => {
  const ref = useRef(null);
  const [pw, setPw] = useState("");
  const [upd, setUpd] = useState(true);
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState(null);
  const [logKey, setLogKey] = useState(0);

  const close = (o) => {
    if (!o) { setFile(null); setRes(null); }
    onOpenChange(o);
  };

  const submit = async () => {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post(`/admin/users/import?default_password=${encodeURIComponent(pw)}&update_existing=${upd}`, fd);
      setRes(data);
      setLogKey((k) => k + 1);
      if (data.created || data.updated) { toast.success(`${data.created} ditambahkan, ${data.updated} diperbarui`); onDone(); }
      else toast.error("Tidak ada data yang ditambahkan atau diperbarui");
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="import-users-dialog">
        <DialogHeader>
          <DialogTitle>Impor Pegawai dari Excel</DialogTitle>
          <DialogDescription>Daftarkan banyak pegawai sekaligus, atau perbarui jabatan dan unit kerja pegawai yang NIP-nya sudah terdaftar.</DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="import">
        <TabsList className="mb-4"><TabsTrigger value="import" data-testid="import-tab-import">Impor</TabsTrigger><TabsTrigger value="history" data-testid="import-tab-history">Riwayat Impor</TabsTrigger></TabsList>
        <TabsContent value="history"><ImportHistory refreshKey={logKey} /></TabsContent>
        <TabsContent value="import">
        <div className="space-y-5">
          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 text-sm space-y-2">
            <p><b>1.</b> Unduh template, isi satu pegawai per baris. Kolom: Nama*, NIP, Email (isi salah satu), Jabatan, Unit Kerja, Peran (pegawai / pic / admin, kosong = pegawai), Kata Sandi. Kolom NIP di template sudah berformat Teks agar 18 digit tidak berubah.</p>
            <Button size="sm" variant="outline" onClick={() => downloadFromApi("/admin/users/import-template", "template-impor-pegawai.xlsx")} data-testid="import-template-button"><Download className="h-4 w-4 mr-2" />Unduh Template Excel</Button>
          </div>
          <div className="grid gap-2">
            <Label><b>2.</b> Kata sandi awal (dipakai jika kolom Kata Sandi kosong)</Label>
            <Input type="text" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Minimal 6 karakter" data-testid="import-default-password-input" />
          </div>
          <label className="flex items-start gap-3 p-3 rounded-lg border border-slate-200 cursor-pointer">
            <Switch checked={upd} onCheckedChange={setUpd} className="mt-0.5" data-testid="import-update-existing-switch" />
            <span className="text-sm"><b>Perbarui pegawai yang NIP-nya sudah terdaftar</b><span className="block text-xs text-slate-500">Hanya Jabatan dan Unit Kerja yang diubah (sel kosong diabaikan). Nama, peran, dan kata sandi tidak berubah.</span></span>
          </label>
          <div className="grid gap-2">
            <Label><b>3.</b> Pilih file Excel (.xlsx)</Label>
            <input ref={ref} type="file" accept=".xlsx" className="hidden" onChange={(e) => { setFile(e.target.files?.[0] || null); setRes(null); e.target.value = ""; }} data-testid="import-file-input" />
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="outline" onClick={() => ref.current?.click()} data-testid="import-choose-file-button"><FileSpreadsheet className="h-4 w-4 mr-2 text-emerald-600" />Pilih File</Button>
              <span className="text-sm text-slate-600 truncate" data-testid="import-file-name">{file?.name || "Belum ada file"}</span>
            </div>
          </div>
          <Button onClick={submit} disabled={!file || busy} className="w-full bg-[#0F2942] hover:bg-[#0A1D30]" data-testid="import-submit-button">
            {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}Impor Sekarang
          </Button>
          {res && (
            <div className="space-y-3" data-testid="import-result">
              <div className="flex flex-wrap gap-4 text-sm font-semibold">
                <span className="flex items-center gap-1.5 text-emerald-700" data-testid="import-created-count"><CheckCircle2 className="h-4 w-4" />{res.created} ditambahkan</span>
                <span className="flex items-center gap-1.5 text-blue-700" data-testid="import-updated-count"><RefreshCw className="h-4 w-4" />{res.updated} diperbarui</span>
                <span className="flex items-center gap-1.5 text-rose-700" data-testid="import-failed-count"><XCircle className="h-4 w-4" />{res.failed} gagal</span>
              </div>
              {res.errors.length > 0 && (
                <ul className="max-h-56 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-lg text-sm" data-testid="import-errors">
                  {res.errors.map((e) => <li key={e.row} className="px-3 py-2"><span className="font-mono text-xs text-slate-500">Baris {e.row}</span> · <b>{e.name}</b> — <span className="text-rose-700">{e.error}</span></li>)}
                </ul>
              )}
            </div>
          )}
        </div>
        </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
