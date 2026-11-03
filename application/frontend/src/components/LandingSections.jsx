import { Award, BarChart3, BookOpen, Brain, GraduationCap, Lightbulb, LifeBuoy, QrCode, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CertVerifyBox } from "@/components/CertVerifyBox";
import { landingOf } from "@/lib/landing";
import { fileUrl } from "@/lib/api";
import { AboutUs, SocialFooter, VisitStats, WelcomeOfficials } from "@/components/LandingExtra";

const ICONS = [GraduationCap, Video, Award, QrCode, Brain, BarChart3, BookOpen, Lightbulb];

const Section = ({ id, eyebrow, title, children, className = "" }) => (
  <section id={id} className={`scroll-mt-20 px-6 lg:px-16 py-20 lg:py-28 ${className}`} data-testid={`landing-section-${id}`}>
    <div className="max-w-6xl mx-auto">
      <div className="text-xs uppercase tracking-[0.25em] font-semibold text-amber-600">{eyebrow}</div>
      <h2 className="mt-3 text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-slate-900 max-w-3xl">{title}</h2>
      {children}
    </div>
  </section>
);

const MediaSplit = ({ img, text, points, testid }) => (
  <div className="mt-10 grid lg:grid-cols-2 gap-10 items-center">
    <img src={fileUrl(img)} alt="" className="w-full aspect-[4/3] object-cover rounded-2xl shadow-lg" data-testid={testid} />
    <div>
      <p className="text-slate-600 leading-relaxed text-base">{text}</p>
      <ul className="mt-6 space-y-3">{points.map((p) => <li key={p} className="flex gap-3 text-slate-700"><span className="mt-2 h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />{p}</li>)}</ul>
    </div>
  </div>
);

export const LandingSections = ({ settings, onReport }) => {
  const L = landingOf(settings);
  return (
    <>
      <WelcomeOfficials L={L} />
      <AboutUs L={L} />
      <Section id="tentang" eyebrow="Tentang LMS" title={settings?.app_name || "LMS Khidmat Kota Dumai"} className="bg-white">
        <p className="mt-6 text-slate-600 leading-relaxed max-w-3xl text-base" data-testid="landing-about-text">{settings?.tagline}. {L.about_text}</p>
        <ol className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {L.steps.map((s, i) => (
            <li key={s} className="p-6 rounded-xl border border-slate-200 bg-slate-50">
              <div className="font-mono text-sm text-amber-600">0{i + 1}</div>
              <div className="mt-2 font-semibold text-slate-900">{s}</div>
            </li>
          ))}
        </ol>
      </Section>

      <Section id="fitur" eyebrow="Fitur" title="Semua kebutuhan belajar aparatur dalam satu tempat">
        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {L.features.map((f, i) => {
            const Icon = ICONS[i % ICONS.length];
            return (
              <div key={i} className="p-6 bg-white rounded-xl border border-slate-200 hover:-translate-y-1 hover:shadow-lg transition-[transform,box-shadow] duration-300" data-testid={`landing-feature-card-${i}`}>
                <div className="h-11 w-11 rounded-lg bg-[#0F2942] text-amber-400 grid place-items-center"><Icon className="h-5 w-5" /></div>
                <h3 className="mt-4 font-bold text-slate-900">{f.title}</h3>
                <p className="mt-2 text-sm text-slate-600 leading-relaxed">{f.text}</p>
              </div>
            );
          })}
        </div>
      </Section>

      <Section id="cek-sertifikat" eyebrow="Verifikasi" title="Cek keaslian sertifikat" className="bg-white">
        <p className="mt-4 mb-8 text-slate-600 max-w-2xl">Pindai kode QR pada sertifikat atau ketik nomor sertifikat untuk memastikan sertifikat diterbitkan resmi oleh BKPSDM Kota Dumai.</p>
        <CertVerifyBox />
      </Section>

      <Section id="kms" eyebrow="Knowledge Management System" title={L.kms_title}>
        <MediaSplit img={L.kms_image} text={L.kms_text} points={L.kms_points} testid="landing-kms-image" />
      </Section>

      <Section id="zoom" eyebrow="Webinar Zoom" title={L.zoom_title} className="bg-white">
        <MediaSplit img={L.zoom_image} text={L.zoom_text} points={L.zoom_points} testid="landing-zoom-image" />
      </Section>

      <Section id="bantuan" eyebrow="Bantuan" title="Kesulitan masuk ke akun?" className="bg-[#0B1E33] [&_h2]:text-white">
        <p className="mt-6 text-slate-300 max-w-2xl">{L.help_text}</p>
        <Button onClick={onReport} size="lg" className="mt-8 bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold" data-testid="landing-report-button">
          <LifeBuoy className="h-5 w-5 mr-2" />Lapor Admin
        </Button>
      </Section>

      <VisitStats />
      <SocialFooter settings={settings} L={L} />
    </>
  );
};
