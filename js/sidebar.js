// Menú lateral: las votaciones del usuario agrupadas, para saltar de una a otra y organizarlas
// (mover entre grupos con ⋯ o arrastrando, crear/renombrar/eliminar/plegar grupos).
import { TYPE } from "./model.js";
import { $, esc, toast, errMsg, sortedGroups, confirmDialog } from "./ui.js";

const CKEY = "votaciones-menu-plegados";
const loadCollapsed = () => {
  try { return new Set(JSON.parse(localStorage.getItem(CKEY)) || []); } catch { return new Set(); }
};
const saveCollapsed = set => {
  try { localStorage.setItem(CKEY, JSON.stringify([...set])); } catch { /* nada */ }
};

export function createSidebar(ctx) {
  const el = $("#sidebar");
  el.innerHTML = `
    <div class="sb-head">
      <a class="btn primary sb-new" href="#/nueva">＋ Nueva votación</a>
      <input class="input sb-search" id="sb-search" type="search" placeholder="Buscar votación…" autocomplete="off" aria-label="Buscar votación">
    </div>
    <nav class="sb-body" id="sb-body" aria-label="Mis votaciones"></nav>
    <div class="sb-foot" id="sb-foot"></div>`;
  const body = $("#sb-body", el);
  const foot = $("#sb-foot", el);

  let uid = null, unsub = null;
  let lib = null, error = null;
  let query = "";
  let menu = null;  // { type: "poll" | "group", id }
  let form = null;  // { mode: "new" | "rename", gid?, moveId?, value }
  let dragId = null;
  const collapsed = loadCollapsed();

  const activeId = () => (location.hash.match(/^#\/v\/([A-Za-z0-9_-]+)/) || [])[1] || null;
  const validGroup = gid => (gid && lib.groups[gid] ? gid : "");

  function sections() {
    const groups = sortedGroups(lib.groups);
    // Orden estable (por fecha en que se añadió) para que el menú no salte al ir abriendo votaciones.
    const items = Object.entries(lib.polls)
      .map(([id, e]) => ({ id, ...e }))
      .sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
    const q = query.trim().toLowerCase();
    const secs = groups.map(g => ({ gid: g.id, name: g.name, items: items.filter(e => e.groupId === g.id) }));
    secs.push({ gid: "", name: groups.length ? "Sin grupo" : "Mis votaciones", items: items.filter(e => !validGroup(e.groupId)) });
    return secs.map(s => ({ ...s, shown: q ? s.items.filter(e => (e.title || "").toLowerCase().includes(q)) : s.items }));
  }

  const formHTML = () => `
    <form class="sb-form" id="sb-form">
      <input class="input" id="sb-gname" maxlength="40" placeholder="Nombre del grupo" value="${esc(form.value)}" autocomplete="off">
      <div class="sb-form-btns">
        <button class="btn small primary" type="submit">${form.mode === "rename" ? "Guardar" : "Crear grupo"}</button>
        <button class="btn small" type="button" data-act="cancel">Cancelar</button>
      </div>
    </form>`;

  function pollMenu(e) {
    const cur = validGroup(e.groupId);
    const targets = [...sortedGroups(lib.groups).map(g => [g.id, g.name]), ["", "Sin grupo"]];
    return `
      <div class="sb-menu">
        <div class="sb-menu-label">Mover a</div>
        ${targets.map(([gid, name]) => `<button class="sb-menu-item" data-move="${esc(e.id)}" data-to="${esc(gid)}" ${gid === cur ? "disabled" : ""}>${gid === cur ? "✓ " : ""}${esc(name)}</button>`).join("")}
        <button class="sb-menu-item" data-move-new="${esc(e.id)}">＋ Grupo nuevo…</button>
        ${e.role !== "owner" ? `<div class="sb-menu-sep"></div><button class="sb-menu-item danger" data-remove="${esc(e.id)}">Quitar de mi menú</button>` : ""}
      </div>`;
  }

  function itemHTML(e, active) {
    const isActive = e.id === active;
    const open = menu?.type === "poll" && menu.id === e.id;
    return `
      <li class="sb-li ${isActive ? "active" : ""}">
        <div class="sb-row">
          <a class="sb-item" href="#/v/${esc(e.id)}" draggable="true" data-poll="${esc(e.id)}" ${isActive ? `aria-current="page"` : ""}>
            <span class="sb-ic">${TYPE[e.type]?.icon || "🗳️"}</span>
            <span class="sb-title">${esc(e.title || "Votación")}</span>
          </a>
          <button class="sb-more" data-pmenu="${esc(e.id)}" aria-label="Organizar «${esc(e.title || "votación")}»" aria-expanded="${open}">⋯</button>
        </div>
        ${open ? pollMenu(e) : ""}
      </li>`;
  }

  function draw() {
    if (error) {
      body.innerHTML = `<div class="sb-empty error">${esc(errMsg(error))}</div>`;
      foot.innerHTML = "";
      return;
    }
    if (!lib) {
      body.innerHTML = `<div class="sb-empty">Cargando…</div>`;
      foot.innerHTML = "";
      return;
    }
    const active = activeId();
    const searching = !!query.trim();
    const hasGroups = Object.keys(lib.groups).length > 0;
    const total = Object.keys(lib.polls).length;

    const html = sections().map(s => {
      const isGroup = !!s.gid;
      if (searching && !s.shown.length) return "";
      if (!isGroup && !s.items.length && (!hasGroups || !total)) return "";
      const open = searching || !collapsed.has(s.gid);
      const gmenuOpen = menu?.type === "group" && menu.id === s.gid;
      const renaming = form?.mode === "rename" && form.gid === s.gid;
      const hint = isGroup ? "Vacío. Arrastra aquí votaciones o usa ⋯ para moverlas." : "Arrastra aquí para sacarlas de su grupo.";
      return `
        <section class="sb-group" data-drop="${esc(s.gid)}">
          <div class="sb-ghead">
            <button class="sb-gtoggle" data-collapse="${esc(s.gid)}" aria-expanded="${open}">
              <span class="sb-caret" aria-hidden="true">${open ? "▾" : "▸"}</span>
              <span class="sb-gname">${esc(s.name)}</span>
              <span class="sb-count">${s.items.length}</span>
            </button>
            ${isGroup ? `<button class="sb-more" data-gmenu="${esc(s.gid)}" aria-label="Opciones del grupo ${esc(s.name)}" aria-expanded="${gmenuOpen}">⋯</button>` : ""}
          </div>
          ${gmenuOpen ? `
          <div class="sb-menu">
            <button class="sb-menu-item" data-grename="${esc(s.gid)}">Renombrar</button>
            <button class="sb-menu-item danger" data-gdelete="${esc(s.gid)}">Eliminar grupo</button>
          </div>` : ""}
          ${renaming ? formHTML() : ""}
          ${open ? `<ul class="sb-list">${s.shown.map(e => itemHTML(e, active)).join("") || `<li class="sb-hint">${hint}</li>`}</ul>` : ""}
        </section>`;
    }).join("");

    body.innerHTML = html || (total
      ? `<div class="sb-empty">Ninguna votación coincide con «${esc(query)}».</div>`
      : `<div class="sb-empty">Aún no tienes votaciones.</div>`);
    foot.innerHTML = `
      ${form?.mode === "new" ? formHTML() : `<button class="sb-add" data-act="new-group">＋ Nuevo grupo</button>`}
      <a class="sb-all" href="#/">Ver todas mis votaciones</a>`;
    if (form) $("#sb-gname", el)?.focus();
  }

  async function move(id, gid, groupName) {
    if (validGroup(lib.polls[id]?.groupId) === (gid || "")) return;
    await ctx.store.saveLibraryEntry(uid, id, { groupId: gid || null });
    toast(gid ? `Movida a «${groupName || lib.groups[gid]?.name || "grupo"}»` : "Movida a «Sin grupo»");
  }

  // ---------- Eventos ----------

  el.addEventListener("click", async e => {
    const b = e.target.closest("button");
    if (!b) {
      if (e.target.closest("a")) { menu = null; form = null; }
      return;
    }
    if (!lib) return;
    const d = b.dataset;
    try {
      if (d.collapse !== undefined) {
        collapsed.has(d.collapse) ? collapsed.delete(d.collapse) : collapsed.add(d.collapse);
        saveCollapsed(collapsed);
      } else if (d.pmenu) {
        menu = menu?.type === "poll" && menu.id === d.pmenu ? null : { type: "poll", id: d.pmenu };
        form = null;
      } else if (d.gmenu) {
        menu = menu?.type === "group" && menu.id === d.gmenu ? null : { type: "group", id: d.gmenu };
        form = null;
      } else if (d.move) {
        menu = null;
        await move(d.move, d.to);
      } else if (d.moveNew) {
        menu = null;
        form = { mode: "new", moveId: d.moveNew, value: "" };
      } else if (d.remove) {
        if (!(await confirmDialog({
          title: "¿Quitar esta votación de tu menú?",
          message: "Tus votos se mantienen y podrás volver a entrar con el enlace.",
          confirmLabel: "Quitar",
          danger: true,
        }))) return;
        menu = null;
        await ctx.store.removeLibraryEntry(uid, d.remove);
        toast("Quitada de tu menú");
      } else if (d.grename) {
        menu = null;
        form = { mode: "rename", gid: d.grename, value: lib.groups[d.grename]?.name || "" };
      } else if (d.gdelete) {
        const g = lib.groups[d.gdelete];
        if (!g || !(await confirmDialog({
          title: `¿Eliminar el grupo «${g.name}»?`,
          message: "Las votaciones del grupo no se borran: pasan a «Sin grupo».",
          confirmLabel: "Eliminar grupo",
          danger: true,
        }))) return;
        menu = null;
        await ctx.store.deleteGroup(uid, d.gdelete);
        toast("Grupo eliminado");
      } else if (d.act === "new-group") {
        menu = null;
        form = { mode: "new", value: "" };
      } else if (d.act === "cancel") {
        form = null;
      } else {
        return;
      }
    } catch (err) {
      toast(errMsg(err));
    }
    draw();
  });

  el.addEventListener("submit", async e => {
    e.preventDefault();
    const name = (form?.value || "").trim();
    if (!name) return;
    const f = form;
    try {
      if (f.mode === "new") {
        const gid = await ctx.store.createGroup(uid, name);
        if (f.moveId) await move(f.moveId, gid, name);
        else toast(`Grupo «${name}» creado`);
      } else {
        await ctx.store.renameGroup(uid, f.gid, name);
        toast("Grupo renombrado");
      }
      form = null;
    } catch (err) {
      toast(errMsg(err));
    }
    draw();
  });

  el.addEventListener("input", e => {
    if (e.target.id === "sb-search") { query = e.target.value; menu = null; draw(); }
    else if (e.target.id === "sb-gname" && form) form.value = e.target.value;
  });

  el.addEventListener("keydown", e => {
    if (e.key !== "Escape" || !(form || menu)) return;
    e.stopPropagation();
    form = null;
    menu = null;
    draw();
  });

  // Arrastrar una votación a otro grupo (ordenador).
  const clearDrop = except => el.querySelectorAll(".drop-over").forEach(x => { if (x !== except) x.classList.remove("drop-over"); });
  el.addEventListener("dragstart", e => {
    const a = e.target.closest("[data-poll]");
    if (!a) return;
    dragId = a.dataset.poll;
    e.dataTransfer.setData("text/plain", dragId);
    e.dataTransfer.effectAllowed = "move";
    el.classList.add("dragging");
  });
  el.addEventListener("dragend", () => {
    dragId = null;
    el.classList.remove("dragging");
    clearDrop();
  });
  el.addEventListener("dragover", e => {
    const s = e.target.closest("[data-drop]");
    if (!s || !dragId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    clearDrop(s);
    s.classList.add("drop-over");
  });
  el.addEventListener("dragleave", e => {
    const s = e.target.closest("[data-drop]");
    if (s && !s.contains(e.relatedTarget)) s.classList.remove("drop-over");
  });
  el.addEventListener("drop", async e => {
    const s = e.target.closest("[data-drop]");
    if (!s || !dragId) return;
    e.preventDefault();
    const id = dragId;
    // Al mover se redibuja el menú y el elemento arrastrado desaparece del DOM antes de "dragend",
    // así que el estado de arrastre se limpia aquí.
    dragId = null;
    el.classList.remove("dragging");
    clearDrop();
    try { await move(id, s.dataset.drop); } catch (err) { toast(errMsg(err)); }
  });

  return {
    start(user) {
      if (uid === user.uid) return;
      this.stop();
      uid = user.uid;
      unsub = ctx.library.subscribe((d, err) => { lib = d; error = err; draw(); });
      draw();
    },
    stop() {
      unsub?.();
      unsub = null;
      uid = null;
      lib = null;
      error = null;
      menu = null;
      form = null;
      query = "";
      $("#sb-search", el).value = "";
      draw();
    },
    // Al cambiar de pantalla: marcar la votación activa y cerrar menús.
    refresh() {
      menu = null;
      draw();
    },
  };
}
