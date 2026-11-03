import { useEffect, useState } from "react";
import { CalendarClock, ClipboardCheck, Download, ExternalLink, Loader2, User, Users, Video } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader, EmptyState } from "@/components/common";
import { EvaluationDialog } from "@/components/Evaluation";
import { api, certUrl, downloadCert, errMsg, fileUrl, fmtDateTime } from "@/lib/api";
import { MaterialsList } from "@/components/MaterialsEditor";
import { useAuth } from "@/context/AuthContext";

const isOver = (z) => {
  if (!z.start_at) return false;
  const st = new Date(z.start_at.length <= 16 ? `${z.start_at}:00+07:00` : z.start_at);
  return Date.now() >= st.getTime() + (Number(z.duration_hours) || 1) * 45 * 60000;
};

function ZoomActions({ z, onEnroll, onEval, busy }) {
  const { user } = useAuth();
  const e = z.enrollment;
  if (user?.role === "pic") return <p className="text-xs text-slate-500" data-testid={`zoom-pic-note-${z.id}`}>Akun PIC hanya dapat melihat webinar.</p>;
  if (!e) return <Button onClick={onEnroll} disabled={busy} className="w-full bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold" data-testid={`zoom-register-${z.id}`}>{busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Daftar Webinar</Button>;
  const needEval = !z.evaluated && (e.status === "completed" || isOver(z));
  return (
    <div className="space-y-2">
      {needEval && <Button onClick={onEval} className="w-full bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold" data-testid={`zoom-eval-${z.id}`}><ClipboardCheck className="h-4 w-4 mr-2" />Isi Evaluasi Webinar</Button>}
      {e.status === "completed" ? (
        z.evaluated
          ? <Button asChild className="w-full bg-emerald-600 hover:bg-emerald-700" data-testid={`zoom-cert-${z.id}`}><a href={certUrl(e.id)} onClick={downloadCert}><Download className="h-4 w-4 mr-2" />Unduh Sertifikat</a></Button>
          : <p className="text-xs text-rose-700" data-testid={`zoom-cert-locked-${z.id}`}>Sertifikat terkunci sampai evaluasi webinar diisi.</p>
      ) : (
        <>
          {!isOver(z) && (z.zoom_url ? <Button asChild className="w-full bg-[#0F2942] hover:bg-[#0A1D30]" data-testid={`zoom-join-${z.id}`}><a href={z.zoom_url} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4 mr-2" />Gabung Zoom</a></Button> : <p className="text-xs text-slate-500">Tautan zoom belum tersedia.</p>)}
          {(z.meeting_id || z.passcode) && <p className="text-xs text-slate-600 font-mono">{[z.meeting_id && `ID: ${z.meeting_id}`, z.passcode && `Kode: ${z.passcode}`].filter(Boolean).join(" · ")}</p>}
          <p className="text-xs text-amber-700" data-testid={`zoom-waiting-${z.id}`}>Terdaftar. Sertifikat terbit setelah admin mengonfirmasi kehadiran dan evaluasi diisi.</p>
        </>
      )}
    </div>
  );
}

export default function Zoom() {
  const [items, setItems] = useState(null);
  const [busy, setBusy] = useState("");
  const [evalFor, setEvalFor] = useState(null);
  const load = () => api.get("/zoom").then((r) => setItems(r.data));
  useEffect(() => {
    load();
  }, []);

  const enroll = async (z) => {
    setBusy(z.id);
    try {
      await api.post(`/courses/${z.id}/enroll`);
      toast.success("Anda terdaftar di webinar ini. Pengingat akan muncul sebelum mulai.");
      load();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy("");
    }
  };

  return (
    <div>
      <PageHeader title="Webinar Zoom" subtitle="Daftar, ikuti webinar, isi evaluasi, lalu unduh sertifikat." />
      {items === null ? <div className="text-slate-500">Memuat...</div> : items.length === 0 ? (
        <EmptyState icon={Video} title="Belum ada webinar" text="Webinar zoom yang dijadwalkan akan tampil di sini." testid="zoom-empty" />
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-6" data-testid="zoom-grid">
          {items.map((z) => (
            <div key={z.id} className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden flex flex-col" data-testid={`zoom-card-${z.id}`}>
              <div className="aspect-[16/9] bg-gradient-to-br from-[#0F2942] to-blue-800 relative">
                {z.thumbnail && <img src={fileUrl(z.thumbnail)} alt={z.title} className="w-full h-full object-cover" />}
                <span className="absolute top-3 left-3 text-[11px] font-semibold bg-white/95 text-slate-800 px-2.5 py-1 rounded-full flex items-center gap-1"><Video className="h-3 w-3" />Webinar</span>
              </div>
              <div className="p-5 flex-1 flex flex-col">
                <h3 className="font-bold text-slate-900 leading-snug">{z.title}</h3>
                <div className="mt-3 space-y-1.5 text-xs text-slate-600">
                  <div className="flex items-center gap-2"><CalendarClock className="h-3.5 w-3.5" />{fmtDateTime(z.start_at)} · {z.duration_hours} JP</div>
                  <div className="flex items-center gap-2"><User className="h-3.5 w-3.5" />{z.instructor}</div>
                  <div className="flex items-center gap-2"><Users className="h-3.5 w-3.5" />{z.participants} peserta</div>
                </div>
                {z.description && <p className="mt-3 text-sm text-slate-600 line-clamp-3">{z.description}</p>}
                {z.enrollment && z.materials?.length > 0 && <div className="mt-4"><MaterialsList items={z.materials} title="Materi Webinar" testid={`zoom-materials-${z.id}`} /></div>}
                <div className="mt-auto pt-5"><ZoomActions z={z} busy={busy === z.id} onEnroll={() => enroll(z)} onEval={() => setEvalFor(z)} /></div>
              </div>
            </div>
          ))}
        </div>
      )}
      <EvaluationDialog course={evalFor} onOpenChange={() => setEvalFor(null)} onDone={load} />
    </div>
  );
}
