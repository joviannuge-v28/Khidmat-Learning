import { useCallback, useEffect, useState } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { ArrowLeft, Award, CheckCircle2, Circle, Clock, Download, FileText, HelpCircle, Layers, Loader2, PlayCircle, Users, Video } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ModuleViewer } from "@/components/ModuleViewer";
import { api, certUrl, downloadCert, errMsg, fileUrl, fmtDate } from "@/lib/api";
import { MaterialsList } from "@/components/MaterialsEditor";
import { useAuth } from "@/context/AuthContext";

const ICON = { video: Video, pdf: FileText, text: FileText };

function Quiz({ course, onDone }) {
  const [answers, setAnswers] = useState({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const submit = async () => {
    if (Object.keys(answers).length < course.questions.length) {
      toast.error("Jawab semua pertanyaan terlebih dahulu");
      return;
    }
    setBusy(true);
    try {
      const mapped = Object.fromEntries(course.questions.map((q) => [q.id, q.option_ids ? q.option_ids[answers[q.id]] : answers[q.id]]));
      const { data } = await api.post(`/courses/${course.id}/quiz`, { answers: mapped });
      setResult(data);
      if (data.passed) {
        toast.success("Selamat! Anda lulus dan sertifikat telah terbit.");
        onDone();
      } else toast.error(`Nilai ${data.score}. Minimal ${data.passing_score} untuk lulus.`);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="quiz-panel">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Kuis Akhir</h2>
        <p className="text-sm text-slate-500">Nilai minimal kelulusan: {course.passing_score}. Anda dapat mengulang jika belum lulus.</p>
      </div>
      {result && !result.passed && (
        <div className="p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm" data-testid="quiz-result">
          Nilai Anda <b>{result.score}</b> ({result.correct}/{result.total} benar). Silakan coba lagi.
        </div>
      )}
      {course.questions.map((q, i) => (
        <div key={q.id} className="p-5 rounded-xl border border-slate-200 bg-white" data-testid={`quiz-question-${i}`}>
          <div className="font-semibold text-slate-800">{i + 1}. {q.question}</div>
          <div className="mt-3 grid gap-2">
            {q.options.map((o, oi) => (
              <button
                key={oi}
                type="button"
                onClick={() => setAnswers({ ...answers, [q.id]: oi })}
                data-testid={`quiz-q${i}-option-${oi}`}
                className={`text-left px-4 py-3 rounded-lg border text-sm transition-colors ${answers[q.id] === oi ? "border-blue-600 bg-blue-50 text-blue-900 font-medium" : "border-slate-200 hover:border-slate-400"}`}
              >
                <span className="font-mono mr-2 text-slate-400">{String.fromCharCode(65 + oi)}.</span>{o}
              </button>
            ))}
          </div>
        </div>
      ))}
      <Button onClick={submit} disabled={busy} className="bg-[#0F2942] hover:bg-[#0A1D30]" data-testid="quiz-submit-button">
        {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Kirim Jawaban
      </Button>
    </div>
  );
}

function Overview({ c, onEnroll, busy }) {
  const { user } = useAuth();
  return (
    <div className="space-y-8">
      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-8 items-start">
        <div className="fade-up">
          <div className="text-xs font-semibold uppercase tracking-wider text-amber-700">{c.category_name} · {c.level}</div>
          <h1 className="mt-2 text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">{c.title}</h1>
          <p className="mt-4 text-slate-600 leading-relaxed whitespace-pre-line">{c.description}</p>
          <div className="mt-6 flex flex-wrap gap-5 text-sm text-slate-600">
            <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" />{c.duration_hours} JP</span>
            <span className="flex items-center gap-1.5"><Layers className="h-4 w-4" />{c.modules.length} materi</span>
            <span className="flex items-center gap-1.5"><HelpCircle className="h-4 w-4" />{c.questions.length} soal kuis</span>
            <span className="flex items-center gap-1.5"><Users className="h-4 w-4" />{c.participants} peserta</span>
          </div>
          {c.instructor && <p className="mt-3 text-sm text-slate-500">Pengajar: <b className="text-slate-700">{c.instructor}</b></p>}
          {user?.role === "pic" ? (
            <p className="mt-8 text-sm text-slate-600 bg-slate-100 rounded-lg p-3" data-testid="pic-view-only-note">Akun PIC hanya dapat melihat kursus dan mengusulkan penambahan materi, tidak dapat mengikuti kursus.</p>
          ) : (
          <Button onClick={onEnroll} disabled={busy} size="lg" className="mt-8 bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold" data-testid="enroll-course-button">
            {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <PlayCircle className="h-5 w-5 mr-2" />}Ikuti Pelatihan
          </Button>
          )}
          {c.materials?.length > 0 && <div className="mt-6"><MaterialsList items={c.materials} title="File Pendukung" testid="course-overview-materials" /></div>}
        </div>
        <div className="aspect-[16/10] rounded-2xl overflow-hidden bg-slate-200 shadow-lg">
          {c.thumbnail && <img src={fileUrl(c.thumbnail)} alt={c.title} className="w-full h-full object-cover" />}
        </div>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h2 className="font-bold text-slate-900 mb-4">Susunan Materi</h2>
        <ol className="divide-y divide-slate-100">
          {c.modules.map((m, i) => {
            const I = ICON[m.type] || FileText;
            return <li key={m.id} className="py-3 flex items-center gap-3 text-sm"><span className="font-mono text-slate-400 w-6">{i + 1}</span><I className="h-4 w-4 text-blue-700" /><span className="flex-1">{m.title}</span><span className="text-slate-400">{m.duration_min} mnt</span></li>;
          })}
          {c.questions.length > 0 && <li className="py-3 flex items-center gap-3 text-sm"><span className="w-6" /><HelpCircle className="h-4 w-4 text-amber-600" /><span className="flex-1 font-medium">Kuis Akhir</span></li>}
        </ol>
      </div>
    </div>
  );
}

export default function CourseDetail() {
  const { id } = useParams();
  const [c, setC] = useState(null);
  const [active, setActive] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const { data } = await api.get(`/courses/${id}`);
    setC(data);
    return data;
  }, [id]);

  useEffect(() => {
    load().then((d) => {
      const done = d.enrollment?.completed_modules || [];
      const next = d.modules.find((m) => !done.includes(m.id));
      setActive(next ? next.id : d.questions.length && d.enrollment?.status !== "completed" ? "quiz" : d.modules[0]?.id);
    }).catch(() => setC(false));
  }, [load]);

  if (c === false) return <div className="text-slate-500">Pelatihan tidak ditemukan.</div>;
  if (!c) return <div className="text-slate-500">Memuat...</div>;
  if (c.kind === "zoom") return <Navigate to="/zoom" replace />;

  const enroll = async () => {
    setBusy(true);
    try {
      await api.post(`/courses/${id}/enroll`);
      toast.success("Anda terdaftar di pelatihan ini");
      const d = await load();
      setActive(d.modules[0]?.id || "quiz");
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const e = c.enrollment;
  if (!e) return <><BackLink /><Overview c={c} onEnroll={enroll} busy={busy} /></>;

  const done = e.completed_modules || [];
  const allDone = c.modules.every((m) => done.includes(m.id));
  const mod = c.modules.find((m) => m.id === active);
  const completed = e.status === "completed";

  const markDone = async () => {
    setBusy(true);
    try {
      await api.post(`/courses/${id}/modules/${mod.id}/complete`);
      const d = await load();
      const nd = d.enrollment.completed_modules;
      const next = d.modules.find((m) => !nd.includes(m.id));
      if (next) setActive(next.id);
      else if (d.questions.length && d.enrollment.status !== "completed") setActive("quiz");
      if (d.enrollment.status === "completed") toast.success("Pelatihan selesai! Sertifikat telah terbit.");
      else toast.success("Materi ditandai selesai");
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <BackLink />
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-amber-700">{c.category_name}</div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">{c.title}</h1>
        </div>
        <div className="sm:w-64">
          <div className="flex justify-between text-xs mb-1.5"><span className="text-slate-500">Progres</span><span className="font-bold" data-testid="course-progress">{c.progress}%</span></div>
          <Progress value={c.progress} className="h-2" />
        </div>
      </div>

      {completed && (
        <div className="mb-6 p-5 rounded-xl bg-emerald-50 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4" data-testid="course-completed-banner">
          <div className="flex items-center gap-3">
            <Award className="h-8 w-8 text-emerald-600" />
            <div><div className="font-bold text-emerald-900">Pelatihan selesai · Nilai {e.quiz_score}</div><div className="text-sm text-emerald-800">No. {e.certificate_no} · {fmtDate(e.completed_at)}</div></div>
          </div>
          <Button asChild className="bg-emerald-600 hover:bg-emerald-700" data-testid="course-download-certificate"><a href={certUrl(e.id)} onClick={downloadCert}><Download className="h-4 w-4 mr-2" />Unduh Sertifikat</a></Button>
        </div>
      )}

      {c.materials?.length > 0 && <div className="mb-6"><MaterialsList items={c.materials} title="File Pendukung" testid="course-materials-list" /></div>}

      <div className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">
        <div className="bg-white rounded-xl border border-slate-200 p-5 sm:p-8 min-h-[300px]">
          {active === "quiz" ? (
            completed ? <p className="text-slate-600">Anda telah lulus kuis dengan nilai {e.quiz_score}.</p>
              : allDone ? <Quiz course={c} onDone={load} />
              : <p className="text-slate-600" data-testid="quiz-locked">Selesaikan semua materi untuk membuka kuis akhir.</p>
          ) : mod ? (
            <div className="space-y-6" data-testid="module-content">
              <h2 className="text-xl font-bold text-slate-900">{mod.title}</h2>
              <ModuleViewer module={mod} />
              {mod.body && <div className="text-slate-700 leading-relaxed whitespace-pre-line">{mod.body}</div>}
              {done.includes(mod.id) ? (
                <div className="flex items-center gap-2 text-emerald-700 text-sm font-medium"><CheckCircle2 className="h-5 w-5" />Materi sudah selesai</div>
              ) : (
                <Button onClick={markDone} disabled={busy} className="bg-[#0F2942] hover:bg-[#0A1D30]" data-testid="mark-module-complete-button">
                  {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Tandai Selesai & Lanjut
                </Button>
              )}
            </div>
          ) : <p className="text-slate-500">Belum ada materi.</p>}
        </div>

        <aside className="bg-white rounded-xl border border-slate-200 p-3 lg:sticky lg:top-24" data-testid="module-list">
          <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Daftar Materi</div>
          {c.modules.map((m, i) => (
            <button key={m.id} onClick={() => setActive(m.id)} data-testid={`module-item-${i}`} className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-left text-sm transition-colors ${active === m.id ? "bg-blue-50 text-blue-900 font-medium" : "hover:bg-slate-50 text-slate-700"}`}>
              {done.includes(m.id) ? <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" /> : <Circle className="h-4 w-4 text-slate-300 shrink-0" />}
              <span className="flex-1 line-clamp-2">{m.title}</span>
            </button>
          ))}
          {c.questions.length > 0 && (
            <button onClick={() => setActive("quiz")} data-testid="module-item-quiz" className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg text-left text-sm transition-colors ${active === "quiz" ? "bg-amber-50 text-amber-900 font-medium" : "hover:bg-slate-50 text-slate-700"}`}>
              {completed ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <HelpCircle className="h-4 w-4 text-amber-600" />}
              <span className="flex-1">Kuis Akhir {!allDone && <span className="text-xs text-slate-400">(terkunci)</span>}</span>
            </button>
          )}
        </aside>
      </div>
    </div>
  );
}

const BackLink = () => (
  <Link to="/pelatihan" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 mb-6" data-testid="back-to-catalog"><ArrowLeft className="h-4 w-4" />Daftar Pelatihan</Link>
);
