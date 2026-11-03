import { useEffect, useState } from "react";
import { ClipboardList, Save } from "lucide-react";
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, errMsg } from "@/lib/api";

const BLN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

function RespondentForm({ year, onSaved }) {
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [count, setCount] = useState("");
  const save = async () => {
    try {
      await api.put("/admin/survey/respondents", { year, month, count: count === "" ? null : Number(count) });
      toast.success(count === "" ? `Data pengisi ${BLN[month - 1]} ${year} dikosongkan` : `Jumlah pengisi ${BLN[month - 1]} ${year} disimpan`);
      setCount("");
      onSaved();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };
  return (
    <div className="flex flex-wrap items-end gap-2" data-testid="survey-respondent-form">
      <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="h-9 rounded-md border border-slate-200 px-2 text-sm" data-testid="survey-respondent-month">
        {BLN.map((b, i) => <option key={b} value={i + 1}>{b}</option>)}
      </select>
      <Input type="number" min={0} value={count} onChange={(e) => setCount(e.target.value)} placeholder="Jumlah pengisi" className="h-9 w-36" data-testid="survey-respondent-count" />
      <Button size="sm" onClick={save} className="bg-[#0F2942] hover:bg-[#0A1D30]" data-testid="survey-respondent-save"><Save className="h-4 w-4 mr-1.5" />{count === "" ? "Kosongkan" : "Simpan"}</Button>
    </div>
  );
}

export const SurveyStats = () => {
  const [year, setYear] = useState(new Date().getFullYear());
  const [d, setD] = useState(null);
  const load = () => api.get("/admin/survey/stats", { params: { year } }).then((r) => setD(r.data)).catch(() => {});
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);
  const data = (d?.months || []).map((m) => ({ ...m, total: m.link + m.qr }));
  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-sm" data-testid="survey-stats">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="font-bold text-slate-900 flex items-center gap-2"><ClipboardList className="h-4 w-4 text-amber-600" />Rekap Survei Kepuasan</h2>
          <p className="text-sm text-slate-500">Pengunjung survei (klik tautan & scan barcode) per bulan · <b data-testid="survey-stats-total-visits">{d?.total_visits ?? 0}</b> pengunjung · <b data-testid="survey-stats-total-respondents">{d?.total_respondents ?? 0}</b> pengisi tercatat tahun {year}</p>
        </div>
        <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="h-9 rounded-md border border-slate-200 px-2 text-sm" data-testid="survey-stats-year">
          {[0, 1, 2, 3].map((k) => new Date().getFullYear() - k).map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
      <div className="h-64" data-testid="survey-stats-chart">
        <ResponsiveContainer>
          <ComposedChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            <XAxis dataKey="bulan" tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
            <Bar dataKey="link" stackId="v" name="Klik tautan" fill="#0F2942" />
            <Bar dataKey="qr" stackId="v" name="Scan barcode" fill="#D97706" radius={[4, 4, 0, 0]} />
            <Line dataKey="pengisi" name="Pengisi (input admin)" stroke="#059669" strokeWidth={2} connectNulls dot={{ r: 3 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 overflow-x-auto"><table className="w-full text-xs" data-testid="survey-stats-table"><thead><tr className="text-slate-500"><td>Bulan</td>{data.map((m) => <td key={m.month} className="text-center">{m.bulan}</td>)}</tr></thead><tbody><tr><td className="font-semibold">Pengunjung</td>{data.map((m) => <td key={m.month} className="text-center">{m.total}</td>)}</tr><tr><td className="font-semibold">Pengisi</td>{data.map((m) => <td key={m.month} className="text-center">{m.pengisi ?? "-"}</td>)}</tr></tbody></table></div>
      <div className="mt-4 flex flex-col md:flex-row md:items-end justify-between gap-3 border-t border-slate-100 pt-4">
        <p className="text-xs text-slate-500 max-w-md">Pengunjung dihitung 1 kali per orang per hari untuk barcode otomatis & tombol "Isi Survei". Jumlah pengisi sebenarnya (dari hasil Google Form/SKM) bisa diisi manual per bulan; biarkan kosong lalu klik Kosongkan untuk menghapus.</p>
        <RespondentForm year={year} onSaved={load} />
      </div>
    </div>
  );
};
