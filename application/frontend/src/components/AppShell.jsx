import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { LogOut, Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Brand, UserAvatar } from "@/components/common";
import { useAuth } from "@/context/AuthContext";
import { NotificationBell } from "@/components/NotificationBell";
import { AsnFooter } from "@/components/Survey";
import { api } from "@/lib/api";

function useBadges() {
  const [b, setB] = useState({});
  const loc = useLocation();
  useEffect(() => {
    const load = () => api.get("/my/badges").then((r) => setB(r.data)).catch(() => {});
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [loc.pathname]);
  return b;
}

const NavList = ({ items, onNavigate, onLogout, badges = {} }) => (
  <nav className="flex flex-col gap-1">
    {items.map((it) =>
      it.section ? (
        <div key={it.section} className="px-3 pt-5 pb-1 text-[11px] font-semibold uppercase tracking-widest text-slate-500">{it.section}</div>
      ) : (
        <NavLink
          key={it.to}
          to={it.to}
          end={it.end}
          onClick={onNavigate}
          data-testid={it.testid}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
              isActive ? "bg-blue-600 text-white shadow-md shadow-blue-900/30 font-medium" : "text-slate-300 hover:bg-slate-800 hover:text-white"
            }`
          }
        >
          <it.icon className="h-4 w-4 shrink-0" />
          <span className="truncate flex-1">{it.label}</span>
          {it.badge && badges[it.badge] > 0 && (
            <span className="ml-auto h-5 min-w-5 px-1.5 rounded-full bg-rose-600 text-white text-[11px] font-bold grid place-items-center" title="Belum selesai" data-testid={`${it.testid}-badge`}>{badges[it.badge]}</span>
          )}
        </NavLink>
      )
    )}
    <button
      onClick={onLogout}
      data-testid="sidebar-nav-logout"
      className="mt-4 flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-rose-300 hover:bg-rose-500/10 hover:text-rose-200 transition-colors"
    >
      <LogOut className="h-4 w-4" /> Keluar
    </button>
  </nav>
);

const SidebarBody = ({ items, onNavigate, onLogout, badges }) => {
  const { user } = useAuth();
  return (
    <div className="sidebar-dark flex flex-col h-full bg-[#0B1E33] text-slate-100 no-print">
      <div className="p-5 border-b border-white/5"><Brand dark /></div>
      <div className="flex-1 overflow-y-auto p-4"><NavList items={items} onNavigate={onNavigate} onLogout={onLogout} badges={badges} /></div>
      <div className="p-4 border-t border-white/5 flex items-center gap-3">
        <UserAvatar user={user} size="h-9 w-9" />
        <div className="min-w-0">
          <div className="text-sm font-semibold truncate">{user?.name}</div>
          <div className="text-xs text-slate-400 truncate">{user?.nip ? `NIP ${user.nip}` : user?.email}</div>
        </div>
      </div>
    </div>
  );
};

export default function AppShell({ items, label }) {
  const { user, logout, settings } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const badges = useBadges();

  const doLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-slate-50 lg:pl-72 flex flex-col">
      <aside className="hidden lg:block fixed inset-y-0 left-0 w-72 z-30">
        <SidebarBody items={items} badges={badges} onLogout={() => setConfirm(true)} />
      </aside>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="p-0 w-72 border-0">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <SidebarBody items={items} badges={badges} onNavigate={() => setOpen(false)} onLogout={() => { setOpen(false); setConfirm(true); }} />
        </SheetContent>
      </Sheet>

      <header className="no-print h-16 sm:h-20 bg-white/90 backdrop-blur-md border-b border-slate-200 sticky top-0 z-20 px-4 sm:px-8 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <button className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-slate-100" onClick={() => setOpen(true)} data-testid="mobile-menu-button">
            <Menu className="h-5 w-5" />
          </button>
          <div className="lg:hidden"><Brand compact /></div>
          <span className="hidden sm:inline-flex text-xs font-semibold uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">{label}</span>
          {settings?.announcement && (
            <p className="hidden xl:block text-sm text-slate-500 truncate max-w-xl" data-testid="header-announcement">{settings.announcement}</p>
          )}
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
        <NotificationBell />
        <button onClick={() => navigate("/profil")} className="flex items-center gap-3 rounded-full hover:bg-slate-100 pl-3 pr-1 py-1 transition-colors" data-testid="header-profile-button">
          <div className="text-right hidden sm:block">
            <div className="text-sm font-semibold text-slate-800 leading-tight">{user?.name}</div>
            <div className="text-xs text-slate-500">{user?.role === "superadmin" ? "Super Admin" : user?.role === "admin" ? "Administrator" : user?.role === "pic" ? `PIC ${user?.unit_kerja || "OPD"}` : user?.jabatan || "Pegawai"}</div>
          </div>
          <UserAvatar user={user} />
        </button>
        </div>
      </header>

      <main className="flex-1 w-full p-4 sm:p-6 lg:p-10 max-w-[1400px]"><Outlet /></main>
      <AsnFooter />

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent data-testid="logout-confirm-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Keluar dari aplikasi?</AlertDialogTitle>
            <AlertDialogDescription>Anda perlu login kembali untuk melanjutkan pelatihan.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="logout-cancel-button">Batal</AlertDialogCancel>
            <AlertDialogAction onClick={doLogout} className="bg-rose-600 hover:bg-rose-700" data-testid="logout-confirm-button">Keluar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
