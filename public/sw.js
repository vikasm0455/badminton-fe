/* RallyUp Service Worker — push, notification routing, offline shell (PRD §16.2) */
// Stamped per deploy (sed in Dockerfile) so the browser detects a new worker and
// updates automatically. Falls back to a constant string in local dev.
const VERSION = "__BUILD_ID__";
const CACHE = "rallyup-" + VERSION;
const SHELL = ["/", "/home", "/offline", "/manifest.json", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL).catch(() => {})).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Navigations: network-first (always fresh HTML when online) with an offline
// fallback. Static GETs: stale-while-revalidate so assets refresh in the
// background. API calls always go to the network (never cached).
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((resp) => {
          const copy = resp.clone();
          caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
          return resp;
        })
        .catch(() => caches.match(request).then((r) => r || caches.match("/offline")))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const fresh = fetch(request)
        .then((resp) => {
          if (resp && resp.ok) {
            const copy = resp.clone();
            caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
          }
          return resp;
        })
        .catch(() => cached);
      return cached || fresh;
    })
  );
});

// Let the page trigger immediate activation of a waiting worker.
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

// Push: show an OS notification. Suppressed when the app is already focused
// (PRD §8.5) — the page can show its own in-app toast instead.
self.addEventListener("push", (event) => {
  let data = { title: "RallyUp", body: "", url: "/home", tag: "rallyup" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch (_) {}

  event.waitUntil(
    (async () => {
      const clientsArr = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const focused = clientsArr.some((c) => c.focused || c.visibilityState === "visible");
      if (focused) {
        clientsArr.forEach((c) => c.postMessage({ type: "push", payload: data }));
        return;
      }
      await self.registration.showNotification(data.title, {
        body: data.body,
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        tag: data.tag,
        data: { url: data.url },
        renotify: true,
      });
    })()
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/home";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientsArr) => {
      for (const client of clientsArr) {
        if ("focus" in client) {
          client.navigate(target).catch(() => {});
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    })
  );
});
