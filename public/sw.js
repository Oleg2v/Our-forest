/* Service worker for the living tree page (scope /tree/) — "היער שלנו".
   · the page shell: network-first, falls back to the last saved copy (offline state 7.3)
   · built assets, fonts, images: stale-while-revalidate (instant repeat visits)
   · the tree's state & a queued watering live in the page's localStorage; the page
     sends them when the connection returns. Push ("ניטע", "פרח", "הפירות בשלו") — live version only. */
const VERSION = 'of-tree-v1';
const SHELL = ['/tree/0427/', '/manifest.webmanifest', '/icons/icon-192.png', '/favicon.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL).catch(() => undefined)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('of-tree-') && k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const sameOrigin = (url) => url.origin === self.location.origin;

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (!sameOrigin(url)) return;

  // the page itself: network first, then the last copy we saved
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put('/tree/0427/', copy)); }
          return res;
        })
        .catch(() => caches.match('/tree/0427/').then((r) => r || caches.match(req)).then((r) => r || new Response(
          '<!doctype html><html lang="he" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>העץ שלכם</title><body style="font-family:system-ui;background:#FBF1E6;color:#2A2118;display:grid;place-items:center;min-height:100vh;text-align:center"><p>אין חיבור כרגע.<br>העץ מחכה לכם, נסו שוב בעוד רגע.</p></body></html>',
          { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
        ))),
    );
    return;
  }

  // static assets: stale-while-revalidate
  if (/^\/(assets|fonts|img|icons|og|favicons|detect-gpu)\//.test(url.pathname) || /\.(css|js|woff2|png|jpg|jpeg|webp|avif|svg)$/.test(url.pathname)) {
    e.respondWith(
      caches.open(VERSION).then((c) => c.match(req).then((hit) => {
        const net = fetch(req).then((res) => { if (res.ok) c.put(req, res.clone()); return res; }).catch(() => hit);
        return hit || net;
      })),
    );
  }
});
