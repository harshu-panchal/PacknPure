/* global importScripts, firebase */

const configParams = new URL(self.location.href).searchParams;
const encodedConfig = configParams.get("firebaseConfig") || "";

let firebaseConfig = {};
try {
  firebaseConfig = encodedConfig ? JSON.parse(decodeURIComponent(encodedConfig)) : {};
} catch {
  firebaseConfig = {};
}

importScripts("https://www.gstatic.com/firebasejs/11.0.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/11.0.0/firebase-messaging-compat.js");

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload?.notification?.title || payload?.data?.title || "PacknPure";
  const options = {
    body: payload?.notification?.body || payload?.data?.body || "You have a new notification.",
    icon: payload?.data?.imageUrl || "/packnpure-icon.svg",
    badge: "/packnpure-icon.svg",
    data: {
      ...payload?.data,
      deepLink: payload?.data?.deepLink || payload?.data?.route || "/",
    },
  };

  self.registration.showNotification(title, options);
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification?.data?.deepLink || "/";

  event.waitUntil(
    (async () => {
      const clientsList = await clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      for (const client of clientsList) {
        if ("focus" in client) {
          client.focus();
          if ("navigate" in client && targetUrl) {
            client.navigate(targetUrl);
          }
          return client;
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
      return null;
    })(),
  );
});
