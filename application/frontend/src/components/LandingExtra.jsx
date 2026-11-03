import { useEffect, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BookOpenCheck, Compass, ExternalLink, Eye, Facebook, Globe, Instagram, MapPin, Scale, Target, TrendingUp, UserRound } from "lucide-react";
import { api, fileUrl, fmtDateTime } from "@/lib/api";

const Wrap = ({ id, className = "", children }) => (
  <section id={id} className={`scroll-mt-20 px-6 lg:px-16 py-20 lg:py-24 ${className}`} data-testid={`landing-section-${id}`}>
    <div className="max-w-6xl mx-auto">{children}</div>
  </section>
);
const Eyebrow = ({ children }) => <div className="text-xs uppercase tracking-[0.25em] font-semibold text-amber-600">{children}</div>;

export const WelcomeOfficials = ({ L }) => (
  <Wrap id="sambutan" className="bg-white">
    <div className="grid lg:grid-cols-[1fr_1.2fr] gap-12 items-center">
      <div>
        <Eyebrow>Kata Sambutan</Eyebrow>
        <h2 className="mt-3 text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">{L.welcome_title}</h2>
        <p className="mt-6 text-slate-600 leading-relaxed whitespace-pre-line" data-testid="landing-welcome-speech">{L.welcome_speech}</p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
        {L.officials.map((o, i) => (
          <figure key={i} className="text-center" data-testid={`landing-official-${i}`}>
            <div className="mx-auto h-28 w-28 sm:h-32 sm:w-32 rounded-full overflow-hidden ring-4 ring-amber-400/70 ring-offset-4 bg-slate-100 grid place-items-center">
              {o.photo ? <img src={fileUrl(o.photo)} alt={o.name} className="h-full w-full object-cover" /> : <UserRound className="h-12 w-12 text-slate-300" />}
            </div>
            <figcaption className="mt-4"><div className="text-sm font-bold text-slate-900 leading-snug">{o.name}</div><div className="text-xs text-slate-500 mt-1">{o.title}</div></figcaption>
          </figure>
        ))}
      </div>
    </div>
  </Wrap>
);

const Pillar = ({ icon: Icon, title, children, testid }) => (
  <div className="p-6 rounded-xl border border-slate-200 bg-white" data-testid={testid}>
    <div className="flex items-center gap-3"><div className="h-10 w-10 rounded-lg bg-[#0F2942] text-amber-400 grid place-items-center"><Icon className="h-5 w-5" /></div><h3 className="font-bold text-slate-900">{title}</h3></div>
    <div className="mt-3 text-sm text-slate-600 leading-relaxed">{children}</div>
  </div>
);

export const AboutUs = ({ L }) => (
  <Wrap id="tentang-kami" className="bg-slate-50">
    <div className="grid lg:grid-cols-[1fr_1.3fr] gap-10 items-start">
      <div className="lg:sticky lg:top-24">
        <Eyebrow>Tentang Kami</Eyebrow>
        <h2 className="mt-3 text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">{L.about_us_title}</h2>
        <p className="mt-6 text-slate-600 leading-relaxed whitespace-pre-line" data-testid="landing-about-us-text">{L.about_us}</p>
      </div>
      <div className="grid gap-4">
        <Pillar icon={Compass} title="Konsep" testid="landing-concept"><p className="whitespace-pre-line">{L.concept}</p></Pillar>
        <Pillar icon={Target} title="Tujuan" testid="landing-goal"><p className="whitespace-pre-line">{L.goal}</p></Pillar>
        <Pillar icon={Scale} title="Dasar Hukum" testid="landing-legal">
          <ol className="list-decimal pl-5 space-y-1">{L.legal_basis.filter(Boolean).map((x) => <li key={x}>{x}</li>)}</ol>
        </Pillar>
      </div>
    </div>
  </Wrap>
);

const Stat = ({ icon: Icon, label, value, testid }) => (
  <div className="p-6 rounded-xl bg-white/5 border border-white/10" data-testid={testid}>
    <Icon className="h-5 w-5 text-amber-400" />
    <div className="mt-4 text-3xl sm:text-4xl font-extrabold text-white tabular-nums">{value ?? "-"}</div>
    <div className="mt-1 text-sm text-slate-300">{label}</div>
  </div>
);

export const VisitStats = () => {
  const [s, setS] = useState(null);
  useEffect(() => {
    const load = () => api.get("/public/stats").then((r) => setS(r.data)).catch(() => {});
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, []);
  return (
    <Wrap id="statistik" className="bg-[#0F2942]">
      <div className="text-xs uppercase tracking-[0.25em] font-semibold text-amber-400">Statistik Aktivitas Pengguna Platform</div>
      <h2 className="mt-3 text-2xl sm:text-3xl font-extrabold tracking-tight text-white">Data kunjungan landing page 30 hari terakhir</h2>
      <p className="mt-2 text-sm text-slate-300" data-testid="landing-stats-updated">Diperbarui otomatis{s ? ` · ${fmtDateTime(s.updated_at)}` : ""}</p>
      <div className="mt-10 grid sm:grid-cols-3 gap-4">
        <Stat icon={TrendingUp} label="Kunjungan 30 hari terakhir" value={s?.last30} testid="landing-stat-last30" />
        <Stat icon={Eye} label="Kunjungan hari ini" value={s?.today} testid="landing-stat-today" />
        <Stat icon={BookOpenCheck} label={`Total dilihat repositori pengetahuan (${s?.kms_total ?? 0} bacaan)`} value={s?.kms_views} testid="landing-stat-kms" />
      </div>
      <div className="mt-6 h-56 rounded-xl bg-white/5 border border-white/10 p-4" data-testid="landing-stats-chart">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={s?.daily || []}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.08)" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94A3B8" }} interval={4} />
            <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#94A3B8" }} width={30} />
            <Tooltip />
            <Area type="monotone" dataKey="kunjungan" name="Kunjungan" stroke="#F59E0B" fill="#F59E0B" fillOpacity={0.25} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Wrap>
  );
};

const SOC = [["website", Globe, "Website"], ["instagram", Instagram, "Instagram"], ["facebook", Facebook, "Facebook"]];

export const SocialFooter = ({ settings, L }) => (
  <footer className="px-6 lg:px-16 py-10 bg-[#081626] text-slate-400 text-sm" data-testid="landing-footer">
    {L.maps_embed && (
      <div className="max-w-6xl mx-auto grid md:grid-cols-[1fr_1.6fr] gap-8 pb-10 mb-8 border-b border-white/10" data-testid="footer-office">
        <div>
          <div className="text-xs uppercase tracking-[0.25em] font-semibold text-amber-400 flex items-center gap-2"><MapPin className="h-4 w-4" />Alamat Kantor</div>
          <div className="mt-3 text-base font-bold text-white leading-snug" data-testid="footer-office-name">{L.office_name}</div>
          {L.office_address && <p className="mt-2 whitespace-pre-line" data-testid="footer-office-address">{L.office_address}</p>}
          {L.maps_link && <a href={L.maps_link} target="_blank" rel="noreferrer noopener" className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-full border border-white/15 hover:border-amber-400 hover:text-amber-300 transition-colors" data-testid="footer-maps-link">Buka di Google Maps <ExternalLink className="h-4 w-4" /></a>}
        </div>
        <iframe title="Peta lokasi kantor" src={L.maps_embed} className="w-full h-64 rounded-xl border border-white/10 bg-slate-800" loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen data-testid="footer-maps-embed" />
      </div>
    )}
    <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6">
      <div>© {new Date().getFullYear()} {settings?.app_name || "LMS Khidmat Kota Dumai"} · Pemerintah Kota Dumai</div>
      <div className="flex flex-wrap gap-3">
        {SOC.filter(([k]) => L.social?.[k]).map(([k, Icon, label]) => (
          <a key={k} href={L.social[k]} target="_blank" rel="noreferrer noopener" className="flex items-center gap-2 px-3 py-2 rounded-full border border-white/10 hover:border-amber-400 hover:text-amber-300 transition-colors" data-testid={`footer-social-${k}`}>
            <Icon className="h-4 w-4" />{label}
          </a>
        ))}
      </div>
    </div>
  </footer>
);
