import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowDown, ArrowLeft, ArrowUp, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileUpload } from "@/components/FileUpload";
import { MediaInput } from "@/components/MediaInput";
import { MaterialsEditor } from "@/components/MaterialsEditor";
import { SignerSelect } from "@/components/SignerSelect";
import { CertificateConfigEditor, CERT_DEFAULT } from "@/components/CertificateConfigEditor";
import { DateTimePicker } from "@/components/DateTimePicker";
import { api, errMsg, fileUrl } from "@/lib/api";

const BLANK = { title: "", description: "", category_id: "", thumbnail: "", level: "Dasar", duration_hours: 2, instructor: "", passing_score: 70, published: true, modules: [], questions: [], kind: "course", certificate: CERT_DEFAULT, start_at: "", materials: [], signer_id: "" };

const move = (arr, i, d) => {
  const a = [...arr];
  const j = i + d;
  if (j < 0 || j >= a.length) return a;
  [a[i], a[j]] = [a[j], a[i]];
  return a;
};

function ModuleEditor({ m, i, n, onChange, onMove, onRemove }) {
  const set = (k, v) => onChange({ ...m, [k]: v });
  return (
    <div className="p-4 rounded-lg border border-slate-200 bg-slate-50/60 space-y-3" data-testid={`module-editor-${i}`}>
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs text-slate-400 w-5">{i + 1}</span>
        <Input value={m.title} onChange={(e) => set("title", e.target.value)} placeholder="Judul materi" className="bg-white" data-testid={`module-title-input-${i}`} />
        <Button type="button" size="icon" variant="ghost" onClick={() => onMove(-1)} disabled={i === 0}><ArrowUp className="h-4 w-4" /></Button>
        <Button type="button" size="icon" variant="ghost" onClick={() => onMove(1)} disabled={i === n - 1}><ArrowDown className="h-4 w-4" /></Button>
        <Button type="button" size="icon" variant="ghost" onClick={onRemove} data-testid={`module-remove-${i}`}><Trash2 className="h-4 w-4 text-rose-600" /></Button>
      </div>
      <div className="grid sm:grid-cols-[160px_1fr_110px] gap-3 items-start">
        <Select value={m.type} onValueChange={(v) => set("type", v)}>
          <SelectTrigger className="bg-white" data-testid={`module-type-select-${i}`}><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="text">Teks</SelectItem><SelectItem value="video">Video (unggah / YouTube)</SelectItem><SelectItem value="pdf">PDF (unggah / tautan)</SelectItem></SelectContent>
        </Select>
        {m.type !== "text" ? (
          <MediaInput type={m.type} value={m.url} onChange={(v) => set("url", v)} testid={`module-${i}`} />
        ) : <div />}
        <Input type="number" value={m.duration_min} onChange={(e) => set("duration_min", Number(e.target.value))} className="bg-white" title="Durasi (menit)" />
      </div>
      <Textarea rows={3} value={m.body} onChange={(e) => set("body", e.target.value)} placeholder="Isi / keterangan materi" className="bg-white" data-testid={`module-body-input-${i}`} />
    </div>
  );
}

function QuestionEditor({ q, i, onChange, onRemove }) {
  const setOpt = (oi, v) => onChange({ ...q, options: q.options.map((o, k) => (k === oi ? v : o)) });
  const removeOpt = (oi) => {
    const options = q.options.filter((_, k) => k !== oi);
    const answer_index = q.answer_index === oi ? 0 : q.answer_index > oi ? q.answer_index - 1 : q.answer_index;
    onChange({ ...q, options, answer_index });
  };
  return (
    <div className="p-4 rounded-lg border border-slate-200 bg-slate-50/60 space-y-3" data-testid={`question-editor-${i}`}>
      <div className="flex items-start gap-2">
        <span className="font-mono text-xs text-slate-400 w-5 pt-3">{i + 1}</span>
        <Textarea rows={2} value={q.question} onChange={(e) => onChange({ ...q, question: e.target.value })} placeholder="Pertanyaan" className="bg-white" data-testid={`question-text-input-${i}`} />
        <Button type="button" size="icon" variant="ghost" onClick={onRemove} data-testid={`question-remove-${i}`}><Trash2 className="h-4 w-4 text-rose-600" /></Button>
      </div>
      <div className="grid sm:grid-cols-2 gap-2 pl-7">
        {q.options.map((o, oi) => (
          <div key={oi} className="flex items-center gap-2">
            <input type="radio" name={`ans-${i}`} checked={q.answer_index === oi} onChange={() => onChange({ ...q, answer_index: oi })} className="accent-emerald-600 h-4 w-4" title="Jawaban benar" data-testid={`question-${i}-answer-${oi}`} />
            <Input value={o} onChange={(e) => setOpt(oi, e.target.value)} placeholder={`Pilihan ${String.fromCharCode(65 + oi)}`} className="bg-white" data-testid={`question-${i}-option-${oi}`} />
            {q.options.length > 2 && <Button type="button" size="icon" variant="ghost" onClick={() => removeOpt(oi)} data-testid={`question-${i}-remove-option-${oi}`}><Trash2 className="h-3.5 w-3.5 text-slate-400" /></Button>}
          </div>
        ))}
      </div>
      {q.options.length < 6 && <Button type="button" size="sm" variant="ghost" className="ml-7" onClick={() => onChange({ ...q, options: [...q.options, ""] })} data-testid={`question-${i}-add-option`}><Plus className="h-4 w-4 mr-1" />Tambah Pilihan</Button>}
      <p className="pl-7 text-xs text-slate-500">Pilih tombol bulat di samping jawaban yang benar.</p>
    </div>
  );
}

export default function AdminCourseEditor({ propose = false }) {
  const { id } = useParams();
  const isNew = !id;
  const navigate = useNavigate();
  const [f, setF] = useState(BLANK);
  const [cats, setCats] = useState([]);
  const [busy, setBusy] = useState(false);
  const back = propose ? "/usulan" : "/admin/pelatihan";
  const setStart = (v) => setF((x) => ({ ...x, start_at: v }));

  useEffect(() => {
    api.get("/categories?type=course").then((r) => setCats(r.data));
    if (!isNew) api.get(propose ? `/proposals/${id}` : `/admin/courses/${id}`).then((r) => setF({ ...BLANK, ...r.data, certificate: { ...CERT_DEFAULT, ...(r.data.certificate || {}) } }));
  }, [id, isNew, propose]);

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const save = async () => {
    if (!f.title.trim()) return toast.error("Judul wajib diisi");
    if (!f.instructor.trim()) return toast.error("Nama pengajar / narasumber wajib diisi");
    if (f.questions.some((q) => !q.question.trim() || q.options.some((o) => !o.trim()))) return toast.error("Lengkapi semua pertanyaan dan pilihan jawaban");
    setBusy(true);
    try {
      const cert = { ...f.certificate, number_start: Number(f.certificate.number_start) || 1 };
      const body = { ...f, kind: "course", certificate: cert, duration_hours: Number(f.duration_hours), passing_score: Number(f.passing_score) };
      const base = propose ? "/proposals" : "/admin/courses";
      if (isNew) await api.post(base, body);
      else await api.put(`${base}/${id}`, body);
      toast.success(propose ? "Usulan pelatihan terkirim, menunggu persetujuan admin LMS" : "Pelatihan disimpan");
      navigate(back);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const addModule = () => setF({ ...f, modules: [...f.modules, { title: "", type: "text", url: "", body: "", duration_min: 10 }] });
  const addQuestion = () => setF({ ...f, questions: [...f.questions, { question: "", options: ["", "", "", ""], answer_index: 0 }] });

  return (
    <div className="max-w-5xl space-y-6">
      <Link to={back} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"><ArrowLeft className="h-4 w-4" />{propose ? "Usulan OPD" : "Kelola Pelatihan"}</Link>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">{propose ? (isNew ? "Usulkan Pelatihan" : "Ubah Usulan Pelatihan") : isNew ? "Tambah Pelatihan" : "Ubah Pelatihan"}</h1>
        <Button onClick={save} disabled={busy} className="bg-[#0F2942] hover:bg-[#0A1D30]" data-testid="course-save-button">{busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}{propose ? "Kirim Usulan" : "Simpan"}</Button>
      </div>
      {propose && <p className="text-sm text-slate-600 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3" data-testid="proposal-info">Usulan akan ditinjau admin LMS sebelum tampil di Daftar Pelatihan.{f.review_note && <> Catatan admin: <b>{f.review_note}</b></>}</p>}

      <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <h2 className="font-bold">Informasi Umum</h2>
        <div className="grid gap-2"><Label>Judul *</Label><Input value={f.title} onChange={set("title")} data-testid="course-title-input" /></div>
        <div className="grid gap-2"><Label>Deskripsi</Label><Textarea rows={4} value={f.description} onChange={set("description")} data-testid="course-description-input" /></div>
        <div className="grid sm:grid-cols-3 gap-4">
          <div className="grid gap-2">
            <Label>Kategori</Label>
            <Select value={f.category_id || undefined} onValueChange={(v) => setF({ ...f, category_id: v })}>
              <SelectTrigger data-testid="course-category-select"><SelectValue placeholder="Pilih" /></SelectTrigger>
              <SelectContent>{cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Tingkat</Label>
            <Select value={f.level} onValueChange={(v) => setF({ ...f, level: v })}>
              <SelectTrigger data-testid="course-level-select"><SelectValue /></SelectTrigger>
              <SelectContent>{["Dasar", "Menengah", "Lanjutan"].map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid gap-2"><Label>Pengajar / Narasumber *</Label><Input value={f.instructor} onChange={set("instructor")} placeholder="Contoh: Dinas Kominfo Kota Dumai" data-testid="course-instructor-input" /></div>
          <div className="grid gap-2"><Label>Durasi (JP)</Label><Input type="number" value={f.duration_hours} onChange={set("duration_hours")} data-testid="course-duration-input" /></div>
          <div className="grid gap-2"><Label>Nilai Minimal Lulus</Label><Input type="number" value={f.passing_score} onChange={set("passing_score")} data-testid="course-passing-input" /></div>
          {!propose && <div className="flex items-center gap-3 pt-7"><Switch checked={f.published} onCheckedChange={(v) => setF({ ...f, published: v })} data-testid="course-published-switch" /><Label>Terbitkan</Label></div>}
        </div>
        <div className="grid gap-2 sm:max-w-md">
          <Label>Jadwal Mulai (opsional, untuk notifikasi peserta)</Label>
          <div className="flex gap-2 items-center"><div className="flex-1"><DateTimePicker value={f.start_at} onChange={setStart} testid="course-start" /></div>{f.start_at && <Button type="button" size="sm" variant="ghost" onClick={() => setStart("")}>Hapus</Button>}</div>
        </div>
        <div className="flex items-center gap-4">
          {f.thumbnail ? <img src={fileUrl(f.thumbnail)} alt="" className="h-20 w-32 object-cover rounded-lg" /> : <div className="h-20 w-32 rounded-lg bg-slate-100" />}
          <FileUpload accept="image/*" label="Unggah Gambar Sampul" testid="course-thumbnail-upload" onUploaded={(p) => setF((x) => ({ ...x, thumbnail: p }))} />
        </div>
      </section>

      <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <div className="flex items-center justify-between"><h2 className="font-bold">Materi ({f.modules.length})</h2><Button type="button" size="sm" variant="outline" onClick={addModule} data-testid="add-module-button"><Plus className="h-4 w-4 mr-1" />Tambah Materi</Button></div>
        {f.modules.map((m, i) => (
          <ModuleEditor key={m.id || `new-${i}`} m={m} i={i} n={f.modules.length}
            onChange={(v) => setF((x) => ({ ...x, modules: x.modules.map((y, k) => (k === i ? v : y)) }))}
            onMove={(d) => setF((x) => ({ ...x, modules: move(x.modules, i, d) }))}
            onRemove={() => setF((x) => ({ ...x, modules: x.modules.filter((_, k) => k !== i) }))} />
        ))}
      </section>

      <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <h2 className="font-bold">File Pendukung ({(f.materials || []).length})</h2>
        <p className="text-sm text-slate-500 -mt-2">Unggah PPTX, PDF, Word, PNG/JPG sekaligus (multiple). Peserta dapat mengunduhnya di halaman pelatihan.</p>
        <MaterialsEditor value={f.materials || []} onChange={(fn) => setF((x) => ({ ...x, materials: fn(x.materials || []) }))} testid="course-materials" />
      </section>

      <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <div className="flex items-center justify-between"><h2 className="font-bold">Kuis Akhir ({f.questions.length} soal)</h2><Button type="button" size="sm" variant="outline" onClick={addQuestion} data-testid="add-question-button"><Plus className="h-4 w-4 mr-1" />Tambah Soal</Button></div>
        {f.questions.length === 0 && <p className="text-sm text-slate-500">Tanpa kuis, sertifikat terbit setelah semua materi selesai.</p>}
        {f.questions.length > 0 && <p className="text-xs text-slate-500">Urutan soal dan pilihan jawaban diacak otomatis untuk setiap peserta.</p>}
        {f.questions.map((q, i) => (
          <QuestionEditor key={q.id || `nq-${i}`} q={q} i={i}
            onChange={(v) => setF((x) => ({ ...x, questions: x.questions.map((y, k) => (k === i ? v : y)) }))}
            onRemove={() => setF((x) => ({ ...x, questions: x.questions.filter((_, k) => k !== i) }))} />
        ))}
      </section>

      <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <h2 className="font-bold">Penandatangan Sertifikat</h2>
        <SignerSelect value={f.signer_id} onChange={(v) => setF((x) => ({ ...x, signer_id: v }))} testid="course-signer-select" />
      </section>

      {!propose && (
        <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <h2 className="font-bold">Penomoran Sertifikat</h2>
          <CertificateConfigEditor value={f.certificate} onChange={(v) => setF((x) => ({ ...x, certificate: v }))} />
        </section>
      )}
    </div>
  );
}
