export const THEME_DEFAULT = { primary: "#0F2942", sidebar: "#0B1E33", nav: "#2563EB", accent: "#F59E0B" };

export function applyTheme(theme) {
  let el = document.getElementById("app-theme");
  if (!el) {
    el = document.createElement("style");
    el.id = "app-theme";
    document.head.appendChild(el);
  }
  if (!theme || !Object.keys(theme).length) {
    el.textContent = "";
    return;
  }
  const t = { ...THEME_DEFAULT, ...theme };
  el.textContent = `
.bg-\\[\\#0F2942\\]{background-color:${t.primary}!important}
.hover\\:bg-\\[\\#0A1D30\\]:hover{background-color:${t.primary}!important;filter:brightness(.85)}
.from-\\[\\#0F2942\\]{--tw-gradient-from:${t.primary} var(--tw-gradient-from-position)!important}
.bg-\\[\\#0B1E33\\]{background-color:${t.sidebar}!important}
.bg-\\[\\#081626\\]{background-color:${t.sidebar}!important;filter:brightness(.8)}
.sidebar-dark .bg-blue-600{background-color:${t.nav}!important}
.bg-amber-500{background-color:${t.accent}!important}
.text-amber-400{color:${t.accent}!important}`;
}
