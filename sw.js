// Service worker: app shell = stale-while-revalidate (opens instantly, updates next time);
// Wikipedia portraits/summaries = cache-first (load once online, then work offline).
const BUILD = "20261108132657";
const SHELL = "mp-shell-" + BUILD, IMG = "mp-img-v1";
const FILES = ["./", "index.html", "manifest.webmanifest", "icon-192.png", "icon-512.png"];

self.addEventListener("install", e => {
  // cache:"reload" bypasses the browser's HTTP cache, so a new build never installs a stale copy
  e.waitUntil(caches.open(SHELL).then(c => Promise.all(FILES.map(f => fetch(f, { cache: "reload" }).then(r => { if (!r.ok) throw new Error(f); return c.put(f, r); }))))
    .then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("mp-shell-") && k !== SHELL).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.hostname === "upload.wikimedia.org" || (url.hostname === "en.wikipedia.org" && url.pathname.startsWith("/api/"))) {
    e.respondWith(caches.open(IMG).then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok || res.type === "opaque") c.put(req, res.clone());
      return res;
    }));
    return;
  }
  if (url.origin === self.location.origin) {
    e.respondWith(caches.open(SHELL).then(async c => {
      const hit = await c.match(req, { ignoreSearch: true });
      const net = fetch(req, { cache: "no-cache" }).then(res => { if (res.ok) c.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    }));
  }
});
