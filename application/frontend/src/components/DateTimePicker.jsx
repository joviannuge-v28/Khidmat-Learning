import { CalendarDays } from "lucide-react";
import { id as idLocale } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fmtDate } from "@/lib/api";

const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const HOURS = Array.from({ length: 24 }, (_, i) => pad(i));
const MINUTES = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];

export const DateTimePicker = ({ value, onChange, testid = "datetime" }) => {
  const [date, time] = (value || "").split("T");
  const d = date ? new Date(`${date}T00:00`) : undefined;
  const [h, m] = (time || "08:00").slice(0, 5).split(":");
  const emit = (nd, nh = h, nm = m) => onChange(nd ? `${ymd(nd)}T${nh}:${nm}` : "");
  const mins = MINUTES.includes(m) ? MINUTES : [...MINUTES, m].sort();

  return (
    <div className="grid grid-cols-[1fr_auto_auto] gap-2 items-center">
      <Popover>
        <PopoverTrigger asChild>
          <Button type="button" variant="outline" className="justify-start font-normal h-10 min-w-0" data-testid={`${testid}-date-button`}>
            <CalendarDays className="h-4 w-4 mr-2 shrink-0" /><span className="truncate">{d ? fmtDate(d.toISOString()) : "Pilih tanggal"}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={d} onSelect={(x) => x && emit(x)} locale={idLocale} initialFocus data-testid={`${testid}-calendar`} />
        </PopoverContent>
      </Popover>
      <Select value={h} onValueChange={(v) => emit(d || new Date(), v, m)}>
        <SelectTrigger className="w-[72px]" data-testid={`${testid}-hour`}><SelectValue /></SelectTrigger>
        <SelectContent className="max-h-64">{HOURS.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
      </Select>
      <Select value={m} onValueChange={(v) => emit(d || new Date(), h, v)}>
        <SelectTrigger className="w-[72px]" data-testid={`${testid}-minute`}><SelectValue /></SelectTrigger>
        <SelectContent className="max-h-64">{mins.map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
};
