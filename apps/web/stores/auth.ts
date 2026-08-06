"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { clearAnonymousToken } from "@/lib/anonymous";

export interface AuthUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: string;
  userType: string;
  businessName?: string | null;
  country?: string | null;
  phone?: string | null;
  emailVerified: boolean;
  currentTier: string;
  loyaltyPoints: number;
  /** Set by the API when the user has never accepted the Terms/Privacy Policy,
   *  or accepted a superseded version. Gates entry to the app. */
  requiresTermsAcceptance?: boolean;
  termsAcceptedAt?: string | null;
  privacyAcceptedAt?: string | null;
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
        // A freshly minted anonymous token (if any) must not outlive a login —
        // otherwise after logout the interceptors would fall back to it and the
        // stale anon session would masquerade as the account.
        clearAnonymousToken();
        // Write to both localStorage (via persist) and sessionStorage (fast access by interceptors)
        if (typeof window !== "undefined") {
          sessionStorage.setItem(TOKEN_KEY, token);
        }
        set({ token, user, isAuthenticated: true });
      },

      clearSession: () => {
        if (typeof window !== "undefined") {
          sessionStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem("zika:web_auth");
        }
        // Clear any anonymous checkout session too, so a logged-out user never
        // accidentally keeps acting as a prior anonymous session.
        clearAnonymousToken();
        set({ token: null, user: null, isAuthenticated: false });
      },

      updateUser: (updates) =>
        set((state) => ({
          user: state.user ? { ...state.user, ...updates } : null,
        })),
    }),
    {
      name: "zika:web_auth",
      // Use localStorage so session survives tab close and hard refresh.
      // Previously this used sessionStorage which caused auto-logout on any
      // page refresh or new tab, even while the refresh token was still valid.
      storage: createJSONStorage(() =>
        typeof window !== "undefined"
          ? localStorage
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
        // Also write the persisted token into sessionStorage so axios interceptors
        // can read it synchronously before the store rehydration completes.
        if (state?.token && typeof window !== "undefined") {
          sessionStorage.setItem(TOKEN_KEY, state.token);
          if (!state.isAuthenticated) {
            useAuthStore.setState({ isAuthenticated: true });
          }
        }
      },
    }
  )
);
