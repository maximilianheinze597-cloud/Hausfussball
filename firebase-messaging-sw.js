/* Hausfußball: Firebase Cloud Messaging service worker */
importScripts("https://www.gstatic.com/firebasejs/12.1.0/firebase-app-compat.js");
importScripts("./firebase-config.js");
importScripts("https://www.gstatic.com/firebasejs/12.1.0/firebase-messaging-compat.js");

if (self.HAUSFUSSBALL_FIREBASE_CONFIG &&
    self.HAUSFUSSBALL_FIREBASE_CONFIG.projectId) {
  firebase.initializeApp(self.HAUSFUSSBALL_FIREBASE_CONFIG);
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage(payload => {
    // Die Benachrichtigung wird hier explizit angezeigt, damit sie auch
    // bei gesetztem onBackgroundMessage-Handler sicher sichtbar ist.
    const data = payload?.data || {};
    const notification = payload?.notification || {};
    return self.registration.showNotification(notification.title || data.title || "⚽ Hausfußball", {
      body: notification.body || data.body || "Neues Ereignis im Live-Ticker.",
      icon: new URL("./icon-192.svg", self.registration.scope).href,
      badge: new URL("./icon-192.svg", self.registration.scope).href,
      data: { url: data.url || new URL("./", self.registration.scope).href },
      tag: data.topic || "hausfussball",
      renotify: true
    });
  });
}

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const target = event.notification?.data?.FCM_MSG?.data?.url ||
    event.notification?.data?.url ||
    new URL("./", self.registration.scope).href;
  event.waitUntil((async () => {
    const windows = await clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if ("focus" in client) {
        await client.focus();
        if ("navigate" in client) await client.navigate(target);
        return;
      }
    }
    if (clients.openWindow) return clients.openWindow(target);
  })());
});
