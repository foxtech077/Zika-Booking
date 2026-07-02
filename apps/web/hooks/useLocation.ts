"use client";
import { useEffect, useState } from "react";
import { fetchLocation } from "@/services/traveller";

interface LocationState {
  lat: number | null;
  lng: number | null;
  city: string | null;
  countryCode: string | null;
  currency: string | null;
  loading: boolean;
}

const DEFAULT_STATE: LocationState = {
  lat: null,
  lng: null,
  city: null,
  countryCode: null,
  currency: null,
  loading: true,
};

/**
 * Detects the visitor's approximate location via GET /location (IP-based).
 * Returns nulls while loading or when detection fails/is unavailable (e.g. localhost) —
 * callers should fall back to a fixed default anchor in that case.
 */
export function useLocation(): LocationState {
  const [state, setState] = useState<LocationState>(DEFAULT_STATE);

  useEffect(() => {
    let cancelled = false;
    fetchLocation()
      .then((loc) => {
        if (cancelled) return;
        setState({
          lat: loc.isLocalhost ? null : loc.lat,
          lng: loc.isLocalhost ? null : loc.lng,
          city: loc.isLocalhost ? null : loc.city,
          countryCode: loc.isLocalhost ? null : loc.countryCode,
          currency: loc.isLocalhost ? null : loc.currency,
          loading: false,
        });
      })
      .catch(() => {
        if (!cancelled) setState((prev) => ({ ...prev, loading: false }));
      });
    return () => { cancelled = true; };
  }, []);

  return state;
}
