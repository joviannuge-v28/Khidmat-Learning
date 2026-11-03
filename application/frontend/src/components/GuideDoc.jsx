import { BookMarked, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/common";

export const GuideDoc = ({ title, subtitle, items, testid = "guide" }) => (
  <div className="max-w-4xl" data-testid={testid}>
    <PageHeader title={title} subtitle={subtitle}
      action={<Button onClick={() => window.print()} className="print-hide bg-[#0F2942] hover:bg-[#0A1D30]" data-testid={`${testid}-print-button`}><Printer className="h-4 w-4 mr-2" />Cetak / Simpan PDF</Button>} />
    <nav className="print-hide mb-6 flex flex-wrap gap-2">
      {items.map(([id, t]) => <a key={id} href={`#g-${id}`} className="text-xs px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200">{t}</a>)}
    </nav>
    <div className="space-y-6">
      {items.map(([id, t, steps, img]) => (
        <section key={id} id={`g-${id}`} className="guide-section scroll-mt-24 bg-white rounded-xl border border-slate-200 p-6" data-testid={`${testid}-item-${id}`}>
          <h2 className="font-bold text-slate-900 flex items-center gap-2"><BookMarked className="h-4 w-4 text-amber-600 shrink-0" />{t}</h2>
          <ol className="mt-3 space-y-2 pl-6 list-decimal text-slate-700 text-sm leading-relaxed">{steps.map((s) => <li key={s}>{s}</li>)}</ol>
          {img && <figure className="mt-4"><img src={img} alt={`Tangkapan layar ${t}`} className="w-full rounded-lg border border-slate-200" loading="lazy" data-testid={`${testid}-img-${id}`} /><figcaption className="text-xs text-slate-500 mt-1">Tangkapan layar: {t}</figcaption></figure>}
        </section>
      ))}
    </div>
  </div>
);
