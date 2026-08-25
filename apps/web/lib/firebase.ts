import { getApp, getApps, initializeApp } from "firebase/app";
import {
  getMessaging,
  getToken,
  isSupported,
  onMessage,
  type MessagePayload,
} from "firebase/messaging";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

function hasFirebaseConfig(): boolean {
  return Object.values(firebaseConfig).every(Boolean);
}

export function getFirebaseApp() {
  if (!hasFirebaseConfig()) return null;
  return getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
}

export async function getWebFcmToken(): Promise<string | null> {
  if (typeof window === "undefined" || !hasFirebaseConfig()) return null;
  if (!("serviceWorker" in navigator) || !("Notification" in window)) return null;
  if ((await isSupported()) === false) return null;

  const app = getFirebaseApp();
  if (!app) return null;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return null;

  const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
  console.info("[FCM] Firebase config", {
    projectId: firebaseConfig.projectId,
    messagingSenderId: firebaseConfig.messagingSenderId,
    appId: firebaseConfig.appId,
    apiKey: firebaseConfig.apiKey
      ? `${firebaseConfig.apiKey.slice(0, 6)}...`
      : undefined,
    vapidKeyConfigured: Boolean(process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY),
  });
  return getToken(getMessaging(app), {
    vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
    serviceWorkerRegistration: registration,
  });
}

export async function subscribeToWebFcmMessages(
  onMessageReceived: (payload: MessagePayload) => void,
): Promise<() => void> {
  if (typeof window === "undefined" || !hasFirebaseConfig() || (await isSupported()) === false) {
    return () => undefined;
  }

  const app = getFirebaseApp();
  if (!app) return () => undefined;
  return onMessage(getMessaging(app), onMessageReceived);
}
