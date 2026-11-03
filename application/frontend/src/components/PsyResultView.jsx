import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer } from "recharts";
import { fmtDateTime } from "@/lib/api";

const LEVEL = { Rendah: "bg-rose-100 text-rose-800", Sedang: "bg-amber-100 text-amber-800", Tinggi: "bg-emerald-100 text-emerald-800" };

export const PsyResultView = ({ r }) => (
  <div className="space-y-6" data-testid="psy-result">
    <div className="grid lg:grid-cols-2 gap-6 items-center">
      <div className="h-80 bg-white rounded-xl border border-slate-200 p-2" data-testid="psy-radar-chart">
        <ResponsiveContainer>
          <RadarChart data={r.dimensions.map((d) => ({ name: d.name, nilai: d.percent }))} outerRadius="80%">
            <PolarGrid stroke="#cbd5e1" />
            <PolarAngleAxis dataKey="name" tick={{ fontSize: 12, fill: "#64748b" }} />
            <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
            <Radar dataKey="nilai" stroke="#0F2942" fill="#D97706" fillOpacity={0.45} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <div>
        <div className="text-xs uppercase tracking-widest text-amber-600 font-semibold">Dimensi Dominan</div>
        <div className="text-3xl font-extrabold text-slate-900 mt-1" data-testid="psy-dominant">{r.dominant}</div>
        <p className="text-sm text-slate-500 mt-1">{r.test_title} · {fmtDateTime(r.created_at)}</p>
      </div>
    </div>
    <div className="grid sm:grid-cols-2 gap-4">
      {r.dimensions.map((d) => (
        <div key={d.id} className="bg-white rounded-xl border border-slate-200 p-4" data-testid={`psy-dim-${d.id}`}>
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-slate-900">{d.name}</span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${LEVEL[d.level]}`}>{d.level}</span>
          </div>
          <div className="mt-3 h-2.5 rounded-full bg-slate-100 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${d.percent}%`, background: d.color }} /></div>
          <div className="mt-2 flex justify-between text-xs text-slate-500"><span>Skor {d.score} / {d.max}</span><span className="font-bold text-slate-800">{d.percent}%</span></div>
          {d.text && <p className="mt-2 text-sm text-slate-600">{d.text}</p>}
        </div>
      ))}
    </div>
  </div>
);
