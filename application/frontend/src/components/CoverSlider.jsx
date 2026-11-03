import { useEffect, useState } from "react";
import { fileUrl } from "@/lib/api";

export const CoverSlider = ({ slides, interval = 10 }) => {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (slides.length < 2) return undefined;
    const t = setInterval(() => setI((x) => (x + 1) % slides.length), Math.max(3, Number(interval) || 10) * 1000);
    return () => clearInterval(t);
  }, [slides.length, interval]);
  return (
    <>
      {slides.map((s, k) => (
        <div key={s + k} className={`absolute inset-0 transition-opacity duration-1000 ${k === i ? "opacity-100" : "opacity-0"}`} data-testid={`login-cover-slide-${k}`}>
          <img src={fileUrl(s)} alt="" aria-hidden className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-70" />
          <img src={fileUrl(s)} alt="Sampul" className="absolute inset-0 w-full h-full object-contain" data-testid={k === 0 ? "login-cover-image" : undefined} />
        </div>
      ))}
      {slides.length > 1 && (
        <div className="absolute top-4 right-4 flex gap-1.5 z-10">
          {slides.map((s, k) => <button key={s + k} onClick={() => setI(k)} aria-label={`Slide ${k + 1}`} className={`h-2 rounded-full transition-[width,background-color] ${k === i ? "w-6 bg-amber-400" : "w-2 bg-white/70"}`} data-testid={`login-cover-dot-${k}`} />)}
        </div>
      )}
    </>
  );
};
