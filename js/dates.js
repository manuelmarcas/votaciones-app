// Utilidades de fechas. Todas las claves son cadenas ordenables:
//   día   -> "YYYY-MM-DD"
//   mes   -> "YYYY-MM"
//   semana-> "YYYY-MM-DD" del lunes de esa semana
//   hora  -> "HH:MM"

export const MNAMES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
export const MSHORT = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
export const DOW = ["L", "M", "X", "J", "V", "S", "D"];
export const DNAMES = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];
export const DSHORT = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];

export const pad = n => String(n).padStart(2, "0");
export const dayKey = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
export const monthKey = (y, m) => `${y}-${pad(m + 1)}`;
export const keyOfDate = dt => dayKey(dt.getFullYear(), dt.getMonth(), dt.getDate());
export const parseDay = k => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };
export const parseMonth = k => { const [y, m] = k.split("-").map(Number); return { y, m: m - 1 }; };
export const monthOfDay = k => k.slice(0, 7);
export const addDays = (dt, n) => new Date(dt.getFullYear(), dt.getMonth(), dt.getDate() + n);
export const dowMon = dt => (dt.getDay() + 6) % 7; // 0 = lunes ... 6 = domingo
export const mondayOf = dt => addDays(dt, -dowMon(dt));
export const daysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();
export const todayKey = () => keyOfDate(new Date());
export const currentMonthKey = () => todayKey().slice(0, 7);
export const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

// Número de semana ISO-8601.
export function isoWeek(dt) {
  const d = new Date(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

// Filas (semanas de lunes a domingo) que forman el calendario de un mes.
export function monthWeeks(y, m) {
  const last = new Date(y, m + 1, 0);
  const weeks = [];
  for (let start = mondayOf(new Date(y, m, 1)); start <= last; start = addDays(start, 7)) {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const dt = addDays(start, i);
      days.push({ key: keyOfDate(dt), d: dt.getDate(), inMonth: dt.getMonth() === m, dow: i });
    }
    weeks.push({ key: keyOfDate(start), num: isoWeek(start), days });
  }
  return weeks;
}

export const weekEndKey = wk => keyOfDate(addDays(parseDay(wk), 6));

// Todos los días entre a y b (incluidos), en orden.
export function daysBetween(a, b) {
  if (a > b) [a, b] = [b, a];
  const out = [];
  for (let dt = parseDay(a), end = parseDay(b); dt <= end; dt = addDays(dt, 1)) out.push(keyOfDate(dt));
  return out;
}

export const minutesOf = t => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
export const hhmm = mins => `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`;

// Franjas que empiezan en `from` y duran `step` minutos sin pasar de `to`.
export function hourRange(from, to, step) {
  const out = [];
  const end = minutesOf(to);
  for (let t = minutesOf(from); t + step <= end; t += step) out.push(hhmm(t));
  return out;
}

export function fmtDayLong(k) {
  const dt = parseDay(k);
  return `${DNAMES[dowMon(dt)]} ${dt.getDate()} de ${MNAMES[dt.getMonth()]}`;
}
export function fmtDayShort(k) {
  const dt = parseDay(k);
  return `${DSHORT[dowMon(dt)]} ${dt.getDate()} ${MSHORT[dt.getMonth()]}`;
}
export const fmtDayPlain = k => { const dt = parseDay(k); return `${dt.getDate()} de ${MNAMES[dt.getMonth()]}`; };
export function fmtMonth(mk) {
  const { y, m } = parseMonth(mk);
  return `${MNAMES[m]} ${y}`;
}
export function fmtWeekRange(wk) {
  const s = parseDay(wk), e = addDays(s, 6);
  return s.getMonth() === e.getMonth()
    ? `${s.getDate()}–${e.getDate()} ${MSHORT[e.getMonth()]}`
    : `${s.getDate()} ${MSHORT[s.getMonth()]} – ${e.getDate()} ${MSHORT[e.getMonth()]}`;
}
export const fmtWeek = wk => `Semana ${isoWeek(parseDay(wk))} · ${fmtWeekRange(wk)}`;
