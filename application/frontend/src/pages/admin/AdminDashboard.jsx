import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Award, BadgeCheck, BookOpen, Clock, GraduationCap, PlayCircle, Printer, Timer, Users } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader, StatCard } from "@/components/common";
import { api, downloadFromApi, errMsg, fmtDate } from "@/lib/api";
import { SurveyStats } from "@/components/SurveyStats";

const BLN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

function LearningHours() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [d, setD] = useState(null);
  useEffect(() => {
    api.get("/admin/stats/learning-hours", { params: { year } }).then((r) => setD(r.data));
  }, [year]);
  const data = (d?.months || []).map((m) => ({ ...m, bulan: BLN[m.month - 1] }));
  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-sm" data-testid="learning-hours">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div><h2 className="font-bold text-slate-900 flex items-center gap-2"><Timer className="h-4 w-4 text-blue-700" />Laporan Learning Hours</h2><p className="text-sm text-slate-500">Total jam pelajaran (JP) diselesaikan per bulan · <b data-testid="learning-hours-total">{d?.total ?? 0} JP</b> tahun {year}</p></div>
        <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="h-9 rounded-md border border-slate-200 px-2 text-sm" data-testid="learning-hours-year">
          {[0, 1, 2, 3].map((k) => new Date().getFullYear() - k).map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </div>
      <div className="h-64"><ResponsiveContainer><BarChart data={data}><CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" /><XAxis dataKey="bulan" tick={{ fontSize: 11 }} /><YAxis tick={{ fontSize: 11 }} /><Tooltip /><Legend /><Bar dataKey="jam" name="Learning Hours (JP)" fill="#1E40AF" radius={[4, 4, 0, 0]} /><Bar dataKey="peserta" name="Peserta" fill="#D97706" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>
      <div className="mt-4 overflow-x-auto"><table className="w-full text-xs"><thead><tr className="text-slate-500"><td>Bulan</td>{data.map((m) => <td key={m.month} className="text-center">{m.bulan}</td>)}</tr></thead><tbody><tr><td className="font-semibold">JP</td>{data.map((m) => <td key={m.month} className="text-center">{m.jam}</td>)}</tr><tr><td className="font-semibold">Kegiatan</td>{data.map((m) => <td key={m.month} className="text-center">{m.kegiatan}</td>)}</tr></tbody></table></div>
    </div>
  );
}

function VisitReport() {
  const [s, setS] = useState(null);
  useEffect(() => {
    api.get("/public/stats").then((r) => setS(r.data));
  }, []);
  return (
    <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-sm" data-testid="visit-report">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-bold text-slate-900">Statistik Aktivitas Pengguna Platform</h2>
        <Button size="sm" variant="outline" onClick={() => downloadFromApi("/admin/reports/visits/export", "statistik-kunjungan.pdf").catch((e) => toast.error(errMsg(e)))} data-testid="visit-report-print"><Printer className="h-4 w-4 mr-2" />Cetak Laporan</Button>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3 text-center">
        {[["30 hari terakhir", s?.last30], ["Hari ini", s?.today], ["Repositori dilihat", s?.kms_views]].map(([l, v]) => <div key={l} className="p-3 rounded-lg bg-slate-50"><div className="text-2xl font-extrabold">{v ?? "-"}</div><div className="text-xs text-slate-500">{l}</div></div>)}
      </div>
      <div className="h-32 mt-4"><ResponsiveContainer><AreaChart data={s?.daily || []}><XAxis dataKey="date" hide /><Tooltip /><Area dataKey="kunjungan" stroke="#D97706" fill="#D97706" fillOpacity={0.2} /></AreaChart></ResponsiveContainer></div>
    </div>
  );
}

export default function AdminDashboard() {
  const [s, setS] = useState(null);
  useEffect(() => {
    api.get("/admin/stats").then((r) => setS(r.data));
  }, []);
  if (!s) return <div className="text-slate-500">Memuat...</div>;

  return (
    <div className="space-y-8">
      <PageHeader title="Dashboard Admin" subtitle="Ringkasan aktivitas LMS & KMS." />
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
        <StatCard icon={Users} label="Pegawai" value={s.users} testid="admin-stat-users" />
        <StatCard icon={BadgeCheck} label={`Akun terverifikasi (${s.verified}/${s.total_users})`} value={`${s.verified_pct}%`} tone="emerald" testid="admin-stat-verified" />
        <StatCard icon={GraduationCap} label="Pelatihan" value={s.courses} tone="slate" testid="admin-stat-courses" />
        <StatCard icon={PlayCircle} label="Sedang Berjalan" value={s.ongoing} tone="blue" testid="admin-stat-ongoing" />
        <StatCard icon={Award} label="Sertifikat" value={s.certificates} tone="emerald" testid="admin-stat-certificates" />
        <StatCard icon={BookOpen} label="Bacaan KMS" value={s.readings} tone="amber" testid="admin-stat-readings" />
        <Link to="/admin/kms"><StatCard icon={Clock} label="Usulan Menunggu" value={s.pending_readings} tone="rose" testid="admin-stat-pending" /></Link>
      </div>
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2"><LearningHours /></div>
        <VisitReport />
      </div>
      <SurveyStats />
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-sm lg:col-span-2" data-testid="admin-chart">
          <h2 className="font-bold text-slate-900 mb-4">Peserta per Pelatihan</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={s.chart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="peserta" name="Peserta" fill="#1E40AF" radius={[4, 4, 0, 0]} />
                <Bar dataKey="lulus" name="Lulus" fill="#D97706" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200/80 shadow-sm" data-testid="admin-recent-certs">
          <h2 className="font-bold text-slate-900 mb-4">Sertifikat Terbaru</h2>
          {s.recent_certificates.length === 0 ? <p className="text-sm text-slate-500">Belum ada sertifikat terbit.</p> : (
            <ul className="divide-y divide-slate-100">
              {s.recent_certificates.map((c) => (
                <li key={c.id} className="py-3"><div className="text-sm font-semibold">{c.user_name}</div><div className="text-xs text-slate-500 line-clamp-1">{c.course_title} · {fmtDate(c.completed_at)}</div></li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
