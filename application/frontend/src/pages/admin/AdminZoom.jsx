import { useEffect, useState } from "react";
import { Check, ClipboardCheck, ExternalLink, Pencil, Plus, Trash2, Users, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/common";
import { ZoomFormDialog } from "@/components/ZoomFormDialog";
import { RejectDialog, reviewCourse } from "@/components/RejectDialog";
import { StatusBadge } from "@/pages/user/Readings";
import { ConfirmDelete } from "@/pages/admin/ConfirmDelete";
import { ParticipantsDialog } from "@/pages/admin/ParticipantsDialog";
import { EvaluationManageDialog } from "@/components/Evaluation";
import { api, errMsg, fmtDateTime } from "@/lib/api";

export default function AdminZoom() {
  const [items, setItems] = useState([]);
  const [tab, setTab] = useState("all");
  const [form, setForm] = useState({ open: false, initial: null });
  const [reject, setReject] = useState(null);
  const [del, setDel] = useState(null);
  const [people, setPeople] = useState(null);
  const [ev, setEv] = useState(null);

  const load = () => api.get("/admin/courses", { params: { kind: "zoom", ...(tab === "all" ? {} : { status: tab }) } }).then((r) => setItems(r.data));
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const review = async (c, status, note = "") => {
    try {
      await reviewCourse(api, c.id, status, note);
      toast.success(status === "approved" ? "Webinar disetujui & diterbitkan" : "Usulan ditolak");
      setReject(null);
      load();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const remove = async () => {
    await api.delete(`/admin/courses/${del.id}`);
    toast.success("Webinar dihapus");
    setDel(null);
    load();
  };

  return (
    <div>
      <PageHeader title="Kelola Webinar Zoom" subtitle="Jadwalkan webinar, setujui usulan PIC OPD, kelola evaluasi, dan konfirmasi kehadiran untuk sertifikat."
        action={<Button onClick={() => setForm({ open: true, initial: null })} className="bg-[#0F2942] hover:bg-[#0A1D30]" data-testid="admin-add-zoom-button"><Plus className="h-4 w-4 mr-2" />Tambah Webinar</Button>} />
      <Tabs value={tab} onValueChange={setTab} className="mb-6">
        <TabsList>
          <TabsTrigger value="all" data-testid="admin-zoom-tab-all">Semua</TabsTrigger>
          <TabsTrigger value="pending" data-testid="admin-zoom-tab-pending">Usulan Menunggu</TabsTrigger>
          <TabsTrigger value="rejected" data-testid="admin-zoom-tab-rejected">Ditolak</TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <Table data-testid="admin-zoom-table">
          <TableHeader><TableRow><TableHead>Webinar</TableHead><TableHead>Jadwal</TableHead><TableHead>Peserta</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Aksi</TableHead></TableRow></TableHeader>
          <TableBody>
            {items.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-slate-500 py-10">Belum ada webinar</TableCell></TableRow>}
            {items.map((c) => (
              <TableRow key={c.id} data-testid={`admin-zoom-row-${c.id}`}>
                <TableCell className="min-w-[240px]">
                  <div className="font-medium">{c.title}</div>
                  <div className="text-xs text-slate-500">{c.instructor}{c.proposer_name && ` · Usulan: ${c.proposer_name}`}</div>
                  {c.zoom_url ? <a href={c.zoom_url} target="_blank" rel="noreferrer" className="text-xs text-blue-700 inline-flex items-center gap-1 mt-1"><ExternalLink className="h-3 w-3" />Tautan zoom</a> : <span className="text-xs text-rose-600">Tautan zoom belum diisi</span>}
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm">{fmtDateTime(c.start_at)}</TableCell>
                <TableCell>{c.participants} <span className="text-xs text-slate-400">({c.completed} hadir)</span></TableCell>
                <TableCell><StatusBadge status={c.status} /></TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  <Button size="icon" variant="ghost" onClick={() => setPeople(c)} title="Peserta & kehadiran" data-testid={`admin-zoom-participants-${c.id}`}><Users className="h-4 w-4 text-blue-700" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => setEv(c)} title="Evaluasi webinar" data-testid={`admin-zoom-eval-${c.id}`}><ClipboardCheck className="h-4 w-4 text-amber-600" /></Button>
                  {c.status !== "approved" && <Button size="icon" variant="ghost" onClick={() => review(c, "approved")} title="Setujui" data-testid={`admin-approve-zoom-${c.id}`}><Check className="h-4 w-4 text-emerald-600" /></Button>}
                  {c.status === "pending" && <Button size="icon" variant="ghost" onClick={() => setReject(c)} title="Tolak" data-testid={`admin-reject-zoom-${c.id}`}><X className="h-4 w-4 text-amber-600" /></Button>}
                  <Button size="icon" variant="ghost" onClick={() => setForm({ open: true, initial: c })} data-testid={`admin-edit-zoom-${c.id}`}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => setDel(c)} data-testid={`admin-delete-zoom-${c.id}`}><Trash2 className="h-4 w-4 text-rose-600" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <ZoomFormDialog open={form.open} onOpenChange={(o) => setForm({ ...form, open: o })} initial={form.initial} onSaved={load} />
      <RejectDialog item={reject} onOpenChange={() => setReject(null)} onConfirm={(note) => review(reject, "rejected", note)} />
      <ParticipantsDialog course={people} onOpenChange={() => { setPeople(null); load(); }} onChanged={load} />
      <ConfirmDelete open={!!del} onOpenChange={() => setDel(null)} title={`Hapus "${del?.title}"?`} onConfirm={remove} />
      <EvaluationManageDialog course={ev} onOpenChange={() => setEv(null)} />
    </div>
  );
}
