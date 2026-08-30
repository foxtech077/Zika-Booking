/* Firebase Messaging background worker. Keep this file at the site root. */
importScripts("https://www.gstatic.com/firebasejs/12.18.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/12.18.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyARJqLXzSArg3_67bv0Wh8-CBsZryVJkeg",
  authDomain: "kainook-cd1d2.firebaseapp.com",
  projectId: "kainook-cd1d2",
  storageBucket: "kainook-cd1d2.firebasestorage.app",
  messagingSenderId: "1022728776661",
  appId: "1:1022728776661:web:ec8b8cceaaccdf65af6b5c",
});

firebase.messaging().onBackgroundMessage((payload) => {
  const notification = payload.notification || {};
  self.registration.showNotification(notification.title || "Kainook", {
    body: notification.body || "You have a new notification.",
    data: payload.data || {},
  });
});
