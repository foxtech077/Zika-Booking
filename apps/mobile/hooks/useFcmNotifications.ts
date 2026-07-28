import { useEffect, useRef, useState } from "react";
import { FirebaseMessagingTypes } from "@react-native-firebase/messaging";
import {
  initializeFcm,
  getFcmToken,
  getApnsToken,
  subscribeToTokenRefresh,
  subscribeToForegroundMessages,
  subscribeToNotificationOpened,
  checkInitialNotification,
} from "../services/fcm";

export interface FcmNotificationOptions {
  /** Optional callback fired when a notification arrives in foreground */
  onForegroundNotification?: (message: FirebaseMessagingTypes.RemoteMessage) => void;
  /** Optional callback fired when a notification is tapped (background or cold start) */
  onNotificationTap?: (message: FirebaseMessagingTypes.RemoteMessage) => void;
  /** Automatically initialize FCM on mount (default: true) */
  autoInitialize?: boolean;
}

/**
 * useFcmNotifications
 * Production-ready React hook for managing FCM Push Notifications lifecycle and listeners.
 * Guarantees clean subscription cleanup without memory or listener leaks.
 */
export function useFcmNotifications(options: FcmNotificationOptions = {}) {
  const { onForegroundNotification, onNotificationTap, autoInitialize = true } = options;

  const [token, setToken] = useState<string | null>(null);
  const [apnsToken, setApnsToken] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState<boolean>(false);

  const onForegroundRef = useRef(onForegroundNotification);
  const onTapRef = useRef(onNotificationTap);

  useEffect(() => {
    onForegroundRef.current = onForegroundNotification;
  }, [onForegroundNotification]);

  useEffect(() => {
    onTapRef.current = onNotificationTap;
  }, [onNotificationTap]);

  useEffect(() => {
    if (!autoInitialize) return;

    let isMounted = true;
    const cleanups: Array<() => void> = [];

    async function setup() {
      setIsInitializing(true);
      try {
        const fcmToken = await initializeFcm();
        if (isMounted) {
          setToken(fcmToken);
        }

        const apns = await getApnsToken();
        if (isMounted) {
          setApnsToken(apns);
        }

        // 1. Subscribe to token refresh
        const unsubscribeTokenRefresh = subscribeToTokenRefresh((newToken) => {
          if (isMounted) setToken(newToken);
        });
        cleanups.push(unsubscribeTokenRefresh);

        // 2. Subscribe to foreground messages
        const unsubscribeForeground = subscribeToForegroundMessages((message) => {
          if (onForegroundRef.current) {
            onForegroundRef.current(message);
          }
        });
        cleanups.push(unsubscribeForeground);

        // 3. Subscribe to notification tap (background)
        const unsubscribeOpened = subscribeToNotificationOpened((message) => {
          if (onTapRef.current) {
            onTapRef.current(message);
          }
        });
        cleanups.push(unsubscribeOpened);

        // 4. Check initial notification (cold start killed state)
        void checkInitialNotification((message) => {
          if (onTapRef.current) {
            onTapRef.current(message);
          }
        });
      } catch (error) {
        console.error("[useFcmNotifications] Setup Error:", error);
      } finally {
        if (isMounted) {
          setIsInitializing(false);
        }
      }
    }

    void setup();

    return () => {
      isMounted = false;
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [autoInitialize]);

  return {
    fcmToken: token,
    apnsToken,
    isInitializing,
    refreshToken: getFcmToken,
  };
}
