// Minimal service worker for Web Push notifications.
// Receives push events dispatched by services/listing-service (see
// services/listing-service/src/lib/notifications.ts → dispatchWebPush) and
// shows them as a browser notification; forwards clicks to the app.
self.addEventListener("push", (event) => {
  let payload = { title: "Kainook", body: "" };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    // Non-JSON payload — fall back to defaults
  }
  event.waitUntil(
    self.registration.showNotification(payload.title || "Kainook", {
      body: payload.body || "",
      icon: "/images/kainook-logo.jpeg",
      data: payload.data || {},
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const url = "/traveller/notifications";
      for (const client of clients) {
        if ("focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    }),
  );
});
