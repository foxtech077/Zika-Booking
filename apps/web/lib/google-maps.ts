/**
 * Single loader for the Google Maps JavaScript API.
 *
 * The API can only be bootstrapped once per page — a second <script> tag makes
 * Google log "You have included the Google Maps JavaScript API multiple times"
 * and can leave `google.maps` in a half-initialised state. Every map, marker
 * and Places call in the app therefore goes through `loadGoogleMaps()`, which
 * memoises one in-flight promise and hands the same resolved namespace to all
 * callers.
 */

export const GOOGLE_MAPS_API_KEY =
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

/** True when a key is configured. Callers should degrade, not crash, when false. */
export const isGoogleMapsConfigured = () => GOOGLE_MAPS_API_KEY.length > 0;

const CALLBACK_NAME = "__kainookGoogleMapsReady";
const SCRIPT_ID = "kainook-google-maps";

let loaderPromise: Promise<typeof google.maps> | null = null;

export function loadGoogleMaps(): Promise<typeof google.maps> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps can only load in the browser"));
  }
  if (window.google?.maps) return Promise.resolve(window.google.maps);
  if (loaderPromise) return loaderPromise;

  if (!isGoogleMapsConfigured()) {
    return Promise.reject(
      new Error("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not set")
    );
  }

  loaderPromise = new Promise<typeof google.maps>((resolve, reject) => {
    (window as unknown as Record<string, unknown>)[CALLBACK_NAME] = () => {
      resolve(window.google.maps);
    };

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.async = true;
    // `places` powers autocomplete; `marker` is requested so callers that later
    // move to AdvancedMarkerElement do not need a second bootstrap.
    script.src =
      `https://maps.googleapis.com/maps/api/js` +
      `?key=${encodeURIComponent(GOOGLE_MAPS_API_KEY)}` +
      `&libraries=places,marker` +
      `&loading=async` +
      `&callback=${CALLBACK_NAME}`;
    script.onerror = () => {
      // Allow a later retry rather than caching the failure forever.
      loaderPromise = null;
      reject(new Error("Failed to load the Google Maps script"));
    };
    document.head.appendChild(script);
  });

  return loaderPromise;
}

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

type AddressComponent = {
  longText?: string | null;
  shortText?: string | null;
  types: string[];
};

/**
 * Maps Google's address components onto the listing model's fields. Mirrors the
 * priority order the backend uses in `parseGeoResult`, so a listing geocoded on
 * the client and one geocoded on the server describe the same place the same way.
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

/**
 * Reverse-geocodes a dragged pin so the address fields follow the marker.
 * Returns null rather than throwing — a failed lookup should leave the
 * coordinates intact and simply not refresh the text fields.
 */
export async function reverseGeocode(
  lat: number,
  lng: number
): Promise<ResolvedPlace | null> {
  try {
    const maps = await loadGoogleMaps();
    const geocoder = new maps.Geocoder();
    const { results } = await geocoder.geocode({ location: { lat, lng } });
    const first = results[0];
    if (!first) return null;

    const components: AddressComponent[] = first.address_components.map((c) => ({
      longText: c.long_name,
      shortText: c.short_name,
      types: c.types,
    }));

    return {
      lat,
      lng,
      address: first.formatted_address,
      ...extractAddressParts(components),
    };
  } catch {
    return null;
  }
}
