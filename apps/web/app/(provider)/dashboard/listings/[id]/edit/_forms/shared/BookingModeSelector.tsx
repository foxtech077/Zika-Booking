"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type Props = {
  listingId?: string | null;
  value?: string;
  onChange?: (value: string) => void;
};

const NEW_KEY = "zika:listing-new-booking-mode";

export default function BookingModeSelector({ listingId, value, onChange }: Props) {
  const key = listingId ? `zika:listing-booking-mode:${listingId}` : NEW_KEY;
  const [mode, setMode] = useState<string>(value ?? "instant");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        setMode(stored);
        onChange?.(stored);
        return;
      }

      // If this is an edit page (has listingId) but no per-listing key, migrate from new listing key
      if (listingId) {
        const newVal = localStorage.getItem(NEW_KEY);
        if (newVal) {
          localStorage.setItem(key, newVal);
          localStorage.removeItem(NEW_KEY);
          setMode(newVal);
          onChange?.(newVal);
          return;
        }
      }

      // otherwise use provided default
      localStorage.setItem(key, mode);
    } catch (e) {
      // ignore storage errors
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, listingId]);

  const setAndPersist = (next: string) => {
    setMode(next);
    try { localStorage.setItem(key, next); } catch { /* noop */ }
    onChange?.(next);
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-semibold text-slate-700">Booking Mode</label>
      <div className="grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setAndPersist("instant")}
          className={cn(
            "text-left p-3 rounded-2xl border transition",
            mode === "instant" ? "border-primary bg-primary-50" : "border-border bg-white hover:bg-slate-50"
          )}
        >
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">Instant Confirm</p>
                  <p className="mt-1 text-xs text-slate-500">Guests can book immediately without provider approval.</p>
                </div>
                <div className="text-sm font-medium text-slate-700">{mode === "instant" ? "Selected" : ""}</div>
              </div>
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setAndPersist("request")}
          className={cn(
            "text-left p-3 rounded-2xl border transition",
            mode === "request" ? "border-primary bg-primary-50" : "border-border bg-white hover:bg-slate-50"
          )}
        >
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">Request to Book</p>
                  <p className="mt-1 text-xs text-slate-500">Guests must send a booking request that requires provider approval.</p>
                </div>
                <div className="text-sm font-medium text-slate-700">{mode === "request" ? "Selected" : ""}</div>
              </div>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}
