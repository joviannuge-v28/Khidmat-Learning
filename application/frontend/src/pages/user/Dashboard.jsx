import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Award, BookOpen, BookOpenCheck, Download, GraduationCap, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { StatCard, EmptyState, UserAvatar } from "@/components/common";
import { ReadingCard } from "@/pages/user/Readings";
import { MyJpReport } from "@/components/JpReport";
import { useAuth } from "@/context/AuthContext";
import { api, certUrl, downloadCert, fileUrl, fmtDate } from "@/lib/api";

const Section = ({ title, to, children, testid }) => (
  <section className="bg-white p-5 sm:p-6 rounded-xl border border-slate-200/80 shadow-sm" data-testid={testid}>
    <div className="flex items-center justify-between mb-5">
      <h2 className="text-base md:text-lg font-bold text-slate-900">{title}</h2>
      {to && <Link to={to} className="text-sm text-blue-700 font-medium hover:underline">Lihat semua</Link>}
    </div>
    {children}
  </section>
);

export default function Dashboard() {
  const { user, settings } = useAuth();
  const [d, setD] = useState(null);

  useEffect(() => {
    api.get("/my/dashboard").then((r) => setD(r.data));
  }, []);

  if (!d) return <div className="text-slate-500">Memuat dashboard...</div>;

  return (
    <div className="space-y-8">
      <div className="relative overflow-hidden rounded-2xl bg-[#0F2942] text-white p-6 sm:p-10 fade-up" data-testid="dashboard-hero">
        <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-amber-500/20 blur-2xl" />
        <div className="absolute right-24 bottom-0 h-40 w-40 rounded-full bg-blue-500/20 blur-2xl" />
        <div className="relative flex flex-col sm:flex-row sm:items-center gap-5">
          <UserAvatar user={user} size="h-16 w-16" />
          <div className="flex-1 min-w-0">
            <div className="text-xs uppercase tracking-[0.2em] text-amber-400 font-semibold">Selamat datang kembali</div>
            <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight mt-1">{user.name}</h1>
            <p className="text-slate-300 text-sm mt-1">{user.nip ? `NIP ${user.nip}` : user.email} · {user.jabatan || "Pegawai"}{user.unit_kerja ? ` · ${user.unit_kerja}` : ""}</p>
          </div>
          {settings?.welcome_logo_path && <img src={fileUrl(settings.welcome_logo_path)} alt="Logo Kota Dumai" onError={(e) => { e.currentTarget.style.display = "none"; }} className="h-20 sm:h-24 w-auto object-contain sm:ml-auto drop-shadow-lg" data-testid="dashboard-welcome-logo" />}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <StatCard icon={PlayCircle} label="Sedang Diikuti" value={d.ongoing.length} testid="stat-ongoing" />
        <StatCard icon={GraduationCap} label="Pelatihan Selesai" value={d.completed.length} tone="emerald" testid="stat-completed" />
        <StatCard icon={Award} label="Sertifikat" value={d.completed.length} tone="amber" testid="stat-certificates" />
        <StatCard icon={BookOpen} label="Bacaan Tersedia" value={d.reading_total} tone="slate" testid="stat-readings" />
      </div>

      <MyJpReport />

      <div className="grid lg:grid-cols-2 gap-6">
        <Section title="Pelatihan Sedang Diikuti" to="/sedang-diikuti" testid="dashboard-ongoing">
          {d.ongoing.length === 0 ? (
            <EmptyState icon={PlayCircle} title="Belum ada pelatihan aktif" action={<Button asChild size="sm" data-testid="dashboard-browse-courses"><Link to="/pelatihan">Jelajahi pelatihan</Link></Button>} />
          ) : (
            <ul className="space-y-4">
              {d.ongoing.slice(0, 4).map((e) => (
                <li key={e.id}>
                  <Link to={`/pelatihan/${e.course_id}`} className="block p-4 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50/40 transition-colors" data-testid={`dashboard-ongoing-${e.course_id}`}>
                    <div className="flex justify-between gap-3"><span className="font-semibold text-slate-800 line-clamp-1">{e.course.title}</span><span className="text-sm font-bold text-blue-700">{e.progress}%</span></div>
                    <Progress value={e.progress} className="h-2 mt-3" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Pelatihan Selesai" to="/selesai" testid="dashboard-completed">
          {d.completed.length === 0 ? (
            <EmptyState icon={GraduationCap} title="Belum ada pelatihan selesai" text="Sertifikat terbit otomatis setelah Anda menyelesaikan materi dan lulus kuis." />
          ) : (
            <ul className="divide-y divide-slate-100">
              {d.completed.slice(0, 4).map((e) => (
                <li key={e.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-800 line-clamp-1">{e.course.title}</div>
                    <div className="text-xs text-slate-500">{e.certificate_no} · {fmtDate(e.completed_at)}{e.course.kind === "zoom" ? " · Webinar" : ` · Nilai ${e.quiz_score}`}</div>
                  </div>
                  <Button asChild size="sm" variant="outline" data-testid={`dashboard-download-cert-${e.id}`}>
                    <a href={certUrl(e.id)} onClick={downloadCert}><Download className="h-4 w-4" /></a>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <Section title="Daftar Bacaan Terbaru" to="/kms" testid="dashboard-readings">
        {d.readings.length === 0 ? (
          <EmptyState icon={BookOpenCheck} title="Belum ada bacaan" />
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">{d.readings.map((r) => <ReadingCard key={r.id} r={r} />)}</div>
        )}
      </Section>
    </div>
  );
}
