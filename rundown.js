// Rundown (www.davyrockett.com/rundown/): David's dashboard. Started as a copy of the app suite's screen
// (website repo, apps/launcher.js), so the icons, offline, updates, sharing and access key work the same.
// Below the icons: time, weather, calendars, The Crossing (Planning Center), RJ sessions, gigs, practice,
// Z4 to-dos and autocross. Calendar, Planning Center and autocross come from the public rundown-data repo
// (David doesn't share the link), which an hourly GitHub job there fills in; RJ ticks are saved there too.
// - Tells the apps they were opened from here, so each shows an "All apps" button (suite.js in each app)
//   that comes back here.
// - "Make everything work offline": installs every app's own offline copy in one go.
// - One access key for every app that syncs: checks it against each data repo, then saves it the way
//   each app expects (the same browser storage the apps read, since they're all on www.davyrockett.com).
'use strict';

const OWNER = 'davyrockett';
const APPS = [
  ['first-frets', 'First Frets'], ['page-fright', 'Page Fright'], ['lip-service', 'Lip Service'],
  ['jam-session', 'Jam Session'], ['memory-lane', 'Memory Lane'], ['song-party', 'Song Party'], ['sos-band-editor', 'SOS Band Editor'],
  ['sos-band', 'SOS Band'], ['ge150-presets', 'GE150 Presets'], ['health-log', 'Health Log'], ['z4-log', 'Z4 Log'],
];

// Where each syncing app keeps its key (and which data repo it uses). Values are stored exactly as each
// app's own Settings screen stores them; "json" = that app keeps its values JSON-encoded.
const SYNCED = [
  { name: 'Health Log', repo: 'health-log-data', token: 'healthlog-sync-token', repoKey: 'healthlog-sync-repo', last: 'healthlog-sync-last' },
  { name: 'Z4 Log', repo: 'z4-log-data', token: 'z4log-sync-token', repoKey: 'z4log-sync-repo', last: 'z4log-sync-last' },
  { name: 'Jam Session', repo: 'jam-session-data', token: 'js.syncToken', repoKey: 'js.syncRepo', last: 'js.syncLast', json: true },
  { name: 'Memory Lane', repo: 'memory-lane-data', token: 'ml.sync-token', last: 'ml.sync-last' },
  { name: 'Song Party', repo: 'song-party-data', token: 'sp.sync-token', last: 'sp.sync-last' },
  { name: 'SOS Band Editor', repo: 'sos-band-data', token: 'sosed.sync-token', last: 'sosed.sync-last' },
  { name: 'GE150 Presets', repo: 'ge150-presets-data', token: 'ge150.sync-token', last: 'ge150.sync-last' },
  { name: 'Rundown', repo: 'rundown-data', token: 'rundown.sync-token', last: 'rundown.sync-last' },
];

const $ = (id) => document.getElementById(id);
function lsGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function lsSet(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* blocked */ } }
function hasKey(app) {
  const v = lsGet(app.token);
  if (!v) return false;
  if (!app.json) return true;
  try { return Boolean(JSON.parse(v)); } catch { return false; }
}

// Opened from here: apps show their "All apps" button for the rest of this visit, and it comes back here.
try {
  sessionStorage.setItem('davyrockett-suite', '1');
  sessionStorage.setItem('davyrockett-suite-home', '/rundown/');
} catch { /* blocked */ }

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});

/* ---------- Offline ---------- */

async function offlineState(slug) {
  if (!('serviceWorker' in navigator)) return 'unsupported';
  const reg = await navigator.serviceWorker.getRegistration(`/${slug}/`).catch(() => null);
  if (reg && reg.active && new URL(reg.scope).pathname === `/${slug}/`) return 'ready';
  return reg && (reg.installing || reg.waiting) ? 'working' : 'missing';
}

function waitForActive(reg) {
  return new Promise((resolve) => {
    if (reg.active) return resolve(true);
    const sw = reg.installing || reg.waiting;
    if (!sw) return resolve(false);
    const done = () => {
      if (sw.state === 'activated') resolve(true);
      else if (sw.state === 'redundant') resolve(false);
    };
    sw.addEventListener('statechange', done);
    setTimeout(() => resolve(Boolean(reg.active)), 60000);
  });
}

async function renderOffline() {
  const list = $('offline-list');
  const states = await Promise.all(APPS.map(([slug]) => offlineState(slug)));
  list.replaceChildren(...APPS.map(([slug, name], i) => {
    const li = document.createElement('li');
    li.className = `state-${states[i]}`;
    li.innerHTML = '<span class="dot"></span><span class="label"></span>';
    li.querySelector('.label').textContent = name;
    li.title = { ready: 'Works offline', working: 'Downloading…', missing: 'Not downloaded yet', unsupported: '' }[states[i]];
    return li;
  }));
  const missing = states.filter((s) => s !== 'ready').length;
  $('offline-summary').textContent = states[0] === 'unsupported'
    ? 'This browser can’t keep apps offline.'
    : missing ? `${APPS.length - missing} of ${APPS.length} apps work offline on this device.` : 'Every app works offline on this device.';
  $('offline-btn').disabled = !missing || states[0] === 'unsupported';
  $('offline-btn').textContent = missing ? 'Make everything work offline' : 'All set';
}

$('offline-btn').addEventListener('click', async () => {
  const btn = $('offline-btn');
  btn.disabled = true;
  btn.textContent = 'Downloading…';
  for (const [slug] of APPS) {
    if (await offlineState(slug) === 'ready') continue;
    try {
      const reg = await navigator.serviceWorker.register(`/${slug}/sw.js`, { scope: `/${slug}/` });
      renderOffline();
      await waitForActive(reg);
    } catch { /* keep going with the others */ }
    renderOffline();
  }
  await renderOffline();
});

/* ---------- Updates ---------- */

// Each app's saved copy is named "<prefix><version>" (see each app's sw.js).
const CACHE_PREFIX = {
  'first-frets': 'firstfrets-v', 'page-fright': 'pagefright-v', 'lip-service': 'lipservice-v',
  'jam-session': 'jamsession-v', 'memory-lane': 'memory-lane-v', 'song-party': 'song-party-v', 'sos-band-editor': 'sos-band-editor-v',
  'sos-band': 'sos-band-v', 'ge150-presets': 'presets-v', 'health-log': 'healthlog-v', 'z4-log': 'z4log-v',
};

// Version numbers saved on this device for one app (oldest first). With an update waiting there are two.
async function savedVersions(prefix) {
  const keys = await caches.keys().catch(() => []);
  return keys.filter((k) => k.startsWith(prefix)).map((k) => Number(k.slice(prefix.length))).filter((n) => n > 0).sort((x, y) => x - y);
}

// Waits until a newly found version has finished downloading (or failed).
function waitInstalled(sw) {
  return new Promise((resolve) => {
    if (sw.state !== 'installing') return resolve(sw.state);
    sw.addEventListener('statechange', () => { if (sw.state !== 'installing') resolve(sw.state); });
    setTimeout(() => resolve(sw.state), 60000);
  });
}

const SUITE = ['rundown', 'Rundown'];
const updateState = {};   // slug -> { reg, status: 'ready' | 'current' | 'latest' | 'checking', from, to }

function updateRow([slug, name]) {
  const s = updateState[slug] || { status: 'checking' };
  const li = document.createElement('li');
  li.className = s.status;
  const icon = slug === 'rundown' ? 'icons/icon-192.png' : `../${slug}/icons/icon-192.png`;
  li.innerHTML = `<img src="${icon}" alt=""><span class="name"></span><span class="note"></span>`;
  li.querySelector('.name').textContent = name;
  li.querySelector('.note').textContent = {
    checking: 'checking…',
    ready: s.from && s.to ? `update ready: v${s.from} → v${s.to}` : 'update ready',
    current: s.to ? `up to date · v${s.to}` : 'up to date',
    updated: `updated: v${s.from} → v${s.to}`,
    latest: 'always the latest (not kept offline)',
    error: 'couldn’t check',
  }[s.status];
  if (s.status === 'ready') {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn small';
    btn.textContent = 'Update';
    btn.addEventListener('click', () => applyUpdate(slug));
    li.append(btn);
  }
  return li;
}

function renderUpdates() {
  $('update-list').replaceChildren(...[SUITE, ...APPS].map(updateRow));
  const ready = Object.values(updateState).filter((s) => s.status === 'ready').length;
  $('update-all').hidden = ready < 2;
}

async function checkOne(slug) {
  if (slug === 'rundown') {
    const reg = await navigator.serviceWorker.getRegistration('/rundown/').catch(() => null);
    if (!reg) { updateState.rundown = { status: 'latest' }; return; }
    const before = await savedVersions('rundown-v');
    try { await reg.update(); } catch { updateState.rundown = { status: 'error' }; return; }
    if (reg.installing) await waitInstalled(reg.installing);
    const after = await savedVersions('rundown-v');
    const newer = after[after.length - 1] > (before[before.length - 1] || 0);
    // This screen switches to a new version by itself; reloading shows it.
    updateState.rundown = newer ? { status: 'ready', from: before[before.length - 1], to: after[after.length - 1] }
      : { status: 'current', to: after[after.length - 1] };
    return;
  }
  const reg = await navigator.serviceWorker.getRegistration(`/${slug}/`).catch(() => null);
  if (!reg || new URL(reg.scope).pathname !== `/${slug}/`) { updateState[slug] = { status: 'latest' }; return; }
  const before = await savedVersions(CACHE_PREFIX[slug]);
  try { await reg.update(); } catch { /* offline: report what's already known */ }
  if (reg.installing) await waitInstalled(reg.installing);
  const v = await savedVersions(CACHE_PREFIX[slug]);
  const was = before[before.length - 1];
  const now = v[v.length - 1];
  // A new version waits only while the app is open somewhere; otherwise it takes over straight away.
  updateState[slug] = reg.waiting ? { status: 'ready', reg, from: v[0], to: now }
    : was && now > was ? { status: 'updated', from: was, to: now }
    : { status: 'current', to: now };
}

let checking = false;
async function checkUpdates() {
  if (checking || !('serviceWorker' in navigator)) return;
  checking = true;
  const msg = $('update-msg');
  if (!navigator.onLine) {
    msg.textContent = 'You’re offline. Connect to the internet to check for updates.';
    checking = false;
    return;
  }
  msg.textContent = 'Checking every app for a newer version…';
  for (const k of Object.keys(updateState)) delete updateState[k];
  renderUpdates();
  await Promise.all([SUITE, ...APPS].map(async ([slug]) => {
    try { await checkOne(slug); } catch { updateState[slug] = { status: 'error' }; }
    renderUpdates();
  }));
  const ready = Object.values(updateState).filter((s) => s.status === 'ready').length;
  const done = Object.values(updateState).filter((s) => s.status === 'updated').length;
  const time = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  msg.textContent = (ready ? `${ready} update${ready === 1 ? '' : 's'} ready to install. ` : '') +
    (done ? `${done} app${done === 1 ? '' : 's'} updated. ` : '') +
    (ready || done ? `(Checked at ${time}.)` : `Everything is up to date (checked at ${time}).`);
  checking = false;
}

function applyUpdate(slug) {
  const s = updateState[slug];
  if (!s || s.status !== 'ready') return;
  if (slug === 'rundown') { location.reload(); return; }
  // Same as tapping "Update" inside the app: switch to the version that's already downloaded.
  if (s.reg && s.reg.waiting) s.reg.waiting.postMessage('skipWaiting');
  updateState[slug] = { status: 'current', to: s.to };
  renderUpdates();
}

$('update-all').addEventListener('click', () => {
  const suiteReady = updateState.rundown && updateState.rundown.status === 'ready';
  APPS.forEach(([slug]) => applyUpdate(slug));
  $('update-msg').textContent = 'All updated.';
  if (suiteReady) setTimeout(() => location.reload(), 800);
});
$('update-check').addEventListener('click', checkUpdates);

/* ---------- One access key for every app ---------- */

function renderKeys() {
  const list = $('key-list');
  list.replaceChildren(...SYNCED.map((app) => {
    const li = document.createElement('li');
    const on = hasKey(app);
    li.className = on ? 'state-ready' : 'state-missing';
    li.innerHTML = '<span class="dot"></span><span class="label"></span><span class="note"></span>';
    li.querySelector('.label').textContent = app.name;
    li.querySelector('.note').textContent = on ? 'connected' : 'no key';
    return li;
  }));
  $('key-forget').hidden = !SYNCED.some(hasKey);
}

async function checkRepo(repo, token) {
  try {
    const res = await fetch(`https://api.github.com/repos/${OWNER}/${repo}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
      cache: 'no-store',
    });
    if (res.status === 401) return 'bad';
    if (!res.ok) return 'no-access';
    const info = await res.json();
    return info.permissions && info.permissions.push ? 'ok' : 'read-only';
  } catch {
    return 'offline';
  }
}

$('key-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = $('key-input');
  const token = input.value.trim();
  const msg = $('key-msg');
  if (!token) { msg.textContent = 'Paste your access key first.'; return; }
  const btn = $('key-save');
  btn.disabled = true;
  btn.textContent = 'Checking…';
  msg.textContent = '';
  const results = await Promise.all(SYNCED.map((app) => checkRepo(app.repo, token)));
  btn.disabled = false;
  btn.textContent = 'Save for every app';

  if (results.every((r) => r === 'offline')) { msg.textContent = 'Can’t reach GitHub right now. Try again when you’re online.'; return; }
  if (results.every((r) => r === 'bad')) { msg.textContent = 'GitHub didn’t accept that key (mistyped or expired).'; return; }

  const saved = [];
  const skipped = [];
  SYNCED.forEach((app, i) => {
    if (results[i] !== 'ok') { skipped.push(`${app.name} (${{ 'read-only': 'read only', 'no-access': 'not included', bad: 'not accepted', offline: 'couldn’t check' }[results[i]]})`); return; }
    lsSet(app.token, app.json ? JSON.stringify(token) : token);
    if (app.repoKey) lsSet(app.repoKey, app.json ? JSON.stringify(`${OWNER}/${app.repo}`) : `${OWNER}/${app.repo}`);
    lsSet(app.last, null);   // each app does a full sync the next time it opens
    saved.push(app.name);
  });
  input.value = '';
  renderKeys();
  loadData();
  msg.textContent = (saved.length ? `Saved for ${saved.join(', ')}.` : 'Not saved anywhere.') +
    (skipped.length ? ` Not saved for ${skipped.join(', ')}: give the key access to that data repo on GitHub.` : '');
});

$('key-forget').addEventListener('click', () => {
  if (!confirm('Remove the access key from every app on this device? Your data stays on GitHub.')) return;
  SYNCED.forEach((app) => { lsSet(app.token, null); lsSet(app.last, null); });
  $('key-msg').textContent = 'Removed. The apps are view-only on this device until you add a key again.';
  renderKeys();
});

/* ---------- Sharing an app ---------- */

// A small share button on each icon opens a panel with that app's link: Copy, or Share… (the
// device's share sheet) where the browser has one.
const shareSheet = $('share-sheet');
let shareUrl = '';
const SHARE_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12"/><path d="M7 8l5-5 5 5"/><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/></svg>';

document.querySelectorAll('.grid .tile').forEach((tile) => {
  const name = tile.textContent.trim();
  const badge = document.createElement('button');
  badge.type = 'button';
  badge.className = 'share-badge';
  badge.setAttribute('aria-label', `Share ${name}`);
  badge.innerHTML = SHARE_ICON;
  badge.addEventListener('click', () => {
    shareUrl = tile.href;
    $('share-title').textContent = name;
    $('share-icon').src = tile.querySelector('img').src;
    $('share-link').textContent = shareUrl;
    $('share-copy').textContent = 'Copy link';
    if (shareSheet.showModal) shareSheet.showModal(); else shareSheet.setAttribute('open', '');
  });
  tile.parentElement.append(badge);
});

if (navigator.share) {
  $('share-send').hidden = false;
  $('share-send').addEventListener('click', () => {
    navigator.share({ title: $('share-title').textContent, url: shareUrl }).catch(() => { /* closed */ });
  });
}
$('share-copy').addEventListener('click', async () => {
  const btn = $('share-copy');
  try {
    await navigator.clipboard.writeText(shareUrl);
    btn.textContent = 'Copied';
  } catch {
    const range = document.createRange();
    range.selectNodeContents($('share-link'));
    const sel = getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    btn.textContent = 'Selected: copy it';
  }
  setTimeout(() => { btn.textContent = 'Copy link'; }, 2000);
});
$('share-close').addEventListener('click', () => shareSheet.close());
shareSheet.addEventListener('click', (e) => { if (e.target === shareSheet) shareSheet.close(); });

/* ---------- Today (below the icons) ---------- */

// Practice ticks and Z4 ticks live only on this screen (and the Apps screen, which uses the same storage
// keys): nothing is sent to the apps.
// Practice ticks clear each new day; Z4 ticks stay until that to-do is done in Z4 Log.
const PRACTICE = ['Vocal warm-up', 'Reading', 'Improv'];
const PRACTICE_KEY = 'apps.practice';      // {"date": "2026-10-21", "done": ["Reading"]}
const Z4_TICKS_KEY = 'apps.z4-ticked';     // ids of Z4 to-dos ticked here
const SAVED_KEY = 'apps.today-saved';      // last gigs and to-dos fetched, for when there's no internet
const Z4_SHOWN = 5;
const TICK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>';

function lsJSON(k, fallback) { try { return JSON.parse(lsGet(k)) ?? fallback; } catch { return fallback; } }
// Today's date as YYYY-MM-DD on this device.
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function tickButton(cls, label, on, onToggle) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = cls;
  b.setAttribute('aria-pressed', String(on));
  b.innerHTML = `<span class="t-chk">${TICK}</span><span></span>`;
  b.lastChild.textContent = label;
  b.addEventListener('click', () => {
    const now = b.getAttribute('aria-pressed') !== 'true';
    b.setAttribute('aria-pressed', String(now));
    onToggle(now);
  });
  return b;
}

function renderPractice() {
  let state = lsJSON(PRACTICE_KEY, {});
  if (state.date !== todayISO()) state = { date: todayISO(), done: [] };
  $('practice').replaceChildren(...PRACTICE.map((name) => tickButton('t-chip', name, state.done.includes(name), (on) => {
    state.done = on ? [...state.done, name] : state.done.filter((n) => n !== name);
    state.date = todayISO();
    lsSet(PRACTICE_KEY, JSON.stringify(state));
  })));
}

/* Gigs: the next Davy Rockett gig (the website's gigs.json, from the Google Calendar) and the next SOS
   Band show (sos-band-data, public). Gig times are Pacific wall-clock times, shown as written. */

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function untilText(date) {
  const [y, m, d] = date.split('-').map(Number);
  const [ty, tm, td] = todayISO().split('-').map(Number);
  const n = Math.round((Date.UTC(y, m - 1, d) - Date.UTC(ty, tm - 1, td)) / 864e5);
  return n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : `In ${n} days`;
}

function clockText(start) {
  let h = Number(start.slice(11, 13));
  const min = start.slice(14, 16);
  const ampm = h < 12 ? 'am' : 'pm';
  h = h % 12 || 12;
  return `${h}${min === '00' ? '' : `:${min}`} ${ampm}`;
}

function gigRow(g) {
  const [y, m, d] = g.date.split('-').map(Number);
  const weekday = DAYS[new Date(y, m - 1, d).getDay()];
  const a = document.createElement('a');
  a.className = 't-gig';
  a.href = g.href;
  a.innerHTML = '<div class="t-date"><b></b><span></span></div><div><div class="title"></div><div class="when"></div></div><span class="who"></span>';
  a.querySelector('b').textContent = MONTHS[m - 1];
  a.querySelector('.t-date span').textContent = d;
  a.querySelector('.title').textContent = g.title;
  a.querySelector('.when').textContent = [weekday, g.time, untilText(g.date)].filter(Boolean).join(' · ');
  a.querySelector('.who').textContent = g.who;
  return a;
}

function renderGigs(gigs) {
  const today = todayISO();
  const upcoming = (gigs || []).filter((g) => g.date >= today).sort((x, y) => x.date.localeCompare(y.date));
  $('gigs-card').hidden = !upcoming.length;
  $('gig-list').replaceChildren(...upcoming.map(gigRow));
}

async function loadGigs() {
  const [site, sos] = await Promise.all([
    fetch('../gigs.json', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    fetch(`https://raw.githubusercontent.com/${OWNER}/sos-band-data/main/data.json`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null)).catch(() => null),
  ]);
  const saved = lsJSON(SAVED_KEY, {});
  const out = [];
  const now = new Date();
  const nowLocal = `${todayISO()}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  if (site) {
    const next = (site.gigs || [])
      .filter((g) => (g.allDay ? (g.end || g.start).slice(0, 10) >= todayISO() : (g.end || g.start) >= nowLocal))
      .sort((x, y) => x.start.localeCompare(y.start))[0];
    if (next) out.push({ date: next.start.slice(0, 10), time: next.allDay ? '' : clockText(next.start), title: next.title, who: 'Davy Rockett', href: '../#gigs' });
  } else if (saved.gigs) {
    out.push(...saved.gigs.filter((g) => g.who === 'Davy Rockett'));
  }
  if (sos) {
    const next = Object.values(sos.items || {})
      .filter((i) => i && i.type === 'show' && !i.deleted && i.date && i.date >= todayISO())
      .sort((x, y) => x.date.localeCompare(y.date))[0];
    if (next) out.push({ date: next.date, time: '', title: next.name, who: 'SOS Band', href: '../sos-band/' });
  } else if (saved.gigs) {
    out.push(...saved.gigs.filter((g) => g.who === 'SOS Band'));
  }
  lsSet(SAVED_KEY, JSON.stringify({ ...lsJSON(SAVED_KEY, {}), gigs: out }));
  renderGigs(out);
}

/* Z4 to-dos: from GitHub with the Z4 Log key when there is one, otherwise Z4 Log's own copy on this
   device (same website, so its database is readable here), otherwise the last list seen. */

function readZ4Device() {
  return new Promise((resolve) => {
    // Only open Z4 Log's database if it already exists: opening a missing one would create an empty one.
    if (!indexedDB.databases) return resolve(null);
    indexedDB.databases().then((dbs) => {
      if (!dbs.some((d) => d.name === 'z4log')) return resolve(null);
      const req = indexedDB.open('z4log');
      req.onerror = () => resolve(null);
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('todos')) { db.close(); return resolve(null); }
        const get = db.transaction('todos').objectStore('todos').getAll();
        get.onsuccess = () => { db.close(); resolve(get.result); };
        get.onerror = () => { db.close(); resolve(null); };
      };
    }).catch(() => resolve(null));
  });
}

async function readZ4GitHub() {
  const token = lsGet('z4log-sync-token');
  if (!token) return null;
  const repo = lsGet('z4log-sync-repo') || `${OWNER}/z4-log-data`;
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/contents/data.json`, {
      cache: 'no-store',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github.raw+json' },
    });
    return res.ok ? (await res.json()).todos || [] : null;
  } catch {
    return null;
  }
}

function renderZ4(todos) {
  const open = (todos || []).filter((t) => t && !t.done && !t.deleted).sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));
  // Forget ticks for to-dos that are now done (or gone) in Z4 Log.
  const ticked = lsJSON(Z4_TICKS_KEY, []).filter((id) => open.some((t) => t.id === id));
  lsSet(Z4_TICKS_KEY, JSON.stringify(ticked));
  $('z4-card').hidden = !open.length;
  const rows = open.slice(0, Z4_SHOWN).map((t) => tickButton('t-todo', t.title, ticked.includes(t.id), (on) => {
    const now = lsJSON(Z4_TICKS_KEY, []).filter((id) => id !== t.id);
    if (on) now.push(t.id);
    lsSet(Z4_TICKS_KEY, JSON.stringify(now));
  }));
  if (open.length > Z4_SHOWN) {
    const more = document.createElement('p');
    more.className = 't-more';
    more.textContent = `and ${open.length - Z4_SHOWN} more in Z4 Log`;
    rows.push(more);
  }
  $('z4-list').replaceChildren(...rows);
}

async function loadZ4() {
  const saved = lsJSON(SAVED_KEY, {});
  if (saved.z4) renderZ4(saved.z4);
  const todos = (await readZ4GitHub()) || (await readZ4Device());
  if (!todos) return;
  const slim = todos.map(({ id, title, done, deleted, createdAt }) => ({ id, title, done, deleted, createdAt }));
  lsSet(SAVED_KEY, JSON.stringify({ ...lsJSON(SAVED_KEY, {}), z4: slim }));
  renderZ4(slim);
}

/* ---------- Rundown: clock, weather, calendars, The Crossing, RJ sessions, autocross ---------- */

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}
// A date as YYYY-MM-DD / YYYY-MM-DDTHH:MM on this device's clock (calendar times are Pacific wall-clock).
function isoDay(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function isoNow() { const d = new Date(); return `${isoDay(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; }
function addDays(day, n) { const [y, m, d] = day.split('-').map(Number); return isoDay(new Date(y, m - 1, d + n)); }
function dayLabel(day) {
  const today = todayISO();
  if (day === today) return 'Today';
  if (day === addDays(today, 1)) return 'Tomorrow';
  const [y, m, d] = day.split('-').map(Number);
  return `${DAYS[new Date(y, m - 1, d).getDay()]}, ${MONTH_NAMES[m - 1]} ${d}`;
}

/* Clock: the big time at the top. A new day redraws everything (practice ticks clear, calendar moves on). */

let shownDay = '';
function renderClock() {
  const d = new Date();
  const h = d.getHours();
  $('clock').innerHTML = `${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')}<small>${h < 12 ? 'am' : 'pm'}</small>`;
  $('today-date').textContent = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}
function everyMinute() {
  if (todayISO() !== shownDay) renderToday();
  else { renderClock(); renderData(lsJSON(DATA_KEY, null)); }
  setTimeout(everyMinute, 60000 - (Date.now() % 60000) + 50);
}

/* Weather: Open-Meteo (free, no key) for wherever this device is. The last forecast is kept for when
   there's no internet or location is turned off. */

const WX_KEY = 'rundown.weather';   // {at, lat, lon, place, placeLat, placeLon, data}
const WX = {
  0: ['☀️', 'Clear'], 1: ['🌤️', 'Mostly clear'], 2: ['⛅', 'Partly cloudy'], 3: ['☁️', 'Cloudy'],
  45: ['🌫️', 'Fog'], 48: ['🌫️', 'Fog'], 51: ['🌦️', 'Light drizzle'], 53: ['🌦️', 'Drizzle'], 55: ['🌧️', 'Heavy drizzle'],
  56: ['🌧️', 'Freezing drizzle'], 57: ['🌧️', 'Freezing drizzle'], 61: ['🌦️', 'Light rain'], 63: ['🌧️', 'Rain'],
  65: ['🌧️', 'Heavy rain'], 66: ['🌧️', 'Freezing rain'], 67: ['🌧️', 'Freezing rain'], 71: ['🌨️', 'Light snow'],
  73: ['🌨️', 'Snow'], 75: ['❄️', 'Heavy snow'], 77: ['🌨️', 'Snow'], 80: ['🌦️', 'Showers'], 81: ['🌧️', 'Showers'],
  82: ['🌧️', 'Heavy showers'], 85: ['🌨️', 'Snow showers'], 86: ['🌨️', 'Snow showers'], 95: ['⛈️', 'Thunderstorms'],
  96: ['⛈️', 'Thunderstorms, hail'], 99: ['⛈️', 'Thunderstorms, hail'],
};
function wxIcon(code, isDay = 1) {
  if (!isDay && code <= 1) return '🌙';
  if (!isDay && code === 2) return '☁️';
  return (WX[code] || ['🌡️'])[0];
}
function hourText(iso) { const h = Number(iso.slice(11, 13)); return `${h % 12 || 12}${h < 12 ? 'am' : 'pm'}`; }

function renderWeather(saved) {
  if (!saved || !saved.data) return;
  const { current: c, hourly: h, daily: d } = saved.data;
  $('wx-now').hidden = false;
  $('wx-now-icon').textContent = wxIcon(c.weather_code, c.is_day);
  $('wx-now-temp').textContent = `${Math.round(c.temperature_2m)}°`;
  $('wx-place').textContent = saved.place || '';

  const top = el('div', 'wx-top');
  const big = el('div', 'wx-big');
  big.append(el('span', 'wx-icon', wxIcon(c.weather_code, c.is_day)), `${Math.round(c.temperature_2m)}°`);
  const desc = el('div', 'wx-desc', (WX[c.weather_code] || ['', ''])[1]);
  desc.append(el('span', '', `High ${Math.round(d.temperature_2m_max[0])}° · Low ${Math.round(d.temperature_2m_min[0])}° · Feels ${Math.round(c.apparent_temperature)}°`));
  desc.append(el('span', '', `Sunset ${clockText(d.sunset[0])}`));
  top.append(big, desc);
  const out = [top];

  // The next 12 hours, starting with this one, plus a heads-up if rain is likely.
  const nowHour = `${isoNow().slice(0, 13)}:00`;
  const start = Math.max(0, h.time.indexOf(nowHour));
  const hours = h.time.slice(start, start + 12).map((t, i) => i + start);
  const wet = hours.find((i) => h.precipitation_probability[i] >= 50);
  if (wet != null) {
    out.push(el('p', 'wx-note', `🌂 Rain likely ${wet === start ? 'now' : `around ${hourText(h.time[wet])}`} (${h.precipitation_probability[wet]}%)`));
  }
  const strip = el('div', 'wx-hours');
  hours.forEach((i) => {
    const cell = el('div');
    const p = h.precipitation_probability[i];
    cell.append(el('b', '', i === start ? 'Now' : hourText(h.time[i])), el('i', '', wxIcon(h.weather_code[i], h.is_day[i])),
      `${Math.round(h.temperature_2m[i])}°`, el('span', 'wx-rain', p >= 20 ? `${p}%` : ''));
    strip.append(cell);
  });
  const days = el('div', 'wx-days');
  d.time.forEach((t, i) => {
    const [y, m, dd] = t.split('-').map(Number);
    const cell = el('div');
    const p = d.precipitation_probability_max[i];
    cell.append(el('b', '', i === 0 ? 'Today' : DAYS[new Date(y, m - 1, dd).getDay()]), el('i', '', wxIcon(d.weather_code[i])),
      `${Math.round(d.temperature_2m_max[i])}°`, el('span', 'lo', `${Math.round(d.temperature_2m_min[i])}°`),
      el('span', 'wx-rain', p >= 20 ? `${p}%` : ''));
    days.append(cell);
  });
  out.push(strip, days);
  $('weather').replaceChildren(...out);
}

function devicePosition() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
      () => resolve(null),
      { maximumAge: 30 * 60e3, timeout: 15000 },
    );
  });
}

let wxLoading = false;
async function loadWeather(force) {
  const saved = lsJSON(WX_KEY, null);
  renderWeather(saved);
  if (wxLoading || (!force && saved && Date.now() - saved.at < 15 * 60e3)) return;
  wxLoading = true;
  try {
    const pos = (await devicePosition()) || (saved && { lat: saved.lat, lon: saved.lon });
    if (!pos) {
      if (!saved) $('weather').replaceChildren(el('p', 't-empty', 'Turn on Location for this app to see the weather here.'));
      return;
    }
    const q = new URLSearchParams({
      latitude: pos.lat.toFixed(3), longitude: pos.lon.toFixed(3),
      current: 'temperature_2m,apparent_temperature,weather_code,is_day',
      hourly: 'temperature_2m,precipitation_probability,weather_code,is_day',
      daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunset',
      temperature_unit: 'fahrenheit', timezone: 'auto', forecast_days: '7',
    });
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${q}`);
    if (!res.ok) return;
    const next = { ...(saved || {}), at: Date.now(), lat: pos.lat, lon: pos.lon, data: await res.json() };
    // Town name, looked up again only after moving a few miles.
    const moved = !saved || !saved.place || Math.abs(pos.lat - saved.placeLat) + Math.abs(pos.lon - saved.placeLon) > 0.05;
    if (moved) {
      try {
        const g = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${pos.lat.toFixed(3)}&longitude=${pos.lon.toFixed(3)}&localityLanguage=en`).then((r) => r.json());
        next.place = g.city || g.locality || '';
        next.placeLat = pos.lat;
        next.placeLon = pos.lon;
      } catch { /* keep the old name */ }
    }
    lsSet(WX_KEY, JSON.stringify(next));
    renderWeather(next);
  } catch { /* offline: the saved forecast stays */ } finally {
    wxLoading = false;
  }
}

/* Calendars, The Crossing, RJ sessions and autocross: data.json in the public rundown-data repo (no key needed
   to read it). RJ ticks are saved back there (ticks.json, needs the access key) so every device shows the same. */

const DATA_REPO = `${OWNER}/rundown-data`;
const DATA_KEY = 'rundown.data';            // last data.json read, plus when ({..., fetchedAt})
const TICKS_KEY = 'rundown.ticks';          // {sessions: {id: {doc, billed, skip}}}
const PENDING_KEY = 'rundown.ticks-pending'; // ticks changed here and not yet saved to GitHub
const CAL_COLORS = { personal: '#4A7FC1', rj: '#3E9B5E', gigs: '#E27039', us: '#B4589A' };

// The one access key: Rundown's own, or any syncing app's (same website, so same storage in a browser).
function accessKey() {
  const own = lsGet('rundown.sync-token');
  if (own) return own;
  for (const app of SYNCED) {
    if (!hasKey(app)) continue;
    const v = lsGet(app.token);
    return app.json ? JSON.parse(v) : v;
  }
  return null;
}

function fromBase64(b64) {
  return new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, '')), (ch) => ch.charCodeAt(0)));
}
function toBase64(text) {
  let bin = '';
  new TextEncoder().encode(text).forEach((b) => { bin += String.fromCharCode(b); });
  return btoa(bin);
}

// One file from rundown-data: {json, sha}, null if it isn't there, or throws ('offline' / 'no-access').
async function readFile(path, token) {
  let res;
  try {
    res = await fetch(`https://api.github.com/repos/${DATA_REPO}/contents/${path}`, {
      cache: 'no-store', headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
    });
  } catch { throw new Error('offline'); }
  if (res.status === 404) {
    // Either the file isn't there yet or the key can't see the repo.
    const repo = await fetch(`https://api.github.com/repos/${DATA_REPO}`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null);
    if (repo && !repo.ok) throw new Error('no-access');
    return null;
  }
  if (res.status === 401 || res.status === 403) throw new Error('no-access');
  if (!res.ok) throw new Error('offline');
  const info = await res.json();
  return { json: JSON.parse(fromBase64(info.content)), sha: info.sha };
}

let dataLoading = false;
// A public file from rundown-data. GitHub's copy can be up to 5 minutes behind.
async function readPublic(path) {
  let res;
  try { res = await fetch(`https://raw.githubusercontent.com/${DATA_REPO}/main/${path}`, { cache: 'no-store' }); } catch { throw new Error('offline'); }
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('offline');
  return { json: await res.json() };
}

async function loadData() {
  if (dataLoading) return;
  dataLoading = true;
  try {
    // Ticks through GitHub's API when there's a key: right after saving, the public copy is still the old one.
    const token = accessKey();
    const [data, ticks] = await Promise.all([
      readPublic('data.json'),
      (token ? readFile('ticks.json', token).catch(() => readPublic('ticks.json')) : readPublic('ticks.json')).catch(() => null),
    ]);
    if (ticks) lsSet(TICKS_KEY, JSON.stringify(ticks.json));
    if (data) lsSet(DATA_KEY, JSON.stringify({ ...data.json, fetchedAt: Date.now() }));
    $('updated').textContent = '';
    renderData(lsJSON(DATA_KEY, null));
  } catch (e) {
    const saved = lsJSON(DATA_KEY, null);
    renderData(saved);
    if (saved && saved.fetchedAt) {
      $('updated').textContent = `Offline · calendar as of ${new Date(saved.fetchedAt).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })}`;
    }
  } finally {
    dataLoading = false;
  }
}

function renderData(data) {
  if (!data) return;
  renderCalendar(data);
  renderCrossing(data.crossing);
  renderSessions(data.rjSessions || []);
  renderAutocross(data.autocross || []);
}

/* Calendar: today (including what's already happened, faded), then the rest of the week. */

const CAL_SHOWN = 14;

function renderCalendar(data) {
  const today = todayISO();
  const now = isoNow();
  const last = addDays(today, 6);
  const names = data.calendars || {};
  const rows = [];
  for (let day = today; day <= last; day = addDays(day, 1)) {
    const events = (data.events || [])
      .filter((e) => (e.allDay ? e.start.slice(0, 10) <= day && (e.end || e.start).slice(0, 10) >= day : e.start.slice(0, 10) === day))
      .sort((a, b) => (a.allDay === b.allDay ? a.start.localeCompare(b.start) : a.allDay ? -1 : 1));
    if (!events.length && day !== today) continue;
    rows.push({ day });
    if (!events.length) rows.push({ empty: true });
    events.forEach((e) => rows.push({ e }));
  }
  const out = [];
  let shown = 0;
  let hidden = 0;
  rows.forEach((r) => {
    if (r.day) { if (shown < CAL_SHOWN) out.push(el('div', 't-day', dayLabel(r.day))); return; }
    if (r.empty) { out.push(el('p', 't-empty', 'Nothing on the calendar.')); return; }
    const e = r.e;
    if (shown >= CAL_SHOWN && e.start.slice(0, 10) !== today) { hidden += 1; return; }
    shown += 1;
    const row = el('div', 'c-row');
    if (!e.allDay && (e.end || e.start) <= now) row.classList.add('past');
    else if (!e.allDay && e.start <= now) row.classList.add('now');
    const dot = el('span', 'c-dot');
    dot.style.background = CAL_COLORS[e.cal] || 'var(--grey)';
    dot.title = names[e.cal] || '';
    const title = el('div', 'c-title', e.title);
    if (e.location) title.append(el('span', '', e.location));
    row.append(el('span', 'c-time', e.allDay ? 'all day' : clockText(e.start)), dot, title);
    out.push(row);
  });
  if (hidden) out.push(el('p', 't-more', `and ${hidden} more this week`));
  const legend = el('div', 'c-legend');
  Object.entries(names).forEach(([key, name]) => {
    const item = el('span');
    const dot = el('span', 'c-dot');
    dot.style.background = CAL_COLORS[key] || 'var(--grey)';
    item.append(dot, name + (data.errors && data.errors[key] ? ' (not loading)' : ''));
    legend.append(item);
  });
  out.push(legend);
  $('cal').replaceChildren(...out);
}

/* The Crossing: the next plan in Planning Center: times, your spot, the songs with keys, and the band. */

const STATUS_TEXT = { C: 'confirmed', U: 'not answered yet', D: 'declined' };

function renderCrossing(x) {
  $('crossing-card').hidden = !x || !x.date;
  if (!x || !x.date) return;
  $('crossing-date').textContent = dayLabel(x.date);
  if (x.url) $('crossing-link').href = x.url;
  const out = [];
  if (x.times && x.times.length) {
    const t = el('div', 'x-times');
    x.times.forEach((pt) => {
      const s = el('span');
      s.append(el('b', '', pt.name || pt.type || ''), ` ${clockText(pt.start)}${pt.start.slice(0, 10) !== x.date ? ` ${dayLabel(pt.start.slice(0, 10))}` : ''}`);
      t.append(s);
    });
    out.push(t);
  }
  if (x.me) {
    out.push(el('p', `x-me${x.me.status === 'U' ? ' ask' : ''}`,
      `You: ${x.me.position || x.me.team || 'scheduled'} · ${x.me.status === 'U' ? 'please accept or decline' : STATUS_TEXT[x.me.status] || ''}`));
  }
  const others = (x.requests || []).filter((r) => r.date !== x.date);
  if (others.length) {
    out.push(el('p', 'x-me ask', `Also waiting for your answer: ${others.map((r) => `${dayLabel(r.date)} (${r.position || r.service})`).join(', ')}`));
  }
  if (x.songs && x.songs.length) {
    const list = el('div');
    x.songs.forEach((song, i) => {
      const row = el('div', 'x-song');
      const t = el('div', 't', song.title);
      if (song.author) t.append(el('span', '', song.author));
      row.append(el('span', 'n', String(i + 1)), t);
      if (song.key) row.append(el('span', 'x-key', song.key));
      list.append(row);
    });
    out.push(el('div', 't-day', 'Songs'), list);
  } else {
    out.push(el('p', 't-empty', 'No songs in the plan yet.'));
  }
  (x.teams || []).forEach((team) => {
    out.push(el('div', 't-day', team.name));
    const band = el('div', 'x-band');
    team.people.forEach((p) => {
      const who = el('div', p.status || '', p.name);
      who.title = STATUS_TEXT[p.status] || '';
      who.append(el('span', '', p.position || ''));
      band.append(who);
    });
    out.push(band);
  });
  $('crossing').replaceChildren(...out);
}

/* RJ sessions: every session from the Resounding Joy calendar this pay period and last (1st–15th,
   16th–end), with Documented / Billed ticks. "Not a session" hides check-ins and cancelled ones. */

let rjShowAll = false;

function payPeriodStart(day) {
  const [y, m, d] = day.split('-').map(Number);
  return d >= 16 ? `${day.slice(0, 8)}16` : `${day.slice(0, 8)}01`;
}
function ticksNow() {
  const t = lsJSON(TICKS_KEY, {});
  const sessions = { ...(t.sessions || {}) };
  Object.entries(lsJSON(PENDING_KEY, {})).forEach(([id, change]) => { sessions[id] = { ...(sessions[id] || {}), ...change }; });
  return sessions;
}

function renderSessions(all) {
  const today = todayISO();
  const current = payPeriodStart(today);
  const previous = payPeriodStart(addDays(current, -1));
  const now = isoNow();
  const ticks = ticksNow();
  const sessions = all.filter((s) => s.start.slice(0, 10) >= previous && s.start <= now).sort((a, b) => a.start.localeCompare(b.start));
  $('rj-card').hidden = !sessions.length;
  if (!sessions.length) return;
  const isDone = (s) => { const t = ticks[s.id] || {}; return t.skip || (t.doc && t.billed); };
  const toDoc = sessions.filter((s) => !(ticks[s.id] || {}).skip && !(ticks[s.id] || {}).doc).length;
  const toBill = sessions.filter((s) => !(ticks[s.id] || {}).skip && !(ticks[s.id] || {}).billed).length;
  $('rj-sub').textContent = toDoc || toBill ? [toDoc && `${toDoc} to document`, toBill && `${toBill} to bill`].filter(Boolean).join(' · ') : 'all caught up ✓';

  const list = el('div', 'rj-list');
  sessions.filter((s) => rjShowAll || !isDone(s)).forEach((s) => {
    const t = ticks[s.id] || {};
    const row = el('div', `rj-row${isDone(s) ? ' done' : ''}`);
    const head = el('div', 'rj-head');
    const [y, m, d] = s.start.slice(0, 10).split('-').map(Number);
    head.append(el('span', '', s.title), el('span', 'when', `${DAYS[new Date(y, m - 1, d).getDay()]} ${MONTH_NAMES[m - 1]} ${d} · ${clockText(s.start)}`));
    const skip = el('button', 'skip', t.skip ? 'Undo' : 'Not a session');
    skip.type = 'button';
    skip.addEventListener('click', () => setTick(s.id, 'skip', !t.skip));
    head.append(skip);
    row.append(head);
    if (!t.skip) {
      const chips = el('div', 'rj-ticks');
      chips.append(
        tickButton('t-chip', 'Documented', Boolean(t.doc), (on) => setTick(s.id, 'doc', on)),
        tickButton('t-chip', 'Billed', Boolean(t.billed), (on) => setTick(s.id, 'billed', on)),
      );
      row.append(chips);
    }
    list.append(row);
  });
  if (!list.children.length) list.append(el('p', 't-empty', `All ${sessions.length} sessions since ${MONTH_NAMES[Number(previous.slice(5, 7)) - 1]} ${Number(previous.slice(8))} are documented and billed.`));
  const doneCount = sessions.filter(isDone).length;
  const out = [list];
  if (doneCount) {
    const more = el('button', 'rj-more', rjShowAll ? 'Hide finished ones' : `Show finished ones (${doneCount})`);
    more.type = 'button';
    more.addEventListener('click', () => { rjShowAll = !rjShowAll; renderSessions(all); });
    out.push(more);
  }
  $('rj').replaceChildren(...out);
}

let pushTimer = 0;
function setTick(id, field, value) {
  const pending = lsJSON(PENDING_KEY, {});
  pending[id] = { ...(pending[id] || {}), [field]: value };
  lsSet(PENDING_KEY, JSON.stringify(pending));
  renderSessions((lsJSON(DATA_KEY, {}) || {}).rjSessions || []);
  clearTimeout(pushTimer);
  pushTimer = setTimeout(pushTicks, 1200);
  if (!accessKey()) $('updated').textContent = 'Ticks are saved on this device only until you add your access key in Settings.';
}

// Saves ticks made here into ticks.json, merged with whatever other devices saved.
let pushing = false;
async function pushTicks() {
  const token = accessKey();
  const pending = lsJSON(PENDING_KEY, {});
  if (!token || pushing || !Object.keys(pending).length) return;
  pushing = true;
  try {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const file = await readFile('ticks.json', token).catch(() => undefined);
      if (file === undefined) return;   // offline or no access: try again later
      const sessions = { ...((file && file.json.sessions) || {}) };
      Object.entries(pending).forEach(([id, change]) => { sessions[id] = { ...(sessions[id] || {}), ...change }; });
      // Forget ticks for sessions more than four months old (ids start with the session's date).
      const cutoff = addDays(todayISO(), -120);
      Object.keys(sessions).forEach((id) => { if (id.slice(0, 10) < cutoff) delete sessions[id]; });
      const json = { sessions };
      const res = await fetch(`https://api.github.com/repos/${DATA_REPO}/contents/ticks.json`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
        body: JSON.stringify({ message: 'RJ session ticks', content: toBase64(`${JSON.stringify(json, null, 1)}\n`), ...(file ? { sha: file.sha } : {}) }),
      }).catch(() => null);
      if (!res) return;
      if (res.ok) {
        lsSet(TICKS_KEY, JSON.stringify(json));
        // Keep anything ticked while this was saving.
        const later = lsJSON(PENDING_KEY, {});
        Object.keys(pending).forEach((id) => { if (JSON.stringify(later[id]) === JSON.stringify(pending[id])) delete later[id]; });
        lsSet(PENDING_KEY, JSON.stringify(later));
        return;
      }
      if (res.status !== 409 && res.status !== 422) return;   // someone else saved first: read again and retry
    }
  } finally {
    pushing = false;
  }
}

/* Autocross: upcoming events within about 150 miles of San Diego (MotorsportReg's calendar). */

const AX_SHOWN = 5;

function renderAutocross(events) {
  const today = todayISO();
  const near = events.filter((e) => (e.end || e.start) >= today && (e.miles == null || e.miles <= 150)).sort((a, b) => a.start.localeCompare(b.start));
  $('ax-card').hidden = !near.length;
  $('ax-list').replaceChildren(...near.slice(0, AX_SHOWN).map((e) => {
    const [, m, d] = e.start.split('-').map(Number);
    const a = el('a', 't-gig');
    a.href = e.url;
    a.target = '_blank';
    a.rel = 'noopener';
    a.innerHTML = '<div class="t-date"><b></b><span></span></div><div><div class="title"></div><div class="when"></div></div><span class="who"></span>';
    a.querySelector('b').textContent = MONTHS[m - 1];
    a.querySelector('.t-date span').textContent = d;
    a.querySelector('.title').textContent = e.name;
    a.querySelector('.when').textContent = [e.club, [e.city, e.region].filter(Boolean).join(', '), untilText(e.start)].filter(Boolean).join(' · ');
    a.querySelector('.who').textContent = e.miles != null ? `${e.miles} mi` : '';
    return a;
  }));
}

function renderToday() {
  shownDay = todayISO();
  renderClock();
  renderPractice();
  renderGigs(lsJSON(SAVED_KEY, {}).gigs);
  loadGigs();
  loadZ4();
  renderData(lsJSON(DATA_KEY, null));
  loadData();
  pushTicks();
  loadWeather();
}

renderToday();
setTimeout(everyMinute, 60000 - (Date.now() % 60000) + 50);
// Left open (an iPad on a stand): fetch fresh things every 15 minutes.
setInterval(() => { if (!document.hidden) { loadData(); loadWeather(); loadGigs(); loadZ4(); } }, 15 * 60e3);

/* ---------- Settings sheet ---------- */

const sheet = $('settings');
$('settings-open').addEventListener('click', () => {
  renderOffline();
  renderKeys();
  checkUpdates();
  if (sheet.showModal) sheet.showModal(); else sheet.setAttribute('open', '');
});
$('settings-close').addEventListener('click', () => sheet.close ? sheet.close() : sheet.removeAttribute('open'));
// A tap on the dimmed area outside the sheet closes it.
sheet.addEventListener('click', (e) => { if (e.target === sheet) sheet.close(); });

renderOffline();
renderKeys();
document.addEventListener('visibilitychange', () => { if (!document.hidden) { renderOffline(); renderKeys(); renderToday(); } });
addEventListener('online', () => { pushTicks(); loadData(); });
