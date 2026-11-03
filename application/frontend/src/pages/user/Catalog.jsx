import { useEffect, useState } from "react";
import { Search, Library } from "lucide-react";
import { Input } from "@/components/ui/input";
import { PageHeader, EmptyState } from "@/components/common";
import { CourseCard } from "@/components/CourseCard";
import { api } from "@/lib/api";

export default function Catalog() {
  const [courses, setCourses] = useState(null);
  const [cats, setCats] = useState([]);
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("");

  useEffect(() => {
    api.get("/categories?type=course").then((r) => setCats(r.data));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      api.get("/courses", { params: { search, category_id: cat } }).then((r) => setCourses(r.data));
    }, 250);
    return () => clearTimeout(t);
  }, [search, cat]);

  const pill = (active) => `px-4 py-2 rounded-full text-sm font-medium border transition-colors whitespace-nowrap ${active ? "bg-[#0F2942] text-white border-[#0F2942]" : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"}`;

  return (
    <div>
      <PageHeader title="Daftar Pelatihan" subtitle="Pilih pelatihan untuk meningkatkan kompetensi Anda." />
      <div className="flex flex-col md:flex-row gap-4 md:items-center mb-8">
        <div className="relative md:w-80">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari pelatihan..." className="pl-9 h-11 bg-white" data-testid="catalog-search-input" />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button className={pill(!cat)} onClick={() => setCat("")} data-testid="catalog-cat-all">Semua</button>
          {cats.map((c) => <button key={c.id} className={pill(cat === c.id)} onClick={() => setCat(c.id)} data-testid={`catalog-cat-${c.id}`}>{c.name}</button>)}
        </div>
      </div>
      {courses === null ? (
        <div className="text-slate-500">Memuat...</div>
      ) : courses.length === 0 ? (
        <EmptyState icon={Library} title="Pelatihan tidak ditemukan" text="Coba kata kunci atau kategori lain." testid="catalog-empty" />
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-6" data-testid="catalog-grid">
          {courses.map((c) => <CourseCard key={c.id} course={c} status={c.enrollment_status} progress={c.progress} />)}
        </div>
      )}
    </div>
  );
}
