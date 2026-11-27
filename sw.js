/* Diario dell'Armadio — funziona anche senza internet.
   L'app si aggiorna da sola: la pagina viene sempre presa da internet quando c'è, altrimenti dalla copia salvata.
   Caratteri, motore e modello del ritaglio si scaricano una volta e restano salvati. */
const VERSION = 'armadio-v3.1.3';   // le cache delle altre app sullo stesso sito (es. RailOps Hub) non vengono toccate
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png', './icons/favicon-32.png'];
const RUNTIME = 'armadio-risorse';

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('armadio-') && k !== VERSION && k !== RUNTIME).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('message', e => { if (e.data === 'skipWaiting') self.skipWaiting(); });

self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // pagina: prima internet (per avere sempre l'ultima versione), poi la copia salvata
  if (req.mode === 'navigate' || (url.origin === location.origin && /\/(index\.html)?$/.test(url.pathname))) {
    e.respondWith(fetch(req).then(r => { const cp = r.clone(); caches.open(VERSION).then(c => c.put('./index.html', cp)); return r; })
      .catch(() => caches.match('./index.html', { ignoreSearch: true })));
    return;
  }
  // nome, icona e motore dell'app: sempre da internet quando c'è (così gli aggiornamenti arrivano subito)
  if (url.origin === location.origin && /(manifest\.webmanifest|sw\.js)$/.test(url.pathname)) {
    e.respondWith(fetch(req, { cache: 'no-store' }).catch(() => caches.match(req, { ignoreSearch: true })));
    return;
  }
  // caratteri, motore AI e modello del ritaglio: dalla copia salvata, altrimenti li scarico e li salvo
  const heavy = /fonts\.(googleapis|gstatic)\.com|cdn\.jsdelivr\.net/.test(url.host);
  if (heavy || url.origin === location.origin) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
      if (r && (r.ok || r.type === 'opaque')) { const cp = r.clone(); caches.open(heavy ? RUNTIME : VERSION).then(c => c.put(req, cp)); }
      return r; })));
  }
});
