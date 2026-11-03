import { useEffect, useState } from "react";
import { FileSpreadsheet, Printer, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/common";
import { api, downloadFromApi, errMsg, fmtDateTime } from "@/lib/api";

export default function AdminActivityLog() {
  const [items, setItems] = useState([]);
  const [q, setQ] = useState({ start: "", end: "", search: "" });
  useEffect(() => {
    const t = setTimeout(() => api.get("/admin/activity-logs", { params: q }).then((r) => setItems(r.data)), 250);
    return () => clearTimeout(t);
  }, [q]);
  const exp = (format) => downloadFromApi(`/admin/activity-logs/export?start=${q.start}&end=${q.end}&format=${format}`, `log-aktivitas.${format}`).catch((e) => toast.error(errMsg(e)));
  return (
    <div>
      <PageHeader title="Log Aktivitas Admin" subtitle="Setiap perubahan data oleh Admin, Super Admin, dan PIC tercatat otomatis."
        action={<div className="flex gap-2">
          <Button variant="outline" onClick={() => exp("xlsx")} data-testid="activity-export-xlsx"><FileSpreadsheet className="h-4 w-4 mr-2 text-emerald-600" />Excel</Button>
          <Button onClick={() => exp("pdf")} className="bg-[#0F2942] hover:bg-[#0A1D30]" data-testid="activity-export-pdf"><Printer className="h-4 w-4 mr-2" />Cetak Laporan PDF</Button>
        </div>} />
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative w-full sm:w-72"><Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><Input className="pl-9 bg-white" placeholder="Cari admin / aksi" value={q.search} onChange={(e) => setQ({ ...q, search: e.target.value })} data-testid="activity-search-input" /></div>
        <Input type="date" className="w-auto bg-white" value={q.start} onChange={(e) => setQ({ ...q, start: e.target.value })} data-testid="activity-start-input" />
        <Input type="date" className="w-auto bg-white" value={q.end} onChange={(e) => setQ({ ...q, end: e.target.value })} data-testid="activity-end-input" />
      </div>
      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <Table data-testid="activity-table">
          <TableHeader><TableRow><TableHead>Waktu</TableHead><TableHead>Admin</TableHead><TableHead>Aksi</TableHead><TableHead>Endpoint</TableHead><TableHead>Status</TableHead><TableHead>IP</TableHead></TableRow></TableHeader>
          <TableBody>
            {items.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-10 text-slate-500">Belum ada aktivitas</TableCell></TableRow>}
            {items.map((x) => (
              <TableRow key={x.id}>
                <TableCell className="text-xs whitespace-nowrap">{fmtDateTime(x.created_at)}</TableCell>
                <TableCell className="text-sm"><div className="font-medium">{x.user_name}</div><div className="text-xs text-slate-500">{x.role}</div></TableCell>
                <TableCell className="text-sm">{x.action}</TableCell>
                <TableCell className="font-mono text-xs">{x.method} {x.path}</TableCell>
                <TableCell><span className={`text-xs font-semibold ${x.status < 400 ? "text-emerald-700" : "text-rose-700"}`}>{x.status}</span></TableCell>
                <TableCell className="font-mono text-xs">{x.ip}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
