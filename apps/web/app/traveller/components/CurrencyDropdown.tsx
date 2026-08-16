"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCurrencyStore } from "@/stores/currency";
import { ALL_CURRENCIES } from "@/lib/currency";
import { detectLocalCurrency } from "@/lib/local-currency";

// Lets a guest or signed-in traveller override the currency listing prices
// are shown in. Selecting a currency updates stores/currency.ts, which
// lib/listing-api.ts's request interceptor then attaches as `?currency=` to
// every search / listing-detail call.
export function CurrencyDropdown() {
  const currency = useCurrencyStore((s) => s.currency);
  const setCurrency = useCurrencyStore((s) => s.setCurrency);
  const explicit = useCurrencyStore((s) => s.explicit);
  const suggestCurrency = useCurrencyStore((s) => s.suggestCurrency);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  // Default the display currency from the browser's timezone country
  // (Asia/Kolkata → INR) until the visitor picks one by hand; EUR when the
  // country cannot be determined. suggestCurrency is a no-op once `explicit`
  // is set, so a manual pick is never overridden.
  useEffect(() => {
    if (!explicit) suggestCurrency(detectLocalCurrency());
  }, [explicit, suggestCurrency]);

  useEffect(() => {
    if (!open) return;
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [open]);

  const filtered = search.trim()
    ? ALL_CURRENCIES.filter((c) => c.code.toLowerCase().includes(search.trim().toLowerCase()))
    : ALL_CURRENCIES;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          "flex h-9 items-center gap-1.5 rounded-xl border px-3 text-sm font-semibold transition-all",
          open
            ? "border-[#0c2614] bg-[#0c2614] text-white"
            : "border-slate-200 bg-white text-slate-600 hover:border-[#1D8D2B] hover:text-[#0c2614]",
        )}
      >
        {currency}
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-56 animate-slide-in-up rounded-2xl border border-slate-100 bg-white py-1.5 shadow-[0_8px_30px_rgba(0,0,0,0.1)]">
          <div className="px-3 pb-2">
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search currency…"
              className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-[#1D8D2B]"
            />
          </div>
          <div className="max-h-72 overflow-y-auto">
            {filtered.map((c) => (
              <button
                key={c.code}
                type="button"
                onClick={() => {
                  setCurrency(c.code);
                  setOpen(false);
                  setSearch("");
                }}
                className={cn(
                  "flex w-full items-center gap-2.5 px-4 py-2 text-sm transition-all",
                  c.code === currency ? "bg-slate-50 text-slate-900" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                )}
              >
                <span className="w-8 text-slate-400">{c.symbol}</span>
                <span className="flex-1 text-left">{c.code}</span>
                {c.code === currency && <Check className="h-4 w-4 text-green-600" />}
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="px-4 py-3 text-sm text-slate-400">No currencies found</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
