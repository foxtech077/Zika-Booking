"use client";

import { useEffect } from "react";
import { getWebFcmToken, subscribeToWebFcmMessages } from "@/lib/firebase";
import { listingApi } from "@/lib/listing-api";
import { useAuthStore } from "@/stores/auth";

export function WebFcmSetup() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const userId = useAuthStore((state) => state.user?.id);

  useEffect(() => {
    if (!isAuthenticated || !userId) return;

    let disposed = false;
    let unsubscribe: (() => void) | undefined;

    async function setup() {
      try {
        const token = await getWebFcmToken();
        if (!token || disposed) return;

        await listingApi.post("/notifications/register-device", {
          token,
          // Firebase registration tokens are dispatched through FCM. The
          // backend's `web` platform is reserved for VAPID subscriptions.
          platform: "fcm",
        });

        unsubscribe = await subscribeToWebFcmMessages((payload) => {
          if (Notification.permission !== "granted") return;
          new Notification(payload.notification?.title ?? "Kainook", {
            body: payload.notification?.body,
            data: payload.data,
          });
        });
      } catch (error) {
        // Push setup is optional and must not block the application.
        console.warn("[FCM] Web push setup failed:", error);
      }
    }

    void setup();
    return () => {
      disposed = true;
      unsubscribe?.();
    };
  }, [isAuthenticated, userId]);

  return null;
}
