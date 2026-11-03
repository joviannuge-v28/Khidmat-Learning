import { useEffect, useState } from "react";
import { CheckCircle2, Mail, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader, EmptyState } from "@/components/common";
import { ConfirmDelete } from "@/pages/admin/ConfirmDelete";
import { api, errMsg, fmtDateTime } from "@/lib/api";

export default function AdminSupport() {
  const [tab, setTab] = useState("new");
  const [items, setItems] = useState([]);
  const [del, setDel] = useState(null);
  const load = () => api.get("/admin/support-requests", { params: tab === "all" ? {} : { status: tab } }).then((r) => setItems(r.data));
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const setStatus = async (r, status) => {
    try {
      await api.patch(`/admin/support-requests/${r.id}`, { status, admin_note: r.admin_note || "" });
      toast.success(status === "done" ? "Ditandai selesai" : "Dibuka kembali");
      load();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const remove = async () => {
    await api.delete(`/admin/support-requests/${del.id}`);
    setDel(null);
    load();
  };

  return (
    <div>
      <PageHeader title="Laporan Pengguna" subtitle="Laporan dari halaman login (lupa kata sandi, akun terkunci, dll). Reset sandi melalui Kelola Pengguna." />
      <Tabs value={tab} onValueChange={setTab} className="mb-6">
        <TabsList>
          <TabsTrigger value="new" data-testid="support-tab-new">Baru</TabsTrigger>
          <TabsTrigger value="done" data-testid="support-tab-done">Selesai</TabsTrigger>
          <TabsTrigger value="all" data-testid="support-tab-all">Semua</TabsTrigger>
        </TabsList>
      </Tabs>
      {items.length === 0 ? <EmptyState icon={Mail} title="Tidak ada laporan" testid="support-empty" /> : (
        <div className="grid md:grid-cols-2 gap-4" data-testid="support-list">
          {items.map((r) => (
            <div key={r.id} className="bg-white rounded-xl border border-slate-200 p-5" data-testid={`support-item-${r.id}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-amber-700">{r.category}</div>
                  <div className="mt-1 font-bold text-slate-900">{r.name}</div>
                  <div className="text-sm text-slate-500">{r.nip ? `NIP ${r.nip} · ` : ""}{r.whatsapp && <a href={`https://wa.me/${r.whatsapp.replace(/\D/g, "").replace(/^0/, "62")}`} target="_blank" rel="noreferrer" className="text-emerald-700 font-semibold underline" data-testid={`support-wa-${r.id}`}>WA {r.whatsapp}</a>}{r.contact ? ` · ${r.contact}` : ""}</div>
                </div>
                <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${r.status === "done" ? "bg-emerald-100 text-emerald-800" : "bg-sky-100 text-sky-800"}`}>{r.status === "done" ? "Selesai" : "Baru"}</span>
              </div>
              <p className="mt-3 text-sm text-slate-700 whitespace-pre-line">{r.message}</p>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-xs text-slate-400">{fmtDateTime(r.created_at)}</span>
                <div className="flex gap-1">
                  {r.status === "new" ? (
                    <Button size="sm" variant="outline" onClick={() => setStatus(r, "done")} data-testid={`support-done-${r.id}`}><CheckCircle2 className="h-4 w-4 mr-1 text-emerald-600" />Selesai</Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => setStatus(r, "new")} data-testid={`support-reopen-${r.id}`}><RotateCcw className="h-4 w-4 mr-1" />Buka Lagi</Button>
                  )}
                  <Button size="icon" variant="ghost" onClick={() => setDel(r)} data-testid={`support-delete-${r.id}`}><Trash2 className="h-4 w-4 text-rose-600" /></Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <ConfirmDelete open={!!del} onOpenChange={() => setDel(null)} title="Hapus laporan ini?" onConfirm={remove} />
    </div>
  );
}
