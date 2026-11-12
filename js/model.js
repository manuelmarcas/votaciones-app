// Modelo de una votación y cálculo de recuentos.
//
// Documento `polls/{id}`:
//   title, description, type ("hours" | "days" | "weeks" | "months"),
//   months:  ["YYYY-MM", ...]        meses que se muestran
//   slots:   [...]                   lo que se puede votar:
//              days/hours -> días "YYYY-MM-DD"
//              weeks      -> lunes de cada semana "YYYY-MM-DD"
//              months     -> meses "YYYY-MM"
//   hours:   ["HH:MM", ...]          solo en "hours": franjas de cada día
//   hourStep: minutos de cada franja (solo en "hours")
//   options: [{ id, name, icon }]    solo en "days": 1 a 4 opciones por día
//   anonymous: true si no se muestra qué ha votado cada persona (si falta, los votos son visibles)
//   tiebreak: { id, candidates: ["<casilla>|<opción>"], done, round } desempate del primer puesto (o null)
//   ownerUid, ownerName, createdAt, closed
//
// Voto `polls/{id}/votes/{uid}`: { name, photo, picks: ["<slot>|<opción>", ...], tb: { id, pick } }

import * as D from "./dates.js";

export const TYPES = [
  { id: "hours", icon: "⏰", name: "Horas", unit: ["franja", "franjas"], desc: "Franjas horarias de uno o varios días" },
  { id: "days", icon: "📅", name: "Días", unit: ["día", "días"], desc: "Días concretos, con hasta 4 opciones por día" },
  { id: "weeks", icon: "🗓️", name: "Semanas", unit: ["semana", "semanas"], desc: "Semanas completas, de lunes a domingo" },
  { id: "months", icon: "📆", name: "Meses", unit: ["mes", "meses"], desc: "Meses completos" },
];
export const TYPE = Object.fromEntries(TYPES.map(t => [t.id, t]));

export const MAX_OPTIONS = 4;
export const TOP_N = 5; // opciones que se muestran en "más votadas"
const SINGLE = [{ id: "v", name: "Votos", icon: "" }];

export const plural = (n, [one, many]) => `${n} ${n === 1 ? one : many}`;
export const unitKey = (slot, opt) => `${slot}|${opt}`;

export const pollOptions = poll => (poll.type === "days" && poll.options?.length ? poll.options : SINGLE);

// Claves de cada casilla votable (sin la opción).
export function slotKeys(poll) {
  if (poll.type === "hours") return poll.slots.flatMap(d => (poll.hours || []).map(h => `${d}T${h}`));
  return poll.slots;
}

export function slotLabel(poll, slot) {
  switch (poll.type) {
    case "hours": {
      const [d, h] = slot.split("T");
      const end = D.hhmm(D.minutesOf(h) + (poll.hourStep || 60));
      return `${D.cap(D.fmtDayShort(d))} · ${h}–${end}`;
    }
    case "weeks": return D.fmtWeek(slot);
    case "months": return D.cap(D.fmtMonth(slot));
    default: return D.cap(D.fmtDayLong(slot));
  }
}

// Recuento de votos: por casilla+opción, mejores casillas y resumen por persona.
export function tally(poll, votes) {
  const opts = pollOptions(poll);
  const slots = slotKeys(poll);
  const valid = new Set();
  slots.forEach(s => opts.forEach(o => valid.add(unitKey(s, o.id))));

  const counts = {};
  const voters = {}; // casilla+opción -> [uid]
  const people = [];
  for (const uid in votes) {
    const v = votes[uid] || {};
    const perOpt = Object.fromEntries(opts.map(o => [o.id, 0]));
    const picks = [];
    for (const p of new Set(v.picks || [])) {
      if (!valid.has(p)) continue;
      counts[p] = (counts[p] || 0) + 1;
      (voters[p] ||= []).push(uid);
      perOpt[p.slice(p.lastIndexOf("|") + 1)]++;
      picks.push(p);
    }
    people.push({ uid, name: v.name || "Alguien", photo: v.photo || "", perOpt, total: picks.length, picks: picks.sort() });
  }
  people.sort((a, b) => a.name.localeCompare(b.name, "es"));

  // Borde verde del calendario: lo más votado de cada opción.
  const best = new Set();
  opts.forEach(o => {
    let max = 0;
    slots.forEach(s => { max = Math.max(max, counts[unitKey(s, o.id)] || 0); });
    if (max) slots.forEach(s => { if (counts[unitKey(s, o.id)] === max) best.add(unitKey(s, o.id)); });
  });

  // Clasificación general (todas las opciones juntas). Los empates comparten puesto: 1, 1, 3…
  const ranking = [];
  opts.forEach((o, i) => slots.forEach(s => {
    const key = unitKey(s, o.id);
    if (counts[key]) ranking.push({ key, opt: o, index: i, slot: s, votes: counts[key] });
  }));
  ranking.sort((a, b) => b.votes - a.votes || a.slot.localeCompare(b.slot) || a.index - b.index);
  ranking.forEach((e, k) => { e.rank = k && e.votes === ranking[k - 1].votes ? ranking[k - 1].rank : k + 1; });
  const top = ranking.slice(0, TOP_N);
  const leaders = ranking.filter(e => e.rank === 1);

  return { opts, slots, valid, counts, voters, best, ranking, top, leaders, people };
}

// Recuento del desempate: solo cuentan los votos de esta ronda (mismo id) a una opción candidata.
export function tiebreakTally(poll, votes) {
  const tb = poll.tiebreak;
  if (!tb || !Array.isArray(tb.candidates)) return null;
  const counts = Object.fromEntries(tb.candidates.map(c => [c, 0]));
  const voters = Object.fromEntries(tb.candidates.map(c => [c, []]));
  for (const uid in votes) {
    const v = votes[uid]?.tb;
    if (v && v.id === tb.id && v.pick in counts) { counts[v.pick]++; voters[v.pick].push(uid); }
  }
  const max = Math.max(0, ...Object.values(counts));
  const leaders = max ? tb.candidates.filter(c => counts[c] === max) : [];
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return { ...tb, counts, voters, max, leaders, total };
}

export const unitParts = u => { const i = u.lastIndexOf("|"); return { slot: u.slice(0, i), optId: u.slice(i + 1) }; };

// Etiqueta corta de una casilla, para listas compactas: "lun 22 dic", "S52 · 21–27 dic"…
export function slotShort(poll, slot) {
  switch (poll.type) {
    case "hours": { const [d, h] = slot.split("T"); return `${D.fmtDayShort(d)} ${h}`; }
    case "weeks": return `S${D.isoWeek(D.parseDay(slot))} · ${D.fmtWeekRange(slot)}`;
    case "months": return D.cap(D.fmtMonth(slot));
    default: return D.fmtDayShort(slot);
  }
}

// Descripción corta para listados: "Días · 17 días · 2 opciones".
export function pollMeta(poll) {
  const t = TYPE[poll.type];
  const parts = [t.name];
  if (poll.type === "hours") {
    parts.push(plural(poll.slots.length, ["día", "días"]));
    parts.push(plural(poll.hours?.length || 0, ["franja", "franjas"]) + " por día");
  } else {
    parts.push(plural(poll.slots.length, t.unit));
  }
  if (poll.type === "days") parts.push(plural(pollOptions(poll).length, ["opción", "opciones"]) + " por día");
  return parts.join(" · ");
}

// Texto con el periodo en el que se puede votar.
export function pollRange(poll) {
  const s = [...poll.slots].sort();
  if (!s.length) return "";
  const first = s[0], last = s[s.length - 1];
  if (poll.type === "months") {
    return s.length === 1 ? `Se vota ${D.fmtMonth(first)}.` : `Se vota entre ${D.fmtMonth(first)} y ${D.fmtMonth(last)}.`;
  }
  if (poll.type === "weeks") {
    return s.length === 1
      ? `Se vota la semana del ${D.fmtWeekRange(first)}.`
      : `${plural(s.length, ["semana", "semanas"])} disponibles, del ${D.fmtDayPlain(first)} al ${D.fmtDayPlain(D.weekEndKey(last))}.`;
  }
  if (s.length === 1) return `Se vota el ${D.fmtDayLong(first)}.`;
  const contiguous = D.daysBetween(first, last).length === s.length;
  return contiguous
    ? `Solo se puede votar del ${D.fmtDayPlain(first)} al ${D.fmtDayPlain(last)}.`
    : `${plural(s.length, ["día", "días"])} disponibles entre el ${D.fmtDayPlain(first)} y el ${D.fmtDayPlain(last)}.`;
}
