import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";

export const SignerSelect = ({ value, onChange, testid = "signer-select" }) => {
  const [list, setList] = useState([]);
  useEffect(() => {
    api.get("/signers").then((r) => setList(r.data)).catch(() => setList([]));
  }, []);
  return (
    <div className="grid gap-2">
      <Label>Penandatangan Sertifikat (TTD)</Label>
      <Select value={value || "default"} onValueChange={(v) => onChange(v === "default" ? "" : v)}>
        <SelectTrigger data-testid={testid}><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="default">Bawaan (penandatangan pertama)</SelectItem>
          {list.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}{s.title ? ` — ${s.title}` : ""}</SelectItem>)}
        </SelectContent>
      </Select>
      <p className="text-xs text-slate-500">Daftar penandatangan dikelola admin di menu Desain Sertifikat.</p>
    </div>
  );
};
