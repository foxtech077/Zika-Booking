"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

// Display-currency preference for browsing/listing prices. Deliberately kept
// separate from stores/auth.ts: guests need this before (and without) ever
// signing in, and it must survive clearSession() on logout.
//
// EUR is the fixed default. There used to be a timezone-derived auto-suggestion
// (lib/local-currency.ts, removed) that silently replaced it with the
// visitor's detected country currency — pulled at the user's request so EUR
// stays the default for everyone until they explicitly pick something else
// from the header dropdown.
interface CurrencyState {
  currency: string;
  setCurrency: (code: string) => void;
}

export const useCurrencyStore = create<CurrencyState>()(
  persist(
    (set) => ({
      currency: "EUR",
      setCurrency: (code) => set({ currency: code.toUpperCase() }),
    }),
    {
      name: "zika:currency",
      version: 3,
      // v2 tracked an `explicit` flag to protect a manual pick from the
      // now-removed auto-suggestion. Keep a currency that was actually chosen
      // by hand; a value that only ever came from auto-detection resets to
      // the new fixed default.
      migrate: (persisted: unknown) => {
        const prev = (persisted ?? {}) as { currency?: string; explicit?: boolean };
        return { currency: prev.explicit ? prev.currency ?? "EUR" : "EUR" } as CurrencyState;
      },
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
