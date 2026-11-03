import { useEffect, useState } from "react";
import { Brain, Loader2, Pencil, Plus, Trash2, Users, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader, EmptyState } from "@/components/common";
import { ConfirmDelete } from "@/pages/admin/ConfirmDelete";
import { api, errMsg, fmtDate } from "@/lib/api";

const LIKERT = ["Sangat Tidak Setuju", "Tidak Setuju", "Netral", "Setuju", "Sangat Setuju"];
const COLORS = ["#2563EB", "#059669", "#D97706", "#DB2777", "#7C3AED", "#0891B2"];
const tmpId = () => `tmp-${Math.random().toString(36).slice(2, 9)}`;
const BLANK = { title: "", description: "", published: true, dimensions: [], questions: [] };

function DimEditor({ dims, setDims }) {
  const upd = (i, k, v) => setDims(dims.map((d, j) => (j === i ? { ...d, [k]: v } : d)));
  return (
    <div className="space-y-3">
      {dims.map((d, i) => (
        <div key={d.id} className="p-3 rounded-lg border border-slate-200 bg-slate-50/60 space-y-2" data-testid={`psy-dim-editor-${i}`}>
          <div className="flex gap-2">
            <Input type="color" value={d.color} onChange={(e) => upd(i, "color", e.target.value)} className="w-14 h-10 p-1" />
            <Input value={d.name} onChange={(e) => upd(i, "name", e.target.value)} placeholder="Nama dimensi (mis. Ketelitian)" className="bg-white" data-testid={`psy-dim-name-${i}`} />
            <Button type="button" size="icon" variant="ghost" onClick={() => setDims(dims.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4 text-rose-600" /></Button>
          </div>
          <div className="grid sm:grid-cols-3 gap-2">
            {[["low_text", "Tafsiran skor rendah (<40%)"], ["mid_text", "Tafsiran sedang (40–69%)"], ["high_text", "Tafsiran tinggi (≥70%)"]].map(([k, p]) => (
              <Textarea key={k} rows={2} value={d[k] || ""} onChange={(e) => upd(i, k, e.target.value)} placeholder={p} className="bg-white text-xs" />
            ))}
          </div>
        </div>
      ))}
      <Button type="button" size="sm" variant="outline" onClick={() => setDims([...dims, { id: tmpId(), name: "", color: COLORS[dims.length % COLORS.length], low_text: "", mid_text: "", high_text: "" }])} data-testid="psy-add-dim"><Plus className="h-4 w-4 mr-1" />Tambah Dimensi</Button>
    </div>
  );
}

function QEditor({ q, i, dims, onChange, onRemove }) {
  const setOpt = (oi, v) => onChange({ ...q, options: q.options.map((o, k) => (k === oi ? { ...o, ...v } : o)) });
  const likert = (dimId) => onChange({ ...q, options: LIKERT.map((t, k) => ({ text: t, scores: { [dimId]: k + 1 } })) });
  return (
    <div className="p-4 rounded-lg border border-slate-200 bg-slate-50/60 space-y-3" data-testid={`psy-q-editor-${i}`}>
      <div className="flex gap-2">
        <span className="font-mono text-xs text-slate-400 pt-3 w-5">{i + 1}</span>
        <Textarea rows={2} value={q.text} onChange={(e) => onChange({ ...q, text: e.target.value })} placeholder="Pernyataan / pertanyaan" className="bg-white" data-testid={`psy-q-text-${i}`} />
        <Button type="button" size="icon" variant="ghost" onClick={onRemove}><Trash2 className="h-4 w-4 text-rose-600" /></Button>
      </div>
      <div className="flex flex-wrap gap-2 pl-7 items-center text-xs text-slate-500"><Wand2 className="h-3.5 w-3.5" />Isi cepat skala Likert (1–5) untuk:
        {dims.map((d) => <button key={d.id} type="button" onClick={() => likert(d.id)} className="px-2 py-1 rounded-full border border-slate-300 hover:bg-white" data-testid={`psy-q${i}-likert-${d.id}`}>{d.name || "?"}</button>)}
      </div>
      <div className="pl-7 overflow-x-auto">
        <table className="text-sm w-full">
          <thead><tr className="text-xs text-slate-500"><th className="text-left font-medium pb-1">Pilihan jawaban</th>{dims.map((d) => <th key={d.id} className="font-medium pb-1 px-1 whitespace-nowrap">{d.name || "?"}</th>)}<th /></tr></thead>
          <tbody>
            {q.options.map((o, oi) => (
              <tr key={oi}>
                <td className="pr-2 py-1 min-w-[180px]"><Input value={o.text} onChange={(e) => setOpt(oi, { text: e.target.value })} className="bg-white h-9" data-testid={`psy-q${i}-opt-${oi}`} /></td>
                {dims.map((d) => <td key={d.id} className="px-1"><Input type="number" value={o.scores[d.id] ?? ""} onChange={(e) => setOpt(oi, { scores: { ...o.scores, [d.id]: e.target.value === "" ? undefined : Number(e.target.value) } })} className="bg-white h-9 w-20" placeholder="0" /></td>)}
                <td>{q.options.length > 2 && <Button type="button" size="icon" variant="ghost" onClick={() => onChange({ ...q, options: q.options.filter((_, k) => k !== oi) })}><Trash2 className="h-3.5 w-3.5 text-slate-400" /></Button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <Button type="button" size="sm" variant="ghost" onClick={() => onChange({ ...q, options: [...q.options, { text: "", scores: {} }] })}><Plus className="h-4 w-4 mr-1" />Pilihan</Button>
      </div>
    </div>
  );
}

function TestDialog({ open, onOpenChange, initial, onSaved }) {
  const [f, setF] = useState(BLANK);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setF(initial ? JSON.parse(JSON.stringify(initial)) : BLANK);
  }, [open, initial]);
  const save = async () => {
    setBusy(true);
    try {
      const clean = (s) => Object.fromEntries(Object.entries(s).filter(([, v]) => v !== undefined && !Number.isNaN(v)));
      const body = { ...f, questions: f.questions.map((q) => ({ ...q, id: q.id?.startsWith("tmp-") ? null : q.id, options: q.options.map((o) => ({ ...o, scores: clean(o.scores) })) })) };
      if (initial?.id) await api.put(`/admin/psy-tests/${initial.id}`, body);
      else await api.post("/admin/psy-tests", body);
      toast.success("Tes disimpan");
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto" data-testid="psy-test-dialog">
        <DialogHeader><DialogTitle>{initial?.id ? "Ubah Tes" : "Tambah Tes Kepribadian"}</DialogTitle></DialogHeader>
        <div className="space-y-5">
          <div className="grid gap-2"><Label>Judul *</Label><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} data-testid="psy-title-input" /></div>
          <div className="grid gap-2"><Label>Deskripsi / Petunjuk</Label><Textarea rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
          <label className="flex items-center gap-3 text-sm"><Switch checked={f.published} onCheckedChange={(v) => setF({ ...f, published: v })} data-testid="psy-published-switch" />Terbitkan untuk pegawai</label>
          <div><h3 className="font-bold mb-2">Dimensi & Tafsiran Skor</h3><DimEditor dims={f.dimensions} setDims={(d) => setF({ ...f, dimensions: d })} /></div>
          <div className="space-y-3">
            <h3 className="font-bold">Soal ({f.questions.length})</h3>
            <p className="text-xs text-slate-500">Atur skor tiap pilihan untuk setiap dimensi. Persentase dimensi = total skor dipilih ÷ skor maksimum.</p>
            {f.questions.map((q, i) => <QEditor key={q.id} q={q} i={i} dims={f.dimensions} onChange={(v) => setF((x) => ({ ...x, questions: x.questions.map((y, k) => (k === i ? v : y)) }))} onRemove={() => setF((x) => ({ ...x, questions: x.questions.filter((_, k) => k !== i) }))} />)}
            <Button type="button" size="sm" variant="outline" onClick={() => setF({ ...f, questions: [...f.questions, { id: tmpId(), text: "", options: LIKERT.map((t) => ({ text: t, scores: {} })) }] })} data-testid="psy-add-question"><Plus className="h-4 w-4 mr-1" />Tambah Soal</Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={save} disabled={busy} className="bg-[#0F2942] hover:bg-[#0A1D30]" data-testid="psy-save-button">{busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Simpan</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResultsDialog({ test, onOpenChange }) {
  const [items, setItems] = useState([]);
  useEffect(() => {
    if (test) api.get(`/admin/psy-tests/${test.id}/results`).then((r) => setItems(r.data));
  }, [test]);
  return (
    <Dialog open={!!test} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto" data-testid="psy-results-dialog">
        <DialogHeader><DialogTitle>Hasil: {test?.title}</DialogTitle></DialogHeader>
        <Table>
          <TableHeader><TableRow><TableHead>Pegawai</TableHead><TableHead>Tanggal</TableHead><TableHead>Skor Dimensi</TableHead></TableRow></TableHeader>
          <TableBody>
            {items.length === 0 && <TableRow><TableCell colSpan={3} className="text-center text-slate-500 py-8">Belum ada hasil</TableCell></TableRow>}
            {items.map((r) => (
              <TableRow key={r.id}>
                <TableCell><div className="font-medium">{r.user_name}</div><div className="text-xs text-slate-500">{r.unit_kerja}</div></TableCell>
                <TableCell className="whitespace-nowrap text-sm">{fmtDate(r.created_at)}</TableCell>
                <TableCell className="text-xs">{r.dimensions.map((d) => `${d.name} ${d.percent}%`).join(" · ")}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminPsyTests() {
  const [items, setItems] = useState(null);
  const [form, setForm] = useState({ open: false, initial: null });
  const [del, setDel] = useState(null);
  const [res, setRes] = useState(null);
  const load = () => api.get("/admin/psy-tests").then((r) => setItems(r.data));
  useEffect(() => {
    load();
  }, []);
  const remove = async () => {
    await api.delete(`/admin/psy-tests/${del.id}`);
    toast.success("Tes dihapus");
    setDel(null);
    load();
  };
  return (
    <div>
      <PageHeader title="Tes Kepribadian" subtitle="Kelola soal, dimensi, dan pengaturan skor tes kepribadian pegawai."
        action={<Button onClick={() => setForm({ open: true, initial: null })} className="bg-[#0F2942] hover:bg-[#0A1D30]" data-testid="psy-add-test-button"><Plus className="h-4 w-4 mr-2" />Tambah Tes</Button>} />
      {items === null ? <div className="text-slate-500">Memuat...</div> : items.length === 0 ? <EmptyState icon={Brain} title="Belum ada tes" testid="admin-psy-empty" /> : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
          <Table data-testid="admin-psy-table">
            <TableHeader><TableRow><TableHead>Tes</TableHead><TableHead>Dimensi</TableHead><TableHead>Soal</TableHead><TableHead>Hasil</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Aksi</TableHead></TableRow></TableHeader>
            <TableBody>
              {items.map((t) => (
                <TableRow key={t.id} data-testid={`admin-psy-row-${t.id}`}>
                  <TableCell className="font-medium min-w-[200px]">{t.title}</TableCell>
                  <TableCell className="text-xs">{t.dimensions.map((d) => d.name).join(", ")}</TableCell>
                  <TableCell>{t.questions.length}</TableCell>
                  <TableCell>{t.result_count}</TableCell>
                  <TableCell>{t.published ? <span className="text-xs font-semibold text-emerald-700">Terbit</span> : <span className="text-xs text-slate-500">Draf</span>}</TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Button size="icon" variant="ghost" onClick={() => setRes(t)} data-testid={`admin-psy-results-${t.id}`}><Users className="h-4 w-4 text-blue-700" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => setForm({ open: true, initial: t })} data-testid={`admin-psy-edit-${t.id}`}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => setDel(t)} data-testid={`admin-psy-delete-${t.id}`}><Trash2 className="h-4 w-4 text-rose-600" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <TestDialog open={form.open} onOpenChange={(o) => setForm({ ...form, open: o })} initial={form.initial} onSaved={load} />
      <ResultsDialog test={res} onOpenChange={() => setRes(null)} />
      <ConfirmDelete open={!!del} onOpenChange={() => setDel(null)} title={`Hapus "${del?.title}"?`} onConfirm={remove} />
    </div>
  );
}
