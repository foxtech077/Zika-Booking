const GOOGLE_MAPS_API_KEY = process.env["GOOGLE_MAPS_API_KEY"] ?? "";
const GOOGLE_CONFIGURED = GOOGLE_MAPS_API_KEY && GOOGLE_MAPS_API_KEY !== "placeholder";

export interface GeocodingResult {
  lat: number;
  lng: number;
  formattedAddress: string;
  town: string;
  country: string;
}

// ── Nominatim (OpenStreetMap) — free, no API key ──────────────────────────────

interface NominatimResult {
  lat: string;
  lon: string;
  display_name: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    county?: string;
    state?: string;
    country_code?: string;
    country?: string;
  };
}

async function geocodeViaNominatim(query: string): Promise<GeocodingResult | null> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");
  url.searchParams.set("addressdetails", "1");

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": "Kainook/1.0 (dev)" },
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) return null;

  const json = await res.json() as NominatimResult[];
  const r = json[0];
  if (!r) return null;

  const addr = r.address ?? {};
  const town = addr.city ?? addr.town ?? addr.village ?? addr.county ?? addr.state ?? "";
  const country = (addr.country_code ?? "").toUpperCase();

  return {
    lat: parseFloat(r.lat),
    lng: parseFloat(r.lon),
    formattedAddress: r.display_name,
    town,
    country,
  };
}

// ── Google Place ID geocoding ──────────────────────────────────────────────────

export async function geocodePlaceId(placeId: string): Promise<GeocodingResult | null> {
  if (GOOGLE_CONFIGURED) {
    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    url.searchParams.set("place_id", placeId);
    url.searchParams.set("key", GOOGLE_MAPS_API_KEY);

    const res = await fetch(url.toString());
    if (res.ok) {
      const json = await res.json() as { status: string; results: GoogleGeoResult[] };
      if (json.status === "OK" && json.results[0]) return parseGeoResult(json.results[0]);
    }
  }
  // Fallback: treat as a free-text query
  return geocodeViaNominatim(placeId);
}

// ── Free-text address geocoding ───────────────────────────────────────────────

export async function geocodeAddress(address: string): Promise<GeocodingResult | null> {
  if (GOOGLE_CONFIGURED) {
    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    url.searchParams.set("address", address);
    url.searchParams.set("key", GOOGLE_MAPS_API_KEY);

    const res = await fetch(url.toString());
    if (res.ok) {
      const json = await res.json() as { status: string; results: GoogleGeoResult[] };
      if (json.status === "OK" && json.results[0]) return parseGeoResult(json.results[0]);
    }
  }
  return geocodeViaNominatim(address);
}

export async function reverseGeocode(lat: number, lng: number): Promise<Partial<GeocodingResult>> {
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("latlng", `${lat},${lng}`);
  url.searchParams.set("key", GOOGLE_MAPS_API_KEY);

  const res = await fetch(url.toString());
  if (!res.ok) return {};

  const json = await res.json() as { status: string; results: GoogleGeoResult[] };
  if (json.status !== "OK" || !json.results[0]) return {};

  return parseGeoResult(json.results[0]);
}

interface GoogleGeoResult {
  formatted_address: string;
  geometry: { location: { lat: number; lng: number } };
  address_components: { long_name: string; short_name: string; types: string[] }[];
}

function parseGeoResult(result: GoogleGeoResult): GeocodingResult {
  const components = result.address_components;
  const town =
    components.find((c) => c.types.includes("locality"))?.long_name ??
    components.find((c) => c.types.includes("administrative_area_level_2"))?.long_name ??
    "";
  const country =
    components.find((c) => c.types.includes("country"))?.short_name ?? "";

  return {
    lat: result.geometry.location.lat,
    lng: result.geometry.location.lng,
    formattedAddress: result.formatted_address,
    town,
    country,
  };
}
