import { useEffect, useState } from "react";
import { Loader2, MailCheck, Save, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/common";
import { api, errMsg } from "@/lib/api";

const FIELDS = [["host", "Host SMTP", "smtp.domain.go.id"], ["port", "Port", "587"], ["username", "Username", ""], ["from_email", "Email Pengirim", "noreply@domain.go.id"], ["from_name", "Nama Pengirim", ""]];

export default function AdminSmtp() {
  const [f, setF] = useState(null);
  const [busy, setBusy] = useState("");
  const [to, setTo] = useState("");
  useEffect(() => {
    api.get("/admin/smtp").then((r) => setF(r.data));
  }, []);
  if (!f) return <div className="text-slate-500">Memuat...</div>;
  const run = async (key, fn) => {
    setBusy(key);
    try { await fn(); } catch (e) { toast.error(errMsg(e)); } finally { setBusy(""); }
  };
  const save = () => run("save", async () => {
    const { data } = await api.put("/admin/smtp", { ...f, port: Number(f.port) || 587 });
    setF(data);
    toast.success("Konfigurasi SMTP disimpan");
  });
  const test = () => run("test", async () => {
    await api.post("/admin/smtp/test", { to });
    toast.success(`Email uji terkirim ke ${to}`);
  });
  const configured = f.enabled && f.host && f.from_email;
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Konfigurasi SMTP" subtitle="Server email untuk verifikasi akun. Dikelola khusus Super Admin." />
      <div className={`p-4 rounded-xl border text-sm ${configured ? "bg-emerald-50 border-emerald-200 text-emerald-800" : "bg-amber-50 border-amber-200 text-amber-800"}`} data-testid="smtp-status">
        {configured ? "SMTP aktif — pengguna dapat memverifikasi email." : "SMTP belum dikonfigurasi — pengguna akan melihat pemberitahuan \"Verifikasi belum bisa digunakan\"."}
      </div>
      <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          {FIELDS.map(([k, label, ph]) => (
            <div key={k} className="grid gap-2"><Label>{label}</Label><Input value={f[k] ?? ""} placeholder={ph} onChange={(e) => setF({ ...f, [k]: e.target.value })} data-testid={`smtp-${k}-input`} /></div>
          ))}
          <div className="grid gap-2"><Label>Kata Sandi {f.has_password && <span className="text-xs text-emerald-700">(tersimpan, kosongkan jika tidak diubah)</span>}</Label><Input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} autoComplete="new-password" data-testid="smtp-password-input" /></div>
          <div className="grid gap-2">
            <Label>Keamanan</Label>
            <Select value={f.security} onValueChange={(v) => setF({ ...f, security: v })}>
              <SelectTrigger data-testid="smtp-security-select"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="starttls">STARTTLS (port 587)</SelectItem><SelectItem value="ssl">SSL/TLS (port 465)</SelectItem><SelectItem value="none">Tanpa enkripsi</SelectItem></SelectContent>
            </Select>
          </div>
        </div>
        <label className="flex items-center gap-3 text-sm"><Switch checked={f.enabled} onCheckedChange={(v) => setF({ ...f, enabled: v })} data-testid="smtp-enabled-switch" />Aktifkan pengiriman email</label>
        <Button onClick={save} disabled={!!busy} className="bg-[#0F2942] hover:bg-[#0A1D30]" data-testid="smtp-save-button">{busy === "save" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}Simpan</Button>
      </section>
      <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-3">
        <h2 className="font-bold flex items-center gap-2"><MailCheck className="h-4 w-4 text-blue-700" />Kirim Email Uji</h2>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="email.tujuan@domain.go.id" data-testid="smtp-test-to-input" />
          <Button variant="outline" onClick={test} disabled={!!busy || !to} data-testid="smtp-test-button">{busy === "test" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}Kirim Uji</Button>
        </div>
      </section>
    </div>
  );
}
