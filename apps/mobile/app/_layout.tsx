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
import axios from "axios";
import { getEnvStripePublishableKey } from "../lib/stripe-config";
import { useAuthStore } from "../store/auth";
import { useLocationBootstrap } from "../hooks/useLocation";
import { queryClient } from "../lib/query-client";

const screenOptionsByName: Record<string, object> = {
  "pending-approval": { headerShown: false },
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

// Error codes from the auth service that mean "this account can't continue"
const REVOKED_CODES = new Set([
  "ACCOUNT_BANNED",
  "ACCOUNT_SUSPENDED",
  "ACCOUNT_INACTIVE",
  "INVALID_SESSION",
  "SESSION_EXPIRED",
  "NO_TOKEN",
]);

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

async function verifySession(): Promise<"ok" | "revoked" | "network_error"> {
  const { accessToken, user } = useAuthStore.getState();
  if (!accessToken || !user) return "ok"; // not logged in — nothing to check

  // Only call refresh API if access token is actually expired
  if (!isTokenExpired(accessToken)) {
    return "ok";
  }

  const apiUrl =
    process.env["EXPO_PUBLIC_API_URL"] ?? "https://api.kainook.com/auth";
  try {
    const res = await axios.post(
      `${apiUrl}/auth/refresh`,
      {},
      { withCredentials: true, timeout: 8_000 },
    );
    const newToken = (res.data as any)?.data?.tokens?.accessToken;
    if (newToken) {
      await useAuthStore.getState().setAuth(user, newToken);
    }
    return "ok";
  } catch (err: unknown) {
    const res = (err as any)?.response;
    if (!res) return "network_error"; // network issue — don't log out

    const status: number = res.status;
    const code: string = res.data?.error?.code ?? "";

    if (status === 401 || (status === 403 && REVOKED_CODES.has(code))) {
      return "revoked";
    }
    // Any other server error (500 etc.) — don't log out
    return "network_error";
  }
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
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    async function checkSession() {
      const result = await verifySession();
      if (result === "revoked") {
        await useAuthStore.getState().clearAuth();
      }
    }

    // Check on mount
    checkSession().catch(() => {});

    // Check when app resumes from background
    const sub = AppState.addEventListener(
      "change",
      (nextState: AppStateStatus) => {
        const prev = appStateRef.current;
        appStateRef.current = nextState;

        if (nextState === "active" && prev !== "active") {
          checkSession().catch(() => {});
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
