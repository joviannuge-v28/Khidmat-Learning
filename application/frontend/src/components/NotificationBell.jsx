import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CalendarClock, ClipboardCheck, LifeBuoy, Radio } from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { api } from "@/lib/api";

const ICON = { upcoming: CalendarClock, live: Radio, evaluation: ClipboardCheck, support: LifeBuoy };
const SEEN = "lms-notif-seen";
const TOASTED = "lms-notif-toasted";
const readSet = (store, k) => new Set(JSON.parse(store.getItem(k) || "[]"));

export const NotificationBell = () => {
  const [items, setItems] = useState([]);
  const [seen, setSeen] = useState(() => readSet(localStorage, SEEN));
  const navigate = useNavigate();

  const load = useCallback(async () => {
    const { data } = await api.get("/my/notifications").catch(() => ({ data: [] }));
    setItems(data);
    const toasted = readSet(sessionStorage, TOASTED);
    data.filter((n) => n.urgent && !toasted.has(n.id)).forEach((n) => {
      toast.warning(n.title, { description: n.message, duration: 8000 });
      toasted.add(n.id);
    });
    sessionStorage.setItem(TOASTED, JSON.stringify([...toasted]));
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [load]);

  const unread = items.filter((n) => !seen.has(n.id)).length;
  const markSeen = (open) => {
    if (!open) return;
    const s = new Set([...seen, ...items.map((n) => n.id)]);
    setSeen(s);
    localStorage.setItem(SEEN, JSON.stringify([...s]));
  };

  return (
    <Popover onOpenChange={markSeen}>
      <PopoverTrigger asChild>
        <button className="relative p-2.5 rounded-full hover:bg-slate-100 transition-colors" aria-label="Notifikasi" data-testid="notification-bell">
          <Bell className="h-5 w-5 text-slate-700" />
          {unread > 0 && <span className="absolute top-1 right-1 h-5 min-w-5 px-1 rounded-full bg-rose-600 text-white text-[11px] font-bold grid place-items-center" data-testid="notification-count">{unread}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0" data-testid="notification-panel">
        <div className="px-4 py-3 border-b border-slate-200 font-bold text-slate-900">Notifikasi</div>
        {items.length === 0 ? <p className="p-6 text-sm text-slate-500 text-center" data-testid="notification-empty">Tidak ada notifikasi saat ini.</p> : (
          <ul className="max-h-96 overflow-y-auto divide-y divide-slate-100">
            {items.map((n) => {
              const Icon = ICON[n.type] || Bell;
              return (
                <li key={n.id}>
                  <button onClick={() => navigate(n.link)} className="w-full text-left px-4 py-3 flex gap-3 hover:bg-slate-50 transition-colors" data-testid={`notification-item-${n.id}`}>
                    <span className={`h-9 w-9 rounded-full grid place-items-center shrink-0 ${n.urgent ? "bg-rose-100 text-rose-700" : "bg-blue-50 text-blue-700"}`}><Icon className="h-4 w-4" /></span>
                    <span className="min-w-0"><span className="block text-sm font-semibold text-slate-900">{n.title}</span><span className="block text-xs text-slate-600 mt-0.5">{n.message}</span></span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
};
