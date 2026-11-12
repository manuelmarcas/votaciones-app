import { firebaseConfig } from "./config.js";
import { createFirebaseStore, createDemoStore } from "./store.js";
import { renderHome } from "./home.js";
import { renderCreate } from "./create.js";
import { renderPoll } from "./poll.js";
import { $, esc, errMsg } from "./ui.js";

const params = new URLSearchParams(location.search);
const DEMO = params.has("demo") || !firebaseConfig?.apiKey;
const view = $("#view");
const ctx = { store: null, user: null, demo: DEMO, lastGroup: "", homeFilter: "all" };
let cleanup = null;

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
  let m;
  if (h === "/") cleanup = renderHome(view, ctx);
  else if (h === "/nueva") cleanup = renderCreate(view, ctx);
  else if ((m = h.match(/^\/v\/([A-Za-z0-9_-]+)$/))) cleanup = renderPoll(view, ctx, m[1]);
  else return location.replace("#/");
  window.scrollTo(0, 0);
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
window.addEventListener("hashchange", route);

try {
  ctx.store = DEMO ? createDemoStore() : await createFirebaseStore(firebaseConfig);
} catch (e) {
  $("#boot").innerHTML = `<div class="empty-box error">No se pudo cargar la aplicación: ${esc(e.message)}</div>`;
  throw e;
}

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

ctx.store.onAuth(u => {
  const was = ctx.user?.uid;
  ctx.user = u;
  if (u) {
    $("#who-name").textContent = u.name;
    const avatar = $("#avatar");
    avatar.hidden = !u.photo;
    if (u.photo) avatar.src = u.photo;
  }
  if (was !== u?.uid) { ctx.lastGroup = ""; ctx.homeFilter = "all"; }
  route();
});
