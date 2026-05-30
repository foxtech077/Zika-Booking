"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface AuthUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
  userType: string;
  businessName?: string | null;
  country?: string | null;
  emailVerified: boolean;
  currentTier: string;
  loyaltyPoints: number;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  _hasHydrated: boolean;
  setSession: (token: string, user: AuthUser) => void;
  clearSession: () => void;
  updateUser: (updates: Partial<AuthUser>) => void;
  setHasHydrated: (val: boolean) => void;
}

const TOKEN_KEY = "zika:access_token";

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token:           null,
      user:            null,
      isAuthenticated: false,
      _hasHydrated:    false,

      setHasHydrated: (val) => set({ _hasHydrated: val }),

      setSession: (token, user) => {
        if (typeof window !== "undefined") {
          sessionStorage.setItem(TOKEN_KEY, token);
        }
        set({ token, user, isAuthenticated: true });
      },

      clearSession: () => {
        if (typeof window !== "undefined") {
          sessionStorage.removeItem(TOKEN_KEY);
        }
        set({ token: null, user: null, isAuthenticated: false });
      },

      updateUser: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        })),
    }),
    {
      name: "zika:web_auth",
      storage: createJSONStorage(() =>
        typeof window !== "undefined"
          ? sessionStorage
          : {
              getItem: () => null,
              setItem: () => undefined,
              removeItem: () => undefined,
            }
      ),
      partialize: (state) => ({
        token:           state.token,
        user:            state.user,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
        if (state?.token && typeof window !== "undefined") {
          sessionStorage.setItem(TOKEN_KEY, state.token);
        }
      },
    }
  )
);
