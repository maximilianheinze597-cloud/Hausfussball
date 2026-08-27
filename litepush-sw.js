self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data;

  try {
    data = event.data.json();
  } catch {
    data = {
      title: "⚽ Hausfußball",
      body: event.data.text()
    };
  }

  const title = data.title || "⚽ Hausfußball";

  const options = {
    body: data.body || "Neues Ereignis im Live-Ticker!",
    icon: "/Hausfussball/icon-192.png",
    badge: "/Hausfussball/icon-192.png",
    data: {
      url: "/Hausfussball/"
    }
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({
      type: "window",
      includeUncontrolled: true
    }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          return client.focus();
        }
      }

      if (clients.openWindow) {
        return clients.openWindow("/Hausfussball/");
      }
    })
  );
});
