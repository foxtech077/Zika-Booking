import { registerDeviceToken, unregisterDeviceToken } from "@/services/traveller";

const DEVICE_TOKEN_KEY = "zika:push_device_token";

// Backend expects the raw applicationServerKey bytes for pushManager.subscribe —
// VAPID public keys are distributed as URL-safe base64.
function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const bytes = new ArrayBuffer(rawData.length);
  const view = new Uint8Array(bytes);
  for (let i = 0; i < rawData.length; i++) view[i] = rawData.charCodeAt(i);
  return view;
}

/**
 * Registers the current browser for Web Push via POST /notifications/register-device.
 *
 * NOTE: this only completes if NEXT_PUBLIC_VAPID_PUBLIC_KEY is configured. The backend
 * (services/listing-service/src/lib/notifications.ts) holds a VAPID_PUBLIC_KEY but never
 * exposes it to the frontend, and no such env var exists in apps/web today — without it,
 * the browser Push API cannot create a real subscription
 * (PushManager.subscribe requires applicationServerKey), so this safely no-ops rather than
 * sending a fabricated token to the backend.
 */
export async function registerPushNotifications(): Promise<void> {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidPublicKey) return;

  try {
    if (Notification.permission === "denied") return;
    if (Notification.permission !== "granted") {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") return;
    }

    const registration = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });
    }

    const token = JSON.stringify(subscription);
    await registerDeviceToken(token, "web");
    sessionStorage.setItem(DEVICE_TOKEN_KEY, token);
  } catch (err) {
    console.error("[push] Registration failed:", err);
  }
}

/** Unregisters the current device via DELETE /notifications/register-device (call before clearing the session). */
export async function unregisterPushNotifications(): Promise<void> {
  if (typeof window === "undefined") return;
  const token = sessionStorage.getItem(DEVICE_TOKEN_KEY);
  if (!token) return;
  try {
    await unregisterDeviceToken(token);
  } catch (err) {
    console.error("[push] Unregistration failed:", err);
  } finally {
    sessionStorage.removeItem(DEVICE_TOKEN_KEY);
  }
}
