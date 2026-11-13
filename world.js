'use strict';
/* Daily Life v2.4 — World tour page (#world): a globe you can spin, planned and visited places, trips with a travel
   fund, coverage by country and continent, and milestones. Data lives in db.world (synced in the core part).
   The globe libraries and map data (vendor/d3-*.js, vendor/topojson-client.min.js, world-data.js) load the first
   time the page opens, so the rest of the app starts as fast as before. */

const WT = { ready: false, loading: false, fail: false, rot: null, scale: 1, sel: null, trip: null, filter: 'all', drop: false, draft: null, newTrip: false, res: [], hits: [], proj: null, list: null, feats: null, byN: null, a2: null, raf: 0 };
const WT_CONTS = ['Asia', 'Europe', 'Africa', 'North America', 'South America', 'Oceania', 'Antarctica'];
const WT_PRIO = ['Must-see', 'Want', 'Maybe'];
const WT_RAD = Math.PI / 180;

function wtDb() { const w = db.world = db.world || {}; w.home = w.home || { name: 'Sydney', lat: -33.87, lon: 151.21 }; w.places = w.places || []; w.trips = w.trips || []; return w; }
const wtKm = (a, b) => { const dl = (b.lat - a.lat) * WT_RAD, dn = (b.lon - a.lon) * WT_RAD; const h = Math.sin(dl / 2) ** 2 + Math.cos(a.lat * WT_RAD) * Math.cos(b.lat * WT_RAD) * Math.sin(dn / 2) ** 2; return 12742 * Math.asin(Math.sqrt(h)); };
const wtChainKm = (ch) => { let d = 0; for (let i = 1; i < ch.length; i++) d += wtKm(ch[i - 1], ch[i]); return d; };
const wtKmTxt = (km) => (km >= 1000 ? (Math.round(km / 100) / 10).toFixed(1) + 'k' : String(Math.round(km)));
const wtNorm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const wtPlace = (id) => wtDb().places.find((p) => p.id === id);
const wtTripOf = (id) => wtDb().trips.find((t) => (t.stops || []).includes(id));
const wtWhen = (p) => p.from || p.doneAt || '';
function wtStats() {
  const W = wtDb(); const P = W.places; const done = P.filter((p) => p.done).sort((a, b) => (wtWhen(a) < wtWhen(b) ? -1 : wtWhen(a) > wtWhen(b) ? 1 : 0));
  const un = Array.from(new Set(done.filter((p) => p.cc && p.un).map((p) => p.cc))); const all = Array.from(new Set(done.filter((p) => p.cc).map((p) => p.cc)));
  const conts = new Set(done.map((p) => p.cont).filter(Boolean));
  return { W, P, done, un, all, conts, km: wtChainKm([W.home].concat(done)), equator: done.some((p) => (p.lat > 0) !== (W.home.lat > 0)) };
}
function wtBadges(S) {
  const b = (t, ok, sub) => ({ t, ok, sub });
  return [b('First country', S.all.length >= 1, S.all.length >= 1 ? 'earned' : 'visit 1 place'), b('5 countries', S.all.length >= 5, Math.min(5, S.all.length) + ' of 5'), b('Cross the equator', S.equator, S.equator ? 'earned' : 'not yet'),
    b('3 continents', S.conts.size >= 3, Math.min(3, S.conts.size) + ' of 3'), b('10,000 km', S.km >= 10000, Math.min(10000, Math.round(S.km)).toLocaleString() + ' of 10,000'), b('Every continent', S.conts.size >= 7, S.conts.size + ' of 7')];
}

/* ---------- loading the globe ---------- */
function wtLoad() {
  if (WT.ready || WT.loading) return; WT.loading = true; WT.fail = false;
  const files = ['vendor/d3-array.min.js', 'vendor/d3-geo.min.js', 'vendor/topojson-client.min.js', 'world-data.js'];
  const next = (i) => {
    if (i === files.length) return wtReady();
    const s = document.createElement('script'); s.src = files[i]; s.onload = () => next(i + 1);
    s.onerror = () => { WT.loading = false; WT.fail = true; if (route === 'world') render(true); };
    document.head.appendChild(s);
  };
  next(0);
}
function wtReady() {
  try {
    const D = window.WT_DATA; WT.feats = topojson.feature(D.topo, D.topo.objects.countries).features;
    WT.byN = {}; WT.feats.forEach((f) => { if (f.id != null) WT.byN[f.id] = f; });
    WT.a2 = {}; Object.keys(D.cc).forEach((k) => { if (D.cc[k][3]) WT.a2[D.cc[k][3]] = k; });
    WT.grat = d3.geoGraticule().step([30, 30])(); WT.ready = true;
  } catch (e) { console.error(e); WT.fail = true; }
  WT.loading = false; if (route === 'world') render(true);
}
function wtList() { return WT.list = WT.list || window.WT_DATA.cities.split('\n').map((l) => { const x = l.split('|'); return { n: x[0], c: x[1], la: +x[2], lo: +x[3], k: wtNorm(x[0]) }; }); }
function wtSearch(q) {
  q = wtNorm(q); if (q.length < 2 || !WT.ready) return [];
  const a = [], b = [];
  for (const x of wtList()) { if (x.k.startsWith(q)) { a.push(x); if (a.length >= 6) break; } else if (b.length < 6 && x.k.includes(q)) b.push(x); }
  return a.concat(b).slice(0, 6);
}
const wtCountry = (cc) => (window.WT_DATA && WT_DATA.cc[cc]) || null;
function wtDetect(lat, lon) { if (!WT.ready) return ''; for (const f of WT.feats) if (d3.geoContains(f, [lon, lat])) return WT.a2[f.id] || ''; return ''; }
function wtLook(lat, lon) { WT.rot = [-lon, -Math.max(-60, Math.min(60, lat))]; }

/* ---------- drawing ---------- */
function wtDraw() {
  const cv = document.getElementById('wtC'); if (!cv || !WT.ready) return;
  const ctx = cv.getContext && cv.getContext('2d'); if (!ctx) return;
  const W = wtDb(); const S = cv.clientWidth || 300; const dpr = window.devicePixelRatio || 1;
  if (cv.width !== Math.round(S * dpr)) { cv.width = cv.height = Math.round(S * dpr); }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, S, S);
  if (!WT.rot) wtLook(W.home.lat, W.home.lon);
  const proj = d3.geoOrthographic().translate([S / 2, S / 2]).scale((S / 2 - 3) * WT.scale).rotate(WT.rot).clipAngle(90).precision(0.5);
  const path = d3.geoPath(proj, ctx); WT.proj = proj;
  ctx.save(); ctx.beginPath(); ctx.arc(S / 2, S / 2, S / 2 - 1, 0, 7); ctx.clip(); // keeps a zoomed-in globe inside its circle
  ctx.beginPath(); path({ type: 'Sphere' }); ctx.fillStyle = '#2E4A62'; ctx.fill();
  ctx.beginPath(); path(WT.grat); ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.beginPath(); WT.feats.forEach((f) => path(f)); ctx.fillStyle = '#C9C4B8'; ctx.fill(); ctx.strokeStyle = '#2E4A62'; ctx.lineWidth = 0.5; ctx.stroke();
  const D = window.WT_DATA; const seen = {};
  W.places.filter((p) => p.done && p.cc).forEach((p) => { const m = D.cc[p.cc]; const f = m && WT.byN[m[3]]; if (!f || seen[p.cc]) return; seen[p.cc] = 1; ctx.beginPath(); path(f); ctx.fillStyle = '#5FAE7E'; ctx.fill(); ctx.stroke(); });
  const line = (pts, color, dash, w) => { if (pts.length < 2) return; ctx.beginPath(); path({ type: 'LineString', coordinates: pts.map((p) => [p.lon, p.lat]) }); ctx.strokeStyle = color; ctx.lineWidth = w; ctx.setLineDash(dash); ctx.lineCap = 'round'; ctx.stroke(); ctx.setLineDash([]); };
  const St = wtStats(); line([W.home].concat(St.done), '#FFFFFF', [4, 4], 1.6);
  const trip = WT.trip ? W.trips.find((t) => t.id === WT.trip) : (WT.sel && wtTripOf(WT.sel));
  if (trip) { const st = (trip.stops || []).map(wtPlace).filter(Boolean); if (st.length) line([W.home].concat(st, [W.home]), '#FFB067', [1, 6], 2.4); }
  const c = [-WT.rot[0], -WT.rot[1]]; const vis = (p) => d3.geoDistance([p.lon, p.lat], c) < Math.PI / 2 - 0.02;
  WT.hits = [];
  if (vis(W.home)) { const q = proj([W.home.lon, W.home.lat]); ctx.fillStyle = '#1D1C1A'; ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 2; ctx.beginPath(); ctx.rect(q[0] - 4.5, q[1] - 4.5, 9, 9); ctx.fill(); ctx.stroke(); }
  W.places.filter(vis).sort((a, b) => (a.id === WT.sel) - (b.id === WT.sel)).forEach((p) => {
    const q = proj([p.lon, p.lat]); const on = p.id === WT.sel; const r = on ? 9 : 7; WT.hits.push({ id: p.id, x: q[0], y: q[1] });
    if (on) { ctx.beginPath(); ctx.arc(q[0], q[1], r + 5, 0, 7); ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.fill(); }
    ctx.beginPath(); ctx.arc(q[0], q[1], r, 0, 7);
    if (p.done) { ctx.fillStyle = '#1E7A45'; ctx.fill(); ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 2; ctx.stroke(); ctx.beginPath(); ctx.moveTo(q[0] - 3.2, q[1] + 0.2); ctx.lineTo(q[0] - 0.8, q[1] + 2.6); ctx.lineTo(q[0] + 3.4, q[1] - 2.4); ctx.lineWidth = 1.8; ctx.stroke(); }
    else { ctx.fillStyle = '#FFFFFF'; ctx.fill(); ctx.strokeStyle = '#E0662A'; ctx.lineWidth = 3.5; ctx.stroke(); }
  });
  if (WT.draft && WT.draft.lat != null && vis(WT.draft)) { const q = proj([WT.draft.lon, WT.draft.lat]); ctx.beginPath(); ctx.arc(q[0], q[1], 7, 0, 7); ctx.fillStyle = '#FFD166'; ctx.fill(); ctx.strokeStyle = '#1D1C1A'; ctx.lineWidth = 2; ctx.stroke(); }
  ctx.restore();
  ctx.beginPath(); ctx.arc(S / 2, S / 2, S / 2 - 1.5, 0, 7); ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 1.5; ctx.stroke();
}
function wtQueue() { if (WT.raf) return; WT.raf = requestAnimationFrame(() => { WT.raf = 0; wtDraw(); }); }
function wtMount() {
  const cv = document.getElementById('wtC'); if (!cv) return;
  if (!cv._wt) {
    cv._wt = true; const pts = new Map(); let moved = 0, pinch = 0;
    const gap = () => { const v = Array.from(pts.values()); return Math.hypot(v[0][0] - v[1][0], v[0][1] - v[1][1]) || 1; };
    cv.addEventListener('pointerdown', (e) => { try { cv.setPointerCapture(e.pointerId); } catch (x) {} pts.set(e.pointerId, [e.clientX, e.clientY]); if (pts.size === 1) moved = 0; if (pts.size === 2) { pinch = gap() / WT.scale; moved = 99; } });
    cv.addEventListener('pointermove', (e) => {
      const prev = pts.get(e.pointerId); if (!prev || !WT.rot) return; pts.set(e.pointerId, [e.clientX, e.clientY]);
      if (pts.size === 1) { const dx = e.clientX - prev[0], dy = e.clientY - prev[1]; moved += Math.abs(dx) + Math.abs(dy); const k = 0.45 / WT.scale; WT.rot = [WT.rot[0] + dx * k, Math.max(-80, Math.min(80, WT.rot[1] - dy * k))]; }
      else if (pts.size === 2) WT.scale = Math.max(1, Math.min(6, gap() / pinch));
      wtQueue();
    });
    const end = (e) => { const had = pts.delete(e.pointerId); if (had && e.type === 'pointerup' && pts.size === 0 && moved < 8) wtTap(e, cv); };
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  }
  wtDraw();
}
function wtTap(e, cv) {
  const r = cv.getBoundingClientRect(); const x = e.clientX - r.left, y = e.clientY - r.top;
  if (WT.drop) {
    const S = r.width; if (Math.hypot(x - S / 2, y - S / 2) > (S / 2 - 3) * Math.min(1, WT.scale) || !WT.proj) return toast('Tap on the globe itself');
    const ll = WT.proj.invert([x, y]); if (!ll || !isFinite(ll[0])) return toast('Tap on the globe itself');
    const cc = wtDetect(ll[1], ll[0]); const m = wtCountry(cc);
    WT.draft = { name: '', dropped: true, lat: Math.round(ll[1] * 100) / 100, lon: Math.round(ll[0] * 100) / 100, cc, country: m ? m[0] : '', cont: m ? m[1] : '', un: m ? m[2] : 0 };
    WT.drop = false; render(true); return wtScroll('wtAddCard');
  }
  let best = null, bd = 26; WT.hits.forEach((h) => { const d = Math.hypot(h.x - x, h.y - y); if (d < bd) { bd = d; best = h; } });
  if (best) { WT.sel = best.id; WT.trip = null; render(true); }
}
function wtScroll(id) { setTimeout(() => { const el = document.getElementById(id); if (el && el.scrollIntoView) el.scrollIntoView({ block: 'start', behavior: 'smooth' }); }, 60); }
// after an edit that does not re-render (so the keyboard stays open), refresh once the field is left
function wtSoft() { setTimeout(() => { const a = document.activeElement; if (route === 'world' && !(a && /INPUT|TEXTAREA|SELECT/.test(a.tagName))) render(true); }, 250); }

/* ---------- page ---------- */
function vWorld() {
  wtLoad();
  const S = wtStats(); const W = S.W; const P = S.P; const cur = db.settings.currency || '$';
  if (WT.sel && !wtPlace(WT.sel)) WT.sel = null;
  const sp = WT.sel ? wtPlace(WT.sel) : null;
  const left = P.length - S.done.length;
  const kpi = (l, v, sub, c) => '<div class="kpi"><span class="small muted b">' + l + '</span><b' + (c ? ' style="color:' + c + '"' : '') + '>' + v + '</b><span class="small muted">' + sub + '</span></div>';
  const dot = (c, extra) => '<i style="display:inline-block;width:12px;height:12px;box-sizing:border-box;' + extra + ';background:' + c + '"></i>';

  const globe = '<section style="background:var(--hero);color:var(--heroInk);border-radius:20px;padding:16px;display:flex;flex-direction:column;gap:12px;align-items:center">' +
    (WT.ready ? '<canvas id="wtC" style="width:min(100%,320px);aspect-ratio:1;display:block;touch-action:none;border-radius:50%;cursor:grab" role="img" aria-label="Globe with your planned and visited places. Every place is also in the Places list below."></canvas>'
      : '<div style="width:min(100%,320px);aspect-ratio:1;border-radius:50%;background:#2E4A62;display:flex;align-items:center;justify-content:center;text-align:center;padding:40px;box-sizing:border-box" class="sm">' + (WT.fail ? '<div>The globe could not load. Check your connection.<br><button class="btn sm" data-a="wtRetry" style="margin-top:10px;background:#fff;color:#1D1C1A">Try again</button></div>' : 'Loading the globe…') + '</div>') +
    (WT.drop ? '<div class="sm b" style="background:#FFD166;color:#1D1C1A;border-radius:12px;padding:10px 12px;text-align:center">Tap the spot on the globe. Spin or zoom first if you need to.</div>' : '') +
    '<div class="row" style="gap:6px;flex-wrap:wrap;justify-content:center">' +
    '<button class="chip" data-a="wtDrop" aria-pressed="' + WT.drop + '" style="height:44px;border-radius:22px;' + (WT.drop ? 'background:#FFD166;color:#1D1C1A;border-color:#FFD166' : 'background:transparent;color:#fff;border-color:rgba(255,255,255,.3)') + '">' + (WT.drop ? 'Cancel pin' : 'Drop a pin') + '</button>' +
    [['-1', '−', 'Zoom out'], ['1', '+', 'Zoom in']].map(([d, t, l]) => '<button class="chip" data-a="wtZoom" data-d="' + d + '" aria-label="' + l + '" style="height:44px;width:44px;padding:0;border-radius:22px;background:transparent;color:#fff;border-color:rgba(255,255,255,.3);font-size:18px">' + t + '</button>').join('') +
    '<button class="chip" data-a="wtHome" style="height:44px;border-radius:22px;background:transparent;color:#fff;border-color:rgba(255,255,255,.3)">Home</button></div>' +
    '<div class="row small" style="gap:14px;flex-wrap:wrap;justify-content:center;color:var(--heroMuted)"><span class="row" style="gap:6px">' + dot('#fff', 'border-radius:50%;border:3px solid #E0662A') + 'Planned</span><span class="row" style="gap:6px">' + dot('#1E7A45', 'border-radius:50%;border:2px solid #fff') + 'Done</span><span class="row" style="gap:6px">' + dot('#1D1C1A', 'border:2px solid #fff') + 'Home</span><span class="row" style="gap:6px">' + dot('#5FAE7E', 'border-radius:3px;width:14px;height:10px') + 'Visited country</span></div>' +
    '<div class="small" style="color:var(--heroMuted);text-align:center;line-height:1.45">Drag to spin, pinch to zoom, tap a pin to open it. The dotted orange line is the selected trip.</div></section>';

  const tiles = '<section class="grid3">' + kpi('Countries', S.un.length + '<span class="sm muted b"> / 195</span>', (S.un.length / 195 * 100).toFixed(1) + '% of the world', 'var(--good)') + kpi('My list', S.done.length + '<span class="sm muted b"> / ' + P.length + '</span>', 'places done') + kpi('Distance', wtKmTxt(S.km), 'km from home', 'var(--doc-fg)') + '</section>';

  const maxC = Math.max(1, ...WT_CONTS.map((n) => P.filter((p) => p.cont === n).length));
  const next = P.filter((p) => !p.done && p.year).sort((a, b) => a.year - b.year)[0];
  const insight = !P.length ? 'Nothing pinned yet. Add the first place you want to see below.' : left === 0 ? 'Every place on your list is done. Time to add new ones.' : S.done.length + ' done, ' + left + ' to go across ' + new Set(P.filter((p) => !p.done && p.cc && !S.all.includes(p.cc)).map((p) => p.cc)).size + ' new countries.' + (next ? ' Next up by target year: ' + esc(next.name) + '.' : '');
  const cover = '<section class="card"><div class="head"><h2>How much is covered</h2><span class="small muted">' + pct(S.done.length, P.length) + '% of your list</span></div><div class="bar" style="height:8px"><i style="width:' + pct(S.done.length, P.length) + '%;background:var(--good)"></i></div>' +
    '<div class="sm" style="background:var(--bg);border-radius:12px;padding:10px 12px;line-height:1.45">' + insight + '</div>' +
    '<div class="head" style="padding-top:4px"><h3 style="margin:0;font-size:15px">By continent</h3><span class="small muted">done · planned</span></div><div class="col" style="gap:8px">' +
    WT_CONTS.map((n) => { const all = P.filter((p) => p.cont === n); const d = all.filter((p) => p.done).length; const pl = all.length - d; return '<div style="display:grid;grid-template-columns:104px 1fr 84px;align-items:center;gap:8px"><span class="sm b' + (all.length ? '' : ' muted') + '">' + n + '</span><div style="display:flex;gap:3px;height:12px;background:var(--soft);border-radius:6px;overflow:hidden"><i style="display:block;width:' + (d / maxC * 100) + '%;background:var(--good)"></i><i style="display:block;width:' + (pl / maxC * 100) + '%;background:#F3B68E"></i></div><span class="small muted" style="text-align:right;white-space:nowrap">' + (all.length ? d + ' · ' + pl : 'nothing yet') + '</span></div>'; }).join('') + '</div></section>';

  const B = wtBadges(S);
  const miles = '<section class="card"><div class="head"><h2>Milestones</h2><span class="small muted">' + B.filter((b) => b.ok).length + ' of ' + B.length + ' earned</span></div><div class="grid2" style="gap:8px">' +
    B.map((b) => '<div style="border-radius:14px;padding:10px 12px;display:flex;align-items:center;gap:10px;background:' + (b.ok ? 'var(--good-bg)' : 'var(--card)') + ';border:1px solid ' + (b.ok ? 'transparent' : 'var(--line2)') + '"><span style="width:26px;height:26px;flex:0 0 26px;border-radius:13px;box-sizing:border-box;display:flex;align-items:center;justify-content:center;background:' + (b.ok ? 'var(--good)' : 'transparent') + ';border:2px solid ' + (b.ok ? 'var(--good)' : 'var(--line2)') + '"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="' + (b.ok ? '#fff' : 'transparent') + '" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg></span><span><span class="sm b" style="display:block' + (b.ok ? ';color:var(--good-fg)' : '') + '">' + b.t + '</span><span class="small" style="color:' + (b.ok ? 'var(--good-fg)' : 'var(--muted)') + '">' + b.sub + '</span></span></div>').join('') + '</div></section>';

  const selTrip = WT.trip ? W.trips.find((t) => t.id === WT.trip) : (sp && wtTripOf(sp.id));
  const loose = P.filter((p) => !wtTripOf(p.id));
  const tripCard = (t) => {
    const st = (t.stops || []).map(wtPlace).filter(Boolean); const nd = st.filter((p) => p.done).length; const all = st.length && nd === st.length; const on = selTrip && selTrip.id === t.id;
    const km = st.length ? Math.round(wtChainKm([W.home].concat(st, [W.home])) / 100) * 100 : 0; const tg = num(t.target), sv = num(t.saved); const pc = tg ? Math.round(sv / tg * 100) : 0;
    return '<div style="border:' + (on ? '2px solid var(--ink)' : '1px solid var(--line)') + ';border-radius:16px;padding:12px;display:flex;flex-direction:column;gap:8px">' +
      '<div class="row between" style="align-items:flex-start"><div><div class="xb" style="font-size:16px">' + esc(t.name) + '</div><div class="small muted">' + (t.year ? esc(t.year) + ' · ' : '') + st.length + (st.length === 1 ? ' stop' : ' stops') + (km ? ' · ' + km.toLocaleString() + ' km round trip' : '') + '</div></div><span class="pill" style="background:' + (all ? 'var(--good-bg)' : 'var(--warn-bg)') + ';color:' + (all ? 'var(--good-fg)' : 'var(--warn-fg)') + '">' + (all ? 'Done' : !st.length ? 'No stops yet' : nd ? nd + ' of ' + st.length + ' done' : 'Planned') + '</span></div>' +
      (st.length ? '<div class="col" style="gap:0">' + st.map((p, i) => '<div class="row" style="min-height:44px;gap:8px"><span class="small b muted" style="width:16px">' + (i + 1) + '</span><button class="link grow" data-a="wtSel" data-id="' + p.id + '" style="justify-content:flex-start;color:var(--ink);text-align:left">' + esc(p.name) + (p.done ? ' · done' : '') + '</button>' + (i ? '<button class="del" data-a="wtStopUp" data-id="' + t.id + '" data-i="' + i + '" aria-label="Move ' + esc(p.name) + ' earlier" style="width:44px;height:44px;flex:0 0 44px">' + '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5M5 12l7-7 7 7"/></svg></button>' : '') + '</div>').join('') + '</div>' : '<div class="small muted">Open a place and choose this trip to add it as a stop.</div>') +
      '<div class="col" style="gap:4px"><div class="row between small muted"><span class="b">Travel fund</span><span>' + (tg ? (pc >= 100 ? 'Fully funded · ' : pc + '% saved · ') + cur + sv.toLocaleString() + ' of ' + cur + tg.toLocaleString() : 'no target set') + '</span></div><div class="bar" style="height:8px"><i style="width:' + Math.min(100, pc) + '%;background:var(--doc)"></i></div></div>' +
      '<div style="display:grid;grid-template-columns:1fr auto;gap:8px"><label class="sr" for="wtF-' + t.id + '">' + (tg ? 'Amount saved' : 'Fund target') + '</label><input id="wtF-' + t.id + '" class="in" type="number" inputmode="decimal" placeholder="' + (tg ? 'Add savings, e.g. 200' : 'Fund target, e.g. 3000') + '"><button class="btn ghost" data-a="wtFund" data-id="' + t.id + '">' + (tg ? 'Add' : 'Set') + '</button></div>' +
      '<div class="row between"><button class="link" data-a="wtTripShow" data-id="' + t.id + '">Show route on globe</button><button class="link" data-a="wtTripDel" data-id="' + t.id + '" style="color:var(--bad)">Delete trip</button></div></div>';
  };
  const trips = '<section class="card" id="wtTrips"><div class="head"><h2>Trips</h2><span class="small muted">places grouped into one journey</span></div>' + (W.trips.length ? W.trips.map(tripCard).join('') : empty('No trips yet. Group places into one journey to see its route, distance and fund.')) +
    (P.length && W.trips.length ? '<div class="sm" style="background:var(--bg);border-radius:12px;padding:10px 12px;line-height:1.45">' + (loose.length ? 'Not in a trip yet: ' + loose.map((p) => esc(p.name)).join(', ') + '.' : 'Every place is part of a trip.') + '</div>' : '') +
    (WT.newTrip ? '<div class="col" style="gap:8px"><label class="f">Trip name<input id="wtTn" class="in" placeholder="e.g. Japan in autumn"></label><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><label class="f">Year<input id="wtTy" class="in" type="number" inputmode="numeric" placeholder="' + (new Date().getFullYear() + 1) + '"></label><label class="f">Fund target (' + esc(cur) + ')<input id="wtTt" class="in" type="number" inputmode="decimal" placeholder="optional"></label></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><button class="btn ghost" data-a="wtTripNew">Cancel</button><button class="btn" data-a="wtTripSave">Save trip</button></div></div>' : '<button class="btn full" data-a="wtTripNew">+ New trip</button>') + '</section>';

  const tripOpts = (cur0) => '<option value="">Not in a trip</option>' + W.trips.map((t) => '<option value="' + t.id + '"' + (cur0 === t.id ? ' selected' : '') + '>' + esc(t.name) + '</option>').join('');
  const rateRow = (v) => '<div class="chips" style="display:grid;grid-template-columns:repeat(5,1fr)">' + [1, 2, 3, 4, 5].map((n) => '<button class="chip' + (v === n ? ' on' : '') + '" data-a="wtRate" data-v="' + n + '" aria-pressed="' + (v === n) + '" aria-label="Rate ' + n + ' out of 5" style="height:44px">' + n + '</button>').join('') + '</div>';
  const detail = !sp ? '' : (() => { const t = wtTripOf(sp.id); return '<section class="card" id="wtSelCard"><div class="row between" style="align-items:flex-start"><div><h2 style="font-size:20px">' + esc(sp.name) + '</h2><div class="sm muted">' + esc(sp.country || 'Country not set') + '</div></div><span class="pill" style="background:' + (sp.done ? 'var(--good-bg)' : 'var(--warn-bg)') + ';color:' + (sp.done ? 'var(--good-fg)' : 'var(--warn-fg)') + '">' + (sp.done ? 'Done' : 'Planned') + '</span></div>' +
    '<div style="display:grid;grid-template-columns:96px 1fr;gap:8px"><label class="f">Target year<input class="in" type="number" inputmode="numeric" data-c="wtEdit" data-f="year" value="' + esc(sp.year || '') + '"></label><label class="f">Trip<select class="in" data-c="wtSetTrip">' + tripOpts(t ? t.id : '') + '</select></label></div>' +
    '<div><div class="small muted b" style="margin-bottom:6px">Priority</div><div class="chips" style="display:grid;grid-template-columns:repeat(3,1fr)">' + WT_PRIO.map((x) => '<button class="chip' + (sp.prio === x ? ' on' : '') + '" data-a="wtPrio" data-v="' + x + '" aria-pressed="' + (sp.prio === x) + '" style="height:44px">' + x + '</button>').join('') + '</div></div>' +
    '<label class="f">Why I want to go<textarea class="in" rows="2" data-c="wtEdit" data-f="why" placeholder="One line is enough">' + esc(sp.why || '') + '</textarea></label><label class="f">Where I read about it<input class="in" data-c="wtEdit" data-f="src" value="' + esc(sp.src || '') + '" placeholder="Book, article or link"></label>' +
    (sp.done ? '<div class="col" style="border-top:1px solid var(--line);padding-top:12px"><h3 style="margin:0;font-size:15px">Trip log</h3><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><label class="f">Arrived<input class="in" type="date" data-c="wtEdit" data-f="from" value="' + esc(sp.from || '') + '"></label><label class="f">Left<input class="in" type="date" data-c="wtEdit" data-f="to" value="' + esc(sp.to || '') + '"></label></div><div><div class="small muted b" style="margin-bottom:6px">Rating</div>' + rateRow(sp.rate) + '</div><label class="f">Note<textarea class="in" rows="3" data-c="wtEdit" data-f="note" placeholder="What do you want to remember?">' + esc(sp.note || '') + '</textarea></label></div>' : '<button class="btn full" data-a="wtDone" style="background:var(--good);color:#fff">I\'ve been here — mark as done</button>') +
    '<div class="row between">' + (sp.done ? '<button class="link" data-a="wtUndo">Move back to planned</button>' : '<span></span>') + '<button class="link" data-a="wtDel" style="color:var(--bad)">Remove this place</button></div></section>'; })();

  const fl = [['all', 'All ' + P.length], ['plan', 'Planned ' + left], ['done', 'Done ' + S.done.length]];
  const rows = P.filter((p) => WT.filter === 'all' || (WT.filter === 'done') === !!p.done);
  const places = '<section class="card"><div class="head"><h2>Places</h2><span class="small muted">tap to show on the globe</span></div><div class="chips">' + fl.map(([k, l]) => '<button class="chip' + (WT.filter === k ? ' on' : '') + '" data-a="wtFilter" data-v="' + k + '" aria-pressed="' + (WT.filter === k) + '" style="height:44px;border-radius:22px">' + l + '</button>').join('') + '</div>' +
    (rows.length ? '<div>' + rows.map((p) => '<button data-a="wtSel" data-id="' + p.id + '" aria-pressed="' + (p.id === WT.sel) + '" class="list-row" style="width:100%;min-height:60px;padding:8px;border-left:0;border-right:0;border-bottom:0;background:' + (p.id === WT.sel ? 'var(--bg)' : 'transparent') + ';text-align:left;cursor:pointer">' + dot(p.done ? 'var(--good)' : '#fff', 'flex:0 0 16px;width:16px;height:16px;border-radius:50%' + (p.done ? '' : ';border:4px solid #E0662A')) + '<span class="grow"><span class="b" style="display:block;font-size:15px">' + esc(p.name) + '</span><span class="small muted">' + esc(p.country || '—') + ' · ' + (p.done ? (p.from ? 'visited ' + nice(p.from) + ' ' + p.from.slice(0, 4) : 'visited, add dates') : esc(p.prio || 'Want')) + '</span></span><span class="small b muted" style="white-space:nowrap">' + (p.done ? (p.rate ? p.rate + ' / 5' : 'Done') : esc(p.year || '')) + '</span></button>').join('') + '</div>' : empty(P.length ? 'Nothing in this filter.' : 'Your list is empty. Add a place below.')) + '</section>';

  const d = WT.draft; const ccAll = window.WT_DATA ? Object.keys(WT_DATA.cc).sort((a, b) => WT_DATA.cc[a][0].localeCompare(WT_DATA.cc[b][0])) : [];
  const add = '<section class="card" id="wtAddCard"><div class="head"><h2>Add a place</h2><span class="small muted">read it, pin it</span></div>' +
    (!d ? '<label class="f">City or place<input id="wtQ" class="in" placeholder="' + (WT.ready ? 'Search, e.g. Istanbul or Petra' : 'Loading places…') + '" autocomplete="off" autocapitalize="words"></label><div id="wtSug" class="col" style="gap:0"></div><button class="btn ghost full" data-a="wtDrop" data-on="1">Not in the list? Drop a pin on the globe</button>'
      : (d.dropped ? '<div class="sm" style="background:var(--bg);border-radius:12px;padding:10px 12px">Pin dropped at ' + Math.abs(d.lat) + '°' + (d.lat < 0 ? 'S' : 'N') + ', ' + Math.abs(d.lon) + '°' + (d.lon < 0 ? 'W' : 'E') + '</div><label class="f">Name of the place<input id="wtName" class="in" placeholder="e.g. Lake Bled"></label><label class="f">Country<select id="wtCC" class="in"><option value="">Open sea or not sure</option>' + ccAll.map((c) => '<option value="' + c + '"' + (c === d.cc ? ' selected' : '') + '>' + esc(WT_DATA.cc[c][0]) + '</option>').join('') + '</select></label>'
        : '<div class="row between" style="background:var(--bg);border-radius:12px;padding:6px 6px 6px 12px"><span class="b">' + esc(d.name) + '<span class="sm muted" style="font-weight:400"> · ' + esc(d.country) + '</span></span><button class="link" data-a="wtDraftClear">Change</button></div>') +
      '<label class="f">Why I want to go<input id="wtWhy" class="in" placeholder="One line is enough"></label><div style="display:grid;grid-template-columns:1fr 96px;gap:8px"><label class="f">Where I read about it<input id="wtSrc" class="in" placeholder="Book, article or link"></label><label class="f">Target year<input id="wtYear" class="in" type="number" inputmode="numeric" placeholder="' + (new Date().getFullYear() + 2) + '"></label></div>' +
      '<div><div class="small muted b" style="margin-bottom:6px">Priority</div><div class="chips" id="wtPr" style="display:grid;grid-template-columns:repeat(3,1fr)">' + WT_PRIO.map((x) => '<button class="chip' + (x === 'Want' ? ' on' : '') + '" data-a="pickChip" data-group="wtPr" data-v="' + x + '" style="height:44px">' + x + '</button>').join('') + '</div></div>' +
      (W.trips.length ? '<label class="f">Trip<select id="wtTrip" class="in">' + tripOpts('') + '</select></label>' : '') +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px"><button class="btn ghost" data-a="wtDraftClear">Cancel</button><button class="btn" data-a="wtAdd">Pin it as planned</button></div>') + '</section>';

  return backHead('World tour', 'Plan it · pin it · log it', 'home') + globe + tiles + cover + miles + trips + detail + places + add +
    '<div class="small muted" style="text-align:center;line-height:1.5">Distance is measured in visit order, starting from ' + esc(W.home.name) + '.<br>Map: Natural Earth. Cities: GeoNames (CC BY 4.0).</div>';
}
function worldMini() {
  const S = wtStats(); const next = S.P.filter((p) => !p.done && p.year).sort((a, b) => a.year - b.year)[0];
  return '<a href="#world" class="card tight"><div class="head"><h2>World tour</h2><span class="link">Open ›</span></div><div class="sm muted">' + (S.P.length ? S.done.length + ' of ' + S.P.length + ' places done · ' + S.un.length + ' of 195 countries' + (next ? ' · next: ' + esc(next.name) + ' ' + esc(next.year) : '') : 'Pin the first place you want to see.') + '</div></a>';
}
function wtReportCard() {
  const S = wtStats(); if (!S.P.length) return ''; const B = wtBadges(S);
  return '<a href="#world" class="card tight"><div class="head"><h2>World tour</h2><span class="link">Open ›</span></div><div class="grid3"><div><div class="small muted">Countries</div><div class="xb" style="font-size:18px">' + S.un.length + ' / 195</div></div><div><div class="small muted">Places done</div><div class="xb" style="font-size:18px">' + S.done.length + ' / ' + S.P.length + '</div></div><div><div class="small muted">Milestones</div><div class="xb" style="font-size:18px">' + B.filter((b) => b.ok).length + ' / ' + B.length + '</div></div></div></a>';
}

Object.assign(A, {
  wtRetry: () => { wtLoad(); render(true); },
  wtZoom: (d) => { WT.scale = Math.max(1, Math.min(6, WT.scale * (+d.d > 0 ? 1.5 : 1 / 1.5))); wtDraw(); },
  wtHome: () => { const h = wtDb().home; WT.scale = 1; wtLook(h.lat, h.lon); wtDraw(); },
  wtDrop: (d) => { if (!WT.ready) return toast('The globe is still loading'); WT.drop = d.on ? true : !WT.drop; render(true); if (WT.drop) window.scrollTo({ top: 0, behavior: 'smooth' }); },
  wtSel: (d) => { const p = wtPlace(d.id); if (!p) return; WT.sel = p.id; WT.trip = null; wtLook(p.lat, p.lon); render(true); },
  wtFilter: (d) => { WT.filter = d.v; render(true); },
  wtPick: (d) => { const x = WT.res[+d.i]; const m = x && wtCountry(x.c); if (!x || !m) return; WT.draft = { name: x.n, cc: x.c, country: m[0], cont: m[1], un: m[2], lat: x.la, lon: x.lo }; wtLook(x.la, x.lo); render(true); wtScroll('wtAddCard'); },
  wtDraftClear: () => { WT.draft = null; WT.res = []; render(true); },
  wtAdd: () => {
    const d = WT.draft; if (!d) return; const W = wtDb();
    if (d.dropped) { d.name = val('wtName'); if (!d.name) return toast('Give the place a name'); const cc = val('wtCC'); const m = wtCountry(cc); Object.assign(d, { cc, country: m ? m[0] : '', cont: m ? m[1] : '', un: m ? m[2] : 0 }); }
    if (W.places.some((p) => wtNorm(p.name) === wtNorm(d.name) && p.cc === d.cc)) return toast('That place is already on your list');
    const p = { id: uid(), name: d.name, cc: d.cc, country: d.country, cont: d.cont, un: d.un ? 1 : 0, lat: d.lat, lon: d.lon, why: val('wtWhy'), src: val('wtSrc'), year: num(val('wtYear')) || '', prio: chipVal('wtPr') || 'Want', done: false, added: nowInfo().k };
    W.places.push(p); const t = W.trips.find((x) => x.id === val('wtTrip')); if (t) (t.stops = t.stops || []).push(p.id);
    WT.draft = null; WT.res = []; WT.sel = p.id; WT.trip = null; WT.filter = 'all'; wtLook(p.lat, p.lon); commit(p.name + ' pinned');
  },
  wtPrio: (d) => { const p = wtPlace(WT.sel); if (p) { p.prio = d.v; commit(); } },
  wtRate: (d) => { const p = wtPlace(WT.sel); if (p) { p.rate = p.rate === +d.v ? 0 : +d.v; commit(); } },
  wtDone: () => { const p = wtPlace(WT.sel); if (!p) return; const before = wtBadges(wtStats()).filter((b) => b.ok).length; p.done = true; p.doneAt = nowInfo().k; const B = wtBadges(wtStats()); const got = B.filter((b) => b.ok); commit(got.length > before ? 'Milestone earned: ' + got[got.length - 1].t : p.name + ' marked as done'); },
  wtUndo: () => { const p = wtPlace(WT.sel); if (p) { p.done = false; commit('Moved back to planned'); } },
  wtDel: () => { const W = wtDb(); const p = wtPlace(WT.sel); if (!p) return; W.places = W.places.filter((x) => x.id !== p.id); W.trips.forEach((t) => (t.stops = (t.stops || []).filter((x) => x !== p.id))); WT.sel = null; commit(p.name + ' removed'); },
  wtTripNew: () => { WT.newTrip = !WT.newTrip; render(true); },
  wtTripSave: () => { const n = val('wtTn'); if (!n) return toast('Give the trip a name'); wtDb().trips.push({ id: uid(), name: n, year: num(val('wtTy')) || '', target: Math.max(0, num(val('wtTt'))), saved: 0, stops: [] }); WT.newTrip = false; commit('Trip saved. Open a place to add it as a stop.'); },
  wtTripDel: (d) => { const W = wtDb(); const t = W.trips.find((x) => x.id === d.id); if (!t) return; W.trips = W.trips.filter((x) => x.id !== d.id); if (WT.trip === d.id) WT.trip = null; commit(t.name + ' deleted. Its places stay on your list.'); },
  wtTripShow: (d) => { const t = wtDb().trips.find((x) => x.id === d.id); if (!t) return; const st = (t.stops || []).map(wtPlace).filter(Boolean); if (!st.length) return toast('Add a stop to this trip first'); WT.trip = t.id; WT.scale = 1; wtLook(st[0].lat, st[0].lon); render(true); window.scrollTo({ top: 0, behavior: 'smooth' }); },
  wtStopUp: (d) => { const t = wtDb().trips.find((x) => x.id === d.id); const i = +d.i; if (!t || !(i > 0)) return; const s = t.stops; const a = s[i - 1]; s[i - 1] = s[i]; s[i] = a; commit(); },
  wtFund: (d) => { const t = wtDb().trips.find((x) => x.id === d.id); const v = num(val('wtF-' + d.id)); if (!t) return; if (!(v > 0)) return toast('Enter an amount'); if (num(t.target) > 0) { t.saved = num(t.saved) + v; commit('Added to the fund'); } else { t.target = v; commit('Fund target set'); } }
});
Object.assign(CH, {
  wtEdit: (v, d) => { const p = wtPlace(WT.sel); if (!p) return; p[d.f] = d.f === 'year' ? (num(v) || '') : String(v).trim(); save(); wtSoft(); },
  wtSetTrip: (v) => { const p = wtPlace(WT.sel); if (!p) return; const W = wtDb(); W.trips.forEach((t) => (t.stops = (t.stops || []).filter((x) => x !== p.id))); const t = W.trips.find((x) => x.id === v); if (t) t.stops.push(p.id); commit(t ? 'Added to ' + t.name : 'Removed from its trip'); }
});
document.addEventListener('input', (e) => {
  if (e.target.id !== 'wtQ') return; WT.res = wtSearch(e.target.value); const box = document.getElementById('wtSug'); if (!box) return;
  box.innerHTML = WT.res.map((x, i) => '<button class="list-row" data-a="wtPick" data-i="' + i + '" style="width:100%;border-left:0;border-right:0;border-bottom:0;background:transparent;text-align:left;cursor:pointer;padding:0 4px"><span class="grow"><span class="b">' + esc(x.n) + '</span><span class="sm muted"> · ' + esc((wtCountry(x.c) || [''])[0]) + '</span></span></button>').join('') || (wtNorm(e.target.value).length >= 2 && WT.ready ? '<div class="empty">No match. Drop a pin on the globe instead.</div>' : '');
});
new MutationObserver(() => { if (route === 'world') wtMount(); }).observe(document.getElementById('view'), { childList: true });
window.addEventListener('resize', () => { if (route === 'world') wtQueue(); });
Object.assign(ROUTES, { world: vWorld, reports: (function (orig) { return function () { return orig() + wtReportCard(); }; })(ROUTES.reports) });
Object.assign(NAVPARENT, { world: 'home' });
window.worldMini = worldMini;
