import { useEffect, useState } from "react";
import { Accessibility, Contrast, Moon, RotateCcw } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";

const SIZES = [
  { v: 90, label: "A-" },
  { v: 100, label: "A" },
  { v: 115, label: "A+" },
  { v: 130, label: "A++" },
];
const KEY = "lms-a11y";
const BASE = { size: 100, contrast: false, night: false };

const load = () => {
  try {
    return { ...BASE, ...JSON.parse(localStorage.getItem(KEY) || "{}") };
  } catch (e) {
    return BASE;
  }
};

export const A11yWidget = () => {
  const [s, setS] = useState(load);

  useEffect(() => {
    const root = document.documentElement;
    root.style.fontSize = `${s.size}%`;
    root.classList.toggle("a11y-contrast", s.contrast && !s.night);
    root.classList.toggle("night", s.night);
    root.classList.toggle("dark", s.night);
    localStorage.setItem(KEY, JSON.stringify(s));
  }, [s]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          aria-label="Pengaturan tampilan"
          data-testid="a11y-toggle-button"
          className="fixed bottom-5 right-5 z-50 h-12 w-12 rounded-full bg-[#0F2942] text-white shadow-lg shadow-slate-900/30 grid place-items-center hover:scale-105 transition-transform ring-2 ring-amber-400"
        >
          <Accessibility className="h-6 w-6" />
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="end" className="w-72 p-5" data-testid="a11y-panel">
        <div className="font-bold text-slate-900">Pengaturan Tampilan</div>
        <p className="text-xs text-slate-500 mt-0.5">Tersimpan di perangkat ini.</p>

        <div className="mt-5 text-xs font-semibold uppercase tracking-wider text-slate-500">Ukuran Huruf</div>
        <div className="mt-2 grid grid-cols-4 gap-2">
          {SIZES.map((x) => (
            <button
              key={x.v}
              onClick={() => setS({ ...s, size: x.v })}
              data-testid={`a11y-font-${x.v}`}
              aria-pressed={s.size === x.v}
              className={`h-10 rounded-lg border font-bold transition-colors ${s.size === x.v ? "bg-[#0F2942] text-white border-[#0F2942]" : "border-slate-200 text-slate-700 hover:border-slate-400"}`}
            >
              {x.label}
            </button>
          ))}
        </div>

        <label className="mt-5 flex items-center justify-between gap-3 cursor-pointer">
          <span className="flex items-center gap-2 text-sm font-medium text-slate-800"><Moon className="h-4 w-4" />Mode Malam</span>
          <Switch checked={s.night} onCheckedChange={(v) => setS({ ...s, night: v })} data-testid="a11y-night-switch" />
        </label>
        <label className="mt-4 flex items-center justify-between gap-3 cursor-pointer">
          <span className="flex items-center gap-2 text-sm font-medium text-slate-800"><Contrast className="h-4 w-4" />Kontras Tinggi</span>
          <Switch checked={s.contrast} onCheckedChange={(v) => setS({ ...s, contrast: v, night: v ? false : s.night })} data-testid="a11y-contrast-switch" />
        </label>

        <button onClick={() => setS(BASE)} className="mt-5 w-full flex items-center justify-center gap-2 text-sm text-slate-600 hover:text-slate-900 py-2 rounded-lg hover:bg-slate-100 transition-colors" data-testid="a11y-reset-button">
          <RotateCcw className="h-4 w-4" />Atur Ulang
        </button>
      </PopoverContent>
    </Popover>
  );
};
