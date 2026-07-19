import messaging from "@react-native-firebase/messaging";
import { registerRootComponent } from "expo";
import { ExpoRoot } from "expo-router";

/**
 * Top-Level Background Message Handler.
 * CRITICAL: MUST be registered at the true application entry point BEFORE
 * any React component tree or hooks are instantiated so that Android Headless JS
 * background tasks can handle killed/background push notifications.
 */
messaging().setBackgroundMessageHandler(async (remoteMessage) => {
  console.log("[FCM] Background Handler Executed (Application Entry Point index.js):", {
    messageId: remoteMessage.messageId,
    title: remoteMessage.notification?.title,
    body: remoteMessage.notification?.body,
    data: remoteMessage.data,
    sentTime: remoteMessage.sentTime,
  });
});

export function App() {
  // Expo Router context loader for app directory
  // @ts-ignore - require.context is provided by Expo Metro bundler
  const ctx = require.context("./app");
  return <ExpoRoot context={ctx} />;
}

registerRootComponent(App);
