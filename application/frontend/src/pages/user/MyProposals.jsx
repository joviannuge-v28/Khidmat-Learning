import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ClipboardCheck, GraduationCap, Lightbulb, Pencil, Users, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader, EmptyState } from "@/components/common";
import { ZoomFormDialog } from "@/components/ZoomFormDialog";
import { EvaluationManageDialog } from "@/components/Evaluation";
import { StatusBadge } from "@/pages/user/Readings";
import { api, fmtDate } from "@/lib/api";
import { ParticipantsDialog } from "@/pages/admin/ParticipantsDialog";

export default function MyProposals() {
  const [items, setItems] = useState(null);
  const [zoom, setZoom] = useState({ open: false, initial: null });
  const [ev, setEv] = useState(null);
  const [part, setPart] = useState(null);
  const load = () => api.get("/proposals/mine").then((r) => setItems(r.data));
  useEffect(() => {
    load();
  }, []);

  const editZoom = async (p) => {
    const { data } = await api.get(`/proposals/${p.id}`);
    setZoom({ open: true, initial: data });
  };

  return (
    <div>
      <PageHeader title="Usulan OPD" subtitle="Akun PIC OPD dapat mengusulkan materi pelatihan dan webinar zoom. Usulan tampil setelah disetujui admin BKPSDM."
        action={
          <div className="flex flex-wrap gap-2">
            <Button asChild className="bg-[#0F2942] hover:bg-[#0A1D30]" data-testid="propose-course-button"><Link to="/usulan/pelatihan/baru"><GraduationCap className="h-4 w-4 mr-2" />Usulkan Pelatihan</Link></Button>
            <Button variant="outline" onClick={() => setZoom({ open: true, initial: null })} data-testid="propose-zoom-button"><Video className="h-4 w-4 mr-2" />Usulkan Webinar Zoom</Button>
          </div>
        } />
      {items === null ? <div className="text-slate-500">Memuat...</div> : items.length === 0 ? (
        <EmptyState icon={Lightbulb} title="Belum ada usulan" text="Bagikan ide pelatihan Anda untuk rekan pegawai lain." testid="proposals-empty" />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
          <Table data-testid="proposals-table">
            <TableHeader><TableRow><TableHead>Judul</TableHead><TableHead>Jenis</TableHead><TableHead>Pengajar</TableHead><TableHead>Tanggal</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Aksi</TableHead></TableRow></TableHeader>
            <TableBody>
              {items.map((p) => (
                <TableRow key={p.id} data-testid={`proposal-row-${p.id}`}>
                  <TableCell className="min-w-[200px]"><div className="font-medium">{p.title}</div>{p.review_note && <div className="text-xs text-rose-700">Catatan admin: {p.review_note}</div>}</TableCell>
                  <TableCell>{p.kind === "zoom" ? "Webinar Zoom" : "Pelatihan"}</TableCell>
                  <TableCell>{p.instructor}</TableCell>
                  <TableCell className="whitespace-nowrap">{fmtDate(p.created_at)}</TableCell>
                  <TableCell><StatusBadge status={p.status} /></TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    {p.status === "approved" && <Button size="icon" variant="ghost" onClick={() => setPart(p)} title={p.kind === "zoom" ? "Peserta & kehadiran" : "Peserta kursus"} data-testid={`proposal-participants-${p.id}`}><Users className="h-4 w-4 text-emerald-700" /></Button>}
                    {p.kind === "zoom" && <Button size="icon" variant="ghost" onClick={() => setEv(p)} title="Evaluasi webinar" data-testid={`proposal-eval-${p.id}`}><ClipboardCheck className="h-4 w-4 text-blue-700" /></Button>}
                    {p.status !== "approved" && (p.kind === "zoom" ? (
                      <Button size="icon" variant="ghost" onClick={() => editZoom(p)} data-testid={`proposal-edit-${p.id}`}><Pencil className="h-4 w-4" /></Button>
                    ) : (
                      <Button asChild size="icon" variant="ghost" data-testid={`proposal-edit-${p.id}`}><Link to={`/usulan/pelatihan/${p.id}`}><Pencil className="h-4 w-4" /></Link></Button>
                    ))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <ZoomFormDialog open={zoom.open} onOpenChange={(o) => setZoom({ ...zoom, open: o })} initial={zoom.initial} mode="propose" onSaved={load} />
      <EvaluationManageDialog course={ev} onOpenChange={() => setEv(null)} />
      <ParticipantsDialog course={part} onOpenChange={() => setPart(null)} onChanged={load} />
    </div>
  );
}
