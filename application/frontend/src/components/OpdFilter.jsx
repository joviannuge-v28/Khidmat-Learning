import { useEffect, useRef, useState } from "react";
import { Building2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { api } from "@/lib/api";

export const OpdFilter = ({ value, onChange }) => {
  const [opds, setOpds] = useState([]);
  const [open, setOpen] = useState(false);
  const anchor = useRef(null);
  useEffect(() => {
    api.get("/admin/users/opd").then((r) => setOpds(r.data)).catch(() => {});
  }, []);
  const kw = value.trim().toLowerCase();
  const matches = opds.filter((o) => !kw || o.name.toLowerCase().includes(kw));

  return (
    <Popover open={open && matches.length > 0} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div ref={anchor} className="relative md:w-80">
          <Building2 className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input value={value} onChange={(e) => { onChange(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onClick={() => setOpen(true)}
            placeholder="Filter OPD / Unit Kerja (kata kunci)" className="pl-9 pr-9 h-11 bg-white" data-testid="admin-user-opd-filter-input" />
          {value && <button type="button" onClick={() => onChange("")} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-slate-100" aria-label="Hapus filter OPD" data-testid="admin-user-opd-clear"><X className="h-4 w-4 text-slate-500" /></button>}
        </div>
      </PopoverAnchor>
      <PopoverContent align="start" className="p-1 w-80 max-h-72 overflow-y-auto" onOpenAutoFocus={(e) => e.preventDefault()} onInteractOutside={(e) => { if (anchor.current?.contains(e.target)) e.preventDefault(); }} data-testid="admin-user-opd-list">
        {matches.map((o) => (
          <button key={o.name} type="button" onClick={() => { onChange(o.name); setOpen(false); }}
            className="w-full text-left px-3 py-2 rounded-md text-sm hover:bg-slate-100 flex justify-between gap-3" data-testid={`admin-user-opd-option-${o.name.replace(/\s+/g, "-").toLowerCase()}`}>
            <span className="truncate">{o.name}</span><span className="text-xs text-slate-500 shrink-0">{o.count} akun</span>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
};
