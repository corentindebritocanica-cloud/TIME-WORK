/**
 * Service worker TIME-WORK : démarrage hors ligne de l'application.
 *  - fichiers de l'app (même origine) : réseau d'abord (toujours la dernière version),
 *    cache en secours si hors ligne ;
 *  - SDK Firebase (URL versionnée sur gstatic) : cache d'abord ;
 *  - Firestore / Auth : jamais interceptés (le SDK gère son propre cache IndexedDB).
 */
const VERSION = 'tw-2026-09-29-lot3b';
const SHELL = [
    './', './index.html', './css/app.css', './manifest.webmanifest', './icons/icon.svg', './icons/icon-192.png',
    './js/app.js', './js/cloud.js', './js/firebase.js', './js/store.js', './js/migrate.js',
    './js/domain/time.js', './js/domain/balance.js', './js/domain/types.js', './js/domain/validate.js',
    './js/domain/csv.js', './js/domain/backup.js',
    './js/ui/dom.js', './js/ui/dialog.js', './js/ui/toast.js', './js/ui/pie.js', './js/ui/quick.js',
    './js/views/home.js', './js/views/pointage.js', './js/views/suivi.js', './js/views/shared.js',
    './js/views/dashboard.js', './js/views/affaires.js', './js/views/chrono.js', './js/views/imputees.js'
];
const SDK_PREFIX = 'https://www.gstatic.com/firebasejs/';
const NETWORK_TIMEOUT_MS = 4000;

self.addEventListener('install', event => {
    event.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
    event.waitUntil(caches.keys()
        .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
        .then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
    const req = event.request;
    if (req.method !== 'GET') return;
    const url = new URL(req.url);
    if (url.href.startsWith(SDK_PREFIX)) { event.respondWith(cacheFirst(req)); return; }
    if (url.origin === self.location.origin) event.respondWith(networkFirst(req));
});

async function cacheFirst(req) {
    const hit = await caches.match(req);
    if (hit) return hit;
    const res = await fetch(req);
    if (res.ok) (await caches.open(VERSION)).put(req, res.clone());
    return res;
}

async function networkFirst(req) {
    const cache = await caches.open(VERSION);
    try {
        const res = await Promise.race([
            fetch(req, { cache: 'no-cache' }),     // revalide auprès du serveur (pas de version périmée)
            new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), NETWORK_TIMEOUT_MS))
        ]);
        if (res.ok) cache.put(req, res.clone());
        return res;
    } catch {
        const hit = await cache.match(req, { ignoreSearch: true }) ||
                    (req.mode === 'navigate' ? await cache.match('./index.html') : null);
        return hit || Response.error();
    }
}
