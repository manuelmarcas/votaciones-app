// Pantalla de una votación: calendario, recuentos y participantes.
import * as D from "./dates.js";
import { TYPE, tally, unitKey, slotLabel, slotShort, pollRange, plural } from "./model.js";
import { $, esc, toast, errMsg, pollUrl, confirmDialog, avatarHTML } from "./ui.js";
import { openShare } from "./share.js";

export function renderPoll(view, ctx, id) {
  const { store, user } = ctx;
  let poll = null, votes = {}, library = null;
  let pollLoaded = false, votesLoaded = false, joined = false;
  let status = "", fatal = "";
  const openPeople = new Set(); // participantes con sus votos desplegados
  const openVoters = new Set(); // "más votadas" con la lista de quién las votó desplegada

  view.innerHTML = `<div class="loading">Cargando votación…</div>`;

  const unsubs = [
    store.watchPoll(id, p => { poll = p; pollLoaded = true; sync(); draw(); },
      e => { fatal = errMsg(e); draw(); }),
    store.watchVotes(id, v => { votes = v; votesLoaded = true; sync(); draw(); },
      e => { status = errMsg(e); draw(); }),
    ctx.library.subscribe((l, e) => {
      if (e) status = errMsg(e);
      else { library = l; sync(); }
      draw();
    }),
  ];

  // Al entrar: el usuario queda como participante y la votación pasa a su colección.
  function sync() {
    if (!pollLoaded || !votesLoaded || !library) return;
    const entry = library.polls[id];
    if (!poll) {
      if (entry) store.removeLibraryEntry(user.uid, id).catch(() => {});
      return;
    }
    if (joined) {
      if (entry && entry.title !== poll.title) store.saveLibraryEntry(user.uid, id, { title: poll.title }).catch(() => {});
      return;
    }
    joined = true;
    const me = votes[user.uid];
    if (!me || me.name !== user.name || me.photo !== user.photo) {
      store.joinPoll(id, user).catch(e => { status = "No se pudo registrar tu participación. " + errMsg(e); draw(); });
    }
    const base = { title: poll.title, type: poll.type, ownerName: poll.ownerName || "", openedAt: Date.now(),
      role: poll.ownerUid === user.uid ? "owner" : "participant" };
    const isNew = !entry;
    store.saveLibraryEntry(user.uid, id, isNew ? { ...base, groupId: null, addedAt: Date.now() } : base)
      .then(() => { if (isNew && poll.ownerUid !== user.uid) toast("Votación añadida a tu menú"); })
      .catch(e => { status = errMsg(e); draw(); });
  }

  function draw() {
    if (fatal) {
      view.innerHTML = `<div class="empty-box error">${esc(fatal)}</div><p><a href="#/">← Volver a mis votaciones</a></p>`;
      return;
    }
    if (!pollLoaded) return;
    if (!poll) {
      view.innerHTML = `<div class="empty-box">Esta votación no existe o ha sido eliminada.</div><p><a href="#/">← Volver a mis votaciones</a></p>`;
      return;
    }
    const scrollLeft = $(".hours-wrap", view)?.scrollLeft || 0;

    const t = TYPE[poll.type];
    const T = tally(poll, votes);
    const mine = new Set(votes[user.uid]?.picks || []);
    const isOwner = poll.ownerUid === user.uid;
    const canVote = !poll.closed;

    const boards = { days: boardDays, weeks: boardWeeks, months: boardMonths, hours: boardHours };
    const board = boards[poll.type](poll, T, mine, canVote);

    view.innerHTML = `
      <div class="poll-head">
        <div class="poll-title">
          <div class="kicker">${t.icon} Votación por ${t.name.toLowerCase()} · creada por ${isOwner ? "ti" : esc(poll.ownerName || "alguien")} · 👥 ${plural(T.people.length, ["participante", "participantes"])}</div>
          <div class="mode-line">
            <span class="mode-pill ${poll.anonymous ? "anon" : ""}">${poll.anonymous ? "🕶️ Anónima" : "👁️ Votos visibles"}</span>
            ${isOwner && !poll.anonymous ? `<button class="link-btn" data-act="anon">Hacer anónima</button>` : ""}
          </div>
          <h1>${esc(poll.title)}</h1>
          ${poll.description ? `<p class="desc">${esc(poll.description)}</p>` : ""}
        </div>
        <div class="poll-actions ${isOwner ? "owner" : ""}">
          <button class="btn primary" data-act="share"><span aria-hidden="true">🔗</span> Compartir</button>
          ${isOwner ? `
            <button class="btn" data-act="close">${poll.closed
              ? `<span aria-hidden="true">🔓</span> Reabrir`
              : `<span aria-hidden="true">🔒</span> Cerrar<span class="lbl-long"> votación</span>`}</button>
            <button class="btn danger" data-act="delete"><span aria-hidden="true">🗑️</span> Eliminar</button>` : ""}
        </div>
      </div>
      ${poll.closed ? `<div class="closed-banner">🔒 Votación cerrada: ya no se pueden cambiar los votos.</div>` : ""}
      <p class="poll-sub">${esc(instructions(poll, T))} ${esc(pollRange(poll))} ${poll.anonymous
        ? "Es anónima: nadie ve qué ha votado cada persona, solo los totales."
        : "Los demás participantes pueden ver qué ha votado cada uno."}</p>
      <div class="legend">${legend(poll, T)}</div>
      <div class="status" id="poll-status" role="alert">${esc(status)}</div>
      ${board}
      <section class="summary">
        <h2>🏆 Opciones más votadas</h2>
        <div class="summary-list">${summary(poll, T, openVoters)}</div>
      </section>
      <section class="results">
        <h2>👥 Participantes <span class="muted">(${T.people.length})</span></h2>
        ${!poll.anonymous && T.people.some(p => p.total) ? `<p class="table-hint">Pulsa en un nombre para ver qué ha votado.</p>` : ""}
        <div class="table-wrap">${peopleTable(poll, T, user.uid, openPeople)}</div>
      </section>`;

    if (scrollLeft) $(".hours-wrap", view).scrollLeft = scrollLeft;
  }

  async function toggle(u) {
    if (!poll || poll.closed) return;
    const T = tally(poll, votes);
    const picks = new Set((votes[user.uid]?.picks || []).filter(p => T.valid.has(p)));
    picks.has(u) ? picks.delete(u) : picks.add(u);
    const data = { name: user.name, photo: user.photo, picks: [...picks].sort(), updatedAt: Date.now() };
    const prev = votes[user.uid];
    votes = { ...votes, [user.uid]: { ...(prev || {}), ...data } }; // respuesta inmediata
    status = "";
    draw();
    try {
      await store.saveVote(id, user.uid, data);
    } catch (e) {
      votes = { ...votes, [user.uid]: prev };
      status = "No se pudo guardar el voto. " + errMsg(e);
      draw();
    }
  }

  view.onclick = async e => {
    const b = e.target.closest("button");
    if (!b || b.disabled || !poll) return;
    if (b.dataset.u) return toggle(b.dataset.u);
    const toggleIn = (set, k) => { set.has(k) ? set.delete(k) : set.add(k); draw(); };
    if (b.dataset.person) return toggleIn(openPeople, b.dataset.person);
    if (b.dataset.voters) return toggleIn(openVoters, b.dataset.voters);
    const act = b.dataset.act;
    try {
      if (act === "share") {
        openShare({ url: pollUrl(id), title: poll.title });
      } else if (act === "close") {
        if (!poll.closed && !(await confirmDialog({
          title: "¿Cerrar la votación?",
          message: "Nadie podrá votar ni cambiar sus votos. Los resultados seguirán visibles y podrás reabrirla cuando quieras.",
          confirmLabel: "Cerrar votación",
        }))) return;
        await store.updatePoll(id, { closed: !poll.closed });
        toast(poll.closed ? "Votación cerrada" : "Votación reabierta");
      } else if (act === "anon") {
        if (!(await confirmDialog({
          title: "¿Hacer anónima la votación?",
          message: "Dejará de mostrarse qué ha votado cada persona; solo se verán los totales. No se puede deshacer, para no destapar votos que se hicieron como anónimos.",
          confirmLabel: "Hacer anónima",
        }))) return;
        await store.updatePoll(id, { anonymous: true });
        toast("La votación ahora es anónima");
      } else if (act === "delete") {
        if (!(await confirmDialog({
          title: `¿Eliminar «${poll.title}»?`,
          message: "Se borrarán la votación y todos sus votos para todos los participantes. No se puede deshacer.",
          confirmLabel: "Eliminar",
          danger: true,
        }))) return;
        await store.deletePoll(id, user.uid);
        toast("Votación eliminada");
        location.hash = "#/";
      }
    } catch (err) {
      status = errMsg(err);
      draw();
    }
  };

  return () => unsubs.forEach(u => u());
}

// ---------- Textos ----------

function instructions(poll, T) {
  if (poll.closed) return "La votación está cerrada; estos son los resultados.";
  switch (poll.type) {
    case "days":
      return T.opts.length === 1
        ? `Pulsa en ${T.opts[0].icon} los días que te vengan bien.`
        : `Cada día disponible tiene ${T.opts.length} opciones (de arriba abajo: ${T.opts.map(o => `${o.icon} ${o.name}`).join(", ")}). Pulsa en las que te vengan bien.`;
    case "weeks": return "Pulsa en las semanas que te vengan bien.";
    case "months": return "Pulsa en los meses que te vengan bien.";
    case "hours": {
      const step = poll.hourStep || 60;
      return `Pulsa en las franjas horarias que te vengan bien (cada una dura ${step % 60 ? `${step} minutos` : plural(step / 60, ["hora", "horas"])}).`;
    }
  }
  return "";
}

function legend(poll, T) {
  const best = `<span class="lg"><span class="sw best"></span>Borde verde: la más votada</span>`;
  if (poll.type === "days") {
    return T.opts.map((o, i) => `<span class="lg"><span class="sw c${i}"></span>${esc(o.icon)} ${esc(o.name)}</span>`).join("") + best;
  }
  return `<span class="lg"><span class="sw c0"></span>Tu voto</span>
    <span class="lg"><span class="count">3</span>Votos de todos</span>${best}`;
}

function summary(poll, T, openVoters) {
  if (!T.top.length) return `<div class="summary-empty">Todavía no hay votos suficientes.</div>`;
  const tag = e => (poll.type === "days" ? `${esc(e.opt.icon)} ${esc(e.opt.name)}` : TYPE[poll.type].icon);
  const byUid = Object.fromEntries(T.people.map(p => [p.uid, p]));
  return T.top.map(e => {
    const u = unitKey(e.slot, e.opt.id);
    const votes = plural(e.votes, ["voto", "votos"]);
    const open = !poll.anonymous && openVoters.has(u);
    return `
    <div class="summary-row">
      <span class="tag-best ${poll.type === "days" ? "" : "icon-only"}">${tag(e)}</span>
      <span class="what">${esc(slotLabel(poll, e.slot))}</span>
      ${poll.anonymous
        ? `<span class="votes">${votes}</span>`
        : `<button class="votes votes-btn" data-voters="${esc(u)}" aria-expanded="${open}" title="Ver quién lo ha votado">👥 ${votes} <span class="caret" aria-hidden="true">▾</span></button>`}
      ${open ? `<div class="voters">${(T.voters[u] || []).map(uid => byUid[uid]).filter(Boolean)
        .sort((a, b) => a.name.localeCompare(b.name, "es"))
        .map(p => `<span class="voter">${avatarHTML(p.name, p.photo, 22, p.uid)}${esc(p.name)}</span>`).join("")}</div>` : ""}
    </div>`;
  }).join("");
}

// Votos de una persona en una línea compacta: etiquetas agrupadas por opción (y por día en las de horas).
function personVotes(poll, T, picks) {
  const bySlot = new Map(T.opts.map(o => [o.id, []]));
  picks.forEach(p => { const i = p.lastIndexOf("|"); bySlot.get(p.slice(i + 1))?.push(p.slice(0, i)); });
  return T.opts.map((o, idx) => {
    const slots = bySlot.get(o.id);
    if (!slots.length) return "";
    let chips;
    if (poll.type === "hours") {
      const byDay = new Map();
      slots.forEach(s => { const [d, h] = s.split("T"); if (!byDay.has(d)) byDay.set(d, []); byDay.get(d).push(h); });
      chips = [...byDay].map(([d, hs]) => `<span class="vchip"><b>${esc(D.fmtDayShort(d))}</b> ${hs.join(", ")}</span>`).join("");
    } else {
      chips = slots.map(s => `<span class="vchip">${esc(slotShort(poll, s))}</span>`).join("");
    }
    const label = poll.type === "days" ? `<span class="vopt" title="${esc(o.name)}"><span class="sw c${idx}"></span>${esc(o.icon)}</span>` : "";
    return `<div class="vline">${label}<div class="vchips">${chips}</div></div>`;
  }).join("");
}

function peopleTable(poll, T, me, openPeople) {
  const anon = !!poll.anonymous;
  const multi = poll.type === "days" && !anon;
  const cols = anon ? 2 : multi ? T.opts.length + 1 : 2;
  const head = anon
    ? `<th class="n">¿Ha votado?</th>`
    : multi ? T.opts.map(o => `<th class="n">${esc(o.icon)} ${esc(o.name)}</th>`).join("") : `<th class="n">Votos</th>`;
  const rows = T.people.map(p => {
    const who = `${avatarHTML(p.name, p.photo, 26, p.uid)}<span>${esc(p.name)}${p.uid === me ? ` <span class="muted">(tú)</span>` : ""}${!anon && !p.total ? ` <span class="muted">· aún no ha votado</span>` : ""}</span>`;
    if (anon) {
      return `<tr><td><span class="person">${who}</span></td><td class="n">${p.total ? "✓ Sí" : `<span class="muted">Aún no</span>`}</td></tr>`;
    }
    const open = openPeople.has(p.uid) && p.total > 0;
    const counts = multi ? T.opts.map(o => `<td class="n">${p.perOpt[o.id]}</td>`).join("") : `<td class="n">${p.total}</td>`;
    return `
    <tr class="${open ? "open" : ""}">
      <td>${p.total
        ? `<button class="person person-btn" data-person="${esc(p.uid)}" aria-expanded="${open}"><span class="caret" aria-hidden="true">▸</span>${who}</button>`
        : `<span class="person person-idle">${who}</span>`}</td>
      ${counts}
    </tr>
    ${open ? `<tr class="pv-row"><td colspan="${cols}">${personVotes(poll, T, p.picks)}</td></tr>` : ""}`;
  }).join("");
  return `<table>
    <thead><tr><th>Participante</th>${head}</tr></thead>
    <tbody>${rows || `<tr><td colspan="${cols}">Todavía no ha entrado nadie.</td></tr>`}</tbody>
  </table>`;
}

// ---------- Tableros ----------

const cls = (...c) => c.filter(Boolean).join(" ");

function voteBtn(base, u, T, mine, enabled, inner, label) {
  return `<button class="${cls(base, mine.has(u) && "on", T.best.has(u) && "best")}" data-u="${u}" aria-pressed="${mine.has(u)}"
    ${label ? `aria-label="${esc(label)}"` : ""} ${enabled ? "" : "disabled"}>${inner}</button>`;
}

const countHTML = (T, u) => `<span class="count">${T.counts[u] || 0}</span>`;

function boardDays(poll, T, mine, canVote) {
  const slots = new Set(poll.slots);
  const months = poll.months.map(mk => {
    const { y, m } = D.parseMonth(mk);
    let g = D.DOW.map(x => `<div class="dow">${x}</div>`).join("");
    for (let i = 0, first = D.dowMon(new Date(y, m, 1)); i < first; i++) g += `<div class="cell empty"></div>`;
    for (let d = 1, n = D.daysInMonth(y, m); d <= n; d++) {
      const k = D.dayKey(y, m, d), on = slots.has(k);
      const opts = T.opts.map((o, i) => {
        const u = unitKey(k, o.id);
        return voteBtn(`opt c${i}`, u, T, mine, on && canVote,
          `<span class="label">${esc(o.icon)}</span>${on ? countHTML(T, u) : ""}`,
          `${D.fmtDayLong(k)} · ${o.name}`);
      }).join("");
      g += `<div class="${cls("cell", `n${T.opts.length}`, !on && "off")}"><div class="day">${d}</div>${opts}</div>`;
    }
    return `<div class="month"><h2>${D.fmtMonth(mk)}</h2><div class="grid">${g}</div></div>`;
  }).join("");
  return `<div class="months">${months}</div>`;
}

function boardWeeks(poll, T, mine, canVote) {
  const slots = new Set(poll.slots);
  const months = poll.months.map(mk => {
    const { y, m } = D.parseMonth(mk);
    const rows = D.monthWeeks(y, m).map(w => {
      const on = slots.has(w.key), u = unitKey(w.key, "v");
      const inner = `<span class="wnum">S${w.num}</span>${w.days.map(d => `<span class="${cls("wd", !d.inMonth && "out")}">${d.d}</span>`).join("")}<span class="wcount">${on ? countHTML(T, u) : ""}</span>`;
      return voteBtn(cls("wrow", !on && "off"), u, T, mine, on && canVote, inner, D.fmtWeek(w.key));
    }).join("");
    return `<div class="month"><h2>${D.fmtMonth(mk)}</h2>
      <div class="whead"><span></span>${D.DOW.map(x => `<span>${x}</span>`).join("")}<span></span></div>
      <div class="wrows">${rows}</div></div>`;
  }).join("");
  return `<div class="months">${months}</div>`;
}

function boardMonths(poll, T, mine, canVote) {
  const slots = new Set(poll.slots);
  const years = [...new Set(poll.months.map(k => k.slice(0, 4)))].sort();
  return years.map(y => `
    <div class="year-board"><h2>${y}</h2><div class="mtiles">${D.MNAMES.map((name, m) => {
      const k = D.monthKey(Number(y), m), on = slots.has(k), u = unitKey(k, "v");
      return voteBtn(cls("mtile", !on && "off"), u, T, mine, on && canVote,
        `<span class="mname">${name}</span>${on ? countHTML(T, u) : ""}`, D.fmtMonth(k));
    }).join("")}</div></div>`).join("");
}

function boardHours(poll, T, mine, canVote) {
  const days = poll.slots;
  const head = days.map(d => {
    const dt = D.parseDay(d);
    return `<th scope="col"><span class="hd-dow">${D.DSHORT[D.dowMon(dt)]}</span><span class="hd-day">${dt.getDate()}</span><span class="hd-mon">${D.MSHORT[dt.getMonth()]}</span></th>`;
  }).join("");
  const rows = (poll.hours || []).map(h => `<tr><th scope="row">${h}</th>${days.map(d => {
    const s = `${d}T${h}`, u = unitKey(s, "v");
    return `<td>${voteBtn("hcell", u, T, mine, canVote, countHTML(T, u), slotLabel(poll, s))}</td>`;
  }).join("")}</tr>`).join("");
  return `<div class="hours-card"><div class="hours-wrap"><table class="htable">
    <thead><tr><th class="corner"></th>${head}</tr></thead><tbody>${rows}</tbody></table></div></div>`;
}
