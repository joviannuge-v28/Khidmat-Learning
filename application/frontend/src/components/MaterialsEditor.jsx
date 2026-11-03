import { Download, FileText, Paperclip, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FileUpload } from "@/components/FileUpload";
import { downloadFromApi, errMsg } from "@/lib/api";

export const MATERIAL_ACCEPT = ".pdf,.ppt,.pptx,.doc,.docx,.png,.jpg,.jpeg";

export const MaterialsEditor = ({ value = [], onChange, testid = "materials", hint }) => (
  <div className="space-y-3" data-testid={testid}>
    <div className="flex flex-wrap items-center gap-3">
      <FileUpload multiple accept={MATERIAL_ACCEPT} label="Unggah File (bisa banyak)" testid={`${testid}-upload`}
        onUploaded={(path, name) => onChange((list) => [...(list || []), { path, name }])} />
      <span className="text-xs text-slate-500">{hint || "PDF, PPT/PPTX, Word, PNG/JPG · maks. 50 MB per file"}</span>
    </div>
    {value.length > 0 && (
      <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
        {value.map((m, i) => (
          <li key={m.path} className="flex items-center gap-3 px-3 py-2 text-sm" data-testid={`${testid}-item-${i}`}>
            <Paperclip className="h-4 w-4 text-slate-400 shrink-0" /><span className="flex-1 truncate">{m.name}</span>
            <Button type="button" size="icon" variant="ghost" onClick={() => onChange((list) => list.filter((_, j) => j !== i))} data-testid={`${testid}-remove-${i}`}><Trash2 className="h-4 w-4 text-rose-600" /></Button>
          </li>
        ))}
      </ul>
    )}
  </div>
);

export const MaterialsList = ({ items = [], title = "Materi untuk Diunduh", testid = "materials-list" }) => {
  if (!items.length) return null;
  const dl = (m) => downloadFromApi(`/files/${m.path}`, m.name).catch((e) => toast.error(errMsg(e, "Gagal mengunduh file")));
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4" data-testid={testid}>
      <div className="text-sm font-bold text-slate-900 mb-2 flex items-center gap-2"><FileText className="h-4 w-4 text-amber-600" />{title} ({items.length})</div>
      <ul className="space-y-1.5">
        {items.map((m, i) => (
          <li key={m.path}>
            <button type="button" onClick={() => dl(m)} className="w-full flex items-center gap-2 text-left text-sm text-blue-700 hover:underline" data-testid={`${testid}-download-${i}`}>
              <Download className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{m.name}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};
