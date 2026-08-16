import Constants from "expo-constants";

/**
 * Google Places / Geocoding access for the app.
 *
 * The web build talks to the Maps JavaScript SDK; there is no such SDK in React
 * Native, so this module calls the same products over their HTTP APIs. The
 * shapes it returns deliberately match `apps/web/lib/google-maps.ts` so the two
 * location pickers behave identically and a listing located on either client is
 * described the same way.
 */

/**
 * Read from the same value that configures native map rendering, so there is
 * one key to rotate rather than two that can drift apart.
 */
export const GOOGLE_MAPS_API_KEY: string =
  (Constants.expoConfig?.extra as Record<string, string> | undefined)
    ?.["googleMapsApiKey"] ??
  (Constants.expoConfig?.android?.config?.googleMaps?.apiKey as string | undefined) ??
  "";

export const isGoogleMapsConfigured = () => GOOGLE_MAPS_API_KEY.length > 0;

/** Coordinates plus the address parts Google resolved alongside them. */
export interface ResolvedPlace {
  lat: number;
  lng: number;
  address: string;
  town: string;
  neighborhood: string;
  /** ISO-3166-1 alpha-2, matching what the listing API expects. */
  country: string;
}

export interface PlaceSuggestion {
  placeId: string;
  primary: string;
  secondary: string;
}

interface AddressComponent {
  longText?: string | null;
  shortText?: string | null;
  types: string[];
}

/**
 * Maps Google's address components onto the listing model's fields, in the same
 * priority order the backend's `parseGeoResult` uses.
 */
export function extractAddressParts(
  components: AddressComponent[] | null | undefined
): Pick<ResolvedPlace, "town" | "neighborhood" | "country"> {
  const list = components ?? [];
  const pick = (...types: string[]) =>
    list.find((c) => types.some((t) => c.types.includes(t)));

  return {
    town:
      pick("locality")?.longText ??
      pick("administrative_area_level_2")?.longText ??
      "",
    neighborhood:
      pick("neighborhood")?.longText ?? pick("sublocality")?.longText ?? "",
    country: pick("country")?.shortText ?? "",
  };
}

const PLACES_BASE = "https://places.googleapis.com/v1";
const GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json";

/**
 * Search-as-you-type over Google Places.
 *
 * `sessionToken` groups the keystrokes of one search plus the follow-up details
 * call into a single billable session; pass the same token throughout a search
 * and discard it once a place has been chosen.
 */
export async function fetchPlaceSuggestions(
  input: string,
  opts: { sessionToken: string; countryHint?: string; signal?: AbortSignal }
): Promise<PlaceSuggestion[]> {
  if (!isGoogleMapsConfigured()) throw new Error("Google Maps key is not configured");

  const res = await fetch(`${PLACES_BASE}/places:autocomplete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
    },
    body: JSON.stringify({
      input,
      sessionToken: opts.sessionToken,
      ...(opts.countryHint
        ? { includedRegionCodes: [opts.countryHint.toLowerCase()] }
        : {}),
    }),
    ...(opts.signal ? { signal: opts.signal } : {}),
  });

  if (!res.ok) throw new Error(`Places autocomplete failed (${res.status})`);

  const json = (await res.json()) as {
    suggestions?: {
      placePrediction?: {
        placeId: string;
        text?: { text: string };
        structuredFormat?: {
          mainText?: { text: string };
          secondaryText?: { text: string };
        };
      };
    }[];
  };

  return (json.suggestions ?? [])
    .map((s) => s.placePrediction)
    .filter((p): p is NonNullable<typeof p> => !!p)
    .map((p) => ({
      placeId: p.placeId,
      primary: p.structuredFormat?.mainText?.text ?? p.text?.text ?? "",
      secondary: p.structuredFormat?.secondaryText?.text ?? "",
    }));
}

/**
 * Resolves a place id to coordinates. Unlike geocoding a string, this is a
 * lookup against a place Google has already located, so it lands on the
 * building rather than on an interpretation of the address text.
 */
export async function fetchPlaceDetails(
  placeId: string,
  opts?: { sessionToken?: string }
): Promise<ResolvedPlace | null> {
  if (!isGoogleMapsConfigured()) return null;

  const url = new URL(`${PLACES_BASE}/places/${encodeURIComponent(placeId)}`);
  if (opts?.sessionToken) url.searchParams.set("sessionToken", opts.sessionToken);

  const res = await fetch(url.toString(), {
    headers: {
      "X-Goog-Api-Key": GOOGLE_MAPS_API_KEY,
      "X-Goog-FieldMask": "location,formattedAddress,addressComponents,displayName",
    },
  });
  if (!res.ok) return null;

  const json = (await res.json()) as {
    location?: { latitude: number; longitude: number };
    formattedAddress?: string;
    displayName?: { text?: string };
    addressComponents?: AddressComponent[];
  };

  if (!json.location) return null;

  return {
    lat: json.location.latitude,
    lng: json.location.longitude,
    address: json.formattedAddress ?? json.displayName?.text ?? "",
    ...extractAddressParts(json.addressComponents),
  };
}

/**
 * Reverse-geocodes a dragged pin so the address fields follow the marker.
 * Returns null rather than throwing — a failed lookup must leave the
 * coordinates intact and simply not refresh the text.
 */
export async function reverseGeocode(
  lat: number,
  lng: number
): Promise<ResolvedPlace | null> {
  if (!isGoogleMapsConfigured()) return null;

  try {
    const url = new URL(GEOCODE_URL);
    url.searchParams.set("latlng", `${lat},${lng}`);
    url.searchParams.set("key", GOOGLE_MAPS_API_KEY);

    const res = await fetch(url.toString());
    if (!res.ok) return null;

    const json = (await res.json()) as {
      status: string;
      results?: {
        formatted_address: string;
        address_components: {
          long_name: string;
          short_name: string;
          types: string[];
        }[];
      }[];
    };

    const first = json.results?.[0];
    if (json.status !== "OK" || !first) return null;

    return {
      lat,
      lng,
      address: first.formatted_address,
      ...extractAddressParts(
        first.address_components.map((c) => ({
          longText: c.long_name,
          shortText: c.short_name,
          types: c.types,
        }))
      ),
    };
  } catch {
    return null;
  }
}

/**
 * Session tokens must be unique per search. `crypto.randomUUID` is not reliably
 * present in the Hermes runtime, so build one from time plus randomness — the
 * value only needs to be distinct, not cryptographically strong.
 */
export function newSessionToken(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}
