import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Eye, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/common";
import { ReadingFormDialog } from "@/components/ReadingFormDialog";
import { StatusBadge } from "@/pages/user/Readings";
import { ConfirmDelete } from "@/pages/admin/ConfirmDelete";
import { api, errMsg, fmtDate } from "@/lib/api";

export default function AdminReadings() {
  const [status, setStatus] = useState("pending");
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ open: false, initial: null });
  const [reject, setReject] = useState(null);
  const [note, setNote] = useState("");
  const [del, setDel] = useState(null);

  const load = () => api.get("/admin/readings", { params: status === "all" ? {} : { status } }).then((r) => setItems(r.data));
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const review = async (r, st, review_note = "") => {
    try {
      await api.patch(`/admin/readings/${r.id}/review`, { status: st, review_note });
      toast.success(st === "approved" ? "Bacaan disetujui" : "Bacaan ditolak");
      setReject(null);
      load();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const remove = async () => {
    await api.delete(`/admin/readings/${del.id}`);
    toast.success("Bacaan dihapus");
    setDel(null);
    load();
  };

  return (
    <div>
      <PageHeader title="Kelola KMS & Persetujuan" subtitle="Setujui usulan pegawai dan kelola perpustakaan bacaan."
        action={<Button onClick={() => setForm({ open: true, initial: null })} className="bg-[#0F2942] hover:bg-[#0A1D30]" data-testid="admin-add-reading-button"><Plus className="h-4 w-4 mr-2" />Tambah Bacaan</Button>} />
      <Tabs value={status} onValueChange={setStatus} className="mb-6">
        <TabsList>
          <TabsTrigger value="pending" data-testid="admin-kms-tab-pending">Menunggu</TabsTrigger>
          <TabsTrigger value="approved" data-testid="admin-kms-tab-approved">Disetujui</TabsTrigger>
          <TabsTrigger value="rejected" data-testid="admin-kms-tab-rejected">Ditolak</TabsTrigger>
          <TabsTrigger value="all" data-testid="admin-kms-tab-all">Semua</TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <Table data-testid="admin-readings-table">
          <TableHeader><TableRow><TableHead>Judul</TableHead><TableHead>Kategori</TableHead><TableHead>Pengusul</TableHead><TableHead>Tanggal</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Aksi</TableHead></TableRow></TableHeader>
          <TableBody>
            {items.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-slate-500 py-10">Tidak ada data</TableCell></TableRow>}
            {items.map((r) => (
              <TableRow key={r.id} data-testid={`admin-reading-row-${r.id}`}>
                <TableCell className="font-medium min-w-[220px]">{r.title}</TableCell>
                <TableCell>{r.category_name || "-"}</TableCell>
                <TableCell>{r.proposer_name}</TableCell>
                <TableCell className="whitespace-nowrap">{fmtDate(r.created_at)}</TableCell>
                <TableCell><StatusBadge status={r.status} /></TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  <Button asChild size="icon" variant="ghost"><Link to={`/kms/${r.id}`} data-testid={`admin-view-reading-${r.id}`}><Eye className="h-4 w-4" /></Link></Button>
                  {r.status !== "approved" && <Button size="icon" variant="ghost" onClick={() => review(r, "approved")} data-testid={`admin-approve-reading-${r.id}`}><Check className="h-4 w-4 text-emerald-600" /></Button>}
                  {r.status !== "rejected" && <Button size="icon" variant="ghost" onClick={() => { setNote(""); setReject(r); }} data-testid={`admin-reject-reading-${r.id}`}><X className="h-4 w-4 text-amber-600" /></Button>}
                  <Button size="icon" variant="ghost" onClick={() => setForm({ open: true, initial: r })} data-testid={`admin-edit-reading-${r.id}`}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => setDel(r)} data-testid={`admin-delete-reading-${r.id}`}><Trash2 className="h-4 w-4 text-rose-600" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ReadingFormDialog open={form.open} onOpenChange={(o) => setForm({ ...form, open: o })} initial={form.initial} mode="admin" onSaved={load} />
      <Dialog open={!!reject} onOpenChange={() => setReject(null)}>
        <DialogContent data-testid="reject-dialog">
          <DialogHeader><DialogTitle>Tolak usulan bacaan</DialogTitle></DialogHeader>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Catatan untuk pengusul (opsional)" data-testid="reject-note-input" />
          <DialogFooter><Button variant="outline" onClick={() => setReject(null)}>Batal</Button><Button className="bg-amber-600 hover:bg-amber-700" onClick={() => review(reject, "rejected", note)} data-testid="reject-confirm-button">Tolak</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <ConfirmDelete open={!!del} onOpenChange={() => setDel(null)} title={`Hapus "${del?.title}"?`} onConfirm={remove} />
    </div>
  );
}
