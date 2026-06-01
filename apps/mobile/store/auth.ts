import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import type { PublicUser } from "@zika/types";
import { getCurrencyForCountry } from "../lib/currency";

const ACCESS_TOKEN_KEY = "zika_access_token";
const USER_KEY = "zika_user";

interface AuthState {
  user: PublicUser | null;
  accessToken: string | null;
  isLoading: boolean;
  isHydrated: boolean;
  hasCompletedOnboarding: boolean;
  localCurrency: string | null;
  setAuth: (user: PublicUser, accessToken: string) => Promise<void>;
  clearAuth: () => Promise<void>;
  hydrate: () => Promise<void>;
  setCompletedOnboarding: (completed: boolean) => Promise<void>;
  setLocalCurrency: (currency: string) => Promise<void>;
}

const ONBOARDING_COMPLETED_KEY = "zika_onboarding_completed";
const LOCAL_CURRENCY_KEY = "zika_local_currency";

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isLoading: false,
  isHydrated: false,
  hasCompletedOnboarding: false,
  localCurrency: "USD", // default fallback

  setAuth: async (user, accessToken) => {
    const currency = getCurrencyForCountry(user.country).code;
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
    await SecureStore.setItemAsync(LOCAL_CURRENCY_KEY, currency);
    set({ user, accessToken, localCurrency: currency });
  },

  clearAuth: async () => {
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    await SecureStore.deleteItemAsync(USER_KEY);
    set({ user: null, accessToken: null });
  },

  setCompletedOnboarding: async (completed: boolean) => {
    await SecureStore.setItemAsync(ONBOARDING_COMPLETED_KEY, completed ? "true" : "false");
    set({ hasCompletedOnboarding: completed });
  },

  setLocalCurrency: async (currency: string) => {
    await SecureStore.setItemAsync(LOCAL_CURRENCY_KEY, currency);
    set({ localCurrency: currency });
  },

  hydrate: async () => {
    try {
      const [token, userJson, onboardingCompletedVal, currencyVal] = await Promise.all([
        SecureStore.getItemAsync(ACCESS_TOKEN_KEY).catch(() => null),
        SecureStore.getItemAsync(USER_KEY).catch(() => null),
        SecureStore.getItemAsync(ONBOARDING_COMPLETED_KEY).catch(() => null),
        SecureStore.getItemAsync(LOCAL_CURRENCY_KEY).catch(() => null),
      ]);
      const user = userJson ? (JSON.parse(userJson) as PublicUser) : null;
      const localCurrency = currencyVal || (user ? getCurrencyForCountry(user.country).code : "USD");
      set({
        user,
        accessToken: token,
        hasCompletedOnboarding: onboardingCompletedVal === "true",
        localCurrency,
      });
    } catch (e) {
      console.warn("Auth hydration warning:", e);
    } finally {
      set({ isHydrated: true });
    }
  },
}));
