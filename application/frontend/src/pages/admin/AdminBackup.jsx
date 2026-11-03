import { useEffect, useRef, useState } from "react";
import { Archive, CalendarClock, Code2, Database, Download, HardDriveDownload, Loader2, RotateCcw, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PageHeader } from "@/components/common";
import { downloadFromApi, errMsg, api, fmtDateTime } from "@/lib/api";

const ITEMS = [
  { key: "database", icon: Database, title: "Backup Database", text: "Seluruh koleksi MongoDB dalam format JSON (dapat dipulihkan lewat tombol Recovery)." },
  { key: "application", icon: Code2, title: "Backup Aplikasi", text: "Kode sumber backend & frontend. File .env rahasia tidak disertakan." },
  { key: "full", icon: Archive, title: "Backup Lengkap", text: "Database + aplikasi + semua file pembelajaran. Ukuran bisa besar." },
];

const mb = (b) => `${(b / 1024 / 1024).toFixed(1)} MB`;

function AutoBackups() {
  const [list, setList] = useState([]);
  const [busy, setBusy] = useState("");
  const load = () => api.get("/admin/backups").then((r) => setList(r.data));
  useEffect(() => {
    load();
  }, []);
  const create = async () => {
    setBusy("new");
    try { await api.post("/admin/backups"); toast.success("Backup tersimpan di penyimpanan terpisah"); load(); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(""); }
  };
  const dl = (b) => { setBusy(b.id); downloadFromApi(`/admin/backups/${b.id}/download`, b.name).catch((e) => toast.error(errMsg(e))).finally(() => setBusy("")); };
  return (
    <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-4" data-testid="auto-backups">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-bold flex items-center gap-2"><CalendarClock className="h-4 w-4 text-blue-700" />Backup Otomatis Bulanan</h2>
          <p className="text-sm text-slate-500">Berjalan otomatis setiap tanggal 1 pukul 02.00 WIB: database + file pembelajaran, disimpan di penyimpanan objek terpisah dari server aplikasi.</p>
        </div>
        <Button onClick={create} disabled={!!busy} className="bg-[#0F2942] hover:bg-[#0A1D30]" data-testid="backup-create-now">{busy === "new" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <HardDriveDownload className="h-4 w-4 mr-2" />}Backup Sekarang</Button>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader><TableRow><TableHead>Waktu</TableHead><TableHead>Jenis</TableHead><TableHead>Isi</TableHead><TableHead>Ukuran</TableHead><TableHead className="text-right">Unduh</TableHead></TableRow></TableHeader>
          <TableBody>
            {list.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-6 text-slate-500">Belum ada salinan backup</TableCell></TableRow>}
            {list.map((b) => (
              <TableRow key={b.id} data-testid={`backup-row-${b.id}`}>
                <TableCell className="text-sm whitespace-nowrap">{fmtDateTime(b.created_at)}</TableCell>
                <TableCell className="text-sm">{b.trigger === "otomatis" ? "Otomatis" : `Manual · ${b.by}`}</TableCell>
                <TableCell className="text-xs">{b.collections} koleksi · {b.files} file</TableCell>
                <TableCell className="text-xs">{mb(b.size)}</TableCell>
                <TableCell className="text-right"><Button size="sm" variant="ghost" onClick={() => dl(b)} disabled={!!busy} data-testid={`backup-download-saved-${b.id}`}>{busy === b.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}</Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}

function Recovery() {
  const ref = useRef(null);
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post("/admin/backups/restore", fd);
      toast.success(`Database dipulihkan: ${data.collections.length} koleksi, ${data.documents} dokumen`);
      setTimeout(() => window.location.reload(), 1200);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
      setFile(null);
    }
  };
  return (
    <section className="bg-white rounded-xl border border-rose-200 p-6 space-y-3" data-testid="backup-recovery">
      <h2 className="font-bold flex items-center gap-2 text-rose-800"><RotateCcw className="h-4 w-4" />Recovery Database (JSON)</h2>
      <p className="text-sm text-slate-600">Unggah file backup database (.zip dari menu ini, atau file .json berisi koleksi). Data koleksi yang ada akan <b>diganti</b> dengan isi file. Log aktivitas & keamanan tidak ditimpa.</p>
      <input ref={ref} type="file" accept=".json,.zip" className="hidden" onChange={(e) => { setFile(e.target.files?.[0] || null); e.target.value = ""; }} data-testid="backup-restore-input" />
      <Button variant="outline" className="border-rose-300 text-rose-700" onClick={() => ref.current?.click()} disabled={busy} data-testid="backup-restore-button">{busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}Pilih File & Pulihkan</Button>
      <AlertDialog open={!!file} onOpenChange={(o) => !o && setFile(null)}>
        <AlertDialogContent data-testid="restore-confirm-dialog">
          <AlertDialogHeader><AlertDialogTitle>Pulihkan database dari {file?.name}?</AlertDialogTitle><AlertDialogDescription>Tindakan ini mengganti data saat ini. Disarankan membuat Backup Sekarang terlebih dahulu.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel data-testid="restore-cancel">Batal</AlertDialogCancel><AlertDialogAction onClick={run} className="bg-rose-600 hover:bg-rose-700" data-testid="restore-confirm">Ya, Pulihkan</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

export default function AdminBackup() {
  const [busy, setBusy] = useState("");
  const [info, setInfo] = useState(null);
  useEffect(() => {
    api.get("/admin/backup/info").then((r) => setInfo(r.data));
  }, []);

  const run = async (key) => {
    setBusy(key);
    try {
      await downloadFromApi(`/admin/backup/${key}`, `backup-${key}.zip`);
      toast.success("Backup berhasil diunduh");
    } catch (e) {
      toast.error(errMsg(e, "Gagal membuat backup"));
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader title="Backup & Recovery" subtitle="Backup otomatis bulanan, unduh cadangan kapan saja, dan pulihkan database dari file JSON." />
      {info && <p className="text-sm text-slate-600" data-testid="backup-info">{info.collections} koleksi database · {info.files} file unggahan ({mb(info.files_size)})</p>}
      <AutoBackups />
      <div className="grid md:grid-cols-3 gap-5">
        {ITEMS.map((it) => (
          <div key={it.key} className="bg-white rounded-xl border border-slate-200 p-6 flex flex-col" data-testid={`backup-card-${it.key}`}>
            <div className="h-11 w-11 rounded-lg bg-[#0F2942] text-amber-400 grid place-items-center"><it.icon className="h-5 w-5" /></div>
            <h2 className="mt-4 font-bold text-slate-900">{it.title}</h2>
            <p className="mt-2 text-sm text-slate-600 flex-1">{it.text}</p>
            <Button onClick={() => run(it.key)} disabled={!!busy} className="mt-6 bg-[#0F2942] hover:bg-[#0A1D30]" data-testid={`backup-download-${it.key}`}>
              {busy === it.key ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}{busy === it.key ? "Menyiapkan..." : "Unduh ZIP"}
            </Button>
          </div>
        ))}
      </div>
      <Recovery />
      <p className="text-xs text-slate-500">Laporan log aktivitas admin dapat dicetak di menu Log Aktivitas Admin. Petunjuk pemulihan manual ada di RESTORE.md di setiap ZIP.</p>
    </div>
  );
}
