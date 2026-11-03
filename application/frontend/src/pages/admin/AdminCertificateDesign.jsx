import { useEffect, useRef, useState } from "react";
import { AlignCenterHorizontal, AlignCenterVertical, AlignVerticalSpaceAround, Eye, Grid3x3, Keyboard, Loader2, Magnet, Plus, RotateCcw, Save, Sparkles, Trash2, Type } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/common";
import { FileUpload } from "@/components/FileUpload";
import { useAuth } from "@/context/AuthContext";
import { api, errMsg, fileUrl, openPdfPost } from "@/lib/api";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const FONTS = { Helvetica: ["Helvetica, Arial, sans-serif", "normal"], Times: ["'Times New Roman', Times, serif", "normal"], Courier: ["'Courier New', monospace", "normal"], "Helvetica Miring": ["Helvetica, Arial, sans-serif", "italic"], "Times Miring": ["'Times New Roman', Times, serif", "italic"] };
const fontCss = (name) => ({ fontFamily: (FONTS[name] || FONTS.Helvetica)[0], fontStyle: (FONTS[name] || FONTS.Helvetica)[1] });

const FontSelect = ({ value, onChange, testid, allowInherit }) => (
  <Select value={value || "inherit"} onValueChange={(v) => onChange(v === "inherit" ? "" : v)}>
    <SelectTrigger data-testid={testid}><SelectValue /></SelectTrigger>
    <SelectContent>{allowInherit && <SelectItem value="inherit">Ikuti font utama</SelectItem>}{Object.keys(FONTS).map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
  </Select>
);

export const DEFAULT_LAYOUT = {
  template_path: "", font_family: "Helvetica", custom_texts: [], text_color: "#0F172A", accent_color: "#0F2942", logos: [],
  elements: {
    header: { x: 50, y: 18, size: 14, show: true, bold: true, text: "PEMERINTAH KOTA DUMAI" },
    subheader: { x: 50, y: 22, size: 11, show: true, bold: false, text: "" },
    title: { x: 50, y: 30, size: 38, show: true, bold: true, text: "SERTIFIKAT" },
    number: { x: 50, y: 36, size: 11, show: true, bold: false },
    given: { x: 50, y: 42, size: 13, show: true, bold: false, text: "Diberikan kepada" },
    name: { x: 50, y: 49, size: 28, show: true, bold: true },
    nip: { x: 50, y: 54, size: 12, show: true, bold: false },
    activity: { x: 50, y: 60, size: 13, show: true, bold: false },
    course: { x: 50, y: 65, size: 18, show: true, bold: true },
    result: { x: 50, y: 70, size: 12, show: true, bold: false },
    signer: { x: 77, y: 76, size: 11, show: true, bold: false },
    qr: { x: 12, y: 84, size: 70, show: true },
  },
};

const LABELS = { header: "Kop", subheader: "Sub-kop", title: "Judul", number: "Nomor", given: "Diberikan kepada", name: "Nama Peserta", nip: "NIP", activity: "Keterangan Kegiatan", course: "Judul Kegiatan", result: "Nilai & Tanggal", signer: "Tanda Tangan", qr: "Kode QR" };
const EDITABLE_TEXT = ["header", "subheader", "title", "given"];

const merge = (saved) => {
  const s = saved || {};
  const els = Object.fromEntries(Object.entries(DEFAULT_LAYOUT.elements).map(([k, v]) => [k, { ...v, ...(s.elements?.[k] || {}) }]));
  return { ...DEFAULT_LAYOUT, ...s, logos: s.logos || [], custom_texts: s.custom_texts || [], elements: els };
};

const clamp = (v) => Math.max(0, Math.min(100, Math.round(v * 10) / 10));
const SNAP = 1.2;
const idxOf = (sel) => Number(sel.split("-")[1]);

export const posOf = (lay, sel) => {
  if (!sel) return null;
  if (sel.startsWith("custom-")) return lay.custom_texts[idxOf(sel)];
  if (sel.startsWith("logo-")) return lay.logos[idxOf(sel)];
  return lay.elements[sel];
};

export const withPos = (lay, sel, p) => {
  if (sel.startsWith("custom-")) return { ...lay, custom_texts: lay.custom_texts.map((t, i) => (i === idxOf(sel) ? { ...t, ...p } : t)) };
  if (sel.startsWith("logo-")) return { ...lay, logos: lay.logos.map((g, i) => (i === idxOf(sel) ? { ...g, ...p } : g)) };
  return { ...lay, elements: { ...lay.elements, [sel]: { ...lay.elements[sel], ...p } } };
};

const visibleKeys = (lay) => [
  ...Object.keys(lay.elements).filter((k) => lay.elements[k].show),
  ...lay.logos.map((_, i) => `logo-${i}`),
  ...lay.custom_texts.map((t, i) => (t.show !== false ? `custom-${i}` : null)).filter(Boolean),
];

const snapAxis = (v, lines) => {
  let best = null;
  lines.forEach((l) => { if (Math.abs(l - v) <= SNAP && (best === null || Math.abs(l - v) < Math.abs(best - v))) best = l; });
  return best;
};

const snapPos = (lay, sel, x, y) => {
  const others = visibleKeys(lay).filter((k) => k !== sel).map((k) => posOf(lay, k));
  const sx = snapAxis(x, [50, 25, 75, ...others.map((o) => o.x)]);
  const sy = snapAxis(y, [50, ...others.map((o) => o.y)]);
  return { x: sx ?? x, y: sy ?? y, guides: { x: sx, y: sy } };
};

const TEXT_KEYS = ["header", "subheader", "title", "number", "given", "name", "nip", "activity", "course", "result"];

export const tidyLayout = (lay) => {
  let l = lay;
  TEXT_KEYS.forEach((k) => { if (Math.abs(l.elements[k].x - 50) <= 6) l = withPos(l, k, { x: 50 }); });
  l.custom_texts.forEach((t, i) => { if (Math.abs(t.x - 50) <= 6) l = withPos(l, `custom-${i}`, { x: 50 }); });
  visibleKeys(l).forEach((k) => { const p = posOf(l, k); l = withPos(l, k, { x: Math.round(p.x * 2) / 2, y: Math.round(p.y * 2) / 2 }); });
  return l;
};

export const distributeVertical = (lay) => {
  const keys = TEXT_KEYS.filter((k) => lay.elements[k].show).sort((a, b) => lay.elements[a].y - lay.elements[b].y);
  if (keys.length < 3) return lay;
  const top = lay.elements[keys[0]].y;
  const step = (lay.elements[keys[keys.length - 1]].y - top) / (keys.length - 1);
  return keys.reduce((l, k, i) => withPos(l, k, { y: clamp(top + step * i) }), lay);
};

function useWidth(ref) {
  const [w, setW] = useState(800);
  useEffect(() => {
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    if (ref.current) ro.observe(ref.current);
    return () => ro.disconnect();
  }, [ref]);
  return w;
}

function Canvas({ lay, setLay, sel, setSel, signer, snap, grid }) {
  const ref = useRef(null);
  const W = useWidth(ref);
  const sc = W / 842;
  const [guides, setGuides] = useState({ x: null, y: null });
  const drag = (key) => (ev) => {
    ev.preventDefault();
    setSel(key);
    ref.current.focus();
    const rect = ref.current.getBoundingClientRect();
    const move = (e) => {
      const x = clamp(((e.clientX - rect.left) / rect.width) * 100);
      const y = clamp(((e.clientY - rect.top) / rect.height) * 100);
      setLay((l) => {
        if (!snap || e.altKey) { setGuides({ x: null, y: null }); return withPos(l, key, { x, y }); }
        const s = snapPos(l, key, x, y);
        setGuides(s.guides);
        return withPos(l, key, { x: s.x, y: s.y });
      });
    };
    const up = () => { setGuides({ x: null, y: null }); window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", up); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  const el = lay.elements;
  const sample = { header: el.header.text || "PEMERINTAH KOTA DUMAI", subheader: el.subheader.text || "LMS Khidmat Kota Dumai", title: el.title.text || "SERTIFIKAT",
    number: "Nomor: 001/BKPSDM-DMI/X/2026", given: el.given.text || "Diberikan kepada", name: "Nama Peserta Contoh", nip: "NIP. 198504122010011002",
    activity: "Telah menyelesaikan pelatihan", course: "Judul Pelatihan / Webinar", result: "dengan nilai akhir 100 pada tanggal 27 Oktober 2026" };
  const ring = (k) => (sel === k ? "outline outline-2 outline-blue-500 outline-offset-2" : "hover:outline hover:outline-1 hover:outline-blue-300");

  return (
    <div ref={ref} tabIndex={0} className="relative w-full aspect-[297/210] rounded-lg overflow-hidden shadow-lg select-none touch-none outline-none focus-visible:ring-2 focus-visible:ring-blue-500" style={{ background: "#FFFDF7" }} data-testid="cert-canvas">
      {lay.template_path ? <img src={fileUrl(lay.template_path)} alt="" className="absolute inset-0 w-full h-full" draggable={false} /> : (
        <><div className="absolute" style={{ inset: 20 * sc, border: `${6 * sc}px solid ${lay.accent_color}` }} /><div className="absolute" style={{ inset: 32 * sc, border: `${1.5 * sc}px solid #D97706` }} /></>
      )}
      {lay.logos.map((g, i) => (
        <div key={i} onPointerDown={drag(`logo-${i}`)} className={`absolute cursor-move aspect-square ${ring(`logo-${i}`)}`} data-testid={`cert-logo-${i}`}
          style={{ left: `${g.x}%`, top: `${g.y}%`, width: `${g.w}%`, transform: "translate(-50%,-50%)" }}>
          <img src={fileUrl(g.path)} alt="" className="w-full h-full object-contain pointer-events-none" draggable={false} />
        </div>
      ))}
      {Object.entries(sample).map(([k, t]) => el[k].show && (
        <div key={k} onPointerDown={drag(k)} className={`absolute whitespace-nowrap cursor-move leading-none ${ring(k)}`} data-testid={`cert-el-${k}`}
          style={{ left: `${el[k].x}%`, top: `${el[k].y}%`, transform: "translate(-50%,-50%)", fontSize: el[k].size * sc, fontWeight: el[k].bold ? 700 : 400, ...fontCss(el[k].font || lay.font_family),
            color: ["title", "header"].includes(k) && !lay.template_path ? lay.accent_color : lay.text_color }}>{t}</div>
      ))}
      {lay.custom_texts.map((t, i) => t.show !== false && (
        <div key={`c${i}`} onPointerDown={drag(`custom-${i}`)} className={`absolute whitespace-nowrap cursor-move leading-none ${ring(`custom-${i}`)}`} data-testid={`cert-custom-${i}`}
          style={{ left: `${t.x}%`, top: `${t.y}%`, transform: "translate(-50%,-50%)", fontSize: t.size * sc, fontWeight: t.bold ? 700 : 400, color: t.color || lay.text_color, ...fontCss(t.font || lay.font_family) }}>{t.text || "(teks kosong)"}</div>
      ))}
      {el.signer.show && (() => { const k = (el.signer.size / 11) * sc; return (
        <div onPointerDown={drag("signer")} className={`absolute text-center cursor-move ${ring("signer")}`} data-testid="cert-el-signer"
          style={{ left: `${el.signer.x}%`, top: `${el.signer.y}%`, transform: `translate(-50%, ${-9 * k}px)`, fontSize: 11 * k, color: lay.text_color, width: 200 * k, ...fontCss(el.signer.font || lay.font_family) }}>
          <div>Dumai, 27 Oktober 2026</div><div style={{ marginTop: 3 * k }}>{signer?.title || "Kepala BKPSDM Kota Dumai"}</div>
          <div style={{ height: 48 * k }} className="grid place-items-center">{signer?.signature_path && <img src={fileUrl(signer.signature_path)} alt="" style={{ height: 42 * k }} className="object-contain" draggable={false} />}</div>
          <div style={{ borderTop: "1px solid #475569", paddingTop: 2 * k, fontWeight: 700 }}>{signer?.name || "[Nama Penandatangan]"}</div>
          {signer?.pangkat && <div style={{ fontSize: 10 * k }} data-testid="cert-signer-pangkat">{signer.pangkat}</div>}
          {signer?.nip && <div style={{ fontSize: 10 * k }} data-testid="cert-signer-nip">NIP. {signer.nip}</div>}
        </div>); })()}
      {el.qr.show && (
        <div onPointerDown={drag("qr")} className={`absolute cursor-move bg-[repeating-conic-gradient(#0f172a_0_25%,#fff_0_50%)] bg-[length:20%_20%] ${ring("qr")}`} data-testid="cert-el-qr"
          style={{ left: `${el.qr.x}%`, top: `${el.qr.y}%`, width: el.qr.size * sc, height: el.qr.size * sc, transform: "translate(-50%,-50%)" }} />
      )}
      {grid && <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: "linear-gradient(rgba(37,99,235,.12) 1px, transparent 1px), linear-gradient(90deg, rgba(37,99,235,.12) 1px, transparent 1px)", backgroundSize: "5% 5%" }} data-testid="cert-grid" />}
      {grid && <><div className="absolute inset-y-0 left-1/2 w-px bg-blue-400/50 pointer-events-none" /><div className="absolute inset-x-0 top-1/2 h-px bg-blue-400/50 pointer-events-none" /></>}
      {guides.x !== null && <div className="absolute inset-y-0 w-px bg-rose-500 pointer-events-none" style={{ left: `${guides.x}%` }} data-testid="cert-guide-x" />}
      {guides.y !== null && <div className="absolute inset-x-0 h-px bg-rose-500 pointer-events-none" style={{ top: `${guides.y}%` }} data-testid="cert-guide-y" />}
    </div>
  );
}

function ElementPanel({ lay, setLay, sel }) {
  if (sel?.startsWith("custom-")) {
    const i = Number(sel.split("-")[1]);
    const t = lay.custom_texts[i];
    if (!t) return null;
    const setT = (v) => setLay((l) => ({ ...l, custom_texts: l.custom_texts.map((x, j) => (j === i ? { ...x, ...v } : x)) }));
    return (
      <div className="space-y-3" data-testid="cert-custom-panel">
        <div className="font-semibold">Teks Tambahan {i + 1}</div>
        <Input value={t.text} onChange={(e) => setT({ text: e.target.value })} placeholder="Isi teks" data-testid="cert-custom-text-input" />
        <Label>Besar Huruf ({t.size})</Label>
        <Slider min={6} max={64} step={1} value={[t.size]} onValueChange={([v]) => setT({ size: v })} data-testid="cert-custom-size" />
        <div className="grid gap-1"><Label className="text-xs">Font</Label><FontSelect value={t.font} onChange={(v) => setT({ font: v })} allowInherit testid="cert-custom-font" /></div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm"><Switch checked={!!t.bold} onCheckedChange={(v) => setT({ bold: v })} data-testid="cert-custom-bold" />Tebal</label>
          <Input type="color" value={t.color || lay.text_color} onChange={(e) => setT({ color: e.target.value })} className="h-9 w-14 p-1" data-testid="cert-custom-color" />
        </div>
        <Button size="sm" variant="outline" onClick={() => setLay((l) => ({ ...l, custom_texts: l.custom_texts.filter((_, j) => j !== i) }))} data-testid="cert-custom-remove"><Trash2 className="h-4 w-4 mr-1 text-rose-600" />Hapus Teks</Button>
      </div>
    );
  }
  if (sel?.startsWith("logo-")) {
    const i = Number(sel.split("-")[1]);
    const g = lay.logos[i];
    if (!g) return null;
    const setG = (v) => setLay((l) => ({ ...l, logos: l.logos.map((x, j) => (j === i ? { ...x, ...v } : x)) }));
    return (
      <div className="space-y-3" data-testid="cert-logo-panel">
        <div className="font-semibold">Logo {i + 1}</div>
        <Label>Ukuran ({g.w}% lebar)</Label>
        <Slider min={3} max={30} step={0.5} value={[g.w]} onValueChange={([v]) => setG({ w: v })} data-testid="cert-logo-size" />
        <Button size="sm" variant="outline" onClick={() => setLay((l) => ({ ...l, logos: l.logos.filter((_, j) => j !== i) }))} data-testid="cert-logo-remove"><Trash2 className="h-4 w-4 mr-1 text-rose-600" />Hapus Logo</Button>
      </div>
    );
  }
  const e = lay.elements[sel];
  if (!e) return <p className="text-sm text-slate-500">Klik atau seret elemen pada sertifikat untuk mengatur posisi dan ukurannya.</p>;
  const set = (v) => setLay((l) => ({ ...l, elements: { ...l.elements, [sel]: { ...l.elements[sel], ...v } } }));
  const isQr = sel === "qr";
  return (
    <div className="space-y-4" data-testid="cert-element-panel">
      <div className="font-semibold">{LABELS[sel]} <span className="text-xs font-normal text-slate-500">X {e.x}% · Y {e.y}%</span></div>
      <div className="grid gap-2">
        <Label>{isQr ? "Ukuran QR" : sel === "signer" ? "Ukuran Blok TTD" : "Besar Huruf"} ({e.size})</Label>
        <Slider min={isQr ? 40 : 6} max={isQr ? 140 : 64} step={1} value={[e.size]} onValueChange={([v]) => set({ size: v })} data-testid="cert-element-size" />
      </div>
      {EDITABLE_TEXT.includes(sel) && <div className="grid gap-2"><Label>Teks</Label><Input value={e.text} onChange={(x) => set({ text: x.target.value })} placeholder={sel === "subheader" ? "Kosong = nama aplikasi" : ""} data-testid="cert-element-text" /></div>}
      <div className="flex flex-wrap gap-5">
        <label className="flex items-center gap-2 text-sm"><Switch checked={e.show} onCheckedChange={(v) => set({ show: v })} data-testid="cert-element-show" />Tampilkan</label>
        {!isQr && sel !== "signer" && <label className="flex items-center gap-2 text-sm"><Switch checked={!!e.bold} onCheckedChange={(v) => set({ bold: v })} data-testid="cert-element-bold" />Tebal</label>}
      </div>
      {!isQr && <div className="grid gap-1"><Label className="text-xs">Font elemen ini</Label><FontSelect value={e.font} onChange={(v) => set({ font: v })} allowInherit testid="cert-element-font" /></div>}
    </div>
  );
}

function AlignBar({ lay, setLay, sel, snap, setSnap, grid, setGrid }) {
  const has = !!posOf(lay, sel);
  const B = ({ onClick, icon: Icon, children, testid, active, disabled }) => (
    <Button size="sm" variant={active ? "default" : "outline"} onClick={onClick} disabled={disabled} className={active ? "bg-[#0F2942] hover:bg-[#0A1D30]" : "bg-white"} data-testid={testid}><Icon className="h-4 w-4 mr-1.5" />{children}</Button>
  );
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-2" data-testid="cert-align-bar">
      <div className="flex flex-wrap gap-2">
        <B icon={AlignCenterHorizontal} disabled={!has} onClick={() => setLay((l) => withPos(l, sel, { x: 50 }))} testid="cert-align-center-h">Tengah Horizontal</B>
        <B icon={AlignCenterVertical} disabled={!has} onClick={() => setLay((l) => withPos(l, sel, { y: 50 }))} testid="cert-align-center-v">Tengah Vertikal</B>
        <B icon={AlignVerticalSpaceAround} onClick={() => { setLay(distributeVertical); toast.success("Jarak vertikal teks diratakan"); }} testid="cert-distribute-v">Ratakan Jarak</B>
        <B icon={Sparkles} onClick={() => { setLay(tidyLayout); toast.success("Tata letak dirapikan"); }} testid="cert-tidy-button">Rapikan Otomatis</B>
        <B icon={Magnet} active={snap} onClick={() => setSnap(!snap)} testid="cert-snap-toggle">Snap {snap ? "Aktif" : "Mati"}</B>
        <B icon={Grid3x3} active={grid} onClick={() => setGrid(!grid)} testid="cert-grid-toggle">Grid</B>
      </div>
      <p className="text-xs text-slate-500 flex items-center gap-1.5" data-testid="cert-keyboard-hint"><Keyboard className="h-3.5 w-3.5" />Pilih elemen lalu tekan tombol panah ← ↑ → ↓ untuk menggeser 0,5% (Shift = 5%, Alt = 0,1%). Saat menyeret, elemen menempel otomatis ke garis tengah & elemen lain (tahan Alt untuk bebas).</p>
    </div>
  );
}

function SignersPanel({ signers, setSigners, prev, setPrev }) {
  const setS = (i, v) => setSigners((l) => l.map((x, j) => (j === i ? { ...x, ...v } : x)));
  return (
    <section className="bg-white rounded-xl border border-slate-200 p-5 space-y-3" data-testid="cert-signers-panel">
      <div className="flex items-center justify-between"><div className="font-semibold">Penanggung Jawab TTD ({signers.length})</div>
        <Button size="sm" variant="outline" onClick={() => setSigners((l) => [...l, { id: "", name: "", title: "", pangkat: "", nip: "", signature_path: "" }])} data-testid="cert-signer-add"><Plus className="h-4 w-4 mr-1" />Tambah</Button></div>
      <p className="text-xs text-slate-500">Setiap kursus/webinar memilih penandatangan sebelum diposting. Yang pertama menjadi bawaan.</p>
      {signers.map((s, i) => (
        <div key={i} className={`p-3 rounded-lg border space-y-2 ${prev === i ? "border-blue-400 bg-blue-50/40" : "border-slate-200"}`} data-testid={`cert-signer-${i}`}>
          <Input value={s.name} onChange={(e) => setS(i, { name: e.target.value })} placeholder="Nama lengkap & gelar" data-testid={`cert-signer-name-${i}`} />
          <Input value={s.title} onChange={(e) => setS(i, { title: e.target.value })} placeholder="Jabatan, mis. Kepala BKPSDM Kota Dumai" data-testid={`cert-signer-title-${i}`} />
          <Input value={s.pangkat} onChange={(e) => setS(i, { pangkat: e.target.value })} placeholder="Pangkat/Golongan, mis. Pembina Utama Muda (IV/c)" data-testid={`cert-signer-pangkat-${i}`} />
          <Input value={s.nip} onChange={(e) => setS(i, { nip: e.target.value })} placeholder="NIP" data-testid={`cert-signer-nip-${i}`} />
          <div className="flex flex-wrap items-center gap-2">
            {s.signature_path && <img src={fileUrl(s.signature_path)} alt="TTD" className="h-10 object-contain" />}
            <FileUpload accept="image/png,image/jpeg" kind="public" label="TTD / Cap" maxMB={10} testid={`cert-signer-sig-${i}`} onUploaded={(p) => setS(i, { signature_path: p })} />
            <Button size="sm" variant="ghost" onClick={() => setPrev(i)} data-testid={`cert-signer-preview-${i}`}><Eye className="h-4 w-4" /></Button>
            <Button size="sm" variant="ghost" onClick={() => { setSigners((l) => l.filter((_, j) => j !== i)); setPrev(0); }} data-testid={`cert-signer-remove-${i}`}><Trash2 className="h-4 w-4 text-rose-600" /></Button>
          </div>
        </div>
      ))}
    </section>
  );
}

export default function AdminCertificateDesign() {
  const { settings, loadSettings } = useAuth();
  const [lay, setLay] = useState(null);
  const [sel, setSel] = useState("name");
  const [busy, setBusy] = useState("");
  const [signers, setSigners] = useState(null);
  const [prev, setPrev] = useState(0);
  const [snap, setSnap] = useState(true);
  const [grid, setGrid] = useState(false);

  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target.tagName || "").toLowerCase();
      if (["input", "textarea", "select"].includes(tag) || e.target.isContentEditable || e.target.closest?.("[role=slider],[role=combobox],[role=listbox],[role=switch]")) return;
      const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
      if (!d || !sel) return;
      e.preventDefault();
      const step = e.shiftKey ? 5 : e.altKey ? 0.1 : 0.5;
      setLay((l) => {
        const p = l && posOf(l, sel);
        return p ? withPos(l, sel, { x: clamp(p.x + d[0] * step), y: clamp(p.y + d[1] * step) }) : l;
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sel]);

  useEffect(() => {
    if (settings && !lay) {
      setLay(merge(settings.cert_layout));
      setSigners(settings.signers?.length ? settings.signers : [{ id: "", name: settings.signer_name || "", title: settings.signer_title || "", pangkat: "", nip: "", signature_path: settings.signature_path || "" }]);
    }
  }, [settings, lay]);
  if (!lay) return null;

  const save = async () => {
    setBusy("save");
    try {
      const r = await api.put("/admin/cert-design", { cert_layout: lay, signers });
      setSigners(r.data.signers);
      await loadSettings();
      toast.success("Desain sertifikat disimpan dan berlaku untuk semua sertifikat");
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy("");
    }
  };
  const preview = async () => {
    setBusy("preview");
    try {
      await openPdfPost("/certificates/preview", { title: "Judul Pelatihan / Webinar", kind: "course", layout: lay, signer_id: signers[prev]?.id || "" });
    } catch (e) {
      toast.error(errMsg(e, "Gagal membuat pratinjau"));
    } finally {
      setBusy("");
    }
  };
  const hidden = Object.entries(lay.elements).filter(([, v]) => !v.show);

  return (
    <div className="max-w-[1300px]">
      <PageHeader title="Desain Sertifikat" subtitle="Satu desain seragam untuk semua sertifikat. Seret elemen untuk mengatur tata letak; hanya nomor yang berbeda tiap kegiatan."
        action={<div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setLay(merge({}))} data-testid="cert-reset-button"><RotateCcw className="h-4 w-4 mr-2" />Atur Ulang</Button>
          <Button variant="outline" onClick={preview} disabled={!!busy} data-testid="cert-preview-button">{busy === "preview" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Eye className="h-4 w-4 mr-2" />}Pratinjau PDF</Button>
          <Button onClick={save} disabled={!!busy} className="bg-[#0F2942] hover:bg-[#0A1D30]" data-testid="cert-save-button">{busy === "save" ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}Simpan Desain</Button>
        </div>} />
      <div className="grid xl:grid-cols-[1fr_320px] gap-6 items-start">
        <div className="space-y-3">
          <AlignBar lay={lay} setLay={setLay} sel={sel} snap={snap} setSnap={setSnap} grid={grid} setGrid={setGrid} />
          <Canvas lay={lay} setLay={setLay} sel={sel} setSel={setSel} signer={signers[prev] || signers[0]} snap={snap} grid={grid} />
          {hidden.length > 0 && <div className="flex flex-wrap gap-2 text-xs">Tersembunyi: {hidden.map(([k]) => <button key={k} onClick={() => setSel(k)} className="px-2 py-1 rounded-full bg-slate-100 hover:bg-slate-200" data-testid={`cert-hidden-${k}`}>{LABELS[k]}</button>)}</div>}
        </div>
        <div className="space-y-5">
          <section className="bg-white rounded-xl border border-slate-200 p-5"><ElementPanel lay={lay} setLay={setLay} sel={sel} /></section>
          <section className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
            <div className="font-semibold flex items-center gap-2"><Type className="h-4 w-4" />Font & Teks Tambahan</div>
            <div className="grid gap-1"><Label className="text-xs">Font utama sertifikat</Label><FontSelect value={lay.font_family} onChange={(v) => setLay({ ...lay, font_family: v || "Helvetica" })} testid="cert-font-family" /></div>
            <Button size="sm" variant="outline" onClick={() => { setLay((l) => ({ ...l, custom_texts: [...l.custom_texts, { text: "Teks baru", x: 50, y: 78, size: 12, bold: false, font: "", color: "" }] })); setSel(`custom-${lay.custom_texts.length}`); }} data-testid="cert-add-text"><Plus className="h-4 w-4 mr-1" />Tambah Teks</Button>
          </section>
          <SignersPanel signers={signers} setSigners={setSigners} prev={prev} setPrev={setPrev} />
          <section className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
            <div className="font-semibold">Logo ({lay.logos.length})</div>
            <p className="text-xs text-slate-500">Bisa lebih dari satu logo. Setelah diunggah, seret logo ke posisinya.</p>
            <div className="flex flex-wrap gap-2">
              <FileUpload accept="image/png,image/jpeg,image/webp" kind="public" label="Unggah Logo" maxMB={10} testid="cert-logo-upload"
                onUploaded={(p) => { setLay((l) => ({ ...l, logos: [...l.logos, { path: p, x: 50 + l.logos.length * 8, y: 9, w: 7 }] })); setSel(`logo-${lay.logos.length}`); }} />
              {settings?.logo_path && <Button size="sm" variant="ghost" onClick={() => setLay((l) => ({ ...l, logos: [...l.logos, { path: settings.logo_path, x: 50, y: 9, w: 7 }] }))} data-testid="cert-logo-use-app">Pakai logo aplikasi</Button>}
            </div>
          </section>
          <section className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
            <div className="font-semibold">Latar & Warna</div>
            <div className="flex items-center gap-2">
              <FileUpload accept="image/png,image/jpeg" kind="public" label="Unggah Desain Latar" maxMB={10} testid="cert-template-upload" onUploaded={(p) => setLay((l) => ({ ...l, template_path: p }))} />
              {lay.template_path && <Button size="sm" variant="ghost" onClick={() => setLay({ ...lay, template_path: "" })} data-testid="cert-template-remove">Hapus</Button>}
            </div>
            <p className="text-xs text-slate-500">PNG/JPG A4 mendatar (3508×2480 px). Tanpa latar = bingkai bawaan.</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1"><Label className="text-xs">Warna Teks</Label><Input type="color" value={lay.text_color} onChange={(e) => setLay({ ...lay, text_color: e.target.value })} className="h-10 p-1" data-testid="cert-text-color" /></div>
              <div className="grid gap-1"><Label className="text-xs">Warna Aksen</Label><Input type="color" value={lay.accent_color} onChange={(e) => setLay({ ...lay, accent_color: e.target.value })} className="h-10 p-1" data-testid="cert-accent-color" /></div>
            </div>
            <p className="text-xs text-slate-500">Penandatangan diatur di panel Penanggung Jawab TTD (nama, jabatan, pangkat, NIP & gambar TTD).</p>
          </section>
        </div>
      </div>
    </div>
  );
}
