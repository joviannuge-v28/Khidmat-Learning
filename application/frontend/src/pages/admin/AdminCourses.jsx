import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/common";
import { RejectDialog, reviewCourse } from "@/components/RejectDialog";
import { StatusBadge } from "@/pages/user/Readings";
import { ConfirmDelete } from "@/pages/admin/ConfirmDelete";
import { api, errMsg, fileUrl } from "@/lib/api";

export default function AdminCourses() {
  const [items, setItems] = useState([]);
  const [tab, setTab] = useState("all");
  const [del, setDel] = useState(null);
  const [reject, setReject] = useState(null);
  const load = () => api.get("/admin/courses", { params: { kind: "course", ...(tab === "all" ? {} : { status: tab }) } }).then((r) => setItems(r.data));
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const remove = async () => {
    try {
      await api.delete(`/admin/courses/${del.id}`);
      toast.success("Pelatihan dihapus");
      setDel(null);
      load();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const review = async (c, status, note = "") => {
    try {
      await reviewCourse(api, c.id, status, note);
      toast.success(status === "approved" ? "Usulan disetujui & diterbitkan" : "Usulan ditolak");
      setReject(null);
      load();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <div>
      <PageHeader title="Kelola Pelatihan" subtitle="Tambah, ubah, atur materi, kuis, sertifikat, dan setujui usulan pegawai."
        action={<Button asChild className="bg-[#0F2942] hover:bg-[#0A1D30]" data-testid="admin-add-course-button"><Link to="/admin/pelatihan/baru"><Plus className="h-4 w-4 mr-2" />Tambah Pelatihan</Link></Button>} />
      <Tabs value={tab} onValueChange={setTab} className="mb-6">
        <TabsList>
          <TabsTrigger value="all" data-testid="admin-courses-tab-all">Semua</TabsTrigger>
          <TabsTrigger value="pending" data-testid="admin-courses-tab-pending">Usulan Menunggu</TabsTrigger>
          <TabsTrigger value="rejected" data-testid="admin-courses-tab-rejected">Ditolak</TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <Table data-testid="admin-courses-table">
          <TableHeader><TableRow><TableHead>Pelatihan</TableHead><TableHead>Pengajar</TableHead><TableHead>Materi / Soal</TableHead><TableHead>Peserta</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Aksi</TableHead></TableRow></TableHeader>
          <TableBody>
            {items.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-slate-500 py-10">Belum ada data</TableCell></TableRow>}
            {items.map((c) => (
              <TableRow key={c.id} data-testid={`admin-course-row-${c.id}`}>
                <TableCell>
                  <div className="flex items-center gap-3 min-w-[240px]">
                    {c.thumbnail ? <img src={fileUrl(c.thumbnail)} alt="" className="h-10 w-16 object-cover rounded" /> : <div className="h-10 w-16 rounded bg-slate-200" />}
                    <div><div className="font-medium">{c.title}</div>{c.proposer_name && <div className="text-xs text-slate-500">Usulan: {c.proposer_name}</div>}</div>
                  </div>
                </TableCell>
                <TableCell>{c.instructor || "-"}</TableCell>
                <TableCell>{c.module_count} / {c.question_count}</TableCell>
                <TableCell>{c.participants} <span className="text-xs text-slate-400">({c.completed} lulus)</span></TableCell>
                <TableCell>
                  {c.status !== "approved" ? <StatusBadge status={c.status} /> : c.published ? <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">Terbit</span> : <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600">Draf</span>}
                </TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  {c.status !== "approved" && <Button size="icon" variant="ghost" onClick={() => review(c, "approved")} title="Setujui" data-testid={`admin-approve-course-${c.id}`}><Check className="h-4 w-4 text-emerald-600" /></Button>}
                  {c.status === "pending" && <Button size="icon" variant="ghost" onClick={() => setReject(c)} title="Tolak" data-testid={`admin-reject-course-${c.id}`}><X className="h-4 w-4 text-amber-600" /></Button>}
                  <Button asChild size="icon" variant="ghost" data-testid={`admin-edit-course-${c.id}`}><Link to={`/admin/pelatihan/${c.id}`}><Pencil className="h-4 w-4" /></Link></Button>
                  <Button size="icon" variant="ghost" onClick={() => setDel(c)} data-testid={`admin-delete-course-${c.id}`}><Trash2 className="h-4 w-4 text-rose-600" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <RejectDialog item={reject} onOpenChange={() => setReject(null)} onConfirm={(note) => review(reject, "rejected", note)} />
      <ConfirmDelete open={!!del} onOpenChange={() => setDel(null)} title={`Hapus "${del?.title}"?`} onConfirm={remove} />
    </div>
  );
}
