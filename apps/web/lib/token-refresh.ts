/**
 * Shared token-refresh module.
 *
 * Module-level singleton ensures that if multiple axios instances (api,
 * listing-api, payment-api) all receive 401 simultaneously, only ONE
 * refresh request is issued.  All callers await the same promise and
 * receive the same new access token.
 */

import { clearAnonymousToken } from "@/lib/anonymous";

const TOKEN_KEY = "zika:access_token";

let refreshInFlight: Promise<string | null> | null = null;

/**
 * Calls POST /api/auth/refresh (Next.js route → auth-service proxy).
 * Returns the new access token, or null if the refresh token is expired/invalid.
 * Concurrent calls share a single in-flight promise.
 */
export async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const res = await fetch("/api/auth/refresh", {
        method: "POST",
        credentials: "include",
      });

      if (!res.ok) return null;

      const body = await res.json().catch(() => null);

      const newToken: string | undefined =
        body?.data?.tokens?.accessToken ??
        body?.data?.accessToken ??
        body?.tokens?.accessToken ??
        body?.accessToken;

      if (!newToken) return null;

      if (typeof window !== "undefined") {
        sessionStorage.setItem(TOKEN_KEY, newToken);
        localStorage.setItem(TOKEN_KEY, newToken);
      }

      try {
        const { useAuthStore } = await import("@/stores/auth");
        const { user, setSession } = useAuthStore.getState();
        // /auth/refresh now returns the fresh user (including hostStatus), so
        // prefer it over the possibly-stale stored user.
        const refreshedUser = body?.data?.user ?? body?.user ?? user;
        if (refreshedUser) setSession(newToken, refreshedUser);
      } catch { /* store unavailable during SSR or teardown */ }

      return newToken;
    } catch {
      return null;
    }
  })().finally(() => {
    refreshInFlight = null;
  });

  return refreshInFlight;
}

/**
 * Clears all local session state and redirects to /auth/login.
 * Called when a refresh attempt fails (both tokens expired).
 */
export function clearAuthSession(): void {
  if (typeof window === "undefined") return;

  sessionStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem("zika:web_auth");
  clearAnonymousToken();

  import("@/stores/auth")
    .then(({ useAuthStore }) => useAuthStore.getState().clearSession())
    .catch(() => {});

  setTimeout(() => {
    window.location.href = "/auth/login";
  }, 100);
}
