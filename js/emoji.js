// Selector de emojis completo (todos los de Unicode, como WhatsApp): categorías, búsqueda en
// español, tonos de piel y "usados recientemente". Usa emoji-picker-element (Apache-2.0),
// que se carga la primera vez que se abre y luego queda en la caché del navegador.

const LIB = "https://cdn.jsdelivr.net/npm/emoji-picker-element@1.29.1";
const DATA = "https://cdn.jsdelivr.net/npm/emoji-picker-element-data@1.8.0/es/cldr/data.json";

let loading = null;
function loadLib() {
  loading ||= Promise.all([import(`${LIB}/index.js`), import(`${LIB}/i18n/es.js`)])
    .then(([lib, es]) => ({ Picker: lib.Picker, i18n: es.default }))
    .catch(e => { loading = null; throw e; });
  return loading;
}

let panel = null;
let current = null; // { anchor, onPick, keepOpen }

const isNarrow = () => window.matchMedia("(max-width: 599.98px)").matches;

function position() {
  if (!panel || !current) return;
  if (isNarrow()) { // hoja inferior en móvil
    panel.classList.add("sheet");
    panel.style.left = panel.style.top = "";
    return;
  }
  panel.classList.remove("sheet");
  const r = current.anchor.getBoundingClientRect();
  const w = panel.offsetWidth, h = panel.offsetHeight;
  let left = Math.min(Math.max(8, r.right - w), window.innerWidth - w - 8);
  let top = r.bottom + 6;
  if (top + h > window.innerHeight - 8 && r.top - h - 6 > 8) top = r.top - h - 6; // mejor encima
  panel.style.left = `${left + window.scrollX}px`;
  panel.style.top = `${Math.max(8, top) + window.scrollY}px`;
}

function onDocDown(e) {
  if (!panel || panel.contains(e.target) || current?.anchor.contains(e.target)) return;
  closeEmojiPicker();
}
function onKey(e) {
  if (e.key === "Escape" && panel) { e.stopPropagation(); const a = current?.anchor; closeEmojiPicker(); a?.focus(); }
}

export function closeEmojiPicker() {
  if (!panel) return;
  current?.anchor.setAttribute("aria-expanded", "false");
  panel.remove();
  panel = null;
  current = null;
  document.removeEventListener("pointerdown", onDocDown, true);
  document.removeEventListener("keydown", onKey, true);
  window.removeEventListener("resize", position);
}

// Abre el selector junto a `anchor`. onPick(emoji) se llama con cada emoji elegido.
// keepOpen: no cerrar al elegir (para escribir varios seguidos en un texto).
export async function openEmojiPicker(anchor, onPick, { keepOpen = false } = {}) {
  if (current?.anchor === anchor) { closeEmojiPicker(); return; } // segundo clic: cerrar
  closeEmojiPicker();
  current = { anchor, onPick, keepOpen };
  anchor.setAttribute("aria-expanded", "true");
  panel = document.createElement("div");
  panel.className = "emoji-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Elegir emoji");
  panel.innerHTML = `
    <div class="emoji-panel-head">
      <span>Elige un emoji</span>
      <button type="button" class="emoji-panel-x" aria-label="Cerrar">×</button>
    </div>
    <div class="emoji-panel-body"><div class="emoji-panel-msg">Cargando emojis…</div></div>`;
  panel.querySelector(".emoji-panel-x").onclick = () => closeEmojiPicker();
  document.body.appendChild(panel);
  position();
  document.addEventListener("pointerdown", onDocDown, true);
  document.addEventListener("keydown", onKey, true);
  window.addEventListener("resize", position);

  const myPanel = panel;
  try {
    const { Picker, i18n } = await loadLib();
    if (panel !== myPanel) return; // se cerró mientras cargaba
    const picker = new Picker({ locale: "es", dataSource: DATA, i18n });
    picker.classList.add("light");
    picker.addEventListener("emoji-click", e => {
      const cb = current?.onPick;
      if (!current?.keepOpen) closeEmojiPicker();
      cb?.(e.detail.unicode);
    });
    myPanel.querySelector(".emoji-panel-body").replaceChildren(picker);
    position();
  } catch {
    if (panel === myPanel) {
      myPanel.querySelector(".emoji-panel-body").innerHTML =
        `<div class="emoji-panel-msg">No se pudieron cargar los emojis. Comprueba tu conexión o usa el teclado de emojis del dispositivo.</div>`;
    }
  }
}

// Inserta texto en la posición del cursor de un input/textarea y avisa con un evento "input".
export function insertAtCursor(field, text) {
  const start = field.selectionStart ?? field.value.length;
  const end = field.selectionEnd ?? field.value.length;
  const next = field.value.slice(0, start) + text + field.value.slice(end);
  if (field.maxLength > 0 && next.length > field.maxLength) return false;
  field.value = next;
  const pos = start + text.length;
  try { field.setSelectionRange(pos, pos); } catch { /* algunos tipos no lo admiten */ }
  field.dispatchEvent(new Event("input", { bubbles: true }));
  return true;
}

// Botón 😊 que acompaña a un campo de texto (ver .emoji-field en CSS). `targetId` es el id del campo.
export const emojiButtonHTML = targetId =>
  `<button type="button" class="emoji-btn" data-emoji-target="${targetId}" aria-label="Añadir emoji" aria-expanded="false">😊</button>`;
