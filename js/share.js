// Diálogo "Compartir votación": enlace, QR, menú nativo del móvil, WhatsApp, Telegram y correo.
import { esc, toast, copyText } from "./ui.js";

// qrcode-generator 1.4.4 (MIT, Kazuhiko Arase), incluido en el repo para no depender de un CDN.
const QR_LIB = new URL("./vendor/qrcode.js", import.meta.url).href;
let qrLoading = null;

function loadQrLib() {
  if (window.qrcode) return Promise.resolve(window.qrcode);
  qrLoading ||= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = QR_LIB;
    s.onload = () => resolve(window.qrcode);
    s.onerror = () => { qrLoading = null; reject(new Error("No se pudo cargar el generador de QR")); };
    document.head.appendChild(s);
  });
  return qrLoading;
}

// Dibuja el QR en un canvas (para mostrarlo y descargarlo como PNG).
async function qrCanvas(text, px = 8, margin = 4) {
  const qrcode = await loadQrLib();
  const qr = qrcode(0, "M");
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  const size = (n + margin * 2) * px;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const g = c.getContext("2d");
  g.fillStyle = "#fff";
  g.fillRect(0, 0, size, size);
  g.fillStyle = "#143d22";
  for (let r = 0; r < n; r++) {
    for (let col = 0; col < n; col++) {
      if (qr.isDark(r, col)) g.fillRect((col + margin) * px, (r + margin) * px, px, px);
    }
  }
  return c;
}

const slugFile = s => (s || "votacion").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
  .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "votacion";

export function openShare({ url, title }) {
  document.getElementById("share-dlg")?.remove();
  const text = `¡Vota en «${title}»!`;
  const enc = encodeURIComponent;
  const dlg = document.createElement("dialog");
  dlg.id = "share-dlg";
  dlg.className = "dlg";
  dlg.innerHTML = `
    <button class="dlg-x" data-share="close" aria-label="Cerrar">×</button>
    <h2>Compartir votación</h2>
    <p class="dlg-sub">${esc(title)}</p>
    <div class="share-link">
      <input class="input" readonly value="${esc(url)}" aria-label="Enlace de la votación">
      <button class="btn primary" data-share="copy">Copiar</button>
    </div>
    <div class="qr-box" id="qr-box"><span class="muted">Generando QR…</span></div>
    <div class="share-btns">
      ${navigator.share ? `<button class="btn" data-share="native">📤 Compartir…</button>` : ""}
      <a class="btn" target="_blank" rel="noopener" href="https://wa.me/?text=${enc(`${text} ${url}`)}">💬 WhatsApp</a>
      <a class="btn" target="_blank" rel="noopener" href="https://t.me/share/url?url=${enc(url)}&text=${enc(text)}">✈️ Telegram</a>
      <a class="btn" href="mailto:?subject=${enc(title)}&body=${enc(`${text}\n\n${url}`)}">✉️ Correo</a>
      <button class="btn" data-share="download" disabled>⬇️ Descargar QR</button>
    </div>
    <p class="dlg-note">Quien abra el enlace (o escanee el QR) e inicie sesión quedará como participante y la votación aparecerá en su menú.</p>`;
  document.body.appendChild(dlg);

  let canvas = null;
  qrCanvas(url).then(c => {
    canvas = c;
    const img = new Image();
    img.src = c.toDataURL("image/png");
    img.alt = "Código QR de la votación";
    dlg.querySelector("#qr-box").replaceChildren(img);
    dlg.querySelector('[data-share="download"]').disabled = false;
  }).catch(e => {
    dlg.querySelector("#qr-box").innerHTML = `<span class="status">${esc(e.message)}</span>`;
  });

  dlg.addEventListener("click", async e => {
    if (e.target === dlg) { // clic en el fondo oscuro (fuera de la caja)
      const r = dlg.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dlg.close();
      return;
    }
    const b = e.target.closest("[data-share]");
    if (!b) return;
    const act = b.dataset.share;
    if (act === "close") dlg.close();
    else if (act === "copy") { if (await copyText(url)) toast("Enlace copiado"); }
    else if (act === "native") { try { await navigator.share({ title, text, url }); } catch { /* cancelado */ } }
    else if (act === "download" && canvas) {
      const a = document.createElement("a");
      a.href = canvas.toDataURL("image/png");
      a.download = `qr-${slugFile(title)}.png`;
      a.click();
    }
  });
  dlg.addEventListener("close", () => dlg.remove());
  dlg.showModal();
  dlg.querySelector("input").select();
}
