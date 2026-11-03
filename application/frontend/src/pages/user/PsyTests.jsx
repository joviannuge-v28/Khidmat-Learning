import { useEffect, useState } from "react";
import { ArrowLeft, Brain, History, Loader2, PlayCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader, EmptyState } from "@/components/common";
import { PsyResultView } from "@/components/PsyResultView";
import { api, errMsg, fmtDate } from "@/lib/api";

function TakeTest({ id, onDone, onBack }) {
  const [t, setT] = useState(null);
  const [ans, setAns] = useState({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api.get(`/psy-tests/${id}`).then((r) => setT(r.data));
  }, [id]);
  if (!t) return <div className="text-slate-500">Memuat tes...</div>;
  const done = Object.keys(ans).length;
  const submit = async () => {
    setBusy(true);
    try {
      const { data } = await api.post(`/psy-tests/${id}/submit`, { answers: ans });
      toast.success("Tes selesai. Berikut hasil Anda.");
      onDone(data);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="max-w-3xl space-y-5" data-testid="psy-take">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"><ArrowLeft className="h-4 w-4" />Kembali</button>
      <PageHeader title={t.title} subtitle={t.description} />
      <div className="sticky top-20 z-10 bg-white/95 backdrop-blur rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium" data-testid="psy-progress">{done} / {t.questions.length} soal terjawab</div>
      {t.questions.map((q, i) => (
        <div key={q.id} className="bg-white rounded-xl border border-slate-200 p-5" data-testid={`psy-question-${i}`}>
          <div className="font-semibold text-slate-900"><span className="font-mono text-amber-600 mr-2">{i + 1}.</span>{q.text}</div>
          <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {q.options.map((o, oi) => (
              <button key={oi} type="button" onClick={() => setAns({ ...ans, [q.id]: oi })} data-testid={`psy-q${i}-opt${oi}`}
                className={`text-left text-sm px-3 py-2.5 rounded-lg border transition-colors ${ans[q.id] === oi ? "bg-[#0F2942] text-white border-[#0F2942]" : "border-slate-200 text-slate-700 hover:border-slate-400"}`}>{o}</button>
            ))}
          </div>
        </div>
      ))}
      <Button onClick={submit} disabled={busy || done < t.questions.length} className="w-full h-12 bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold" data-testid="psy-submit-button">
        {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Lihat Hasil
      </Button>
    </div>
  );
}

export default function PsyTests() {
  const [tests, setTests] = useState(null);
  const [history, setHistory] = useState([]);
  const [taking, setTaking] = useState(null);
  const [result, setResult] = useState(null);
  const load = () => {
    api.get("/psy-tests").then((r) => setTests(r.data));
    api.get("/psy-results/mine").then((r) => setHistory(r.data));
  };
  useEffect(() => {
    load();
  }, []);

  if (taking) return <TakeTest id={taking} onBack={() => setTaking(null)} onDone={(r) => { setTaking(null); setResult(r); load(); }} />;
  if (result) return (
    <div className="space-y-5">
      <button onClick={() => setResult(null)} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900" data-testid="psy-result-back"><ArrowLeft className="h-4 w-4" />Daftar Tes</button>
      <PageHeader title="Hasil Tes Kepribadian" subtitle="Grafik dan skor tiap dimensi berdasarkan jawaban Anda." />
      <PsyResultView r={result} />
    </div>
  );

  return (
    <div className="space-y-8">
      <PageHeader title="Tes Kepribadian" subtitle="Kenali gaya kerja dan kepribadian Anda. Hasil bersifat pribadi dan dapat dilihat kembali kapan saja." />
      {tests === null ? <div className="text-slate-500">Memuat...</div> : tests.length === 0 ? <EmptyState icon={Brain} title="Belum ada tes" text="Tes kepribadian akan tampil setelah disiapkan admin." testid="psy-empty" /> : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5" data-testid="psy-test-list">
          {tests.map((t) => (
            <div key={t.id} className="bg-white rounded-xl border border-slate-200 p-6 flex flex-col" data-testid={`psy-test-${t.id}`}>
              <div className="h-11 w-11 rounded-lg bg-[#0F2942] text-amber-400 grid place-items-center"><Brain className="h-5 w-5" /></div>
              <h3 className="mt-4 font-bold text-slate-900">{t.title}</h3>
              <p className="mt-1 text-sm text-slate-600 line-clamp-3">{t.description}</p>
              <p className="mt-3 text-xs text-slate-500">{t.question_count} soal · {t.dimensions.length} dimensi{t.last_result && ` · terakhir ${fmtDate(t.last_result.created_at)}`}</p>
              <div className="mt-auto pt-5 flex gap-2">
                <Button onClick={() => setTaking(t.id)} className="flex-1 bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold" data-testid={`psy-start-${t.id}`}><PlayCircle className="h-4 w-4 mr-2" />{t.last_result ? "Ulangi Tes" : "Mulai Tes"}</Button>
                {t.last_result && <Button variant="outline" onClick={() => setResult(t.last_result)} data-testid={`psy-last-${t.id}`}>Hasil</Button>}
              </div>
            </div>
          ))}
        </div>
      )}
      {history.length > 0 && (
        <section className="bg-white rounded-xl border border-slate-200" data-testid="psy-history">
          <div className="px-5 py-4 border-b border-slate-200 font-bold flex items-center gap-2"><History className="h-4 w-4" />Riwayat Hasil</div>
          <ul className="divide-y divide-slate-100">
            {history.map((h) => (
              <li key={h.id} className="px-5 py-3 flex items-center justify-between gap-3">
                <div><div className="font-medium text-slate-800">{h.test_title}</div><div className="text-xs text-slate-500">{fmtDate(h.created_at)} · Dominan: {h.dominant}</div></div>
                <Button size="sm" variant="ghost" onClick={() => setResult(h)} data-testid={`psy-history-view-${h.id}`}>Lihat</Button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
