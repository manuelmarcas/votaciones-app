// Pantalla "Mis votaciones": la colección del usuario organizada en grupos.
import { TYPE, pollMeta } from "./model.js";
import { $, esc, toast, errMsg, sortedGroups, groupOptionsHTML, pollUrl, confirmDialog } from "./ui.js";
import { openShare } from "./share.js";

const pollCache = new Map(); // id -> votación (o null si ya no existe)

export function renderHome(view, ctx) {
  const { store, user } = ctx;
  let lib = null;
  let filter = ctx.homeFilter || "all"; // "all" | "none" | id de grupo
  let expanded = null;                  // votación con el menú ⋯ abierto
  let form = null;                      // { mode: "new" | "rename", gid, value }
  let status = "";
  const pending = new Set();

  view.innerHTML = `
    <div class="home-head">
      <div>
        <h1>Mis votaciones</h1>
        <p class="sub">Las que has creado y aquellas en las que participas. Organízalas en grupos.</p>
      </div>
      <a class="btn primary big" href="#/nueva">＋ Nueva votación</a>
    </div>
    <div id="home-body"><div class="loading">Cargando…</div></div>`;
  const body = $("#home-body", view);

  function fetchMeta() {
    for (const id of Object.keys(lib.polls)) {
      if (pollCache.has(id) || pending.has(id)) continue;
      pending.add(id);
      store.getPoll(id)
        .then(p => { pollCache.set(id, p); })
        .catch(() => { /* sin datos: se muestra lo guardado en la colección */ })
        .finally(() => { pending.delete(id); if (lib) draw(); });
    }
  }

  const entries = () => Object.entries(lib.polls)
    .map(([id, e]) => ({ id, ...e }))
    .sort((a, b) => (b.openedAt || b.addedAt || 0) - (a.openedAt || a.addedAt || 0));

  function draw() {
    const groups = sortedGroups(lib.groups);
    if (filter !== "all" && filter !== "none" && !lib.groups[filter]) filter = "all";
    const all = entries();
    const inGroup = gid => all.filter(e => (gid ? e.groupId === gid : !e.groupId || !lib.groups[e.groupId]));

    const chip = (f, label, n) =>
      `<button class="chip ${filter === f ? "on" : ""}" data-filter="${esc(f)}" aria-pressed="${filter === f}">${label} <span class="n">${n}</span></button>`;
    const chips = [
      chip("all", "Todas", all.length),
      ...groups.map(g => chip(g.id, esc(g.name), inGroup(g.id).length)),
      groups.length ? chip("none", "Sin grupo", inGroup(null).length) : "",
      `<button class="chip ghost" data-act="new-group">＋ Nuevo grupo</button>`,
    ].join("");

    const formHTML = form ? `
      <form class="inline-form" id="group-form">
        <input class="input" id="group-name" maxlength="40" placeholder="Nombre del grupo (ej.: Familia, Trabajo…)" value="${esc(form.value || "")}" autocomplete="off">
        <button class="btn primary" type="submit">${form.mode === "new" ? "Crear grupo" : "Guardar"}</button>
        <button class="btn" type="button" data-act="cancel-form">Cancelar</button>
      </form>` : "";

    const g = lib.groups[filter];
    const tools = g && !form ? `
      <div class="group-tools">
        <strong>${esc(g.name)}</strong>
        <button class="link-btn" data-act="rename-group">Renombrar</button>
        <button class="link-btn danger" data-act="delete-group">Eliminar grupo</button>
      </div>` : "";

    let list;
    if (!all.length) {
      list = `<div class="empty-box">Todavía no tienes votaciones. <a href="#/nueva">Crea la primera</a> o abre el enlace que te hayan pasado.</div>`;
    } else if (filter === "all" && groups.length) {
      const sections = groups.map(gr => ({ title: esc(gr.name), items: inGroup(gr.id) }))
        .concat([{ title: "Sin grupo", items: inGroup(null) }])
        .filter(s => s.items.length);
      list = sections.map(s => `<section class="lib-sec"><h2>${s.title} <span class="muted">(${s.items.length})</span></h2>
        <div class="poll-list">${s.items.map(card).join("")}</div></section>`).join("");
    } else {
      const items = filter === "all" ? all : inGroup(filter === "none" ? null : filter);
      list = items.length
        ? `<div class="poll-list">${items.map(card).join("")}</div>`
        : `<div class="empty-box">No hay votaciones aquí. Muévelas desde el botón ⋯ de cada una, o elige este grupo al crear una nueva.</div>`;
    }

    body.innerHTML = `
      <div class="group-bar"><div class="group-chips">${chips}</div>${formHTML}${tools}</div>
      <div class="status" role="alert">${esc(status)}</div>
      ${list}`;
    if (form) $("#group-name", body)?.focus();
  }

  function card(e) {
    const p = pollCache.get(e.id);
    const gone = p === null;
    const type = TYPE[p?.type || e.type];
    const owner = (p?.ownerUid || null) === user.uid || e.role === "owner";
    const meta = [
      p ? pollMeta(p) : type?.name || "",
      owner ? "creada por ti" : `de ${esc(p?.ownerName || e.ownerName || "alguien")}`,
    ].filter(Boolean).join(" · ");
    const badges = [
      gone ? `<span class="badge gone">Eliminada</span>` : "",
      p?.closed ? `<span class="badge">Cerrada</span>` : "",
      owner ? `<span class="badge mine">Tuya</span>` : "",
    ].join("");
    const open = expanded === e.id;
    return `
      <div class="poll-card ${gone ? "is-gone" : ""}">
        <div class="pc-row">
          <a class="pc-link" href="#/v/${esc(e.id)}">
            <span class="pc-icon">${type?.icon || "🗳️"}</span>
            <span class="pc-main">
              <span class="pc-title">${esc(p?.title || e.title || "Votación")}</span>
              <span class="pc-meta">${meta}</span>
            </span>
            <span class="pc-badges">${badges}</span>
          </a>
          <button class="pc-more" data-more="${esc(e.id)}" aria-expanded="${open}" aria-label="Más opciones">⋯</button>
        </div>
        ${open ? `
        <div class="pc-actions">
          <label>Grupo <select class="input small" data-move="${esc(e.id)}">${groupOptionsHTML(lib.groups, e.groupId || "")}</select></label>
          ${gone ? "" : `<button class="btn small" data-share="${esc(e.id)}">🔗 Compartir</button>`}
          ${!owner || gone ? `<button class="btn small danger" data-remove="${esc(e.id)}">Quitar de mi menú</button>` : ""}
        </div>` : ""}
      </div>`;
  }

  function setFilter(f) {
    filter = f;
    ctx.homeFilter = f;
    ctx.lastGroup = f === "all" || f === "none" ? "" : f;
  }

  view.onclick = async e => {
    const b = e.target.closest("button");
    if (!b || !lib) return;
    const d = b.dataset;
    status = "";
    try {
      if (d.filter) { setFilter(d.filter); form = null; }
      else if (d.more) expanded = expanded === d.more ? null : d.more;
      else if (d.share) openShare({ url: pollUrl(d.share), title: pollCache.get(d.share)?.title || lib.polls[d.share]?.title || "Votación" });
      else if (d.remove) {
        if (!(await confirmDialog({
          title: "¿Quitar esta votación de tu menú?",
          message: "Tus votos se mantienen y podrás volver a entrar con el enlace.",
          confirmLabel: "Quitar",
          danger: true,
        }))) return;
        await store.removeLibraryEntry(user.uid, d.remove);
        toast("Quitada de tu menú");
      } else if (d.act === "new-group") form = { mode: "new", value: "" };
      else if (d.act === "rename-group") form = { mode: "rename", gid: filter, value: lib.groups[filter]?.name || "" };
      else if (d.act === "cancel-form") form = null;
      else if (d.act === "delete-group") {
        const g = lib.groups[filter];
        if (!g || !(await confirmDialog({
          title: `¿Eliminar el grupo «${g.name}»?`,
          message: "Las votaciones del grupo no se borran: pasan a «Sin grupo».",
          confirmLabel: "Eliminar grupo",
          danger: true,
        }))) return;
        await store.deleteGroup(user.uid, filter);
        setFilter("all");
        toast("Grupo eliminado");
      } else return;
    } catch (err) {
      status = errMsg(err);
    }
    draw();
  };

  view.oninput = e => { if (e.target.id === "group-name" && form) form.value = e.target.value; };

  view.onsubmit = async e => {
    if (e.target.id !== "group-form") return;
    e.preventDefault();
    const name = (form?.value || "").trim();
    if (!name) return;
    try {
      if (form.mode === "new") {
        const gid = await store.createGroup(user.uid, name);
        setFilter(gid);
        toast(`Grupo «${name}» creado`);
      } else {
        await store.renameGroup(user.uid, form.gid, name);
        toast("Grupo renombrado");
      }
      form = null;
      status = "";
    } catch (err) { status = errMsg(err); }
    draw();
  };

  view.onchange = async e => {
    const id = e.target.dataset.move;
    if (!id) return;
    const groupId = e.target.value || null;
    try {
      await store.saveLibraryEntry(user.uid, id, { groupId });
      toast(groupId ? `Movida a «${lib.groups[groupId]?.name}»` : "Movida a «Sin grupo»");
    } catch (err) { status = errMsg(err); draw(); }
  };

  // Al final: puede llamarse al momento si la colección ya está cargada.
  const unsub = ctx.library.subscribe((l, e) => {
    if (e) { body.innerHTML = `<div class="empty-box error">${esc(errMsg(e))}</div>`; return; }
    lib = l;
    fetchMeta();
    draw();
  });

  return () => {
    unsub();
    view.onsubmit = null;
    // La próxima vez se vuelven a pedir los datos (por si han cambiado).
    pollCache.clear();
  };
}
