const CACHE_NAME = "dartos-pwa-cache-v1";

// Essential initial assets
const INITIAL_ASSETS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icon.svg"
];

// On install, perform pre-caching of key entries
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(INITIAL_ASSETS).catch((err) => {
        console.warn("Non-blocking warning: Pre-cache initial assets skipped", err);
      });
    })
  );
  self.skipWaiting();
});

// Clean up old caches on activation
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch logic: Network-First with Cache Fallback for maximum reliability and instant dev/prod updates
self.addEventListener("fetch", (event) => {
  // We only cache GET requests
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Skip tracking websockets, database requests, HMR, chrome extensions or cross-origin trackers
  if (
    url.origin !== self.location.origin ||
    url.pathname.includes("chrome-extension") ||
    url.pathname.includes("events") ||
    url.pathname.includes("/api/") ||
    event.request.url.includes("firestore.googleapis.com") ||
    event.request.url.includes("firebase")
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Cache successful response dynamically
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === "basic") {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // If the network request fails, look in the cache
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          
          // Return index.html as a fallback for the SPA router
          if (event.request.headers.get("accept")?.includes("text/html")) {
            return caches.match("/");
          }
        });
      })
  );
});
