import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, ImageUp, Loader2, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Html5Qrcode } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, errMsg } from "@/lib/api";

const idFromQr = (text) => /\/verifikasi\/([\w-]+)/.exec(text)?.[1];

export const CertVerifyBox = () => {
  const navigate = useNavigate();
  const [no, setNo] = useState("");
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const scanner = useRef(null);
  const fileRef = useRef(null);

  const byNumber = async (value) => {
    if (!value.trim()) return;
    setBusy(true);
    try {
      const { data } = await api.get("/verify-number", { params: { no: value.trim() } });
      navigate(`/verifikasi/${data.id}`);
    } catch (e) {
      toast.error(errMsg(e, "Nomor sertifikat tidak ditemukan"));
    } finally {
      setBusy(false);
    }
  };
  const handle = (text) => {
    const id = idFromQr(text);
    if (id) navigate(`/verifikasi/${id}`);
    else byNumber(text);
  };
  const stop = async () => {
    try { await scanner.current?.stop(); } catch (e) { /* already stopped */ }
    scanner.current = null;
    setScanning(false);
  };
  useEffect(() => () => { scanner.current?.stop().catch(() => {}); }, []);

  const start = async () => {
    setScanning(true);
    await new Promise((r) => setTimeout(r, 50));
    try {
      scanner.current = new Html5Qrcode("qr-reader");
      await scanner.current.start({ facingMode: "environment" }, { fps: 10, qrbox: 220 }, (text) => { stop(); handle(text); }, () => {});
    } catch (e) {
      toast.error("Kamera tidak dapat dibuka. Gunakan unggah gambar QR atau ketik nomor sertifikat.");
      setScanning(false);
    }
  };
  const fromFile = async (ev) => {
    const f = ev.target.files?.[0];
    ev.target.value = "";
    if (!f) return;
    try {
      const s = new Html5Qrcode("qr-file-reader");
      const text = await s.scanFile(f, false);
      handle(text);
    } catch (e) {
      toast.error("Kode QR tidak terbaca dari gambar");
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm max-w-2xl" data-testid="cert-verify-box">
      <form onSubmit={(e) => { e.preventDefault(); byNumber(no); }} className="flex flex-col sm:flex-row gap-3">
        <Input value={no} onChange={(e) => setNo(e.target.value)} placeholder="Ketik nomor sertifikat, mis. 001/BKPSDM-DMI/X/2026" className="h-12" data-testid="verify-number-input" />
        <Button type="submit" disabled={busy} className="h-12 bg-[#0F2942] hover:bg-[#0A1D30]" data-testid="verify-number-button">{busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}Cek</Button>
      </form>
      <div className="mt-4 flex flex-wrap gap-2">
        {!scanning ? <Button variant="outline" onClick={start} data-testid="verify-scan-button"><Camera className="h-4 w-4 mr-2" />Pindai QR dengan Kamera</Button>
          : <Button variant="outline" onClick={stop} data-testid="verify-scan-stop"><X className="h-4 w-4 mr-2" />Tutup Kamera</Button>}
        <Button variant="ghost" onClick={() => fileRef.current?.click()} data-testid="verify-upload-qr-button"><ImageUp className="h-4 w-4 mr-2" />Unggah Gambar QR</Button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={fromFile} data-testid="verify-upload-qr-input" />
      </div>
      {scanning && <div id="qr-reader" className="mt-4 w-full max-w-sm rounded-lg overflow-hidden" data-testid="qr-reader" />}
      <div id="qr-file-reader" className="hidden" />
    </div>
  );
};
