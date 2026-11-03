import { CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileUpload } from "@/components/FileUpload";

const CFG = {
  video: { accept: "video/mp4,video/webm", placeholder: "Tempel tautan YouTube / Vimeo / Google Drive / MP4", hint: "Tempel tautan embed YouTube atau unggah video MP4/WebM (maks. 50 MB).", label: "Unggah Video" },
  pdf: { accept: ".pdf", placeholder: "Tempel tautan PDF", hint: "Tempel tautan PDF atau unggah file PDF (maks. 50 MB).", label: "Unggah PDF" },
};

export const MediaInput = ({ value, onChange, type = "video", testid }) => {
  const c = CFG[type];
  const uploaded = value && !value.startsWith("http");
  return (
    <div className="space-y-1.5">
      <div className="flex flex-col sm:flex-row gap-2">
        <Input value={uploaded ? "" : value} onChange={(e) => onChange(e.target.value)} placeholder={c.placeholder} className="bg-white" data-testid={`${testid}-url-input`} />
        <FileUpload accept={c.accept} label={c.label} testid={`${testid}-upload`} onUploaded={(p) => onChange(p)} />
      </div>
      {uploaded && (
        <div className="flex items-center gap-2 text-xs text-emerald-700" data-testid={`${testid}-uploaded`}>
          <CheckCircle2 className="h-4 w-4" />File terunggah
          <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-slate-500" onClick={() => onChange("")} data-testid={`${testid}-clear`}><X className="h-3.5 w-3.5 mr-1" />Hapus</Button>
        </div>
      )}
      <p className="text-xs text-slate-500">{c.hint}</p>
    </div>
  );
};
