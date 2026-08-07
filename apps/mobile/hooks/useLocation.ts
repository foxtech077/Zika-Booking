import { useEffect, useRef } from "react";
import { useLocationStore, isLocationExpired } from "../store/location";
import { listingApi } from "../lib/listing-api";

// Module-level singleton: prevents parallel fetches across hook instances
let pending: Promise<void> | null = null;

async function fetchAndStoreLocation(): Promise<void> {
  if (pending) return pending;

  const { setLocation } = useLocationStore.getState();

  pending = (async () => {
    try {
      const res = await listingApi.get<{ data: Record<string, any> }>("/location", { timeout: 8_000 });
      const d = res.data?.data;
      if (!d) return;

      // Normalise lat/lng — API may use lat/lng or latitude/longitude
      const lat = d.lat ?? d.latitude ?? null;
      const lng = d.lng ?? d.longitude ?? null;
      if (lat == null || lng == null) return;

      await setLocation({
        country:     String(d.country     ?? ""),
        countryCode: String(d.countryCode ?? d.country_code ?? ""),
        city:        String(d.city        ?? ""),
        state:       String(d.state       ?? d.region ?? ""),
        lat:         Number(lat),
        lng:         Number(lng),
        currency:    String(d.currency    ?? "USD"),
        timezone:    String(d.timezone    ?? ""),
      });
    } catch {
      // Gracefully fail — cached or default values remain in effect
    } finally {
      pending = null;
    }
  })();

  return pending;
}

/**
 * Call once in the root layout to hydrate the cache and start a background
 * fetch if the cached location is expired or missing.
 */
export function useLocationBootstrap(): void {
  const hydrate = useLocationStore((s) => s.hydrate);
  const isHydrated = useLocationStore((s) => s.isHydrated);
  const hasRun = useRef(false);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    const run = async () => {
      if (!isHydrated) await hydrate();
      const loc = useLocationStore.getState().location;
      if (isLocationExpired(loc)) void fetchAndStoreLocation();
    };
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/**
 * Subscribe to the detected location.
 * Safe to call from any screen — only fetches when cache is expired.
 */
export function useLocation() {
  const { location, isHydrated, hydrate } = useLocationStore();

  useEffect(() => {
    if (!isHydrated) {
      void hydrate().then(() => {
        const loc = useLocationStore.getState().location;
        if (isLocationExpired(loc)) void fetchAndStoreLocation();
      });
    } else if (isLocationExpired(location)) {
      void fetchAndStoreLocation();
    }
    // Only re-run when hydration state changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHydrated]);

  return {
    location,
    lat:         location?.lat         ?? null,
    lng:         location?.lng         ?? null,
    city:        location?.city        ?? null,
    country:     location?.country     ?? null,
    countryCode: location?.countryCode ?? null,
    currency:    location?.currency    ?? null,
    timezone:    location?.timezone    ?? null,
    refresh: () => {
      void fetchAndStoreLocation();
    },
  };
}
