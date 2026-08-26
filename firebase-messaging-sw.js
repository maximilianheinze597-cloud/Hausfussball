importScripts(
  "https://www.gstatic.com/firebasejs/12.1.0/firebase-app-compat.js"
);

importScripts(
  "https://www.gstatic.com/firebasejs/12.1.0/firebase-messaging-compat.js"
);

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

  const notification =
    payload.notification || {};

  const title =
    notification.title ||
    "⚽ Hausfußball";

  const options = {

    body:
      notification.body ||
      "Es gibt Neuigkeiten!",

    icon: "/Hausfussball/icon-192.png",

    badge: "/Hausfussball/icon-192.png",

    data: payload.data || {}

  };

  self.registration.showNotification(
    title,
    options
  );

});
