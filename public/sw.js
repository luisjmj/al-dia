/* Al Día · Service Worker
   Responsable de recibir Web Push y abrir la app al tocar la notificación.
   No cachea el bundle (evita servir versiones viejas; OneDrive recarga seguido). */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Al Día", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "Al Día";
  const options = {
    body: data.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: data.tag || "al-dia",
    data: { url: data.url || "/pagos" },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/pagos";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        for (const c of clients) {
          if ("focus" in c) {
            c.navigate(url);
            return c.focus();
          }
        }
        return self.clients.openWindow(url);
      })
  );
});
