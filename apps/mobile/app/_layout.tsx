import "react-native-get-random-values";
import "react-native-url-polyfill/auto";
import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StripeProvider } from "@stripe/stripe-react-native";
import axios from "axios";
import { getEnvStripePublishableKey } from "../lib/stripe-config";
import { useAuthStore } from "../store/auth";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

const screenOptionsByName: Record<string, object> = {
  "pending-approval":          { headerShown: false },
  suspended:                   { headerShown: false },
  "(provider)":                { headerShown: false },
  wallet:                      { headerShown: false },
  notifications:               { headerShown: false },
  "listings/new":              { headerShown: false },
  "listings/[id]/index":       { headerShown: false },
  "booking/[id]":              { headerShown: false },
  "booking/submitted":         { headerShown: false },
  "provider/booking/[id]":     { headerShown: false },
  search:                      { headerShown: true, title: "Search Results", headerBackTitle: "Back" },
  "book/[listingId]":          { headerShown: true, headerBackTitle: "Back" },
  "pay/[bookingId]":           { headerShown: true, title: "Complete Payment", headerBackTitle: "Back" },
  "review/[bookingId]":        { headerShown: true, title: "Leave a Review", headerBackTitle: "Back" },
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

async function verifySession(): Promise<"ok" | "revoked" | "network_error"> {
  const { accessToken, user } = useAuthStore.getState();
  if (!accessToken || !user) return "ok"; // not logged in — nothing to check

  const apiUrl = process.env["EXPO_PUBLIC_API_URL"] ?? "http://localhost:3001";
  try {
    await axios.post(
      `${apiUrl}/auth/refresh`,
      {},
      { withCredentials: true, timeout: 8_000 }
    );
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
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    async function runCheck() {
      const result = await verifySession();
      if (result === "revoked") {
        await useAuthStore.getState().clearAuth();
        // clearAuth sets user → null.
        // The (provider)/_layout.tsx guard sees null and redirects to login.
      }
    }

    function startInterval() {
      if (intervalRef.current) return;
      // Poll every 30 s while app is in foreground
      intervalRef.current = setInterval(() => { runCheck().catch(() => {}); }, 30_000);
    }

    function stopInterval() {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    // Run immediately on mount
    runCheck().catch(() => {});

    // Start the polling interval
    startInterval();

    // Pause polling when app backgrounds, resume on foreground
    const sub = AppState.addEventListener("change", (nextState: AppStateStatus) => {
      const prev = appStateRef.current;
      appStateRef.current = nextState;

      if (nextState === "active" && prev !== "active") {
        runCheck().catch(() => {});   // immediate check on foreground
        startInterval();   // restart interval
      } else if (nextState === "background" || nextState === "inactive") {
        stopInterval();    // no polling while backgrounded
      }
    });

    return () => {
      sub.remove();
      stopInterval();
    };
  }, []);

  if (!isHydrated) return null;

  return (
    <StripeProvider
      publishableKey={getEnvStripePublishableKey()}
      merchantIdentifier="merchant.com.zikabooking.app"
    >
      <QueryClientProvider client={queryClient}>
        <StatusBar style="auto" />
        <Stack
          screenOptions={({ route }) => ({
            headerShown: false,
            ...(screenOptionsByName[route.name] ?? {}),
          })}
        />
      </QueryClientProvider>
    </StripeProvider>
  );
}
