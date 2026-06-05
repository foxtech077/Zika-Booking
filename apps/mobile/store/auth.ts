import { create } from "zustand";
import * as SecureStore from "expo-secure-store";
import type { PublicUser } from "@zika/types";

const ACCESS_TOKEN_KEY = "zika_access_token";
const USER_KEY = "zika_user";

interface AuthState {
  user: PublicUser | null;
  accessToken: string | null;
  isLoading: boolean;
  isHydrated: boolean;
  setAuth: (user: PublicUser, accessToken: string) => Promise<void>;
  clearAuth: () => Promise<void>;
  hydrate: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isLoading: false,
  isHydrated: false,

  setAuth: async (user, accessToken) => {
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
    set({ user, accessToken });
  },

  clearAuth: async () => {
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
    await SecureStore.deleteItemAsync(USER_KEY);
    set({ user: null, accessToken: null });
  },

  hydrate: async () => {
    try {
      const [token, userJson] = await Promise.all([
        SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
        SecureStore.getItemAsync(USER_KEY),
      ]);
      if (token && userJson) {
        set({ user: JSON.parse(userJson) as PublicUser, accessToken: token });
      }
    } finally {
      set({ isHydrated: true });
    }
  },
}));
