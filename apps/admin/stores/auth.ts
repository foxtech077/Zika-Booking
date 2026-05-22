"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { AdminUser } from "@/types/admin";

interface AuthState {
  token: string | null;
  user: AdminUser | null;
  isAuthenticated: boolean;
  _hasHydrated: boolean;
  setSession: (token: string, user: AdminUser) => void;
  clearSession: () => void;
  updateUser: (updates: Partial<AdminUser>) => void;
  setHasHydrated: (val: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      isAuthenticated: false,
      _hasHydrated: false,

      setHasHydrated: (val) => set({ _hasHydrated: val }),

      setSession: (token, user) => {
        // Also write to sessionStorage for axios interceptors (api.ts reads it)
        if (typeof window !== "undefined") {
          sessionStorage.setItem("zika:admin_session", token);
        }
        set({ token, user, isAuthenticated: true });
      },

      clearSession: () => {
        if (typeof window !== "undefined") {
          sessionStorage.removeItem("zika:admin_session");
        }
        set({ token: null, user: null, isAuthenticated: false });
      },

      updateUser: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        })),
    }),
    {
      name: "zika:admin_auth",
      storage: createJSONStorage(() =>
        typeof window !== "undefined"
          ? sessionStorage
          : {
              getItem: () => null,
              setItem: () => undefined,
              removeItem: () => undefined,
            }
      ),
      // Only persist the token + user — not the callbacks or hydration flag
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
      // Fire after sessionStorage is read and state is rehydrated
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
        // Sync the raw token key that axios interceptors use
        if (state?.token && typeof window !== "undefined") {
          sessionStorage.setItem("zika:admin_session", state.token);
        }
      },
    }
  )
);
