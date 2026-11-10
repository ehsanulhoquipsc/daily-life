'use strict';
/* Daily Life v1.8 — Evening shutdown, fit check, Focus mode, Goals, Habit stats, Workout.
   Loaded after app.js and uses its helpers (db, day, render, A, ROUTES …). */

const DAYS_FULL = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'];
const FOCUS_CATS = ['tent', 'doc', 'study'];
const chipBtn = (a, v, label, on, extra) => '<button class="chip' + (on ? ' on' : '') + '" data-a="' + a + '" data-v="' + esc(v) + '" ' + (extra || '') + '>' + label + '</button>';
const ring = (pctV, size, color, label, sub) => { const r = size / 2 - 7, C = 2 * Math.PI * r; return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '" role="img" aria-label="' + esc(label) + '"><circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="var(--soft)" stroke-width="8"/><circle cx="' + size / 2 + '" cy="' + size / 2 + '" r="' + r + '" fill="none" stroke="' + color + '" stroke-width="8" stroke-linecap="round" stroke-dasharray="' + (C * Math.min(100, pctV) / 100).toFixed(1) + ' ' + C.toFixed(1) + '" transform="rotate(-90 ' + size / 2 + ' ' + size / 2 + ')"/><text x="50%" y="' + (sub ? size / 2 + 2 : size / 2 + 6) + '" text-anchor="middle" font-size="' + (size > 80 ? 20 : 15) + '" font-weight="800" fill="currentColor">' + label + '</text>' + (sub ? '<text x="50%" y="' + (size / 2 + 18) + '" text-anchor="middle" font-size="10" fill="var(--muted)">' + sub + '</text>' : '') + '</svg>'; };
const blockLen = (b, list, i) => { const s = ADJ(toM(b.s)); const e = b.e ? ADJ(toM(b.e)) : (list[i + 1] ? ADJ(toM(list[i + 1].s)) : s + 30); return Math.max(0, e - s); };

/* ========================== FIT CHECK (over-commit) ========================== */
// free focus minutes on a day = project blocks (@tent_hox, Doctrin, Study) not moved/skipped, plus block catch-ups; optionally only what's still ahead
function freeFocus(k, fromNow) {
  const S = sched(k).blocks; const dd = peekDay(k); const m = nowInfo().m; let tot = 0;
  S.forEach((b, i) => {
    if (!FOCUS_CATS.includes(b.c) || dd.b[i] === 'moved' || dd.b[i] === 'skip' || dd.b[i] === 'done') return;
    const s = ADJ(toM(b.s)), len = blockLen(b, S, i), e = s + len;
    tot += fromNow ? Math.max(0, e - Math.max(s, m)) : len;
  });
  (dd.cu || []).forEach((c) => { if (c.kind === 'block' && !c.done && FOCUS_CATS.includes(c.c)) tot += 60; });
  return tot;
}
const est = (t) => num(t.est) || 30;
function fitBox(planned, free, k) {
  const over = planned > free; const mx = Math.max(free, planned, 1) * 1.1;
  return '<div style="background:var(--soft);border-radius:14px;padding:12px;display:flex;flex-direction:column;gap:8px">' +
    '<div class="row between sm b"><span>Fits your free focus time?</span><span style="color:' + (over ? 'var(--bad)' : 'var(--good)') + '">' + (over ? 'Over by ' + fmtDur(planned - free) : 'Fits') + '</span></div>' +
    '<div style="height:12px;background:var(--line);border-radius:6px;position:relative;overflow:hidden"><i style="position:absolute;left:0;top:0;bottom:0;width:' + (planned / mx * 100).toFixed(1) + '%;background:' + (over ? 'var(--bad)' : 'var(--good)') + ';border-radius:6px"></i><i style="position:absolute;top:0;bottom:0;left:' + (free / mx * 100).toFixed(1) + '%;width:2px;background:var(--ink)"></i></div>' +
    '<div class="row between small muted"><span>Planned ' + fmtDur(planned) + '</span><span>Free focus time ' + fmtDur(free) + '</span></div></div>';
}
function fitLine(k, fromNow) {
  const top = db.tasks.filter((t) => t.top === k && t.st !== 'done'); if (!top.length) return '';
  const planned = top.reduce((a, t) => a + est(t), 0); const free = freeFocus(k, fromNow);
  const over = planned > free;
  return '<div class="small" style="padding:8px 10px;border-radius:10px;background:' + (over ? 'var(--bad-bg)' : 'var(--good-bg)') + ';color:' + (over ? 'var(--bad-fg)' : 'var(--good-fg)') + '"><b>' + (over ? 'Top 3 won\'t fit:' : 'Top 3 fits:') + '</b> ' + fmtDur(planned) + ' planned, ' + fmtDur(free) + ' of focus time left' + (over ? ' — drop one or move it to Sunday.' : '.') + '</div>';
}

/* ========================== EVENING SHUTDOWN ========================== */
ui.sd = null; // { k, dest: {key: value} }
function sdItems(k) {
  const dd = peekDay(k); const isNow = k === nowInfo().k;
  const blocks = sched(k).blocks.map((b, i) => [b, i]).filter(([b, i]) => b.c !== 'pray' && !['meal', 'rest', 'work'].includes(b.c) && !dd.b[i]);
  const tasks = db.tasks.filter((t) => t.top === k && t.st !== 'done');
  const habs = habitDefs(k).filter(([id]) => !dd.h[id] && !(dd.mk || {})[id]);
  return { blocks, tasks, habs, isNow };
}
function vShutdown() {
  const k = (ui.sd && ui.sd.k) || ui.tDate || nowInfo().k; if (!ui.sd || ui.sd.k !== k) ui.sd = { k, dest: {} };
  const D = ui.sd.dest; const dd = peekDay(k); const sc = dayScore(k); const tk = addD(k, 1); const sun = nextSun(k);
  const it = sdItems(k);
  const doneList = [].concat(
    sched(k).blocks.map((b, i) => dd.b[i] === 'done' ? b.l : null).filter(Boolean),
    habitDefs(k).filter(([id]) => dd.h[id]).map(([, l]) => l),
    db.tasks.filter((t) => t.doneAt === k).map((t) => t.t),
    (dd.cu || []).filter((c) => c.done).map((c) => c.l)
  );
  const dayOpts = [...Array(6)].map((_, i) => addD(k, i + 1));
  const row = (key, title, kind, def, isHabit) => {
    const v = D[key] || def; D[key] = v;
    const opts = isHabit ? [['tomorrow', 'Tmrw 2×'], ['sunday', 'Sun 2×'], ['drop', 'Drop']] : [['tomorrow', 'Tomorrow'], ['sunday', 'Sunday'], ['drop', 'Drop']];
    return '<div style="border-top:1px solid var(--line);padding:10px 0 2px;display:flex;flex-direction:column;gap:8px"><div class="row between" style="align-items:baseline"><span class="b" style="font-size:15px">' + esc(title) + '</span><span class="small muted" style="white-space:nowrap">' + kind + '</span></div>' +
      '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px">' + opts.map(([o, l]) => '<button class="chip' + (v === o ? ' on' : '') + '" data-a="sdDest" data-key="' + key + '" data-v="' + o + '" style="padding:0;height:38px;font-size:12px">' + l + '</button>').join('') +
      '<select class="in" data-c="sdDestSel" data-key="' + key + '" aria-label="Pick a day" style="height:38px;padding:0 6px;font-size:12px;font-weight:700;border-radius:18px' + (/^\d{4}/.test(v) ? ';background:var(--btn);color:var(--btnInk)' : '') + '"><option value="">Pick day</option>' + dayOpts.map((x) => '<option value="' + x + '"' + (v === x ? ' selected' : '') + '>' + DOW[parseD(x).getDay()] + ' ' + parseD(x).getDate() + '</option>').join('') + '</select></div></div>';
  };
  const left = it.tasks.map((t) => row('t:' + t.id, t.t, 'Top 3 task', 'tomorrow')).join('') +
    it.blocks.map(([b, i]) => row('b:' + i, b.l, 'Block · ' + fmtTs(b.s), 'sunday')).join('') +
    it.habs.map(([id, l]) => row('h:' + id, l, 'Habit', 'tomorrow', true)).join('');
  const nLeft = it.tasks.length + it.blocks.length + it.habs.length;
  // plan tomorrow
  const cand = db.tasks.filter((t) => t.st !== 'done').sort((a, b) => (b.top === tk) - (a.top === tk) || ((a.due || '9') < (b.due || '9') ? -1 : 1));
  const starred = db.tasks.filter((t) => t.top === tk && t.st !== 'done');
  // tasks moving to tomorrow (not yet applied) count toward plan too
  const incoming = it.tasks.filter((t) => (D['t:' + t.id] || 'tomorrow') === 'tomorrow' && t.top !== tk);
  const planned = starred.concat(incoming).reduce((a, t) => a + est(t), 0); const free = freeFocus(tk, false);
  const over = planned > free; const big = starred.slice().sort((a, b) => est(b) - est(a))[0];
  const S2 = sched(tk);
  const firstB = S2.blocks.find((b) => b.c !== 'pray' && b.c !== 'rest');
  return '<header class="row between"><div><div class="small b muted">' + nice(k).toUpperCase() + '</div><h1>Evening shutdown</h1></div><a href="#today" class="iconbtn" aria-label="Close">' + ic('x', 18) + '</a></header>' +
    '<section class="card"><div class="row" style="gap:14px">' + ring(sc.pct, 72, 'var(--good)', sc.pct + '%') + '<div><div class="small xb" style="color:var(--good-fg)">1 · WHAT GOT DONE</div><div class="xb" style="font-size:17px">' + doneList.length + ' thing' + (doneList.length === 1 ? '' : 's') + ' done</div><div class="sm muted">' + sc.pOn + '/5 prayers · ' + sc.hs.done + ' of ' + sc.hs.total + ' habits · ' + sc.td + ' of ' + (sc.tt || 0) + ' Top 3</div></div></div>' +
    (doneList.length ? '<div class="chips">' + doneList.slice(0, 12).map((x) => '<span class="pill" style="background:var(--good-bg);color:var(--good-fg);padding:5px 9px">✓ ' + esc(x) + '</span>').join('') + '</div>' : '') +
    (nLeft ? '<div class="small xb" style="color:var(--warn-fg);padding-top:6px">NOT DONE · ' + nLeft + ' left — where should they go?</div>' + left : '<div class="sm b" style="color:var(--good-fg)">Nothing left over. Clean day.</div>') + '</section>' +
    '<section class="card"><div class="small xb" style="color:var(--doc-fg)">2 · ONE LINE ABOUT TODAY</div><label class="f">Win of the day<textarea class="in" rows="2" data-c="sdText" data-k="' + k + '" data-f="done" placeholder="What are you glad you did?">' + esc(dd.done) + '</textarea></label><label class="f">What got in the way?<textarea class="in" rows="2" data-c="sdText" data-k="' + k + '" data-f="blockers" placeholder="optional">' + esc(dd.blockers) + '</textarea></label></section>' +
    '<section class="card"><div class="small xb" style="color:var(--study-fg)">3 · PLAN TOMORROW · ' + nice(tk).toUpperCase() + '</div><div class="sm muted">Focus: <b style="color:var(--ink)">' + esc(S2.focus) + '</b>' + (firstB ? ' · first block ' + esc(firstB.l) + ' at ' + fmtT(firstB.s) : '') + '</div>' +
    fitBox(planned, free, tk) + '<div class="small muted">Free time = your @tent_hox, Doctrin and Study blocks tomorrow. Venture, meals and prayers are left out. Tasks without an estimate count as 30 min.</div>' +
    (incoming.length ? '<div class="small muted">Includes ' + incoming.length + ' task' + (incoming.length === 1 ? '' : 's') + ' carried over from today.</div>' : '') +
    cand.slice(0, 8).map((t) => { const on = t.top === tk; return '<div class="list-row" style="gap:6px"><button class="del" data-a="sdStar" data-id="' + t.id + '" aria-pressed="' + on + '" aria-label="Top 3 tomorrow: ' + esc(t.t) + '" style="color:' + (on ? 'var(--warn)' : 'var(--line2)') + '">' + ic('star', 22, 2, on ? 'fill="currentColor"' : '') + '</button><span class="grow"><span class="b" style="display:block;font-size:15px">' + esc(t.t) + '</span><span class="small muted">' + esc(projName(t.proj)) + '</span></span><label class="sr" for="est' + t.id + '">Minutes</label><input id="est' + t.id + '" type="number" inputmode="numeric" class="in" data-c="sdEst" data-id="' + t.id + '" value="' + esc(t.est || '') + '" placeholder="30" style="width:66px;height:38px;text-align:center;font-weight:800;padding:0 4px"><span class="small muted">m</span></div>'; }).join('') +
    '<div class="row"><label class="sr" for="sdNew">New task for tomorrow</label><input id="sdNew" class="in grow" placeholder="Add a task for tomorrow…" data-enter="sdAdd"><button class="btn ghost sm" data-a="sdAdd">Add</button></div>' +
    (over && big ? '<div style="background:var(--bad-bg);border-radius:14px;padding:12px;display:flex;flex-direction:column;gap:8px"><div class="b" style="color:var(--bad-fg)">Over by ' + fmtDur(planned - free) + ' — this won\'t fit</div><div class="sm" style="color:var(--bad-fg)">Drop a star, move one to Sunday, or shorten an estimate. A day that fits beats a day you can\'t finish.</div><button class="btn sm danger" data-a="sdMoveBig" data-id="' + big.id + '">Move “' + esc(big.t) + '” to Sunday</button></div>' : starred.length ? '<div class="sm b" style="background:var(--good-bg);color:var(--good-fg);border-radius:14px;padding:12px">Fits, with ' + fmtDur(free - planned) + ' to spare.</div>' : '') + '</section>' +
    '<section class="hero" style="flex-direction:column;align-items:stretch;gap:10px"><div class="small xb" style="color:var(--heroMuted)">4 · SHUT DOWN</div><div class="xb" style="font-size:20px;line-height:1.25">' + (dd.fin ? 'Day already closed. You can update and close again.' : 'Close the day at ' + sc.pct + '%. Phone down, rest well.') + '</div>' +
    '<button class="btn" data-a="sdGo" style="background:var(--heroInk);color:var(--hero);height:52px">Shut down the day</button></section>';
}
function sdApply() {
  const k = ui.sd.k; const D = ui.sd.dest; const it = sdItems(k); const tk = addD(k, 1); const sun = nextSun(k); let moved = 0, dropped = 0;
  const target = (v) => v === 'tomorrow' ? tk : v === 'sunday' ? sun : /^\d{4}-/.test(v) ? v : null;
  it.tasks.forEach((t) => { const v = D['t:' + t.id] || 'tomorrow'; const to = target(v); if (to === tk) { t.top = tk; t.due = t.due && t.due > tk ? t.due : tk; moved++; } else if (to) { moveTask(t, k, to); moved++; } else { t.top = ''; dropped++; } });
  it.blocks.forEach(([b, i]) => { const v = D['b:' + i] || 'sunday'; const to = target(v); if (to) { moveBlock(k, i, to); moved++; } else { day(k).b[i] = 'skip'; dropped++; } });
  it.habs.forEach(([id]) => { const v = D['h:' + id] || 'tomorrow'; const to = target(v); if (to) { moveHabit(k, id, to); moved++; } else dropped++; });
  const dd = day(k); dd.fin = true; dd.shutAt = Date.now();
  return { moved, dropped };
}

/* ========================== FOCUS MODE ========================== */
// db.focusRun = { start, len (min), cat, label, paused (ms accumulated before pause), pausedAt }
function focusElapsed(r) { if (!r) return 0; const now = r.pausedAt || Date.now(); return Math.max(0, (now - r.start) / 1000); }
function plantSvg(p, dead, size) {
  const s = size || 220, k = s / 260; const stage = dead ? 0 : p < 0.05 ? 0 : p < 0.35 ? 1 : p < 0.7 ? 2 : p < 1 ? 3 : 4;
  const topY = 192 - (dead ? 0 : Math.max(8, 100 * Math.min(1, p)));
  const R = 118, C = 2 * Math.PI * R;
  let g = '<circle cx="130" cy="130" r="118" fill="none" stroke="rgba(255,255,255,.08)" stroke-width="10"/><circle cx="130" cy="130" r="118" fill="none" stroke="#6FCF97" stroke-width="10" stroke-linecap="round" stroke-dasharray="' + (C * (dead ? 0 : Math.min(1, p))).toFixed(1) + ' ' + C.toFixed(1) + '" transform="rotate(-90 130 130)"/><ellipse cx="130" cy="196" rx="62" ry="12" fill="#3B2A1C"/><path d="M84 196 Q130 176 176 196 Z" fill="#5A3F28"/>';
  if (dead) g += '<path d="M130 192 Q126 168 112 160" stroke="#7A6A52" stroke-width="5" fill="none" stroke-linecap="round"/><path d="M112 160 Q98 158 94 168 Q106 172 112 160 Z" fill="#7A6A52"/>';
  else {
    g += '<path d="M130 192 Q' + (stage >= 2 ? 136 : 132) + ' ' + ((192 + topY) / 2) + ' 130 ' + topY + '" stroke="#4CAF6E" stroke-width="6" fill="none" stroke-linecap="round"/>';
    if (stage >= 1) g += '<path d="M130 164 q-22 -4 -28 -20 q22 0 28 20z" fill="#6FCF97"/>';
    if (stage >= 2) g += '<path d="M130 140 q22 -4 28 -20 q-22 0 -28 20z" fill="#6FCF97"/>';
    if (stage >= 3) g += '<path d="M130 118 q-20 -4 -26 -18 q20 0 26 18z" fill="#6FCF97"/><path d="M130 104 q18 -4 24 -16 q-18 0 -24 16z" fill="#6FCF97"/>';
    if (stage >= 4) g += '<circle cx="130" cy="' + topY + '" r="14" fill="#F2B8CF"/><circle cx="130" cy="' + topY + '" r="6" fill="#F6D365"/>';
  }
  return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 260 260" role="img" aria-label="Focus plant">' + g + '</svg>';
}
const miniPlant = (ok) => '<svg width="26" height="30" viewBox="0 0 26 30" aria-hidden="true"><path d="M13 28 V' + (ok ? 6 : 18) + '" stroke="' + (ok ? '#4CAF6E' : '#7A6A52') + '" stroke-width="2.5" stroke-linecap="round"/><path d="M13 ' + (ok ? 20 : 24) + ' q-8 -1 -9 -7 q8 0 9 7z" fill="' + (ok ? '#6FCF97' : '#7A6A52') + '"/><path d="M13 ' + (ok ? 14 : 22) + ' q8 -1 9 -7 q-8 0 -9 7z" fill="' + (ok ? '#6FCF97' : '#7A6A52') + '"/></svg>';
function plannedFocusMin(k) { const S = sched(k).blocks; return S.reduce((a, b, i) => a + (FOCUS_CATS.includes(b.c) ? blockLen(b, S, i) : 0), 0); }
function focusScore(k) { const f = (peekDay(k).focus || []); const done = f.reduce((a, x) => a + num(x.min), 0); const pl = plannedFocusMin(k) || 120; return { done, pl, score: Math.round(done / pl * 100), n: f.length, wilted: f.filter((x) => !x.ok).length }; }
ui.focusLen = 25;
function vFocus() {
  const r = db.focusRun; const k = nowInfo().k;
  const len = (r ? r.len : ui.focusLen) * 60; const el = r ? focusElapsed(r) : 0; const p = el / len; const left = Math.max(0, Math.round(len - el));
  const doneNow = r && el >= len;
  const cat = r ? r.cat : (ui.focusCat || (currentBlock(k, nowInfo().m).cur || {}).b ? (ui.focusCat || currentBlock(k, nowInfo().m).cur.b.c) : 'study');
  const label = r ? r.label : (ui.focusLabel || (currentBlock(k, nowInfo().m).cur || { b: { l: 'Deep work' } }).b.l);
  const FS = focusScore(k); const f = peekDay(k).focus || [];
  const wk = weekKeys(k); const wMin = wk.map((x) => (peekDay(x).focus || []).reduce((a, s) => a + num(s.min), 0)); const wMax = Math.max(60, ...wMin);
  const byCat = {}; wk.forEach((x) => (peekDay(x).focus || []).forEach((s) => (byCat[s.cat] = (byCat[s.cat] || 0) + num(s.min))));
  const state = ui.focusDead ? 'dead' : doneNow ? 'done' : r ? (r.pausedAt ? 'paused' : 'running') : 'idle';
  const status = { dead: 'You gave up — the plant wilted. ' + (ui.focusDead || 0) + ' min still counted.', done: 'Done! Tap Finish to log ' + (r ? r.len : 0) + ' min to ' + esc(CAT[cat] || cat) + '.', paused: 'Paused', running: 'Stay with it — phone face down', idle: 'Ready when you are' }[state];
  const catChips = FOCUS_CATS.concat(['work', 'personal'], (db.cats.proj || []).map((x) => x.id)).map((c) => '<button class="chip' + (cat === c ? ' on' : '') + '" data-a="focusCat" data-v="' + c + '" style="background:' + (cat === c ? '#F2F1EE' : 'transparent') + ';color:' + (cat === c ? '#10140F' : '#F2F1EE') + ';border-color:rgba(255,255,255,.2)"' + (r ? ' disabled' : '') + '>' + esc(CAT[c]) + '</button>').join('');
  return '<div style="background:#10140F;color:#F2F1EE;margin:-18px -16px -110px;padding:calc(18px + env(safe-area-inset-top)) 18px 120px;min-height:100vh;display:flex;flex-direction:column;gap:16px">' +
    '<header class="row between"><a href="#home" class="iconbtn" aria-label="Leave focus" style="background:rgba(255,255,255,.08);border:0;color:#F2F1EE">' + ic('x', 18, 2.4) + '</a><span class="pill" style="background:var(--' + colorKey(cat) + '-bg);color:var(--' + colorKey(cat) + '-fg);padding:6px 12px">' + esc(label) + '</span><span class="small b" style="color:#8F8D88">Session ' + (f.length + 1) + '</span></header>' +
    '<div style="display:flex;flex-direction:column;align-items:center;gap:6px">' + plantSvg(p, state === 'dead', 240) + '<div id="fclock" style="font-size:64px;font-weight:800;letter-spacing:-2px;font-variant-numeric:tabular-nums;line-height:1">' + (state === 'dead' ? '--:--' : pad(Math.floor(left / 60)) + ':' + pad(left % 60)) + '</div><div class="sm" style="color:#8F8D88;text-align:center">' + status + '</div></div>' +
    '<div class="grid2">' +
      (state === 'idle' || state === 'dead' ? '<button class="btn" data-a="focusStart" style="height:56px;background:#6FCF97;color:#10140F;font-size:16px;font-weight:800">' + (state === 'dead' ? 'Start next' : 'Start focus') + '</button>' :
        state === 'done' ? '<button class="btn" data-a="focusFinish" style="height:56px;background:#6FCF97;color:#10140F;font-size:16px;font-weight:800">Finish &amp; log</button>' :
        '<button class="btn" data-a="focusPause" style="height:56px;background:#2A2A2D;color:#F2F1EE;font-size:16px;font-weight:800">' + (state === 'paused' ? 'Resume' : 'Pause') + '</button>') +
      '<button class="btn" data-a="focusGiveUp" style="height:56px;background:transparent;color:#F2F1EE;border:1px solid rgba(255,255,255,.18)"' + (state === 'running' || state === 'paused' ? '' : ' disabled') + '>Give up</button></div>' +
    (r ? '' : '<div class="row" style="justify-content:center;gap:6px">' + [25, 50, 90].map((m) => '<button class="chip" data-a="focusLen" data-v="' + m + '" style="background:' + (ui.focusLen === m ? '#F2F1EE' : 'transparent') + ';color:' + (ui.focusLen === m ? '#10140F' : '#F2F1EE') + ';border-color:rgba(255,255,255,.2)">' + m + ' min</button>').join('') + '</div><div class="chips" style="justify-content:center">' + catChips + '</div>') +
    '<div class="small" style="color:#8F8D88;text-align:center;line-height:1.5">Keep the phone face down. Locking the screen is fine — the timer keeps running.<br>Give up and the plant wilts (finished minutes still count).</div>' +
    '<section style="background:#1C211B;border-radius:20px;padding:16px;display:flex;flex-direction:column;gap:12px"><div class="row between" style="align-items:baseline"><h2>Focus score today</h2><span class="small" style="color:#8F8D88">focused ÷ planned focus time</span></div>' +
      '<div class="row" style="gap:16px"><div style="font-size:44px;font-weight:800;color:#6FCF97;line-height:1">' + FS.score + '</div><div class="grow col" style="gap:6px"><div style="height:8px;background:rgba(255,255,255,.08);border-radius:4px"><i style="display:block;height:8px;width:' + Math.min(100, FS.score) + '%;background:#6FCF97;border-radius:4px"></i></div><div class="small" style="color:#B5B2AB">' + FS.done + ' of ' + FS.pl + ' min planned focus · ' + FS.wilted + ' wilted</div></div></div>' +
      '<div class="small b" style="color:#8F8D88">TODAY\'S GARDEN</div><div class="row wrap" style="gap:8px">' + (f.length ? f.map((s) => '<div title="' + esc(s.label) + '" style="width:52px;height:60px;border-radius:12px;background:rgba(255,255,255,.05);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px">' + miniPlant(s.ok) + '<span style="font-size:10px;color:#8F8D88">' + s.min + 'm</span></div>').join('') : '<span class="sm" style="color:#8F8D88">Finish a session to grow your first plant.</span>') + '</div></section>' +
    '<section style="background:#1C211B;border-radius:20px;padding:16px;display:flex;flex-direction:column;gap:10px"><div class="row between" style="align-items:baseline"><h2>This week</h2><span class="small" style="color:#8F8D88">' + fmtDur(wMin.reduce((a, b) => a + b, 0)) + ' focused</span></div>' +
      '<div class="row" style="align-items:flex-end;gap:6px;height:96px">' + wk.map((x, i) => '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px"><i style="display:block;width:100%;max-width:30px;height:' + Math.max(3, wMin[i] / wMax * 76) + 'px;border-radius:6px;background:' + (x === k ? '#6FCF97' : wMin[i] ? 'rgba(111,207,151,.45)' : 'rgba(255,255,255,.08)') + '"></i><span class="small b" style="color:' + (x === k ? '#F2F1EE' : '#8F8D88') + '">' + DOW[parseD(x).getDay()][0] + '</span></div>').join('') + '</div>' +
      '<div class="row wrap small" style="gap:10px;color:#B5B2AB">' + (Object.entries(byCat).map(([c, m]) => '<span><b style="color:var(--' + colorKey(c) + '-fg)">' + esc(CAT[c] || c) + '</b> ' + fmtDur(m) + '</span>').join('') || 'No sessions yet this week.') + '</div></section></div>';
}
function focusLog(min, ok) {
  const r = db.focusRun; if (!r) return; const k = nowInfo().k; const dd = day(k);
  if (min >= 1) { dd.focus = dd.focus || []; dd.focus.push({ s: r.start, min: Math.round(min), cat: r.cat, label: r.label, ok }); dd.time[r.cat] = (dd.time[r.cat] || 0) + Math.round(min); dd.log.push({ s: r.start, e: Date.now(), c: r.cat, l: r.label }); }
  db.focusRun = null;
}

/* ========================== GOALS ========================== */
const GOAL_KINDS = [['habit', 'Days of a habit'], ['num', 'A number I update'], ['books', 'Books finished'], ['wpm', 'Typing speed (WPM)'], ['deadlines', 'Calendar deadlines']];
function goalHabits() { return [['read', habitName('read')], ['type', habitName('type')], ['talk', habitName('talk')], ['hyg', habitName('hyg')]].concat(customHabits().map((c) => ['c:' + c.id, c.name])); }
function habitTest(id) {
  if (id && id.startsWith('c:')) { const c = (db.habits.custom || []).find((x) => 'c:' + x.id === id); if (c) return customTest(c); }
  if (id === 'hyg') return (k) => { const d = parseD(k).getDay(); return (d === 1 || d === 4) ? !!peekDay(k).h.hyg : null; };
  return (k) => !!peekDay(k).h[id];
}
function goalNow(g) {
  if (g.kind === 'num') return num(g.now, num(g.from));
  if (g.kind === 'books') return db.habits.finished.filter((f) => (f.d || '') >= g.start).length;
  if (g.kind === 'wpm') { const t = db.habits.typing.filter((x) => x.d >= g.start).map((x) => num(x.wpm)); return t.length ? Math.max(...t) : num(g.from); }
  if (g.kind === 'deadlines') return (db.cal || []).reduce((a, e) => a + (e.k === 'deadline' && (!g.proj || e.p === g.proj) ? Object.keys(e.doneOn || {}).filter((d) => d >= g.start).length : 0), 0);
  if (g.kind === 'habit') { const t = habitTest(g.habit); let n = 0; for (let k = g.start; k <= nowInfo().k; k = addD(k, 1)) if (t(k) === true) n++; return n; }
  return 0;
}
function goalInfo(g) {
  const nk = nowInfo().k; const now = goalNow(g); const from = ['num', 'wpm'].includes(g.kind) ? num(g.from) : 0; const target = num(g.target, 1);
  const prog = clamp((now - from) / Math.max(1e-9, target - from), 0, 1);
  const span = Math.max(1, diffD(g.start, g.end)); const exp = clamp(diffD(g.start, nk) / span, 0, 1);
  const done = now >= target; const ahead = done || prog >= exp - 0.03; const leftD = diffD(nk, g.end);
  const weeks = Math.max(1 / 7, leftD / 7); const need = (target - now) / weeks;
  const unit = g.unit || { habit: 'days', books: 'books', wpm: 'WPM', deadlines: 'deadlines', num: '' }[g.kind];
  const pace = done ? 'Goal reached!' : leftD < 0 ? 'Deadline passed — extend it or close the goal.' : (ahead ? 'Ahead of pace. ' : 'Behind pace. ') + 'Need ' + (need < 10 && need % 1 ? need.toFixed(1) : Math.ceil(need)) + ' ' + unit + '/week.';
  return { now, target, prog, exp, ahead, done, leftD, pace, unit };
}
function goalsMini() {
  const G = db.goals.filter((g) => !g.archived);
  return '<a href="#goals" class="card tight"><div class="head"><h2>Goals</h2><span class="link">Open ›</span></div>' +
    (G.length ? G.slice(0, 3).map((g) => { const I = goalInfo(g); return '<div class="col" style="gap:4px"><div class="row between sm"><span class="b">' + esc(g.t) + '</span><span class="small b" style="color:' + (I.ahead ? 'var(--good-fg)' : 'var(--warn-fg)') + '">' + (I.done ? 'DONE' : I.ahead ? 'ON TRACK' : 'BEHIND') + '</span></div><div style="height:6px;background:var(--soft);border-radius:3px;position:relative"><i style="position:absolute;left:0;top:0;bottom:0;width:' + (I.prog * 100).toFixed(1) + '%;background:' + (g.c || 'var(--doc)') + ';border-radius:3px"></i><i style="position:absolute;top:-2px;bottom:-2px;left:' + (I.exp * 100).toFixed(1) + '%;width:2px;background:var(--ink)"></i></div></div>'; }).join('') : '<div class="sm muted">Link a goal to a habit — e.g. "Type 60 WPM by March".</div>') + '</a>';
}
const GOAL_COLORS = ['#8B63C9', '#3F86C4', '#C2557F', '#3E8E5E', '#C26A1F', '#0F766E'];
function vGoals() {
  const G = db.goals.filter((g) => !g.archived); let on = 0, be = 0; const info = G.map((g) => { const I = goalInfo(g); if (I.ahead) on++; else be++; return I; });
  const cards = G.map((g, gi) => {
    const I = info[gi]; const H = g.kind === 'habit' && g.habit ? g.habit : g.kind === 'wpm' ? 'type' : g.kind === 'books' ? 'read' : g.link;
    const ht = H ? habitTest(H) : null;
    return '<section class="card" style="border-left:6px solid ' + g.c + '"><div class="row between" style="align-items:flex-start"><button class="tap" data-a="goalEdit" data-id="' + g.id + '" style="width:auto;flex:1;min-width:0"><div class="xb" style="font-size:17px;line-height:1.25">' + esc(g.t) + '</div><div class="small muted">by ' + nice(g.end) + ' · ' + (I.leftD >= 0 ? I.leftD + ' days left' : 'past due') + '</div></button><span class="pill" style="background:var(--' + (I.done ? 'good' : I.ahead ? 'good' : 'warn') + '-bg);color:var(--' + (I.done || I.ahead ? 'good' : 'warn') + '-fg)">' + (I.done ? 'DONE' : I.ahead ? 'ON TRACK' : 'BEHIND') + '</span></div>' +
      '<div class="row" style="align-items:baseline;gap:6px"><span class="xb" style="font-size:28px">' + (Math.round(I.now * 10) / 10).toLocaleString() + '</span><span class="sm muted b">/ ' + I.target.toLocaleString() + ' ' + esc(I.unit) + '</span><span class="sm xb" style="margin-left:auto">' + Math.round(I.prog * 100) + '%</span></div>' +
      '<div style="height:10px;background:var(--soft);border-radius:5px;position:relative"><i style="position:absolute;left:0;top:0;bottom:0;width:' + (I.prog * 100).toFixed(1) + '%;background:' + g.c + ';border-radius:5px"></i><i title="where you should be today" style="position:absolute;top:-3px;bottom:-3px;left:' + (I.exp * 100).toFixed(1) + '%;width:2px;background:var(--ink)"></i></div><div class="small muted">' + I.pace + '</div>' +
      (H ? '<button class="tap row" data-a="hstatsOpen" data-id="' + H + '" style="background:var(--soft);border-radius:12px;padding:8px 10px;gap:8px"><span style="color:var(--warn)">' + ic('flame', 16, 2.4) + '</span><span class="grow sm"><b>' + esc(habitName(H) || H) + '</b> · ' + streak(ht) + '-day chain</span><span class="small b" style="color:var(--doc)">Stats ›</span></button>' : '') +
      (g.kind === 'num' ? '<div class="row"><label class="sr" for="gn' + g.id + '">Update</label><input id="gn' + g.id + '" type="number" inputmode="decimal" class="in big grow" value="' + esc(g.now == null ? '' : g.now) + '" data-c="goalNow" data-id="' + g.id + '"><span class="small muted">update any time</span></div>' : '') + '</section>';
  }).join('');
  return backHead('Goals', 'Each goal is fed by a daily habit', 'habits') +
    '<section class="hero" style="display:grid;grid-template-columns:repeat(3,1fr);text-align:center;gap:8px"><div><div class="xb" style="font-size:24px">' + on + '</div><div class="small" style="color:var(--heroMuted)">on track</div></div><div><div class="xb" style="font-size:24px;color:#F4BF94">' + be + '</div><div class="small" style="color:var(--heroMuted)">behind</div></div><div><div class="xb" style="font-size:24px">' + G.length + '</div><div class="small" style="color:var(--heroMuted)">active goals</div></div></section>' +
    (cards || '<section class="card">' + empty('No goals yet. Add one below — the black tick on each bar shows where you should be today.') + '</section>') +
    '<button class="btn full" data-a="goalNew">+ New goal</button>' +
    ((db.goals.filter((g) => g.archived).length) ? '<details class="card tight"><summary class="muted">Closed goals (' + db.goals.filter((g) => g.archived).length + ')</summary>' + db.goals.filter((g) => g.archived).map((g) => '<div class="list-row"><span class="grow sm">' + esc(g.t) + '</span><button class="link" data-a="goalReopen" data-id="' + g.id + '">Reopen</button></div>').join('') + '</details>' : '');
}
function goalSheet(g) {
  const nk = nowInfo().k; const isNew = !g;
  g = g || { t: '', kind: 'habit', target: '', from: '', start: nk, end: addD(nk, 90), habit: 'type', proj: '', unit: '' };
  const habs = goalHabits();
  const help = { habit: 'Counts the days you complete the linked habit from today.', num: 'You type the latest number (followers, savings…). The app shows your pace.', books: 'Counts books you mark finished in Habits → Reading.', wpm: 'Uses your best typing session (Habits → Typing).', deadlines: 'Counts calendar deadlines you tick done (optionally one project).' };
  return '<h2>' + (isNew ? 'New goal' : 'Edit goal') + '</h2><label class="f">Goal<input id="gt" class="in" value="' + esc(g.t) + '" placeholder="e.g. Type 60 WPM"></label>' +
    '<div class="small b muted">How is progress measured?</div><div class="chips" id="gk">' + GOAL_KINDS.map(([v, l]) => '<button class="chip' + (g.kind === v ? ' on' : '') + '" data-a="goalKind" data-v="' + v + '">' + l + '</button>').join('') + '</div><div class="small muted" id="gkhelp">' + help[g.kind] + '</div>' +
    '<div id="ghab"' + (g.kind === 'habit' ? '' : ' hidden') + '><div class="small b muted" style="margin-bottom:6px">Fed by habit</div><div class="chips" id="gh">' + habs.map(([id, n]) => '<button class="chip' + (g.habit === id ? ' on' : '') + '" data-a="pickChip" data-group="gh" data-v="' + id + '">' + esc(n) + '</button>').join('') + '</div></div>' +
    '<div id="gproj"' + (g.kind === 'deadlines' ? '' : ' hidden') + '><div class="small b muted" style="margin-bottom:6px">Project (optional)</div><div class="chips" id="gp">' + [['', 'Any']].concat(PROJ).map(([v, l]) => '<button class="chip' + ((g.proj || '') === v ? ' on' : '') + '" data-a="pickChip" data-group="gp" data-v="' + v + '">' + esc(l) + '</button>').join('') + catAddBtn('proj', 'gp') + '</div></div>' +
    '<div class="grid2"><label class="f" id="gfromw"' + (['num', 'wpm'].includes(g.kind) ? '' : ' hidden') + '>Starting from<input id="gfrom" type="number" inputmode="decimal" class="in" value="' + esc(g.from) + '" placeholder="e.g. 34"></label><label class="f">Target<input id="gtar" type="number" inputmode="decimal" class="in" value="' + esc(g.target) + '" placeholder="e.g. 60"></label></div>' +
    '<div class="grid2"><label class="f">Start<input id="gs" type="date" class="in" value="' + esc(g.start) + '"></label><label class="f">By<input id="ge" type="date" class="in" value="' + esc(g.end) + '"></label></div>' +
    '<label class="f" id="gunitw"' + (g.kind === 'num' ? '' : ' hidden') + '>Unit (optional)<input id="gu" class="in" value="' + esc(g.unit || '') + '" placeholder="followers, $, km…"></label>' +
    '<button class="btn full" data-a="goalSave" data-id="' + (g.id || '') + '">Save goal</button>' +
    (isNew ? '' : '<button class="btn ghost full" data-a="goalClose" data-id="' + g.id + '">Close goal (keeps history)</button><button class="btn ghost full" data-a="goalDel" data-id="' + g.id + '" style="color:var(--bad)">Delete goal</button>') +
    '<button class="btn ghost full" data-a="sheetClose">Cancel</button>';
}

/* ========================== HABIT STATS ========================== */
function vHabitStats() {
  const id = ui.hs || 'type'; const t = habitTest(id); const nk = nowInfo().k; const name = habitName(id) || 'Habit';
  const c = id.startsWith('c:') ? (db.habits.custom || []).find((x) => 'c:' + x.id === id) : null;
  const sched = c ? daysLabel(c.days) : id === 'hyg' ? 'Mon & Thu' : 'Every day';
  const col = { read: ['var(--doc)', 'var(--doc-bg)'], type: ['var(--study)', 'var(--study-bg)'], talk: ['var(--tent)', 'var(--tent-bg)'] }[id] || ['var(--good)', 'var(--good-bg)'];
  // 26 weeks, Monday-aligned
  const mon = addD(nk, -((parseD(nk).getDay() + 6) % 7)); const start = addD(mon, -25 * 7);
  const firstData = Object.keys(db.days).sort()[0] || nk; const since = c && c.start && c.start > firstData ? c.start : firstData; // don't count days before you used the app
  let done = 0, schedN = 0, made = 0; const cells = []; const dowDone = [0, 0, 0, 0, 0, 0, 0], dowSch = [0, 0, 0, 0, 0, 0, 0];
  for (let i = 0; i < 26 * 7; i++) {
    const k = addD(start, i); const fut = k > nk || k < since; const r = fut ? null : t(k); const dw = parseD(k).getDay();
    let bg = 'transparent', tl = '';
    if (!fut) {
      if (r === null) { bg = 'var(--rest-bg)'; tl = 'Rest day'; }
      else { schedN++; dowSch[dw]++; if (r) { done++; dowDone[dw]++; const mu = !!(peekDay(k).mk || {})[id]; if (mu) { made++; bg = '#F6D365'; tl = 'Made up 2×'; } else { bg = col[0]; tl = 'Done'; } } else { bg = 'var(--soft)'; tl = 'Missed'; } }
    }
    cells.push('<i title="' + nice(k) + (tl ? ' · ' + tl : '') + '" style="display:block;width:10px;height:10px;border-radius:2px;background:' + bg + (k === nk ? ';outline:1.5px solid var(--ink)' : '') + '"></i>');
  }
  const comp = schedN ? Math.round(done / schedN * 100) : 0;
  const order = [1, 2, 3, 4, 5, 6, 0]; const rates = order.map((d) => dowSch[d] ? dowDone[d] / dowSch[d] : null);
  const valid = rates.map((r, i) => [r, i]).filter(([r]) => r !== null && dowSch[order[0]] !== undefined);
  const bestI = valid.length ? valid.reduce((a, b) => b[0] > a[0] ? b : a)[1] : -1; const worstI = valid.length ? valid.reduce((a, b) => b[0] < a[0] ? b : a)[1] : -1;
  const months = [...Array(6)].map((_, i) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 5 + i); const ym = d.getFullYear() + '-' + pad(d.getMonth() + 1); let s = 0, n = 0; const dim = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate(); for (let j = 1; j <= dim; j++) { const k = ym + '-' + pad(j); if (k > nk) break; if (k < since) continue; const r = t(k); if (r === null) continue; n++; if (r) s++; } return [MON[d.getMonth()], n ? s / n : null]; });
  const pts = months.map(([, v], i) => v === null ? null : [(i * 340 / 5 + 7).toFixed(1), (90 - v * 80).toFixed(1)]).filter(Boolean);
  const goals = db.goals.filter((g) => !g.archived && (g.habit === id || (g.kind === 'wpm' && id === 'type') || (g.kind === 'books' && id === 'read')));
  const tiles = [['Current chain', streak(t) + ' days', 'one miss allowed', 'var(--warn)'], ['Best chain', best(t) + ' days', 'all time', 'var(--ink)'], ['Completion', comp + '%', 'since ' + nice(since > start ? since : start), col[0]], ['Total done', done + '', made + ' made up with 2×', 'var(--ink)']];
  const tabs = goalHabits();
  return backHead(name, sched, 'habits') +
    '<div class="scroll-x">' + tabs.map(([hid, n]) => '<button class="chip' + (hid === id ? ' on' : '') + '" data-a="hstatsOpen" data-id="' + hid + '">' + esc(n.length > 18 ? n.slice(0, 16) + '…' : n) + '</button>').join('') + '</div>' +
    '<section class="grid2">' + tiles.map(([l, v, s2, c2]) => '<div class="kpi"><span class="small muted b">' + l + '</span><b style="color:' + c2 + '">' + v + '</b><span class="small muted">' + s2 + '</span></div>').join('') + '</section>' +
    '<section class="card tight" style="padding:14px 12px"><div class="head" style="padding:0 2px"><h2 style="font-size:16px">Last 26 weeks</h2><span class="small muted">' + done + ' days done</span></div><div class="row" style="gap:6px;align-items:flex-start;overflow-x:auto"><div style="display:grid;grid-template-rows:repeat(7,10px);gap:2px;font-size:9px;line-height:10px" class="b muted"><span>M</span><span></span><span>W</span><span></span><span>F</span><span></span><span>S</span></div><div style="display:grid;grid-auto-flow:column;grid-template-rows:repeat(7,10px);grid-auto-columns:10px;gap:2px">' + cells.join('') + '</div></div>' +
      '<div class="row small muted" style="gap:6px;flex-wrap:wrap"><span>Missed</span><i style="width:10px;height:10px;border-radius:2px;background:var(--soft)"></i><i style="width:10px;height:10px;border-radius:2px;background:' + col[0] + '"></i><span>Done</span><i style="width:10px;height:10px;border-radius:2px;background:#F6D365"></i><span>Made up (2×)</span></div></section>' +
    '<section class="card tight"><div class="head"><h2 style="font-size:16px">Best day of the week</h2><span class="small muted">completion %</span></div><div class="row" style="align-items:flex-end;gap:8px;height:110px">' + order.map((d, i) => { const r = rates[i]; return '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px"><span style="font-size:10px" class="b muted">' + (r === null ? '—' : Math.round(r * 100) + '%') + '</span><i style="display:block;width:100%;height:' + (r === null ? 4 : Math.max(4, r * 80)) + 'px;border-radius:6px;background:' + (i === bestI ? col[0] : r === null ? 'var(--soft)' : col[1]) + '"></i><span class="small b">' + DOW[d][0] + '</span></div>'; }).join('') + '</div>' +
      (bestI >= 0 && worstI >= 0 && bestI !== worstI && schedN >= 21 ? '<div class="sm" style="background:var(--soft);border-radius:12px;padding:10px 12px;line-height:1.45">You do best on ' + DAYS_FULL[order[bestI]] + ' and slip on ' + DAYS_FULL[order[worstI]] + '. Try stacking it right after a fixed block that day.</div>' : '<div class="small muted">Keep logging for 3 weeks to see your best day.</div>') + '</section>' +
    '<section class="card tight"><div class="head"><h2 style="font-size:16px">Month by month</h2><span class="small muted">completion</span></div>' + (pts.length ? '<svg width="100%" height="100" viewBox="0 0 354 100" preserveAspectRatio="none" role="img" aria-label="Monthly completion"><line x1="0" y1="10" x2="354" y2="10" stroke="var(--soft)"/><line x1="0" y1="50" x2="354" y2="50" stroke="var(--soft)"/><line x1="0" y1="90" x2="354" y2="90" stroke="var(--soft)"/>' + (pts.length > 1 ? '<polyline points="' + pts.map((p) => p.join(',')).join(' ') + '" fill="none" stroke="' + col[0] + '" stroke-width="3" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>' : '') + pts.map((p) => '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="4" fill="' + col[0] + '"/>').join('') + '</svg>' : empty('No data yet.')) + '<div class="row between small b muted">' + months.map(([m]) => '<span>' + m + '</span>').join('') + '</div></section>' +
    (goals.length ? goals.map((g) => { const I = goalInfo(g); return '<a href="#goals" class="card tight" style="border-left:6px solid ' + g.c + '"><div class="row between"><span class="small xb muted">FEEDS GOAL</span><span class="link">Goals ›</span></div><div class="xb">' + esc(g.t) + '</div><div style="height:8px;background:var(--soft);border-radius:4px"><i style="display:block;height:8px;width:' + (I.prog * 100).toFixed(1) + '%;background:' + g.c + ';border-radius:4px"></i></div></a>'; }).join('') : '<button class="btn ghost full" data-a="goalNewFor" data-id="' + id + '">+ Link a goal to this habit</button>') +
    (c ? '<button class="btn ghost full" data-a="habitEdit" data-id="' + c.id + '">Edit habit</button>' : '');
}

/* ========================== WORKOUT ========================== */
const MUS = {
  front: [['shoulders', 'Shoulders', 'M44 46 Q38 50 36 64 L50 64 L54 48 Z M106 46 Q112 50 114 64 L100 64 L96 48 Z'], ['chest', 'Chest', 'M55 48 L95 48 L97 74 Q75 82 53 74 Z'], ['arms', 'Arms', 'M34 66 L48 66 L46 112 L32 112 Z M102 66 L116 66 L118 112 L104 112 Z'], ['core', 'Core', 'M56 78 Q75 86 94 78 L92 124 L58 124 Z'], ['quads', 'Quads', 'M56 128 L74 128 L72 182 L56 182 Z M76 128 L94 128 L94 182 L78 182 Z'], ['calves', 'Calves', 'M57 188 L71 188 L69 236 L59 236 Z M79 188 L93 188 L91 236 L81 236 Z']],
  back: [['shoulders', 'Rear shoulders', 'M44 46 Q38 50 36 64 L50 64 L54 48 Z M106 46 Q112 50 114 64 L100 64 L96 48 Z'], ['back', 'Upper back', 'M55 48 L95 48 L97 84 L53 84 Z'], ['arms', 'Triceps', 'M34 66 L48 66 L46 112 L32 112 Z M102 66 L116 66 L118 112 L104 112 Z'], ['lower', 'Lower back', 'M58 88 L92 88 L92 124 L58 124 Z'], ['glutes', 'Glutes & hamstrings', 'M56 128 L74 128 L72 182 L56 182 Z M76 128 L94 128 L94 182 L78 182 Z'], ['calves', 'Calves', 'M57 188 L71 188 L69 236 L59 236 Z M79 188 L93 188 L91 236 L81 236 Z']]
};
const MUS_NAME = { shoulders: 'Shoulders', chest: 'Chest', arms: 'Arms', core: 'Core', quads: 'Legs', calves: 'Calves', back: 'Back', lower: 'Lower back', glutes: 'Glutes' };
// exercise library: [name, type reps|time, amount, muscles]
const EXL = {
  pushup: ['Push-ups', 'reps', 12, ['chest', 'arms', 'shoulders']], kneepush: ['Knee push-ups', 'reps', 12, ['chest', 'arms']], pike: ['Pike push-ups', 'reps', 8, ['shoulders', 'arms']], dips: ['Chair dips', 'reps', 12, ['arms', 'chest']],
  taps: ['Plank shoulder taps', 'time', 30, ['core', 'shoulders']], squat: ['Squats', 'reps', 20, ['quads', 'glutes']], lunge: ['Lunges', 'reps', 12, ['quads', 'glutes']], bridge: ['Glute bridge', 'reps', 15, ['glutes', 'lower']],
  wallsit: ['Wall sit', 'time', 40, ['quads']], calf: ['Calf raises', 'reps', 20, ['calves']], burpee: ['Burpees', 'reps', 10, ['quads', 'chest', 'core']], climber: ['Mountain climbers', 'time', 30, ['core', 'shoulders', 'quads']],
  jacks: ['Jumping jacks', 'time', 30, ['calves', 'shoulders']], plank: ['Plank', 'time', 40, ['core']], sideplank: ['Side plank', 'time', 25, ['core']], deadbug: ['Dead bug', 'reps', 12, ['core']],
  crunch: ['Crunches', 'reps', 15, ['core']], superman: ['Superman', 'reps', 12, ['back', 'lower']], hip: ['Hip openers', 'time', 40, []], catcow: ['Cat-cow', 'time', 40, ['lower']], stretch: ['Hamstring stretch', 'time', 40, []], highknees: ['High knees', 'time', 30, ['quads', 'calves']]
};
const ROUT = [
  { id: 'r7', t: '7-min full body', area: 'full', lvl: 'Any level', rounds: 1, work: 30, rest: 5, ex: ['jacks', 'wallsit', 'pushup', 'crunch', 'squat', 'dips', 'plank', 'highknees', 'lunge', 'taps', 'sideplank', 'climber'] },
  { id: 'push', t: 'Push day', area: 'upper', lvl: 'Beginner+', rounds: 3, rest: 30, ex: ['pushup', 'pike', 'dips', 'taps'] },
  { id: 'legs', t: 'Leg burner', area: 'lower', lvl: 'Intermediate', rounds: 4, rest: 30, ex: ['squat', 'lunge', 'bridge', 'wallsit', 'calf'] },
  { id: 'core10', t: 'Core in 10', area: 'core', lvl: 'Any level', rounds: 2, rest: 15, ex: ['deadbug', 'plank', 'crunch', 'sideplank'] },
  { id: 'mob', t: 'Morning mobility', area: 'mobility', lvl: 'Easy', rounds: 1, rest: 5, ex: ['catcow', 'hip', 'stretch', 'superman'] },
  { id: 'hiit', t: 'HIIT burner', area: 'full', lvl: 'Intermediate', rounds: 4, rest: 20, ex: ['burpee', 'squat', 'pushup', 'climber', 'highknees'] },
  { id: 'upper', t: 'Upper strength', area: 'upper', lvl: 'Intermediate', rounds: 5, rest: 45, ex: ['pushup', 'pike', 'dips', 'superman', 'taps'] }
];
const AREAS = { full: ['Full body', 'work'], upper: ['Upper body', 'tent'], lower: ['Lower body', 'doc'], core: ['Core', 'study'], mobility: ['Mobility', 'pray'], rest: ['Rest', 'rest'] };
const AREA_ROUT = { full: 'r7', upper: 'push', lower: 'legs', core: 'core10', mobility: 'mob' };
const allRoutines = () => ROUT.concat((db.wo.custom || []));
const routineMin = (r) => { const per = r.ex.reduce((a, e) => { const x = EXL[e] || ['', 'reps', 10, []]; return a + (r.work || (x[1] === 'time' ? x[2] : x[2] * 3)) + (r.rest || 0); }, 0); return Math.max(5, Math.round(per * (r.rounds || 1) / 60)); };
const routineMuscles = (r) => [...new Set(r.ex.flatMap((e) => (EXL[e] || [0, 0, 0, []])[3]))];
function recovery() {
  const now = Date.now(); const rec = {}; Object.keys(MUS_NAME).forEach((m) => (rec[m] = 100));
  (db.wo.sessions || []).forEach((s) => { const h = (now - s.ts) / 36e5; if (h < 0 || h > 72) return; const f = (1 - h / 72) * (s.intensity || 1); (s.muscles || []).forEach((m) => { rec[m] = Math.max(0, rec[m] - f * 65); }); });
  Object.keys(rec).forEach((m) => (rec[m] = Math.round(rec[m]))); return rec;
}
const recCol = (p) => p >= 80 ? '#3E8E5E' : p >= 40 ? '#E3A33B' : '#C2410C';
function lastTrained(m) { const s = (db.wo.sessions || []).filter((x) => (x.muscles || []).includes(m)).sort((a, b) => b.ts - a.ts)[0]; return s ? nice(s.d) + ' · ' + s.title : 'not yet logged'; }
// weekly plan with adapting
function woWeek(k) {
  const wk = weekKeys(k); const P = db.wo.plan || {}; const O = db.wo.override || {};
  const planned = (x) => O[x] !== undefined ? O[x] : (P[parseD(x).getDay()] || 'rest');
  const doneOn = (x) => (db.wo.sessions || []).filter((s) => s.d === x);
  const days = wk.map((x) => { const a = planned(x); const ds = doneOn(x); return { k: x, area: a, done: ds.length > 0, sess: ds, missed: x < k && a !== 'rest' && !ds.length }; });
  return days;
}
function todaySuggestion(k) {
  const days = woWeek(k); const td = days.find((d) => d.k === k); const rec = recovery();
  const missed = days.filter((d) => d.missed && !(db.wo.madeUp || {})[d.k]);
  let area = td.area, why = '', from = null;
  if (td.done) return { area: td.area, done: true, why: 'done today', from };
  if (area === 'rest' && missed.length) { area = missed[missed.length - 1].area; from = missed[missed.length - 1].k; why = 'moved from ' + DOW[parseD(from).getDay()]; }
  if (area !== 'rest') {
    const ms = routineMuscles(ROUT.find((r) => r.id === AREA_ROUT[area]) || ROUT[0]); const low = ms.filter((m) => rec[m] < 40);
    if (low.length) { const alt = ['core', 'lower', 'upper', 'mobility', 'full'].find((a) => routineMuscles(ROUT.find((r) => r.id === AREA_ROUT[a])).every((m) => rec[m] >= 60)) || 'mobility'; why = (MUS_NAME[low[0]] || 'Muscles') + ' still tired — switched to ' + AREAS[alt][0]; area = alt; }
    else if (!why) why = (ms.length ? ms.slice(0, 2).map((m) => MUS_NAME[m]).join(' & ') + ' are fresh' : 'easy day');
  }
  if (ui.woSwap && ui.woSwap.k === k) { area = ui.woSwap.area; why = 'you swapped it'; }
  return { area, why, from, done: false };
}
const PRDEF = [['push', 'Push-ups in one set', 'reps'], ['plank', 'Longest plank', 'sec'], ['squat', 'Squats in one set', 'reps'], ['burpee', 'Burpees in 5 min', 'reps']];
const fmtPR = (id, v) => { const d = PRDEF.find((p) => p[0] === id); return d && d[2] === 'sec' ? Math.floor(v / 60) + ':' + pad(v % 60) : String(v); };
const LADDERS = {
  push: { label: 'Push-up', steps: [['Wall push-up', 20], ['Knee push-up', 15], ['Push-up', 15], ['Diamond push-up', 12], ['Archer push-up', 8], ['One-arm push-up', 1]] },
  squat: { label: 'Squat', steps: [['Assisted squat', 20], ['Bodyweight squat', 25], ['Split squat', 12], ['Bulgarian split squat', 10], ['Shrimp squat', 5], ['Pistol squat', 1]] },
  core: { label: 'Core', steps: [['Dead bug', 12], ['Plank (sec)', 45], ['Side plank (sec)', 30], ['Hollow hold (sec)', 30], ['Tucked L-sit (sec)', 10], ['L-sit (sec)', 10]] }
};
function hwSeg(on) { return '<div class="seg" role="tablist"><a href="#health" class="' + (on === 'health' ? 'on' : '') + '" role="tab" aria-selected="' + (on === 'health') + '" style="height:38px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600;color:' + (on === 'health' ? 'var(--ink)' : 'var(--muted)') + ';background:' + (on === 'health' ? 'var(--card)' : 'transparent') + '">Health</a><a href="#workout" class="' + (on === 'workout' ? 'on' : '') + '" role="tab" aria-selected="' + (on === 'workout') + '" style="height:38px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:600;color:' + (on === 'workout' ? 'var(--ink)' : 'var(--muted)') + ';background:' + (on === 'workout' ? 'var(--card)' : 'transparent') + '">Workout</a></div>'; }
ui.woSide = 'front'; ui.woM = null; ui.woLad = 'push'; ui.woT = 'all'; ui.woA = 'all';
function vWorkout() {
  const k = nowInfo().k; const days = woWeek(k); const sug = todaySuggestion(k); const rec = recovery();
  const sel = ui.woDay || k; const sd = days.find((d) => d.k === sel) || days.find((d) => d.k === k);
  const doneW = days.filter((d) => d.done).length, planW = days.filter((d) => d.area !== 'rest').length;
  const week = days.map((d) => {
    const isT = d.k === k, isS = d.k === sel; const a = d.k === k && !d.done ? sug.area : d.area;
    const dot = d.done ? '#3E8E5E' : d.missed ? '#C2410C' : isT ? 'var(--ink)' : a === 'rest' ? 'var(--line2)' : '#A6DDB7';
    const mark = d.done ? '✓' : d.missed ? '→' : a === 'rest' ? '–' : isT ? '•' : '';
    return '<button data-a="woDay" data-k="' + d.k + '" aria-pressed="' + isS + '" aria-label="' + nice(d.k) + ': ' + AREAS[a][0] + (d.done ? ', done' : d.missed ? ', missed' : '') + '" style="height:78px;border-radius:14px;border:2px solid ' + (isS ? 'var(--ink)' : isT ? 'var(--warn)' : 'var(--line)') + ';background:' + (isS ? 'var(--soft)' : 'var(--card)') + ';cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;padding:0;color:var(--ink)"><span class="small b">' + DOW[parseD(d.k).getDay()] + '</span><span style="width:26px;height:26px;border-radius:13px;background:' + dot + ';color:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800">' + mark + '</span><span style="font-size:9.5px;font-weight:700;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:0 2px' + (a === 'rest' ? ';color:var(--muted)' : '') + '">' + AREAS[a][0].split(' ')[0] + '</span></button>';
  }).join('');
  const missedNote = days.filter((d) => d.missed && !(db.wo.madeUp || {})[d.k]);
  // selected day card
  const isToday = sd.k === k; const area = isToday ? sug.area : sd.area; const R = ROUT.find((r) => r.id === AREA_ROUT[area]);
  const head = (isToday ? 'TODAY · ' : sd.missed ? 'MISSED · ' : sd.done ? 'DONE · ' : '') + DOW[parseD(sd.k).getDay()].toUpperCase();
  const card = '<div class="hero" style="flex-direction:column;align-items:stretch;gap:8px"><div class="row between small b" style="color:var(--heroMuted)"><span>' + head + '</span><span>' + (isToday && sug.why ? 'why: ' + esc(sug.why) : '') + '</span></div>' +
    (sd.done ? '<div class="xb" style="font-size:20px">' + sd.sess.map((s) => esc(s.title) + ' · ' + s.min + ' min').join(', ') + '</div>' :
      area === 'rest' ? '<div class="xb" style="font-size:20px">Rest day</div><div class="sm" style="color:var(--heroMuted)">Recovery is when muscles grow. A walk or Morning mobility is fine.</div>' :
      '<div class="xb" style="font-size:20px">' + AREAS[area][0] + (isToday && sug.from ? ' (moved from ' + DOW[parseD(sug.from).getDay()] + ')' : '') + '</div><div class="sm" style="color:var(--heroMuted)">' + routineMin(R) + ' min · ' + R.ex.map((e) => EXL[e][0]).slice(0, 4).join(' · ') + ' · ' + R.rounds + ' round' + (R.rounds === 1 ? '' : 's') + '</div>') +
    (isToday && !sd.done ? '<div style="display:grid;grid-template-columns:2fr 1fr 1fr;gap:6px;padding-top:4px"><button class="btn" data-a="woStart" data-id="' + (R ? R.id : 'mob') + '" data-from="' + (sug.from || '') + '" style="background:#6FCF97;color:#10140F">Start · ' + routineMin(R || ROUT[4]) + ' min</button><button class="btn" data-a="woSwap" style="background:transparent;color:var(--heroInk);border:1px solid rgba(255,255,255,.25)">Swap</button><button class="btn" data-a="woMove" style="background:transparent;color:var(--heroInk);border:1px solid rgba(255,255,255,.25)">Move</button></div>' : '') + '</div>';
  // recovery map
  const ms = MUS[ui.woSide]; const mSel = ui.woM && ms.some((m) => m[0] === ui.woM) ? ui.woM : ms.slice().sort((a, b) => rec[a[0]] - rec[b[0]])[0][0];
  const mObj = ms.find((m) => m[0] === mSel); const mp = rec[mSel];
  const body = '<svg width="150" height="250" viewBox="0 0 150 250" role="img" aria-label="Body recovery map" style="flex:0 0 150px"><circle cx="75" cy="20" r="15" fill="var(--line)"/><rect x="68" y="34" width="14" height="10" rx="4" fill="var(--line)"/>' + ms.map(([id, n, d]) => '<path d="' + d + '" fill="' + recCol(rec[id]) + '" stroke="' + (id === mSel ? 'var(--ink)' : 'var(--card)') + '" stroke-width="' + (id === mSel ? 2.5 : 1.5) + '" data-a="woMuscle" data-v="' + id + '" style="cursor:pointer"><title>' + n + ' ' + rec[id] + '%</title></path>').join('') + '</svg>';
  // PRs
  const prs = PRDEF.map(([id, l, u]) => { const P = (db.wo.prs || {})[id]; const hist = P ? P.hist || [] : []; const v = P ? P.v : null; const isNew = P && diffD(P.d, k) <= 3 && hist.length > 1;
    const sp = hist.length > 1 ? (() => { const vs = hist.slice(-8).map((h) => h.v); const mx = Math.max(...vs), mn = Math.min(...vs); return '<svg width="100%" height="26" viewBox="0 0 140 26" preserveAspectRatio="none" aria-hidden="true"><polyline points="' + vs.map((x, i) => (i * 140 / (vs.length - 1)).toFixed(1) + ',' + (22 - (x - mn) / Math.max(1, mx - mn) * 18).toFixed(1)).join(' ') + '" fill="none" stroke="var(--good)" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>'; })() : '';
    return '<div class="kpi" style="' + (isNew ? 'border-color:#F6D365' : '') + '"><div class="row between"><span class="small b muted">' + l + '</span>' + (isNew ? '<span style="font-size:10px;font-weight:800;background:#F6D365;color:#5C4A0F;padding:2px 6px;border-radius:6px;white-space:nowrap">NEW PR</span>' : '') + '</div><b>' + (v == null ? '—' : fmtPR(id, v)) + '</b><span class="small muted">' + (P ? nice(P.d) : 'not tested yet') + '</span>' + sp + '</div>'; }).join('');
  // ladder
  const L = LADDERS[ui.woLad]; const lvl = clamp((db.wo.ladders || {})[ui.woLad] || 0, 0, L.steps.length - 1); const log = ((db.wo.ladderLog || {})[ui.woLad] || []);
  const tgt = L.steps[lvl][1]; const good = log.filter((x) => num(x) >= tgt).length;
  const ladder = L.steps.map(([n, tg], i) => { const done = i < lvl, cur = i === lvl, last = i === L.steps.length - 1;
    return '<div class="row" style="gap:12px;align-items:stretch"><div style="width:30px;flex:0 0 30px;display:flex;flex-direction:column;align-items:center"><span style="width:28px;height:28px;border-radius:14px;background:' + (done ? 'var(--good)' : cur ? 'var(--btn)' : 'var(--card)') + ';border:2px solid ' + (done ? 'var(--good)' : cur ? 'var(--btn)' : 'var(--line2)') + ';color:' + (done ? '#fff' : cur ? 'var(--btnInk)' : 'var(--muted)') + ';display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800">' + (done ? '✓' : i + 1) + '</span><i style="flex:1 1 auto;width:2px;min-height:12px;background:' + (last ? 'transparent' : done ? 'var(--good)' : 'var(--line)') + '"></i></div>' +
      '<div class="grow" style="padding-bottom:12px;min-width:0"><div style="font-size:15px;font-weight:' + (cur ? 800 : 600) + ';color:' + (done || cur ? 'var(--ink)' : 'var(--muted)') + '">' + n + '</div><div class="small muted">' + (done ? 'Mastered · ' : cur ? 'Current · ' : 'Locked · ') + '3 × ' + tg + (/sec/.test(n) ? ' s' : '') + '</div>' +
      (cur ? '<div style="margin-top:8px;background:var(--soft);border-radius:12px;padding:10px;display:flex;flex-direction:column;gap:8px"><div class="row between small b"><span>To unlock next: 3 sets of ' + tgt + '</span><span>' + good + ' of 3</span></div><div style="height:8px;background:var(--line);border-radius:4px"><i style="display:block;height:8px;width:' + (good / 3 * 100) + '%;background:var(--good);border-radius:4px"></i></div>' +
        '<div class="row" style="gap:6px">' + [0, 1, 2].map((j) => '<label class="sr" for="ls' + j + '">Set ' + (j + 1) + '</label><input id="ls' + j + '" type="number" inputmode="numeric" class="in" placeholder="set ' + (j + 1) + '" value="' + esc(log[j] == null ? '' : log[j]) + '" style="height:40px;text-align:center;font-weight:800;padding:0 4px">').join('') + '<button class="btn sm" data-a="woLadderLog">Save</button></div>' +
        (good >= 3 && !last ? '<button class="btn sm" data-a="woLevelUp" style="background:var(--good);color:#fff">Unlock ' + esc(L.steps[lvl + 1][0]) + ' ›</button>' : '<div class="small muted">Log your 3 sets from today. Hit the target on all three to unlock the next step.</div>') + '</div>' : '') + '</div></div>'; }).join('');
  // routines
  const list = allRoutines().filter((r) => { const m = routineMin(r); return (ui.woT === 'all' || (ui.woT === '30' ? m >= 30 : m <= +ui.woT)) && (ui.woA === 'all' || r.area === ui.woA); });
  const routines = list.map((r) => { const mm = routineMuscles(r); const low = mm.filter((m) => rec[m] < 40); const A = AREAS[r.area] || AREAS.full;
    return '<div class="list-row" style="min-height:72px;gap:12px"><div style="width:52px;height:52px;flex:0 0 52px;border-radius:14px;background:var(--' + A[1] + '-bg);color:var(--' + A[1] + '-fg);display:flex;flex-direction:column;align-items:center;justify-content:center"><span class="xb" style="font-size:17px;line-height:1">' + routineMin(r) + '</span><span style="font-size:10px;font-weight:700">min</span></div><div class="grow"><div class="b" style="font-size:15px">' + esc(r.t) + '</div><div class="small muted">' + A[0] + ' · ' + r.ex.length + ' exercises · ' + (r.lvl || 'Custom') + '</div><div class="small b" style="color:' + (low.length ? 'var(--warn)' : 'var(--good-fg)') + '">' + (low.length ? MUS_NAME[low[0]] + ' still tired — maybe tomorrow' : mm.length ? 'Good to go today' : 'Great on rest days') + '</div></div><button class="iconbtn" data-a="woStart" data-id="' + r.id + '" aria-label="Start ' + esc(r.t) + '" style="background:var(--btn);color:var(--btnInk);border:0">' + ic('play', 16) + '</button></div>'; }).join('');
  const recent = (db.wo.sessions || []).slice(-3).reverse();
  return '<header class="row between" style="align-items:baseline"><h1>Workout</h1><div class="sm muted">' + nice(k) + '</div></header>' + hwSeg('workout') +
    '<section class="card"><div class="head"><h2>This week</h2><span class="sm muted">' + doneW + ' of ' + planW + ' done</span></div><div style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px">' + week + '</div>' +
      (missedNote.length && !days.find((d) => d.k === k).done ? '<div class="sm" style="background:var(--warn-bg);color:var(--warn-fg);border-radius:12px;padding:10px 12px;line-height:1.45"><b>Plan adjusted:</b> you missed ' + missedNote.map((d) => DOW[parseD(d.k).getDay()] + '\'s ' + AREAS[d.area][0]).join(' and ') + (sug.from ? ', so it moved to today.' : '. Fit it in on a rest day, or let it go.') + '</div>' : '') + card +
      '<details style="border-top:1px solid var(--line);padding-top:6px"><summary>Edit weekly plan</summary><div class="col" style="margin-top:6px;gap:8px">' + DAYS_ORDER.map((d) => '<div class="row" style="gap:6px"><span class="b sm" style="width:36px">' + DOW[d] + '</span><div class="chips" style="flex-wrap:nowrap;overflow-x:auto">' + Object.keys(AREAS).map((a) => '<button class="chip' + (((db.wo.plan || {})[d] || 'rest') === a ? ' on' : '') + '" data-a="woPlan" data-d="' + d + '" data-v="' + a + '" style="height:32px;padding:0 10px;font-size:12px">' + AREAS[a][0].split(' ')[0] + '</button>').join('') + '</div></div>').join('') + '</div></details></section>' +
    '<section class="card"><div class="head"><h2>Recovery</h2><div class="row" style="gap:4px">' + [['front', 'Front'], ['back', 'Back']].map(([v, l]) => '<button class="chip' + (ui.woSide === v ? ' on' : '') + '" data-a="woSide" data-v="' + v + '" style="height:32px">' + l + '</button>').join('') + '</div></div>' +
      '<div class="row" style="gap:12px">' + body + '<div class="grow col" style="gap:8px;min-width:0"><div style="background:var(--soft);border-radius:12px;padding:10px 12px"><div class="small b muted">' + mObj[1] + '</div><div class="xb" style="font-size:26px;color:' + recCol(mp) + '">' + mp + '%</div><div class="small muted" style="line-height:1.4">Last trained: ' + esc(lastTrained(mSel)) + '. ' + (mp >= 80 ? 'Ready for hard work.' : mp >= 40 ? 'Light work is fine.' : 'Give it another day.') + '</div></div>' +
      '<div class="col small b" style="gap:5px"><span class="row" style="gap:6px"><i style="width:10px;height:10px;border-radius:3px;background:#3E8E5E"></i>Fresh 80–100%</span><span class="row" style="gap:6px"><i style="width:10px;height:10px;border-radius:3px;background:#E3A33B"></i>Recovering 40–79%</span><span class="row" style="gap:6px"><i style="width:10px;height:10px;border-radius:3px;background:#C2410C"></i>Tired under 40%</span></div></div></div>' +
      '<div class="small muted">Estimated from workouts you log here: each muscle recovers over about 72 h. Tap a muscle.</div></section>' +
    '<section class="col" style="gap:8px"><div class="head" style="padding:0 2px"><h2>Personal records</h2><button class="link" data-a="woPRNew">+ Test now</button></div><div class="grid2">' + prs + '</div></section>' +
    '<section class="card"><div class="head"><h2>Skill ladders</h2><span class="sm muted">level up step by step</span></div><div class="chips">' + Object.keys(LADDERS).map((x) => '<button class="chip' + (ui.woLad === x ? ' on' : '') + '" data-a="woLad" data-v="' + x + '">' + LADDERS[x].label + '</button>').join('') + '</div><div>' + ladder + '</div></section>' +
    '<section class="card"><div class="head"><h2>Routines</h2><span class="sm muted">no equipment</span></div><div class="chips">' + [['all', 'Any time'], ['7', '≤ 7 min'], ['15', '≤ 15'], ['20', '≤ 20'], ['30', '30+']].map(([v, l]) => '<button class="chip' + (ui.woT === v ? ' on' : '') + '" data-a="woT" data-v="' + v + '" style="height:34px;font-size:12px">' + l + '</button>').join('') + '</div><div class="chips">' + [['all', 'All'], ['full', 'Full body'], ['upper', 'Upper'], ['lower', 'Lower'], ['core', 'Core'], ['mobility', 'Mobility']].map(([v, l]) => '<button class="chip' + (ui.woA === v ? ' on' : '') + '" data-a="woA" data-v="' + v + '" style="height:34px;font-size:12px">' + l + '</button>').join('') + '</div>' +
      '<div>' + (routines || empty('No routine matches. Try another time or area.')) + '</div><button class="btn ghost full" data-a="woBuild" style="border-style:dashed">+ Build my own routine</button></section>' +
    (recent.length ? '<section class="card tight"><div class="head"><h2>Recent</h2><span class="sm muted">' + (db.wo.sessions || []).length + ' workouts</span></div>' + recent.map((s) => '<div class="list-row"><span class="grow"><span class="b" style="display:block;font-size:14px">' + esc(s.title) + '</span><span class="small muted">' + nice(s.d) + ' · ' + s.min + ' min</span></span></div>').join('') + '</section>' : '') +
    '<div class="small muted" style="text-align:center">Finished workouts log to Health → Exercise, tick a habit named Gym/Workout, and update recovery.</div>';
}
// ---- player ----
// ui.wp = { rid, steps:[{n,type,amt,rest,round}], i, phase:'work'|'rest', endAt, started, from }
function buildSteps(r) { const out = []; for (let rd = 1; rd <= (r.rounds || 1); rd++) r.ex.forEach((e, j) => { const x = EXL[e]; if (!x) return; out.push({ id: e, n: x[0], type: r.work ? 'time' : x[1], amt: r.work || x[2], rest: r.rest || 0, round: rd, mus: x[3] }); }); return out; }
function vWorkoutPlay() {
  const W = ui.wp; if (!W) return vWorkout();
  const r = allRoutines().find((x) => x.id === W.rid) || ROUT[0]; const st = W.steps[W.i];
  if (W.finished) {
    const min = Math.max(1, Math.round((Date.now() - W.started) / 60000));
    const prIds = [...new Set(W.steps.map((s) => s.id))].map((e) => ({ pushup: 'push', squat: 'squat', plank: 'plank', burpee: 'burpee' }[e])).filter(Boolean);
    return '<header class="row between"><h1>Nice work!</h1><a href="#workout" class="iconbtn" aria-label="Close">' + ic('x', 18) + '</a></header>' +
      '<section class="hero" style="flex-direction:column;align-items:stretch;gap:6px"><div class="small b" style="color:var(--heroMuted)">' + esc(r.t).toUpperCase() + '</div><div class="xb" style="font-size:30px">' + min + ' min</div><div class="sm" style="color:var(--heroMuted)">' + W.steps.length + ' sets · ' + routineMuscles(r).map((m) => MUS_NAME[m]).join(', ') + '</div></section>' +
      (prIds.length ? '<section class="card"><h2>Test a personal record?</h2><div class="small muted">Optional — enter your best single set from today.</div>' + prIds.map((id) => { const d = PRDEF.find((p) => p[0] === id); return '<label class="f">' + d[1] + (id === 'plank' ? ' (seconds)' : '') + '<input type="number" inputmode="numeric" class="in big" data-pr="' + id + '" placeholder="' + ((db.wo.prs || {})[id] ? 'best: ' + fmtPR(id, db.wo.prs[id].v) : 'e.g. 20') + '"></label>'; }).join('') + '</section>' : '') +
      '<label class="f">How hard was it?<div class="chips" id="woEff" style="display:grid;grid-template-columns:repeat(3,1fr)">' + [['0.7', 'Easy'], ['1', 'Good'], ['1.3', 'Hard']].map(([v, l], i) => '<button class="chip' + (i === 1 ? ' on' : '') + '" data-a="pickChip" data-group="woEff" data-v="' + v + '" style="height:44px">' + l + '</button>').join('') + '</div></label>' +
      '<button class="btn full" data-a="woSave" style="height:54px">Save workout</button><button class="btn ghost full" data-a="woDiscard">Discard</button>';
  }
  const next = W.steps[W.i + 1];
  const rem = W.endAt ? Math.max(0, Math.ceil((W.endAt - Date.now()) / 1000)) : null;
  const isRest = W.phase === 'rest';
  const prog = (W.i + (isRest ? 1 : 0)) / W.steps.length;
  return '<header class="row between"><a href="#workout" class="iconbtn" data-a="woQuit" aria-label="Quit workout">' + ic('x', 18) + '</a><div class="small b muted">' + esc(r.t) + ' · round ' + st.round + '/' + (r.rounds || 1) + '</div><span class="small b muted">' + (W.i + 1) + '/' + W.steps.length + '</span></header>' +
    '<div class="bar" style="height:8px"><i style="width:' + (prog * 100).toFixed(1) + '%;background:var(--good)"></i></div>' +
    '<section class="card" style="align-items:center;text-align:center;gap:8px;padding:28px 16px;' + (isRest ? 'background:var(--good-bg);border-color:transparent' : '') + '">' +
      '<div class="small xb" style="color:' + (isRest ? 'var(--good-fg)' : 'var(--muted)') + '">' + (isRest ? 'REST' : 'NOW') + '</div>' +
      '<div class="xb" style="font-size:28px;line-height:1.2">' + (isRest ? 'Breathe' : esc(st.n)) + '</div>' +
      '<div id="wpclock" style="font-size:72px;font-weight:800;letter-spacing:-2px;font-variant-numeric:tabular-nums;line-height:1">' + (isRest || st.type === 'time' ? (rem == null ? (isRest ? st.rest : st.amt) : rem) + '<span style="font-size:24px">s</span>' : st.amt + '<span style="font-size:24px"> reps</span>') + '</div>' +
      (!isRest && st.mus && st.mus.length ? '<div class="small muted">' + st.mus.map((m) => MUS_NAME[m]).join(' · ') + '</div>' : '') +
      (next ? '<div class="sm muted">Next: <b style="color:var(--ink)">' + esc(next.n) + '</b> · ' + (next.type === 'time' ? next.amt + 's' : next.amt + ' reps') + '</div>' : '<div class="sm muted">Last one!</div>') + '</section>' +
    '<div class="grid2">' + (!isRest && st.type === 'time' && !W.endAt ? '<button class="btn" data-a="woGo" style="height:56px;background:var(--good);color:#fff">Start ' + st.amt + 's</button>' : '<button class="btn" data-a="woNext" style="height:56px;background:var(--good);color:#fff">' + (isRest ? 'Skip rest' : 'Done') + '</button>') + '<button class="btn ghost" data-a="woPrev" style="height:56px"' + (W.i === 0 && !isRest ? ' disabled' : '') + '>Back</button></div>' +
    '<div class="small muted" style="text-align:center">Screen stays on during the workout. Leaving the app keeps your place.</div>';
}
let wakeLock = null;
async function keepAwake(on) { try { if (on && 'wakeLock' in navigator && !wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => (wakeLock = null)); } else if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; } } catch (e) {} }
function beep() { try { const a = new (window.AudioContext || window.webkitAudioContext)(); const o = a.createOscillator(); const g = a.createGain(); o.connect(g); g.connect(a.destination); o.frequency.value = 880; g.gain.value = 0.08; o.start(); o.stop(a.currentTime + 0.18); setTimeout(() => a.close(), 400); } catch (e) {} }
function woAdvance() {
  const W = ui.wp; if (!W) return; const st = W.steps[W.i];
  if (W.phase === 'work' && st.rest && W.i < W.steps.length - 1) { W.phase = 'rest'; W.endAt = Date.now() + st.rest * 1000; }
  else { W.phase = 'work'; W.endAt = null; W.i++; if (W.i >= W.steps.length) { W.i = W.steps.length - 1; W.finished = true; keepAwake(false); } }
  try { localStorage.setItem('dl:wp', JSON.stringify(W)); } catch (e) {}
}
function routineSheet() {
  return '<h2>Build my own routine</h2><label class="f">Name<input id="rn" class="in" placeholder="e.g. Quick push"></label>' +
    '<div class="small b muted">Area</div><div class="chips" id="ra">' + ['full', 'upper', 'lower', 'core', 'mobility'].map((a, i) => '<button class="chip' + (i === 0 ? ' on' : '') + '" data-a="pickChip" data-group="ra" data-v="' + a + '">' + AREAS[a][0] + '</button>').join('') + '</div>' +
    '<div class="small b muted">Exercises (tap in order)</div><div class="chips" id="rex">' + Object.keys(EXL).map((e) => '<button class="chip" data-a="toggleChip" data-v="' + e + '">' + esc(EXL[e][0]) + '</button>').join('') + catAddBtn('wex', 'rex') + '</div>' +
    '<div class="grid2"><label class="f">Rounds<input id="rr" type="number" inputmode="numeric" class="in" value="3"></label><label class="f">Rest between (sec)<input id="rrest" type="number" inputmode="numeric" class="in" value="30"></label></div>' +
    '<button class="btn full" data-a="woBuildSave">Save routine</button><button class="btn ghost full" data-a="sheetClose">Cancel</button>';
}
function prSheet() {
  return '<h2>Test a personal record</h2><div class="small b muted">Which one?</div><div class="chips" id="prk">' + PRDEF.map(([id, l], i) => '<button class="chip' + (i === 0 ? ' on' : '') + '" data-a="pickChip" data-group="prk" data-v="' + id + '">' + esc(l) + '</button>').join('') + catAddBtn('pr', 'prk') + '</div>' +
    '<label class="f">Result (reps, or seconds for timed tests)<input id="prv" type="number" inputmode="numeric" class="in big"></label><button class="btn full" data-a="woPRSave">Save</button><button class="btn ghost full" data-a="sheetClose">Cancel</button>';
}
function savePR(id, v) {
  v = Math.round(num(v)); if (!(v > 0)) return false; db.wo.prs = db.wo.prs || {}; const k = nowInfo().k;
  const P = db.wo.prs[id] || { v: 0, d: k, hist: [] }; P.hist = (P.hist || []).concat([{ d: k, v }]).slice(-30);
  const isNew = v > P.v; if (isNew) { P.v = v; P.d = k; } db.wo.prs[id] = P; return isNew;
}


/* ========================== WORKOUT (simple, v2.0) ========================== */
const WPARTS = [['chest', 'Chest'], ['back', 'Back'], ['shoulders', 'Shoulders'], ['arms', 'Arms'], ['core', 'Core'], ['legs', 'Legs'], ['glutes', 'Glutes'], ['calves', 'Calves']];
const WPN = Object.fromEntries(WPARTS);
const OLD_MAP = { quads: 'legs', lower: 'back' }; // older routine data → new body parts
const WSHAPES = {
  front: [['shoulders', 'M44 46 Q38 50 36 64 L50 64 L54 48 Z M106 46 Q112 50 114 64 L100 64 L96 48 Z'], ['chest', 'M55 48 L95 48 L97 74 Q75 82 53 74 Z'], ['arms', 'M34 66 L48 66 L46 112 L32 112 Z M102 66 L116 66 L118 112 L104 112 Z'], ['core', 'M56 78 Q75 86 94 78 L92 124 L58 124 Z'], ['legs', 'M56 128 L74 128 L72 182 L56 182 Z M76 128 L94 128 L94 182 L78 182 Z'], ['calves', 'M57 188 L71 188 L69 236 L59 236 Z M79 188 L93 188 L91 236 L81 236 Z']],
  back: [['shoulders', 'M44 46 Q38 50 36 64 L50 64 L54 48 Z M106 46 Q112 50 114 64 L100 64 L96 48 Z'], ['back', 'M55 48 L95 48 L97 84 L53 84 Z M58 88 L92 88 L92 112 L58 112 Z'], ['arms', 'M34 66 L48 66 L46 112 L32 112 Z M102 66 L116 66 L118 112 L104 112 Z'], ['glutes', 'M57 115 L93 115 L94 134 Q75 140 56 134 Z'], ['legs', 'M56 138 L74 138 L72 182 L56 182 Z M76 138 L94 138 L94 182 L78 182 Z'], ['calves', 'M57 188 L71 188 L69 236 L59 236 Z M79 188 L93 188 L91 236 L81 236 Z']]
};
const WCOLORS = [['tent-bg', 'tent-fg'], ['doc-bg', 'doc-fg'], ['study-bg', 'study-fg'], ['pray-bg', 'pray-fg'], ['meal-bg', 'meal-fg'], ['house-bg', 'house'], ['warn-bg', 'warn-fg'], ['work-bg', 'work-fg']];
const wLvl = (n) => n === 0 ? ['Not touched', 'var(--line)', 'var(--muted)'] : n <= 3 ? ['Light', '#A6DDB7', 'var(--good-fg)'] : n <= 7 ? ['Worked', '#3E8E5E', 'var(--good-fg)'] : ['Busy', '#1E5233', 'var(--good-fg)'];
ui.ws = { open: '', draft: [['', ''], ['', '']], side: 'front', part: '', newParts: [] };
function wsLogs() { return db.wo.logs = db.wo.logs || []; }
function wsEx() { return db.wo.myEx = db.wo.myEx || []; }
function wsWeek() {
  const k = nowInfo().k; const from = addD(k, -6);
  const load = {}, by = {}; WPARTS.forEach(([p]) => { load[p] = 0; by[p] = new Set(); });
  const days = new Set(); let sets = 0;
  wsLogs().filter((l) => l.d >= from && l.d <= k).forEach((l) => { const e = wsEx().find((x) => x.id === l.ex); const parts = e ? e.parts : (l.parts || []); parts.forEach((p) => { if (load[p] != null) { load[p] += l.sets.length; by[p].add(e ? e.name : l.name); } }); days.add(l.d); sets += l.sets.length; });
  (db.wo.sessions || []).filter((x) => x.d >= from && x.d <= k).forEach((x) => { [...new Set((x.muscles || []).map((m) => OLD_MAP[m] || m))].forEach((p) => { if (load[p] != null) { load[p] += 3; by[p].add(x.title); } }); days.add(x.d); });
  return { load, by, days: days.size, sets };
}
const setTxt = (sets) => { const reps = sets.map((x) => num(x[0])).filter((x) => x > 0); const mins = sets.reduce((a, x) => a + num(x[1]), 0); return (reps.length ? reps.join(', ') + ' reps' : '') + (reps.length && mins ? ' · ' : '') + (mins ? (Math.round(mins * 10) / 10) + ' min' : ''); };
function vWorkoutSimple() {
  const k = nowInfo().k; const W = wsWeek(); const S = ui.ws; const side = S.side;
  const sel = WSHAPES[side].some((x) => x[0] === S.part) ? S.part : (WSHAPES[side].slice().sort((a, b) => W.load[a[0]] - W.load[b[0]])[0] || ['core'])[0];
  const L = wLvl(W.load[sel]); const untouched = WPARTS.filter(([p]) => !W.load[p]).map(([, n]) => n);
  const body = '<svg width="150" height="250" viewBox="0 0 150 250" role="img" aria-label="Body map, last 7 days" style="flex:0 0 150px"><circle cx="75" cy="20" r="15" fill="var(--line)"/><rect x="68" y="34" width="14" height="10" rx="4" fill="var(--line)"/>' +
    WSHAPES[side].map(([p, d]) => '<path d="' + d + '" fill="' + wLvl(W.load[p])[1] + '" stroke="' + (p === sel ? 'var(--ink)' : 'var(--card)') + '" stroke-width="' + (p === sel ? 2.5 : 1.5) + '" data-a="wsPart" data-v="' + p + '" style="cursor:pointer"><title>' + WPN[p] + ': ' + W.load[p] + ' sets</title></path>').join('') + '</svg>';
  const logs = wsLogs(); const ex = wsEx();
  const lastFor = (id) => logs.filter((l) => l.ex === id).sort((a, b) => b.ts - a.ts)[0];
  const agoTxt = (d) => { const n = diffD(d, k); return n === 0 ? 'today' : n === 1 ? 'yesterday' : n + ' days ago'; };
  const exRows = ex.map((e, i) => {
    const last = lastFor(e.id); const wk = logs.filter((l) => l.ex === e.id && l.d >= addD(k, -6)).reduce((a, l) => a + l.sets.length, 0); const isOpen = S.open === e.id;
    const C = WCOLORS[i % WCOLORS.length];
    let panel = '';
    if (isOpen) {
      const ph = last ? last.sets : [];
      panel = '<div style="background:var(--soft);border-radius:14px;padding:12px;margin-bottom:10px;display:flex;flex-direction:column;gap:8px">' +
        '<div style="display:grid;grid-template-columns:40px 1fr 1fr 36px;gap:6px" class="small b muted"><span>Set</span><span>Reps</span><span>Time (min)</span><span></span></div>' +
        S.draft.map((d, j) => '<div style="display:grid;grid-template-columns:40px 1fr 1fr 36px;gap:6px;align-items:center"><span class="xb">' + (j + 1) + '</span>' +
          '<input type="number" inputmode="numeric" class="in" data-c="wsDraft" data-j="' + j + '" data-f="0" value="' + esc(d[0]) + '" placeholder="' + esc(ph[j] && num(ph[j][0]) ? ph[j][0] : '—') + '" aria-label="Reps set ' + (j + 1) + '" style="height:42px;text-align:center;font-weight:800;font-size:16px;padding:0 6px">' +
          '<input type="number" inputmode="decimal" step="0.5" class="in" data-c="wsDraft" data-j="' + j + '" data-f="1" value="' + esc(d[1]) + '" placeholder="' + esc(ph[j] && num(ph[j][1]) ? ph[j][1] : '—') + '" aria-label="Minutes set ' + (j + 1) + '" style="height:42px;text-align:center;font-weight:800;font-size:16px;padding:0 6px">' +
          '<button class="del" data-a="wsDelSet" data-j="' + j + '" aria-label="Remove set ' + (j + 1) + '" style="width:36px;height:36px">' + ic('x', 14) + '</button></div>').join('') +
        '<div class="grid2"><button class="btn ghost sm" data-a="wsAddSet" style="border-style:dashed">+ Add set</button><button class="btn sm" data-a="wsSave" data-id="' + e.id + '">Save today</button></div>' +
        '<div class="small muted">Fill reps, time, or both (plank → time only, push-ups → reps only). Grey numbers are last time\'s.</div>' +
        '<details><summary class="small muted" style="min-height:32px">Edit exercise</summary><div class="col" style="gap:8px;margin-top:6px"><input id="wsEn" class="in" value="' + esc(e.name) + '" aria-label="Exercise name"><div class="chips" id="wsEp">' + WPARTS.map(([p, n]) => '<button class="chip' + (e.parts.includes(p) ? ' on' : '') + '" data-a="toggleChip" data-v="' + p + '" aria-pressed="' + e.parts.includes(p) + '">' + n + '</button>').join('') + '</div><div class="grid2"><button class="btn ghost sm" data-a="wsEdit" data-id="' + e.id + '">Save changes</button><button class="btn ghost sm" data-a="wsDelEx" data-id="' + e.id + '" style="color:var(--bad)">Delete exercise</button></div></div></details></div>';
    }
    return '<div style="border-top:1px solid var(--line)"><button class="tap row" data-a="wsOpen" data-id="' + e.id + '" aria-expanded="' + isOpen + '" style="padding:10px 0;gap:12px"><span style="width:44px;height:44px;flex:0 0 44px;border-radius:12px;background:var(--' + C[0] + ');color:var(--' + C[1] + ');display:flex;align-items:center;justify-content:center;font-size:17px;font-weight:800">' + esc(e.name.charAt(0).toUpperCase()) + '</span>' +
      '<span class="grow"><span class="b" style="display:block;font-size:15px">' + esc(e.name) + '</span><span class="small muted" style="display:block">' + e.parts.map((p) => WPN[p]).join(' · ') + '</span><span class="small b" style="display:block;color:' + (last && diffD(last.d, k) <= 1 ? 'var(--good-fg)' : 'var(--muted)') + '">' + (last ? 'Last: ' + setTxt(last.sets) + ' · ' + agoTxt(last.d) : 'Not logged yet') + '</span></span>' +
      '<span class="pill" style="background:var(--soft);color:var(--ink)">' + wk + ' set' + (wk === 1 ? '' : 's') + ' this wk</span></button>' + panel + '</div>';
  }).join('');
  const today = logs.filter((l) => l.d === k); const todaySets = today.reduce((a, l) => a + l.sets.length, 0);
  return '<header class="row between" style="align-items:baseline"><h1>Workout</h1><div class="sm muted">' + nice(k) + '</div></header>' + hwSeg('workout') +
    '<section class="card"><div class="row between" style="align-items:flex-start"><div><h2>Your body · last 7 days</h2><div class="small muted">' + W.sets + ' set' + (W.sets === 1 ? '' : 's') + ' across ' + W.days + ' day' + (W.days === 1 ? '' : 's') + '</div></div><div class="row" style="gap:4px">' + [['front', 'Front'], ['back', 'Back']].map(([v, l]) => '<button class="chip' + (side === v ? ' on' : '') + '" data-a="wsSide" data-v="' + v + '" style="height:32px">' + l + '</button>').join('') + '</div></div>' +
      '<div class="row" style="gap:12px">' + body + '<div class="grow col" style="gap:8px;min-width:0"><div style="background:var(--soft);border-radius:12px;padding:10px 12px"><div class="small b muted">' + WPN[sel] + '</div><div class="xb" style="font-size:22px;color:' + L[2] + '">' + L[0] + '</div><div class="small muted" style="line-height:1.4">' + (W.load[sel] ? W.load[sel] + ' sets this week from ' + esc([...W.by[sel]].join(', ')) + '.' : 'No exercise worked this in the last 7 days.') + '</div></div>' +
      '<div class="col small b" style="gap:5px">' + [['Not touched', 'var(--line)'], ['Light · 1–3 sets', '#A6DDB7'], ['Worked · 4–7 sets', '#3E8E5E'], ['Busy · 8+ sets', '#1E5233']].map(([t, c]) => '<span class="row" style="gap:6px"><i style="width:10px;height:10px;border-radius:3px;background:' + c + '"></i>' + t + '</span>').join('') + '</div></div></div>' +
      (untouched.length ? '<div class="sm" style="background:var(--warn-bg);color:var(--warn-fg);border-radius:12px;padding:10px 12px;line-height:1.45"><b>Not touched this week:</b> ' + untouched.join(', ') + '.</div>' : '<div class="sm b" style="background:var(--good-bg);color:var(--good-fg);border-radius:12px;padding:10px 12px">Every body part got some work this week.</div>') + '</section>' +
    '<section class="card tight"><div class="head"><h2>My exercises</h2><span class="sm muted">' + (ex.length ? 'tap to log' : '') + '</span></div>' + (exRows || empty('No exercises yet. Add your first one below.')) + '</section>' +
    '<section class="card" style="border:2px dashed var(--line2)"><h2>+ Add an exercise</h2><label class="f">Name<input id="wsNew" class="in" placeholder="e.g. Pull-ups, Skipping, Bench press" maxlength="40"></label>' +
      '<div class="small b muted">Which body parts does it work? <span style="font-weight:500">(pick one or more)</span></div><div class="chips" id="wsNp">' + WPARTS.map(([p, n]) => '<button class="chip" data-a="toggleChip" data-v="' + p + '">' + n + '</button>').join('') + '</div>' +
      '<button class="btn full" data-a="wsAdd">Add exercise</button></section>' +
    '<section class="card tight"><div class="head"><h2>Today</h2><span class="sm muted">' + todaySets + ' set' + (todaySets === 1 ? '' : 's') + '</span></div>' +
      (today.map((l) => { const e = ex.find((x) => x.id === l.ex); return '<div class="list-row"><span class="grow b" style="font-size:14px">' + esc(e ? e.name : l.name) + '</span><span class="small muted">' + l.sets.length + ' set' + (l.sets.length === 1 ? '' : 's') + ' · ' + setTxt(l.sets) + '</span><button class="del" data-a="wsDelLog" data-id="' + l.id + '" aria-label="Delete">' + ic('trash', 16) + '</button></div>'; }).join('') || empty('Nothing logged yet today. Tap an exercise above.')) + '</section>' +
    '<div class="small muted" style="text-align:center">Logging here also adds to Health → Exercise and ticks a habit called Gym or Workout.</div>';
}
Object.assign(A, {
  wsSide: (d) => { ui.ws.side = d.v; ui.ws.part = ''; render(true); },
  wsPart: (d) => { ui.ws.part = d.v; render(true); },
  wsOpen: (d) => { ui.ws.open = ui.ws.open === d.id ? '' : d.id; ui.ws.draft = [['', ''], ['', '']]; render(true); },
  wsAddSet: () => { const dr = ui.ws.draft; dr.push([dr.length ? dr[dr.length - 1][0] : '', '']); render(true); },
  wsDelSet: (d) => { ui.ws.draft.splice(+d.j, 1); if (!ui.ws.draft.length) ui.ws.draft.push(['', '']); render(true); },
  wsSave: (d) => {
    const e = wsEx().find((x) => x.id === d.id); if (!e) return;
    const sets = ui.ws.draft.map((x) => [Math.max(0, Math.round(num(x[0]))), Math.max(0, Math.round(num(x[1]) * 10) / 10)]).filter((x) => x[0] > 0 || x[1] > 0);
    if (!sets.length) return toast('Enter reps or time for at least one set');
    const k = nowInfo().k; wsLogs().push({ id: uid(), ex: e.id, name: e.name, parts: e.parts, d: k, ts: Date.now(), sets });
    const mins = sets.reduce((a, x) => a + x[1], 0);
    hday(k).ex.push({ type: 'other', name: e.name, amt: '', min: mins ? String(mins) : '', text: sets.length + ' set' + (sets.length === 1 ? '' : 's') + ' · ' + setTxt(sets) });
    const g = customHabits().find((c) => /gym|workout|exercise|training/i.test(c.name) && c.days.includes(parseD(k).getDay())); if (g) day(k).h['c:' + g.id] = true;
    ui.ws.open = ''; ui.ws.draft = [['', ''], ['', '']]; commit('Saved ' + e.name + ' · ' + setTxt(sets) + (g ? ' · ' + g.name + ' ticked' : ''));
  },
  wsAdd: () => {
    const n = val('wsNew'); const parts = [...document.querySelectorAll('#wsNp .chip.on')].map((c) => c.dataset.v);
    if (!n) return toast('Type the exercise name'); if (!parts.length) return toast('Pick at least one body part');
    if (wsEx().some((x) => x.name.toLowerCase() === n.toLowerCase())) return toast('You already have ' + n);
    const id = uid(); wsEx().push({ id, name: n, parts, created: Date.now() }); ui.ws.open = id; ui.ws.draft = [['', ''], ['', '']]; commit('Added ' + n + ' — log your first sets');
  },
  wsEdit: (d) => { const e = wsEx().find((x) => x.id === d.id); const n = val('wsEn'); const parts = [...document.querySelectorAll('#wsEp .chip.on')].map((c) => c.dataset.v); if (!n || !parts.length) return toast('Name and at least one body part'); e.name = n; e.parts = parts; commit('Saved'); },
  wsDelEx: (d) => { const e = wsEx().find((x) => x.id === d.id); if (!e || !confirm('Delete ' + e.name + '? Its past logs stay in your history.')) return; db.wo.myEx = wsEx().filter((x) => x.id !== d.id); ui.ws.open = ''; commit('Deleted'); },
  wsDelLog: (d) => { if (!confirm('Delete this log?')) return; db.wo.logs = wsLogs().filter((l) => l.id !== d.id); commit('Deleted'); }
});
Object.assign(CH, { wsDraft: (v, d) => { const r = ui.ws.draft[+d.j]; if (r) r[+d.f] = v; } }); // no re-render, so typing isn't interrupted

/* ========================== MY OWN CATEGORIES ========================== */
const colorKey = (c) => ['tent', 'doc', 'study', 'work', 'meal', 'rest', 'pray'].includes(c) ? c : c === 'personal' ? 'meal' : 'work';
const CUSTOM_COLORS = ['#0F766E', '#B45309', '#7C3AED', '#BE185D', '#0369A1', '#4D7C0F', '#9F1239', '#475569'];
const CAT_KINDS = { sector: 'Money sectors', ex: 'Exercise types', proj: 'Projects', mode: 'Speaking practice modes', wex: 'Workout exercises', pr: 'Record tests' };
const BASE = { sect: SECT.slice(), ex: EX.slice(), proj: PROJ.slice(), prdef: PRDEF.slice(), exl: Object.keys(EXL).slice() };
function applyCats() {
  const C = (db.cats = Object.assign({ sector: [], ex: [], proj: [], mode: [], wex: [], pr: [] }, db.cats || {}));
  // rebuild from the original lists every time; custom items go before "Other"
  SECT.splice(0, SECT.length, ...BASE.sect.slice(0, -1), ...C.sector.map((x) => [x.id, x.l, x.c]), BASE.sect[BASE.sect.length - 1]);
  EX.splice(0, EX.length, ...BASE.ex.slice(0, -1), ...C.ex.map((x) => [x.id, x.l, x.u || 'min']), BASE.ex[BASE.ex.length - 1]);
  PROJ.splice(0, PROJ.length, ...BASE.proj, ...C.proj.map((x) => [x.id, x.l])); C.proj.forEach((x) => (CAT[x.id] = x.l));
  PRDEF.splice(0, PRDEF.length, ...BASE.prdef, ...C.pr.map((x) => [x.id, x.l, x.u || 'reps']));
  Object.keys(EXL).forEach((k) => { if (!BASE.exl.includes(k)) delete EXL[k]; }); C.wex.forEach((x) => (EXL[x.id] = [x.l, x.type || 'reps', num(x.amt, 10), x.mus ? [x.mus] : []]));
}
// "+ New" button at the end of a chip group; opens a small inline form without losing what you typed elsewhere
function catAddBtn(kind, group) { return '<button class="chip" data-a="catAdd" data-kind="' + kind + '" data-group="' + group + '" style="border-style:dashed;color:var(--muted)">+ New</button>'; }
function catForm(kind, group) {
  const extra = {
    ex: '<select class="in" id="cfu" style="width:auto;height:36px;padding:0 8px"><option value="min">min</option><option value="reps">reps</option><option value="km">km</option><option value="steps">steps</option><option value="sets">sets</option></select>',
    pr: '<select class="in" id="cfu" style="width:auto;height:36px;padding:0 8px"><option value="reps">reps</option><option value="sec">seconds</option></select>',
    wex: '<select class="in" id="cft" style="width:auto;height:36px;padding:0 8px"><option value="reps">reps</option><option value="time">seconds</option></select><input id="cfa" type="number" inputmode="numeric" class="in" value="10" aria-label="Amount" style="width:58px;height:36px;padding:0 6px;text-align:center"><select class="in" id="cfm" style="width:auto;height:36px;padding:0 8px" aria-label="Works"><option value="">works…</option>' + Object.keys(MUS_NAME).map((m) => '<option value="' + m + '">' + MUS_NAME[m] + '</option>').join('') + '</select>'
  }[kind] || '';
  return '<span class="catform" data-kind="' + kind + '" data-group="' + group + '" style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;width:100%"><input id="cfn" class="in" placeholder="' + { sector: 'e.g. Rent', ex: 'e.g. Swimming', proj: 'e.g. Uni assignment', mode: 'e.g. With a friend', wex: 'e.g. Pull-ups', pr: 'e.g. Pull-ups in one set' }[kind] + '" style="flex:1 1 140px;height:36px" maxlength="40" data-enter="catSave">' + extra + '<button class="chip on" data-a="catSave" style="height:36px">Save</button><button class="chip" data-a="catCancel" aria-label="Cancel" style="height:36px">✕</button></span>';
}
function catsCard() {
  const C = db.cats || {}; const rows = Object.keys(CAT_KINDS).filter((k) => (C[k] || []).length).map((k) => '<div><div class="small b muted" style="margin-bottom:6px">' + CAT_KINDS[k] + '</div><div class="chips">' + C[k].map((x) => '<span class="chip" style="display:inline-flex;align-items:center;gap:4px;padding-right:4px">' + esc(x.l) + (x.u ? ' <span class="small muted">' + esc(x.u) + '</span>' : '') + '<button class="del" data-a="catDel" data-kind="' + k + '" data-id="' + x.id + '" aria-label="Remove ' + esc(x.l) + '" style="width:28px;height:28px">' + ic('x', 14) + '</button></span>').join('') + '</div></div>').join('');
  return '<section class="card"><h2>My categories</h2><div class="small muted">Your own sectors, projects, exercise types and more. Add them with <b>+ New</b> next to any list. Removing one keeps your old entries.</div>' + (rows || '<div class="small muted">None yet.</div>') + '</section>';
}

/* ========================== REGISTER ========================== */
Object.assign(ROUTES, { shutdown: vShutdown, focus: vFocus, goals: vGoals, hstats: vHabitStats, workout: vWorkoutSimple, wplay: vWorkoutPlay });
Object.assign(NAVPARENT, { shutdown: 'today', focus: 'home', goals: 'today', hstats: 'today', workout: 'health', wplay: 'health' });
const _finish = A.finish;
Object.assign(A, {
  finish: () => { const k = ui.tDate || nowInfo().k; if (day(k).fin) { day(k).fin = false; return commit('Day reopened'); } ui.sd = { k, dest: {} }; location.hash = '#shutdown'; },
  sdDest: (d) => { ui.sd.dest[d.key] = d.v; render(true); },
  sdStar: (d) => { const tk = addD(ui.sd.k, 1); const t = db.tasks.find((x) => x.id === d.id); if (!t) return; if (t.top === tk) t.top = ''; else { if (db.tasks.filter((x) => x.top === tk).length >= 3) return toast('Top 3 is full — unstar one first'); t.top = tk; } commit(); },
  sdAdd: () => { const t = val('sdNew'); if (!t) return; const tk = addD(ui.sd.k, 1); const full = db.tasks.filter((x) => x.top === tk).length >= 3; db.tasks.unshift({ id: uid(), t, proj: 'personal', st: 'todo', due: '', est: '', top: full ? '' : tk, created: Date.now() }); commit(full ? 'Added (Top 3 full)' : 'Added to tomorrow\'s Top 3'); },
  sdMoveBig: (d) => { const t = db.tasks.find((x) => x.id === d.id); if (!t) return; moveTask(t, addD(ui.sd.k, 1), nextSun(ui.sd.k)); commit('Moved to ' + nice(nextSun(ui.sd.k))); },
  sdGo: () => { const r = sdApply(); const k = ui.sd.k; const pctV = dayScore(k).pct; save(); ui.sd = null; location.hash = '#home'; toast('Day closed at ' + pctV + '%' + (r.moved ? ' · ' + r.moved + ' moved' : '') + '. Rest well.'); },
  focusOpen: (d) => { if (!db.focusRun) { ui.focusCat = FOCUS_CATS.concat(['work', 'personal']).includes(d.cat) ? d.cat : 'personal'; ui.focusLabel = d.label; } ui.focusDead = null; location.hash = '#focus'; },
  focusCat: (d) => { ui.focusCat = d.v; ui.focusLabel = CAT[d.v]; render(true); },
  focusLen: (d) => { ui.focusLen = +d.v; render(true); },
  focusStart: () => { const k = nowInfo().k; const cur = currentBlock(k, nowInfo().m).cur; const cat = ui.focusCat || (cur ? cur.b.c : 'study'); db.focusRun = { start: Date.now(), len: ui.focusLen, cat: ['pray', 'meal', 'rest'].includes(cat) ? 'personal' : cat, label: ui.focusLabel || (cur ? cur.b.l : 'Deep work') }; ui.focusDead = null; commit(); },
  focusPause: () => { const r = db.focusRun; if (!r) return; if (r.pausedAt) { r.start += Date.now() - r.pausedAt; r.pausedAt = null; } else r.pausedAt = Date.now(); commit(); },
  focusGiveUp: () => { const r = db.focusRun; if (!r) return; if (!confirm('Give up? The plant wilts, but finished minutes still count.')) return; const min = Math.floor(focusElapsed(r) / 60); focusLog(min, false); ui.focusDead = min; commit(min ? 'Logged ' + min + ' min' : 'Not logged'); },
  focusFinish: () => { const r = db.focusRun; if (!r) return; focusLog(r.len, true); ui.focusDead = null; commit('Plant grown! ' + r.len + ' min logged. Take 5 off.'); beep(); },
  goalNew: () => openSheet(goalSheet()),
  goalNewFor: (d) => { location.hash = '#goals'; setTimeout(() => { openSheet(goalSheet(null)); const b = document.querySelector('#gh [data-v="' + d.id + '"]'); if (b) A.pickChip({ group: 'gh' }, b); }, 50); },
  goalEdit: (d) => { const g = db.goals.find((x) => x.id === d.id); if (g) openSheet(goalSheet(g)); },
  goalKind: (d, el) => {
    document.querySelectorAll('#gk .chip').forEach((c) => c.classList.toggle('on', c === el));
    const help = { habit: 'Counts the days you complete the linked habit from the start date.', num: 'You type the latest number (followers, savings…). The app shows your pace.', books: 'Counts books you mark finished in Habits → Reading.', wpm: 'Uses your best typing session (Habits → Typing).', deadlines: 'Counts calendar deadlines you tick done (optionally one project).' };
    $('#gkhelp').textContent = help[d.v]; $('#ghab').hidden = d.v !== 'habit'; $('#gproj').hidden = d.v !== 'deadlines'; $('#gfromw').hidden = !['num', 'wpm'].includes(d.v); $('#gunitw').hidden = d.v !== 'num';
  },
  goalSave: (d) => {
    const t = val('gt'); if (!t) return toast('Name your goal'); const target = num(val('gtar')); if (!(target > 0)) return toast('Set a target');
    const kind = chipVal('gk') || 'habit'; const s = val('gs') || nowInfo().k, e = val('ge'); if (!/^\d{4}-/.test(e) || e <= s) return toast('Pick an end date after the start');
    const g = d.id ? db.goals.find((x) => x.id === d.id) : { id: uid(), created: Date.now(), c: GOAL_COLORS[db.goals.length % GOAL_COLORS.length] };
    Object.assign(g, { t, kind, target, start: s, end: e, habit: kind === 'habit' ? (chipVal('gh') || 'read') : '', proj: kind === 'deadlines' ? chipVal('gp') : '', from: ['num', 'wpm'].includes(kind) ? num(val('gfrom')) : 0, unit: kind === 'num' ? val('gu') : '' });
    if (kind === 'num' && g.now == null) g.now = g.from;
    if (!d.id) db.goals.push(g); closeSheet(); commit(d.id ? 'Saved' : 'Goal added');
  },
  goalClose: (d) => { const g = db.goals.find((x) => x.id === d.id); g.archived = true; closeSheet(); commit('Goal closed'); },
  goalReopen: (d) => { const g = db.goals.find((x) => x.id === d.id); g.archived = false; commit('Reopened'); },
  goalDel: (d) => { if (!confirm('Delete this goal?')) return; db.goals = db.goals.filter((x) => x.id !== d.id); closeSheet(); commit('Deleted'); },
  hstatsOpen: (d) => { ui.hs = d.id; if (location.hash === '#hstats') render(); else location.hash = '#hstats'; },
  woDay: (d) => { ui.woDay = d.k; render(true); },
  woSide: (d) => { ui.woSide = d.v; ui.woM = null; render(true); },
  woMuscle: (d) => { ui.woM = d.v; render(true); },
  woLad: (d) => { ui.woLad = d.v; render(true); },
  woT: (d) => { ui.woT = d.v; render(true); },
  woA: (d) => { ui.woA = d.v; render(true); },
  woPlan: (d) => { db.wo.plan = db.wo.plan || {}; db.wo.plan[d.d] = d.v; commit(); },
  woSwap: () => { const k = nowInfo().k; const cur = todaySuggestion(k).area; const rec = recovery(); const order = ['full', 'upper', 'lower', 'core', 'mobility']; const opts = order.filter((a) => a !== cur); opts.sort((a, b) => Math.min(...routineMuscles(ROUT.find((r) => r.id === AREA_ROUT[b])).map((m) => rec[m]).concat([100])) - Math.min(...routineMuscles(ROUT.find((r) => r.id === AREA_ROUT[a])).map((m) => rec[m]).concat([100]))); const i = ui.woSwap && ui.woSwap.k === k ? (opts.indexOf(ui.woSwap.area) + 1) % opts.length : 0; ui.woSwap = { k, area: opts[i] }; render(true); toast('Swapped to ' + AREAS[opts[i]][0]); },
  woMove: () => { const k = nowInfo().k; const a = todaySuggestion(k).area; const t = addD(k, 1); db.wo.override = db.wo.override || {}; db.wo.override[k] = 'rest'; if ((db.wo.plan[parseD(t).getDay()] || 'rest') === 'rest' || !db.wo.override[t]) db.wo.override[t] = a; const from = todaySuggestion(k).from; if (from) { db.wo.madeUp = db.wo.madeUp || {}; db.wo.madeUp[from] = true; } ui.woSwap = null; commit('Moved ' + AREAS[a][0] + ' to tomorrow'); },
  woStart: (d) => { const r = allRoutines().find((x) => x.id === d.id) || ROUT[0]; ui.wp = { rid: r.id, steps: buildSteps(r), i: 0, phase: 'work', endAt: null, started: Date.now(), from: d.from || '' }; keepAwake(true); try { localStorage.setItem('dl:wp', JSON.stringify(ui.wp)); } catch (e) {} location.hash = '#wplay'; },
  woGo: () => { const W = ui.wp; W.endAt = Date.now() + W.steps[W.i].amt * 1000; render(true); },
  woNext: () => { woAdvance(); render(true); },
  woPrev: () => { const W = ui.wp; if (W.phase === 'rest') W.phase = 'work'; else W.i = Math.max(0, W.i - 1); W.endAt = null; render(true); },
  woQuit: () => { if (ui.wp && !ui.wp.finished && ui.wp.i > 0 && !confirm('Quit this workout? Progress won\'t be saved.')) { location.hash = '#wplay'; return; } ui.wp = null; localStorage.removeItem('dl:wp'); keepAwake(false); },
  woDiscard: () => { ui.wp = null; localStorage.removeItem('dl:wp'); location.hash = '#workout'; },
  woSave: () => {
    const W = ui.wp; if (!W) return; const r = allRoutines().find((x) => x.id === W.rid) || ROUT[0]; const k = nowInfo().k; const min = Math.max(1, Math.round((Date.now() - W.started) / 60000));
    const intensity = num(chipVal('woEff'), 1);
    db.wo.sessions = (db.wo.sessions || []).concat([{ id: uid(), d: k, ts: Date.now(), rid: r.id, title: r.t, area: r.area, min, muscles: routineMuscles(r), intensity }]).slice(-400);
    if (W.from) { db.wo.madeUp = db.wo.madeUp || {}; db.wo.madeUp[W.from] = true; }
    let newPR = 0; document.querySelectorAll('[data-pr]').forEach((i) => { if (i.value && savePR(i.dataset.pr, i.value)) newPR++; });
    hday(k).ex.push({ type: 'other', name: r.t, amt: min, min: String(min) });
    const g = customHabits().find((c) => /gym|workout|exercise|training/i.test(c.name) && c.days.includes(parseD(k).getDay()));
    if (g) day(k).h['c:' + g.id] = true;
    ui.wp = null; localStorage.removeItem('dl:wp'); location.hash = '#workout'; commit('Workout saved · ' + min + ' min' + (newPR ? ' · ' + newPR + ' new PR!' : '') + (g ? ' · ' + g.name + ' ticked' : ''));
  },
  woBuild: () => openSheet(routineSheet()),
  woBuildSave: () => {
    const t = val('rn'); if (!t) return toast('Name your routine'); const ex = [...document.querySelectorAll('#rex .chip.on')].map((c) => c.dataset.v); if (!ex.length) return toast('Pick some exercises');
    db.wo.custom = (db.wo.custom || []).concat([{ id: 'c' + uid(), t, area: chipVal('ra') || 'full', lvl: 'Custom', rounds: clamp(Math.round(num(val('rr'), 3)), 1, 10), rest: clamp(Math.round(num(val('rrest'), 30)), 0, 180), ex }]); closeSheet(); commit('Routine saved');
  },
  woPRNew: () => openSheet(prSheet()),
  woPRSave: () => { const id = chipVal('prk') || 'push'; const v = val('prv'); if (!(num(v) > 0)) return toast('Enter your result'); const isNew = savePR(id, v); closeSheet(); commit(isNew ? 'New personal record!' : 'Saved — best is still ' + fmtPR(id, db.wo.prs[id].v)); },
  woLadderLog: () => { const sets = [0, 1, 2].map((j) => val('ls' + j)).map((x) => (x === '' ? null : num(x))); db.wo.ladderLog = db.wo.ladderLog || {}; db.wo.ladderLog[ui.woLad] = sets; const L = LADDERS[ui.woLad]; const lvl = (db.wo.ladders || {})[ui.woLad] || 0; const ok = sets.filter((x) => x != null && x >= L.steps[lvl][1]).length; commit(ok >= 3 ? 'All 3 sets hit — unlock the next step!' : 'Saved · ' + ok + ' of 3 on target'); },
  woLevelUp: () => { db.wo.ladders = db.wo.ladders || {}; const L = LADDERS[ui.woLad]; db.wo.ladders[ui.woLad] = Math.min(L.steps.length - 1, (db.wo.ladders[ui.woLad] || 0) + 1); db.wo.ladderLog[ui.woLad] = []; commit('Unlocked ' + L.steps[db.wo.ladders[ui.woLad]][0] + '!'); }
});
Object.assign(A, {
  catAdd: (d, el) => { const box = el.parentNode; const old = box.querySelector('.catform'); if (old) old.remove(); el.style.display = 'none'; el.insertAdjacentHTML('afterend', catForm(d.kind, d.group)); const i = box.querySelector('#cfn'); if (i) i.focus(); },
  catCancel: (d, el) => { const f = el.closest('.catform'); const b = f.parentNode.querySelector('[data-a=catAdd]'); f.remove(); if (b) b.style.display = ''; },
  catSave: (d, el) => {
    const f = (el && el.closest && el.closest('.catform')) || document.querySelector('.catform'); if (!f) return;
    const kind = f.dataset.kind, group = f.dataset.group; const l = (f.querySelector('#cfn').value || '').trim(); if (!l) return toast('Type a name first');
    const C = db.cats; const list = (C[kind] = C[kind] || []);
    const exist = list.find((x) => x.l.toLowerCase() === l.toLowerCase());
    const id = exist ? exist.id : 'u' + uid(); const g = (sel) => { const x = f.querySelector(sel); return x ? x.value : ''; };
    if (!exist) { const item = { id, l }; if (kind === 'sector') item.c = CUSTOM_COLORS[list.length % CUSTOM_COLORS.length]; if (kind === 'ex' || kind === 'pr') item.u = g('#cfu'); if (kind === 'wex') { item.type = g('#cft') || 'reps'; item.amt = Math.max(1, Math.round(num(g('#cfa'), 10))); item.mus = g('#cfm'); } list.push(item); }
    applyCats(); save();
    const box = f.parentNode; const v = kind === 'mode' ? l : id; const toggle = group === 'rex';
    const label = kind === 'sector' ? '<i style="display:inline-block;width:8px;height:8px;border-radius:4px;background:' + (list.find((x) => x.id === id).c) + ';margin-right:6px"></i>' + esc(l) : esc(l);
    let chip = box.querySelector('[data-v="' + (window.CSS && CSS.escape ? CSS.escape(v) : v) + '"]');
    if (!chip) { f.insertAdjacentHTML('beforebegin', '<button class="chip" data-a="' + (toggle ? 'toggleChip' : 'pickChip') + '" data-group="' + group + '" data-v="' + esc(v) + '">' + label + '</button>'); chip = f.previousElementSibling; }
    if (toggle) { chip.classList.add('on'); chip.setAttribute('aria-pressed', 'true'); } else A.pickChip({ group }, chip);
    const b = box.querySelector('[data-a=catAdd]'); f.remove(); if (b) b.style.display = '';
    toast(exist ? 'Selected ' + l : 'Saved “' + l + '” — it\'s there next time');
  },
  catDel: (d) => { const C = db.cats; const x = (C[d.kind] || []).find((i) => i.id === d.id); if (!x || !confirm('Remove “' + x.l + '”? Old entries keep their data.')) return; C[d.kind] = C[d.kind].filter((i) => i.id !== d.id); if (d.kind === 'proj') delete CAT[d.id]; applyCats(); commit('Removed'); }
});
Object.assign(CH, {
  sdDestSel: (v, d) => { if (v) { ui.sd.dest[d.key] = v; render(true); } },
  sdText: (v, d) => { day(d.k)[d.f] = v.trim(); save(); },
  sdEst: (v, d) => { const t = db.tasks.find((x) => x.id === d.id); if (!t) return; t.est = v === '' ? '' : Math.max(0, Math.round(num(v))); save(); setTimeout(softRender, 0); },
  goalNow: (v, d) => { const g = db.goals.find((x) => x.id === d.id); if (!g) return; g.now = v === '' ? g.from : num(v); save(); setTimeout(softRender, 0); }
});
// pausing/deleting a habit from its stats page returns to Habits
['habitPause', 'habitDel'].forEach((name) => { const orig = A[name]; A[name] = (d, el) => { const n = db.habits.custom ? db.habits.custom.length : 0; const wasPaused = (db.habits.custom || []).filter((c) => c.archived).length; orig(d, el); const changed = (db.habits.custom || []).length !== n || (db.habits.custom || []).filter((c) => c.archived).length !== wasPaused; if (changed && route === 'hstats') location.hash = '#habits'; }; });
// restore a workout in progress after reload
try { const w = JSON.parse(localStorage.getItem('dl:wp') || 'null'); if (w && w.steps) ui.wp = w; } catch (e) {}
// live clocks for focus + workout player
setInterval(() => {
  if (route === 'focus' && db.focusRun && !db.focusRun.pausedAt) {
    const r = db.focusRun; const left = Math.max(0, Math.round(r.len * 60 - focusElapsed(r))); const c = document.getElementById('fclock');
    if (left === 0) { if (!r.doneBeep) { r.doneBeep = true; beep(); } softRender(); } else if (c) c.textContent = pad(Math.floor(left / 60)) + ':' + pad(left % 60);
    if (left % 30 === 0) softRender(); // plant grows
  }
  if (route === 'wplay' && ui.wp && ui.wp.endAt && !ui.wp.finished) {
    const rem = Math.max(0, Math.ceil((ui.wp.endAt - Date.now()) / 1000)); const c = document.getElementById('wpclock');
    if (rem <= 0) { beep(); woAdvance(); softRender(); } else if (c) c.innerHTML = rem + '<span style="font-size:24px">s</span>';
  }
}, 500);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && route === 'wplay' && ui.wp && !ui.wp.finished) keepAwake(true); });
// ensure the new data exists for older saves, then draw the current page
db.goals = db.goals || []; db.wo = db.wo || {};
const _render = render; render = function (keep) { applyCats(); return _render(keep); };
render();
