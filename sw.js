// Offline copy of Rundown (www.davyrockett.com/rundown/). Each app keeps its own offline copy (its own sw.js);
// this one covers Rundown's page and the app icons. Uses the internet when it's there (so the page and its
// script always match after an update) and the saved copy when it isn't.
// IMPORTANT: whenever any file below changes, bump VERSION.
const VERSION = 'v5';
const CACHE = `rundown-${VERSION}`;
const APPS = ['first-frets', 'page-fright', 'lip-service', 'jam-session', 'memory-lane', 'song-party',
  'sos-band-editor', 'sos-band', 'ge150-presets', 'health-log', 'z4-log'];
const ASSETS = [
  './',
  './rundown.js',
  './rundown.css',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/apple-touch-icon.png',
  '../styles.css',
  '../apps/icons/icon-192.png',
  ...APPS.map((a) => `../${a}/icons/icon-192.png`),
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('rundown-v') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== location.origin) return;
  const key = request.mode === 'navigate' ? './' : request;
  event.respondWith(
    fetch(request)
      .then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(key, copy)); }
        return res;
      })
      .catch(() => caches.match(key, { ignoreSearch: true }))
  );
});
