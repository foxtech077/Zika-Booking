"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

// Display-currency preference for browsing/listing prices. Deliberately kept
// separate from stores/auth.ts: guests need this before (and without) ever
// signing in, and it must survive clearSession() on logout.
//
// Two write paths with different authority:
//  - setCurrency: the header dropdown. An explicit pick that detection must
//    never override.
//  - suggestCurrency: the timezone-derived default (lib/local-currency.ts).
//    Applied only while the visitor has never picked a currency themselves.
interface CurrencyState {
  currency: string;
  /** True once the visitor has picked a currency by hand. */
  explicit: boolean;
  setCurrency: (code: string) => void;
  suggestCurrency: (code: string) => void;
}

export const useCurrencyStore = create<CurrencyState>()(
  persist(
    (set, get) => ({
      // Pre-hydration placeholder only: on mount the dropdown immediately
      // suggests the timezone-detected currency (EUR when undetectable), so
      // this value is never what a visitor actually browses with.
      currency: "EUR",
      explicit: false,
      setCurrency: (code) => set({ currency: code.toUpperCase(), explicit: true }),
      suggestCurrency: (code) => {
        if (get().explicit) return;
        const next = code.toUpperCase();
        if (next.length === 3 && next !== get().currency) set({ currency: next });
      },
    }),
    {
      name: "zika:currency",
      version: 2,
      // Older persisted shapes predate the `explicit` flag, and a stored value
      // from that era is indistinguishable from a never-touched default — so
      // all of them re-enter detection. One re-default for anyone who chose a
      // currency before this shipped; everyone picking from now on is
      // remembered permanently.
      migrate: (persisted: unknown) => {
        const prev = (persisted ?? {}) as Partial<CurrencyState>;
        return {
          currency: prev.currency ?? "EUR",
          explicit: false,
        } as CurrencyState;
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
