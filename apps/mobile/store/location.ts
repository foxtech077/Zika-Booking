import { create } from "zustand";
import * as SecureStore from "expo-secure-store";

const LOCATION_CACHE_KEY = "kainook_location_v1";
const CACHE_TTL_MS = 24 * 60 * 60 * 1_000; // 24 hours

export interface DetectedLocation {
  country: string;
  countryCode: string;
  city: string;
  state: string;
  lat: number;
  lng: number;
  currency: string;
  timezone: string;
  fetchedAt: number;
}

interface LocationState {
  location: DetectedLocation | null;
  isHydrated: boolean;
  setLocation: (loc: Omit<DetectedLocation, "fetchedAt">) => Promise<void>;
  hydrate: () => Promise<void>;
}

export const useLocationStore = create<LocationState>((set) => ({
  location: null,
  isHydrated: false,

  setLocation: async (loc) => {
    const data: DetectedLocation = { ...loc, fetchedAt: Date.now() };
    try {
      await SecureStore.setItemAsync(LOCATION_CACHE_KEY, JSON.stringify(data));
    } catch { /* ignore */ }
    set({ location: data });
  },

  hydrate: async () => {
    try {
      const raw = await SecureStore.getItemAsync(LOCATION_CACHE_KEY);
      if (raw) {
        const loc = JSON.parse(raw) as DetectedLocation;
        set({ location: loc });
      }
    } catch { /* ignore */ }
    finally {
      set({ isHydrated: true });
    }
  },
}));

export function isLocationExpired(location: DetectedLocation | null): boolean {
  if (!location) return true;
  return Date.now() - location.fetchedAt > CACHE_TTL_MS;
}
