import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Eye, PlusCircle, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader, EmptyState } from "@/components/common";
import { ReadingFormDialog } from "@/components/ReadingFormDialog";
import { api, fileUrl, fmtDate } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const STATUS = {
  pending: ["Menunggu", "bg-amber-100 text-amber-800"],
  approved: ["Disetujui", "bg-emerald-100 text-emerald-800"],
  rejected: ["Ditolak", "bg-rose-100 text-rose-800"],
};

export const StatusBadge = ({ status }) => {
  const [t, c] = STATUS[status] || [status, "bg-slate-100"];
  return <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${c}`}>{t}</span>;
};

export const ReadingCard = ({ r }) => (
  <Link to={`/kms/${r.id}`} className="group flex flex-col bg-white rounded-xl border border-slate-200/80 overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-[box-shadow,transform] duration-300" data-testid={`reading-card-${r.id}`}>
    <div className="aspect-[4/3] bg-slate-100 overflow-hidden">
      {r.cover ? <img src={fileUrl(r.cover)} alt={r.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        : <div className="w-full h-full grid place-items-center bg-gradient-to-br from-amber-100 to-amber-50"><BookOpen className="h-10 w-10 text-amber-600" /></div>}
    </div>
    <div className="p-4 flex-1 flex flex-col">
      {r.category_name && <div className="text-[11px] font-semibold uppercase tracking-wider text-blue-700">{r.category_name}</div>}
      <div className="mt-1 font-bold text-slate-900 leading-snug line-clamp-2">{r.title}</div>
      <p className="mt-1 text-xs text-slate-500 line-clamp-2">{r.summary}</p>
      <div className="mt-auto pt-3 flex items-center justify-between text-xs text-slate-400">
        <span>{r.author || "-"}</span><span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5" />{r.views || 0}</span>
      </div>
    </div>
  </Link>
);

function Library() {
  const [items, setItems] = useState(null);
  const [cats, setCats] = useState([]);
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("");

  useEffect(() => {
    api.get("/categories?type=kms").then((r) => setCats(r.data));
  }, []);
  useEffect(() => {
    const t = setTimeout(() => {
      api.get("/readings", { params: { search, category_id: cat } }).then((r) => setItems(r.data));
    }, 250);
    return () => clearTimeout(t);
  }, [search, cat]);

  const pill = (a) => `px-4 py-2 rounded-full text-sm font-medium border transition-colors whitespace-nowrap ${a ? "bg-[#0F2942] text-white border-[#0F2942]" : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"}`;
  return (
    <>
      <div className="flex flex-col md:flex-row gap-4 md:items-center mb-6">
        <div className="relative md:w-80">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari bacaan..." className="pl-9 h-11 bg-white" data-testid="kms-search-input" />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button className={pill(!cat)} onClick={() => setCat("")} data-testid="kms-cat-all">Semua</button>
          {cats.map((c) => <button key={c.id} className={pill(cat === c.id)} onClick={() => setCat(c.id)} data-testid={`kms-cat-${c.id}`}>{c.name}</button>)}
        </div>
      </div>
      {items === null ? <div className="text-slate-500">Memuat...</div>
        : items.length === 0 ? <EmptyState icon={BookOpen} title="Bacaan tidak ditemukan" testid="kms-empty" />
        : <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5" data-testid="kms-grid">{items.map((r) => <ReadingCard key={r.id} r={r} />)}</div>}
    </>
  );
}

function MyProposals({ refreshKey }) {
  const [items, setItems] = useState(null);
  useEffect(() => {
    api.get("/readings/mine").then((r) => setItems(r.data));
  }, [refreshKey]);
  if (!items) return <div className="text-slate-500">Memuat...</div>;
  if (!items.length) return <EmptyState icon={PlusCircle} title="Belum ada usulan" text="Bagikan pengetahuan Anda dengan mengusulkan bacaan baru." testid="kms-proposals-empty" />;
  return (
    <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-100" data-testid="kms-proposals-list">
      {items.map((r) => (
        <div key={r.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="font-semibold text-slate-800">{r.title}</div>
            <div className="text-xs text-slate-500">Diusulkan {fmtDate(r.created_at)}{r.review_note ? ` · Catatan admin: ${r.review_note}` : ""}</div>
          </div>
          <StatusBadge status={r.status} />
        </div>
      ))}
    </div>
  );
}

export default function Readings() {
  const { user } = useAuth();
  const canPropose = user?.role === "pic";
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState(0);
  return (
    <div>
      <PageHeader
        title="KMS · Daftar Bacaan"
        subtitle="Perpustakaan pengetahuan aparatur Pemerintah Kota Dumai."
        action={canPropose && <Button onClick={() => setOpen(true)} className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold" data-testid="propose-kms-reading-button"><PlusCircle className="h-4 w-4 mr-2" />Usulkan Bacaan</Button>}
      />
      {!canPropose ? <Library /> : (
      <Tabs defaultValue="library">
        <TabsList className="mb-6">
          <TabsTrigger value="library" data-testid="kms-tab-library">Perpustakaan</TabsTrigger>
          <TabsTrigger value="mine" data-testid="kms-tab-mine">Usulan OPD</TabsTrigger>
        </TabsList>
        <TabsContent value="library"><Library /></TabsContent>
        <TabsContent value="mine"><MyProposals refreshKey={key} /></TabsContent>
      </Tabs>
      )}
      {canPropose && <ReadingFormDialog open={open} onOpenChange={setOpen} onSaved={() => setKey((k) => k + 1)} />}
    </div>
  );
}
