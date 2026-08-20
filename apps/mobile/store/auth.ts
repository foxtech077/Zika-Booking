import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import type { PublicUser } from "@zika/types";
import { clearAnonymousToken, hydrateAnonymousToken } from "../lib/anonymous";

const ACCESS_TOKEN_KEY = "zika_access_token";
const USER_KEY = "zika_user";

interface AuthState {
  user: PublicUser | null;
  accessToken: string | null;
  isLoading: boolean;
  isHydrated: boolean;
  hasCompletedOnboarding: boolean;
  localCurrency: string | null;
  /** True once the user has picked a currency by hand via the header selector. */
  currencyExplicit: boolean;
  setAuth: (user: PublicUser, accessToken: string) => Promise<void>;
  updateUser: (patch: Partial<PublicUser>) => Promise<void>;
  clearAuth: () => Promise<void>;
  hydrate: () => Promise<void>;
  setCompletedOnboarding: (completed: boolean) => Promise<void>;
  setLocalCurrency: (currency: string) => Promise<void>;
}

const ONBOARDING_COMPLETED_KEY = "zika_onboarding_completed";
const LOCAL_CURRENCY_KEY = "zika_local_currency";
const CURRENCY_EXPLICIT_KEY = "zika_currency_explicit";

// photoUrl is excluded from anything written to SecureStore: /auth/profile and
// PATCH /auth/profile/:id now return a presigned S3 URL valid for ~15 minutes,
// so persisting it would mean serving an expired/broken image on next app
// launch. It only ever lives in-memory (this store's runtime state + the
// short-TTL React Query cache in hooks/profile.ts) and is re-fetched as needed.
function stripPersistedFields(user: PublicUser): PublicUser {
  const { photoUrl, ...rest } = user;
  return rest;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  isLoading: false,
  isHydrated: false,
  hasCompletedOnboarding: false,
  // EUR is the fixed default. There used to be an automatic country/IP-based
  // suggestion here (a profile-country mapping in setAuth, and an
  // IP-geolocation one in hooks/useLocation.ts) that silently replaced it —
  // removed at the user's request so EUR stays the default until the traveller
  // explicitly picks a currency from the header selector.
  localCurrency: "EUR",
  currencyExplicit: false,

  setAuth: async (user, accessToken) => {
    // A real session supersedes any anonymous one. Clearing it here stops a
    // leftover anonymous token from being picked up as a fallback later.
    await clearAnonymousToken();
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(stripPersistedFields(user)));
    set({ user, accessToken });
  },

  // Merges a partial update (e.g. after editing the profile or changing the
  // photo) into the in-memory user object so every screen reading from the
  // store reflects it immediately, without a full re-login. `photoUrl` is
  // kept in-memory only (see stripPersistedFields) since GET/PATCH /auth/profile
  // now return a short-lived (~15min) presigned S3 URL that must never be
  // written to persistent storage.
  updateUser: async (patch) => {
    const current = get().user;
    if (!current) return;
    const merged = { ...current, ...patch };
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(stripPersistedFields(merged)));
    set({ user: merged });
  },

clearAuth: async () => {
  try {
    await GoogleSignin.signOut();
  } catch (error) {
    console.warn("Google sign out failed:", error);
  }

  try {
    await Promise.all([
      SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
      SecureStore.deleteItemAsync(USER_KEY),
      clearAnonymousToken(),
    ]);
  } catch (error) {
    console.warn("Failed to clear auth storage:", error);
  } finally {
    set({
      user: null,
      accessToken: null,
    });
  }
},

  setCompletedOnboarding: async (completed: boolean) => {
    await SecureStore.setItemAsync(ONBOARDING_COMPLETED_KEY, completed ? "true" : "false");
    set({ hasCompletedOnboarding: completed });
  },

  setLocalCurrency: async (currency: string) => {
    await SecureStore.setItemAsync(LOCAL_CURRENCY_KEY, currency);
    await SecureStore.setItemAsync(CURRENCY_EXPLICIT_KEY, "true");
    set({ localCurrency: currency, currencyExplicit: true });
  },

  hydrate: async () => {
    try {
      const [token, userJson, onboardingCompletedVal, currencyVal, explicitVal] = await Promise.all([
        SecureStore.getItemAsync(ACCESS_TOKEN_KEY).catch(() => null),
        SecureStore.getItemAsync(USER_KEY).catch(() => null),
        SecureStore.getItemAsync(ONBOARDING_COMPLETED_KEY).catch(() => null),
        SecureStore.getItemAsync(LOCAL_CURRENCY_KEY).catch(() => null),
        SecureStore.getItemAsync(CURRENCY_EXPLICIT_KEY).catch(() => null),
      ]);
      // Interceptors read the anonymous token synchronously, so warm its cache
      // during hydration alongside the account session.
      await hydrateAnonymousToken().catch(() => {});
      const user = userJson ? (JSON.parse(userJson) as PublicUser) : null;
      const currencyExplicit = explicitVal === "true";
      // Keep a currency the traveller picked by hand; a value that only ever
      // came from the now-removed profile-country / IP-geolocation
      // auto-detection resets to the fixed EUR default.
      const localCurrency = currencyExplicit && currencyVal ? currencyVal : "EUR";
      set({
        user,
        accessToken: token,
        hasCompletedOnboarding: onboardingCompletedVal === "true",
        localCurrency,
        currencyExplicit,
      });
    } catch (e) {
      console.warn("Auth hydration warning:", e);
    } finally {
      set({ isHydrated: true });
    }
  },
}));
