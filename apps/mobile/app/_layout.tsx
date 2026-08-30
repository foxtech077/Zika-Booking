import "react-native-get-random-values";
import "react-native-url-polyfill/auto";
import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus, Platform, View } from "react-native";
import { SafeAreaView, SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

// Configure default edges globally for react-native-safe-area-context
if (SafeAreaView.defaultProps) {
  SafeAreaView.defaultProps.edges =
    Platform.OS === "android" ? ["top", "bottom"] : ["top"];
} else {
  SafeAreaView.defaultProps = {
    edges: Platform.OS === "android" ? ["top", "bottom"] : ["top"],
  };
}
import { QueryClientProvider } from "@tanstack/react-query";
import { StripeProvider } from "@stripe/stripe-react-native";
import { getEnvStripePublishableKey } from "../lib/stripe-config";
import { useAuthStore } from "../store/auth";
import { useLocationBootstrap } from "../hooks/useLocation";
import { queryClient } from "../lib/query-client";
import { useFcmNotifications } from "../hooks/useFcmNotifications";
import { refreshAccessToken } from "../lib/token-refresh";

const screenOptionsByName: Record<string, object> = {
  "pending-approval": { headerShown: false },
  host: { headerShown: false },
  suspended: { headerShown: false },
  "(provider)": { headerShown: false },
  wallet: { headerShown: false },
  notifications: { headerShown: false },
  "listings/new": { headerShown: false },
  "listings/[id]/index": { headerShown: false },
  "booking/[id]": { headerShown: false },
  "booking/submitted": { headerShown: false },
  "provider/booking/[id]": { headerShown: false },
  search: { headerShown: false },
  "book/[listingId]": { headerShown: true, headerBackTitle: "Back" },
  "pay/[bookingId]": {
    headerShown: true,
    title: "Complete Payment",
    headerBackTitle: "Back",
  },
  "review/[bookingId]": {
    headerShown: true,
    title: "Leave a Review",
    headerBackTitle: "Back",
  },
  // ── Booking documents ────────────────────────────────────────────────────────
  "booking/receipt/[id]": {
    headerShown: true,
    title: "Receipt",
    headerBackTitle: "Back",
  },
  "booking/qr/[id]": {
    headerShown: true,
    title: "QR Code",
    headerBackTitle: "Back",
  },
  "booking/voucher/[id]": {
    headerShown: true,
    title: "Voucher",
    headerBackTitle: "Back",
  },
  // ── Payment method management ─────────────────────────────────────────────
  "payment-methods/index": {
    headerShown: true,
    title: "Payment Methods",
    headerBackTitle: "Back",
  },
  "payment-methods/add-card": {
    headerShown: true,
    title: "Add Card",
    headerBackTitle: "Back",
  },
  "payment-methods/add-tara": {
    headerShown: true,
    title: "Add Mobile Money",
    headerBackTitle: "Back",
  },
  // ── Profile management ────────────────────────────────────────────────────
  "edit-profile": { headerShown: false },
  // ── Legal documents ───────────────────────────────────────────────────────
  "legal/[doc]": { headerShown: false },
  // ── Help & FAQ ────────────────────────────────────────────────────────────
  help: { headerShown: false },
};

function isTokenExpired(token: string | null): boolean {
  if (!token) return true;
  try {
    const parts = token.split(".");
    if (parts.length < 2) return true;
    const base64 = parts[1]!.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    const payload = JSON.parse(jsonPayload);
    if (!payload.exp || typeof payload.exp !== "number") return false;
    // Consider expired if less than 60 seconds remaining
    return Date.now() / 1000 >= payload.exp - 60;
  } catch {
    return false; // On parse failure, rely on 401 response interceptors
  }
}

async function verifySession(): Promise<void> {
  const { accessToken, user } = useAuthStore.getState();
  if (!accessToken || !user) return; // not logged in — nothing to check

  // Only refresh if the access token is actually expired
  if (!isTokenExpired(accessToken)) return;

  // Must go through the shared singleton. This used to POST /auth/refresh with
  // its own axios call, which made it a fourth refresh path racing the three
  // API clients: on resume it fired at the same moment as the screens' refetches
  // (staleTime is 0, so every remount refetches). Refresh ROTATES — whichever
  // call lost presented an already-revoked token, got 401, and logged the user
  // out. Sharing the in-flight promise makes resume a single refresh.
  //
  // The singleton also owns the clear-on-failure decision, so this no longer
  // reports a verdict for the caller to act on: a network error or 5xx leaves
  // the session alone, and only a definitive rejection ends it.
  await refreshAccessToken();
}

export default function RootLayout() {
  const hydrate = useAuthStore((s) => s.hydrate);
  const isHydrated = useAuthStore((s) => s.isHydrated);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  if (!isHydrated) return null;

  return (
    <SafeAreaProvider>
      <RootLayoutContent />
    </SafeAreaProvider>
  );
}

function RootLayoutContent() {
  useLocationBootstrap();
  useFcmNotifications();
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    async function checkSession() {
      await verifySession();
    }

    // Check on mount
    checkSession().catch(() => { });

    // Check when app resumes from background
    const sub = AppState.addEventListener(
      "change",
      (nextState: AppStateStatus) => {
        const prev = appStateRef.current;
        appStateRef.current = nextState;

        if (nextState === "active" && prev !== "active") {
          checkSession().catch(() => { });
        }
      },
    );

    return () => {
      sub.remove();
    };
  }, []);

  const insets = useSafeAreaInsets();

  return (
    <StripeProvider
      publishableKey={getEnvStripePublishableKey()}
      merchantIdentifier="merchant.com.kainook.app"
    >
      <QueryClientProvider client={queryClient}>
        <View style={{ flex: 1, backgroundColor: "#F9F8F6" }}>
          <StatusBar style="light" backgroundColor="#024622" translucent={false} />
          {Platform.OS === "ios" && (
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: insets.top,
                backgroundColor: "#024622",
                zIndex: 9999,
              }}
            />
          )}
          <Stack
            screenOptions={({ route }) => ({
              headerShown: false,
              ...(screenOptionsByName[route.name] ?? {}),
            })}
          />
        </View>
      </QueryClientProvider>
    </StripeProvider>
  );
}
