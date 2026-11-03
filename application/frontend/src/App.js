import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import {
  Activity, BookText, ClipboardList, Mail, Server, Palette, ShieldAlert, Award, BarChart3, BookMarked, BookOpen, Brain, CheckCircle2, ClipboardCheck, Database, FolderTree, GraduationCap, LayoutDashboard, LayoutTemplate, Library, LifeBuoy, Lightbulb, PenTool, PlayCircle, Settings, ShieldCheck, User, Users, Video,
} from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import AppShell from "@/components/AppShell";
import { A11yWidget } from "@/components/A11yWidget";
import Login from "@/pages/Login";
import Verify from "@/pages/Verify";
import Dashboard from "@/pages/user/Dashboard";
import Catalog from "@/pages/user/Catalog";
import CourseDetail from "@/pages/user/CourseDetail";
import MyCourses from "@/pages/user/MyCourses";
import Readings from "@/pages/user/Readings";
import ReadingDetail from "@/pages/user/ReadingDetail";
import Profile from "@/pages/user/Profile";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminCourses from "@/pages/admin/AdminCourses";
import AdminCourseEditor from "@/pages/admin/AdminCourseEditor";
import AdminUsers from "@/pages/admin/AdminUsers";
import AdminReadings from "@/pages/admin/AdminReadings";
import AdminCategories from "@/pages/admin/AdminCategories";
import AdminCertificates from "@/pages/admin/AdminCertificates";
import AdminSettings from "@/pages/admin/AdminSettings";
import AdminZoom from "@/pages/admin/AdminZoom";
import AdminSupport from "@/pages/admin/AdminSupport";
import AdminBackup from "@/pages/admin/AdminBackup";
import Zoom from "@/pages/user/Zoom";
import MyProposals from "@/pages/user/MyProposals";
import PsyTests from "@/pages/user/PsyTests";
import Guide from "@/pages/user/Guide";
import AdminCertificateDesign from "@/pages/admin/AdminCertificateDesign";
import AdminPsyTests from "@/pages/admin/AdminPsyTests";
import AdminReports from "@/pages/admin/AdminReports";
import AdminEvaluation from "@/pages/admin/AdminEvaluation";
import AdminLanding from "@/pages/admin/AdminLanding";
import AdminSecurity from "@/pages/admin/AdminSecurity";
import AdminActivityLog from "@/pages/admin/AdminActivityLog";
import AdminSmtp from "@/pages/admin/AdminSmtp";
import AdminTheme from "@/pages/admin/AdminTheme";
import AdminGuide from "@/pages/admin/AdminGuide";
import VerifyEmail from "@/pages/VerifyEmail";
import SurveyPage from "@/components/Survey";
import AdminSurvey from "@/pages/admin/AdminSurvey";
import AdminDeployGuide from "@/pages/admin/AdminDeployGuide";

const USER_NAV = [
  { to: "/", end: true, label: "Dashboard", icon: LayoutDashboard, testid: "sidebar-nav-dashboard" },
  { to: "/pelatihan", label: "Daftar Pelatihan", icon: Library, testid: "sidebar-nav-pelatihan-daftar" },
  { to: "/sedang-diikuti", label: "Pelatihan Sedang Diikuti", icon: PlayCircle, testid: "sidebar-nav-pelatihan-diikuti", badge: "ongoing" },
  { to: "/selesai", label: "Pelatihan Sudah Diikuti", icon: CheckCircle2, testid: "sidebar-nav-pelatihan-selesai" },
  { to: "/zoom", label: "Webinar Zoom", icon: Video, testid: "sidebar-nav-zoom" },
  { to: "/tes-kepribadian", label: "Tes Kepribadian", icon: Brain, testid: "sidebar-nav-psy" },
  { section: "KMS" },
  { to: "/kms", label: "Daftar Bacaan", icon: BookOpen, testid: "sidebar-nav-kms-bacaan" },
  { section: "Akun" },
  { to: "/profil", label: "Profil", icon: User, testid: "sidebar-nav-profil" },
  { to: "/panduan", label: "Panduan", icon: BookMarked, testid: "sidebar-nav-panduan" },
];

const PIC_ITEM = { to: "/usulan", label: "Usulan OPD", icon: Lightbulb, testid: "sidebar-nav-usulan" };

const ADMIN_NAV = [
  { to: "/admin", end: true, label: "Dashboard Admin", icon: LayoutDashboard, testid: "admin-nav-dashboard" },
  { to: "/admin/pengguna", label: "Kelola ASN / Pengguna", icon: Users, testid: "admin-nav-users" },
  { to: "/admin/pelatihan", label: "Kelola Pelatihan", icon: GraduationCap, testid: "admin-nav-courses" },
  { to: "/admin/zoom", label: "Webinar Zoom", icon: Video, testid: "admin-nav-zoom" },
  { to: "/admin/evaluasi", label: "Evaluasi Webinar", icon: ClipboardCheck, testid: "admin-nav-evaluation" },
  { to: "/admin/tes-kepribadian", label: "Tes Kepribadian", icon: Brain, testid: "admin-nav-psy" },
  { to: "/admin/kms", label: "KMS & Persetujuan", icon: BookOpen, testid: "admin-nav-kms" },
  { to: "/admin/kategori", label: "Kategori", icon: FolderTree, testid: "admin-nav-categories" },
  { to: "/admin/sertifikat", label: "Sertifikat", icon: Award, testid: "admin-nav-certificates" },
  { to: "/admin/desain-sertifikat", label: "Desain Sertifikat", icon: PenTool, testid: "admin-nav-cert-design" },
  { to: "/admin/laporan-jp", label: "Laporan JP", icon: BarChart3, testid: "admin-nav-jp-report" },
  { to: "/admin/laporan", label: "Laporan Pengguna", icon: LifeBuoy, testid: "admin-nav-support", badge: "support_new" },
  { to: "/admin/survei", label: "Survei Kepuasan", icon: ClipboardList, testid: "admin-nav-survey" },
];

const SUPER_NAV = [
  { section: "Super Admin" },
  { to: "/admin/keamanan", label: "Security Monitoring", icon: ShieldAlert, testid: "admin-nav-security" },
  { to: "/admin/log-aktivitas", label: "Log Aktivitas Admin", icon: Activity, testid: "admin-nav-activity" },
  { to: "/admin/backup", label: "Backup & Recovery", icon: Database, testid: "admin-nav-backup" },
  { to: "/admin/smtp", label: "Konfigurasi SMTP", icon: Mail, testid: "admin-nav-smtp" },
  { to: "/admin/tema", label: "Tema & Logo", icon: Palette, testid: "admin-nav-theme" },
  { to: "/admin/konten-login", label: "Konten Login", icon: LayoutTemplate, testid: "admin-nav-landing" },
  { to: "/admin/pengaturan", label: "Pengaturan", icon: Settings, testid: "admin-nav-settings" },
  { to: "/admin/panduan-deploy", label: "Panduan Deploy Server", icon: Server, testid: "admin-nav-deploy-guide" },
];

const TAIL_NAV = [
  { section: "Lainnya" },
  { to: "/admin/panduan", label: "Panduan 2 (Admin)", icon: BookText, testid: "admin-nav-guide" },
  { to: "/", end: true, label: "Mode Pegawai", icon: User, testid: "admin-nav-user-mode" },
];

const ADMIN_ROLES = ["admin", "superadmin"];
const needsOnboarding = (u) => u && (u.must_change_password || (u.require_photo && !u.photo));

const Loading = () => <div className="min-h-screen grid place-items-center text-slate-500">Memuat...</div>;

function Protected({ admin, superOnly, pic, children }) {
  const { user } = useAuth();
  const loc = useLocation();
  if (user === null) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  if (needsOnboarding(user) && loc.pathname !== "/profil") return <Navigate to="/profil" replace />;
  if (admin && !ADMIN_ROLES.includes(user.role)) return <Navigate to="/" replace />;
  if (superOnly && user.role !== "superadmin") return <Navigate to="/admin" replace />;
  if (pic && user.role !== "pic") return <Navigate to="/" replace />;
  return children;
}

function UserShell() {
  const { user } = useAuth();
  const base = user?.role === "pic" ? [USER_NAV[0], USER_NAV[1], USER_NAV[4], USER_NAV[5], PIC_ITEM, ...USER_NAV.slice(6)] : USER_NAV;
  const items = ADMIN_ROLES.includes(user?.role)
    ? [...base, { section: "Admin" }, { to: "/admin", label: "Panel Admin", icon: ShieldCheck, testid: "sidebar-nav-admin" }]
    : base;
  return <AppShell items={items} label={user?.role === "pic" ? `PIC ${user.unit_kerja || "OPD"}` : "Pegawai"} />;
}

function AdminShell() {
  const { user } = useAuth();
  const items = user?.role === "superadmin" ? [...ADMIN_NAV, ...SUPER_NAV, ...TAIL_NAV] : [...ADMIN_NAV, ...TAIL_NAV];
  return <AppShell items={items} label={user?.role === "superadmin" ? "Super Admin" : "Administrator"} />;
}

const S = ({ children }) => <Protected admin superOnly>{children}</Protected>;

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/verifikasi/:id" element={<Verify />} />
          <Route path="/verifikasi-email/:token" element={<VerifyEmail />} />
          <Route path="/survei" element={<SurveyPage />} />
          <Route element={<Protected><UserShell /></Protected>}>
            <Route index element={<Dashboard />} />
            <Route path="pelatihan" element={<Catalog />} />
            <Route path="pelatihan/:id" element={<CourseDetail />} />
            <Route path="sedang-diikuti" element={<MyCourses status="ongoing" />} />
            <Route path="selesai" element={<MyCourses status="completed" />} />
            <Route path="kms" element={<Readings />} />
            <Route path="kms/:id" element={<ReadingDetail />} />
            <Route path="profil" element={<Profile />} />
            <Route path="zoom" element={<Zoom />} />
            <Route path="usulan" element={<Protected pic><MyProposals /></Protected>} />
            <Route path="usulan/pelatihan/baru" element={<Protected pic><AdminCourseEditor propose /></Protected>} />
            <Route path="usulan/pelatihan/:id" element={<Protected pic><AdminCourseEditor propose /></Protected>} />
            <Route path="tes-kepribadian" element={<PsyTests />} />
            <Route path="panduan" element={<Guide />} />
          </Route>
          <Route path="/admin" element={<Protected admin><AdminShell /></Protected>}>
            <Route index element={<AdminDashboard />} />
            <Route path="pelatihan" element={<AdminCourses />} />
            <Route path="pelatihan/baru" element={<AdminCourseEditor />} />
            <Route path="pelatihan/:id" element={<AdminCourseEditor />} />
            <Route path="pengguna" element={<AdminUsers />} />
            <Route path="kms" element={<AdminReadings />} />
            <Route path="kategori" element={<AdminCategories />} />
            <Route path="sertifikat" element={<AdminCertificates />} />
            <Route path="pengaturan" element={<S><AdminSettings /></S>} />
            <Route path="keamanan" element={<S><AdminSecurity /></S>} />
            <Route path="log-aktivitas" element={<S><AdminActivityLog /></S>} />
            <Route path="smtp" element={<S><AdminSmtp /></S>} />
            <Route path="tema" element={<S><AdminTheme /></S>} />
            <Route path="panduan" element={<AdminGuide />} />
            <Route path="zoom" element={<AdminZoom />} />
            <Route path="laporan" element={<AdminSupport />} />
            <Route path="backup" element={<S><AdminBackup /></S>} />
            <Route path="desain-sertifikat" element={<AdminCertificateDesign />} />
            <Route path="tes-kepribadian" element={<AdminPsyTests />} />
            <Route path="laporan-jp" element={<AdminReports />} />
            <Route path="evaluasi" element={<AdminEvaluation />} />
            <Route path="konten-login" element={<S><AdminLanding /></S>} />
            <Route path="survei" element={<AdminSurvey />} />
            <Route path="panduan-deploy" element={<S><AdminDeployGuide /></S>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <A11yWidget />
      <Toaster position="top-right" richColors />
    </AuthProvider>
  );
}

export default App;
