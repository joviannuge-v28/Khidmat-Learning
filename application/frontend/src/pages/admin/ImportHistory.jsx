import { useEffect, useState } from "react";
import { ChevronDown, History } from "lucide-react";
import { api, fmtDateTime } from "@/lib/api";

function LogRow({ l }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="py-3" data-testid={`import-log-${l.id}`}>
      <button type="button" onClick={() => setOpen(!open)} className="w-full text-left flex items-start justify-between gap-3" data-testid={`import-log-toggle-${l.id}`}>
        <div className="min-w-0">
          <div className="font-semibold text-slate-900 text-sm truncate">{l.filename}</div>
          <div className="text-xs text-slate-500">{fmtDateTime(l.created_at)} · oleh {l.admin_name}{l.update_existing ? "" : " · tanpa pembaruan"}</div>
          <div className="mt-1 flex flex-wrap gap-3 text-xs font-semibold">
            <span className="text-emerald-700">{l.created} ditambahkan</span><span className="text-blue-700">{l.updated} diperbarui</span><span className="text-rose-700">{l.failed} gagal</span>
          </div>
        </div>
        <ChevronDown className={`h-4 w-4 mt-1 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <ul className="mt-2 max-h-48 overflow-y-auto text-xs space-y-1 pl-3 border-l-2 border-slate-200" data-testid={`import-log-detail-${l.id}`}>
          {l.changes.map((c, i) => (
            <li key={`c${i}`}><span className={c.action === "created" ? "text-emerald-700" : "text-blue-700"}>{c.action === "created" ? "Ditambahkan" : "Diperbarui"}</span> · {c.name} {c.nip && <span className="font-mono text-slate-500">{c.nip}</span>}{c.fields.length > 0 && <span className="text-slate-500"> ({c.fields.map((f) => (f === "unit_kerja" ? "Unit Kerja" : "Jabatan")).join(", ")})</span>}</li>
          ))}
          {l.errors.map((e, i) => <li key={`e${i}`} className="text-rose-700">Baris {e.row} · {e.name} — {e.error}</li>)}
          {!l.changes.length && !l.errors.length && <li className="text-slate-500">Tidak ada perubahan.</li>}
        </ul>
      )}
    </li>
  );
}

export const ImportHistory = ({ refreshKey }) => {
  const [logs, setLogs] = useState(null);
  useEffect(() => {
    api.get("/admin/users/import-logs").then((r) => setLogs(r.data));
  }, [refreshKey]);
  if (!logs) return <div className="text-sm text-slate-500 py-4">Memuat riwayat...</div>;
  if (!logs.length) return <div className="text-sm text-slate-500 py-8 text-center" data-testid="import-history-empty"><History className="h-8 w-8 mx-auto mb-2 text-slate-400" />Belum ada riwayat impor.</div>;
  return <ul className="divide-y divide-slate-100" data-testid="import-history-list">{logs.map((l) => <LogRow key={l.id} l={l} />)}</ul>;
};
