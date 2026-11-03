import axios from "axios";
import { toast } from "sonner";

export const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
export const api = axios.create({ baseURL: API, withCredentials: true });

const NO_RETRY = ["/auth/login", "/auth/refresh", "/auth/logout"];
let refreshing = null;

api.interceptors.response.use(
  (r) => r,
  async (err) => {
    const cfg = err.config || {};
    if (err.response?.status === 401 && !cfg._retry && !NO_RETRY.some((u) => cfg.url?.includes(u))) {
      cfg._retry = true;
      refreshing = refreshing || api.post("/auth/refresh").finally(() => { refreshing = null; });
      try {
        await refreshing;
        return api(cfg);
      } catch (e) {
        window.dispatchEvent(new Event("auth:expired"));
      }
    }
    return Promise.reject(err);
  }
);

export const fileUrl = (p) => {
  if (!p) return "";
  if (p.startsWith("http") || p.startsWith("/")) return p;
  return `${API}/files/${p}`;
};

export function errMsg(e, fallback = "Terjadi kesalahan. Silakan coba lagi.") {
  const d = e?.response?.data?.detail;
  if (d == null) return fallback;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) return d.map((x) => x?.msg || JSON.stringify(x)).join(" ");
  if (typeof d?.msg === "string") return d.msg;
  return String(d);
}

const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
export const fmtDate = (iso) => {
  if (!iso) return "-";
  const d = new Date(iso);
  return `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
};

export const fmtDateTime = (s) => {
  if (!s) return "-";
  const d = new Date(s);
  return `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}, ${String(d.getHours()).padStart(2, "0")}.${String(d.getMinutes()).padStart(2, "0")}`;
};

export async function downloadFromApi(path, fallback = "download") {
  const res = await api.get(path, { responseType: "blob" });
  const name = /filename="([^"]+)"/.exec(res.headers["content-disposition"] || "")?.[1] || fallback;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(res.data);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export async function openPdfPost(path, body) {
  const win = window.open("", "_blank");
  try {
    const res = await api.post(path, body, { responseType: "blob" });
    const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
    if (win) win.location.href = url;
    else window.location.href = url;
  } catch (e) {
    win?.close();
    throw e;
  }
}

export const certUrl = (enrollmentId) => `${API}/certificates/${enrollmentId}/pdf`;

export async function downloadCert(ev) {
  ev.preventDefault();
  const url = ev.currentTarget.href;
  let res;
  try {
    res = await api.get(url.replace(API, ""), { responseType: "blob" });
  } catch (e) {
    const text = await e?.response?.data?.text?.().catch(() => "");
    let msg = "Gagal mengunduh sertifikat";
    try { msg = JSON.parse(text).detail || msg; } catch (x) { /* not json */ }
    toast.error(msg);
    return;
  }
  const name = /filename="([^"]+)"/.exec(res.headers["content-disposition"] || "")?.[1] || "sertifikat.pdf";
  const a = document.createElement("a");
  a.href = URL.createObjectURL(res.data);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

export async function uploadFile(file, kind = "private") {
  const fd = new FormData();
  fd.append("file", file);
  const { data } = await api.post(`/upload?kind=${kind}`, fd);
  return data;
}
