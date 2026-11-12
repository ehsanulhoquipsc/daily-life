'use strict';
/* Daily Life v2.3 — English speaking practice page (#speak): 30-minute daily session for work & interview English.
   Data lives in db.habits.eng (syncs with the rest of habits). Finishing all 5 steps ticks the Public speaking habit
   and adds a 30-minute entry to db.habits.speaking, so Habits, Home and the 10-day report pick it up. */

// [name, what to do, minutes]
const SPK_STEPS = [
  ['Mouth warm-up', 'Jaw release, lip trills, tongue stretches, vowels, twister', 3],
  ['Read aloud', 'Short work passage, clear and slow', 4],
  ['Shadowing', 'Repeat after an interview clip, copy the stress', 9],
  ['Talk with Claude', 'Mock interview with feedback', 9],
  ['Record and rate', 'Answer today\'s question, then rate below', 5]
];
const SPK_TOTAL = SPK_STEPS.reduce((a, s) => a + s[2], 0);
// [twister, target sounds]
const SPK_TWIST = [
  ['Red lorry, yellow lorry', 'R and L'], ['She sells seashells by the seashore', 'S and SH'], ['Three free throws', 'TH, F and R'],
  ['Very well, very well, very well', 'V and W'], ['Unique New York, unique New York', 'N and Y'], ['A proper copper coffee pot', 'P and K'],
  ['Truly rural, truly rural', 'R and L'], ['Thirty-three thieves thought they thrilled the throne', 'TH']
];
// [question, type]
const SPK_QS = [
  ['Tell me about yourself.', 'Introduction'], ['Walk me through your resume.', 'Introduction'], ['What do you know about our company?', 'Introduction'], ['How would your friends or colleagues describe you?', 'Introduction'],
  ['Why do you want this role?', 'Motivation'], ['Why do you want to work here?', 'Motivation'], ['Why are you leaving your current job?', 'Motivation'], ['What motivates you at work?', 'Motivation'], ['What kind of work environment suits you best?', 'Motivation'],
  ['What is your biggest strength?', 'Strengths'], ['What is your biggest weakness?', 'Strengths'], ['Why should we hire you?', 'Strengths'], ['What makes you different from other candidates?', 'Strengths'], ['What skill are you working on right now?', 'Strengths'], ['What achievement are you most proud of?', 'Strengths'],
  ['Describe a time you solved a problem at work.', 'Behavioural'], ['Tell me about a time you made a mistake.', 'Behavioural'], ['Tell me about a time you worked in a team.', 'Behavioural'], ['Describe a time you disagreed with someone at work.', 'Behavioural'], ['Tell me about a time you had to meet a tight deadline.', 'Behavioural'],
  ['Describe a time you showed leadership.', 'Behavioural'], ['Tell me about a time you dealt with a difficult customer.', 'Behavioural'], ['Describe a time you learned something quickly.', 'Behavioural'], ['Tell me about a time you failed and what you learned.', 'Behavioural'], ['Describe a time you went beyond what was expected.', 'Behavioural'], ['Tell me about a time you received critical feedback.', 'Behavioural'],
  ['How do you handle pressure or stress?', 'Work style'], ['How do you prioritise when everything is urgent?', 'Work style'], ['How do you stay organised?', 'Work style'], ['Do you prefer working alone or in a team?', 'Work style'], ['How do you handle a task you have never done before?', 'Work style'], ['How do you explain something technical to a non-technical person?', 'Work style'],
  ['Explain a project you built and your part in it.', 'Technical'], ['What technology are you most comfortable with, and why?', 'Technical'], ['How do you find and fix a bug you do not understand?', 'Technical'], ['How do you keep your skills up to date?', 'Technical'],
  ['Where do you see yourself in three years?', 'Goals'], ['What are your salary expectations?', 'Goals'], ['When can you start, and what is your availability?', 'Goals'], ['Do you have any questions for us?', 'Goals']
];
const SPK = { state: 'idle', rec: null, chunks: [], url: '', blob: null, err: '' }; // recording lives in memory only

function spkE() { return db.habits.eng = db.habits.eng || { days: {}, words: [], qd: {}, qi: 0 }; }
function spkDay(k) {
  const E = spkE();
  if (!E.days[k]) {
    for (let i = 0; i < SPK_QS.length && E.qd[E.qi]; i++) E.qi = (E.qi + 1) % SPK_QS.length; // start on a question not practised yet
    E.days[k] = { s: {}, q: E.qi };
  }
  return E.days[k];
}
const spkPeek = (k) => spkE().days[k] || null;
const spkDone = (k) => { const d = spkPeek(k); return !!d && SPK_STEPS.every((_, i) => d.s && d.s[i]); };
const spkMin = (k) => { const d = spkPeek(k); return d ? SPK_STEPS.reduce((a, s, i) => a + (d.s && d.s[i] ? s[2] : 0), 0) : 0; };
const spkAvg = (d) => { if (!d) return null; const v = ['fl', 'pr', 'cf'].map((f) => d[f]).filter((x) => x > 0); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
const spkDur = (m) => (m >= 60 ? Math.floor(m / 60) + 'h' + (m % 60 ? ' ' + (m % 60) + 'm' : '') : m + 'm');
// keep the Public speaking habit and the speaking log in step with the session
function spkSync(k) {
  const d = spkDay(k); const L = db.habits.speaking; const i = L.findIndex((x) => x.eng && x.d === k); const a = spkAvg(d);
  if (spkDone(k)) {
    const rate = a ? Math.round(a) : 3;
    if (i < 0) L.unshift({ d: k, topic: 'English: ' + SPK_QS[d.q][0], min: SPK_TOTAL, mode: 'English session', rate, note: '', eng: true }); else L[i].rate = rate;
    day(k).h.talk = true;
  } else if (i >= 0) { L.splice(i, 1); if (!L.some((x) => x.d === k)) day(k).h.talk = false; }
}

function vSpeak() {
  const k = nowInfo().k; const E = spkE(); const d = spkDay(k);
  const minDone = spkMin(k); const left = SPK_STEPS.filter((_, i) => !d.s[i]).length;
  const weekMin = weekKeys(k).reduce((a, x) => a + spkMin(x), 0);
  const nQ = Object.keys(E.qd).length;
  const tiles = '<section class="grid3">' +
    '<div class="kpi"><span class="small muted b">Streak</span><b style="color:var(--warn)">' + streak(spkDone) + ' days</b><span class="small muted">best ' + best(spkDone) + '</span></div>' +
    '<div class="kpi"><span class="small muted b">This week</span><b>' + spkDur(weekMin) + '</b><span class="small muted">of 3h 30m</span></div>' +
    '<div class="kpi"><span class="small muted b">Questions</span><b style="color:var(--tent-fg)">' + nQ + ' / ' + SPK_QS.length + '</b><span class="small muted">practised</span></div></section>';

  const steps = SPK_STEPS.map((s, i) => { const on = !!d.s[i]; return '<button data-a="spkStep" data-i="' + i + '" aria-pressed="' + on + '" style="min-height:60px;padding:8px 12px;border-radius:14px;border:1px solid ' + (on ? 'transparent' : 'var(--line)') + ';background:' + (on ? 'var(--tent-bg)' : 'var(--card)') + ';display:flex;align-items:center;gap:12px;text-align:left;cursor:pointer;width:100%">' +
    '<span style="width:26px;height:26px;flex:0 0 26px;border-radius:13px;border:2px solid ' + (on ? 'var(--tent)' : 'var(--line2)') + ';background:' + (on ? 'var(--tent)' : 'transparent') + ';display:flex;align-items:center;justify-content:center"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="' + (on ? '#fff' : 'transparent') + '" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg></span>' +
    '<span class="grow"><span class="b" style="display:block;font-size:15px">' + s[0] + '</span><span class="small muted" style="line-height:1.35;display:block">' + s[1] + '</span></span><span class="sm b muted" style="white-space:nowrap">' + s[2] + ' min</span></button>'; }).join('');
  const session = '<section class="card"><div class="head"><h2>Today\'s session</h2><span class="sm b" style="color:var(--tent-fg)">' + minDone + ' of ' + SPK_TOTAL + ' min</span></div>' +
    '<div class="bar" style="height:8px"><i style="width:' + pct(minDone, SPK_TOTAL) + '%;background:var(--tent)"></i></div><div class="col" style="gap:8px">' + steps + '</div>' +
    '<div class="sm" style="background:var(--bg);border-radius:12px;padding:10px 12px;line-height:1.45">' + (left === 0 ? 'Session complete. Public speaking habit ticked for today.' : left + (left === 1 ? ' step' : ' steps') + ' left · ' + (SPK_TOTAL - minDone) + ' min to go. Tap a step when you finish it.') + '</div></section>';

  const tw = SPK_TWIST[parseD(k).getDate() % SPK_TWIST.length]; const hard = E.words.filter((w) => !w.ok).slice(0, 4);
  const twister = '<section class="card tight"><div class="head"><h2>Warm-up twister</h2><span class="small muted">targets ' + tw[1] + '</span></div><div class="b" style="font-size:18px;line-height:1.35">' + tw[0] + '</div>' +
    '<div class="small muted" style="line-height:1.45">Three times slow, three times fast. Open wide, slow down, breathe low.' + (hard.length ? ' Then say each of these 3 times: <b>' + hard.map((w) => esc(w.t)).join(', ') + '</b>.' : '') + '</div></section>';

  const q = SPK_QS[d.q] || SPK_QS[0]; const canRec = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
  const recLine = SPK.err ? esc(SPK.err) : SPK.state === 'rec' ? 'Recording… speak for 1–2 minutes, then tap Stop.' : SPK.state === 'done' ? 'Listen back and rate it below. The recording is not saved in the app, so save or share it now if you want feedback on it.' : canRec ? 'Records on this phone only. Save or share the file afterwards for feedback.' : 'Recording is not available in this browser. Use your phone\'s voice recorder instead.';
  const player = SPK.state === 'done' && SPK.url ? '<audio controls src="' + SPK.url + '" style="width:100%"></audio><div class="row" style="gap:8px"><a class="btn ghost sm grow" href="' + SPK.url + '" download="' + spkFile() + '">Save file</a>' + (navigator.share ? '<button class="btn ghost sm grow" data-a="spkShare">Share</button>' : '') + '</div>' : '';
  const question = '<section class="card"><div class="head"><h2>Today\'s question</h2><span class="small muted">' + q[1] + ' · ' + (d.q + 1) + ' of ' + SPK_QS.length + (E.qd[d.q] ? ' · practised' : '') + '</span></div>' +
    '<div class="xb" style="font-size:20px;letter-spacing:-.3px;line-height:1.3">' + q[0] + '</div><div class="small muted" style="line-height:1.45">Answer for 1–2 minutes. Pause instead of saying "um".</div>' +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><button class="btn" data-a="spkRec"' + (canRec ? '' : ' disabled style="opacity:.5"') + '>' + (SPK.state === 'rec' ? 'Stop' : SPK.state === 'done' ? 'Record again' : 'Record answer') + '</button><button class="btn ghost" data-a="spkNextQ">Next question</button></div>' +
    player + '<div class="small muted" style="line-height:1.45">' + recLine + '</div></section>';

  const rateRow = (f, label) => '<div><div class="sm b" style="margin-bottom:6px">' + label + '</div><div class="chips" style="display:grid;grid-template-columns:repeat(5,1fr)">' + [1, 2, 3, 4, 5].map((n) => '<button class="chip' + (d[f] === n ? ' on' : '') + '" data-a="spkRate" data-f="' + f + '" data-v="' + n + '" aria-pressed="' + (d[f] === n) + '" aria-label="' + label + ' ' + n + '" style="height:44px">' + n + '</button>').join('') + '</div></div>';
  const rate = '<section class="card"><div class="head"><h2>Rate today</h2><span class="small muted">1 weak · 5 strong</span></div>' + rateRow('fl', 'Fluency') + rateRow('pr', 'Pronunciation') + rateRow('cf', 'Confidence') +
    '<div class="row between"><div><div class="sm b">Filler words</div><div class="small muted">um, uh, like, you know</div></div><div class="row"><button class="btn ghost" data-a="spkFill" data-d="-1" aria-label="One fewer filler word" style="width:44px;height:44px;padding:0;font-size:20px">−</button><span class="xb" style="min-width:28px;text-align:center;font-size:22px">' + (d.fill == null ? '–' : d.fill) + '</span><button class="btn ghost" data-a="spkFill" data-d="1" aria-label="One more filler word" style="width:44px;height:44px;padding:0;font-size:20px">+</button></div></div></section>';

  const keys = Array.from({ length: 10 }, (_, i) => addD(k, i - 9));
  const pts = keys.map((x, i) => [i, spkAvg(spkPeek(x))]).filter((p) => p[1] != null).map(([i, v]) => [(6 + i * 314 / 9).toFixed(1), (90 - (v - 1) / 4 * 80).toFixed(1), i === 9]);
  const fills = keys.map((x) => spkPeek(x)).filter((x) => x && x.fill != null).map((x) => x.fill);
  const chart = pts.length ? '<svg viewBox="0 0 326 100" role="img" aria-label="Average rating over the last 10 days" style="width:100%;display:block"><line x1="0" y1="10" x2="326" y2="10" stroke="var(--soft)"/><line x1="0" y1="50" x2="326" y2="50" stroke="var(--soft)"/><line x1="0" y1="90" x2="326" y2="90" stroke="var(--soft)"/>' +
    (pts.length > 1 ? '<polyline points="' + pts.map((p) => p[0] + ',' + p[1]).join(' ') + '" fill="none" stroke="var(--tent)" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>' : '') + pts.map((p) => '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="' + (p[2] ? 5 : 4) + '" fill="var(--tent)"/>').join('') + '</svg>' +
    '<div class="row between small muted b"><span>' + nice(keys[0]) + '</span><span>Today' + (spkAvg(d) ? ' · ' + spkAvg(d).toFixed(1) : '') + '</span></div>' : empty('Rate a session to see your trend.');
  const trend = '<section class="card"><div class="head"><h2>Last 10 days</h2><span class="small muted">average rating</span></div>' + chart +
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><div style="background:var(--bg);border-radius:12px;padding:10px 12px"><div class="small muted b">Filler words</div><div class="xb" style="font-size:16px">' + (fills.length > 1 ? fills[0] + ' → ' + fills[fills.length - 1] : fills.length ? fills[0] : '—') + '</div></div>' +
    '<div style="background:var(--bg);border-radius:12px;padding:10px 12px"><div class="small muted b">Sessions done</div><div class="xb" style="font-size:16px">' + keys.filter(spkDone).length + ' of 10</div></div></div><a class="link" href="#reports">Session minutes go into your 10-day report ›</a></section>';

  const words = '<section class="card"><div class="head"><h2>Tricky words</h2><span class="small muted">tap when you can say it clearly</span></div>' +
    (E.words.length ? '<div class="chips">' + E.words.map((w, i) => '<button class="chip" data-a="spkWord" data-i="' + i + '" aria-pressed="' + !!w.ok + '" style="height:44px;border-radius:22px;font-size:14px' + (w.ok ? ';background:var(--soft);color:var(--muted);border-color:transparent;text-decoration:line-through' : '') + '">' + esc(w.t) + '</button>').join('') + '</div>' : empty('Add words you find hard to say.')) +
    '<div style="display:grid;grid-template-columns:1fr auto;gap:8px"><label class="sr" for="spkW">Add a tricky word</label><input id="spkW" class="in" placeholder="e.g. thorough" autocapitalize="off"><button class="btn" data-a="spkWordAdd">Add</button></div>' +
    (E.words.some((w) => w.ok) ? '<button class="link" data-a="spkWordClear">Remove the ones I can say</button>' : '') + '</section>';

  return backHead('English speaking', 'Every day · ' + SPK_TOTAL + ' min · work & interviews', 'habits') + tiles + session + twister + question + rate + trend + words +
    '<div class="small muted" style="text-align:center">Finishing all 5 steps ticks Public speaking and logs ' + SPK_TOTAL + ' minutes.</div>';
}
function spkFile() { return 'speaking-' + nowInfo().k + (SPK.blob && /mp4|aac|m4a/.test(SPK.blob.type) ? '.m4a' : SPK.blob && /ogg/.test(SPK.blob.type) ? '.ogg' : '.webm'); }
function spkRefresh() { if (route === 'speak') render(true); }

Object.assign(A, {
  spkStep: (d) => { const k = nowInfo().k; const D = spkDay(k); const i = +d.i; D.s[i] = !D.s[i]; if (!D.s[i]) delete D.s[i]; if (i === 4 && D.s[4]) spkE().qd[D.q] = true; const was = db.habits.speaking.some((x) => x.eng && x.d === k); spkSync(k); commit(spkDone(k) && !was ? 'Session complete. Public speaking ticked.' : ''); },
  spkNextQ: () => { const E = spkE(); const D = spkDay(nowInfo().k); E.qi = D.q = (D.q + 1) % SPK_QS.length; commit(); },
  spkRate: (d) => { const k = nowInfo().k; const D = spkDay(k); const n = +d.v; if (D[d.f] === n) delete D[d.f]; else D[d.f] = n; spkSync(k); commit(); },
  spkFill: (d) => { const D = spkDay(nowInfo().k); D.fill = Math.max(0, (D.fill == null ? 0 : D.fill) + (+d.d)); commit(); },
  spkWord: (d) => { const w = spkE().words[+d.i]; if (w) { w.ok = !w.ok; commit(); } },
  spkWordAdd: () => { const t = val('spkW'); if (!t) return toast('Type a word first'); const W = spkE().words; if (W.some((w) => w.t.toLowerCase() === t.toLowerCase())) return toast('Already on your list'); W.push({ t, ok: false }); commit('Added'); },
  spkWordClear: () => { const E = spkE(); E.words = E.words.filter((w) => !w.ok); commit('Removed'); },
  spkRec: () => {
    if (SPK.state === 'rec') { try { SPK.rec.stop(); } catch (e) {} return; }
    SPK.err = '';
    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      const rec = new MediaRecorder(stream); SPK.rec = rec; SPK.chunks = [];
      rec.ondataavailable = (e) => { if (e.data && e.data.size) SPK.chunks.push(e.data); };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        if (SPK.url) URL.revokeObjectURL(SPK.url);
        SPK.blob = new Blob(SPK.chunks, { type: rec.mimeType || 'audio/webm' }); SPK.url = URL.createObjectURL(SPK.blob); SPK.state = 'done'; SPK.rec = null; spkRefresh();
      };
      rec.start(); SPK.state = 'rec'; spkRefresh();
    }).catch(() => { SPK.state = SPK.url ? 'done' : 'idle'; SPK.err = 'Could not use the microphone. Allow microphone access for this app in your browser settings, then try again.'; spkRefresh(); });
  },
  spkShare: () => {
    if (!SPK.blob) return;
    const f = new File([SPK.blob], spkFile(), { type: SPK.blob.type });
    if (navigator.canShare && navigator.canShare({ files: [f] })) navigator.share({ files: [f], title: 'Speaking practice' }).catch(() => {}); else toast('Sharing files is not supported here. Use Save file.');
  }
});
Object.assign(ROUTES, { speak: vSpeak });
Object.assign(NAVPARENT, { speak: 'today' });
