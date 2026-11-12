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

// ---------- Avatares ----------

// Solo se aceptan imágenes en base64 o URLs https (la foto la escribe cada usuario).
const safePhoto = p => (typeof p === "string" && (/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(p) || /^https:\/\/[^\s"'<>]+$/.test(p)) ? p : "");

const hue = s => [...String(s || "?")].reduce((h, c) => (h * 31 + c.codePointAt(0)) % 360, 7);

// Foto de perfil o, si no hay, un círculo con la inicial.
export function avatarHTML(name, photo, size = 30, seed = "") {
  const src = safePhoto(photo);
  if (src) return `<img class="av" src="${esc(src)}" alt="" style="--s:${size}px" referrerpolicy="no-referrer" loading="lazy">`;
  const initial = (firstGrapheme(name || "?") || "?").toUpperCase();
  return `<span class="av av-initial" style="--s:${size}px;--h:${hue(seed || name)}" aria-hidden="true">${esc(initial)}</span>`;
}

// Recorta una imagen al centro en cuadrado y la reduce (JPEG en base64, unos pocos KB).
export async function imageToAvatar(file, size = 128) {
  if (!file || !/^image\//.test(file.type)) throw new Error("El archivo no es una imagen.");
  let src;
  try {
    src = await createImageBitmap(file);
  } catch {
    src = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("No se pudo leer la imagen."));
      img.src = URL.createObjectURL(file);
    });
  }
  const w = src.width || src.naturalWidth, h = src.height || src.naturalHeight;
  const side = Math.min(w, h);
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  g.fillStyle = "#fff";
  g.fillRect(0, 0, size, size);
  g.imageSmoothingQuality = "high";
  g.drawImage(src, (w - side) / 2, (h - side) / 2, side, side, 0, 0, size, size);
  return c.toDataURL("image/jpeg", 0.85);
}

// Ventana de confirmación propia (en vez de window.confirm). Devuelve una promesa con true/false.
export function confirmDialog({ title, message = "", confirmLabel = "Aceptar", cancelLabel = "Cancelar", danger = false }) {
  return new Promise(resolve => {
    document.getElementById("confirm-dlg")?.remove();
    const dlg = document.createElement("dialog");
    dlg.id = "confirm-dlg";
    dlg.className = "dlg dlg-confirm";
    dlg.innerHTML = `
      <h2>${esc(title)}</h2>
      ${message ? `<p class="dlg-msg">${esc(message)}</p>` : ""}
      <div class="dlg-actions">
        <button class="btn" data-answer="no">${esc(cancelLabel)}</button>
        <button class="btn ${danger ? "danger-solid" : "primary"}" data-answer="yes">${esc(confirmLabel)}</button>
      </div>`;
    let answer = false;
    dlg.addEventListener("click", e => {
      const b = e.target.closest("[data-answer]");
      if (b) { answer = b.dataset.answer === "yes"; dlg.close(); return; }
      if (e.target === dlg) { // clic en el fondo
        const r = dlg.getBoundingClientRect();
        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dlg.close();
      }
    });
    dlg.addEventListener("close", () => { dlg.remove(); resolve(answer); });
    document.body.appendChild(dlg);
    dlg.showModal();
    dlg.querySelector('[data-answer="no"]').focus(); // por defecto, la opción segura
  });
}

// Grupos del usuario ordenados por nombre: [{ id, name }].
export const sortedGroups = groups => Object.entries(groups || {})
  .map(([id, g]) => ({ id, name: g.name || "Sin nombre" }))
  .sort((a, b) => a.name.localeCompare(b.name, "es"));

// <option> para elegir grupo.
export const groupOptionsHTML = (groups, selected) =>
  `<option value="">Sin grupo</option>` +
  sortedGroups(groups).map(g => `<option value="${esc(g.id)}" ${g.id === selected ? "selected" : ""}>${esc(g.name)}</option>`).join("");

export const pollUrl = id => `${location.origin}${location.pathname}${location.search}#/v/${id}`;
