"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

// Display-currency preference for browsing/listing prices. Deliberately kept
// separate from stores/auth.ts: guests need this before (and without) ever
// signing in, and it must survive clearSession() on logout.
interface CurrencyState {
  currency: string;
  setCurrency: (code: string) => void;
}

export const useCurrencyStore = create<CurrencyState>()(
  persist(
    (set) => ({
      currency: "USD",
      setCurrency: (code) => set({ currency: code.toUpperCase() }),
    }),
    {
      name: "zika:currency",
      storage: createJSONStorage(() =>
        typeof window !== "undefined"
          ? localStorage
          : {
              getItem: () => null,
              setItem: () => undefined,
              removeItem: () => undefined,
            }
      ),
    }
  )
);
