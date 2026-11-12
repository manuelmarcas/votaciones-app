import { firebaseConfig } from "./config.js";
import { createFirebaseStore, createDemoStore } from "./store.js";
import { renderHome } from "./home.js";
import { renderCreate } from "./create.js";
import { renderPoll } from "./poll.js";
import { renderProfile } from "./profile.js";
import { createLibrary } from "./library.js";
import { createSidebar } from "./sidebar.js";
import { $, esc, errMsg, avatarHTML } from "./ui.js";

const params = new URLSearchParams(location.search);
const DEMO = params.has("demo") || !firebaseConfig?.apiKey;
const view = $("#view");
const ctx = { store: null, user: null, demo: DEMO, lastGroup: "", homeFilter: "all" };
let cleanup = null;
let sidebar = null;

function show(which) {
  $("#boot").hidden = which !== "boot";
  $("#gate").hidden = which !== "gate";
  $("#app").hidden = which !== "app";
}

function route() {
  if (cleanup) { cleanup(); cleanup = null; }
  view.onclick = view.oninput = view.onchange = view.onkeydown = view.onsubmit = null;
  if (!ctx.user) return showGate();
  show("app");
  const h = location.hash.replace(/^#/, "") || "/";
  // El menú lateral se muestra dentro de una votación y al crear una.
  document.body.classList.toggle("with-sidebar", h === "/nueva" || h.startsWith("/v/"));
  setDrawer(false);
  sidebar.refresh();
  let m;
  if (h === "/") cleanup = renderHome(view, ctx);
  else if (h === "/nueva") cleanup = renderCreate(view, ctx);
  else if (h === "/perfil") cleanup = renderProfile(view, ctx);
  else if ((m = h.match(/^\/v\/([A-Za-z0-9_-]+)$/))) cleanup = renderPoll(view, ctx, m[1]);
  else return location.replace("#/");
  window.scrollTo(0, 0);
}

// En móvil el menú lateral es un cajón que se abre con ☰.
function setDrawer(open) {
  document.body.classList.toggle("sb-open", open);
  $("#sb-toggle").setAttribute("aria-expanded", String(open));
  if (open) $("#sidebar .sb-new")?.focus();
}

function showGate() {
  show("gate");
  const invited = /^#\/v\//.test(location.hash);
  $("#gate-text").textContent = invited
    ? "Te han invitado a una votación. Inicia sesión para ver el calendario y votar; se guardará en tu menú."
    : "Crea votaciones de horas, días, semanas o meses, compártelas con tu grupo y mira los resultados en directo.";
  $("#login").hidden = DEMO;
  $("#demo-login").hidden = !DEMO;
  if (DEMO) $("#demo-name").focus();
}

$("#login").onclick = async () => {
  $("#gate-status").textContent = "";
  try { await ctx.store.signIn(); }
  catch (e) { $("#gate-status").textContent = "No se pudo iniciar sesión. " + errMsg(e); }
};
$("#demo-login").onsubmit = async e => {
  e.preventDefault();
  const name = $("#demo-name").value.trim();
  if (name) await ctx.store.signIn({ name });
};
$("#logout").onclick = () => ctx.store.signOut();
$("#sb-toggle").onclick = () => setDrawer(!document.body.classList.contains("sb-open"));
$("#sb-backdrop").onclick = () => setDrawer(false);
$("#sidebar").addEventListener("click", e => { if (e.target.closest("a")) setDrawer(false); });
document.addEventListener("keydown", e => {
  if (e.key === "Escape" && document.body.classList.contains("sb-open")) setDrawer(false);
});
window.addEventListener("hashchange", route);

try {
  ctx.store = DEMO ? createDemoStore() : await createFirebaseStore(firebaseConfig);
} catch (e) {
  $("#boot").innerHTML = `<div class="empty-box error">No se pudo cargar la aplicación: ${esc(e.message)}</div>`;
  throw e;
}

ctx.library = createLibrary(ctx.store);
sidebar = createSidebar(ctx);

if (DEMO) {
  $("#demo-banner").hidden = false;
  if (firebaseConfig?.apiKey) {
    const url = new URL(location.href);
    url.searchParams.delete("demo");
    $("#demo-exit").href = url.toString();
  } else {
    $("#demo-exit").hidden = true;
  }
}

// Nombre e imagen de la barra superior.
function paintUser() {
  if (!ctx.user) return;
  $("#who-name").textContent = ctx.user.name;
  $("#me-avatar").innerHTML = avatarHTML(ctx.user.name, ctx.user.photo, 30, ctx.user.uid);
}
ctx.onUserChange = paintUser;

ctx.store.onAuth(async authUser => {
  const was = ctx.user?.uid;
  let u = authUser;
  if (u) {
    // El perfil (nombre e imagen elegidos por el usuario) tiene prioridad sobre los datos de Google.
    let profile = null;
    try { profile = await ctx.store.getProfile(u.uid); } catch { /* sin perfil: datos de Google */ }
    u = {
      ...u,
      googlePhoto: u.photo,
      name: profile?.name || u.name,
      photo: typeof profile?.photo === "string" ? profile.photo : u.photo,
    };
  }
  ctx.user = u;
  paintUser();
  if (was !== u?.uid) { ctx.lastGroup = ""; ctx.homeFilter = "all"; }
  if (u) { ctx.library.start(u); sidebar.start(u); }
  else { sidebar.stop(); ctx.library.stop(); }
  route();
});
