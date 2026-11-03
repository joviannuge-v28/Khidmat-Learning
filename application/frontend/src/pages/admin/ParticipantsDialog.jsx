import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, certUrl, downloadCert, errMsg } from "@/lib/api";

export const ParticipantsDialog = ({ course, onOpenChange, onChanged }) => {
  const [items, setItems] = useState([]);
  const zoom = course?.kind !== "course";
  const load = () => api.get(`/admin/courses/${course.id}/participants`).then((r) => setItems(r.data));
  useEffect(() => {
    if (course) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course]);

  const toggle = async (p, present) => {
    try {
      await api.post(`/admin/courses/${course.id}/attendance`, { user_id: p.user_id, present });
      toast.success(present ? "Ditandai hadir, sertifikat terbit" : "Kehadiran dibatalkan");
      load();
      onChanged?.();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <Dialog open={!!course} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto" data-testid="participants-dialog">
        <DialogHeader>
          <DialogTitle>{zoom ? "Peserta & Kehadiran" : "Peserta Kursus"}</DialogTitle>
          <DialogDescription>{course?.title} — {zoom ? "tandai peserta yang hadir untuk menerbitkan sertifikat." : `${items.length} peserta terdaftar.`}</DialogDescription>
        </DialogHeader>
        <Table>
          <TableHeader><TableRow><TableHead>Pegawai</TableHead><TableHead>Unit Kerja</TableHead><TableHead>{zoom ? "Hadir" : "Status"}</TableHead><TableHead>Sertifikat</TableHead></TableRow></TableHeader>
          <TableBody>
            {items.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-slate-500 py-8">Belum ada peserta terdaftar</TableCell></TableRow>}
            {items.map((p) => (
              <TableRow key={p.id} data-testid={`participant-row-${p.user_id}`}>
                <TableCell><div className="font-medium">{p.user_name}</div><div className="text-xs text-slate-500">{p.nip}</div></TableCell>
                <TableCell className="text-sm">{p.unit_kerja || "-"}</TableCell>
                <TableCell>{zoom ? <Switch checked={p.status === "completed"} onCheckedChange={(v) => toggle(p, v)} data-testid={`attendance-switch-${p.user_id}`} /> : <span className="text-xs" data-testid={`participant-status-${p.user_id}`}>{p.status === "completed" ? "Selesai" : "Berjalan"}</span>}</TableCell>
                <TableCell>
                  {p.status === "completed" ? (
                    <Button asChild size="sm" variant="ghost" data-testid={`participant-cert-${p.user_id}`}><a href={certUrl(p.id)} onClick={downloadCert}><Download className="h-4 w-4 mr-1" /><span className="font-mono text-xs">{p.certificate_no}</span></a></Button>
                  ) : <span className="text-xs text-slate-400">-</span>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DialogContent>
    </Dialog>
  );
};
