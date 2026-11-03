import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const CERT_DEFAULT = { template_path: "", number_format: "", number_start: 1, signer_name: "", signer_title: "", signature_path: "", text_color: "#0F172A", name_y: 52, show_qr: true };

export const CertificateConfigEditor = ({ value, onChange }) => {
  const v = { ...CERT_DEFAULT, ...(value || {}) };
  const set = (k, val) => onChange({ ...v, [k]: val });
  return (
    <div className="space-y-3" data-testid="certificate-config-editor">
      <p className="text-sm text-slate-500">Desain sertifikat seragam untuk semua kegiatan (diatur di menu Desain Sertifikat). Di sini hanya penomoran yang berbeda.</p>
      <div className="grid sm:grid-cols-[1fr_140px] gap-4">
        <div className="grid gap-2">
          <Label>Format Penomoran</Label>
          <Input value={v.number_format} onChange={(e) => set("number_format", e.target.value)} placeholder="{NO}/BKPSDM-DMI/{BULAN}/{TAHUN}" data-testid="cert-number-format-input" />
          <p className="text-xs text-slate-500">Kode: <code>{"{NO}"}</code> nomor urut (001), <code>{"{BULAN}"}</code> bulan romawi, <code>{"{TAHUN}"}</code> tahun. Kosong = LMSKD/TAHUN/00001.</p>
        </div>
        <div className="grid gap-2 content-start"><Label>Mulai dari No.</Label><Input type="number" min={1} value={v.number_start} onChange={(e) => set("number_start", e.target.value)} data-testid="cert-number-start-input" /></div>
      </div>
    </div>
  );
};
