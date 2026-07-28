import messaging, { FirebaseMessagingTypes } from "@react-native-firebase/messaging";
import { Platform } from "react-native";
import { DeviceTokenService } from "./deviceTokenService";

/**
 * Enable Firebase Auto-Initialization for push notifications.
 */
export async function enableFcmAutoInit(): Promise<void> {
  try {
    await messaging().setAutoInitEnabled(true);
    console.log("[FCM] Auto-initialization enabled successfully.");
  } catch (error) {
    console.error("[FCM] Failed to enable auto-initialization:", error);
  }
}

/**
 * Request notification permissions from the user.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  try {
    const authStatus = await messaging().requestPermission();
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    const statusText =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED
        ? "AUTHORIZED"
        : authStatus === messaging.AuthorizationStatus.PROVISIONAL
        ? "PROVISIONAL (Quiet notifications enabled)"
        : authStatus === messaging.AuthorizationStatus.DENIED
        ? "DENIED (User declined notifications)"
        : "NOT_DETERMINED";

    console.log(`[FCM] Permission status: ${statusText} (AuthorizationStatus code: ${authStatus})`);
    return enabled;
  } catch (error) {
    console.error("[FCM] Permission Error: Failed to request notification permission:", error);
    return false;
  }
}

/**
 * Register device for remote messages (iOS APNs / Android FCM).
 */
export async function registerDeviceForRemoteMessages(): Promise<void> {
  try {
    if (Platform.OS === "ios") {
      if (!messaging().isDeviceRegisteredForRemoteMessages) {
        await messaging().registerDeviceForRemoteMessages();
        console.log("[FCM] Registered device for remote messages on iOS.");
      }
    }
  } catch (error) {
    console.error("[FCM] Registration Error: Failed to register device for remote messages:", error);
  }
}

/**
 * Retrieve Apple Push Notification service (APNs) token on iOS.
 */
export async function getApnsToken(): Promise<string | null> {
  if (Platform.OS !== "ios") return null;

  try {
    const apnsToken = await messaging().getAPNSToken();
    if (apnsToken) {
      console.log(`==========================\nAPNS TOKEN:\n${apnsToken}\n==========================`);
    } else {
      console.warn(
        "[FCM] APNs Token Notice: APNs token is null. This is normal on iOS Simulators or when APNs environment credentials are missing."
      );
    }
    return apnsToken;
  } catch (error) {
    console.error("[FCM] APNs Token Error: Failed to retrieve APNs token:", error);
    return null;
  }
}

/**
 * Retrieve FCM Registration Token.
 */
export async function getFcmToken(): Promise<string | null> {
  try {
    await registerDeviceForRemoteMessages();

    let apnsToken: string | null = null;
    if (Platform.OS === "ios") {
      apnsToken = await getApnsToken();
    }

    const token = await messaging().getToken();

    if (token) {
      console.log(`==========================\nFCM TOKEN:\n${token}\n==========================`);
      // Register token with backend service
      const payload = DeviceTokenService.buildPayload(token, apnsToken);
      await DeviceTokenService.registerDeviceToken(payload).catch((err) => {
        console.warn("[FCM] Backend Token Registration Warning:", err);
      });
    } else {
      console.warn("[FCM] Token Warning: FCM token returned null or empty string.");
    }

    return token;
  } catch (error) {
    console.error("[FCM] Token Retrieval Error: Failed to get FCM token:", error);
    return null;
  }
}

/**
 * Subscribe to FCM token refresh events.
 */
export function subscribeToTokenRefresh(onRefresh?: (token: string) => void): () => void {
  return messaging().onTokenRefresh(async (newToken: string) => {
    console.log(`[FCM] Token Refresh Event: New FCM Token received:\n==========================\nFCM TOKEN:\n${newToken}\n==========================`);

    let apnsToken: string | null = null;
    if (Platform.OS === "ios") {
      apnsToken = await getApnsToken();
    }

    await DeviceTokenService.refreshDeviceToken(newToken, apnsToken).catch((err) => {
      console.warn("[FCM] Failed to sync refreshed token with backend:", err);
    });

    if (onRefresh) {
      onRefresh(newToken);
    }
  });
}

/**
 * Subscribe to foreground push notifications.
 */
export function subscribeToForegroundMessages(
  onNotification?: (message: FirebaseMessagingTypes.RemoteMessage) => void
): () => void {
  return messaging().onMessage(async (remoteMessage: FirebaseMessagingTypes.RemoteMessage) => {
    console.log("[FCM] Notification Received (Foreground):", {
      messageId: remoteMessage.messageId,
      title: remoteMessage.notification?.title,
      body: remoteMessage.notification?.body,
      data: remoteMessage.data,
      sentTime: remoteMessage.sentTime,
    });

    if (onNotification) {
      onNotification(remoteMessage);
    }
  });
}

/**
 * Subscribe to notification tap when app is in background state.
 */
export function subscribeToNotificationOpened(
  onOpened?: (message: FirebaseMessagingTypes.RemoteMessage) => void
): () => void {
  return messaging().onNotificationOpenedApp((remoteMessage: FirebaseMessagingTypes.RemoteMessage) => {
    console.log("[FCM] Notification Opened (Background -> Active):", {
      messageId: remoteMessage.messageId,
      title: remoteMessage.notification?.title,
      data: remoteMessage.data,
    });

    if (onOpened) {
      onOpened(remoteMessage);
    }
  });
}

/**
 * Check if app was opened from a notification when in a killed/quit state.
 */
export async function checkInitialNotification(
  onOpened?: (message: FirebaseMessagingTypes.RemoteMessage) => void
): Promise<FirebaseMessagingTypes.RemoteMessage | null> {
  try {
    const remoteMessage = await messaging().getInitialNotification();
    if (remoteMessage) {
      console.log("[FCM] Notification Opened (Killed State Cold Start):", {
        messageId: remoteMessage.messageId,
        title: remoteMessage.notification?.title,
        data: remoteMessage.data,
      });

      if (onOpened) {
        onOpened(remoteMessage);
      }
    }
    return remoteMessage;
  } catch (error) {
    console.error("[FCM] Initial Notification Error: Failed to check initial notification:", error);
    return null;
  }
}

/**
 * Main initialization helper for FCM. Call on application bootstrap.
 * Executes sequence:
 * 1. requestNotificationPermission()
 * 2. registerDeviceForRemoteMessages()
 * 3. enableFcmAutoInit()
 * 4. getFcmToken() -> messaging().getToken()
 * 5. DeviceTokenService.registerDeviceToken()
 */
export async function initializeFcm(): Promise<string | null> {
  console.log("[FCM] Bootstrapping Firebase Cloud Messaging...");

  // 1. Request user permission
  const hasPermission = await requestNotificationPermission();
  if (!hasPermission) {
    console.warn("[FCM] Permission Status: Push notifications permission was not granted by user.");
    return null;
  }

  // 2. Register device for remote messages (APNs / Android FCM)
  await registerDeviceForRemoteMessages();

  // 3. Enable auto-initialization
  await enableFcmAutoInit();

  // 4. Retrieve FCM token & 5. Upload token to backend service
  const token = await getFcmToken();
  return token;
}
