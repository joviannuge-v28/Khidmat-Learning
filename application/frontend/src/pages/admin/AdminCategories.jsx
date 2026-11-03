import { useEffect, useState } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/common";
import { ConfirmDelete } from "@/pages/admin/ConfirmDelete";
import { api, errMsg } from "@/lib/api";

function CategoryRow({ c, onSaved, onDelete }) {
  const [edit, setEdit] = useState(false);
  const [name, setName] = useState(c.name);
  const save = async () => {
    await api.put(`/admin/categories/${c.id}`, { name, type: c.type });
    setEdit(false);
    onSaved();
  };
  return (
    <li className="flex items-center gap-2 py-2" data-testid={`category-row-${c.id}`}>
      {edit ? <Input value={name} onChange={(e) => setName(e.target.value)} className="h-9" data-testid={`category-edit-input-${c.id}`} /> : <span className="flex-1 text-sm">{c.name}</span>}
      {edit ? (
        <>
          <Button size="icon" variant="ghost" onClick={save} data-testid={`category-save-${c.id}`}><Check className="h-4 w-4 text-emerald-600" /></Button>
          <Button size="icon" variant="ghost" onClick={() => setEdit(false)}><X className="h-4 w-4" /></Button>
        </>
      ) : (
        <>
          <Button size="icon" variant="ghost" onClick={() => setEdit(true)} data-testid={`category-edit-${c.id}`}><Pencil className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" onClick={() => onDelete(c)} data-testid={`category-delete-${c.id}`}><Trash2 className="h-4 w-4 text-rose-600" /></Button>
        </>
      )}
    </li>
  );
}

function CategoryBox({ type, title, items, reload, onDelete }) {
  const [name, setName] = useState("");
  const add = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await api.post("/admin/categories", { name, type });
      setName("");
      reload();
    } catch (err) {
      toast.error(errMsg(err));
    }
  };
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6" data-testid={`category-box-${type}`}>
      <h2 className="font-bold text-slate-900 mb-4">{title}</h2>
      <form onSubmit={add} className="flex gap-2 mb-3">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nama kategori baru" data-testid={`category-new-input-${type}`} />
        <Button type="submit" className="bg-[#0F2942] hover:bg-[#0A1D30]" data-testid={`category-add-button-${type}`}><Plus className="h-4 w-4" /></Button>
      </form>
      <ul className="divide-y divide-slate-100">{items.map((c) => <CategoryRow key={c.id} c={c} onSaved={reload} onDelete={onDelete} />)}</ul>
    </div>
  );
}

export default function AdminCategories() {
  const [items, setItems] = useState([]);
  const [del, setDel] = useState(null);
  const load = () => api.get("/categories").then((r) => setItems(r.data));
  useEffect(() => {
    load();
  }, []);
  const remove = async () => {
    await api.delete(`/admin/categories/${del.id}`);
    setDel(null);
    load();
  };
  return (
    <div>
      <PageHeader title="Kategori" subtitle="Kelompokkan pelatihan dan bacaan KMS." />
      <div className="grid md:grid-cols-2 gap-6">
        <CategoryBox type="course" title="Kategori Pelatihan" items={items.filter((c) => c.type === "course")} reload={load} onDelete={setDel} />
        <CategoryBox type="kms" title="Kategori Bacaan KMS" items={items.filter((c) => c.type === "kms")} reload={load} onDelete={setDel} />
      </div>
      <ConfirmDelete open={!!del} onOpenChange={() => setDel(null)} title={`Hapus kategori "${del?.name}"?`} onConfirm={remove} />
    </div>
  );
}
