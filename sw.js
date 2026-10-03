const V = 'hanzi-v6';
const FILES = ['./', 'index.html', 'css/styles.css', 'js/config.js', 'js/core.js', 'js/sync.js', 'js/data/hsk-starter.js', 'js/data/hsk3-chars.js', 'js/data/hsk-words.js', 'js/store.js', 'js/srs.js', 'js/ui.js', 'js/gami.js', 'js/collections.js', 'js/views/card.js', 'js/views/study.js', 'js/views/games.js', 'js/views/games2.js', 'js/views/library.js', 'js/views/words.js', 'js/views/evo.js', 'js/views/home.js', 'js/app.js', 'icons/icon.svg'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== V).map(x => caches.delete(x)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then(r => { if (new URL(e.request.url).origin === location.origin) { const c = r.clone(); caches.open(V).then(x => x.put(e.request, c)); } return r; }).catch(() => caches.match(e.request)));
});
