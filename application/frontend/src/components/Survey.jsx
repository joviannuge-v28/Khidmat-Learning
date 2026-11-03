import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ClipboardList, ExternalLink, MapPin, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Brand } from "@/components/common";
import { SocialFooter } from "@/components/LandingExtra";
import { useAuth } from "@/context/AuthContext";
import { API, api, fileUrl } from "@/lib/api";
import { landingOf } from "@/lib/landing";

export const useSurvey = () => {
  const [s, setS] = useState(null);
  useEffect(() => {
    const load = () => api.get("/public/survey").then((r) => setS(r.data)).catch(() => setS({ items: [] }));
    load();
    window.addEventListener("survey:updated", load);
    return () => window.removeEventListener("survey:updated", load);
  }, []);
  return s;
};

export const surveyQr = (it, i) => (it.qr_path ? fileUrl(it.qr_path) : it.url ? `${API}/public/survey/${i}/qr` : "");

export const SurveyCards = ({ survey }) => {
  if (!survey) return <p className="text-slate-500">Memuat...</p>;
  if (!survey.items?.length) return <p className="text-slate-500 p-8 rounded-xl border border-dashed border-slate-300 bg-white text-center" data-testid="survey-empty">Survei kepuasan belum tersedia.</p>;
  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="survey-cards">
      {survey.items.map((it, i) => (
        <article key={i} className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col items-center text-center shadow-sm hover:shadow-md transition-shadow" data-testid={`survey-card-${i}`}>
          <div className="h-48 w-48 rounded-xl border border-slate-200 bg-white p-2 grid place-items-center">
            {surveyQr(it, i) ? <img src={surveyQr(it, i)} alt={`Barcode ${it.label}`} className="h-full w-full object-contain" data-testid={`survey-qr-${i}`} /> : <QrCode className="h-16 w-16 text-slate-300" />}
          </div>
          <h3 className="mt-5 font-bold text-slate-900">{it.label || "Survei Kepuasan"}</h3>
          {it.description && <p className="mt-1 text-sm text-slate-600">{it.description}</p>}
          {it.url && (
            <a href={`${API}/public/survey/${i}/go?src=link`} target="_blank" rel="noreferrer noopener" className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#0F2942] text-white text-sm font-semibold hover:bg-[#0A1D30] transition-colors" data-testid={`survey-link-${i}`}>
              Isi Survei <ExternalLink className="h-4 w-4" />
            </a>
          )}
        </article>
      ))}
    </div>
  );
};

export default function SurveyPage() {
  const { settings, user } = useAuth();
  const survey = useSurvey();
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200 h-16 px-4 lg:px-10 flex items-center justify-between">
        <Link to={user ? "/" : "/login"} data-testid="survey-brand"><Brand /></Link>
        <Button asChild variant="outline" size="sm"><Link to={user ? "/" : "/login"} data-testid="survey-back-button"><ArrowLeft className="h-4 w-4 mr-1.5" />{user ? "Kembali ke Dashboard" : "Kembali ke Beranda"}</Link></Button>
      </header>
      <main className="flex-1 px-6 lg:px-16 py-16">
        <div className="max-w-6xl mx-auto">
          <div className="text-xs uppercase tracking-[0.25em] font-semibold text-amber-600 flex items-center gap-2"><ClipboardList className="h-4 w-4" />Survei Kepuasan</div>
          <h1 className="mt-3 text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900" data-testid="survey-title">{survey?.title || "Survei Kepuasan Masyarakat"}</h1>
          {survey?.description && <p className="mt-3 text-slate-600 max-w-2xl" data-testid="survey-description">{survey.description}</p>}
          <p className="mt-2 text-sm text-slate-500">Pindai barcode dengan kamera ponsel atau klik tombol "Isi Survei".</p>
          <div className="mt-10"><SurveyCards survey={survey} /></div>
        </div>
      </main>
      <SocialFooter settings={settings} L={landingOf(settings)} />
    </div>
  );
}

export const AsnFooter = () => {
  const { settings } = useAuth();
  const survey = useSurvey();
  const L = landingOf(settings);
  const firstIdx = survey?.items?.findIndex((it) => it.url) ?? -1;
  const first = firstIdx >= 0 ? survey.items[firstIdx] : null;
  return (
    <footer className="no-print border-t border-slate-200 bg-white px-4 sm:px-6 lg:px-10 py-5 text-sm text-slate-500" data-testid="asn-footer">
      <div className="max-w-[1400px] flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>© {new Date().getFullYear()} {settings?.app_name || "LMS Khidmat Kota Dumai"} · Pemerintah Kota Dumai</div>
        <div className="flex flex-wrap items-center gap-2">
          {survey?.show_in_footer !== false && survey?.items?.length > 0 && (
            <>
              {first?.url && <a href={`${API}/public/survey/${firstIdx}/go?src=link`} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 transition-colors font-medium" data-testid="asn-footer-survey-link"><ClipboardList className="h-4 w-4" />Isi Survei Kepuasan</a>}
              <Link to="/survei" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-200 hover:border-slate-400 transition-colors" data-testid="asn-footer-survey-qr"><QrCode className="h-4 w-4" />Barcode Survei</Link>
            </>
          )}
          {L.maps_link && <a href={L.maps_link} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-slate-200 hover:border-slate-400 transition-colors" data-testid="asn-footer-maps"><MapPin className="h-4 w-4" />Alamat Kantor</a>}
        </div>
      </div>
    </footer>
  );
};
