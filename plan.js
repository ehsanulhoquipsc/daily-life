'use strict';
/* Daily Life v2.2 — Workout PLAN page: Mo's 8-week home muscle & strength plan (Upper/Lower, 4 days).
   Preview route: #wplan. To make it the main Workout page, set ROUTES.workout = vWorkoutPlan (see bottom). */

// [key, label, sets, reps, load, cue, parts, type]  type: 'reps' | 'time' (seconds)
const PP_SESS = {
  ua: { t: 'Upper A', sub: 'Chest, back, triceps', c: 'tent', ex: [
    ['A1', 'Feet-elevated push-up', 4, '8–15', 'Bodyweight', '3 s down, chest to floor', ['chest', 'arms', 'shoulders'], 'reps'],
    ['A2', 'One-arm dumbbell row', 4, '10–15 each', '7.5 kg', 'Pull to hip, squeeze 1 s', ['back', 'arms'], 'reps'],
    ['B', 'Dumbbell floor press', 3, '12–20', '2 × 7.5 kg', '1 s pause, elbows on floor', ['chest', 'arms'], 'reps'],
    ['C', 'Seated Arnold press', 3, '10–15', '2 × 5 → 7.5 kg', 'Full rotation, no leg drive', ['shoulders', 'arms'], 'reps'],
    ['D1', 'Chair dips', 3, '10–20', 'Bodyweight', 'Elbows back, shoulders down', ['arms', 'chest'], 'reps'],
    ['D2', 'Hammer curl', 3, '10–15', '2 × 7.5 kg', 'No swinging', ['arms'], 'reps'],
    ['E', 'Plank', 3, '30–60 s', '—', 'Squeeze glutes', ['core'], 'time']] },
  la: { t: 'Lower A', sub: 'Quads & glutes', c: 'doc', ex: [
    ['A', 'Goblet squat', 4, '15–20', '8 kg KB', '3 s down, 1 s pause at bottom', ['legs', 'glutes'], 'reps'],
    ['B', 'Bulgarian split squat', 3, '10–15 each', '2 × 7.5 kg', 'Rear foot on chair', ['legs', 'glutes'], 'reps'],
    ['C', 'Dumbbell Romanian deadlift', 4, '12–20', '2 × 7.5 kg', 'Hips back, 3 s down', ['glutes', 'back'], 'reps'],
    ['D', 'Kettlebell swing', 3, '15–20', '8 kg KB', 'Hip snap, not a squat', ['glutes', 'back', 'core'], 'reps'],
    ['E1', 'Single-leg calf raise', 3, '12–20 each', '7.5 kg', '2 s hold at top', ['calves'], 'reps'],
    ['E2', 'Dead bug', 3, '10 each side', '—', 'Lower back flat', ['core'], 'reps']] },
  ub: { t: 'Upper B', sub: 'Shoulders, back, arms', c: 'study', ex: [
    ['A1', 'Deficit push-up', 4, '8–15', 'Bodyweight', 'Hands on dumbbells, go deep', ['chest', 'arms', 'shoulders'], 'reps'],
    ['A2', 'Bent-over two-dumbbell row', 4, '12–20', '2 × 7.5 kg', 'Flat back · 1¼ reps from wk 3', ['back', 'arms'], 'reps'],
    ['B', 'Pike push-up', 3, '6–12', 'Bodyweight', 'Feet on chair once 12 is easy', ['shoulders', 'arms'], 'reps'],
    ['C1', 'Lateral raise', 3, '12–20', '2 × 2.5 → 5 kg', 'Lead with elbows', ['shoulders'], 'reps'],
    ['C2', 'Rear-delt fly', 3, '12–20', '2 × 2.5 → 5 kg', 'Squeeze shoulder blades', ['shoulders', 'back'], 'reps'],
    ['D1', 'Dumbbell curl', 3, '10–15', '2 × 7.5 kg', '3 s down', ['arms'], 'reps'],
    ['D2', 'Overhead triceps extension', 3, '12–15', '8 kg KB', 'Elbows point up', ['arms'], 'reps'],
    ['E', 'Kettlebell halo', 2, '8 each way', '8 kg KB', 'Core tight', ['shoulders', 'core'], 'reps']] },
  lb: { t: 'Lower B', sub: 'Hamstrings & glutes', c: 'meal', ex: [
    ['A', 'Reverse lunge', 3, '10–15 each', '2 × 7.5 kg', 'Step back, torso tall', ['legs', 'glutes'], 'reps'],
    ['B', 'Single-leg dumbbell RDL', 3, '10–12 each', '7.5 kg', 'Hips square, slow', ['glutes', 'back'], 'reps'],
    ['C', 'Chair step-up', 3, '10–12 each', '2 × 7.5 kg', 'Drive through front heel', ['legs', 'glutes'], 'reps'],
    ['D', 'Single-leg hip thrust', 3, '12–15 each', '7.5 kg on hip', '2 s squeeze at top', ['glutes'], 'reps'],
    ['E', 'Cossack squat', 2, '6–8 each', '8 kg KB', 'Only as low as is comfortable', ['legs', 'glutes'], 'reps'],
    ['F1', 'Calf raise', 3, '15–20', '2 × 7.5 kg', 'Full stretch at bottom', ['calves'], 'reps'],
    ['F2', 'Side plank', 2, '30–45 s each', '—', 'Hips high', ['core'], 'time']] }
};
const PP_DEFDAYS = { 1: 'ua', 3: 'la', 5: 'ub', 0: 'lb' }; // Mon, Wed, Fri, Sun
const PP_TIME = { 0: '9:00–9:45 am', 1: '5:45–6:30 pm', 2: '5:45–6:30 pm', 3: '5:45–6:30 pm', 4: '5:45–6:30 pm', 5: '5:45–6:30 pm', 6: '' };
const PP_PHASE = [
  [1, 2, 'Foundation', 'Do 3 sets of everything. Stop 2 reps before failure and learn the tempo.'],
  [3, 5, 'Build', 'Do all sets. Take the last set to 0–1 reps before failure. Hit the top of the range on every set → make it harder.'],
  [6, 6, 'Deload', 'Same weights, half the sets. Let your body recover and grow.'],
  [7, 8, 'Peak', 'Add a drop set to the last set of the first two exercises.']
];
const PP_WARM = ['Jump rope · 2 min easy', 'Kettlebell halos · 8 each way', 'Squats ×10 · arm circles ×10', 'One light set of the first exercise'];
const PP_TEST = [['push', 'Push-ups', 21, 30, ''], ['squat', 'Squats', 35, 50, ''], ['plank', 'Plank', 25, 60, 's']];

function ppDays() { return db.wo.ppDays = db.wo.ppDays || Object.assign({}, PP_DEFDAYS); }
function ppStart() { if (!db.wo.ppStart) { const k = nowInfo().k; db.wo.ppStart = weekKeys(k)[0]; } return db.wo.ppStart; }
function ppWeek(k) { return Math.floor(diffD(ppStart(), k) / 7) + 1; }
function ppPhase(w) { return PP_PHASE.find((p) => w >= p[0] && w <= p[1]) || null; }
function ppSets(base, w) { return w <= 2 ? Math.min(base, 3) : w === 6 ? Math.ceil(base / 2) : base; }
const ppExId = (s, e) => 'pp:' + s + ':' + e[0];
function ppLogsOn(k, s) { return wsLogs().filter((l) => l.d === k && l.ex.indexOf('pp:' + s + ':') === 0); }
function ppLast(id, before) { return wsLogs().filter((l) => l.ex === id && (!before || l.d < before)).sort((a, b) => b.ts - a.ts)[0]; }
const ppSetTxt = (l, type) => l.sets.map((x, i) => (type === 'time' ? Math.round(num(x[1]) * 60) + 's' : x[0]) + (l.w && num(l.w[i]) ? '×' + l.w[i] : '')).join(', ');

// body map (same as the v2.0 page): how busy each body part was over the last 7 days
function ppBodyMap() {
  const W = wsWeek(); const S = ui.ws; const side = S.side;
  const sel = WSHAPES[side].some((x) => x[0] === S.part) ? S.part : (WSHAPES[side].slice().sort((a, b) => W.load[a[0]] - W.load[b[0]])[0] || ['core'])[0];
  const L = wLvl(W.load[sel]); const untouched = WPARTS.filter(([p]) => !W.load[p]).map(([, n]) => n);
  const body = '<svg width="150" height="250" viewBox="0 0 150 250" role="img" aria-label="Body map, last 7 days" style="flex:0 0 150px"><circle cx="75" cy="20" r="15" fill="var(--line)"/><rect x="68" y="34" width="14" height="10" rx="4" fill="var(--line)"/>' +
    WSHAPES[side].map(([p, d]) => '<path d="' + d + '" fill="' + wLvl(W.load[p])[1] + '" stroke="' + (p === sel ? 'var(--ink)' : 'var(--card)') + '" stroke-width="' + (p === sel ? 2.5 : 1.5) + '" data-a="wsPart" data-v="' + p + '" style="cursor:pointer"><title>' + WPN[p] + ': ' + W.load[p] + ' sets</title></path>').join('') + '</svg>';
  return '<section class="card"><div class="row between" style="align-items:flex-start"><div><h2>Your body · last 7 days</h2><div class="small muted">' + W.sets + ' set' + (W.sets === 1 ? '' : 's') + ' across ' + W.days + ' day' + (W.days === 1 ? '' : 's') + '</div></div><div class="row" style="gap:4px">' + [['front', 'Front'], ['back', 'Back']].map(([v, l]) => '<button class="chip' + (side === v ? ' on' : '') + '" data-a="wsSide" data-v="' + v + '" style="height:32px">' + l + '</button>').join('') + '</div></div>' +
    '<div class="row" style="gap:12px">' + body + '<div class="grow col" style="gap:8px;min-width:0"><div style="background:var(--soft);border-radius:12px;padding:10px 12px"><div class="small b muted">' + WPN[sel] + '</div><div class="xb" style="font-size:22px;color:' + L[2] + '">' + L[0] + '</div><div class="small muted" style="line-height:1.4">' + (W.load[sel] ? W.load[sel] + ' sets this week from ' + esc([...W.by[sel]].join(', ')) + '.' : 'No exercise worked this in the last 7 days.') + '</div></div>' +
    '<div class="col small b" style="gap:5px">' + [['Not touched', 'var(--line)'], ['Light · 1–3 sets', '#A6DDB7'], ['Worked · 4–7 sets', '#3E8E5E'], ['Busy · 8+ sets', '#1E5233']].map(([t, c]) => '<span class="row" style="gap:6px"><i style="width:10px;height:10px;border-radius:3px;background:' + c + '"></i>' + t + '</span>').join('') + '</div></div></div>' +
    (untouched.length ? '<div class="sm" style="background:var(--warn-bg);color:var(--warn-fg);border-radius:12px;padding:10px 12px;line-height:1.45"><b>Not touched this week:</b> ' + untouched.join(', ') + '.</div>' : '<div class="sm b" style="background:var(--good-bg);color:var(--good-fg);border-radius:12px;padding:10px 12px">Every body part got some work this week.</div>') + '</section>';
}

ui.pp = { day: '', open: '', draft: [] };
function vWorkoutPlan() {
  const k = nowInfo().k; const D = ppDays(); const wk = weekKeys(k); const w = ppWeek(k); const ph = ppPhase(w); const P = ui.pp;
  const sessOf = (x) => D[parseD(x).getDay()] || null;
  const doneOf = (x) => { const s = sessOf(x); return s ? ppLogsOn(x, s).length : 0; };
  const sel = wk.includes(P.day) ? P.day : k;
  // ---- hero: week + phase
  const segs = [1, 2, 3, 4, 5, 6, 7, 8].map((i) => '<i style="flex:1;height:6px;border-radius:3px;background:' + (i < w ? '#6FCF97' : i === w ? '#fff' : 'rgba(255,255,255,.18)') + '"></i>').join('');
  const hero = '<section class="hero" style="flex-direction:column;align-items:stretch;gap:8px">' +
    (w < 1 ? '<div class="small b" style="color:var(--heroMuted)">STARTS ' + nice(ppStart()).toUpperCase() + '</div><div class="xb" style="font-size:22px">8-week plan</div>' :
      w > 8 ? '<div class="small b" style="color:var(--heroMuted)">8 WEEKS DONE</div><div class="xb" style="font-size:22px">Retest time</div><div class="sm" style="color:var(--heroMuted)">Test push-ups, squats and plank below, weigh in, then restart or ask for the next block.</div>' :
      '<div class="row between small b" style="color:var(--heroMuted)"><span>WEEK ' + w + ' OF 8</span><span>' + ph[2].toUpperCase() + '</span></div><div class="xb" style="font-size:22px">' + ph[2] + ' phase</div><div class="sm" style="color:var(--heroMuted);line-height:1.45">' + ph[3] + '</div>') +
    '<div class="row" style="gap:4px;padding-top:2px">' + segs + '</div></section>';
  // ---- week strip
  const strip = wk.map((x) => {
    const s = sessOf(x); const n = doneOf(x); const tot = s ? PP_SESS[s].ex.length : 0; const isT = x === k, isS = x === sel;
    const done = s && n >= Math.ceil(tot / 2), missed = s && x < k && !n;
    const dot = done ? '#3E8E5E' : missed ? '#C2410C' : !s ? 'var(--line2)' : isT ? 'var(--ink)' : 'var(--' + PP_SESS[s].c + ')';
    const mark = done ? '✓' : missed ? '!' : !s ? '–' : '';
    return '<button data-a="ppDay" data-k="' + x + '" aria-pressed="' + isS + '" aria-label="' + nice(x) + ': ' + (s ? PP_SESS[s].t : 'Rest') + (done ? ', done' : missed ? ', missed' : '') + '" style="height:76px;border-radius:14px;border:2px solid ' + (isS ? 'var(--ink)' : isT ? 'var(--warn)' : 'var(--line)') + ';background:' + (isS ? 'var(--soft)' : 'var(--card)') + ';cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;padding:0;color:var(--ink)">' +
      '<span class="small b">' + DOW[parseD(x).getDay()] + '</span><span style="width:26px;height:26px;border-radius:13px;background:' + dot + ';color:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800">' + mark + '</span>' +
      '<span style="font-size:9.5px;font-weight:700;white-space:nowrap' + (s ? '' : ';color:var(--muted)') + '">' + (s ? PP_SESS[s].t : 'Rest') + '</span></button>';
  }).join('');
  const planned = wk.filter(sessOf).length, doneW = wk.filter((x) => { const s = sessOf(x); return s && doneOf(x) >= Math.ceil(PP_SESS[s].ex.length / 2); }).length;
  const missedW = wk.filter((x) => sessOf(x) && x < k && !doneOf(x));
  // ---- selected day
  const s = sessOf(sel); let dayCard;
  if (!s) {
    dayCard = '<section class="card"><div class="small b muted">' + DOWL[parseD(sel).getDay()].toUpperCase() + (sel === k ? ' · TODAY' : '') + '</div><h2>Rest day</h2><div class="sm muted" style="line-height:1.45">Muscles grow while you recover. A walk or light stretching is fine. Keep your daily push-ups easy.</div>' +
      (missedW.length && sel >= k ? '<div class="sm" style="background:var(--warn-bg);color:var(--warn-fg);border-radius:12px;padding:10px 12px;line-height:1.45"><b>Missed ' + missedW.map((x) => DOW[parseD(x).getDay()] + '\'s ' + PP_SESS[sessOf(x)].t).join(' and ') + '.</b> Do it today instead and keep the A/B order.<button class="btn sm full" data-a="ppDay" data-k="' + missedW[missedW.length - 1] + '" style="margin-top:8px">Open ' + PP_SESS[sessOf(missedW[missedW.length - 1])].t + '</button></div>' : '') + '</section>';
  } else {
    const S = PP_SESS[s]; const logs = ppLogsOn(sel, s); const C = S.c;
    const rows = S.ex.map((e) => {
      const id = ppExId(s, e); const lg = logs.filter((l) => l.ex === id); const isOpen = P.open === id; const sets = ppSets(e[2], Math.max(1, w));
      const last = ppLast(id, sel); const done = lg.length > 0;
      let panel = '';
      if (isOpen) {
        const ph = last ? last.sets : []; const pw = last ? last.w || [] : []; const isT = e[7] === 'time';
        panel = '<div style="background:var(--soft);border-radius:14px;padding:12px;margin:0 0 10px;display:flex;flex-direction:column;gap:8px">' +
          '<div style="display:grid;grid-template-columns:36px 1fr 1fr 36px;gap:6px" class="small b muted"><span>Set</span><span>' + (isT ? 'Seconds' : 'Reps') + '</span><span>' + (isT ? '' : 'kg') + '</span><span></span></div>' +
          P.draft.map((d, j) => '<div style="display:grid;grid-template-columns:36px 1fr 1fr 36px;gap:6px;align-items:center"><span class="xb">' + (j + 1) + '</span>' +
            '<input type="number" inputmode="numeric" class="in" data-c="ppDraft" data-j="' + j + '" data-f="0" value="' + esc(d[0]) + '" placeholder="' + esc(ph[j] ? (isT ? Math.round(num(ph[j][1]) * 60) : ph[j][0]) : '—') + '" aria-label="' + (isT ? 'Seconds' : 'Reps') + ' set ' + (j + 1) + '" style="height:42px;text-align:center;font-weight:800;font-size:16px;padding:0 6px">' +
            (isT ? '<span></span>' : '<input type="number" inputmode="decimal" step="0.5" class="in" data-c="ppDraft" data-j="' + j + '" data-f="1" value="' + esc(d[1]) + '" placeholder="' + esc(pw[j] || e[4].match(/[\d.]+(?= ?kg)/) || '—') + '" aria-label="kg set ' + (j + 1) + '" style="height:42px;text-align:center;font-weight:800;font-size:16px;padding:0 6px">') +
            '<button class="del" data-a="ppDelSet" data-j="' + j + '" aria-label="Remove set ' + (j + 1) + '" style="width:36px;height:36px">' + ic('x', 14) + '</button></div>').join('') +
          '<div class="grid2"><button class="btn ghost sm" data-a="ppAddSet" style="border-style:dashed">+ Set</button><button class="btn sm" data-a="ppSave" data-s="' + s + '" data-e="' + e[0] + '" data-k="' + sel + '">Save</button></div>' +
          '<div class="small muted">Grey numbers are last time. Beat them by 1 rep, or add weight once you hit the top of the range on every set.</div></div>';
      }
      return '<div style="border-top:1px solid var(--line)"><button class="tap row" data-a="ppOpen" data-id="' + id + '" aria-expanded="' + isOpen + '" style="padding:10px 0;gap:12px;align-items:flex-start;width:100%;text-align:left">' +
        '<span style="width:40px;height:40px;flex:0 0 40px;border-radius:12px;background:' + (done ? 'var(--good)' : 'var(--' + C + '-bg)') + ';color:' + (done ? '#fff' : 'var(--' + C + '-fg)') + ';display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:800">' + (done ? '✓' : e[0]) + '</span>' +
        '<span class="grow"><span class="b" style="display:block;font-size:15px">' + esc(e[1]) + '</span><span class="sm b" style="display:block">' + sets + ' × ' + e[3] + (e[4] !== '—' ? ' · <span class="muted" style="font-weight:600">' + esc(e[4]) + '</span>' : '') + '</span>' +
        '<span class="small muted" style="display:block">' + esc(e[5]) + '</span>' +
        (done ? '<span class="small b" style="display:block;color:var(--good-fg)">Done: ' + esc(ppSetTxt(lg[lg.length - 1], e[7])) + '</span>' : last ? '<span class="small b muted" style="display:block">Last: ' + esc(ppSetTxt(last, e[7])) + '</span>' : '') + '</span></button>' + panel + '</div>';
    }).join('');
    const nDone = new Set(logs.map((l) => l.ex)).size;
    dayCard = '<section class="card"><div class="row between" style="align-items:flex-start"><div><div class="small b muted">' + DOWL[parseD(sel).getDay()].toUpperCase() + (sel === k ? ' · TODAY' : '') + (PP_TIME[parseD(sel).getDay()] ? ' · ' + PP_TIME[parseD(sel).getDay()] : '') + '</div><h2 style="font-size:20px">' + S.t + '</h2><div class="sm muted">' + S.sub + ' · ~45 min</div></div>' +
      '<span class="pill" style="background:var(--' + (nDone === S.ex.length ? 'good' : C) + '-bg);color:var(--' + (nDone === S.ex.length ? 'good' : C) + '-fg)">' + nDone + '/' + S.ex.length + '</span></div>' +
      '<div class="bar" style="height:6px"><i style="width:' + (nDone / S.ex.length * 100) + '%;background:var(--good)"></i></div>' +
      '<details style="background:var(--soft);border-radius:12px;padding:8px 12px"><summary class="sm b">Warm-up · 5 min</summary><ol class="sm" style="margin:6px 0 2px;padding-left:18px;line-height:1.7">' + PP_WARM.map((x) => '<li>' + x + '</li>').join('') + '</ol></details>' +
      '<div>' + rows + '</div><div class="small muted">Rest 60–90 s on big lifts, 45–60 s on small ones. A1/A2 = alternate, then rest. Tap an exercise to log it.</div></section>';
  }
  // ---- progress check
  const prs = db.wo.prs || {};
  const test = PP_TEST.map(([id, l, b, t, u]) => { const v = prs[id] ? prs[id].v : b; const p = clamp((v - b) / (t - b), 0, 1);
    return '<div class="col" style="gap:4px"><div class="row between sm"><span class="b">' + l + '</span><span><b>' + v + u + '</b> <span class="muted">→ ' + t + u + '</span></span></div><div class="bar" style="height:6px"><i style="width:' + (p * 100) + '%;background:var(--good)"></i></div></div>'; }).join('');
  // ---- schedule editor
  const edit = '<details style="border-top:1px solid var(--line);padding-top:6px"><summary class="sm">Change training days</summary><div class="col" style="margin-top:8px;gap:8px">' +
    Object.keys(PP_SESS).map((sid) => { const cur = Object.keys(D).find((d) => D[d] === sid); return '<div class="row" style="gap:6px"><span class="b sm" style="width:62px">' + PP_SESS[sid].t + '</span><div class="chips" style="flex-wrap:nowrap;overflow-x:auto">' + DAYS_ORDER.map((d) => '<button class="chip' + (String(d) === cur ? ' on' : '') + '" data-a="ppSetDay" data-s="' + sid + '" data-d="' + d + '" style="height:32px;padding:0 9px;font-size:12px">' + DOW[d] + '</button>').join('') + '</div></div>'; }).join('') +
    '<div class="small muted">Keep a rest day between Upper sessions and between Lower sessions.</div></div></details>';
  return '<header class="row between" style="align-items:baseline"><h1>Workout</h1><div class="sm muted">' + nice(k) + '</div></header>' + hwSeg('workout') + hero +
    '<section class="card"><div class="head"><h2>This week</h2><span class="sm muted">' + doneW + ' of ' + planned + ' done</span></div><div style="display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px">' + strip + '</div>' + edit + '</section>' +
    dayCard + ppBodyMap() +
    '<section class="card"><div class="head"><h2>Week 8 targets</h2><button class="link" data-a="woPRNew">+ Test now</button></div>' + test + '<div class="small muted">Starts from your baseline. Retest every 2 weeks.</div></section>' +
    '<div class="small muted" style="text-align:center">Logging here also adds to Health → Exercise and ticks a habit called Gym or Workout.</div>';
}
Object.assign(A, {
  ppDay: (d) => { ui.pp.day = d.k; ui.pp.open = ''; render(true); },
  ppOpen: (d) => {
    if (ui.pp.open === d.id) { ui.pp.open = ''; return render(true); }
    const [, s, e] = d.id.split(':'); const ex = PP_SESS[s].ex.find((x) => x[0] === e); const n = ppSets(ex[2], Math.max(1, ppWeek(nowInfo().k)));
    ui.pp.open = d.id; ui.pp.draft = Array.from({ length: n }, () => ['', '']); render(true);
  },
  ppAddSet: () => { ui.pp.draft.push(['', '']); render(true); },
  ppDelSet: (d) => { ui.pp.draft.splice(+d.j, 1); if (!ui.pp.draft.length) ui.pp.draft.push(['', '']); render(true); },
  ppSave: (d) => {
    const ex = PP_SESS[d.s].ex.find((x) => x[0] === d.e); const isT = ex[7] === 'time'; const id = 'pp:' + d.s + ':' + d.e;
    const rows = ui.pp.draft.filter((x) => num(x[0]) > 0);
    if (!rows.length) return toast('Enter ' + (isT ? 'seconds' : 'reps') + ' for at least one set');
    const sets = rows.map((x) => isT ? [0, Math.round(num(x[0]) / 6) / 10] : [Math.round(num(x[0])), 0]);
    const prev = ppLast(id); const defW = (ex[4].match(/[\d.]+(?= ?kg)/) || [''])[0]; // blank kg = the grey hint (last time, else plan weight)
    const wts = ui.pp.draft.map((x, j) => [x, j]).filter(([x]) => num(x[0]) > 0).map(([x, j]) => (isT ? '' : num(x[1]) ? String(num(x[1])) : (prev && prev.w && prev.w[j]) || defW));
    const k = d.k || nowInfo().k;
    wsLogs().push({ id: uid(), ex: id, name: ex[1], parts: ex[6], d: k, ts: Date.now(), sets, w: wts });
    const mins = sets.reduce((a, x) => a + x[1], 0);
    hday(k).ex.push({ type: 'other', name: ex[1], amt: '', min: mins ? String(mins) : '', text: sets.length + ' set' + (sets.length === 1 ? '' : 's') + ' · ' + ppSetTxt({ sets, w: wts }, ex[7]) });
    const g = customHabits().find((c) => /gym|workout|exercise|training/i.test(c.name) && c.days.includes(parseD(k).getDay())); if (g) day(k).h['c:' + g.id] = true;
    ui.pp.open = ''; ui.pp.draft = []; commit('Saved ' + ex[1] + (g ? ' · ' + g.name + ' ticked' : ''));
  },
  ppSetDay: (d) => {
    const D = ppDays(); const old = Object.keys(D).find((x) => D[x] === d.s);
    if (D[d.d] && D[d.d] !== d.s && old != null) D[old] = D[d.d]; else if (old != null) delete D[old]; // swap if the day was taken
    D[d.d] = d.s; commit(PP_SESS[d.s].t + ' moved to ' + DOWL[d.d]);
  }
});
Object.assign(CH, { ppDraft: (v, d) => { const r = ui.pp.draft[+d.j]; if (r) r[+d.f] = v; } });
Object.assign(ROUTES, { wplan: vWorkoutPlan });
Object.assign(NAVPARENT, { wplan: 'health' });
// v2.2: the plan page is now the main Workout page (old simple page kept as vWorkoutSimple).
ROUTES.workout = vWorkoutPlan;
