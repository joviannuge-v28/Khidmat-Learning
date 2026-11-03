import { useEffect, useState } from "react";
import { BadgeCheck, Download, FileSpreadsheet, FileText, Loader2, MailCheck, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader, UserAvatar } from "@/components/common";
import { FileUpload } from "@/components/FileUpload";
import { ConfirmDelete } from "@/pages/admin/ConfirmDelete";
import { ImportUsersDialog } from "@/pages/admin/ImportUsersDialog";
import { OpdFilter } from "@/components/OpdFilter";
import { api, downloadFromApi, errMsg } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const BLANK = { name: "", gelar_depan: "", gelar_belakang: "", nip: "", email: "", whatsapp: "", role: "pegawai", jabatan: "", unit_kerja: "", photo: "", active: true, password: "" };
const ROLE_LABEL = { superadmin: "Super Admin", admin: "Admin", pic: "PIC OPD", pegawai: "Pegawai" };
const ROLE_CLS = { superadmin: "bg-rose-100 text-rose-800", admin: "bg-amber-100 text-amber-800", pic: "bg-emerald-100 text-emerald-800", pegawai: "bg-sky-100 text-sky-800" };

function UserDialog({ open, onOpenChange, initial, onSaved }) {
  const { user: me } = useAuth();
  const [f, setF] = useState(BLANK);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setF({ ...BLANK, ...(initial || {}), password: "" });
  }, [open, initial]);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const save = async () => {
    setBusy(true);
    try {
      const body = Object.fromEntries(Object.keys(BLANK).map((k) => [k, f[k]]));
      if (!body.password) body.password = null;
      if (initial?.id) await api.put(`/admin/users/${initial.id}`, body);
      else await api.post("/admin/users", body);
      toast.success("Pengguna disimpan");
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto" data-testid="user-form-dialog">
        <DialogHeader><DialogTitle>{initial?.id ? "Ubah Pengguna" : "Tambah Pengguna"}</DialogTitle></DialogHeader>
        <div className="grid gap-4">
          <div className="flex items-center gap-4"><UserAvatar user={f} size="h-14 w-14" /><FileUpload accept="image/*" label="Foto" testid="user-photo-upload" onUploaded={(p) => setF((x) => ({ ...x, photo: p }))} /></div>
          <div className="grid gap-2"><Label>Nama Lengkap *</Label><Input value={f.name} onChange={set("name")} data-testid="user-name-input" /></div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="grid gap-2"><Label>Gelar Depan (opsional)</Label><Input value={f.gelar_depan} onChange={set("gelar_depan")} data-testid="user-gelar-depan-input" /></div>
            <div className="grid gap-2"><Label>Gelar Belakang (opsional)</Label><Input value={f.gelar_belakang} onChange={set("gelar_belakang")} data-testid="user-gelar-belakang-input" /></div>
            <div className="grid gap-2"><Label>No. WhatsApp</Label><Input value={f.whatsapp} onChange={set("whatsapp")} data-testid="user-whatsapp-input" /></div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="grid gap-2"><Label>NIP</Label><Input value={f.nip} onChange={set("nip")} data-testid="user-nip-input" /></div>
            <div className="grid gap-2"><Label>Email</Label><Input value={f.email} onChange={set("email")} data-testid="user-email-input" /></div>
            <div className="grid gap-2"><Label>Jabatan</Label><Input value={f.jabatan} onChange={set("jabatan")} data-testid="user-jabatan-input" /></div>
            <div className="grid gap-2"><Label>{f.role === "pic" ? "OPD / Unit Kerja *" : "Unit Kerja"}</Label><Input value={f.unit_kerja} onChange={set("unit_kerja")} placeholder={f.role === "pic" ? "Mis. Dinas Kominfo" : ""} data-testid="user-unit-input" /></div>
            <div className="grid gap-2">
              <Label>Peran</Label>
              <Select value={f.role} onValueChange={(v) => setF({ ...f, role: v })}>
                <SelectTrigger data-testid="user-role-select"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="pegawai">Pegawai</SelectItem><SelectItem value="pic">PIC OPD (usulan, tidak ikut kursus)</SelectItem><SelectItem value="admin">Admin</SelectItem>{me?.role === "superadmin" && <SelectItem value="superadmin">Super Admin</SelectItem>}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-2"><Label>{initial?.id ? "Reset Kata Sandi Default (opsional)" : "Kata Sandi Default *"}</Label><Input type="password" value={f.password} onChange={set("password")} data-testid="user-password-input" /></div>
          </div>
          <p className="text-xs text-slate-500 -mt-2">Kata sandi default boleh sederhana (min. 6 karakter) untuk pembuatan akun massal. Pengguna wajib menggantinya dengan kata sandi kuat (min. 10 karakter, huruf+angka+simbol) dan mengunggah foto saat pertama login.</p>
          {f.role === "pic" && <p className="text-xs text-slate-500 -mt-2">Satu OPD hanya boleh memiliki satu akun PIC.</p>}
          <div className="flex items-center gap-3"><Switch checked={f.active} onCheckedChange={(v) => setF({ ...f, active: v })} data-testid="user-active-switch" /><Label>Akun aktif</Label></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={save} disabled={busy} className="bg-[#0F2942] hover:bg-[#0A1D30]" data-testid="user-save-button">{busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Simpan</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminUsers() {
  const { user: me } = useAuth();
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [unit, setUnit] = useState("");
  const [pdfYear, setPdfYear] = useState(String(new Date().getFullYear()));
  const [edit, setEdit] = useState(null);
  const [open, setOpen] = useState(false);
  const [del, setDel] = useState(null);
  const [imp, setImp] = useState(false);

  const load = () => api.get("/admin/users", { params: { search, unit } }).then((r) => setItems(r.data));
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, unit]);
  const printOpd = () => {
    const qs = new URLSearchParams({ unit, search, year: pdfYear }).toString();
    downloadFromApi(`/admin/users/opd-report?${qs}`, "rekap-asn-opd.pdf").catch((e) => toast.error(errMsg(e)));
  };
  const exportUsers = () => {
    const qs = new URLSearchParams({ search, unit }).toString();
    downloadFromApi(`/admin/users/export?${qs}`, "daftar-pegawai.xlsx").catch((e) => toast.error(errMsg(e)));
  };

  const approve = async (u) => {
    try {
      await api.patch(`/admin/users/${u.id}/email`, { approve: true });
      toast.success(`Email ${u.email} disetujui tanpa verifikasi`);
      load();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };
  const verifiedPct = items.length ? Math.round((items.filter((u) => u.email_verified).length * 100) / items.length) : 0;

  const remove = async () => {
    try {
      await api.delete(`/admin/users/${del.id}`);
      toast.success("Pengguna dihapus");
      setDel(null);
      load();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <div>
      <PageHeader title="Kelola Pengguna" subtitle="Data pegawai, PIC OPD (1 akun per OPD), dan administrator."
        action={<div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportUsers} data-testid="admin-export-users-button"><Download className="h-4 w-4 mr-2 text-blue-700" />{unit ? "Ekspor Laporan OPD" : "Ekspor Excel"}</Button>
          <Button variant="outline" onClick={() => setImp(true)} data-testid="admin-import-users-button"><FileSpreadsheet className="h-4 w-4 mr-2 text-emerald-600" />Impor Excel</Button>
          <Button onClick={() => { setEdit(null); setOpen(true); }} className="bg-[#0F2942] hover:bg-[#0A1D30]" data-testid="admin-add-user-button"><Plus className="h-4 w-4 mr-2" />Tambah Pengguna</Button>
        </div>} />
      <div className="flex flex-col md:flex-row gap-3 mb-6">
        <div className="relative md:w-80">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari NIP, nama, email, atau jabatan" className="pl-9 h-11 bg-white" data-testid="admin-user-search-input" />
        </div>
        <OpdFilter value={unit} onChange={setUnit} />
        <div className="flex items-center gap-2 md:ml-auto" data-testid="admin-opd-pdf-group">
          <select value={pdfYear} onChange={(e) => setPdfYear(e.target.value)} className="h-11 rounded-md border border-slate-200 bg-white px-2 text-sm" data-testid="admin-opd-pdf-year">
            <option value="0">Semua tahun</option>
            {[0, 1, 2, 3].map((k) => String(new Date().getFullYear() - k)).map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <Button variant="outline" className="h-11 bg-white" onClick={printOpd} data-testid="admin-opd-pdf-button"><FileText className="h-4 w-4 mr-2 text-rose-600" />Cetak PDF {unit ? "OPD" : "Rekap ASN"}</Button>
        </div>
      </div>
      <p className="-mt-3 mb-4 text-xs text-slate-500" data-testid="admin-users-verified-pct">{items.length} akun ditampilkan{unit ? ` · OPD mengandung "${unit}"` : ""} · {verifiedPct}% email terverifikasi</p>
      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <Table data-testid="admin-users-table">
          <TableHeader><TableRow><TableHead>Pegawai</TableHead><TableHead>NIP</TableHead><TableHead>Unit Kerja</TableHead><TableHead>Peran</TableHead><TableHead>Pelatihan</TableHead><TableHead className="text-right">Aksi</TableHead></TableRow></TableHeader>
          <TableBody>
            {items.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-slate-500 py-10" data-testid="admin-users-empty">Pengguna tidak ditemukan</TableCell></TableRow>}
            {items.map((u) => (
              <TableRow key={u.id} data-testid={`admin-user-row-${u.id}`}>
                <TableCell><div className="flex items-center gap-3 min-w-[200px]"><UserAvatar user={u} size="h-9 w-9" /><div><div className="font-medium">{[u.gelar_depan, u.name].filter(Boolean).join(" ")}{u.gelar_belakang ? `, ${u.gelar_belakang}` : ""}</div><div className="text-xs text-slate-500 flex items-center gap-1">{u.email}{u.email && (u.email_verified ? <BadgeCheck className="h-3.5 w-3.5 text-emerald-600" title="Terverifikasi" /> : <span className="text-amber-600">(belum verifikasi)</span>)}</div>{u.whatsapp && <div className="text-xs text-slate-500">WA {u.whatsapp}</div>}</div></div></TableCell>
                <TableCell className="font-mono text-xs">{u.nip || "-"}</TableCell>
                <TableCell>{u.unit_kerja || "-"}</TableCell>
                <TableCell>
                  <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${ROLE_CLS[u.role] || ROLE_CLS.pegawai}`}>{ROLE_LABEL[u.role] || u.role}</span>
                  {!u.active && <span className="ml-2 text-xs text-rose-600">Nonaktif</span>}
                </TableCell>
                <TableCell className="text-xs">{u.ongoing_count} berjalan · {u.completed_count} selesai</TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  {u.email && !u.email_verified && <Button size="icon" variant="ghost" title="Setujui email tanpa verifikasi" onClick={() => approve(u)} data-testid={`admin-approve-email-${u.id}`}><MailCheck className="h-4 w-4 text-emerald-600" /></Button>}
                  {me?.role === "superadmin" && <Button size="icon" variant="ghost" title="Cetak laporan profil ASN" onClick={() => downloadFromApi(`/admin/users/${u.id}/report`, "laporan-asn.pdf").catch((e) => toast.error(errMsg(e)))} data-testid={`admin-user-report-${u.id}`}><FileText className="h-4 w-4 text-blue-700" /></Button>}
                  <Button size="icon" variant="ghost" onClick={() => { setEdit(u); setOpen(true); }} data-testid={`admin-edit-user-${u.id}`}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => setDel(u)} data-testid={`admin-delete-user-${u.id}`}><Trash2 className="h-4 w-4 text-rose-600" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <UserDialog open={open} onOpenChange={setOpen} initial={edit} onSaved={load} />
      <ImportUsersDialog open={imp} onOpenChange={setImp} onDone={load} />
      <ConfirmDelete open={!!del} onOpenChange={() => setDel(null)} title={`Hapus ${del?.name}?`} onConfirm={remove} />
    </div>
  );
}
