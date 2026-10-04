// Clackwork service worker: lets the installed game open and play with no connection.
// It only ever handles requests for the game's own files. The shared leaderboard
// (another origin) is left alone and simply reports that it cannot be reached.
const CACHE = "clackwork-v1";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((name) => name !== CACHE).map((name) => caches.delete(name))))
      .then(() => self.clients.claim()),
  );
});

// The page tells us which files it loaded before we were in control, so the very
// first visit is enough to play offline afterwards.
self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || data.type !== "cache" || !Array.isArray(data.urls)) return;
  const own = data.urls.filter((url) => typeof url === "string" && new URL(url, self.location.href).origin === self.location.origin);
  event.waitUntil(
    caches.open(CACHE).then((cache) => Promise.all(own.map((url) => cache.add(url).catch(() => undefined)))),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // The page itself: the newest copy when online, the saved one when not.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request, { ignoreSearch: true }).then((hit) => hit || caches.match(self.registration.scope))),
    );
    return;
  }

  // Everything else of ours (scripts, styles, fonts, icons): saved copy first. Built
  // files have a fingerprint in their name, so a saved copy is never out of date.
  event.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ||
        fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        }),
    ),
  );
});
