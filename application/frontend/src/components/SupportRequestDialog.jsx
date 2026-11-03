import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api, errMsg } from "@/lib/api";

const CATS = ["Lupa kata sandi", "Akun terkunci", "Data akun salah", "Lainnya"];
const EMPTY = { name: "", nip: "", contact: "", whatsapp: "", category: CATS[0], message: "Mohon bantuan reset kata sandi akun saya." };

export const SupportRequestDialog = ({ open, onOpenChange }) => {
  const [f, setF] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (open) {
      setF(EMPTY);
      setSent(false);
    }
  }, [open]);

  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/support-requests", f);
      setSent(true);
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" data-testid="support-dialog">
        <DialogHeader>
          <DialogTitle>Lapor ke Administrator BKPSDM</DialogTitle>
          <DialogDescription>Laporan Anda masuk ke panel admin. Admin akan menghubungi melalui kontak yang Anda isi.</DialogDescription>
        </DialogHeader>
        {sent ? (
          <div className="py-6 text-center" data-testid="support-success">
            <CheckCircle2 className="h-12 w-12 text-emerald-600 mx-auto" />
            <p className="mt-3 font-semibold text-slate-900">Laporan terkirim</p>
            <p className="text-sm text-slate-500 mt-1">Silakan tunggu admin menghubungi Anda.</p>
            <Button className="mt-6" onClick={() => onOpenChange(false)} data-testid="support-close-button">Tutup</Button>
          </div>
        ) : (
          <form onSubmit={submit} className="grid gap-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>Nama Lengkap *</Label><Input required value={f.name} onChange={set("name")} data-testid="support-name-input" /></div>
              <div className="grid gap-2"><Label>NIP</Label><Input value={f.nip} onChange={set("nip")} data-testid="support-nip-input" /></div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>Nomor WhatsApp *</Label><Input required type="tel" pattern="\+?[0-9 \-]{9,16}" title="Contoh: 081234567890" value={f.whatsapp} onChange={set("whatsapp")} placeholder="081234567890" data-testid="support-whatsapp-input" /></div>
              <div className="grid gap-2"><Label>Email (opsional)</Label><Input value={f.contact} onChange={set("contact")} data-testid="support-contact-input" /></div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Jenis Laporan</Label>
                <Select value={f.category} onValueChange={(v) => setF({ ...f, category: v })}>
                  <SelectTrigger data-testid="support-category-select"><SelectValue /></SelectTrigger>
                  <SelectContent>{CATS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2"><Label>Pesan *</Label><Textarea required rows={4} value={f.message} onChange={set("message")} data-testid="support-message-input" /></div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Batal</Button>
              <Button type="submit" disabled={busy} className="bg-[#0F2942] hover:bg-[#0A1D30]" data-testid="support-submit-button">
                {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}Kirim Laporan
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};
