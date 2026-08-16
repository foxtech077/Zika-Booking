"use client";

import { getCountryForTimezone } from "countries-and-timezones";

/**
 * Search-origin resolution for listing searches.
 *
 * Every search needs a coordinate pair to rank "nearest" against. Priority:
 *
 *  1. The browser's geolocation — asked once, cached, denial remembered.
 *  2. The IANA timezone's own city ("Asia/Kolkata" → Kolkata), geocoded once
 *     and cached. Needs no permission and lands on the right continent, which
 *     is the whole game: sorting Indian results from Nairobi — or worse, from
 *     a mis-geocoded business in California — made distance meaningless.
 *  3. Nairobi, the platform's historical default, as the last resort.
 */

const GEO_KEY = "zika:geo";
const GEO_DENIED_KEY = "zika:geo-denied";
const TZ_ORIGIN_KEY = "zika:tz-origin";
const COORDS_TTL_MS = 30 * 60 * 1000;

export interface Origin {
  lat: number;
  lng: number;
}

const NAIROBI: Origin = { lat: -1.2921, lng: 36.8219 };

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage blocked — feature degrades, nothing breaks */
  }
}

// ── 1. Browser geolocation ──────────────────────────────────────────────────

type CachedFix = Origin & { ts: number };

export function getCachedUserLocation(): Origin | null {
  const fix = readJson<CachedFix>(GEO_KEY);
  return fix && typeof fix.lat === "number" && typeof fix.lng === "number"
    ? { lat: fix.lat, lng: fix.lng }
    : null;
}

let geoInFlight: Promise<Origin | null> | null = null;

/**
 * One browser prompt, ever: a grant is cached (refreshed when stale), a denial
 * is persisted so the visitor is never asked again.
 */
export function requestUserLocation(): Promise<Origin | null> {
  if (typeof window === "undefined" || !("geolocation" in navigator)) {
    return Promise.resolve(null);
  }
  if (localStorage.getItem(GEO_DENIED_KEY)) {
    return Promise.resolve(null);
  }

  const fix = readJson<CachedFix>(GEO_KEY);
  if (fix && Date.now() - fix.ts < COORDS_TTL_MS) {
    return Promise.resolve({ lat: fix.lat, lng: fix.lng });
  }

  geoInFlight ??= new Promise<Origin | null>((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next: CachedFix = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          ts: Date.now(),
        };
        writeJson(GEO_KEY, next);
        geoInFlight = null;
        resolve({ lat: next.lat, lng: next.lng });
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          try {
            localStorage.setItem(GEO_DENIED_KEY, "1");
          } catch { /* ignore */ }
        }
        geoInFlight = null;
        // A stale fix still beats a wrong continent.
        resolve(fix ? { lat: fix.lat, lng: fix.lng } : null);
      },
      { enableHighAccuracy: false, timeout: 8_000, maximumAge: COORDS_TTL_MS }
    );
  });
  return geoInFlight;
}

// ── 2. Timezone-city fallback ───────────────────────────────────────────────

let tzInFlight: Promise<Origin | null> | null = null;

/**
 * "Asia/Kolkata" names an actual city; geocoding it once puts the origin on
 * the visitor's continent with no permission prompt at all. Cached for good —
 * a machine's timezone city effectively never moves.
 */
function timezoneCityOrigin(): Promise<Origin | null> {
  const cached = readJson<Origin>(TZ_ORIGIN_KEY);
  if (cached) return Promise.resolve(cached);

  tzInFlight ??= (async () => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (!tz || !tz.includes("/")) return null;
      const city = tz.split("/").pop()!.replace(/_/g, " ");
      const country = getCountryForTimezone(tz)?.name ?? "";

      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
          country ? `${city}, ${country}` : city
        )}&format=json&limit=1`,
        { headers: { "Accept-Language": "en", "User-Agent": "Kainook/1.0" } }
      );
      if (!res.ok) return null;
      const data = (await res.json()) as { lat: string; lon: string }[];
      const first = data?.[0];
      if (!first) return null;

      const origin: Origin = { lat: parseFloat(first.lat), lng: parseFloat(first.lon) };
      writeJson(TZ_ORIGIN_KEY, origin);
      return origin;
    } catch {
      return null;
    } finally {
      tzInFlight = null;
    }
  })();
  return tzInFlight;
}

// ── The chain ───────────────────────────────────────────────────────────────

/** Best available origin: browser location → timezone city → Nairobi. */
export async function getSearchOrigin(): Promise<Origin> {
  return (
    (await requestUserLocation()) ??
    (await timezoneCityOrigin()) ??
    NAIROBI
  );
}

/** Synchronous flavour for code paths that cannot await. */
export function getCachedSearchOrigin(): Origin {
  return getCachedUserLocation() ?? readJson<Origin>(TZ_ORIGIN_KEY) ?? NAIROBI;
}

// ── Destination geocoding, place-shaped results only ────────────────────────

/**
 * Nominatim classes that describe an actual *place* a traveller can search
 * around — cities, towns, suburbs, administrative areas. Everything else
 * (shop, office, amenity, building…) is some business that happens to share
 * the typed name, which is exactly how a query for the hotel "abacus" got
 * anchored to an office in California.
 */
const PLACE_CLASSES = new Set(["place", "boundary"]);

export interface ResolvedDestination extends Origin {
  displayName: string;
}

/**
 * Geocode a typed destination, accepting only place-shaped matches. Returns
 * null for business names and junk terms so the caller can fall back to a pure
 * text search instead of anchoring the results to a wrong continent.
 */
export async function geocodePlaceText(query: string): Promise<ResolvedDestination | null> {
  const q = query.trim();
  if (!q) return null;
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=3&addressdetails=0`,
      { headers: { "Accept-Language": "en", "User-Agent": "Kainook/1.0" } }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      lat: string;
      lon: string;
      class?: string;
      display_name?: string;
    }[];
    const place = data.find((r) => PLACE_CLASSES.has(r.class ?? ""));
    if (!place) return null;
    return {
      lat: parseFloat(place.lat),
      lng: parseFloat(place.lon),
      displayName: place.display_name ?? q,
    };
  } catch {
    return null;
  }
}
