// Minimal Web Push service worker (hand-written — this project has no CRA
// PWA/workbox scaffolding). Registered from src/lib/push.js, scope "/" so it
// can receive push events regardless of which page the visitor subscribed on.
/* eslint-disable no-restricted-globals */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = { title: "NEOwatch", body: "" };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch (_) {
    // Non-JSON payload — fall back to the default title/empty body.
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/web-app-manifest-192x192.png",
      badge: "/favicon-96x96.png",
      data: { url: payload.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data && event.notification.data.url;
  if (!url) return;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url === url && "focus" in client) return client.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});
