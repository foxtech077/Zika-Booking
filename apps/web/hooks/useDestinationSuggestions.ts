"use client";
import { useEffect, useRef, useState } from "react";

export interface DestinationSuggestion {
  displayName: string;
  lat: number;
  lng: number;
  /** ISO-3166-1 alpha-2, uppercased — matches the 2-letter code the backend
   *  stores on Listing.country (services/listing-service prisma schema). */
  countryCode: string | null;
  city: string | null;
}

interface UseDestinationSuggestionsResult {
  suggestions: DestinationSuggestion[];
  loading: boolean;
  /** true once the current query has actually resolved — lets callers tell
   *  "haven't searched yet" apart from "searched and found nothing". */
  searched: boolean;
}

// Nominatim's own `addresstype`/`class` classify each match — only surface results
// that are actual places (city/town/state/country/...), not roads, shops, or other
// POIs, so a garbage string doesn't surface irrelevant loosely-matched noise.
const PLACE_TYPES = new Set([
  "city", "town", "village", "hamlet", "state", "country", "county",
  "suburb", "island", "region", "municipality", "administrative",
]);

function isPlaceResult(r: any): boolean {
  return PLACE_TYPES.has(r?.addresstype) || r?.class === "place" || (r?.class === "boundary" && r?.type === "administrative");
}

/**
 * Debounced, race-safe destination autocomplete backed by Nominatim (the only
 * text→coordinates geocoder available — the backend's /search endpoint takes
 * lat/lng only and has no destination-lookup API of its own).
 *
 * Guards against the two things that make garbage input "still show results":
 *   - stale suggestions from a previous query lingering on screen while a new
 *     query is in flight (cleared immediately here)
 *   - out-of-order responses (a slow earlier request resolving after a newer
 *     one) overwriting fresher results (discarded via a sequence token)
 */
export function useDestinationSuggestions(query: string, minLength = 2, debounceMs = 350): UseDestinationSuggestionsResult {
  const [suggestions, setSuggestions] = useState<DestinationSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const seq = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const trimmed = query.trim();

    // Invalidate any in-flight/pending request and reset to empty state.
    seq.current += 1;
    setSuggestions([]);
    setSearched(false);

    if (trimmed.length < minLength) {
      setLoading(false);
      return;
    }

    setLoading(true);
    const mySeq = seq.current;
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(trimmed)}&format=json&limit=8&addressdetails=1`,
          { headers: { "Accept-Language": "en", "User-Agent": "Kainook/1.0" } },
        );
        const data = await res.json();
        if (mySeq !== seq.current) return; // superseded by a newer query — discard
        const results: DestinationSuggestion[] = Array.isArray(data)
          ? data
              .filter(isPlaceResult)
              .slice(0, 5)
              .map((r: any) => ({
                displayName: r.display_name as string,
                lat: parseFloat(r.lat),
                lng: parseFloat(r.lon),
                countryCode: r.address?.country_code ? String(r.address.country_code).toUpperCase() : null,
                city: r.address?.city ?? r.address?.town ?? r.address?.village ?? null,
              }))
          : [];
        setSuggestions(results);
      } catch {
        if (mySeq === seq.current) setSuggestions([]);
      } finally {
        if (mySeq === seq.current) { setLoading(false); setSearched(true); }
      }
    }, debounceMs);

    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [query, minLength, debounceMs]);

  return { suggestions, loading, searched };
}
