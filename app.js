'use strict';
/* Daily Life — single-file app. Data lives on the phone (localStorage), works offline. */
const VERSION = '1.4.0';
const KEY = 'dl:v1';
const START = '2026-11-09'; // cycle 1, day 1

/* ---------- utils ---------- */
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const dkey = (d = new Date()) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const parseD = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const addD = (k, n) => { const d = parseD(k); d.setDate(d.getDate() + n); return dkey(d); };
const diffD = (a, b) => Math.round((parseD(b) - parseD(a)) / 864e5);
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DOWL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const toM = (hm) => { const [h, m] = hm.split(':').map(Number); return h * 60 + m; };
const fmtT = (hm) => { if (!hm) return ''; let [h, m] = hm.split(':').map(Number); const ap = h >= 12 && h < 24 ? 'PM' : 'AM'; h = h % 12 || 12; return h + ':' + pad(m) + ' ' + ap; };
const fmtTs = (hm) => fmtT(hm).replace(':00 ', ' ');
const fmtDur = (min) => { min = Math.max(0, Math.round(min)); const h = Math.floor(min / 60), m = min % 60; return h ? h + 'h' + (m ? ' ' + m + 'm' : '') : m + 'm'; };
const num = (v, d = 0) => { const n = parseFloat(v); return isFinite(n) ? n : d; };
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const nice = (k) => { const d = parseD(k); return DOW[d.getDay()] + ' ' + d.getDate() + ' ' + MON[d.getMonth()]; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const money = (v) => (db.settings.currency || '$') + (Math.round(v * 100) / 100).toLocaleString(undefined, { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 });
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

/* ---------- store ---------- */
const DEF = () => ({
  v: 1,
  settings: { theme: 'auto', name: 'Mo', currency: '$', budget: 1200, screenLimit: 180, waterGoal: 6, kcalGoal: 2200, proteinGoal: 120, weightGoal: '', wpmGoal: 60, pagesGoal: 5, alerts: false, countdown: true },
  tasks: [], ideas: [], reminders: [], tx: [],
  house: { items: [], people: 3, settled: [] },
  days: {}, health: {},
  habits: { book: null, finished: [], typing: [], speaking: [], notes: [] },
  periods: {}, timer: null,
  meta: { created: Date.now(), updated: 0, lastBackup: 0 }
});
function normalize(raw) {
    const d = DEF();
    for (const k of Object.keys(d)) if (raw[k] == null) raw[k] = d[k];
    raw.settings = Object.assign(d.settings, raw.settings);
    raw.habits = Object.assign(d.habits, raw.habits);
    raw.house = Object.assign(d.house, raw.house);
    raw.meta = Object.assign(d.meta, raw.meta);
    return raw;
}
function load() {
  try { const raw = JSON.parse(localStorage.getItem(KEY) || 'null'); return raw ? normalize(raw) : DEF(); } catch (e) { return DEF(); }
}
let db = load();
function save() {
  db.meta.updated = Date.now();
  try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { toast('Storage full — export a backup in Settings'); }
  if (window.DLSync) window.DLSync.changed();
}
const day = (k) => (db.days[k] = db.days[k] || { b: {}, p: {}, h: {}, x: [], done: '', blockers: '', fin: false, time: {}, log: [] });
const peekDay = (k) => db.days[k] || { b: {}, p: {}, h: {}, x: [], done: '', blockers: '', fin: false, time: {}, log: [] };
const hday = (k) => (db.health[k] = db.health[k] || { w: '', food: [], water: 0, ex: [], bed: '', wake: '', energy: 0, screen: '' });
const peekH = (k) => db.health[k] || { w: '', food: [], water: 0, ex: [], bed: '', wake: '', energy: 0, screen: '' };

/* ---------- schedule ---------- */
const CAT = { tent: '@tent_hox', doc: 'Doctrin', study: 'Study', work: 'Venture', meal: 'Meal', rest: 'Rest', pray: 'Prayer', personal: 'Personal' };
const B = (s, l, c, e, sub) => ({ s, l, c, e: e || '', sub: sub || '' });
const weekday = (wake, main, cat, eve) => [
  B('04:05', 'Fajr', 'pray'), B(wake, 'Wake up', 'rest'),
  B('09:15', 'Venture 1', 'work', '14:00', 'Dhuhr 12:45'),
  B('15:00', 'Eat & recharge', 'rest', '15:30', 'no screens'),
  B('15:30', main + ' · main block', cat, '17:30', '2h deep work'),
  B('16:45', 'Asr', 'pray')
].concat(eve, [
  B('19:15', 'Dinner', 'meal', '19:45'), B('19:45', 'Maghrib', 'pray'),
  B('20:00', 'Venture 2', 'work', '00:15', 'Isha ~9:00'), B('21:00', 'Isha', 'pray'),
  B('00:15', 'Shutdown', 'rest', '00:30', 'tick, log, plan tomorrow')
]);
const PREP = [B('17:30', 'Meal prep', 'meal', '19:15')];
const WALK = (w) => [B('17:30', 'Walk', 'rest', '18:00'), B('18:00', w, 'study', '19:15')];
const SCHED = {
  1: { focus: '@tent_hox', cat: 'tent', blocks: weekday('07:30', '@tent_hox', 'tent', PREP) },
  2: { focus: 'Doctrin', cat: 'doc', blocks: weekday('07:45', 'Doctrin', 'doc', WALK('Study / catch-up')) },
  3: { focus: '@tent_hox', cat: 'tent', blocks: weekday('07:45', '@tent_hox', 'tent', WALK('Study / catch-up')) },
  4: { focus: 'Doctrin', cat: 'doc', blocks: weekday('07:45', 'Doctrin', 'doc', PREP) },
  5: { focus: 'Flex', cat: 'study', blocks: weekday('07:45', 'Flex', 'study', WALK('Free / catch-up')) },
  6: { focus: 'Venture day', cat: 'work', blocks: [B('04:05', 'Fajr', 'pray'), B('07:45', 'Plan & read', 'rest', '09:15'), B('09:30', 'Venture 1', 'work', '21:30', 'pray Dhuhr, Asr, Maghrib on break'), B('21:45', 'Isha', 'pray'), B('22:00', 'Rest', 'rest', '23:30')] },
  0: { focus: 'Sunday deep work', cat: 'study', blocks: [B('04:05', 'Fajr', 'pray'), B('08:30', 'Weekly groceries', 'meal', '10:00'), B('10:00', 'Weekly review', 'study', '10:30'), B('10:30', 'Deep work', 'study', '12:40'), B('12:45', 'Dhuhr', 'pray'), B('13:00', 'Lunch & chores', 'meal', '14:00'), B('14:00', 'Buffer · catch-up only', 'study', '14:45'), B('15:00', 'Venture 1', 'work', '21:30'), B('21:45', 'Isha', 'pray')] }
};
const sched = (k) => SCHED[parseD(k).getDay()];
const PRAYERS = (k) => { const sat = parseD(k).getDay() === 6; return [['fajr', 'Fajr', '04:05'], ['dhuhr', 'Dhuhr', '12:45'], ['asr', 'Asr', '16:45'], ['maghrib', 'Maghrib', '19:45'], ['isha', 'Isha', sat ? '21:45' : '21:00']]; };
const tappable = (k) => sched(k).blocks.map((b, i) => [b, i]).filter(([b]) => b.c !== 'pray');
const ADJ = (m) => (m < 240 ? m + 1440 : m); // times after midnight belong to the previous day
// "logical" now: before 4 AM still counts as yesterday
function nowInfo() {
  const n = new Date(); let k = dkey(n); let m = n.getHours() * 60 + n.getMinutes();
  if (m < 240) { k = addD(k, -1); m += 1440; }
  return { k, m, sec: n.getSeconds() };
}
function currentBlock(k, m) {
  const bl = sched(k).blocks.filter((b) => b.c !== 'pray');
  let cur = null, next = null;
  for (let i = 0; i < bl.length; i++) {
    const s = ADJ(toM(bl[i].s)); const e = bl[i].e ? ADJ(toM(bl[i].e)) : (bl[i + 1] ? ADJ(toM(bl[i + 1].s)) : s + 30);
    if (m >= s && m < e) cur = { b: bl[i], s, e, i: sched(k).blocks.indexOf(bl[i]) };
    if (m < s && !next) next = { b: bl[i], s };
  }
  const pr = PRAYERS(k).map(([, n, t]) => ({ n, s: ADJ(toM(t)) })).find((p) => p.s > m);
  return { cur, next, pr };
}

/* ---------- habits per day ---------- */
const habitDefs = (k) => {
  const d = parseD(k).getDay();
  const h = [['read', 'Read ' + db.settings.pagesGoal + ' pages'], ['type', 'Typing practice'], ['talk', 'Public speaking practice']];
  if (d === 1 || d === 4) h.push(['hyg', 'Personal hygiene']);
  customHabits().filter((c) => c.days.includes(d) && (!c.start || c.start <= k)).forEach((c) => h.push(['c:' + c.id, c.name, c]));
  return h;
};
const customHabits = () => (db.habits.custom || []).filter((c) => !c.archived);
const DAYS_ORDER = [1, 2, 3, 4, 5, 6, 0];
const daysLabel = (days) => days.length === 7 ? 'Every day' : days.length === 5 && [1, 2, 3, 4, 5].every((x) => days.includes(x)) ? 'Weekdays' : days.length === 2 && days.includes(0) && days.includes(6) ? 'Weekends' : DAYS_ORDER.filter((x) => days.includes(x)).map((x) => DOW[x]).join(', ');
// true = done, false = missed, null = not scheduled that day (doesn't count either way)
const customTest = (c) => (k) => (!c.days.includes(parseD(k).getDay()) || (c.start && k < c.start)) ? null : !!peekDay(k).h['c:' + c.id];
function habitStats(k) {
  const dd = peekDay(k); const defs = habitDefs(k);
  const done = defs.filter(([id]) => dd.h[id]).length + (dd.x || []).filter((x) => x.done).length;
  return { done, total: defs.length + (dd.x || []).length };
}
function dayScore(k) {
  const dd = peekDay(k);
  const tb = tappable(k); const bd = tb.filter(([, i]) => dd.b[i] === 'done').length;
  const pr = PRAYERS(k).reduce((a, [id]) => a + (dd.p[id] === 'on' ? 1 : dd.p[id] === 'late' ? 0.5 : 0), 0);
  const hs = habitStats(k);
  const top = db.tasks.filter((t) => t.top === k); const td = top.filter((t) => t.st === 'done').length;
  const tot = tb.length + 5 + hs.total + top.length;
  return { pct: tot ? Math.round(((bd + pr + hs.done + td) / tot) * 100) : 0, bd, bt: tb.length, pOn: PRAYERS(k).filter(([id]) => dd.p[id] === 'on' || dd.p[id] === 'late').length, hs, td, tt: top.length };
}
// "Never miss twice": one missed day doesn't break a chain; two in a row does.
function streak(test) {
  const t = nowInfo().k; let k = test(t) === true ? t : addD(t, -1); let n = 0, gap = 0;
  for (let i = 0; i < 800; i++) { const r = test(k); if (r === true) { n++; gap = 0; } else if (r !== null && ++gap >= 2) break; k = addD(k, -1); }
  return n;
}
function best(test) {
  const keys = Object.keys(db.days).concat(Object.keys(db.health)).sort(); if (!keys.length) return 0;
  let k = keys[0], b = 0, c = 0, gap = 0; const end = nowInfo().k;
  for (let i = 0; i < 800 && k <= end; i++) { const r = test(k); if (r === true) { c++; gap = 0; b = Math.max(b, c); } else if (r !== null && ++gap >= 2) c = 0; k = addD(k, 1); }
  return b;
}
// missed yesterday, not yet done today, chain still alive -> nudge
function atRisk(test) {
  const t = nowInfo().k; if (test(t) !== false) return false; // done today, or not scheduled today
  let y = addD(t, -1); for (let i = 0; i < 7 && test(y) === null; i++) y = addD(y, -1); // last scheduled day
  return test(y) === false && streak(test) > 0;
}
const HABIT_TESTS = () => [['Reading', (k) => !!peekDay(k).h.read, 'habits'], ['Typing', (k) => !!peekDay(k).h.type, 'habits'], ['Speaking', (k) => !!peekDay(k).h.talk, 'habits'], ['All 5 prayers', (k) => PRAYERS(k).every(([id]) => peekDay(k).p[id]), 'today']].concat(customHabits().map((c) => [c.name, customTest(c), 'habits']));
const allPrayers = (k) => PRAYERS(k).every(([id]) => peekDay(k).p[id]);
const didRead = (k) => !!peekDay(k).h.read;
const didType = (k) => !!peekDay(k).h.type;
const didTalk = (k) => !!peekDay(k).h.talk;

/* ---------- icons ---------- */
const P = {
  home: '<rect x="3" y="3" width="7" height="9" rx="2"/><rect x="14" y="3" width="7" height="5" rx="2"/><rect x="14" y="12" width="7" height="9" rx="2"/><rect x="3" y="16" width="7" height="5" rx="2"/>',
  today: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  tasks: '<rect x="3" y="3" width="18" height="18" rx="4"/><path d="M8 12l3 3 5-6"/>',
  money: '<path d="M3 7a2 2 0 0 1 2-2h12v4"/><rect x="3" y="7" width="18" height="13" rx="2"/><circle cx="16.5" cy="13.5" r="1.3"/>',
  health: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
  back: '<path d="M15 18l-6-6 6-6"/>', chev: '<path d="M9 18l6-6-6-6"/>',
  play: '<path d="M8 5v14l11-7z" fill="currentColor"/>', stop: '<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', x: '<path d="M18 6L6 18M6 6l12 12"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>', check: '<path d="M5 12l5 5L20 7"/>',
  flame: '<path d="M12 2c1 4 5 5 5 10a5 5 0 0 1-10 0c0-3 2-4 2-7 2 1 3 3 3 5"/>',
  star: '<path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5V21h16"/>'
};
const ic = (n, s = 22, w = 2, extra = '') => '<svg width="' + s + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="' + w + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ' + extra + '>' + P[n] + '</svg>';

/* ---------- sync bridge (sync.js plugs in here) ---------- */
const SYNC = { loaded: false, failed: false, user: null, state: 'idle', pending: false, last: 0, error: '' };
window.DL = {
  KEY, VERSION, SYNC,
  get: () => db,
  normalize, fresh: DEF,
  replace(nd) { db = normalize(nd); try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) {} applyTheme(); softRender(); },
  update() { softRender(); },
  toast: (m) => toast(m),
  hasData: () => db.tasks.length + db.tx.length + db.ideas.length + db.reminders.length + Object.keys(db.days).length + Object.keys(db.health).length + db.house.items.length + db.habits.typing.length > 0
};
function softRender() { const a = document.activeElement; if (a && /INPUT|TEXTAREA|SELECT/.test(a.tagName) && a.closest('#view')) return; if (!$('#sheet').hidden) return; render(true); }

/* ---------- ui state ---------- */
const ui = { tDate: null, taskRange: 'all', taskProj: 'all', inboxTab: 'rem', period: null, monthOff: 0 };

/* ---------- shared pieces ---------- */
const catPill = (c) => '<span class="pill" style="background:var(--' + c + '-bg);color:var(--' + c + '-fg)">' + esc(CAT[c] || c) + '</span>';
const backHead = (title, sub, to) => '<header class="row"><a href="#' + (to || 'home') + '" class="iconbtn" aria-label="Back">' + ic('back', 20, 2.2) + '</a><div><h1>' + esc(title) + '</h1>' + (sub ? '<div class="sm muted">' + esc(sub) + '</div>' : '') + '</div></header>';
const empty = (t) => '<div class="empty">' + t + '</div>';
const PROJ = [['tent', '@tent_hox'], ['doc', 'Doctrin'], ['study', 'Study'], ['work', 'Venture'], ['personal', 'Personal']];
const projColor = (p) => ({ tent: 'var(--tent)', doc: 'var(--doc)', study: 'var(--study)', work: 'var(--work)', personal: 'var(--meal)' }[p] || 'var(--work)');

/* =================== HOME =================== */
function vHome() {
  const { k, m } = nowInfo(); const sc = dayScore(k); const h = new Date().getHours();
  const greet = h < 4 ? 'Late night' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  const dcyc = diffD(START, k);
  const cyc = dcyc < 0 ? 'Starts ' + nice(START) : 'Cycle ' + (Math.floor(dcyc / 14) + 1) + ' · Day ' + ((dcyc % 14) + 1) + ' of 14';
  const cycPct = dcyc < 0 ? 0 : (((dcyc % 14) + 1) / 14) * 100;
  const R = 34, C = 2 * Math.PI * R;
  const dueRem = db.reminders.filter((r) => !r.done && r.when && new Date(r.when) <= new Date()).length;
  const { cur, next, pr } = currentBlock(k, m);
  const t = db.timer;
  let nowCard;
  const nxt = [next ? next.b.l + ' at ' + fmtTs(next.b.s) : '', pr ? pr.n + ' at ' + fmtTs(PRAYERS(k).find((x) => x[1] === pr.n)[2]) : ''].filter(Boolean).join(' · ');
  if (t) {
    nowCard = '<section class="card" aria-label="Timer running"><div class="row between"><span class="small b muted">TRACKING · started ' + fmtT(pad(new Date(t.start).getHours()) + ':' + pad(new Date(t.start).getMinutes())) + '</span>' + catPill(t.cat) + '</div>' +
      '<div class="row between"><div class="grow"><div style="font-size:19px;font-weight:800">' + esc(t.label) + '</div><div id="tick" style="font-size:38px;font-weight:800;letter-spacing:-1px;font-variant-numeric:tabular-nums">' + elapsed() + '</div></div>' +
      '<button class="iconbtn" data-a="timerStop" aria-label="Stop timer" style="width:64px;height:64px;flex-basis:64px;border-radius:32px;background:var(--bad);color:#fff;border:0">' + ic('stop', 22) + '</button></div>' +
      (nxt ? '<div class="sm muted">Next: ' + esc(nxt) + '</div>' : '') + '</section>';
  } else if (cur) {
    const left = cur.e - m;
    nowCard = '<section class="card" aria-label="Now"><div class="row between"><span class="small b muted">NOW · ' + fmtTs(cur.b.s) + ' – ' + fmtTs(cur.b.e || '') + '</span>' + catPill(cur.b.c) + '</div>' +
      '<div class="row between"><div class="grow"><div style="font-size:20px;font-weight:800">' + esc(cur.b.l) + '</div><div class="sm muted">' + fmtDur(left) + ' left' + (cur.b.sub ? ' · ' + esc(cur.b.sub) : '') + '</div></div>' +
      '<button class="iconbtn" data-a="timerStart" data-cat="' + cur.b.c + '" data-label="' + esc(cur.b.l) + '" aria-label="Start tracking ' + esc(cur.b.l) + '" style="width:64px;height:64px;flex-basis:64px;border-radius:32px;background:var(--btn);color:var(--btnInk);border:0">' + ic('play', 24) + '</button></div>' +
      (nxt ? '<div class="sm muted">Next: ' + esc(nxt) + '</div>' : '') + '</section>';
  } else {
    nowCard = '<section class="card"><div class="small b muted">NOW</div><div style="font-size:18px;font-weight:800">Free time</div>' + (nxt ? '<div class="sm muted">Next: ' + esc(nxt) + '</div>' : '') +
      '<button class="btn ghost sm" data-a="timerStart" data-cat="personal" data-label="Free time">' + ic('play', 16) + ' Track something</button></section>';
  }
  // challenges
  const wk = weekKeys(k);
  const lim = db.settings.screenLimit;
  const scrDays = wk.filter((x) => x <= k && peekH(x).screen !== '' && num(peekH(x).screen) <= lim).length;
  const ch = [
    ['STREAK', 'All 5 prayers', streak(allPrayers), best(allPrayers), 'pray'],
    ['STREAK', 'Reading', streak(didRead), best(didRead), 'doc'],
    ['STREAK', 'Typing', streak(didType), best(didType), 'study'],
    ['LIMIT', 'Screen under ' + fmtDur(lim), scrDays, null, 'tent']
  ].map(([kind, title, v, b, c]) => '<a href="#' + (kind === 'LIMIT' ? 'health' : 'habits') + '" class="card tight" style="padding:14px"><div class="row small b" style="gap:5px;color:var(--' + c + '-fg)">' + ic('flame', 13, 2.4) + kind + '</div><div class="b" style="font-size:15px">' + esc(title) + '</div><div class="bar"><i style="width:' + Math.min(100, (v / 7) * 100) + '%;background:var(--' + c + ')"></i></div><div class="small muted">' + (b == null ? v + ' of 7 days this week' : v + ' day' + (v === 1 ? '' : 's') + ' · best ' + b) + '</div></a>').join('');
  // top 3
  const top = db.tasks.filter((x) => x.top === k);
  const topHtml = top.length ? top.map((x) => '<div class="list-row"><button class="check' + (x.st === 'done' ? ' on' : '') + '" data-a="taskToggle" data-id="' + x.id + '" aria-label="Mark ' + esc(x.t) + ' done">' + (x.st === 'done' ? ic('check', 14, 3, 'style="color:#fff"') : '') + '</button><span class="grow" style="font-size:15px;' + (x.st === 'done' ? 'text-decoration:line-through;color:var(--muted)' : '') + '">' + esc(x.t) + '</span><i style="width:8px;height:8px;border-radius:4px;background:' + projColor(x.proj) + '"></i></div>').join('')
    : empty('No Top 3 picked for today. Star tasks in <a class="b" href="#tasks">Tasks</a> or plan them at the end of Today.');
  // week bars (hours tracked)
  const mx = Math.max(60, ...wk.map((x) => Object.values(peekDay(x).time || {}).reduce((a, b) => a + b, 0)));
  const bars = wk.map((x) => { const v = Object.values(peekDay(x).time || {}).reduce((a, b) => a + b, 0); const sc2 = dayScore(x).pct; return '<div style="display:flex;flex-direction:column;align-items:center;gap:4px;flex:1"><div style="height:70px;display:flex;align-items:flex-end"><i style="display:block;width:22px;border-radius:6px;height:' + Math.max(3, (v / mx) * 70) + 'px;background:' + (x === k ? 'var(--ink)' : 'var(--line2)') + '"></i></div><span class="small ' + (x === k ? 'b' : 'muted') + '">' + DOW[parseD(x).getDay()][0] + '</span><span class="small muted" style="font-size:10px">' + (x <= k ? sc2 + '%' : '') + '</span></div>'; }).join('');
  const wkMin = wk.reduce((a, x) => a + Object.values(peekDay(x).time || {}).reduce((p, q) => p + q, 0), 0);
  // money
  const mk = k.slice(0, 7); const spent = db.tx.filter((x) => x.d.slice(0, 7) === mk).reduce((a, x) => a + num(x.amt), 0);
  const hTot = db.house.items.reduce((a, x) => a + num(x.amt), 0); const owed = db.house.people > 1 ? hTot * (db.house.people - 1) / db.house.people : 0;
  const bud = db.settings.budget;
  // reminders
  const rem = db.reminders.filter((r) => !r.done).sort((a, b) => (a.when || '9') < (b.when || '9') ? -1 : 1)[0];
  return '<header class="row between" style="align-items:flex-start"><div><div class="sm muted">' + DOWL[new Date().getDay()] + ', ' + new Date().getDate() + ' ' + MONL[new Date().getMonth()] + '</div><h1>' + greet + ', ' + esc(db.settings.name) + '</h1>' + syncPill() + '</div>' +
    '<div class="row" style="gap:8px"><a href="#settings" class="iconbtn" aria-label="Settings">' + ic('gear', 20) + '</a><a href="#inbox" class="iconbtn" aria-label="Inbox' + (dueRem ? ', ' + dueRem + ' due' : '') + '">' + ic('bell', 20) + (dueRem ? '<i class="dotbadge"></i>' : '') + '</a></div></header>' +
    (function () { const Y = yearInfo(); return '<button class="tap row" data-a="countdown" style="background:var(--warn-bg);color:var(--warn-fg);border-radius:14px;padding:0 14px;min-height:44px;gap:10px" aria-label="' + Y.left + ' days left in ' + Y.y + '"><span class="xb" style="font-size:18px">' + Y.left + '</span><span class="sm b grow">days left in ' + Y.y + '</span><span class="bar" style="width:70px;background:rgba(0,0,0,.08)"><i style="width:' + Y.pct + '%;background:var(--warn)"></i></span><span class="small b">' + Y.pct + '%</span></button>'; })() +
    '<a href="#today" class="hero"><svg width="88" height="88" viewBox="0 0 88 88" role="img" aria-label="Today ' + sc.pct + ' percent"><circle cx="44" cy="44" r="' + R + '" fill="none" stroke="rgba(255,255,255,.14)" stroke-width="9"/><circle cx="44" cy="44" r="' + R + '" fill="none" stroke="#6FCF97" stroke-width="9" stroke-linecap="round" stroke-dasharray="' + (C * sc.pct / 100).toFixed(1) + ' ' + C.toFixed(1) + '" transform="rotate(-90 44 44)"/><text x="44" y="46" text-anchor="middle" fill="currentColor" font-size="20" font-weight="800">' + sc.pct + '%</text><text x="44" y="62" text-anchor="middle" fill="currentColor" opacity=".6" font-size="10">today</text></svg>' +
    '<div class="grow"><div class="sm" style="color:var(--heroMuted)">' + cyc + '</div><div class="bar" style="background:rgba(255,255,255,.14);margin:8px 0 12px"><i style="width:' + cycPct + '%;background:#fff"></i></div><div class="row between"><div class="stat"><b>' + sc.pOn + '/5</b><span>Prayers</span></div><div class="stat"><b>' + sc.hs.done + '/' + sc.hs.total + '</b><span>Habits</span></div><div class="stat"><b>' + sc.td + '/' + (sc.tt || 3) + '</b><span>Top 3</span></div><div class="stat"><b>' + sc.bd + '/' + sc.bt + '</b><span>Blocks</span></div></div></div></a>' +
    morningCard(k) + comebackCard() +
    nowCard +
    '<section aria-label="Challenges"><div class="head" style="margin-bottom:8px"><h2>Challenges</h2><a class="link" href="#reports" style="color:var(--muted)">Reports ›</a></div><div class="grid2">' + ch + '</div></section>' +
    '<section class="card tight"><div class="head"><h2>Top 3 today</h2><a class="link" href="#tasks" style="color:var(--muted)">All tasks ›</a></div><div>' + topHtml + '</div></section>' +
    '<section class="card tight"><div class="head"><h2>Ideas</h2><a class="link" href="#inbox" data-a="inboxTab" data-tab="idea" style="color:var(--muted)">Inbox ›</a></div>' +
    '<div class="row"><label class="sr" for="qidea">Capture an idea</label><input id="qidea" class="in grow" placeholder="Capture an idea…" enterkeyhint="done" data-enter="ideaAdd"><button class="iconbtn" data-a="ideaAdd" aria-label="Save idea" style="background:var(--btn);color:var(--btnInk);border:0">' + ic('plus', 20, 2.4) + '</button></div>' +
    (db.ideas.slice(0, 3).map((x) => '<div class="sm" style="padding:6px 0;border-top:1px solid var(--line)">' + esc(x.t) + '</div>').join('') || '') + '</section>' +
    '<a href="#habits" class="card tight"><div class="head"><h2>Habits</h2><span class="link">Open ›</span></div><div class="grid3">' +
    [['Reading', streak(didRead), 'doc'], ['Typing', streak(didType), 'study'], ['Speaking', streak(didTalk), 'tent']].map(([n, v, c]) => '<div><div class="small b" style="color:var(--' + c + '-fg)">' + n + '</div><div class="xb" style="font-size:18px">' + v + '<span class="small muted"> days</span></div></div>').join('') + '</div></a>' +
    '<section class="card tight"><div class="head"><h2>This week</h2><span class="sm muted">' + fmtDur(wkMin) + ' tracked</span></div><div class="row" style="align-items:flex-end;gap:4px">' + bars + '</div></section>' +
    '<a href="#money" class="card tight"><div class="head"><h2>Money · ' + MONL[parseD(k).getMonth()] + '</h2><span class="link">Open ›</span></div><div class="row between"><div><span class="xb" style="font-size:22px">' + money(spent) + '</span><span class="sm muted"> of ' + money(bud) + '</span></div>' + (owed > 0 ? '<span class="pill" style="background:var(--house-bg);color:var(--house)">Household: ' + money(owed) + ' owed</span>' : '') + '</div><div class="bar"><i style="width:' + Math.min(100, pct(spent, bud)) + '%;background:' + (spent > bud ? 'var(--bad)' : 'var(--good)') + '"></i></div></a>' +
    (rem ? '<a href="#inbox" class="card tight" style="background:var(--warn-bg);border-color:transparent"><div class="row between"><div class="grow"><div class="small b" style="color:var(--warn-fg)">REMINDER' + (rem.when ? ' · ' + remWhen(rem.when) : '') + '</div><div class="b" style="color:var(--warn-fg)">' + esc(rem.t) + '</div></div><span class="link" style="color:var(--warn-fg)">View ›</span></div></a>' : '');
}
function morningCard(k) {
  if (k !== nowInfo().k) return '';
  const pl = peekDay(k).plan;
  if (pl && pl.done) {
    const t = pl.mitTask ? db.tasks.find((x) => x.id === pl.mitTask) : null;
    const label = t ? t.t : pl.mit; const done = t ? t.st === 'done' : !!pl.mitDone;
    return '<section class="card tight" style="border:2px solid var(--warn)"><div class="row between"><span class="small xb" style="color:var(--warn-fg)">TODAY\'S ONE THING</span><button class="link" data-a="planEdit" style="color:var(--muted)">Edit</button></div>' +
      '<div class="row"><button class="check' + (done ? ' on' : '') + '" data-a="mitToggle" aria-label="Mark one thing done">' + (done ? ic('check', 14, 3, 'style="color:#fff"') : '') + '</button><span class="grow xb" style="font-size:17px;' + (done ? 'text-decoration:line-through;color:var(--muted)' : '') + '">' + esc(label || 'Deleted task') + '</span></div>' +
      (pl.intent ? '<div class="sm muted" style="font-style:italic">\u201C' + esc(pl.intent) + '\u201D</div>' : '') + '</section>';
  }
  const open = db.tasks.filter((t) => t.st !== 'done').sort((a, b) => (b.top === k) - (a.top === k) || ((a.due || '9') < (b.due || '9') ? -1 : 1)).slice(0, 5);
  const S = sched(k); const upcoming = S.blocks.filter((b) => b.c !== 'pray').slice(0, 4).map((b) => fmtTs(b.s) + ' ' + b.l).join(' · ');
  const h = new Date().getHours();
  return '<section class="card" style="border:2px solid var(--warn)"><div class="row between"><h2>' + (h < 12 ? 'Morning plan' : 'Plan your day') + '</h2><span class="small muted">1 minute</span></div>' +
    '<div class="small b muted">1 · What\'s the ONE thing that makes today a win?</div>' +
    (open.length ? '<div class="chips" id="mit">' + open.map((t) => '<button class="chip" data-a="pickChip" data-group="mit" data-v="' + t.id + '" style="max-width:100%;overflow:hidden;text-overflow:ellipsis">' + esc(t.t) + '</button>').join('') + '</div>' : '') +
    '<label class="sr" for="mitText">Or type it</label><input id="mitText" class="in" placeholder="' + (open.length ? 'or type something else…' : 'e.g. Finish Doctrin abstract') + '">' +
    '<div class="small b muted">2 · How do you want to show up today?</div><label class="sr" for="intent">Intention</label><input id="intent" class="in" placeholder="e.g. calm, focused, no phone in main block">' +
    '<div class="small b muted">3 · Today at a glance</div><div class="sm" style="line-height:1.5"><b>' + esc(S.focus) + '</b> · ' + esc(upcoming) + ' · 5 prayers</div>' +
    '<button class="btn full" data-a="planDone">Start my day</button></section>';
}
function comebackCard() {
  const r = HABIT_TESTS().filter(([, t]) => atRisk(t));
  if (!r.length) return '';
  return '<section class="card tight" style="background:var(--warn-bg);border-color:transparent"><div class="small xb" style="color:var(--warn-fg)">NEVER MISS TWICE</div><div class="sm" style="color:var(--warn-fg)">You missed <b>' + r.map((x) => esc(x[0])).join(', ') + '</b> yesterday. Missing once is normal — do it today and your chain stays alive.</div><div class="chips">' + r.map(([n, t, to]) => '<a href="#' + to + '" class="chip" style="display:inline-flex;align-items:center;background:var(--card)">' + esc(n) + ' · ' + streak(t) + '-day chain ›</a>').join('') + '</div></section>';
}
function yearInfo() {
  const now = new Date(); const y = now.getFullYear(); const today = dkey(now);
  const end = y + '-12-31', start = y + '-01-01';
  const left = diffD(today, end); // days after today
  const total = diffD(start, end) + 1; const passed = diffD(start, today) + 1;
  let fridays = 0, weekends = 0; for (let k = addD(today, 1); k <= end; k = addD(k, 1)) { const d = parseD(k).getDay(); if (d === 5) fridays++; if (d === 6) weekends++; }
  return { y, left, total, passed, pct: Math.round((passed / total) * 100), weeks: Math.floor(left / 7), fridays, weekends };
}
const YEAR_LINES = ['Small steps every day still add up before the year ends.', 'You don\'t need a new year to start. You have today.', 'Pick one thing you\'ll be proud of on 31 December — and work on it today.', 'Every day you show up counts. Make today one of them.', 'The year isn\'t over. Finish strong.', 'Consistency beats intensity. Just don\'t miss twice.'];
function countdownSheet() {
  const Y = yearInfo(); const line = YEAR_LINES[parseD(dkey()).getDate() % YEAR_LINES.length];
  const R = 70, C = 2 * Math.PI * R;
  const big = Y.left === 0 ? 'Last day' : Y.left;
  return '<div style="text-align:center;display:flex;flex-direction:column;gap:10px;align-items:center">' +
    '<div class="small xb muted" style="letter-spacing:1px">' + Y.y + ' COUNTDOWN</div>' +
    '<svg width="170" height="170" viewBox="0 0 170 170" role="img" aria-label="' + Y.left + ' days left in ' + Y.y + '"><circle cx="85" cy="85" r="' + R + '" fill="none" stroke="var(--soft)" stroke-width="12"/><circle cx="85" cy="85" r="' + R + '" fill="none" stroke="var(--warn)" stroke-width="12" stroke-linecap="round" stroke-dasharray="' + (C * Y.pct / 100).toFixed(1) + ' ' + C.toFixed(1) + '" transform="rotate(-90 85 85)"/>' +
    '<text x="85" y="' + (Y.left === 0 ? 92 : 88) + '" text-anchor="middle" fill="currentColor" font-size="' + (Y.left === 0 ? 26 : 46) + '" font-weight="800">' + big + '</text>' + (Y.left ? '<text x="85" y="114" text-anchor="middle" fill="var(--muted)" font-size="13" font-weight="600">day' + (Y.left === 1 ? '' : 's') + ' left</text>' : '') + '</svg>' +
    '<h2 style="font-size:20px">' + (Y.left ? Y.left + ' day' + (Y.left === 1 ? '' : 's') + ' left in ' + Y.y : 'Last day of ' + Y.y + ' — finish strong') + '</h2>' +
    '<div class="sm muted">' + Y.pct + '% of the year is done' + (Y.left ? ' · about ' + Y.weeks + ' week' + (Y.weeks === 1 ? '' : 's') + ', ' + Y.weekends + ' weekend' + (Y.weekends === 1 ? '' : 's') + ' and ' + Y.fridays + ' Friday' + (Y.fridays === 1 ? '' : 's') + ' to go' : '') + '</div>' +
    '<div class="bar" style="width:100%;height:8px"><i style="width:' + Y.pct + '%;background:var(--warn)"></i></div>' +
    '<div class="sm" style="font-style:italic;line-height:1.45">\u201C' + line + '\u201D</div></div>' +
    '<button class="btn full" data-a="sheetClose">Let\'s make today count</button>' +
    '<button class="link" data-a="countdownOff" style="align-self:center;color:var(--muted)">Don\'t pop up every day</button>';
}
function weekKeys(k) { const d = parseD(k).getDay(); const mon = addD(k, -((d + 6) % 7)); return [0, 1, 2, 3, 4, 5, 6].map((i) => addD(mon, i)); }
function elapsed() { const t = db.timer; if (!t) return '00:00:00'; const s = Math.floor((Date.now() - t.start) / 1000); return pad(Math.floor(s / 3600)) + ':' + pad(Math.floor(s / 60) % 60) + ':' + pad(s % 60); }
function syncPill() {
  const on = navigator.onLine; const S = SYNC;
  let t, off = false;
  if (S.user) {
    if (!on) { t = 'Offline · will sync later'; off = true; }
    else if (S.state === 'error') { t = 'Sync problem · tap'; off = true; }
    else if (S.state === 'syncing' || S.pending) t = 'Syncing…';
    else t = 'Synced' + (S.last ? ' · ' + ago(S.last) : '');
  } else { t = on ? 'Saved on phone · sign in to sync' : 'Offline · still saving'; off = !on; }
  return '<a href="#settings" class="sync' + (off ? ' off' : '') + '"><i></i>' + esc(t) + '</a>';
}
function ago(ts) { const s = Math.round((Date.now() - ts) / 1000); return s < 45 ? 'just now' : s < 3600 ? Math.round(s / 60) + 'm ago' : s < 86400 ? Math.round(s / 3600) + 'h ago' : nice(dkey(new Date(ts))); }
function remWhen(w) { const d = new Date(w); const k = dkey(d); const t = nowInfo().k; const hm = pad(d.getHours()) + ':' + pad(d.getMinutes()); return (k === dkey() ? 'Today' : k === addD(dkey(), 1) ? 'Tomorrow' : nice(k)) + ' ' + fmtTs(hm); }

/* =================== TODAY =================== */
function vToday() {
  const nk = nowInfo().k; const k = ui.tDate || nk; const dd = peekDay(k); const S = sched(k);
  const wk = weekKeys(k);
  const strip = wk.map((x) => '<button class="' + (x === k ? 'on' : '') + '" data-a="tDate" data-k="' + x + '" aria-label="' + nice(x) + '" aria-pressed="' + (x === k) + '"><span>' + DOW[parseD(x).getDay()] + '</span><b>' + parseD(x).getDate() + '</b><i style="background:' + (x === nk ? 'var(--warn)' : 'var(--' + sched(x).cat + ')') + '"></i></button>').join('');
  const { cur } = k === nk ? currentBlock(k, nowInfo().m) : {};
  const BADGE = { done: ['Done', 'good'], skip: ['Skipped', 'bad'], moved: ['Moved → Sun buffer', 'warn'] };
  const blocks = S.blocks.map((b, i) => {
    if (b.c === 'pray') return '<div class="row" style="padding:2px 14px;min-height:30px"><span class="small b" style="width:58px;color:var(--pray-fg)">' + fmtTs(b.s) + '</span><span class="small b" style="color:var(--pray-fg)">' + esc(b.l) + '</span></div>';
    const st = dd.b[i] || ''; const bd = BADGE[st];
    return '<button class="block ' + st + (cur && cur.i === i ? ' now' : '') + '" data-a="block" data-i="' + i + '" style="background:var(--' + b.c + '-bg);color:var(--' + b.c + '-fg)" aria-label="' + esc(b.l) + ' at ' + fmtT(b.s) + (bd ? ', ' + bd[0] : '') + '. Tap to change"><span class="t">' + fmtTs(b.s) + '</span><span class="grow"><span class="l b" style="display:block;font-size:15px">' + esc(b.l) + '</span>' + (b.sub || b.e ? '<span class="small" style="opacity:.8">' + (b.e ? 'until ' + fmtTs(b.e) : '') + (b.sub && b.e ? ' · ' : '') + esc(b.sub) + '</span>' : '') + '</span>' + (bd ? '<span class="pill" style="background:var(--' + bd[1] + '-bg);color:var(--' + bd[1] + '-fg)">' + bd[0] + '</span>' : (cur && cur.i === i ? '<span class="pill" style="background:var(--btn);color:var(--btnInk)">Now</span>' : '')) + '</button>';
  }).join('');
  const sc = dayScore(k);
  const prayers = PRAYERS(k).map(([id, n, t]) => { const v = dd.p[id] || ''; return '<button class="' + (v === 'on' ? 'on' : v === 'late' ? 'late' : '') + '" data-a="pray" data-id="' + id + '" aria-label="' + n + ': ' + (v === 'on' ? 'on time' : v === 'late' ? 'late' : 'not marked') + '. Tap to change">' + n + '<span>' + (v === 'on' ? 'On time' : v === 'late' ? 'Late' : fmtTs(t)) + '</span></button>'; }).join('');
  const hab = habitDefs(k).map(([id, l]) => {
    const on = !!dd.h[id];
    let sub = '';
    if (id === 'read') { const bk = db.habits.book; sub = bk ? esc(bk.title) + ' · p.' + bk.page + '/' + bk.total : 'Add your book in Habits'; }
    if (id === 'type') { const s = db.habits.typing.find((x) => x.d === k); sub = s ? s.wpm + ' WPM · ' + s.acc + '% · ' + s.min + ' min' : 'Aim 15 min · log speed in Habits'; }
    if (id === 'talk') { const s = db.habits.speaking.filter((x) => x.d === k); sub = s.length ? s.reduce((a, x) => a + num(x.min), 0) + ' min · ' + esc(s[0].topic) : 'Camera, mirror or voice note'; }
    if (id === 'hyg') sub = 'Mon & Thu';
    if (id.startsWith('c:')) { const c = habitDefs(k).find((x) => x[0] === id)[2]; sub = (c.target ? esc(c.target) + ' · ' : '') + daysLabel(c.days); }
    return '<div class="list-row"><button class="tap row grow" data-a="habit" data-id="' + id + '" aria-pressed="' + on + '" style="min-height:52px"><span class="box' + (on ? ' on' : '') + '">' + (on ? ic('check', 14, 3, 'style="color:var(--btnInk)"') : '') + '</span><span class="grow"><span class="b" style="display:block;font-size:15px">' + l + '</span><span class="small muted">' + sub + '</span></span></button>' + (['read', 'type', 'talk'].includes(id) ? '<a href="#habits" class="link" style="white-space:nowrap">Log ›</a>' : '') + '</div>';
  }).join('') + (dd.x || []).map((x, j) => '<div class="list-row"><button class="tap row grow" data-a="xHabit" data-j="' + j + '" aria-pressed="' + !!x.done + '" style="min-height:52px"><span class="box' + (x.done ? ' on' : '') + '">' + (x.done ? ic('check', 14, 3, 'style="color:var(--btnInk)"') : '') + '</span><span class="b grow" style="font-size:15px">' + esc(x.t) + '</span></button><button class="del" data-a="xDel" data-j="' + j + '" aria-label="Remove ' + esc(x.t) + '">' + ic('x', 16) + '</button></div>').join('');
  const hh = peekH(k);
  const slept = sleepMin(hh);
  const tk = addD(k, 1);
  const cand = db.tasks.filter((t) => t.st !== 'done').sort((a, b) => (b.top === tk) - (a.top === tk));
  const nTop = db.tasks.filter((t) => t.top === tk).length;
  return '<header class="row between"><div><h1>' + (k === nk ? 'Today' : nice(k)) + '</h1><div class="sm muted">' + nice(k) + ' · focus: ' + esc(S.focus) + '</div></div><div class="row" style="gap:6px"><button class="iconbtn" data-a="tWeek" data-n="-7" aria-label="Previous week">' + ic('back', 18) + '</button><button class="iconbtn" data-a="tWeek" data-n="7" aria-label="Next week">' + ic('chev', 18) + '</button></div></header>' +
    '<div class="daystrip">' + strip + '</div>' +
    (k !== nk ? '<button class="btn ghost sm" data-a="tDate" data-k="' + nk + '">Jump to today</button>' : '') +
    '<section class="card tight"><div class="head"><h2>Schedule</h2><span class="sm muted">' + sc.bd + ' of ' + sc.bt + ' done</span></div><div class="small muted">Tap a block: done → skipped → moved → clear</div><div class="col" style="gap:6px">' + blocks + '</div></section>' +
    '<section class="card tight"><div class="head"><h2>Prayers</h2><span class="sm muted">' + sc.pOn + ' / 5</span></div><div class="prayers">' + prayers + '</div></section>' +
    '<section class="card tight"><div class="head"><h2>Habits</h2><span class="row" style="gap:10px"><span class="sm muted">' + sc.hs.done + ' / ' + sc.hs.total + '</span><a href="#habits" class="link">Open Habits ›</a></span></div><div>' + hab + '</div>' +
    '<div class="row"><label class="sr" for="xh">Other habit</label><input id="xh" class="in grow" placeholder="Other habit for today…" data-enter="xAdd"><button class="btn ghost sm" data-a="xAdd">Add</button></div></section>' +
    '<a href="#health" class="card tight"><div class="head"><h2>Health today</h2><span class="link">Open ›</span></div><div class="grid3"><div><div class="small muted">Water</div><div class="b">' + (hh.water || 0) + ' / ' + db.settings.waterGoal + '</div></div><div><div class="small muted">Sleep</div><div class="b">' + (slept ? fmtDur(slept) : '—') + '</div></div><div><div class="small muted">Screen</div><div class="b">' + (hh.screen !== '' ? fmtDur(num(hh.screen)) : '—') + '</div></div></div></a>' +
    '<section class="card tight"><h2>How did today go?</h2><label class="f">Done today<textarea class="in" rows="3" data-c="dayText" data-f="done" placeholder="What did you finish or get better at?">' + esc(dd.done) + '</textarea></label><label class="f">Blockers<textarea class="in" rows="2" data-c="dayText" data-f="blockers" placeholder="What got in the way?">' + esc(dd.blockers) + '</textarea></label></section>' +
    '<section class="card tight"><div class="head"><h2>Plan ' + (k === nk ? 'tomorrow' : nice(tk)) + '\'s Top 3</h2><span class="sm muted">' + nTop + ' / 3</span></div>' +
    (cand.length ? cand.slice(0, 8).map((t) => { const on = t.top === tk; return '<button class="tap list-row" data-a="planTop" data-id="' + t.id + '" aria-pressed="' + on + '"><span style="color:' + (on ? 'var(--warn)' : 'var(--line2)') + '">' + ic('star', 22, 2, on ? 'fill="currentColor"' : '') + '</span><span class="grow" style="font-size:15px">' + esc(t.t) + '</span><i style="width:8px;height:8px;border-radius:4px;background:' + projColor(t.proj) + '"></i></button>'; }).join('') : empty('No open tasks yet.')) +
    '<div class="row"><label class="sr" for="pt">Add a task for tomorrow</label><input id="pt" class="in grow" placeholder="Add a task for tomorrow…" data-enter="planAdd"><button class="btn ghost sm" data-a="planAdd">Add</button></div></section>' +
    '<button class="btn full" data-a="finish" style="height:54px">' + (dd.fin ? ic('check', 18, 2.6) + ' Day finished · ' + sc.pct + '%' : 'Finish day') + '</button>';
}
function sleepMin(h) { if (!/^\d{1,2}:\d{2}/.test(h.bed || '') || !/^\d{1,2}:\d{2}/.test(h.wake || '')) return 0; let s = toM(h.wake) - toM(h.bed); if (s <= 0) s += 1440; return s; }

/* =================== TASKS =================== */
function vTasks() {
  const k = nowInfo().k; const we = addD(k, 6 - ((parseD(k).getDay() + 6) % 7));
  let list = db.tasks.slice();
  if (ui.taskProj !== 'all') list = list.filter((t) => t.proj === ui.taskProj);
  if (ui.taskRange === 'today') list = list.filter((t) => t.top === k || (t.due && t.due <= k) || t.st === 'doing' || (t.st === 'done' && t.doneAt === k));
  if (ui.taskRange === 'week') list = list.filter((t) => (t.due && t.due <= we) || t.top >= k || t.st === 'doing' || (t.st === 'done' && t.doneAt >= addD(we, -6)));
  const groups = [['doing', 'In progress'], ['todo', 'To do'], ['done', 'Done']].map(([st, lbl]) => {
    const g = list.filter((t) => t.st === st).sort((a, b) => (a.due || '9') < (b.due || '9') ? -1 : 1);
    if (!g.length) return '';
    return '<section class="card tight"><div class="head"><h2>' + lbl + '</h2><span class="sm muted">' + g.length + '</span></div><div>' + g.map((t) => {
      const od = t.due && t.due < k && t.st !== 'done';
      return '<div class="list-row"><button class="check' + (t.st === 'done' ? ' on' : '') + '" data-a="taskToggle" data-id="' + t.id + '" aria-label="Mark ' + esc(t.t) + (t.st === 'done' ? ' not done' : ' done') + '">' + (t.st === 'done' ? ic('check', 14, 3, 'style="color:#fff"') : '') + '</button>' +
        '<button class="tap grow" data-a="taskEdit" data-id="' + t.id + '" style="min-height:52px;display:flex;flex-direction:column;justify-content:center"><span style="font-size:15px;' + (t.st === 'done' ? 'text-decoration:line-through;color:var(--muted)' : '') + '">' + esc(t.t) + '</span><span class="small" style="color:' + (od ? 'var(--bad)' : 'var(--muted)') + '">' + esc((PROJ.find((p) => p[0] === t.proj) || ['', 'Personal'])[1]) + (t.due ? ' · ' + (od ? 'overdue ' : 'due ') + nice(t.due) : '') + (t.est ? ' · ' + fmtDur(t.est) : '') + (t.top === k ? ' · Top 3' : '') + '</span></button>' +
        '<button class="del" data-a="taskStar" data-id="' + t.id + '" aria-label="' + (t.top === k ? 'Remove from' : 'Add to') + ' Top 3 today" style="color:' + (t.top === k ? 'var(--warn)' : 'var(--line2)') + '">' + ic('star', 20, 2, t.top === k ? 'fill="currentColor"' : '') + '</button></div>';
    }).join('') + '</div></section>';
  }).join('');
  return '<header class="row between"><div><h1>Tasks</h1><div class="sm muted">' + db.tasks.filter((t) => t.st !== 'done').length + ' open · ' + db.tasks.filter((t) => t.st === 'done').length + ' done</div></div></header>' +
    '<div class="seg" role="tablist">' + [['today', 'Today'], ['week', 'This week'], ['all', 'All']].map(([v, l]) => '<button class="' + (ui.taskRange === v ? 'on' : '') + '" data-a="taskRange" data-v="' + v + '" role="tab" aria-selected="' + (ui.taskRange === v) + '">' + l + '</button>').join('') + '</div>' +
    '<div class="scroll-x">' + [['all', 'All']].concat(PROJ).map(([v, l]) => '<button class="chip' + (ui.taskProj === v ? ' on' : '') + '" data-a="taskProj" data-v="' + v + '">' + l + '</button>').join('') + '</div>' +
    (groups || '<section class="card">' + empty(ui.taskRange === 'all' ? 'No tasks yet. Tap + to add your first one.' : 'Nothing here. Switch to <b>All</b> or tap + to add a task.') + '</section>') +
    '<button class="fab" data-a="taskNew" aria-label="Add task">' + ic('plus', 26, 2.4) + '</button>';
}
function taskSheet(t) {
  t = t || { t: '', proj: 'personal', due: '', est: '', st: 'todo' };
  return '<h2>' + (t.id ? 'Edit task' : 'New task') + '</h2>' +
    '<label class="f">Task<input id="tt" class="in" value="' + esc(t.t) + '" placeholder="What needs doing?"></label>' +
    '<div class="f" style="font-size:12px;color:var(--muted);font-weight:600">Project</div><div class="chips" id="tproj">' + PROJ.map(([v, l]) => '<button class="chip' + (t.proj === v ? ' on' : '') + '" data-a="pickChip" data-group="tproj" data-v="' + v + '">' + l + '</button>').join('') + '</div>' +
    '<div class="grid2"><label class="f">Due date<input id="tdue" type="date" class="in" value="' + esc(t.due) + '"></label><label class="f">Estimate (min)<input id="test" type="number" inputmode="numeric" class="in" value="' + esc(t.est) + '"></label></div>' +
    (t.id ? '<div class="chips" id="tst">' + [['todo', 'To do'], ['doing', 'In progress'], ['done', 'Done']].map(([v, l]) => '<button class="chip' + (t.st === v ? ' on' : '') + '" data-a="pickChip" data-group="tst" data-v="' + v + '">' + l + '</button>').join('') + '</div>' : '') +
    '<button class="btn full" data-a="taskSave" data-id="' + (t.id || '') + '">Save</button>' +
    (t.id ? '<button class="btn ghost full" data-a="taskDel" data-id="' + t.id + '" style="color:var(--bad)">Delete task</button>' : '') +
    '<button class="btn ghost full" data-a="sheetClose">Cancel</button>';
}

function myHabits(k) {
  const list = customHabits(); const arch = (db.habits.custom || []).filter((c) => c.archived);
  const last7 = [...Array(7)].map((_, i) => addD(k, i - 6));
  const rows = list.map((c) => {
    const t = customTest(c); const today = t(k); const st = streak(t), bs = best(t);
    const dots = last7.map((x) => { const r = t(x); return '<i title="' + nice(x) + '" style="display:block;width:10px;height:10px;border-radius:5px;' + (r === true ? 'background:var(--good)' : r === false ? (x === k ? 'border:2px solid var(--line2)' : 'background:var(--line2)') : 'border:1px dashed var(--line2)') + '"></i>'; }).join('');
    return '<div class="list-row" style="align-items:center;padding:6px 0">' +
      (today === null ? '<span class="box" style="opacity:.35" title="Not today"></span>' : '<button class="tap" data-a="habit" data-id="c:' + c.id + '" aria-pressed="' + today + '" aria-label="' + esc(c.name) + (today ? ' done' : ' not done') + ' today" style="width:auto;min-height:44px;display:flex;align-items:center"><span class="box' + (today ? ' on' : '') + '">' + (today ? ic('check', 14, 3, 'style="color:var(--btnInk)"') : '') + '</span></button>') +
      '<button class="tap grow" data-a="habitEdit" data-id="' + c.id + '" style="min-height:52px;display:flex;flex-direction:column;justify-content:center;gap:3px"><span class="b" style="font-size:15px">' + esc(c.name) + '</span><span class="small muted">' + (c.target ? esc(c.target) + ' · ' : '') + daysLabel(c.days) + (today === null ? ' · rest day' : '') + '</span><span class="row" style="gap:4px">' + dots + '</span></button>' +
      '<div style="text-align:right;flex:0 0 auto"><div class="row b" style="gap:3px;justify-content:flex-end;color:var(--warn-fg)">' + ic('flame', 14, 2.4) + st + '</div><div class="small muted">best ' + bs + '</div></div></div>';
  }).join('');
  const dayChips = DAYS_ORDER.map((x) => '<button class="chip on" data-a="toggleChip" data-v="' + x + '" style="padding:0;height:40px" aria-pressed="true">' + DOW[x].slice(0, 2) + '</button>').join('');
  return '<section class="card"><div class="head"><h2>My habits</h2><span class="sm muted">' + list.length + ' active</span></div>' +
    (rows ? '<div>' + rows + '</div><div class="small muted">Dots = last 7 days · tap a habit to edit</div>' : empty('Add any habit you want to build — it shows up on Today and gets its own streak.')) +
    '<details' + (list.length ? '' : ' open') + ' style="border-top:1px solid var(--line);padding-top:6px"><summary>' + ic('plus', 16, 2.4) + '&nbsp;Add a habit</summary><div class="col" style="margin-top:6px">' +
    '<label class="f">Habit<input id="nh" class="in" placeholder="e.g. Quran 1 page, Stretch, Journal"></label>' +
    '<label class="f">Goal (optional)<input id="nht" class="in" placeholder="e.g. 10 min, 2 pages, 20 reps"></label>' +
    '<div class="small muted b">Repeat on</div><div id="nhd" style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px">' + dayChips + '</div>' +
    '<div class="chips"><button class="chip" data-a="daysPreset" data-v="all">Every day</button><button class="chip" data-a="daysPreset" data-v="wk">Weekdays</button><button class="chip" data-a="daysPreset" data-v="we">Weekends</button></div>' +
    '<button class="btn full" data-a="habitAdd">Add habit</button></div></details>' +
    (arch.length ? '<details style="border-top:1px solid var(--line);padding-top:6px"><summary class="muted">Paused habits (' + arch.length + ')</summary>' + arch.map((c) => '<div class="list-row"><span class="grow sm">' + esc(c.name) + '</span><button class="link" data-a="habitResume" data-id="' + c.id + '">Resume</button></div>').join('') + '</details>' : '') + '</section>';
}
function habitSheet(c) {
  return '<h2>Edit habit</h2><label class="f">Habit<input id="eh" class="in" value="' + esc(c.name) + '"></label><label class="f">Goal (optional)<input id="eht" class="in" value="' + esc(c.target || '') + '"></label>' +
    '<div class="small muted b">Repeat on</div><div id="ehd" style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px">' + DAYS_ORDER.map((x) => '<button class="chip' + (c.days.includes(x) ? ' on' : '') + '" data-a="toggleChip" data-v="' + x + '" style="padding:0;height:40px" aria-pressed="' + c.days.includes(x) + '">' + DOW[x].slice(0, 2) + '</button>').join('') + '</div>' +
    '<button class="btn full" data-a="habitSave" data-id="' + c.id + '">Save</button>' +
    '<button class="btn ghost full" data-a="habitPause" data-id="' + c.id + '">Pause habit (keeps history)</button>' +
    '<button class="btn ghost full" data-a="habitDel" data-id="' + c.id + '" style="color:var(--bad)">Delete habit</button><button class="btn ghost full" data-a="sheetClose">Cancel</button>';
}
function finishSheet(bk) {
  return '<h2>Finished \u201C' + esc(bk.title) + '\u201D</h2><div class="sm muted">' + (bk.notes || []).length + ' takeaways saved. Two quick questions so the book sticks.</div>' +
    '<div class="small b muted">Rating</div><div class="chips" id="frate" style="display:grid;grid-template-columns:repeat(5,1fr)">' + [1, 2, 3, 4, 5].map((n) => '<button class="chip' + (n === 4 ? ' on' : '') + '" data-a="pickChip" data-group="frate" data-v="' + n + '" style="height:44px">' + n + '★</button>').join('') + '</div>' +
    '<label class="f">The biggest lesson, in one sentence<textarea id="fbig" class="in" rows="2"></textarea></label>' +
    '<label class="f">One action you\'ll take (added to Tasks)<input id="fact" class="in" placeholder="e.g. Two-minute rule for typing practice"></label>' +
    '<button class="btn full" data-a="bookFinishSave">Save &amp; finish book</button><button class="btn ghost full" data-a="sheetClose">Cancel</button>';
}
function bookSheet(f, i) {
  if (!f) return '<button class="btn full" data-a="sheetClose">Close</button>';
  return '<h2>' + esc(f.title) + '</h2><div class="sm muted">' + esc(f.author || '') + (f.start ? ' · ' + nice(f.start) + ' – ' : ' · finished ') + nice(f.d) + (f.rating ? ' · ' + f.rating + '★' : '') + '</div>' +
    (f.big ? '<div class="card tight" style="background:var(--doc-bg);border-color:transparent"><div class="small xb" style="color:var(--doc-fg)">BIGGEST LESSON</div><div class="sm" style="color:var(--doc-fg)">' + esc(f.big) + '</div></div>' : '') +
    (f.action ? '<div class="sm"><b>Action:</b> ' + esc(f.action) + '</div>' : '') +
    '<div class="b sm">Takeaways (' + (f.notes || []).length + ')</div>' + ((f.notes || []).map((n) => '<div class="sm" style="background:var(--soft);border-radius:12px;padding:10px 12px;line-height:1.4;white-space:pre-wrap">' + esc(n.t) + (n.p ? '<span class="small muted" style="display:block">p.' + n.p + '</span>' : '') + '</div>').join('') || empty('No notes saved for this book.')) +
    '<button class="btn full" data-a="bookIdea" data-i="' + i + '">Turn into a reel / post idea</button><button class="btn ghost full" data-a="sheetClose">Close</button>';
}

/* =================== MONEY =================== */
const SECT = [['food', 'Groceries', '#3E8E5E'], ['eat', 'Eating out', '#C26A1F'], ['transport', 'Transport', '#3F86C4'], ['bills', 'Bills & phone', '#8C8A84'], ['shop', 'Shopping', '#C2557F'], ['health', 'Health', '#0F766E'], ['study', 'Study', '#8B63C9'], ['fun', 'Fun', '#D4A017'], ['family', 'Gifts & family', '#B42318'], ['other', 'Other', '#5B5A56']];
const sect = (id) => SECT.find((s) => s[0] === id) || SECT[9];
function vMoney() {
  const base = new Date(); base.setDate(1); base.setMonth(base.getMonth() + ui.monthOff);
  const mk = base.getFullYear() + '-' + pad(base.getMonth() + 1);
  const prev = new Date(base); prev.setMonth(prev.getMonth() - 1); const pk = prev.getFullYear() + '-' + pad(prev.getMonth() + 1);
  const mt = db.tx.filter((x) => x.d.slice(0, 7) === mk); const pt = db.tx.filter((x) => x.d.slice(0, 7) === pk);
  const total = mt.reduce((a, x) => a + num(x.amt), 0); const ptot = pt.reduce((a, x) => a + num(x.amt), 0);
  const bud = db.settings.budget;
  const daysIn = new Date(base.getFullYear(), base.getMonth() + 1, 0).getDate();
  const isCur = ui.monthOff === 0; const dayNo = isCur ? new Date().getDate() : daysIn;
  const perDay = total / Math.max(1, dayNo);
  const bySec = SECT.map(([id, l, c]) => ({ id, l, c, v: mt.filter((x) => x.sec === id).reduce((a, x) => a + num(x.amt), 0), p: pt.filter((x) => x.sec === id).reduce((a, x) => a + num(x.amt), 0) })).filter((s) => s.v > 0).sort((a, b) => b.v - a.v);
  // donut
  const R = 54, C = 2 * Math.PI * R; let off = 0;
  const donut = '<svg width="140" height="140" viewBox="0 0 140 140" role="img" aria-label="Spending by sector"><circle cx="70" cy="70" r="' + R + '" fill="none" stroke="var(--soft)" stroke-width="20"/>' + bySec.map((s) => { const L = (s.v / (total || 1)) * C; const el = '<circle cx="70" cy="70" r="' + R + '" fill="none" stroke="' + s.c + '" stroke-width="20" stroke-dasharray="' + Math.max(0, L - 1.5).toFixed(1) + ' ' + C.toFixed(1) + '" stroke-dashoffset="' + (-off).toFixed(1) + '" transform="rotate(-90 70 70)"/>'; off += L; return el; }).join('') + '<text x="70" y="68" text-anchor="middle" font-size="16" font-weight="800" fill="currentColor">' + money(total) + '</text><text x="70" y="86" text-anchor="middle" font-size="11" fill="var(--muted)">' + MON[base.getMonth()] + '</text></svg>';
  const lvl = (v) => { const p = total ? (v / total) * 100 : 0; return p >= 25 ? ['HIGH', 'bad'] : p >= 10 ? ['MED', 'warn'] : ['LOW', 'good']; };
  const rank = bySec.map((s) => { const [L, c] = lvl(s.v); const tr = s.p ? Math.round(((s.v - s.p) / s.p) * 100) : null; return '<div class="list-row"><i style="width:10px;height:10px;border-radius:5px;background:' + s.c + '"></i><span class="grow"><span class="b" style="display:block;font-size:14px">' + s.l + '</span><span class="small muted">' + pct(s.v, total) + '% of spending' + (tr != null ? ' · ' + (tr > 0 ? '+' : '') + tr + '% vs ' + MON[prev.getMonth()] : '') + '</span></span><span class="b sm">' + money(s.v) + '</span><span class="pill" style="background:var(--' + c + '-bg);color:var(--' + c + '-fg)">' + L + '</span></div>'; }).join('');
  // 6 months
  const months = []; for (let i = 5; i >= 0; i--) { const d = new Date(base); d.setMonth(d.getMonth() - i); const k2 = d.getFullYear() + '-' + pad(d.getMonth() + 1); months.push([MON[d.getMonth()], db.tx.filter((x) => x.d.slice(0, 7) === k2).reduce((a, x) => a + num(x.amt), 0), k2 === mk]); }
  const mmax = Math.max(bud, ...months.map((x) => x[1]), 1);
  const mbars = '<div class="row" style="align-items:flex-end;gap:8px;height:110px;position:relative"><i style="position:absolute;left:0;right:0;bottom:' + (20 + (bud / mmax) * 80) + 'px;border-top:1.5px dashed var(--good)"></i>' + months.map(([l, v, on]) => '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px"><i style="display:block;width:100%;max-width:34px;border-radius:6px;height:' + Math.max(3, (v / mmax) * 80) + 'px;background:' + (on ? 'var(--ink)' : 'var(--line2)') + '"></i><span class="small ' + (on ? 'b' : 'muted') + '">' + l + '</span></div>').join('') + '</div>';
  // household
  const H = db.house; const hTot = H.items.reduce((a, x) => a + num(x.amt), 0); const share = H.people ? hTot / H.people : 0; const owed = hTot - share;
  const last = H.settled[0];
  const house = '<section class="card" style="border:2px solid var(--house)"><div class="head"><h2 style="color:var(--house)">Household · to split</h2><span class="small muted">separate from personal</span></div>' +
    '<div class="grid3"><div><div class="small muted">You paid</div><div class="xb" style="font-size:18px">' + money(hTot) + '</div></div><div><div class="small muted">Your share</div><div class="xb" style="font-size:18px">' + money(share) + '</div></div><div><div class="small muted">Others owe</div><div class="xb" style="font-size:18px;color:var(--house)">' + money(owed) + '</div></div></div>' +
    '<div class="row between"><span class="b sm">Split between</span><div class="step"><button data-a="hPeople" data-n="-1" aria-label="Fewer people">−</button><output>' + H.people + '</output><button class="p" data-a="hPeople" data-n="1" aria-label="More people">+</button></div></div>' +
    '<div class="grid2"><label class="f">Amount<input id="hamt" type="number" inputmode="decimal" class="in big" placeholder="0.00"></label><label class="f">What for<input id="hnote" class="in" placeholder="e.g. Coles, power bill"></label></div><button class="btn full" data-a="hAdd" style="background:var(--house);color:#fff">Add household expense</button>' +
    (H.items.length ? '<div>' + H.items.map((x) => '<div class="list-row"><span class="grow"><span style="display:block;font-size:14px" class="b">' + esc(x.note || 'Household') + '</span><span class="small muted">' + nice(x.d) + '</span></span><span class="b sm">' + money(num(x.amt)) + '</span><button class="del" data-a="hDel" data-id="' + x.id + '" aria-label="Remove">' + ic('trash', 16) + '</button></div>').join('') + '</div>' : empty('No household expenses since the last split.')) +
    (H.items.length ? '<button class="btn ghost full" data-a="hSettle">Settle up &amp; reset</button>' : '') +
    (last ? '<div class="small muted">Last settled ' + nice(last.d) + ' · ' + money(last.total) + ' split ' + last.n + ' ways · ' + money(last.owed) + ' paid back</div>' : '') + '</section>';
  const recent = mt.slice().sort((a, b) => (b.d + b.id > a.d + a.id ? 1 : -1)).slice(0, 25).map((x) => { const s = sect(x.sec); return '<div class="list-row"><i style="width:10px;height:10px;border-radius:5px;background:' + s[2] + '"></i><span class="grow"><span class="b" style="display:block;font-size:14px">' + esc(x.note || s[1]) + '</span><span class="small muted">' + s[1] + ' · ' + nice(x.d) + '</span></span><span class="b sm">' + money(num(x.amt)) + '</span><button class="del" data-a="txDel" data-id="' + x.id + '" aria-label="Delete">' + ic('trash', 16) + '</button></div>'; }).join('');
  return '<header class="row between"><div><h1>Money</h1><div class="sm muted">Personal spending</div></div><div class="row" style="gap:6px"><button class="iconbtn" data-a="mOff" data-n="-1" aria-label="Previous month">' + ic('back', 18) + '</button><button class="iconbtn" data-a="mOff" data-n="1" aria-label="Next month"' + (isCur ? ' disabled style="opacity:.4"' : '') + '>' + ic('chev', 18) + '</button></div></header>' +
    '<section class="hero" style="flex-direction:column;align-items:stretch;gap:10px"><div class="row between"><span class="sm" style="color:var(--heroMuted)">' + MONL[base.getMonth()] + ' ' + base.getFullYear() + '</span><span class="sm" style="color:var(--heroMuted)">budget ' + money(bud) + '</span></div><div style="font-size:34px;font-weight:800;letter-spacing:-1px">' + money(total) + '</div><div class="bar" style="background:rgba(255,255,255,.14)"><i style="width:' + Math.min(100, pct(total, bud)) + '%;background:' + (total > bud ? '#F4A9A0' : '#6FCF97') + '"></i></div><div class="row between sm" style="color:var(--heroMuted)"><span>' + (total > bud ? money(total - bud) + ' over' : money(bud - total) + ' left') + '</span><span>' + money(perDay) + ' / day</span></div></section>' +
    (isCur ? '<section class="card"><h2>Add spending</h2><div class="grid2"><label class="f">Amount<input id="amt" type="number" inputmode="decimal" class="in big" placeholder="0.00"></label><label class="f">Note<input id="note" class="in" placeholder="optional"></label></div><div class="chips" id="sec">' + SECT.map(([id, l, c], i) => '<button class="chip' + (i === 0 ? ' on' : '') + '" data-a="pickChip" data-group="sec" data-v="' + id + '"><i style="display:inline-block;width:8px;height:8px;border-radius:4px;background:' + c + ';margin-right:6px"></i>' + l + '</button>').join('') + '</div><label class="f">Date<input id="txd" type="date" class="in" value="' + dkey() + '"></label><button class="btn full" data-a="txAdd">Add</button></section>' : '') +
    house +
    '<section class="card"><div class="head"><h2>Where it goes</h2><span class="small muted">HIGH ≥25% · MED 10–25%</span></div>' + (bySec.length ? '<div style="display:flex;justify-content:center">' + donut + '</div><div>' + rank + '</div>' : empty('No spending logged this month.')) + '</section>' +
    '<section class="card"><div class="head"><h2>Last 6 months</h2><span class="small muted">' + (ptot ? (total >= ptot ? '+' : '') + pct(total - ptot, ptot) + '% vs ' + MON[prev.getMonth()] : '') + '</span></div>' + mbars + '</section>' +
    '<section class="card tight"><div class="head"><h2>Transactions</h2><span class="sm muted">' + mt.length + '</span></div>' + (recent || empty('Nothing yet.')) + '</section>';
}

/* =================== HEALTH =================== */
const EX = [['push', 'Push-ups', 'reps'], ['walk', 'Walk', 'steps'], ['run', 'Run', 'km'], ['gym', 'Gym', 'sets'], ['cycle', 'Cycling', 'km'], ['stretch', 'Stretching', 'min'], ['football', 'Football', 'min'], ['other', 'Other', 'min']];
function vHealth() {
  const k = nowInfo().k; const h = peekH(k); const S = db.settings;
  const kcal = h.food.reduce((a, f) => a + num(f.kcal), 0), prot = h.food.reduce((a, f) => a + num(f.p), 0);
  const slept = sleepMin(h);
  const ring = (v, max, c, label, val) => { const R = 22, C = 2 * Math.PI * R, p = Math.min(1, max ? v / max : 0); return '<div style="display:flex;flex-direction:column;align-items:center;gap:4px"><svg width="58" height="58" viewBox="0 0 58 58" aria-hidden="true"><circle cx="29" cy="29" r="' + R + '" fill="none" stroke="var(--soft)" stroke-width="6"/><circle cx="29" cy="29" r="' + R + '" fill="none" stroke="' + c + '" stroke-width="6" stroke-linecap="round" stroke-dasharray="' + (C * p).toFixed(1) + ' ' + C.toFixed(1) + '" transform="rotate(-90 29 29)"/></svg><span class="b sm">' + val + '</span><span class="small muted">' + label + '</span></div>'; };
  // weight
  const wl = Object.keys(db.health).sort().filter((x) => num(db.health[x].w) > 0).slice(-30).map((x) => [x, num(db.health[x].w)]);
  let wchart = empty('Log your weight to see the trend.');
  if (wl.length) {
    const vs = wl.map((x) => x[1]).concat(S.weightGoal ? [num(S.weightGoal)] : []); const lo = Math.min(...vs) - 1, hi = Math.max(...vs) + 1;
    const y = (v) => (8 + (1 - (v - lo) / (hi - lo)) * 64).toFixed(1);
    let pts = wl.map((x, i) => ((wl.length === 1 ? 177 : (i / (wl.length - 1)) * 354)).toFixed(1) + ',' + y(x[1])).join(' ');
    if (wl.length === 1) pts = '0,' + y(wl[0][1]) + ' 354,' + y(wl[0][1]);
    const ch = wl.length > 1 ? wl[wl.length - 1][1] - wl[0][1] : 0;
    wchart = '<svg width="100%" height="80" viewBox="0 0 354 80" preserveAspectRatio="none" role="img" aria-label="Weight trend">' + (S.weightGoal ? '<line x1="0" x2="354" y1="' + y(num(S.weightGoal)) + '" y2="' + y(num(S.weightGoal)) + '" stroke="var(--good)" stroke-dasharray="4 4" stroke-width="1.5"/>' : '') + '<polyline points="' + pts + '" fill="none" stroke="var(--doc)" stroke-width="2.5" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg><div class="row between small muted"><span>' + nice(wl[0][0]) + '</span><span>' + (ch ? (ch > 0 ? '+' : '') + ch.toFixed(1) + ' kg' : '') + (S.weightGoal ? ' · goal ' + S.weightGoal + ' kg' : '') + '</span></div>';
  }
  const glasses = Array.from({ length: S.waterGoal }, (_, i) => '<button data-a="water" data-n="' + (i + 1) + '" aria-label="' + (i + 1) + ' glasses" aria-pressed="' + (h.water > i) + '" style="height:48px;border-radius:12px;border:1px solid ' + (h.water > i ? 'var(--doc)' : 'var(--line2)') + ';background:' + (h.water > i ? 'var(--doc)' : 'var(--card)') + ';cursor:pointer"><svg width="18" height="22" viewBox="0 0 18 22" aria-hidden="true"><path d="M2 2h14l-2 18H4z" fill="' + (h.water > i ? '#fff' : 'none') + '" stroke="' + (h.water > i ? '#fff' : 'var(--muted)') + '" stroke-width="1.6"/></svg></button>').join('');
  // exercise week
  const wk = weekKeys(k);
  const exMin = (x) => peekH(x).ex.length;
  const exHtml = h.ex.map((e, i) => { const t = EX.find((x) => x[0] === e.type) || EX[7]; return '<div class="list-row"><span class="grow"><span class="b" style="display:block;font-size:14px">' + esc(e.name || t[1]) + '</span><span class="small muted">' + esc(e.amt) + ' ' + t[2] + (e.min && t[2] !== 'min' ? ' · ' + e.min + ' min' : '') + '</span></span><button class="del" data-a="exDel" data-i="' + i + '" aria-label="Remove">' + ic('trash', 16) + '</button></div>'; }).join('');
  // screen 7 days
  const scr = [...Array(7)].map((_, i) => addD(k, i - 6)).map((x) => [x, peekH(x).screen === '' ? null : num(peekH(x).screen)]);
  const smax = Math.max(S.screenLimit * 1.4, ...scr.map((x) => x[1] || 0));
  const sbars = '<div class="row" style="align-items:flex-end;gap:6px;height:100px;position:relative"><i style="position:absolute;left:0;right:0;bottom:' + (18 + (S.screenLimit / smax) * 76) + 'px;border-top:1.5px dashed var(--bad)"></i>' + scr.map(([x, v]) => '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px"><i style="display:block;width:100%;max-width:30px;border-radius:6px;height:' + (v == null ? 3 : Math.max(3, (v / smax) * 76)) + 'px;background:' + (v == null ? 'var(--soft)' : v > S.screenLimit ? 'var(--bad)' : 'var(--good)') + '"></i><span class="small ' + (x === k ? 'b' : 'muted') + '">' + DOW[parseD(x).getDay()][0] + '</span></div>').join('') + '</div>';
  const scv = h.screen === '' ? '' : num(h.screen);
  return '<header><h1>Health</h1><div class="sm muted">' + nice(k) + '</div></header>' +
    '<section class="card"><div class="row between">' + ring(h.water, S.waterGoal, 'var(--doc)', 'water', h.water + '/' + S.waterGoal) + ring(kcal, S.kcalGoal, 'var(--meal)', 'kcal', kcal) + ring(slept, 480, 'var(--study)', 'sleep', slept ? fmtDur(slept) : '—') + ring(h.ex.length, 1, 'var(--good)', 'exercise', h.ex.length) + '</div></section>' +
    '<section class="card"><div class="head"><h2>Weight</h2><span class="sm muted">kg</span></div><div class="row"><label class="sr" for="w">Today\'s weight in kg</label><input id="w" type="number" inputmode="decimal" step="0.1" class="in big grow" placeholder="e.g. 72.4" value="' + esc(h.w) + '" data-c="hField" data-f="w"></div>' + wchart + '</section>' +
    '<section class="card"><div class="head"><h2>Food</h2><span class="sm muted">' + kcal + ' / ' + S.kcalGoal + ' kcal · ' + prot + ' / ' + S.proteinGoal + ' g protein</span></div><div class="bar"><i style="width:' + Math.min(100, pct(kcal, S.kcalGoal)) + '%;background:var(--meal)"></i></div>' +
    (h.food.map((f, i) => '<div class="list-row"><span class="grow b" style="font-size:14px">' + esc(f.name) + '</span><span class="small muted">' + num(f.kcal) + ' kcal · ' + num(f.p) + ' g</span><button class="del" data-a="foodDel" data-i="' + i + '" aria-label="Remove">' + ic('trash', 16) + '</button></div>').join('') || '') +
    '<label class="f">What you ate<input id="fn" class="in" placeholder="e.g. Chicken rice"></label><div class="grid2"><label class="f">kcal<input id="fk" type="number" inputmode="numeric" class="in"></label><label class="f">Protein (g)<input id="fp" type="number" inputmode="numeric" class="in"></label></div><button class="btn ghost full" data-a="foodAdd">Add food</button></section>' +
    '<section class="card"><div class="head"><h2>Water</h2><span class="sm muted">' + h.water * 250 + ' ml of ' + S.waterGoal * 250 + ' ml</span></div><div style="display:grid;grid-template-columns:repeat(' + Math.min(6, S.waterGoal) + ',1fr);gap:6px">' + glasses + '</div></section>' +
    '<section class="card"><div class="head"><h2>Exercise</h2><span class="sm muted">' + wk.filter((x) => exMin(x) > 0).length + ' active days this week</span></div><div class="chips" id="ext">' + EX.map(([id, l], i) => '<button class="chip' + (i === 0 ? ' on' : '') + '" data-a="pickChip" data-group="ext" data-v="' + id + '">' + l + '</button>').join('') + '</div>' +
    '<div class="grid2"><label class="f">Amount<input id="exa" type="number" inputmode="decimal" class="in big" placeholder="reps / steps / km"></label><label class="f">Minutes<input id="exm" type="number" inputmode="numeric" class="in big"></label></div><label class="f">Name (for Other)<input id="exn" class="in" placeholder="optional"></label><button class="btn full" data-a="exAdd">Log exercise</button>' + (exHtml ? '<div>' + exHtml + '</div>' : '') + '</section>' +
    '<section class="card"><div class="head"><h2>Sleep &amp; energy</h2><span class="sm muted">' + (slept ? 'Slept ' + fmtDur(slept) + (slept < 360 ? ' · short' : ' · good') : '') + '</span></div><div class="grid2"><label class="f">Went to bed<input type="time" class="in big" value="' + esc(h.bed) + '" data-c="hField" data-f="bed"></label><label class="f">Woke up<input type="time" class="in big" value="' + esc(h.wake) + '" data-c="hField" data-f="wake"></label></div>' +
    '<div class="small muted b">Energy today</div><div style="display:grid;grid-template-columns:repeat(5,1fr);gap:6px">' + [1, 2, 3, 4, 5].map((n) => '<button class="chip' + (h.energy === n ? ' on' : '') + '" data-a="energy" data-n="' + n + '" style="height:44px" aria-pressed="' + (h.energy === n) + '">' + n + '</button>').join('') + '</div></section>' +
    '<section class="card"><div class="head"><h2>Screen time</h2><span class="sm muted">limit ' + fmtDur(S.screenLimit) + '</span></div><div class="chips">' + [['< 2h', 90], ['2–3h', 150], ['3–4h', 210], ['4h +', 270]].map(([l, v]) => '<button class="chip' + (scv !== '' && Math.abs(scv - v) < 30 ? ' on' : '') + '" data-a="screenQuick" data-n="' + v + '">' + l + '</button>').join('') + '</div><div class="row"><label for="st" class="b sm grow">Exact minutes (from phone settings)</label><input id="st" type="number" inputmode="numeric" class="in" style="width:100px;text-align:center;font-weight:800" value="' + esc(h.screen) + '" data-c="hField" data-f="screen"></div>' +
    (scv !== '' ? '<div class="sm b" style="color:' + (scv > S.screenLimit ? 'var(--bad)' : 'var(--good)') + '">' + (scv > S.screenLimit ? 'Over limit by ' + fmtDur(scv - S.screenLimit) : 'Under limit · ' + fmtDur(scv) + ' of ' + fmtDur(S.screenLimit)) + '</div>' : '') + sbars + '</section>';
}

/* =================== HABITS =================== */
function vHabits() {
  const k = nowInfo().k; const H = db.habits; const S = db.settings; const bk = H.book;
  const tile = (n, v, b, c) => '<div class="kpi"><div class="row small b" style="gap:5px;color:var(--' + c + '-fg)">' + ic('flame', 13, 2.4) + n + '</div><b>' + v + '<span class="small muted" style="font-weight:600"> days</span></b><span class="small muted">best ' + b + '</span></div>';
  const risk = HABIT_TESTS().filter(([n]) => n !== 'All 5 prayers').filter(([, t]) => atRisk(t));
  const todayPages = (H.pages || {})[k] || 0;
  const reading = bk ? '<div class="row" style="gap:14px"><div style="width:58px;height:84px;flex:0 0 58px;border-radius:8px;background:var(--doc);color:#fff;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800">' + esc((bk.title || '?').trim().charAt(0).toUpperCase()) + '</div><div class="grow"><div class="small muted b">NOW READING</div><div class="xb" style="font-size:17px;line-height:1.25">' + esc(bk.title) + '</div><div class="sm muted">' + esc(bk.author) + '</div><div class="bar" style="margin-top:8px"><i style="width:' + pct(bk.page, bk.total) + '%;background:var(--doc)"></i></div><div class="small muted" style="margin-top:4px">page ' + bk.page + ' of ' + bk.total + ' · ' + pct(bk.page, bk.total) + '%' + (bk.total > bk.page ? ' · ~' + Math.ceil((bk.total - bk.page) / Math.max(1, S.pagesGoal)) + ' days left' : '') + '</div></div></div>' +
    '<div class="row between" style="border-top:1px solid var(--line);padding-top:12px"><div><div class="b sm">Pages read today</div><div class="small b" style="color:' + (todayPages >= S.pagesGoal ? 'var(--good)' : 'var(--muted)') + '">' + (todayPages >= S.pagesGoal ? 'Goal done' : (S.pagesGoal - todayPages) + ' more to hit ' + S.pagesGoal) + '</div></div><div class="step"><button data-a="pages" data-n="-1" aria-label="One page less">−</button><output>' + todayPages + '</output><button class="p" data-a="pages" data-n="1" aria-label="One page more">+</button></div></div>'
    : empty('Add the book you\'re reading below.');
  const notes = bk ? (bk.notes || []) : [];
  const learn = bk ? '<div class="col" style="border-top:1px solid var(--line);padding-top:10px;gap:8px"><div class="row between"><span class="b sm">Takeaways &amp; notes</span><span class="small muted">' + notes.length + '</span></div>' +
    notes.map((n, i) => '<div class="row" style="align-items:flex-start;background:var(--soft);border-radius:12px;padding:8px 4px 8px 12px"><span class="grow sm" style="line-height:1.4;padding-top:4px;white-space:pre-wrap">' + esc(n.t) + '<span class="small muted" style="display:block">' + (n.p ? 'p.' + n.p + ' · ' : '') + nice(n.d) + '</span></span><button class="link" data-a="noteIdea" data-i="' + i + '" style="white-space:nowrap">To idea</button><button class="del" data-a="bookNoteDel" data-i="' + i + '" aria-label="Delete note">' + ic('trash', 16) + '</button></div>').join('') +
    '<label class="sr" for="bkn">New takeaway</label><textarea id="bkn" class="in" rows="2" placeholder="A lesson or idea from today\'s pages, in your own words…"></textarea><div class="row"><label class="sr" for="bknp">Page</label><input id="bknp" type="number" inputmode="numeric" class="in" placeholder="page" style="width:100px" value="' + (bk.page || '') + '"><button class="btn ghost sm grow" data-a="bookNote">Save takeaway</button></div></div>' : '';
  const bookForm = '<details' + (bk ? '' : ' open') + ' style="border-top:1px solid var(--line);padding-top:6px"><summary>' + (bk ? 'Change book' : 'Add a book') + '</summary><div class="col" style="margin-top:6px"><label class="f">Book name<input id="bt" class="in" value="' + esc(bk ? bk.title : '') + '"></label><div class="grid2"><label class="f">Author<input id="ba" class="in" value="' + esc(bk ? bk.author : '') + '"></label><label class="f">Total pages<input id="bn" type="number" inputmode="numeric" class="in" value="' + esc(bk ? bk.total : '') + '"></label></div>' + (bk ? '<label class="f">Current page<input id="bp" type="number" inputmode="numeric" class="in" value="' + bk.page + '"></label>' : '') + '<button class="btn full" data-a="bookSave">' + (bk ? 'Save changes' : 'Start reading') + '</button>' + (bk ? '<button class="btn ghost full" data-a="bookFinish">Mark as finished</button>' : '') + '</div></details>';
  const yr = String(new Date().getFullYear());
  const fin = H.finished.filter((f) => (f.d || '').slice(0, 4) === yr);
  // typing chart
  const th = H.typing.slice(-14); const lo = Math.min(20, ...th.map((x) => num(x.wpm))), hi = Math.max(S.wpmGoal + 10, ...th.map((x) => num(x.wpm)));
  const yy = (v) => (76 - ((v - lo) / (hi - lo)) * 70).toFixed(1);
  const tline = th.length ? '<svg width="100%" height="80" viewBox="0 0 354 80" preserveAspectRatio="none" role="img" aria-label="Typing speed trend"><line x1="0" x2="354" y1="' + yy(S.wpmGoal) + '" y2="' + yy(S.wpmGoal) + '" stroke="var(--good)" stroke-width="1.5" stroke-dasharray="4 4" vector-effect="non-scaling-stroke"/><polyline points="' + (th.length === 1 ? '0,' + yy(num(th[0].wpm)) + ' 354,' + yy(num(th[0].wpm)) : th.map((x, i) => ((i / (th.length - 1)) * 354).toFixed(1) + ',' + yy(num(x.wpm))).join(' ')) + '" fill="none" stroke="var(--study)" stroke-width="2.5" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>' : empty('Save a session to see your speed trend.');
  const tToday = H.typing.find((x) => x.d === k) || {};
  const spWeek = H.speaking.filter((x) => x.d >= addD(k, -6)).reduce((a, x) => a + num(x.min), 0);
  const MODES = ['Camera', 'Mirror', 'Voice note', 'Live audience'];
  return backHead('Habits', 'Reading · typing · speaking · ideas', 'today') +
    (risk.length ? '<section class="card tight" style="background:var(--warn-bg);border-color:transparent"><div class="small xb" style="color:var(--warn-fg)">NEVER MISS TWICE</div><div class="sm" style="color:var(--warn-fg)">Missed <b>' + risk.map((x) => x[0]).join(', ') + '</b> yesterday — even a tiny session today keeps the chain.</div></section>' : '') +
    '<section class="grid3">' + tile('Reading', streak(didRead), best(didRead), 'doc') + tile('Typing', streak(didType), best(didType), 'study') + tile('Speaking', streak(didTalk), best(didTalk), 'tent') + '</section>' +
    myHabits(k) +
    '<section class="card"><div class="head"><h2>Reading</h2><span class="sm muted">goal ' + S.pagesGoal + ' pages / day</span></div>' + reading + learn + bookForm +
    (fin.length ? '<div><div class="small muted b" style="margin-bottom:6px">Finished · ' + fin.length + ' this year · tap to see your notes</div><div class="chips">' + fin.map((f) => '<button class="chip" data-a="bookView" data-i="' + H.finished.indexOf(f) + '" style="background:var(--doc-bg);color:var(--doc-fg);border-color:transparent">' + esc(f.title) + (f.rating ? ' · ' + f.rating + '★' : '') + '</button>').join('') + '</div></div>' : '') + '</section>' +
    '<section class="card"><div class="head"><h2>Typing</h2><span class="sm muted">target ' + S.wpmGoal + ' WPM</span></div><div class="grid3"><label class="f">Speed (WPM)<input id="tw" type="number" inputmode="numeric" class="in big" value="' + esc(tToday.wpm || '') + '"></label><label class="f">Accuracy %<input id="ta" type="number" inputmode="numeric" class="in big" value="' + esc(tToday.acc || '') + '"></label><label class="f">Minutes<input id="tm" type="number" inputmode="numeric" class="in big" value="' + esc(tToday.min || '') + '"></label></div><button class="btn full" data-a="typeSave">' + (tToday.wpm ? 'Update today\'s session' : 'Save today\'s session') + '</button>' +
    '<div><div class="row between small muted b" style="margin-bottom:6px"><span>Speed · last ' + th.length + ' sessions</span><span>' + (H.typing.length ? 'best ' + Math.max(...H.typing.map((x) => num(x.wpm))) + ' WPM' : '') + '</span></div>' + tline + '</div></section>' +
    '<section class="card"><div class="head"><h2>Public speaking</h2><span class="sm muted">' + spWeek + ' min this week</span></div><div style="display:grid;grid-template-columns:1fr 88px;gap:8px"><label class="f">Topic<input id="spt" class="in" placeholder="e.g. Why habits beat motivation"></label><label class="f">Minutes<input id="spm" type="number" inputmode="numeric" class="in big" value="5"></label></div>' +
    '<div class="chips" id="spmode">' + MODES.map((m, i) => '<button class="chip' + (i === 0 ? ' on' : '') + '" data-a="pickChip" data-group="spmode" data-v="' + m + '">' + m + '</button>').join('') + '</div>' +
    '<div><div class="small muted b" style="margin-bottom:6px">How did it go?</div><div class="chips" id="sprt" style="display:grid;grid-template-columns:repeat(5,1fr)">' + [1, 2, 3, 4, 5].map((n) => '<button class="chip' + (n === 3 ? ' on' : '') + '" data-a="pickChip" data-group="sprt" data-v="' + n + '" style="height:44px">' + n + '</button>').join('') + '</div></div>' +
    '<label class="f">One thing to improve next time<input id="spn" class="in" placeholder="e.g. fewer \'umm\', slower start"></label><button class="btn full" data-a="spSave">Save session</button>' +
    H.speaking.slice(0, 6).map((l, i) => '<div class="list-row"><span class="grow"><span class="b" style="display:block;font-size:14px">' + esc(l.topic) + '</span><span class="small muted">' + esc(l.mode) + ' · ' + num(l.min) + ' min · ' + nice(l.d) + (l.note ? ' · fix: ' + esc(l.note) : '') + '</span></span><span class="pill" style="background:var(--tent-bg);color:var(--tent-fg)">' + l.rate + ' / 5</span><button class="del" data-a="spDel" data-i="' + i + '" aria-label="Delete">' + ic('trash', 16) + '</button></div>').join('') + '</section>' +
    '<section class="idea"><div class="head"><h2>Idea parking</h2><span class="small b" style="color:var(--idea-fg)">' + H.notes.length + ' saved</span></div><div class="small" style="color:var(--idea-fg)">Anything that pops up while you read, type or practise. Sort it later.</div><label class="sr" for="park">Write an idea</label><textarea id="park" class="in" rows="4" placeholder="Write it down before you forget…"></textarea><button class="btn full" data-a="park" style="background:var(--idea-fg);color:var(--card)">Park it</button>' +
    H.notes.map((n, i) => '<div class="row" style="background:var(--card);border:1px solid var(--line);border-radius:12px;padding:8px 6px 8px 12px;align-items:flex-start"><span class="grow sm" style="line-height:1.4;padding-top:4px;white-space:pre-wrap">' + esc(n.t) + '<span class="small muted" style="display:block">' + nice(n.d) + '</span></span><button class="link" data-a="noteToInbox" data-i="' + i + '" style="color:var(--idea-fg)">To Inbox</button><button class="del" data-a="noteDel" data-i="' + i + '" aria-label="Delete">' + ic('trash', 16) + '</button></div>').join('') + '</section>';
}

/* =================== REPORTS =================== */
function periodRange(p) { const s = addD(START, p * 10); return [s, addD(s, 9)]; }
function vReports() {
  const nk = nowInfo().k; const curP = Math.max(0, Math.floor(diffD(START, nk) / 10));
  const p = ui.period == null ? curP : ui.period; const [s, e] = periodRange(p);
  const keys = []; for (let x = s; x <= e; x = addD(x, 1)) keys.push(x);
  const past = keys.filter((x) => x <= nk);
  const n = past.length || 1;
  let bd = 0, bt = 0, pOn = 0, pLate = 0, hd = 0, ht = 0; const hours = {};
  past.forEach((x) => { const sc = dayScore(x); bd += sc.bd; bt += sc.bt; hd += sc.hs.done; ht += sc.hs.total; const dd = peekDay(x); PRAYERS(x).forEach(([id]) => { if (dd.p[id] === 'on') pOn++; if (dd.p[id] === 'late') pLate++; }); Object.entries(dd.time || {}).forEach(([c, m]) => (hours[c] = (hours[c] || 0) + m)); });
  const totMin = Object.values(hours).reduce((a, b) => a + b, 0);
  const tasksDone = db.tasks.filter((t) => t.st === 'done' && t.doneAt >= s && t.doneAt <= e).length;
  const hs = past.map(peekH); const sl = hs.map(sleepMin).filter(Boolean); const en = hs.map((h) => h.energy).filter(Boolean); const scr = hs.filter((h) => h.screen !== '').map((h) => num(h.screen));
  const spent = db.tx.filter((t) => t.d >= s && t.d <= e).reduce((a, t) => a + num(t.amt), 0);
  const typ = db.habits.typing.filter((t) => t.d >= s && t.d <= e); const spk = db.habits.speaking.filter((t) => t.d >= s && t.d <= e);
  const pages = Object.entries(db.habits.pages || {}).filter(([d]) => d >= s && d <= e).reduce((a, [, v]) => a + v, 0);
  const kpi = (l, v, sub) => '<div class="kpi"><span class="small muted b">' + l + '</span><b>' + v + '</b><span class="small muted">' + sub + '</span></div>';
  const hrows = Object.entries(hours).sort((a, b) => b[1] - a[1]).map(([c, m]) => '<div class="col" style="gap:4px"><div class="row between sm"><span class="b">' + esc(CAT[c] || c) + '</span><span class="muted">' + fmtDur(m) + '</span></div><div class="bar"><i style="width:' + pct(m, totMin) + '%;background:var(--' + (c in CAT ? (c === 'personal' ? 'meal' : c) : 'work') + ')"></i></div></div>').join('');
  const grid = '<div style="display:grid;grid-template-columns:52px repeat(' + keys.length + ',1fr);gap:3px;align-items:center">' + '<span></span>' + keys.map((x) => '<span class="small muted" style="text-align:center;font-size:10px">' + parseD(x).getDate() + '</span>').join('') +
    ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'].map((id, r) => '<span class="small b">' + ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'][r] + '</span>' + keys.map((x) => { const v = peekDay(x).p[id]; return '<i style="display:block;height:18px;border-radius:4px;background:' + (v === 'on' ? 'var(--pray)' : v === 'late' ? 'var(--warn)' : x <= nk ? 'var(--soft)' : 'transparent') + ';border:' + (x > nk ? '1px dashed var(--line2)' : '0') + '"></i>'; }).join('')).join('') + '</div>';
  const wins = past.map((x) => [x, peekDay(x).done]).filter((x) => x[1]); const blk = past.map((x) => [x, peekDay(x).blockers]).filter((x) => x[1]);
  const per = db.periods[p] || {};
  return backHead('Reports', '10-day progress · ' + nice(s) + ' – ' + nice(e)) +
    '<div class="row between"><button class="iconbtn" data-a="period" data-n="' + (p - 1) + '" aria-label="Previous period"' + (p <= 0 ? ' disabled style="opacity:.4"' : '') + '>' + ic('back', 18) + '</button><div class="b">Report ' + (p + 1) + (p === curP ? ' · current' : '') + '</div><button class="iconbtn" data-a="period" data-n="' + (p + 1) + '" aria-label="Next period"' + (p >= curP ? ' disabled style="opacity:.4"' : '') + '>' + ic('chev', 18) + '</button></div>' +
    (nk < s ? '<section class="card">' + empty('This period hasn\'t started yet.') + '</section>' : '') +
    '<section class="grid2">' + kpi('Blocks done', pct(bd, bt) + '%', bd + ' of ' + bt + ' blocks') + kpi('Prayers on time', pct(pOn, n * 5) + '%', pLate + ' late · ' + (n * 5 - pOn - pLate) + ' missed') + kpi('Habits', pct(hd, ht) + '%', hd + ' of ' + ht) + kpi('Time tracked', fmtDur(totMin), tasksDone + ' tasks done') + '</section>' +
    '<section class="card"><h2>Hours by project</h2>' + (hrows || empty('Use the play button on Home to track time.')) + '</section>' +
    '<section class="card"><div class="head"><h2>Prayers</h2><span class="small muted">green on time · orange late</span></div>' + grid + '</section>' +
    '<section class="card"><h2>Habits &amp; skills</h2><div class="grid3"><div><div class="small muted">Pages read</div><div class="xb" style="font-size:18px">' + pages + '</div></div><div><div class="small muted">Typing</div><div class="xb" style="font-size:18px">' + (typ.length ? Math.max(...typ.map((t) => num(t.wpm))) + ' WPM' : '—') + '</div><div class="small muted">' + typ.length + ' sessions</div></div><div><div class="small muted">Speaking</div><div class="xb" style="font-size:18px">' + spk.reduce((a, t) => a + num(t.min), 0) + ' min</div><div class="small muted">' + spk.length + ' sessions</div></div></div></section>' +
    '<section class="card"><h2>Body &amp; screen</h2><div class="grid3"><div><div class="small muted">Avg sleep</div><div class="xb" style="font-size:18px">' + (sl.length ? fmtDur(sl.reduce((a, b) => a + b, 0) / sl.length) : '—') + '</div><div class="small muted">' + sl.filter((x) => x < 360).length + ' short nights</div></div><div><div class="small muted">Avg energy</div><div class="xb" style="font-size:18px">' + (en.length ? (en.reduce((a, b) => a + b, 0) / en.length).toFixed(1) + '/5' : '—') + '</div></div><div><div class="small muted">Avg screen</div><div class="xb" style="font-size:18px">' + (scr.length ? fmtDur(scr.reduce((a, b) => a + b, 0) / scr.length) : '—') + '</div><div class="small muted">' + scr.filter((x) => x > db.settings.screenLimit).length + ' days over</div></div></div><div class="sm muted">Spent ' + money(spent) + ' this period</div></section>' +
    '<section class="card tight" style="background:var(--good-bg);border-color:transparent"><div class="small xb" style="color:var(--good-fg)">WINS</div>' + (wins.map(([x, t]) => '<div class="sm" style="color:var(--good-fg)"><b>' + DOW[parseD(x).getDay()] + ' ' + parseD(x).getDate() + ':</b> ' + esc(t) + '</div>').join('') || '<div class="sm" style="color:var(--good-fg)">Write in "Done today" at the end of each day.</div>') + '</section>' +
    '<section class="card tight" style="background:var(--bad-bg);border-color:transparent"><div class="small xb" style="color:var(--bad-fg)">BLOCKERS</div>' + (blk.map(([x, t]) => '<div class="sm" style="color:var(--bad-fg)"><b>' + DOW[parseD(x).getDay()] + ' ' + parseD(x).getDate() + ':</b> ' + esc(t) + '</div>').join('') || '<div class="sm" style="color:var(--bad-fg)">None logged.</div>') + '</section>' +
    '<section class="card tight" style="background:var(--doc-bg);border-color:transparent"><div class="small xb" style="color:var(--doc-fg)">NEXT 10 DAYS · FOCUS</div><textarea class="in" rows="3" data-c="periodNext" data-p="' + p + '" placeholder="1. … 2. … 3. …">' + esc(per.next || '') + '</textarea></section>';
}

/* =================== INBOX =================== */
function vInbox() {
  const rem = db.reminders.slice().sort((a, b) => (a.done - b.done) || ((a.when || '9') < (b.when || '9') ? -1 : 1));
  const tab = ui.inboxTab;
  const remHtml = '<section class="card"><label class="f">Remind me to…<input id="rt" class="in" placeholder="e.g. Pay phone bill"></label><label class="f">When (optional)<input id="rw" type="datetime-local" class="in"></label><button class="btn full" data-a="remAdd">Add reminder</button></section>' +
    '<section class="card tight">' + (rem.map((r) => { const due = !r.done && r.when && new Date(r.when) <= new Date(); return '<div class="list-row"><button class="check' + (r.done ? ' on' : '') + '" data-a="remToggle" data-id="' + r.id + '" aria-label="Mark done">' + (r.done ? ic('check', 14, 3, 'style="color:#fff"') : '') + '</button><span class="grow"><span style="display:block;font-size:15px;' + (r.done ? 'text-decoration:line-through;color:var(--muted)' : '') + '">' + esc(r.t) + '</span>' + (r.when ? '<span class="small" style="color:' + (due ? 'var(--bad)' : 'var(--muted)') + '">' + (due ? 'Due · ' : '') + remWhen(r.when) + '</span>' : '') + '</span><button class="del" data-a="remDel" data-id="' + r.id + '" aria-label="Delete">' + ic('trash', 16) + '</button></div>'; }).join('') || empty('No reminders.')) + '</section>';
  const ideaHtml = '<section class="card"><label class="f">Capture an idea<textarea id="it" class="in" rows="3" placeholder="Reel idea, paper topic, app feature…"></textarea></label><button class="btn full" data-a="ideaAdd2">Save idea</button></section>' +
    '<section class="card tight">' + (db.ideas.map((x) => '<div class="list-row" style="align-items:flex-start;padding:10px 0"><span class="grow"><span style="display:block;font-size:15px;white-space:pre-wrap">' + esc(x.t) + '</span><span class="small muted">' + nice(x.d) + (x.src ? ' · from ' + esc(x.src) : '') + '</span></span><button class="link" data-a="ideaToTask" data-id="' + x.id + '">To task</button><button class="del" data-a="ideaDel" data-id="' + x.id + '" aria-label="Delete">' + ic('trash', 16) + '</button></div>').join('') || empty('No ideas yet.')) + '</section>';
  return backHead('Inbox', db.reminders.filter((r) => !r.done).length + ' reminders · ' + db.ideas.length + ' ideas') +
    '<div class="seg">' + [['rem', 'Reminders'], ['idea', 'Ideas']].map(([v, l]) => '<button class="' + (tab === v ? 'on' : '') + '" data-a="inboxTab" data-tab="' + v + '">' + l + '</button>').join('') + '</div>' + (tab === 'rem' ? remHtml : ideaHtml);
}

/* =================== SETTINGS =================== */
function vSettings() {
  const S = db.settings; const size = new Blob([localStorage.getItem(KEY) || '']).size;
  const fld = (id, l, v, type = 'number') => '<label class="f">' + l + '<input class="in" type="' + type + '" inputmode="' + (type === 'number' ? 'decimal' : 'text') + '" value="' + esc(v) + '" data-c="setting" data-f="' + id + '"></label>';
  return backHead('Settings', 'Daily Life v' + VERSION) +
    '<section class="card"><h2>Theme</h2><div class="seg">' + [['light', 'Light'], ['dark', 'Dark'], ['auto', 'Auto']].map(([v, l]) => '<button class="' + (S.theme === v ? 'on' : '') + '" data-a="theme" data-v="' + v + '">' + l + '</button>').join('') + '</div></section>' +
    '<section class="card"><h2>You</h2>' + fld('name', 'Name', S.name, 'text') + '</section>' +
    '<section class="card"><h2>Goals</h2><div class="grid2">' + fld('pagesGoal', 'Pages per day', S.pagesGoal) + fld('wpmGoal', 'Typing target (WPM)', S.wpmGoal) + fld('screenLimit', 'Screen limit (min)', S.screenLimit) + fld('waterGoal', 'Water (glasses)', S.waterGoal) + fld('kcalGoal', 'Calories (kcal)', S.kcalGoal) + fld('proteinGoal', 'Protein (g)', S.proteinGoal) + fld('weightGoal', 'Goal weight (kg)', S.weightGoal) + '</div></section>' +
    '<section class="card"><h2>Money</h2><div class="grid2">' + fld('budget', 'Monthly budget', S.budget) + fld('currency', 'Currency symbol', S.currency, 'text') + '</div></section>' +
    '<section class="card"><div class="row between"><div class="grow"><h2>Reminder alerts</h2><div class="small muted">Pops up a notification when a reminder is due (while the app is open or recently used).</div></div><button class="switch' + (S.alerts ? ' on' : '') + '" data-a="alerts" role="switch" aria-checked="' + !!S.alerts + '" aria-label="Reminder alerts"></button></div></section>' +
    syncCard() +
    '<section class="card"><div class="row between"><div class="grow"><h2>Year countdown popup</h2><div class="small muted">Shows how many days are left in the year, once a day when you open the app.</div></div><button class="switch' + (S.countdown ? ' on' : '') + '" data-a="countdownToggle" role="switch" aria-checked="' + !!S.countdown + '" aria-label="Year countdown popup"></button></div></section>' +
    '<section class="card"><h2>Your data</h2><div class="sm muted">Everything is saved on this phone and works offline (' + (size / 1024).toFixed(1) + ' KB). ' + (db.meta.lastBackup ? 'Last backup ' + nice(dkey(new Date(db.meta.lastBackup))) + '.' : 'No backup yet — export one now and then.') + '</div>' +
    '<div class="sync' + (navigator.onLine ? '' : ' off') + '" style="align-self:flex-start"><i></i>' + (navigator.onLine ? 'Online' : 'Offline') + '</div>' +
    '<button class="btn full" data-a="export">Export backup (.json)</button><label class="btn ghost full" style="cursor:pointer">Import backup<input type="file" accept="application/json,.json" data-c="import" class="sr"></label>' +
    '<button class="btn ghost full" data-a="reset" style="color:var(--bad)">Erase all data</button></section>' +
    '<section class="card"><h2>Install</h2><div class="sm muted">In Chrome tap ⋮ → <b>Add to Home screen</b> (or <b>Install app</b>). It then opens full-screen like a normal app.</div>' + (window.__installEvt ? '<button class="btn full" data-a="install">Install now</button>' : '') + '</section>';
}

function syncCard() {
  const S = SYNC;
  let body;
  if (!S.loaded && !S.failed) body = '<div class="sm muted">' + (navigator.onLine ? 'Loading sync…' : 'Connect to the internet once to turn on sync.') + '</div>';
  else if (S.failed) body = '<div class="sm muted">Couldn\'t load sync (no internet?). Your data is still saved on this phone.</div><button class="btn ghost full" data-a="syncRetry">Try again</button>';
  else if (!S.user) body = '<div class="sm muted">Sign in to back up everything to your Google account and sync between your phone and laptop. Works offline — changes upload when you\'re back online.</div><button class="btn full" data-a="signIn"><svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg> Sign in with Google</button>';
  else body = '<div class="row"><div class="grow"><div class="b sm">' + esc(S.user.email || S.user.name || 'Signed in') + '</div><div class="small muted">' + (S.state === 'error' ? 'Problem: ' + esc(S.error) : !navigator.onLine ? 'Offline — changes will upload later' : S.pending || S.state === 'syncing' ? 'Syncing…' : 'Synced' + (S.last ? ' ' + ago(S.last) : '')) + '</div></div><span class="pill" style="background:var(--' + (S.state === 'error' ? 'bad' : 'good') + '-bg);color:var(--' + (S.state === 'error' ? 'bad' : 'good') + '-fg)">' + (S.state === 'error' ? 'Error' : 'On') + '</span></div><div class="grid2"><button class="btn ghost sm" data-a="syncNow">Sync now</button><button class="btn ghost sm" data-a="signOut">Sign out</button></div>';
  return '<section class="card"><h2>Cloud sync</h2>' + body + '</section>';
}

/* =================== ROUTER / RENDER =================== */
const ROUTES = { home: vHome, today: vToday, tasks: vTasks, money: vMoney, health: vHealth, habits: vHabits, reports: vReports, inbox: vInbox, settings: vSettings };
const NAV = [['home', 'Home'], ['today', 'Today'], ['tasks', 'Tasks'], ['money', 'Money'], ['health', 'Health']];
const NAVPARENT = { habits: 'today', reports: 'home', inbox: 'home', settings: 'home' };
let route = 'home';
function render(keepScroll) {
  const r = (location.hash || '#home').slice(1).split('?')[0];
  const changed = r !== route; route = ROUTES[r] ? r : 'home';
  const y = window.scrollY;
  try { $('#view').innerHTML = ROUTES[route](); } catch (e) { console.error(e); $('#view').innerHTML = '<section class="card"><h2>Something went wrong</h2><div class="sm muted">' + esc(e.message) + '</div><a class="btn" href="#home">Go home</a></section>'; }
  const act = NAVPARENT[route] || route;
  $('#nav').innerHTML = NAV.map(([id, l]) => '<a href="#' + id + '" class="' + (act === id ? 'on' : '') + '"' + (act === id ? ' aria-current="page"' : '') + '>' + ic(id, 22, act === id ? 2.2 : 2) + l + '</a>').join('');
  if (changed && !keepScroll) window.scrollTo(0, 0); else window.scrollTo(0, y);
  document.title = 'Daily Life · ' + route[0].toUpperCase() + route.slice(1);
}
function applyTheme() {
  const t = db.settings.theme; const dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  $('#themeColor').setAttribute('content', dark ? '#121212' : '#F5F4F0');
}
let toastT;
function toast(m) { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2200); }
function openSheet(html) { const s = $('#sheet'); s.innerHTML = '<div role="dialog" aria-modal="true">' + html + '</div>'; s.hidden = false; const f = s.querySelector('input'); if (f) setTimeout(() => f.focus(), 50); }
function closeSheet() { $('#sheet').hidden = true; $('#sheet').innerHTML = ''; }
const val = (id) => { const e = document.getElementById(id); return e ? e.value.trim() : ''; };
const chipVal = (g) => { const e = document.querySelector('#' + g + ' .chip.on'); return e ? e.dataset.v : ''; };
function commit(msg) { save(); render(true); if (msg) toast(msg); }

/* =================== ACTIONS =================== */
const A = {
  sheetClose: closeSheet,
  pickChip: (d, el) => { document.querySelectorAll('#' + d.group + ' .chip').forEach((c) => c.classList.toggle('on', c === el)); },
  timerStart: (d) => { db.timer = { start: Date.now(), cat: d.cat, label: d.label, d: nowInfo().k }; commit('Timer started'); },
  timerStop: () => {
    const t = db.timer; if (!t) return; const min = Math.round((Date.now() - t.start) / 60000);
    if (min >= 1) { const dd = day(t.d); dd.time[t.cat] = (dd.time[t.cat] || 0) + min; dd.log.push({ s: t.start, e: Date.now(), c: t.cat, l: t.label }); }
    db.timer = null; commit(min >= 1 ? 'Logged ' + fmtDur(min) + ' to ' + (CAT[t.cat] || t.cat) : 'Under a minute — not logged');
  },
  // today
  tDate: (d) => { ui.tDate = d.k === nowInfo().k ? null : d.k; render(true); },
  tWeek: (d) => { ui.tDate = addD(ui.tDate || nowInfo().k, +d.n); render(true); },
  block: (d) => { const k = ui.tDate || nowInfo().k; const dd = day(k); const O = ['', 'done', 'skip', 'moved']; dd.b[d.i] = O[(O.indexOf(dd.b[d.i] || '') + 1) % 4]; if (!dd.b[d.i]) delete dd.b[d.i]; commit(); },
  pray: (d) => { const k = ui.tDate || nowInfo().k; const dd = day(k); const v = dd.p[d.id] || ''; dd.p[d.id] = v === '' ? 'on' : v === 'on' ? 'late' : ''; if (!dd.p[d.id]) delete dd.p[d.id]; commit(); },
  habit: (d) => { const k = route === 'habits' ? nowInfo().k : ui.tDate || nowInfo().k; const dd = day(k); dd.h[d.id] = !dd.h[d.id]; commit(); },
  xHabit: (d) => { const dd = day(ui.tDate || nowInfo().k); dd.x[d.j].done = !dd.x[d.j].done; commit(); },
  xDel: (d) => { const dd = day(ui.tDate || nowInfo().k); dd.x.splice(+d.j, 1); commit(); },
  xAdd: () => { const t = val('xh'); if (!t) return; day(ui.tDate || nowInfo().k).x.push({ t, done: false }); commit('Habit added for this day'); },
  planTop: (d) => { const k = ui.tDate || nowInfo().k; const tk = addD(k, 1); const t = db.tasks.find((x) => x.id === d.id); if (!t) return; if (t.top === tk) t.top = ''; else { if (db.tasks.filter((x) => x.top === tk).length >= 3) return toast('Top 3 is full — unstar one first'); t.top = tk; } commit(); },
  planAdd: () => { const t = val('pt'); if (!t) return; const k = ui.tDate || nowInfo().k; const tk = addD(k, 1); const full = db.tasks.filter((x) => x.top === tk).length >= 3; db.tasks.unshift({ id: uid(), t, proj: 'personal', st: 'todo', due: '', est: '', top: full ? '' : tk, created: Date.now() }); commit(full ? 'Added (Top 3 already full)' : 'Added to tomorrow\'s Top 3'); },
  finish: () => { const k = ui.tDate || nowInfo().k; const dd = day(k); dd.fin = !dd.fin; commit(dd.fin ? 'Day finished · ' + dayScore(k).pct + '% — rest well' : 'Day reopened'); },
  // tasks
  taskRange: (d) => { ui.taskRange = d.v; render(true); },
  taskProj: (d) => { ui.taskProj = d.v; render(true); },
  taskNew: () => openSheet(taskSheet()),
  taskEdit: (d) => openSheet(taskSheet(db.tasks.find((t) => t.id === d.id))),
  taskSave: (d) => {
    const t = val('tt'); if (!t) return toast('Give the task a name');
    const o = d.id ? db.tasks.find((x) => x.id === d.id) : { id: uid(), st: 'todo', top: '', created: Date.now() };
    Object.assign(o, { t, proj: chipVal('tproj') || 'personal', due: val('tdue'), est: val('test') ? num(val('test')) : '' });
    const st = chipVal('tst'); if (st) { if (st === 'done' && o.st !== 'done') o.doneAt = nowInfo().k; o.st = st; }
    if (!d.id) db.tasks.unshift(o); closeSheet(); commit(d.id ? 'Saved' : 'Task added');
  },
  taskDel: (d) => { db.tasks = db.tasks.filter((t) => t.id !== d.id); closeSheet(); commit('Deleted'); },
  taskToggle: (d) => { const t = db.tasks.find((x) => x.id === d.id); if (!t) return; if (t.st === 'done') { t.st = 'todo'; delete t.doneAt; } else { t.st = 'done'; t.doneAt = nowInfo().k; } commit(t.st === 'done' ? 'Nice — done' : ''); },
  taskStar: (d) => { const k = nowInfo().k; const t = db.tasks.find((x) => x.id === d.id); if (t.top === k) t.top = ''; else { if (db.tasks.filter((x) => x.top === k).length >= 3) return toast('Top 3 is full — unstar one first'); t.top = k; } commit(); },
  // ideas / inbox
  ideaAdd: () => { const t = val('qidea'); if (!t) return; db.ideas.unshift({ id: uid(), t, d: nowInfo().k }); commit('Idea saved'); },
  ideaAdd2: () => { const t = val('it'); if (!t) return; db.ideas.unshift({ id: uid(), t, d: nowInfo().k }); commit('Idea saved'); },
  ideaDel: (d) => { db.ideas = db.ideas.filter((x) => x.id !== d.id); commit(); },
  ideaToTask: (d) => { const i = db.ideas.find((x) => x.id === d.id); db.tasks.unshift({ id: uid(), t: i.t.slice(0, 140), proj: 'personal', st: 'todo', due: '', est: '', top: '', created: Date.now() }); db.ideas = db.ideas.filter((x) => x.id !== d.id); commit('Moved to Tasks'); },
  inboxTab: (d) => { ui.inboxTab = d.tab; if (route === 'inbox') render(true); },
  remAdd: () => { const t = val('rt'); if (!t) return toast('Write what to remember'); db.reminders.push({ id: uid(), t, when: val('rw'), done: false }); commit('Reminder added'); },
  remToggle: (d) => { const r = db.reminders.find((x) => x.id === d.id); r.done = !r.done; commit(); },
  remDel: (d) => { db.reminders = db.reminders.filter((x) => x.id !== d.id); commit(); },
  // money
  mOff: (d) => { ui.monthOff = Math.min(0, ui.monthOff + +d.n); render(true); },
  txAdd: () => { const a = num(val('amt')); if (!(a > 0)) return toast('Enter an amount'); db.tx.push({ id: uid(), amt: Math.round(a * 100) / 100, sec: chipVal('sec') || 'other', note: val('note'), d: val('txd') || dkey() }); commit('Added ' + money(a)); },
  txDel: (d) => { if (!confirm('Delete this transaction?')) return; db.tx = db.tx.filter((x) => x.id !== d.id); commit('Deleted'); },
  hAdd: () => { const a = num(val('hamt')); if (!(a > 0)) return toast('Enter an amount'); db.house.items.unshift({ id: uid(), amt: Math.round(a * 100) / 100, note: val('hnote'), d: dkey() }); commit('Household expense added'); },
  hDel: (d) => { db.house.items = db.house.items.filter((x) => x.id !== d.id); commit(); },
  hPeople: (d) => { db.house.people = clamp(db.house.people + +d.n, 1, 12); commit(); },
  hSettle: () => { const H = db.house; const tot = H.items.reduce((a, x) => a + num(x.amt), 0); const owed = tot - tot / H.people; if (!confirm('Settle up? Others owe you ' + money(owed) + '. This clears the household list.')) return; H.settled.unshift({ d: dkey(), total: tot, n: H.people, owed, items: H.items }); H.items = []; commit('Settled · list reset'); },
  // health
  water: (d) => { const h = hday(nowInfo().k); h.water = h.water === +d.n ? +d.n - 1 : +d.n; commit(); },
  energy: (d) => { const h = hday(nowInfo().k); h.energy = h.energy === +d.n ? 0 : +d.n; commit(); },
  screenQuick: (d) => { hday(nowInfo().k).screen = +d.n; commit(); },
  foodAdd: () => { const n = val('fn'); if (!n) return toast('What did you eat?'); hday(nowInfo().k).food.push({ name: n, kcal: num(val('fk')), p: num(val('fp')) }); commit('Food added'); },
  foodDel: (d) => { hday(nowInfo().k).food.splice(+d.i, 1); commit(); },
  exAdd: () => { const type = chipVal('ext') || 'other'; const amt = val('exa'), min = val('exm'); if (!amt && !min) return toast('Enter an amount or minutes'); const t = EX.find((x) => x[0] === type); hday(nowInfo().k).ex.push({ type, amt: amt || min, min: min, name: type === 'other' ? val('exn') : '' }); commit(t[1] + ' logged'); },
  exDel: (d) => { hday(nowInfo().k).ex.splice(+d.i, 1); commit(); },
  countdown: () => openSheet(countdownSheet()),
  countdownToggle: () => { db.settings.countdown = !db.settings.countdown; commit(db.settings.countdown ? 'Countdown popup on' : 'Countdown popup off'); },
  countdownOff: () => { db.settings.countdown = false; save(); closeSheet(); toast('Daily popup off — turn it back on in Settings'); },
  // habits
  toggleChip: (d, el) => { el.classList.toggle('on'); el.setAttribute('aria-pressed', el.classList.contains('on')); },
  daysPreset: (d) => { const set = { all: [0, 1, 2, 3, 4, 5, 6], wk: [1, 2, 3, 4, 5], we: [0, 6] }[d.v]; document.querySelectorAll('#nhd .chip').forEach((c) => { const on = set.includes(+c.dataset.v); c.classList.toggle('on', on); c.setAttribute('aria-pressed', on); }); },
  habitAdd: () => {
    const name = val('nh'); if (!name) return toast('Name your habit');
    const days = [...document.querySelectorAll('#nhd .chip.on')].map((c) => +c.dataset.v); if (!days.length) return toast('Pick at least one day');
    db.habits.custom = db.habits.custom || []; db.habits.custom.push({ id: uid(), name, target: val('nht'), days, start: nowInfo().k, created: Date.now() });
    commit('Habit added — it\'s on Today now');
  },
  habitEdit: (d) => { const c = (db.habits.custom || []).find((x) => x.id === d.id); if (c) openSheet(habitSheet(c)); },
  habitSave: (d) => {
    const c = db.habits.custom.find((x) => x.id === d.id); const name = val('eh'); if (!name) return toast('Name your habit');
    const days = [...document.querySelectorAll('#ehd .chip.on')].map((x) => +x.dataset.v); if (!days.length) return toast('Pick at least one day');
    Object.assign(c, { name, target: val('eht'), days }); closeSheet(); commit('Saved');
  },
  habitPause: (d) => { const c = db.habits.custom.find((x) => x.id === d.id); c.archived = true; closeSheet(); commit('Paused — resume any time'); },
  habitResume: (d) => { const c = db.habits.custom.find((x) => x.id === d.id); c.archived = false; commit('Resumed'); },
  habitDel: (d) => { if (!confirm('Delete this habit? Its streak history will be hidden.')) return; db.habits.custom = db.habits.custom.filter((x) => x.id !== d.id); closeSheet(); commit('Deleted'); },
  pages: (d) => { const k = nowInfo().k; const H = db.habits; H.pages = H.pages || {}; const cur = H.pages[k] || 0; const nv = Math.max(0, cur + +d.n); if (nv === cur) return; H.pages[k] = nv; if (H.book) H.book.page = clamp(H.book.page + (nv - cur), 0, H.book.total || 99999); day(k).h.read = nv >= db.settings.pagesGoal; commit(); },
  bookSave: () => { const t = val('bt'); if (!t) return toast('Enter the book name'); const H = db.habits; const tot = Math.max(1, num(val('bn'), 250)); H.book = Object.assign(H.book || { page: 0, start: dkey() }, { title: t, author: val('ba'), total: tot }); if (document.getElementById('bp')) H.book.page = clamp(num(val('bp')), 0, tot); commit('Book saved'); },
  bookFinish: () => { const bk = db.habits.book; if (!bk) return; openSheet(finishSheet(bk)); },
  bookFinishSave: () => {
    const H = db.habits; const bk = H.book; if (!bk) return closeSheet();
    const act = val('fact');
    H.finished.unshift({ title: bk.title, author: bk.author, total: bk.total, d: dkey(), start: bk.start, notes: bk.notes || [], rating: +chipVal('frate') || 0, big: val('fbig'), action: act });
    if (act) db.tasks.unshift({ id: uid(), t: 'From "' + bk.title + '": ' + act, proj: 'personal', st: 'todo', due: '', est: '', top: '', created: Date.now() });
    H.book = null; closeSheet(); commit('Book finished · notes saved' + (act ? ' · action added to Tasks' : ''));
  },
  bookNote: () => { const bk = db.habits.book; const t = val('bkn'); if (!bk || !t) return toast('Write your takeaway first'); bk.notes = bk.notes || []; bk.notes.push({ t, p: num(val('bknp')) || '', d: nowInfo().k }); commit('Takeaway saved'); },
  bookNoteDel: (d) => { const bk = db.habits.book; if (!bk || !confirm('Delete this note?')) return; bk.notes.splice(+d.i, 1); commit(); },
  noteIdea: (d) => { const bk = db.habits.book; const n = bk && bk.notes[+d.i]; if (!n) return; db.ideas.unshift({ id: uid(), t: n.t, d: nowInfo().k, src: 'Book: ' + bk.title }); commit('Sent to Inbox ideas'); },
  bookView: (d) => openSheet(bookSheet(db.habits.finished[+d.i], +d.i)),
  bookIdea: (d) => { const f = db.habits.finished[+d.i]; if (!f) return; const t = 'Reel/post from "' + f.title + '": ' + (f.big || ((f.notes || [])[0] || {}).t || ''); db.ideas.unshift({ id: uid(), t, d: nowInfo().k, src: 'Book: ' + f.title }); closeSheet(); commit('Idea added to Inbox'); },
  planDone: () => {
    const k = nowInfo().k; const pick = chipVal('mit'); const txt = val('mitText');
    if (!pick && !txt) return toast('Pick or type your one thing');
    const dd = day(k); dd.plan = { done: true, at: Date.now(), intent: val('intent'), mitTask: txt ? '' : pick, mit: txt || '', mitDone: false };
    const t = !txt && db.tasks.find((x) => x.id === pick); if (t && t.top !== k && db.tasks.filter((x) => x.top === k).length < 3) t.top = k;
    commit('Have a great day');
  },
  planEdit: () => { const dd = day(nowInfo().k); if (dd.plan) dd.plan.done = false; commit(); },
  mitToggle: () => { const k = nowInfo().k; const pl = day(k).plan; if (!pl) return; const t = pl.mitTask && db.tasks.find((x) => x.id === pl.mitTask); let on; if (t) { if (t.st === 'done') { t.st = 'todo'; delete t.doneAt; } else { t.st = 'done'; t.doneAt = k; } on = t.st === 'done'; } else on = pl.mitDone = !pl.mitDone; commit(on ? 'The one thing is done. Today is a win.' : ''); },
  typeSave: () => { const w = num(val('tw')); if (!(w > 0)) return toast('Enter your WPM'); const k = nowInfo().k; const H = db.habits; let s = H.typing.find((x) => x.d === k); if (!s) { s = { d: k }; H.typing.push(s); H.typing.sort((a, b) => (a.d < b.d ? -1 : 1)); } Object.assign(s, { wpm: w, acc: num(val('ta')), min: num(val('tm')) }); day(k).h.type = true; commit('Typing saved · ' + w + ' WPM'); },
  spSave: () => { const k = nowInfo().k; const min = num(val('spm')); if (!(min > 0)) return toast('How many minutes?'); db.habits.speaking.unshift({ d: k, topic: val('spt') || 'Practice', min, mode: chipVal('spmode') || 'Camera', rate: +chipVal('sprt') || 3, note: val('spn') }); day(k).h.talk = true; commit('Session saved'); },
  spDel: (d) => { db.habits.speaking.splice(+d.i, 1); commit(); },
  park: () => { const t = val('park'); if (!t) return; db.habits.notes.unshift({ t, d: nowInfo().k }); commit('Parked'); },
  noteDel: (d) => { db.habits.notes.splice(+d.i, 1); commit(); },
  noteToInbox: (d) => { const n = db.habits.notes.splice(+d.i, 1)[0]; db.ideas.unshift({ id: uid(), t: n.t, d: n.d, src: 'Idea parking' }); commit('Moved to Inbox'); },
  // reports
  period: (d) => { ui.period = Math.max(0, +d.n); render(true); },
  // settings
  theme: (d) => { db.settings.theme = d.v; save(); applyTheme(); render(true); },
  alerts: async () => {
    const S = db.settings;
    if (!S.alerts) { if (!('Notification' in window)) return toast('Notifications not supported here'); const p = await Notification.requestPermission(); if (p !== 'granted') return toast('Permission not given'); S.alerts = true; } else S.alerts = false;
    commit(S.alerts ? 'Reminder alerts on' : 'Alerts off');
  },
  export: () => { const b = new Blob([JSON.stringify(db, null, 1)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'daily-life-backup-' + dkey() + '.json'; document.body.appendChild(a); a.click(); a.remove(); db.meta.lastBackup = Date.now(); commit('Backup downloaded'); },
  reset: () => { if (!confirm('Erase ALL data on this phone? Export a backup first if unsure.')) return; if (!confirm('Really erase everything?')) return; db = DEF(); commit('All data erased'); },
  signIn: () => (window.DLSync ? window.DLSync.signIn() : toast('Sync is still loading')),
  signOut: () => { if (window.DLSync && confirm('Sign out? Your data stays on this phone.')) window.DLSync.signOut(); },
  syncNow: () => window.DLSync && window.DLSync.syncNow(),
  syncRetry: () => loadSync(),
  install: async () => { const e = window.__installEvt; if (!e) return; e.prompt(); await e.userChoice; window.__installEvt = null; render(true); }
};
const CH = {
  dayText: (v, d) => { day(ui.tDate || nowInfo().k)[d.f] = v.trim(); save(); },
  hField: (v, d) => { const h = hday(nowInfo().k); h[d.f] = d.f === 'screen' ? (v === '' ? '' : Math.max(0, Math.round(num(v)))) : d.f === 'w' ? (v === '' ? '' : num(v)) : v; commit(); },
  periodNext: (v, d) => { db.periods[d.p] = Object.assign(db.periods[d.p] || {}, { next: v.trim() }); save(); },
  setting: (v, d) => {
    const S = db.settings; const n = ['name', 'currency'].includes(d.f);
    if (n) S[d.f] = v.trim() || (d.f === 'name' ? 'Mo' : '$');
    else if (d.f === 'weightGoal') S[d.f] = v === '' ? '' : num(v);
    else { const x = num(v, S[d.f]); if (x > 0) S[d.f] = d.f === 'waterGoal' ? clamp(Math.round(x), 1, 16) : x; }
    commit('Saved');
  },
  import: (v, d, el) => {
    const f = el.files && el.files[0]; if (!f) return;
    const r = new FileReader(); r.onload = () => { try { const j = JSON.parse(r.result); if (!j || !j.settings || !j.days) throw 0; if (!confirm('Replace data on this phone with this backup?')) return; localStorage.setItem(KEY, JSON.stringify(j)); db = load(); applyTheme(); commit('Backup restored'); } catch (e) { toast('That file is not a Daily Life backup'); } }; r.readAsText(f);
  }
};
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-a]'); if (!el || el.disabled) return;
  const fn = A[el.dataset.a]; if (!fn) return;
  if (el.tagName === 'A' && el.dataset.a === 'inboxTab') { ui.inboxTab = el.dataset.tab; return; }
  e.preventDefault(); fn(el.dataset, el);
});
document.addEventListener('change', (e) => { const el = e.target.closest('[data-c]'); if (el && CH[el.dataset.c]) CH[el.dataset.c](el.value, el.dataset, el); });
document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.dataset && e.target.dataset.enter) { e.preventDefault(); A[e.target.dataset.enter](); } });
$('#sheet').addEventListener('click', (e) => { if (e.target.id === 'sheet') closeSheet(); });
window.addEventListener('hashchange', () => { closeSheet(); render(); });
window.addEventListener('online', () => { render(true); toast('Back online'); });
window.addEventListener('offline', () => { render(true); toast('Offline — still saving on phone'); });
window.addEventListener('storage', (e) => { if (e.key === KEY) { db = load(); render(true); } });
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); window.__installEvt = e; });

/* timer tick + reminders + day rollover */
let lastKey = nowInfo().k, lastMin = -1;
setInterval(() => {
  const t = document.getElementById('tick'); if (t) t.textContent = elapsed();
  const n = nowInfo(); const m = new Date().getMinutes();
  if (m !== lastMin) {
    lastMin = m;
    if (n.k !== lastKey) { lastKey = n.k; ui.tDate = null; }
    const active = document.activeElement; const typing = active && /INPUT|TEXTAREA|SELECT/.test(active.tagName);
    if ((route === 'home' || route === 'today') && !typing && $('#sheet').hidden) render(true);
    checkReminders();
  }
}, 1000);
function checkReminders() {
  if (!db.settings.alerts || !('Notification' in window) || Notification.permission !== 'granted') return;
  const now = new Date(); let ch = false;
  db.reminders.forEach((r) => { if (!r.done && r.when && !r.notified && new Date(r.when) <= now) { r.notified = true; ch = true; const opts = { body: r.t, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: r.id }; if (navigator.serviceWorker && navigator.serviceWorker.controller) navigator.serviceWorker.ready.then((reg) => reg.showNotification('Reminder', opts)); else new Notification('Reminder', opts); } });
  if (ch) save();
}

/* boot */
applyTheme(); render();
function maybeCountdown() {
  if (!db.settings.countdown) return;
  const k = dkey(); if (localStorage.getItem('dl:countdown') === k) return;
  localStorage.setItem('dl:countdown', k);
  setTimeout(() => { if ($('#sheet').hidden) openSheet(countdownSheet()); }, 500);
}
maybeCountdown();
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') maybeCountdown(); });
function loadSync() {
  if (location.protocol === 'file:' || window.DLSync) return;
  SYNC.failed = false; softRender();
  import('./sync.js').then(() => { SYNC.loaded = true; softRender(); }).catch((e) => { console.warn('sync unavailable', e); SYNC.failed = true; softRender(); });
}
loadSync();
window.addEventListener('online', () => { if (SYNC.failed) loadSync(); });
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
