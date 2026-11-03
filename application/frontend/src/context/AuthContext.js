import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, fileUrl } from "@/lib/api";
import { applyTheme } from "@/lib/theme";

const setFavicon = (href) => {
  ["icon", "apple-touch-icon"].forEach((rel) => {
    let link = document.querySelector(`link[rel='${rel}']`);
    if (!link) {
      link = document.createElement("link");
      link.rel = rel;
      document.head.appendChild(link);
    }
    link.href = href;
  });
};

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [settings, setSettings] = useState(null);

  const loadSettings = useCallback(async () => {
    const { data } = await api.get("/settings");
    setSettings(data);
    applyTheme(data.theme);
    document.title = data.app_name;
    setFavicon(data.logo_path ? fileUrl(data.logo_path) : "/favicon.svg");
  }, []);

  useEffect(() => {
    loadSettings().catch(() => setSettings({}));
    api.get("/auth/me").then((r) => setUser(r.data)).catch(() => setUser(false));
    const onExpired = () => setUser(false);
    window.addEventListener("auth:expired", onExpired);
    return () => window.removeEventListener("auth:expired", onExpired);
  }, [loadSettings]);

  const login = async (identifier, password) => {
    const { data } = await api.post("/auth/login", { identifier, password });
    setUser(data);
    return data;
  };

  const logout = async () => {
    await api.post("/auth/logout").catch(() => {});
    setUser(false);
  };

  return (
    <AuthCtx.Provider value={{ user, setUser, login, logout, settings, loadSettings }}>
      {children}
    </AuthCtx.Provider>
  );
}

export const useAuth = () => useContext(AuthCtx);
