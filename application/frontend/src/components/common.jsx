import { useState } from "react";
import { Landmark } from "lucide-react";
import { fileUrl } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export const Brand = ({ dark = false, compact = false }) => {
  const { settings } = useAuth();
  const name = settings?.app_name || "LMS Khidmat Kota Dumai";
  return (
    <div className="flex items-center gap-3 min-w-0" data-testid="brand">
      {settings?.logo_path ? (
        <img src={fileUrl(settings.logo_path)} alt="Logo" className="h-10 w-10 object-contain shrink-0" data-testid="brand-logo" />
      ) : (
        <div className="h-10 w-10 rounded-lg bg-amber-500 text-slate-900 grid place-items-center shrink-0">
          <Landmark className="h-5 w-5" />
        </div>
      )}
      {!compact && (
        <div className="min-w-0 leading-tight">
          <div className={`font-extrabold text-sm tracking-tight truncate ${dark ? "text-white" : "text-slate-900"}`}>{name}</div>
          <div className={`text-[11px] uppercase tracking-widest ${dark ? "text-amber-400" : "text-amber-600"}`}>LMS &amp; KMS</div>
        </div>
      )}
    </div>
  );
};

export const UserAvatar = ({ user, size = "h-10 w-10" }) => {
  const [broken, setBroken] = useState("");
  const initials = (user?.name || "?").split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();
  return user?.photo && broken !== user.photo ? (
    <img src={fileUrl(user.photo)} alt={user.name} onError={() => setBroken(user.photo)} className={`${size} rounded-full object-cover ring-2 ring-white shrink-0`} />
  ) : (
    <div className={`${size} rounded-full bg-blue-100 text-blue-800 font-bold grid place-items-center ring-2 ring-white shrink-0 text-sm`}>{initials}</div>
  );
};

export const EmptyState = ({ icon: Icon, title, text, action, testid }) => (
  <div className="text-center py-14 px-6 border border-dashed border-slate-300 rounded-2xl bg-white" data-testid={testid}>
    {Icon && <Icon className="h-10 w-10 mx-auto text-slate-400" />}
    <h3 className="mt-3 font-semibold text-slate-800">{title}</h3>
    {text && <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">{text}</p>}
    {action && <div className="mt-5">{action}</div>}
  </div>
);

export const PageHeader = ({ title, subtitle, action }) => (
  <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8 fade-up">
    <div>
      <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">{title}</h1>
      {subtitle && <p className="text-sm sm:text-base text-slate-500 mt-1">{subtitle}</p>}
    </div>
    {action}
  </div>
);

export const StatCard = ({ icon: Icon, label, value, tone = "blue", testid }) => {
  const tones = {
    blue: "bg-blue-50 text-blue-700",
    amber: "bg-amber-50 text-amber-700",
    emerald: "bg-emerald-50 text-emerald-700",
    slate: "bg-slate-100 text-slate-700",
    rose: "bg-rose-50 text-rose-700",
  };
  return (
    <div className="bg-white p-5 sm:p-6 rounded-xl border border-slate-200/80 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-[box-shadow,transform] duration-200" data-testid={testid}>
      <div className={`h-10 w-10 rounded-lg grid place-items-center ${tones[tone]}`}><Icon className="h-5 w-5" /></div>
      <div className="mt-4 text-3xl font-extrabold text-slate-900 tracking-tight">{value}</div>
      <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mt-1">{label}</div>
    </div>
  );
};
