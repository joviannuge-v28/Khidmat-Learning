import { useEffect, useState } from "react";
import { Loader2, Plus, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, errMsg, fmtDateTime } from "@/lib/api";

const RATING_LABEL = ["Sangat Kurang", "Kurang", "Cukup", "Baik", "Sangat Baik"];

export const EvalQuestionsEditor = ({ value, onChange }) => {
  const upd = (i, k, v) => onChange(value.map((q, j) => (j === i ? { ...q, [k]: v } : q)));
  return (
    <div className="space-y-3" data-testid="eval-questions-editor">
      {value.map((q, i) => (
        <div key={q.id || i} className="p-3 rounded-lg border border-slate-200 bg-slate-50/60 grid sm:grid-cols-[1fr_150px_auto_auto] gap-2 items-center" data-testid={`eval-q-${i}`}>
          <Input value={q.text} onChange={(e) => upd(i, "text", e.target.value)} placeholder="Teks pertanyaan" className="bg-white" data-testid={`eval-q-text-${i}`} />
          <Select value={q.type} onValueChange={(v) => upd(i, "type", v)}>
            <SelectTrigger className="bg-white" data-testid={`eval-q-type-${i}`}><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="rating">Skala 1–5</SelectItem><SelectItem value="text">Jawaban teks</SelectItem></SelectContent>
          </Select>
          <label className="flex items-center gap-2 text-xs"><Switch checked={q.required} onCheckedChange={(v) => upd(i, "required", v)} data-testid={`eval-q-required-${i}`} />Wajib</label>
          <Button type="button" size="icon" variant="ghost" onClick={() => onChange(value.filter((_, j) => j !== i))} data-testid={`eval-q-remove-${i}`}><Trash2 className="h-4 w-4 text-rose-600" /></Button>
        </div>
      ))}
      <Button type="button" size="sm" variant="outline" onClick={() => onChange([...value, { text: "", type: "rating", required: true }])} data-testid="eval-q-add"><Plus className="h-4 w-4 mr-1" />Tambah Pertanyaan</Button>
    </div>
  );
};

const RatingInput = ({ value, onChange, testid }) => (
  <div className="flex flex-wrap gap-2" data-testid={testid}>
    {[1, 2, 3, 4, 5].map((n) => (
      <button key={n} type="button" onClick={() => onChange(n)} title={RATING_LABEL[n - 1]} data-testid={`${testid}-${n}`}
        className={`h-11 px-3 rounded-lg border flex items-center gap-1.5 text-sm font-semibold transition-colors ${value === n ? "bg-amber-500 border-amber-500 text-slate-900" : "border-slate-200 text-slate-600 hover:border-amber-400"}`}>
        <Star className="h-4 w-4" />{n}
      </button>
    ))}
    <span className="self-center text-xs text-slate-500">{value ? RATING_LABEL[value - 1] : ""}</span>
  </div>
);

export const EvaluationDialog = ({ course, onOpenChange, onDone }) => {
  const [info, setInfo] = useState(null);
  const [ans, setAns] = useState({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (course) {
      setInfo(null);
      setAns({});
      api.get(`/courses/${course.id}/evaluation`).then((r) => setInfo(r.data)).catch((e) => toast.error(errMsg(e)));
    }
  }, [course]);

  const submit = async () => {
    setBusy(true);
    try {
      await api.post(`/courses/${course.id}/evaluation`, { answers: ans });
      toast.success("Terima kasih! Evaluasi terkirim, sertifikat kini dapat diunduh.");
      onOpenChange(false);
      onDone?.();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!course} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="evaluation-dialog">
        <DialogHeader>
          <DialogTitle>Evaluasi Webinar</DialogTitle>
          <DialogDescription>{course?.title} — wajib diisi untuk membuka sertifikat.</DialogDescription>
        </DialogHeader>
        {!info ? <div className="text-slate-500 py-6">Memuat...</div> : !info.available ? (
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-4" data-testid="evaluation-not-available">Evaluasi dapat diisi setelah webinar selesai.</p>
        ) : (
          <div className="space-y-5">
            {info.questions.map((q, i) => (
              <div key={q.id} className="space-y-2">
                <Label className="leading-snug">{i + 1}. {q.text}{q.required && <span className="text-rose-600"> *</span>}</Label>
                {q.type === "rating"
                  ? <RatingInput value={ans[q.id]} onChange={(v) => setAns({ ...ans, [q.id]: v })} testid={`evaluation-rating-${i}`} />
                  : <Textarea rows={3} value={ans[q.id] || ""} onChange={(e) => setAns({ ...ans, [q.id]: e.target.value })} data-testid={`evaluation-text-${i}`} />}
              </div>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Nanti</Button>
          {info?.available && <Button onClick={submit} disabled={busy} className="bg-[#0F2942] hover:bg-[#0A1D30]" data-testid="evaluation-submit-button">{busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Kirim Evaluasi</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

function Results({ d }) {
  return (
    <div className="space-y-5">
      <div className="grid sm:grid-cols-2 gap-3">
        {d.summary.filter((s) => s.type === "rating").map((s) => (
          <div key={s.id} className="p-4 rounded-lg border border-slate-200">
            <div className="text-xs text-slate-500 line-clamp-2">{s.text}</div>
            <div className="mt-1 text-2xl font-extrabold text-slate-900">{s.avg ?? "-"}<span className="text-sm font-medium text-slate-400"> / 5 · {s.count} jawaban</span></div>
          </div>
        ))}
      </div>
      <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg" data-testid="evaluation-responses">
        {d.responses.length === 0 && <p className="p-4 text-sm text-slate-500">Belum ada evaluasi masuk.</p>}
        {d.responses.map((r) => (
          <div key={r.id} className="p-3 text-sm">
            <div className="font-semibold">{r.user_name} <span className="text-xs font-normal text-slate-500">{r.unit_kerja} · {fmtDateTime(r.created_at)}</span></div>
            <div className="mt-1 text-slate-600 text-xs">{d.questions.map((q) => r.answers[q.id] !== undefined && r.answers[q.id] !== "" ? `${q.text.slice(0, 30)}: ${r.answers[q.id]}` : null).filter(Boolean).join(" · ")}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export const EvaluationManageDialog = ({ course, onOpenChange }) => {
  const [d, setD] = useState(null);
  const [qs, setQs] = useState([]);
  const [busy, setBusy] = useState(false);
  const load = () => api.get(`/webinars/${course.id}/evaluation-admin`).then((r) => { setD(r.data); setQs(r.data.questions); });
  useEffect(() => {
    if (course) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course]);

  const save = async (list) => {
    setBusy(true);
    try {
      await api.put(`/webinars/${course.id}/evaluation-questions`, { questions: list });
      toast.success(list.length ? "Pertanyaan evaluasi disimpan" : "Kembali memakai pertanyaan standar BKPSDM");
      load();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={!!course} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="evaluation-manage-dialog">
        <DialogHeader><DialogTitle>Evaluasi Webinar</DialogTitle><DialogDescription>{course?.title}</DialogDescription></DialogHeader>
        {!d ? <div className="text-slate-500">Memuat...</div> : (
          <Tabs defaultValue="questions">
            <TabsList><TabsTrigger value="questions" data-testid="eval-tab-questions">Pertanyaan</TabsTrigger><TabsTrigger value="results" data-testid="eval-tab-results">Hasil ({d.responses.length})</TabsTrigger></TabsList>
            <TabsContent value="questions" className="space-y-4 pt-3">
              <p className="text-xs text-slate-500">{d.custom ? "Webinar ini memakai pertanyaan khusus." : "Saat ini memakai pertanyaan standar BKPSDM. Ubah lalu simpan untuk membuat pertanyaan khusus webinar ini."}</p>
              <EvalQuestionsEditor value={qs} onChange={setQs} />
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => save(qs)} disabled={busy || !qs.length} className="bg-[#0F2942] hover:bg-[#0A1D30]" data-testid="eval-save-button">{busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Simpan Pertanyaan</Button>
                {d.custom && <Button variant="outline" onClick={() => save([])} disabled={busy} data-testid="eval-reset-button">Pakai Standar BKPSDM</Button>}
              </div>
            </TabsContent>
            <TabsContent value="results" className="pt-3"><Results d={d} /></TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
};
