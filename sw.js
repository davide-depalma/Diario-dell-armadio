/* Diario dell'Armadio — funziona anche senza internet e si aggiorna quando lo decidi tu.
   La pagina viene sempre presa dalla copia salvata ("armadio-app"); l'app controlla se su internet c'è una
   versione nuova e, quando premi "Aggiorna ora" in Impostazioni, la scarica e la mette al posto di quella salvata. */
const SW_VERSION = 'armadio-sw-4';
const APP = 'armadio-app';           // pagina, nome, icone (la versione in uso)
const RUNTIME = 'armadio-risorse';   // caratteri, motore e modello del ritaglio
const SHELL = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/maskable-512.png', './icons/apple-touch-icon.png', './icons/favicon-32.png'];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(APP);
    // la prima volta salvo la versione attuale; dopo, la pagina salvata cambia solo con "Aggiorna ora"
    const have = await c.match('./index.html');
    for (const u of SHELL) { if (have && (u === './' || u === './index.html')) continue; try { const r = await fetch(u, { cache: 'reload' }); if (r.ok) await c.put(u, r); } catch (_) {} }
    if (!have) { const r = await c.match('./index.html'); if (r) await c.put('./', r.clone()); }
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', e => {
  // tolgo solo le mie copie vecchie: quelle delle altre app sullo stesso sito (es. RailOps Hub) non si toccano
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('armadio-') && k !== APP && k !== RUNTIME).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'aggiorna') {
    e.waitUntil((async () => {
      const port = e.ports && e.ports[0];
      try {
        const c = await caches.open(APP);
        const page = await fetch('./index.html', { cache: 'no-store' }); if (!page.ok) throw new Error('pagina ' + page.status);
        await c.put('./index.html', page.clone()); await c.put('./', page.clone());
        for (const u of SHELL.slice(2)) { try { const r = await fetch(u, { cache: 'no-store' }); if (r.ok) await c.put(u, r); } catch (_) {} }
        port && port.postMessage({ ok: true });
      } catch (err) { port && port.postMessage({ ok: false, error: String(err) }); }
    })());
  }
});

self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const same = url.origin === location.origin;
  // la pagina: sempre la copia salvata (così si aggiorna solo quando lo scegli); se non c'è, da internet
  if (req.mode === 'navigate' || (same && /\/(index\.html)?$/.test(url.pathname) && !url.search)) {
    e.respondWith(caches.open(APP).then(c => c.match('./index.html')).then(hit => hit || fetch(req).then(r => { const cp = r.clone(); caches.open(APP).then(c => { c.put('./index.html', cp.clone()); c.put('./', cp); }); return r; })));
    return;
  }
  // il controllo degli aggiornamenti chiede la pagina con ?controlla=…: sempre da internet
  if (same && url.search) { e.respondWith(fetch(req, { cache: 'no-store' }).catch(() => caches.match(req, { ignoreSearch: true }))); return; }
  const heavy = /fonts\.(googleapis|gstatic)\.com|cdn\.jsdelivr\.net/.test(url.host);
  if (heavy || same) {
    e.respondWith(caches.match(req, { ignoreSearch: same }).then(hit => hit || fetch(req).then(r => {
      if (r && (r.ok || r.type === 'opaque') && !/sw\.js$/.test(url.pathname)) { const cp = r.clone(); caches.open(heavy ? RUNTIME : APP).then(c => c.put(req, cp)); }
      return r; })));
  }
});
