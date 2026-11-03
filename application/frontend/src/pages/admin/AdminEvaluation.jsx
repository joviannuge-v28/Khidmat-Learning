import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common";
import { EvalQuestionsEditor } from "@/components/Evaluation";
import { api, errMsg } from "@/lib/api";

export default function AdminEvaluation() {
  const [qs, setQs] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api.get("/admin/eval-questions").then((r) => setQs(r.data));
  }, []);
  const save = async () => {
    setBusy(true);
    try {
      const { data } = await api.put("/admin/eval-questions", { questions: qs });
      setQs(data);
      toast.success("Pertanyaan evaluasi standar disimpan");
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="max-w-4xl">
      <PageHeader title="Evaluasi Webinar" subtitle="Pertanyaan standar BKPSDM untuk semua webinar. Pertanyaan khusus per webinar diatur dari tombol Evaluasi di Kelola Webinar (admin & PIC OPD)."
        action={<Button onClick={save} disabled={busy || !qs?.length} className="bg-[#0F2942] hover:bg-[#0A1D30]" data-testid="global-eval-save-button">{busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Simpan</Button>} />
      <section className="bg-white rounded-xl border border-slate-200 p-6">{qs ? <EvalQuestionsEditor value={qs} onChange={setQs} /> : "Memuat..."}</section>
    </div>
  );
}
