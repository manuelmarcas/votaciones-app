export const $ = (sel, root = document) => root.querySelector(sel);

export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

let toastTimer = null;
export function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2600);
}

const ERRORS = {
  "permission-denied": "Permiso denegado. Si acabas de instalar la app, revisa que las reglas de Firestore (firestore.rules) estén publicadas.",
  "unavailable": "Sin conexión con el servidor. Comprueba tu conexión a internet.",
  "not-found": "La votación ya no existe.",
  "auth/popup-closed-by-user": "Has cerrado la ventana de Google antes de terminar.",
  "auth/popup-blocked": "El navegador ha bloqueado la ventana de Google. Permite las ventanas emergentes e inténtalo de nuevo.",
  "auth/unauthorized-domain": "Este dominio no está autorizado en Firebase Authentication (Configuración > Dominios autorizados).",
};
export const errMsg = e => ERRORS[e?.code] || `Error: ${e?.code || e?.message || e}`;

// Primer grafema de un texto (para los iconos que se pegan a mano).
export function firstGrapheme(s) {
  s = (s || "").trim();
  if (!s) return "";
  if (typeof Intl !== "undefined" && Intl.Segmenter) {
    for (const { segment } of new Intl.Segmenter("es", { granularity: "grapheme" }).segment(s)) return segment;
  }
  return [...s][0];
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    window.prompt("Copia este enlace:", text);
    return false;
  }
}

// Grupos del usuario ordenados por nombre: [{ id, name }].
export const sortedGroups = groups => Object.entries(groups || {})
  .map(([id, g]) => ({ id, name: g.name || "Sin nombre" }))
  .sort((a, b) => a.name.localeCompare(b.name, "es"));

// <option> para elegir grupo.
export const groupOptionsHTML = (groups, selected) =>
  `<option value="">Sin grupo</option>` +
  sortedGroups(groups).map(g => `<option value="${esc(g.id)}" ${g.id === selected ? "selected" : ""}>📁 ${esc(g.name)}</option>`).join("");

export const pollUrl = id => `${location.origin}${location.pathname}${location.search}#/v/${id}`;
