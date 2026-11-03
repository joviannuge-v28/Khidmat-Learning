import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { ClipboardList, KeyRound, LifeBuoy, Loader2, LogIn, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Brand } from "@/components/common";
import { LandingSections } from "@/components/LandingSections";
import { SupportRequestDialog } from "@/components/SupportRequestDialog";
import { useAuth } from "@/context/AuthContext";
import { api, errMsg } from "@/lib/api";
import { landingOf } from "@/lib/landing";
import { CoverSlider } from "@/components/CoverSlider";

const ADMIN_ROLES = ["admin", "superadmin"];
const NAV = [["sambutan", "Sambutan"], ["tentang-kami", "Tentang Kami"], ["tentang", "Tentang LMS"], ["fitur", "Fitur"], ["cek-sertifikat", "Cek Sertifikat"], ["kms", "KMS"], ["zoom", "Webinar Zoom"], ["bantuan", "Bantuan"], ["statistik", "Statistik"]];

const trackVisit = () => {
  let id = localStorage.getItem("lms_visitor");
  if (!id) {
    id = (window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`).replace(/[^a-zA-Z0-9-]/g, "");
    localStorage.setItem("lms_visitor", id);
  }
  api.post("/public/visit", { visitor_id: id }).catch(() => {});
};
const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

function TopBar() {
  return (
    <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200" data-testid="login-topbar">
      <div className="h-16 px-4 lg:px-10 flex items-center justify-between gap-4">
        <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} data-testid="topbar-brand"><Brand /></button>
        <nav className="hidden md:flex items-center gap-1">
          {NAV.map(([id, label]) => (
            <button key={id} onClick={() => scrollTo(id)} className="px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors" data-testid={`topbar-nav-${id}`}>{label}</button>
          ))}
          <Link to="/survei" className="ml-1 inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors" data-testid="topbar-nav-survei"><ClipboardList className="h-4 w-4" />Survei Kepuasan</Link>
        </nav>
        <Button size="sm" onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="bg-[#0F2942] hover:bg-[#0A1D30]" data-testid="topbar-login-button"><LogIn className="h-4 w-4 mr-1.5" />Masuk</Button>
      </div>
      <nav className="md:hidden flex gap-1 overflow-x-auto px-3 pb-2 -mt-1">
        {NAV.map(([id, label]) => (
          <button key={id} onClick={() => scrollTo(id)} className="shrink-0 px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 rounded-full" data-testid={`topbar-mobile-nav-${id}`}>{label}</button>
        ))}
        <Link to="/survei" className="shrink-0 px-3 py-1.5 text-xs font-semibold text-amber-800 bg-amber-100 rounded-full" data-testid="topbar-mobile-nav-survei">Survei Kepuasan</Link>
      </nav>
    </header>
  );
}

export default function Login() {
  const { user, login, settings } = useAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [report, setReport] = useState(false);
  useEffect(() => {
    trackVisit();
  }, []);

  if (user) return <Navigate to={ADMIN_ROLES.includes(user.role) ? "/admin" : "/"} replace />;
  const L = landingOf(settings);
  const slides = (L.cover_slides || []).filter(Boolean).length ? L.cover_slides.filter(Boolean) : [settings?.cover_path || "/img/cover.jpg"];

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const u = await login(identifier, password);
      toast.success(`Selamat datang, ${u.name}!`, { description: "Anda berhasil masuk ke LMS Khidmat Kota Dumai.", className: "welcome-toast", duration: 5000 });
      if (u.must_change_password || (u.require_photo && !u.photo)) {
        toast.info("Akun baru: lengkapi profil, unggah foto, dan ganti kata sandi terlebih dahulu.");
        navigate("/profil");
      } else navigate(ADMIN_ROLES.includes(u.role) ? "/admin" : "/");
    } catch (err) {
      setError(errMsg(err));
      toast.error("Gagal masuk", { description: errMsg(err), className: "login-error-toast" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <TopBar />
      <section id="masuk" className="grid lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:min-h-[calc(100vh-4rem)]">
        <div className="p-4 lg:p-6">
          <div className="relative w-full h-64 sm:h-96 lg:h-full lg:min-h-[calc(100vh-7rem)] rounded-2xl overflow-hidden shadow-xl fade-up" data-testid="login-cover">
            <CoverSlider slides={slides} interval={L.slide_interval} />
            <div className="hidden lg:block absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#0B1E33]/90 to-transparent" />
            <div className="hidden lg:block absolute bottom-0 p-6 lg:p-12 text-white">
              <div className="text-xs uppercase tracking-[0.25em] text-amber-400 font-semibold">Pemerintah Kota Dumai</div>
              <p className="mt-2 text-lg lg:text-3xl font-bold leading-snug max-w-xl">{settings?.tagline}</p>
            </div>
          </div>
        </div>

        <div className="px-6 py-10 lg:p-16 flex items-center justify-center">
          <div className="w-full max-w-md fade-up" style={{ animationDelay: "120ms" }}>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900">Masuk ke akun Anda</h1>
            <p className="mt-2 text-slate-500">Gunakan NIP atau email dan kata sandi yang terdaftar.</p>

            <form onSubmit={submit} className="mt-8 space-y-5" data-testid="login-form">
              <div className="space-y-2">
                <Label htmlFor="identifier">NIP / Email</Label>
                <Input id="identifier" value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="Contoh: 198504122010011002" className="h-12 bg-white" required data-testid="login-nip-input" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Kata Sandi</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="h-12 bg-white" required data-testid="login-password-input" />
              </div>
              {error && <div className="text-sm font-semibold text-white bg-rose-600 border border-rose-700 rounded-lg px-3 py-2.5" role="alert" data-testid="login-error">{error}</div>}
              <Button type="submit" disabled={busy} className="w-full h-12 bg-[#0F2942] hover:bg-[#0A1D30] text-base" data-testid="login-submit-button">
                {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <LogIn className="h-4 w-4 mr-2" />} Masuk
              </Button>
            </form>

            <div className="my-6 flex items-center gap-3 text-xs text-slate-400"><div className="h-px flex-1 bg-slate-200" />ATAU<div className="h-px flex-1 bg-slate-200" /></div>
            <Button variant="outline" className="w-full h-12" onClick={() => toast.info("SSO Pemkot Dumai belum disambungkan. Gunakan login NIP/email untuk sementara.")} data-testid="login-sso-button">
              <ShieldCheck className="h-4 w-4 mr-2 text-amber-600" /> Masuk dengan SSO Pemkot Dumai
            </Button>
            <div className="mt-6 p-4 rounded-xl bg-amber-50 border border-amber-200 text-sm text-slate-700 flex items-start gap-3">
              <KeyRound className="h-4 w-4 shrink-0 mt-0.5 text-amber-700" />
              <div>
                Lupa kata sandi?{" "}
                <button type="button" onClick={() => setReport(true)} className="font-semibold text-blue-700 underline underline-offset-2 hover:text-blue-900" data-testid="login-forgot-link">Hubungi administrator BKPSDM</button>{" "}
                untuk reset akun.
                <button type="button" onClick={() => scrollTo("cek-sertifikat")} className="block mt-2 font-semibold text-blue-700 underline underline-offset-2" data-testid="login-verify-link">Cek keaslian sertifikat</button>
                <Button type="button" size="sm" variant="outline" onClick={() => setReport(true)} className="mt-3 flex bg-white" data-testid="login-report-button"><LifeBuoy className="h-4 w-4 mr-2" />Lapor Admin</Button>
              </div>
            </div>
          </div>
        </div>
      </section>
      <LandingSections settings={settings} onReport={() => setReport(true)} />
      <SupportRequestDialog open={report} onOpenChange={setReport} />
    </div>
  );
}
