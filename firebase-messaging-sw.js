importScripts("https://www.gstatic.com/firebasejs/12.1.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.1.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyAzk1qGSesg45fBr4ZSmdpxSXCSGnc0KFY",
  authDomain: "hausfussball.firebaseapp.com",
  projectId: "hausfussball",
  storageBucket: "hausfussball.firebasestorage.app",
  messagingSenderId: "993563856895",
  appId: "1:993563856895:web:9de5ebd3f028d7670621ca"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log(
    "[Hausfußball] Push empfangen:",
    payload
  );

  const title =
    payload.notification?.title ||
    "⚽ Hausfußball";

  const options = {
    body:
      payload.notification?.body ||
      "Es gibt etwas Neues!",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: {
      url: "/"
    }
  };

  self.registration.showNotification(
    title,
    options
  );
});

self.addEventListener(
  "notificationclick",
  (event) => {

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
          return clients.openWindow("/");
        }

      })
    );

  }
);
