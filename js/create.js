// Pantalla "Nueva votación".
import * as D from "./dates.js";
import { TYPES, TYPE, MAX_OPTIONS, plural } from "./model.js";
import { $, esc, toast, errMsg, firstGrapheme, groupOptionsHTML } from "./ui.js";

const EMOJIS = ["✅", "🍽️", "🌙", "☀️", "🌅", "🌇", "☕", "🥐", "🍕", "🍔", "🍷", "🍻", "🎉", "🎄", "🎂", "🎁",
  "🎬", "🎮", "🎳", "⚽", "🏃", "🏖️", "⛷️", "✈️", "🚗", "🏠", "💼", "📍", "⭐", "❤️"];

// Nombres e iconos sugeridos según el número de opciones (solo se aplican a las que no se han tocado).
const PRESETS = {
  1: [["Disponible", "✅"]],
  2: [["Comida", "🍽️"], ["Cena", "🌙"]],
  3: [["Desayuno", "☕"], ["Comida", "🍽️"], ["Cena", "🌙"]],
  4: [["Mañana", "🌅"], ["Mediodía", "☀️"], ["Tarde", "🌇"], ["Noche", "🌙"]],
};

export function renderCreate(view, ctx) {
  const now = new Date();
  const st = {
    title: "",
    description: "",
    type: "days",
    year: now.getFullYear(),
    months: new Set(),
    days: new Set(),   // para "days" y "hours"
    weeks: new Set(),  // lunes de cada semana
    count: 1,
    opts: Array.from({ length: MAX_OPTIONS }, () => ({ name: "", icon: "", touched: false })),
    from: "09:00",
    to: "21:00",
    step: 60,
    last: null,        // última casilla pulsada (para rangos con Mayús)
    picker: -1,        // opción con el selector de iconos abierto
    groupId: ctx.lastGroup || "",
    newGroup: "",
    groups: null,      // se rellena al cargar la colección del usuario
    busy: false,
  };
  applyPresets();

  view.innerHTML = `
  <div class="page-head">
    <a class="back" href="#/">← Volver</a>
    <h1>Nueva votación</h1>
  </div>
  <div class="create">
    <section class="step" id="sec-name">
      <h2><span class="num"></span>Nombre</h2>
      <input id="f-title" class="input big" maxlength="120" placeholder="Ej.: Cena de Navidad 2026" autocomplete="off">
      <textarea id="f-desc" class="input" maxlength="300" rows="2" placeholder="Descripción (opcional)"></textarea>
      <div class="group-pick">
        <label for="f-group">Guardar en el grupo</label>
        <select id="f-group" class="input"><option value="">Sin grupo</option></select>
        <input id="f-newgroup" class="input" maxlength="40" placeholder="Nombre del nuevo grupo" autocomplete="off" hidden>
      </div>
    </section>
    <section class="step" id="sec-type">
      <h2><span class="num"></span>¿Qué se vota?</h2>
      <div class="types" id="s-type"></div>
    </section>
    <section class="step" id="sec-months">
      <h2><span class="num"></span>Meses</h2>
      <p class="hint" id="h-months"></p>
      <div id="s-months"></div>
    </section>
    <section class="step" id="sec-slots">
      <h2><span class="num"></span><span id="t-slots"></span></h2>
      <p class="hint" id="h-slots"></p>
      <div id="s-slots"></div>
    </section>
    <section class="step" id="sec-opts">
      <h2><span class="num"></span>Opciones de cada día</h2>
      <p class="hint">Cada día puede tener hasta 4 opciones (por ejemplo, comida y cena). El icono se verá en el calendario y el nombre en la leyenda.</p>
      <div id="s-opts"></div>
    </section>
    <section class="step" id="sec-hours">
      <h2><span class="num"></span>Horas</h2>
      <p class="hint">Las mismas franjas se repetirán en cada uno de los días elegidos.</p>
      <div id="s-hours"></div>
    </section>
    <div class="create-bar">
      <div class="create-summary" id="c-summary"></div>
      <button type="button" class="btn primary big" id="c-submit">Crear votación</button>
      <div class="status" id="c-status" role="alert"></div>
    </div>
  </div>`;

  const q = sel => $(sel, view);

  function applyPresets() {
    const p = PRESETS[st.count];
    st.opts.forEach((o, i) => {
      if (!o.touched && p[i]) { o.name = p[i][0]; o.icon = p[i][1]; }
    });
  }

  // ---------- Secciones ----------

  function drawGroups() {
    const sel = q("#f-group");
    if (st.groups && st.groupId && st.groupId !== "__new" && !st.groups[st.groupId]) st.groupId = "";
    sel.innerHTML = groupOptionsHTML(st.groups, st.groupId) + `<option value="__new" ${st.groupId === "__new" ? "selected" : ""}>＋ Crear grupo nuevo…</option>`;
    q("#f-newgroup").hidden = st.groupId !== "__new";
  }

  function drawAll() {
    const visible = {
      name: true,
      type: true,
      months: true,
      slots: st.type !== "months",
      opts: st.type === "days",
      hours: st.type === "hours",
    };
    let n = 0;
    for (const [k, v] of Object.entries(visible)) {
      const sec = q(`#sec-${k}`);
      sec.hidden = !v;
      if (v) sec.querySelector(".num").textContent = ++n;
    }
    drawType();
    drawMonths();
    drawSlots();
    drawOpts();
    drawHours();
    drawSummary();
  }

  function drawType() {
    q("#s-type").innerHTML = TYPES.map(t => `
      <button type="button" class="type-card ${st.type === t.id ? "on" : ""}" data-type="${t.id}" aria-pressed="${st.type === t.id}">
        <span class="type-icon">${t.icon}</span>
        <span class="type-name">${t.name}</span>
        <span class="type-desc">${t.desc}</span>
      </button>`).join("");
  }

  function drawMonths() {
    const cur = D.currentMonthKey();
    const minYear = now.getFullYear();
    const chips = D.MNAMES.map((name, m) => {
      const k = D.monthKey(st.year, m);
      return `<button type="button" class="chip month-chip ${st.months.has(k) ? "on" : ""}" data-month="${k}" aria-pressed="${st.months.has(k)}" ${k < cur ? "disabled" : ""}>${D.cap(name)}</button>`;
    }).join("");
    const sel = [...st.months].sort();
    q("#h-months").textContent = st.type === "months"
      ? "Elige los meses que se podrán votar. Cambia de año con las flechas."
      : `Elige el mes o los meses en los que estarán ${st.type === "weeks" ? "las semanas" : "los días"} de la votación. Cambia de año con las flechas.`;
    q("#s-months").innerHTML = `
      <div class="year-nav">
        <button type="button" class="icon-btn" data-year="-1" ${st.year <= minYear ? "disabled" : ""} aria-label="Año anterior">‹</button>
        <strong>${st.year}</strong>
        <button type="button" class="icon-btn" data-year="1" ${st.year >= minYear + 3 ? "disabled" : ""} aria-label="Año siguiente">›</button>
      </div>
      <div class="month-chips">${chips}</div>
      <div class="selected-months">${sel.length
        ? sel.map(k => `<span class="tag">${D.cap(D.fmtMonth(k))}<button type="button" data-rm-month="${k}" aria-label="Quitar ${D.fmtMonth(k)}">×</button></span>`).join("")
        : `<span class="muted">Ningún mes seleccionado.</span>`}</div>`;
  }

  const sortedMonths = () => [...st.months].sort();

  function selectableDays() {
    const today = D.todayKey();
    const out = [];
    sortedMonths().forEach(mk => {
      const { y, m } = D.parseMonth(mk);
      for (let d = 1, n = D.daysInMonth(y, m); d <= n; d++) {
        const k = D.dayKey(y, m, d);
        if (k >= today) out.push(k);
      }
    });
    return out;
  }

  function selectableWeeks() {
    const today = D.todayKey();
    const set = new Set();
    sortedMonths().forEach(mk => {
      const { y, m } = D.parseMonth(mk);
      D.monthWeeks(y, m).forEach(w => { if (D.weekEndKey(w.key) >= today) set.add(w.key); });
    });
    return [...set].sort();
  }

  // Al quitar un mes, se quitan los días/semanas que ya no se ven.
  function pruneSlots() {
    const ok = new Set();
    sortedMonths().forEach(mk => { const { y, m } = D.parseMonth(mk); D.monthWeeks(y, m).forEach(w => ok.add(w.key)); });
    st.days.forEach(k => { if (!st.months.has(D.monthOfDay(k))) st.days.delete(k); });
    st.weeks.forEach(k => { if (!ok.has(k)) st.weeks.delete(k); });
  }

  function drawSlots() {
    if (st.type === "months") return;
    const isWeeks = st.type === "weeks";
    const months = sortedMonths();
    const host = q("#s-slots");
    q("#t-slots").textContent = isWeeks ? "Semanas" : "Días";
    if (!months.length) {
      q("#h-slots").textContent = "";
      host.innerHTML = `<div class="empty-box">Primero elige al menos un mes.</div>`;
      return;
    }
    q("#h-slots").textContent = isWeeks
      ? "Pulsa en las semanas que se podrán votar. Una semana que cae entre dos meses es la misma en los dos calendarios."
      : `Pulsa en los días que se podrán votar${st.type === "hours" ? " (en cada uno se votarán las horas)" : ""}. En ordenador, mantén Mayús para marcar un rango.`;

    const today = D.todayKey();
    const cals = months.map(mk => {
      const { y, m } = D.parseMonth(mk);
      if (isWeeks) {
        const rows = D.monthWeeks(y, m).map(w => `
          <button type="button" class="pweek ${st.weeks.has(w.key) ? "on" : ""}" data-week="${w.key}" aria-pressed="${st.weeks.has(w.key)}" ${D.weekEndKey(w.key) < today ? "disabled" : ""}>
            <span class="wnum">S${w.num}</span>${w.days.map(d => `<span class="wd ${d.inMonth ? "" : "out"}">${d.d}</span>`).join("")}
          </button>`).join("");
        return `<div class="pick-month"><h3>${D.fmtMonth(mk)}</h3>
          <div class="pweek-head"><span></span>${D.DOW.map(x => `<span>${x}</span>`).join("")}</div>
          <div class="pweeks">${rows}</div></div>`;
      }
      let g = D.DOW.map(x => `<div class="dow">${x}</div>`).join("");
      const first = D.dowMon(new Date(y, m, 1));
      for (let i = 0; i < first; i++) g += `<div></div>`;
      for (let d = 1, n = D.daysInMonth(y, m); d <= n; d++) {
        const k = D.dayKey(y, m, d);
        const we = D.dowMon(new Date(y, m, d)) >= 5;
        g += `<button type="button" class="pday ${st.days.has(k) ? "on" : ""} ${we ? "we" : ""}" data-day="${k}" aria-pressed="${st.days.has(k)}" ${k < today ? "disabled" : ""}>${d}</button>`;
      }
      return `<div class="pick-month"><h3>${D.fmtMonth(mk)}</h3><div class="pgrid">${g}</div></div>`;
    }).join("");

    const quick = isWeeks
      ? `<button type="button" class="chip" data-quick="all">Todas</button>
         <button type="button" class="chip" data-quick="none">Ninguna</button>`
      : `<button type="button" class="chip" data-quick="all">Todos</button>
         <button type="button" class="chip" data-quick="none">Ninguno</button>
         <button type="button" class="chip" data-quick="weekdays">Lunes a viernes</button>
         <button type="button" class="chip" data-quick="weekends">Fines de semana</button>`;
    const n = isWeeks ? st.weeks.size : st.days.size;
    host.innerHTML = `
      <div class="quick">${quick}
        <span class="count-note">${plural(n, isWeeks ? ["semana seleccionada", "semanas seleccionadas"] : ["día seleccionado", "días seleccionados"])}</span>
      </div>
      <div class="pick-months">${cals}</div>`;
  }

  function previewHTML() {
    const opts = st.opts.slice(0, st.count);
    return `
      <div class="preview-label">Vista previa</div>
      <div class="cell n${st.count} preview">
        <div class="day">22</div>
        ${opts.map((o, i) => `<span class="opt c${i} ${i % 2 === 0 ? "on" : ""}"><span class="label">${esc(o.icon)}</span><span class="count">${[3, 1, 2, 0][i]}</span></span>`).join("")}
      </div>
      <div class="legend mini">${opts.map((o, i) => `<span class="lg"><span class="sw c${i}"></span>${esc(o.icon)} ${esc(o.name) || "<em>sin nombre</em>"}</span>`).join("")}</div>`;
  }

  function drawOpts() {
    if (st.type !== "days") return;
    const rows = st.opts.slice(0, st.count).map((o, i) => `
      <div class="opt-row">
        <span class="opt-swatch sw c${i}"></span>
        <button type="button" class="icon-pick" data-picker="${i}" aria-label="Elegir icono de la opción ${i + 1}" aria-expanded="${st.picker === i}">${esc(o.icon) || "＋"}</button>
        <input class="input" data-opt-name="${i}" maxlength="30" value="${esc(o.name)}" placeholder="Nombre de la opción ${i + 1}" autocomplete="off">
        ${st.picker === i ? `
        <div class="emoji-pop">
          <div class="emoji-grid">${EMOJIS.map(em => `<button type="button" data-emoji="${em}">${em}</button>`).join("")}</div>
          <input class="input" data-opt-custom="${i}" maxlength="16" placeholder="…o escribe o pega otro emoji" autocomplete="off">
        </div>` : ""}
      </div>`).join("");
    q("#s-opts").innerHTML = `
      <div class="seg" role="group" aria-label="Opciones por día">
        ${[1, 2, 3, 4].map(n => `<button type="button" class="${st.count === n ? "on" : ""}" data-count="${n}" aria-pressed="${st.count === n}">${n}</button>`).join("")}
        <span class="seg-label">${st.count === 1 ? "opción" : "opciones"} por día</span>
      </div>
      <div class="opt-layout">
        <div class="opt-rows">${rows}</div>
        <div class="opt-preview">${previewHTML()}</div>
      </div>`;
  }

  function updatePreview() {
    const el = q(".opt-preview");
    if (el) el.innerHTML = previewHTML();
  }

  function closePicker() {
    if (st.picker < 0) return;
    const btn = q(`[data-picker="${st.picker}"]`);
    st.picker = -1;
    q(".emoji-pop")?.remove();
    btn?.setAttribute("aria-expanded", "false");
  }

  function hourSlots() { return D.hourRange(st.from, st.to, st.step); }

  function drawHours() {
    if (st.type !== "hours") return;
    const starts = [], ends = [];
    for (let t = 0; t < 1440; t += 30) starts.push(D.hhmm(t));
    for (let t = 30; t <= 1440; t += 30) ends.push(D.hhmm(t));
    const opt = (vals, cur) => vals.map(v => `<option value="${v}" ${v === cur ? "selected" : ""}>${v}</option>`).join("");
    const slots = hourSlots();
    q("#s-hours").innerHTML = `
      <div class="hours-form">
        <label>Desde<select class="input" data-h="from">${opt(starts, st.from)}</select></label>
        <label>Hasta<select class="input" data-h="to">${opt(ends, st.to)}</select></label>
        <label>Cada<select class="input" data-h="step">
          ${[[30, "30 minutos"], [60, "1 hora"], [120, "2 horas"]].map(([v, l]) => `<option value="${v}" ${st.step === v ? "selected" : ""}>${l}</option>`).join("")}
        </select></label>
      </div>
      <div class="hour-chips">${slots.length
        ? slots.map(h => `<span class="chip static">${h}</span>`).join("")
        : `<span class="status">Con ese rango no cabe ninguna franja.</span>`}</div>
      <p class="hint hint-after">${plural(slots.length, ["franja", "franjas"])} por día.</p>`;
  }

  function drawSummary() {
    const t = TYPE[st.type];
    const parts = [`${t.icon} ${t.name}`];
    if (st.type === "months") parts.push(plural(st.months.size, ["mes", "meses"]));
    else if (st.type === "weeks") parts.push(plural(st.weeks.size, ["semana", "semanas"]));
    else parts.push(plural(st.days.size, ["día", "días"]));
    if (st.type === "days") parts.push(plural(st.count, ["opción", "opciones"]) + " por día");
    if (st.type === "hours") parts.push(plural(hourSlots().length, ["franja", "franjas"]) + " por día");
    q("#c-summary").textContent = parts.join(" · ");
  }

  // ---------- Validación y envío ----------

  function validate() {
    if (!st.title.trim()) return ["Ponle un nombre a la votación.", "#f-title"];
    if (st.groupId === "__new" && !st.newGroup.trim()) return ["Escribe el nombre del grupo nuevo (o elige otro).", "#f-newgroup"];
    if (!st.months.size) return ["Elige al menos un mes.", "#sec-months"];
    if ((st.type === "days" || st.type === "hours") && !st.days.size) return ["Elige al menos un día.", "#sec-slots"];
    if (st.type === "weeks" && !st.weeks.size) return ["Elige al menos una semana.", "#sec-slots"];
    if (st.type === "days") {
      for (let i = 0; i < st.count; i++) {
        if (!st.opts[i].icon) return [`Elige un icono para la opción ${i + 1}.`, "#sec-opts"];
        if (!st.opts[i].name.trim()) return [`Ponle nombre a la opción ${i + 1}.`, `[data-opt-name="${i}"]`];
      }
    }
    if (st.type === "hours" && !hourSlots().length) return ["El rango de horas no contiene ninguna franja.", "#sec-hours"];
    return null;
  }

  async function submit() {
    if (st.busy) return;
    const status = q("#c-status");
    const err = validate();
    if (err) {
      status.textContent = err[0];
      const el = q(err[1]);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        if (el.matches("input, textarea")) el.focus({ preventScroll: true });
      }
      return;
    }
    status.textContent = "";
    const months = sortedMonths();
    const type = st.type;
    const poll = {
      v: 1,
      title: st.title.trim(),
      description: st.description.trim(),
      type,
      months,
      slots: type === "months" ? months : type === "weeks" ? [...st.weeks].sort() : [...st.days].sort(),
      hours: type === "hours" ? hourSlots() : [],
      hourStep: type === "hours" ? st.step : 0,
      options: type === "days"
        ? st.opts.slice(0, st.count).map((o, i) => ({ id: `o${i + 1}`, name: o.name.trim(), icon: o.icon }))
        : [],
      ownerUid: ctx.user.uid,
      ownerName: ctx.user.name,
      createdAt: Date.now(),
      closed: false,
    };
    const btn = q("#c-submit");
    st.busy = true;
    btn.disabled = true;
    btn.textContent = "Creando…";
    try {
      const { store, user } = ctx;
      let groupId = st.groupId || null;
      if (groupId === "__new") groupId = await store.createGroup(user.uid, st.newGroup.trim());
      const id = await store.createPoll(poll);
      await store.saveLibraryEntry(user.uid, id, {
        title: poll.title, type: poll.type, role: "owner", ownerName: poll.ownerName,
        groupId, addedAt: poll.createdAt, openedAt: poll.createdAt,
      });
      ctx.lastGroup = groupId || "";
      toast("¡Votación creada! Compártela con el botón «Compartir».");
      location.hash = `#/v/${id}`;
    } catch (e) {
      status.textContent = "No se pudo crear la votación. " + errMsg(e);
      st.busy = false;
      btn.disabled = false;
      btn.textContent = "Crear votación";
    }
  }

  // ---------- Eventos ----------

  function toggleRange(set, key, ordered, shift) {
    const turnOn = !set.has(key);
    if (shift && st.last && st.last !== key) {
      let a = ordered.indexOf(st.last), b = ordered.indexOf(key);
      if (a > -1 && b > -1) {
        if (a > b) [a, b] = [b, a];
        ordered.slice(a, b + 1).forEach(k => (turnOn ? set.add(k) : set.delete(k)));
      }
    }
    turnOn ? set.add(key) : set.delete(key);
    st.last = key;
  }

  view.onclick = e => {
    if (st.picker >= 0 && !e.target.closest(".emoji-pop, [data-picker]")) closePicker();
    const b = e.target.closest("button");
    if (!b || b.disabled) return;
    const d = b.dataset;

    if (d.type) {
      if (st.type === d.type) return;
      st.type = d.type;
      st.last = null;
      drawAll();
    } else if (d.year) {
      st.year += Number(d.year);
      drawMonths();
    } else if (d.month || d.rmMonth) {
      const k = d.month || d.rmMonth;
      st.months.has(k) ? st.months.delete(k) : st.months.add(k);
      pruneSlots();
      drawMonths(); drawSlots(); drawSummary();
    } else if (d.day) {
      toggleRange(st.days, d.day, selectableDays(), e.shiftKey);
      drawSlots(); drawSummary();
    } else if (d.week) {
      toggleRange(st.weeks, d.week, selectableWeeks(), e.shiftKey);
      drawSlots(); drawSummary();
    } else if (d.quick) {
      if (st.type === "weeks") {
        st.weeks = new Set(d.quick === "all" ? selectableWeeks() : []);
      } else {
        const all = selectableDays();
        const weekend = k => D.dowMon(D.parseDay(k)) >= 5;
        const pick = { all: () => true, none: () => false, weekdays: k => !weekend(k), weekends: weekend }[d.quick];
        st.days = new Set(all.filter(pick));
      }
      st.last = null;
      drawSlots(); drawSummary();
    } else if (d.count) {
      st.count = Number(d.count);
      st.picker = -1;
      applyPresets();
      drawOpts(); drawSummary();
    } else if (d.picker !== undefined) {
      const i = Number(d.picker);
      st.picker = st.picker === i ? -1 : i;
      drawOpts();
      q(`[data-opt-custom="${i}"]`)?.focus({ preventScroll: true });
    } else if (d.emoji) {
      const o = st.opts[st.picker];
      if (o) { o.icon = d.emoji; o.touched = true; }
      st.picker = -1;
      drawOpts();
    } else if (b.id === "c-submit") {
      submit();
    }
  };

  view.oninput = e => {
    const t = e.target;
    if (t.id === "f-title") st.title = t.value;
    else if (t.id === "f-desc") st.description = t.value;
    else if (t.id === "f-newgroup") st.newGroup = t.value;
    else if (t.dataset.optName !== undefined) {
      const o = st.opts[Number(t.dataset.optName)];
      o.name = t.value;
      o.touched = true;
      updatePreview();
    } else if (t.dataset.optCustom !== undefined) {
      const i = Number(t.dataset.optCustom);
      const g = firstGrapheme(t.value);
      if (!g) return;
      st.opts[i].icon = g;
      st.opts[i].touched = true;
      q(`[data-picker="${i}"]`).textContent = g;
      updatePreview();
    }
  };

  view.onchange = e => {
    if (e.target.id === "f-group") {
      st.groupId = e.target.value;
      q("#f-newgroup").hidden = st.groupId !== "__new";
      if (st.groupId === "__new") q("#f-newgroup").focus();
      return;
    }
    const k = e.target.dataset.h;
    if (!k) return;
    st[k] = k === "step" ? Number(e.target.value) : e.target.value;
    drawHours(); drawSummary();
  };

  view.onkeydown = e => {
    if (st.picker >= 0 && (e.key === "Escape" || (e.key === "Enter" && e.target.dataset.optCustom !== undefined))) {
      e.preventDefault();
      const i = st.picker;
      closePicker();
      q(`[data-picker="${i}"]`)?.focus();
    } else if (e.key === "Enter" && e.target.id === "f-title") {
      e.preventDefault();
    }
  };

  drawAll();
  drawGroups();
  q("#f-title").focus();
  const unsub = ctx.store.watchLibrary(ctx.user.uid, lib => { st.groups = lib.groups; drawGroups(); }, () => {});
  return () => unsub();
}
