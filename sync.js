// Daily Life — cloud sync (Firebase Auth + Firestore). Loaded lazily by app.js; the app works without it.
import { initializeApp } from './vendor/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, onAuthStateChanged, signOut as fbSignOut } from './vendor/firebase-auth.js';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, collection, doc, onSnapshot, writeBatch, getDocsFromServer, getDocs } from './vendor/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyAA70yj98NyIkYAj5f1m_G1D4fixqp3rAs',
  authDomain: 'daily-life-eca4c.firebaseapp.com',
  projectId: 'daily-life-eca4c',
  storageBucket: 'daily-life-eca4c.firebasestorage.app',
  messagingSenderId: '921107614304',
  appId: '1:921107614304:web:df491d1a5e9299870b5105'
};

const DL = window.DL; const S = DL.SYNC;
const META = 'dl:sync'; // { uid, h: { partName: hash } } — what we last sent/received
const DEVICE = (() => { let d = localStorage.getItem('dl:device'); if (!d) { d = Math.random().toString(36).slice(2, 10); localStorage.setItem('dl:device', d); } return d; })();
const CORE = ['settings', 'tasks', 'ideas', 'reminders', 'house', 'habits', 'periods', 'timer', 'shop', 'cal', 'goals', 'wo', 'cats', 'world'];

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
let fs;
try { fs = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) }); }
catch (e) { fs = initializeFirestore(app, {}); }

/* ---- data <-> parts ---- */
// core: settings & lists · tx: money · m-YYYY-MM: that month's days + health
function split(db) {
  const parts = { core: {}, tx: { tx: db.tx || [] } };
  CORE.forEach((k) => (parts.core[k] = db[k] === undefined ? null : db[k]));
  const month = (k) => (parts['m-' + k.slice(0, 7)] = parts['m-' + k.slice(0, 7)] || { days: {}, health: {} });
  Object.keys(db.days || {}).forEach((k) => (month(k).days[k] = db.days[k]));
  Object.keys(db.health || {}).forEach((k) => (month(k).health[k] = db.health[k]));
  const out = {}; for (const [n, v] of Object.entries(parts)) out[n] = JSON.stringify(v);
  return out;
}
function applyPart(db, name, json) {
  const v = JSON.parse(json);
  if (name === 'core') CORE.forEach((k) => { if (v[k] !== undefined) db[k] = v[k]; });
  else if (name === 'tx') db.tx = v.tx || [];
  else if (name.startsWith('m-')) {
    const pre = name.slice(2);
    for (const k of Object.keys(db.days)) if (k.startsWith(pre)) delete db.days[k];
    for (const k of Object.keys(db.health)) if (k.startsWith(pre)) delete db.health[k];
    Object.assign(db.days, v.days || {}); Object.assign(db.health, v.health || {});
  }
}
const hash = (s) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36) + ':' + s.length; };
const meta = () => { try { return JSON.parse(localStorage.getItem(META)) || { uid: null, h: {} }; } catch (e) { return { uid: null, h: {} }; } };
const setMeta = (m) => localStorage.setItem(META, JSON.stringify(m));
const partsCol = (uid) => collection(fs, 'users', uid, 'parts');

/* ---- push ---- */
let timer = null, unsub = null, pushing = false, again = false;
function changed() { if (!S.user) return; S.pending = true; clearTimeout(timer); timer = setTimeout(push, 1500); }
async function push() {
  if (!S.user) return;
  if (pushing) { again = true; return; }
  pushing = true; const uid = S.user.uid;
  try {
    const m = meta(); const parts = split(DL.get()); const batch = writeBatch(fs); let n = 0;
    for (const [name, json] of Object.entries(parts)) {
      const h = hash(json);
      if (m.h[name] === h) continue;
      if (json.length > 900000) { console.warn('part too large', name); continue; }
      batch.set(doc(partsCol(uid), name), { data: json, h, u: Date.now(), dev: DEVICE, v: DL.VERSION });
      m.h[name] = h; n++;
    }
    if (n) {
      setMeta(m); // queued in Firestore's offline cache even if the network is down
      S.state = 'syncing'; DL.update();
      await batch.commit(); // resolves when the server has it
    }
    S.state = 'idle'; S.pending = false; S.last = Date.now(); S.error = '';
  } catch (e) { S.state = 'error'; S.error = niceErr(e); console.warn(e); }
  pushing = false; DL.update();
  if (again) { again = false; push(); }
}

/* ---- pull (live) ---- */
function listen(uid) {
  if (unsub) unsub();
  unsub = onSnapshot(partsCol(uid), { includeMetadataChanges: false }, (snap) => {
    const m = meta(); const local = split(DL.get()); const db = DL.get(); let applied = 0;
    snap.docChanges().forEach((ch) => {
      if (ch.type === 'removed') return;
      const d = ch.doc.data(); const name = ch.doc.id;
      if (!d || typeof d.data !== 'string' || ch.doc.metadata.hasPendingWrites) return;
      if (d.h === m.h[name]) return; // we already have this version
      const localH = local[name] ? hash(local[name]) : null;
      const localDirty = localH && localH !== m.h[name] && m.h[name] !== undefined;
      if (localDirty) return; // our unsent edit wins; push() will overwrite
      if (localH === d.h) { m.h[name] = d.h; return; }
      applyPart(db, name, d.data); m.h[name] = d.h; applied++;
    });
    setMeta(m);
    if (applied) { DL.replace(db); DL.toast('Updated from your other device'); }
    if (!snap.metadata.fromCache) { S.last = Date.now(); if (S.state !== 'error') S.state = 'idle'; }
    DL.update();
  }, (e) => { S.state = 'error'; S.error = niceErr(e); DL.update(); });
}

/* ---- first sign-in: merge this phone with the cloud ---- */
async function connect(user) {
  S.user = { uid: user.uid, email: user.email, name: user.displayName }; S.state = 'syncing'; DL.update();
  const m = meta();
  try {
    if (m.uid !== user.uid) {
      let snap;
      try { snap = await getDocsFromServer(partsCol(user.uid)); } catch (e) { snap = await getDocs(partsCol(user.uid)); }
      const remote = {}; snap.forEach((d) => { const v = d.data(); if (v && typeof v.data === 'string') remote[d.id] = v; });
      const hasRemote = Object.keys(remote).length > 0;
      let useCloud = hasRemote;
      if (hasRemote && DL.hasData()) {
        useCloud = confirm('Your Google account already has Daily Life data.\n\nOK = use the cloud data on this phone\nCancel = keep this phone\'s data and upload it to the cloud');
      }
      const nm = { uid: user.uid, h: {} };
      if (useCloud) {
        const db = DL.fresh();
        db.meta = DL.get().meta;
        for (const [name, v] of Object.entries(remote)) { applyPart(db, name, v.data); nm.h[name] = v.h; }
        setMeta(nm); DL.replace(db); DL.toast('Signed in · data loaded from cloud');
      } else {
        for (const [name, v] of Object.entries(remote)) nm.h[name] = v.h; // known cloud versions; ours differ so push() overwrites them
        setMeta(nm); DL.toast(hasRemote ? 'Signed in · uploading this phone\'s data' : 'Signed in · backing up your data');
      }
    }
    listen(user.uid);
    await push();
  } catch (e) { S.state = 'error'; S.error = niceErr(e); console.warn(e); DL.update(); }
}

function niceErr(e) {
  const c = (e && e.code) || '';
  if (c.includes('permission-denied')) return 'Database rules block access — set Firestore rules';
  if (c.includes('unavailable')) return 'Can\'t reach the server';
  if (c.includes('failed-precondition')) return 'Firestore database not created yet';
  if (c.includes('unauthorized-domain')) return 'Add this site under Authentication → Authorized domains';
  if (c.includes('popup-closed') || c.includes('cancelled-popup')) return 'Sign-in cancelled';
  return (e && e.message) || String(e);
}

/* ---- public API used by app.js ---- */
window.DLSync = {
  changed,
  syncNow: () => { if (!S.user) return; const m = meta(); m.h = {}; setMeta(m); push().then(() => DL.toast(S.state === 'error' ? 'Sync failed: ' + S.error : 'Synced')); },
  async signIn() {
    const p = new GoogleAuthProvider(); p.setCustomParameters({ prompt: 'select_account' });
    try { await signInWithPopup(auth, p); }
    catch (e) {
      if ((e.code || '').includes('popup-blocked') || (e.code || '').includes('operation-not-supported')) { try { await signInWithRedirect(auth, p); return; } catch (e2) { e = e2; } }
      S.error = niceErr(e); DL.toast(S.error); DL.update();
    }
  },
  async signOut() {
    if (unsub) unsub(); unsub = null;
    try { await fbSignOut(auth); } catch (e) {}
    localStorage.removeItem(META); S.user = null; S.state = 'idle'; S.pending = false; S.last = 0; DL.update(); DL.toast('Signed out · data kept on this phone');
  }
};

getRedirectResult(auth).catch((e) => { S.error = niceErr(e); DL.update(); });
onAuthStateChanged(auth, (u) => {
  if (u) connect(u);
  else { if (unsub) unsub(); unsub = null; S.user = null; S.state = 'idle'; DL.update(); }
});
window.addEventListener('online', () => { if (S.user) push(); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && S.user && S.pending) push(); });
