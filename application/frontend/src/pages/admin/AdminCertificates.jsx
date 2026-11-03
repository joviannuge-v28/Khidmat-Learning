import { useEffect, useState } from "react";
import { Download, Pencil, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/common";
import { api, certUrl, downloadCert, errMsg, fmtDate } from "@/lib/api";

export default function AdminCertificates() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState(null);
  const [no, setNo] = useState("");
  const load = () => api.get("/admin/certificates").then((r) => setItems(r.data));
  useEffect(() => {
    load();
  }, []);
  const s = q.toLowerCase();
  const filtered = items.filter((c) => [c.user_name, c.nip, c.course_title, c.certificate_no].join(" ").toLowerCase().includes(s));

  const saveNo = async () => {
    try {
      await api.patch(`/admin/certificates/${edit.id}`, { certificate_no: no });
      toast.success("Nomor sertifikat diperbarui");
      setEdit(null);
      load();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <div>
      <PageHeader title="Sertifikat Terbit" subtitle="Desain seragam diatur di menu Desain Sertifikat; penomoran per pelatihan / webinar zoom. Nomor yang sudah terbit dapat diubah di sini." />
      <div className="relative md:w-80 mb-6">
        <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama, NIP, nomor" className="pl-9 h-11 bg-white" data-testid="admin-cert-search-input" />
      </div>
      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <Table data-testid="admin-certificates-table">
          <TableHeader><TableRow><TableHead>Nomor</TableHead><TableHead>Pegawai</TableHead><TableHead>Pelatihan</TableHead><TableHead>Nilai</TableHead><TableHead>Tanggal</TableHead><TableHead className="text-right">Aksi</TableHead></TableRow></TableHeader>
          <TableBody>
            {filtered.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-slate-500 py-10">Belum ada sertifikat</TableCell></TableRow>}
            {filtered.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-mono text-xs whitespace-nowrap">{c.certificate_no}</TableCell>
                <TableCell><div className="font-medium">{c.user_name}</div><div className="text-xs text-slate-500">{c.nip}</div></TableCell>
                <TableCell>{c.course_title}</TableCell>
                <TableCell>{c.score}</TableCell>
                <TableCell className="whitespace-nowrap">{fmtDate(c.completed_at)}</TableCell>
                <TableCell className="text-right whitespace-nowrap">
                  <Button size="icon" variant="ghost" onClick={() => { setEdit(c); setNo(c.certificate_no); }} data-testid={`admin-cert-edit-${c.id}`}><Pencil className="h-4 w-4" /></Button>
                  <Button asChild size="icon" variant="ghost" data-testid={`admin-cert-download-${c.id}`}><a href={certUrl(c.id)} onClick={downloadCert}><Download className="h-4 w-4" /></a></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Dialog open={!!edit} onOpenChange={() => setEdit(null)}>
        <DialogContent data-testid="cert-number-dialog">
          <DialogHeader><DialogTitle>Ubah Nomor Sertifikat</DialogTitle></DialogHeader>
          <p className="text-sm text-slate-500">{edit?.user_name} · {edit?.course_title}</p>
          <Input value={no} onChange={(e) => setNo(e.target.value)} className="font-mono" data-testid="cert-number-input" />
          <DialogFooter><Button variant="outline" onClick={() => setEdit(null)}>Batal</Button><Button onClick={saveNo} className="bg-[#0F2942] hover:bg-[#0A1D30]" data-testid="cert-number-save-button">Simpan</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
