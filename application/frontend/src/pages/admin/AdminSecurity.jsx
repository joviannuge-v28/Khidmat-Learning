import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, DatabaseBackup, KeyRound, MailCheck, ShieldAlert, ShieldCheck, UserX } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader, StatCard } from "@/components/common";
import { api, fmtDateTime } from "@/lib/api";

const EVT = { login_failed: ["Login gagal", "text-rose-700 bg-rose-50"], login_success: ["Login berhasil", "text-emerald-700 bg-emerald-50"], password_changed: ["Ganti kata sandi", "text-blue-700 bg-blue-50"],
  email_verified: ["Email terverifikasi", "text-emerald-700 bg-emerald-50"], email_approved: ["Email disetujui admin", "text-amber-700 bg-amber-50"], email_changed: ["Email diubah admin", "text-amber-700 bg-amber-50"], restore: ["Pemulihan database", "text-rose-700 bg-rose-50"] };

export default function AdminSecurity() {
  const [s, setS] = useState(null);
  const load = () => api.get("/admin/security/overview").then((r) => setS(r.data));
  useEffect(() => {
    load();
  }, []);
  if (!s) return <div className="text-slate-500">Memuat...</div>;
  return (
    <div className="space-y-8">
      <PageHeader title="Security Monitoring" subtitle="Pemantauan keamanan: percobaan login, aktivitas admin, verifikasi, dan backup." />
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard icon={ShieldAlert} label="Login gagal 24 jam" value={s.failed_24h} tone="rose" testid="sec-failed-24h" />
        <StatCard icon={AlertTriangle} label="Login gagal 7 hari" value={s.failed_7d} tone="amber" testid="sec-failed-7d" />
        <StatCard icon={ShieldCheck} label="Login berhasil 24 jam" value={s.success_24h} tone="emerald" testid="sec-success-24h" />
        <StatCard icon={KeyRound} label="Wajib ganti sandi" value={s.must_change} tone="slate" testid="sec-must-change" />
        <StatCard icon={MailCheck} label="Akun terverifikasi" value={`${s.verified_pct}%`} tone="blue" testid="sec-verified" />
        <StatCard icon={UserX} label="Akun nonaktif" value={s.inactive} tone="slate" testid="sec-inactive" />
      </div>
      <div className="grid md:grid-cols-3 gap-4 text-sm">
        <div className={`p-4 rounded-xl border ${s.smtp_configured ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"}`} data-testid="sec-smtp">SMTP: <b>{s.smtp_configured ? "aktif" : "belum dikonfigurasi"}</b> · <Link to="/admin/smtp" className="underline">atur</Link></div>
        <div className="p-4 rounded-xl border bg-white border-slate-200" data-testid="sec-last-backup"><DatabaseBackup className="h-4 w-4 inline mr-1" />Backup terakhir: <b>{s.last_backup ? fmtDateTime(s.last_backup.created_at) : "belum ada"}</b> · <Link to="/admin/backup" className="underline">kelola</Link></div>
        <div className="p-4 rounded-xl border bg-white border-slate-200" data-testid="sec-admin-actions">Aksi admin 24 jam: <b>{s.admin_actions_24h}</b> · <Link to="/admin/log-aktivitas" className="underline">lihat log</Link></div>
      </div>
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 lg:col-span-2" data-testid="sec-chart">
          <h2 className="font-bold mb-4">Aktivitas Login 7 Hari</h2>
          <div className="h-64"><ResponsiveContainer><BarChart data={s.daily}><CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" /><XAxis dataKey="day" tick={{ fontSize: 11 }} /><YAxis allowDecimals={false} tick={{ fontSize: 11 }} /><Tooltip /><Legend /><Bar dataKey="berhasil" name="Berhasil" fill="#059669" radius={[4, 4, 0, 0]} /><Bar dataKey="gagal" name="Gagal" fill="#E11D48" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div>
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 space-y-5">
          <div>
            <h2 className="font-bold mb-2">IP Login Gagal Terbanyak (7 hari)</h2>
            {s.top_ips.length === 0 ? <p className="text-sm text-slate-500">Tidak ada.</p> : s.top_ips.map((x) => <div key={x.ip} className="flex justify-between text-sm py-1 font-mono"><span>{x.ip}</span><b>{x.count}</b></div>)}
          </div>
        </div>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <div className="p-5 font-bold">Kejadian Keamanan Terbaru</div>
        <Table data-testid="sec-events-table">
          <TableHeader><TableRow><TableHead>Waktu</TableHead><TableHead>Kejadian</TableHead><TableHead>Akun</TableHead><TableHead>IP</TableHead><TableHead>Keterangan</TableHead></TableRow></TableHeader>
          <TableBody>
            {s.events.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="whitespace-nowrap text-xs">{fmtDateTime(e.created_at)}</TableCell>
                <TableCell><span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${(EVT[e.type] || [])[1] || "bg-slate-100"}`}>{(EVT[e.type] || [e.type])[0]}</span></TableCell>
                <TableCell className="text-sm">{e.user_name || e.identifier}</TableCell>
                <TableCell className="font-mono text-xs">{e.ip}</TableCell>
                <TableCell className="text-xs text-slate-500">{e.detail}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
