import { useEffect, useState } from "react";
import { Medal } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/common";
import { ExportButtons, YEARS } from "@/components/JpReport";
import { api } from "@/lib/api";

const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const MEDAL = ["text-amber-500", "text-slate-400", "text-orange-700"];

export default function AdminReports() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [group, setGroup] = useState("person");
  const [rows, setRows] = useState(null);
  const params = { year, month, group };

  useEffect(() => {
    setRows(null);
    api.get("/admin/reports/jp", { params: { year, month, group } }).then((r) => setRows(r.data));
  }, [year, month, group]);

  return (
    <div>
      <PageHeader title="Laporan JP Bulanan" subtitle="Leaderboard Jam Pelajaran per pegawai dan per OPD dari pelatihan & webinar yang selesai."
        action={<ExportButtons path="/admin/reports/jp/export" params={params} testid="admin-jp-export" />} />
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <Tabs value={group} onValueChange={setGroup}>
          <TabsList><TabsTrigger value="person" data-testid="jp-tab-person">Per Pegawai</TabsTrigger><TabsTrigger value="opd" data-testid="jp-tab-opd">Per OPD</TabsTrigger></TabsList>
        </Tabs>
        <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
          <SelectTrigger className="w-40 bg-white" data-testid="jp-month-select"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="0">Setahun penuh</SelectItem>{MONTHS.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
          <SelectTrigger className="w-28 bg-white" data-testid="jp-year-select"><SelectValue /></SelectTrigger>
          <SelectContent>{YEARS.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <Table data-testid="jp-report-table">
          <TableHeader>
            {group === "person"
              ? <TableRow><TableHead className="w-20">#</TableHead><TableHead>Pegawai</TableHead><TableHead>OPD</TableHead><TableHead>Kegiatan</TableHead><TableHead className="text-right">Total JP</TableHead></TableRow>
              : <TableRow><TableHead className="w-20">#</TableHead><TableHead>OPD</TableHead><TableHead>Pegawai</TableHead><TableHead>Kegiatan</TableHead><TableHead>Rata-rata JP</TableHead><TableHead className="text-right">Total JP</TableHead></TableRow>}
          </TableHeader>
          <TableBody>
            {rows === null && <TableRow><TableCell colSpan={6} className="text-center py-10 text-slate-500">Memuat...</TableCell></TableRow>}
            {rows?.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-10 text-slate-500" data-testid="jp-report-empty">Belum ada JP pada periode ini</TableCell></TableRow>}
            {rows?.map((r) => (
              <TableRow key={r.rank} data-testid={`jp-row-${r.rank}`}>
                <TableCell className="font-mono font-bold">{r.rank <= 3 ? <Medal className={`h-5 w-5 ${MEDAL[r.rank - 1]}`} /> : r.rank}</TableCell>
                <TableCell><div className="font-medium">{r.name}</div>{group === "person" && <div className="text-xs text-slate-500 font-mono">{r.nip}</div>}</TableCell>
                {group === "person" ? <TableCell className="text-sm">{r.unit_kerja || "-"}</TableCell> : <TableCell>{r.participants}</TableCell>}
                <TableCell>{r.activities}</TableCell>
                {group === "opd" && <TableCell>{r.avg_jp}</TableCell>}
                <TableCell className="text-right font-extrabold text-slate-900">{r.jp}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
