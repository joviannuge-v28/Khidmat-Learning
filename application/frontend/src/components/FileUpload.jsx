import { useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { uploadFile, errMsg } from "@/lib/api";

export const FileUpload = ({ accept, kind = "private", onUploaded, label = "Unggah File", testid, variant = "outline", maxMB = 50, multiple = false }) => {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);

  const onChange = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setBusy(true);
    try {
      for (const f of files) {
        if (f.size > maxMB * 1024 * 1024) {
          toast.error(`${f.name}: ukuran file maksimal ${maxMB} MB`);
          continue;
        }
        try {
          const res = await uploadFile(f, kind);
          onUploaded(res.path, res.name);
          toast.success(`${f.name} berhasil diunggah`);
        } catch (err) {
          toast.error(`${f.name}: ${errMsg(err, "Gagal mengunggah file")}`);
        }
      }
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  };

  return (
    <>
      <input ref={ref} type="file" multiple={multiple} accept={accept} className="hidden" onChange={onChange} data-testid={`${testid}-input`} />
      <Button type="button" variant={variant} size="sm" disabled={busy} onClick={() => ref.current?.click()} data-testid={testid}>
        {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
        {busy ? "Mengunggah..." : label}
      </Button>
    </>
  );
};
