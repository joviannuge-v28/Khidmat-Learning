import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { FileSpreadsheet, FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { downloadFromApi, errMsg, fmtDate } from "@/lib/api";
import { api } from "@/lib/api";

const NOW = new Date().getFullYear();
export const YEARS = [NOW - 2, NOW - 1, NOW, NOW + 1];

export const ExportButtons = ({ path, params, testid }) => {
  const dl = (format) => downloadFromApi(`${path}?${new URLSearchParams({ ...params, format })}`, `laporan.${format}`).catch((e) => toast.error(errMsg(e)));
  return (
    <div className="flex gap-2">
      <Button size="sm" variant="outline" onClick={() => dl("pdf")} data-testid={`${testid}-pdf`}><FileText className="h-4 w-4 mr-1.5 text-rose-600" />PDF</Button>
      <Button size="sm" variant="outline" onClick={() => dl("xlsx")} data-testid={`${testid}-excel`}><FileSpreadsheet className="h-4 w-4 mr-1.5 text-emerald-600" />Excel</Button>
    </div>
  );
};

export const MyJpReport = () => {
  const [year, setYear] = useState(NOW);
  const [d, setD] = useState(null);
  useEffect(() => {
    api.get("/my/jp", { params: { year } }).then((r) => setD(r.data));
  }, [year]);
  return (
    <section className="bg-white p-5 sm:p-6 rounded-xl border border-slate-200/80 shadow-sm" data-testid="dashboard-jp-report">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-base md:text-lg font-bold text-slate-900">Laporan JP Saya</h2>
          <p className="text-sm text-slate-500">Total Jam Pelajaran dari pelatihan dan webinar yang selesai.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-28" data-testid="my-jp-year-select"><SelectValue /></SelectTrigger>
            <SelectContent>{YEARS.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
          </Select>
          <ExportButtons path="/my/jp/export" params={{ year }} testid="my-jp-export" />
        </div>
      </div>
      {!d ? <div className="text-slate-500">Memuat...</div> : (
        <div className="grid lg:grid-cols-[200px_1fr] gap-6">
          <div className="rounded-xl bg-[#0F2942] text-white p-5 flex flex-col justify-center">
            <div className="text-xs uppercase tracking-widest text-amber-400 font-semibold">Total {year}</div>
            <div className="text-4xl font-extrabold mt-1" data-testid="my-jp-total">{d.total}<span className="text-base font-semibold text-slate-300"> JP</span></div>
            <div className="text-xs text-slate-300 mt-1">{d.items.length} kegiatan selesai</div>
          </div>
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={d.months} margin={{ left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#64748b" }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#64748b" }} />
                <Tooltip formatter={(v) => [`${v} JP`, "Jam Pelajaran"]} />
                <Bar dataKey="jp" fill="#D97706" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
      {d?.items.length > 0 && (
        <ul className="mt-5 divide-y divide-slate-100 text-sm" data-testid="my-jp-items">
          {d.items.slice(0, 6).map((it, i) => (
            <li key={i} className="py-2.5 flex justify-between gap-3"><span className="text-slate-700 line-clamp-1">{it.course_title} <span className="text-xs text-slate-400">· {fmtDate(it.date)}</span></span><span className="font-bold text-slate-900 shrink-0">{it.jp} JP</span></li>
          ))}
        </ul>
      )}
    </section>
  );
};
