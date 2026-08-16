"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { MapPin, Loader2, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  loadGoogleMaps,
  extractAddressParts,
  isGoogleMapsConfigured,
  type ResolvedPlace,
} from "@/lib/google-maps";

interface Suggestion {
  /** Google's stable id for the place — resolves to rooftop precision. */
  placeId: string;
  primary: string;
  secondary: string;
}

interface Props {
  /** Text shown in the field. Controlled by the parent so it can seed from saved data. */
  value: string;
  onChange: (value: string) => void;
  /** Fired once the chosen place has been resolved to coordinates. */
  onResolved: (place: ResolvedPlace) => void;
  label?: string;
  placeholder?: string;
  error?: string;
  /**
   * Optional point to rank nearby results higher. This is a *bias*, never a
   * filter: a search always reaches the whole world, so a provider listing a
   * property abroad still finds it.
   */
  biasLocation?: { lat: number; lng: number } | null;
  disabled?: boolean;
  className?: string;
}

const DEBOUNCE_MS = 250;
/** Google caps the bias circle at 50 km. */
const BIAS_RADIUS_M = 50_000;

/**
 * Search-as-you-type over Google Places.
 *
 * Matches business names, not just street addresses — "La Detente" finds the
 * hotel without the provider knowing its street. The chosen suggestion carries
 * a place id, which resolves to the building rather than to a geocoder's
 * interpretation of a text string.
 */
export function PlaceAutocomplete({
  value,
  onChange,
  onResolved,
  label,
  placeholder = "Search for your property by name or address",
  error,
  biasLocation,
  disabled,
  className,
}: Props) {
  const inputId = useId();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const wrapRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * Groups the keystrokes of one search plus the final details call into a
   * single billable session. Discarded after each resolution so the next
   * search starts a new one.
   */
  const sessionRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  /** Guards against an earlier, slower request overwriting a newer one. */
  const requestSeq = useRef(0);

  // Close the dropdown when focus moves elsewhere on the page.
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  const fetchSuggestions = useCallback(
    async (input: string) => {
      const seq = ++requestSeq.current;
      setLoading(true);
      try {
        const maps = await loadGoogleMaps();
        const places = (await maps.importLibrary(
          "places"
        )) as google.maps.PlacesLibrary;

        sessionRef.current ??= new places.AutocompleteSessionToken();

        const { suggestions: raw } =
          await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
            input,
            sessionToken: sessionRef.current,
            ...(biasLocation
              ? {
                  locationBias: {
                    center: { lat: biasLocation.lat, lng: biasLocation.lng },
                    radius: BIAS_RADIUS_M,
                  },
                }
              : {}),
          });

        if (seq !== requestSeq.current) return; // a newer keystroke won

        setFailed(false);
        setSuggestions(
          raw
            .map((s) => s.placePrediction)
            .filter((p): p is google.maps.places.PlacePrediction => !!p)
            .map((p) => ({
              placeId: p.placeId,
              primary: p.mainText?.text ?? p.text.text,
              secondary: p.secondaryText?.text ?? "",
            }))
        );
        setOpen(true);
      } catch {
        if (seq !== requestSeq.current) return;
        setFailed(true);
        setSuggestions([]);
      } finally {
        if (seq === requestSeq.current) setLoading(false);
      }
    },
    [biasLocation?.lat, biasLocation?.lng]
  );

  const handleChange = (next: string) => {
    onChange(next);
    setActiveIndex(-1);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (next.trim().length < 3) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    debounceRef.current = setTimeout(() => void fetchSuggestions(next), DEBOUNCE_MS);
  };

  const handleSelect = async (suggestion: Suggestion) => {
    setOpen(false);
    setSuggestions([]);
    setLoading(true);
    try {
      const maps = await loadGoogleMaps();
      const places = (await maps.importLibrary(
        "places"
      )) as google.maps.PlacesLibrary;

      const place = new places.Place({ id: suggestion.placeId });
      await place.fetchFields({
        fields: ["location", "formattedAddress", "addressComponents", "displayName"],
      });

      // Session is consumed by the details call; the next search starts fresh.
      sessionRef.current = null;

      const loc = place.location;
      if (!loc) {
        setFailed(true);
        return;
      }

      const address = place.formattedAddress ?? suggestion.primary;
      onChange(address);
      onResolved({
        lat: loc.lat(),
        lng: loc.lng(),
        address,
        ...extractAddressParts(
          place.addressComponents?.map((c) => ({
            longText: c.longText,
            shortText: c.shortText,
            types: c.types,
          }))
        ),
      });
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      void handleSelect(suggestions[activeIndex]!);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const configured = isGoogleMapsConfigured();

  return (
    <div ref={wrapRef} className={cn("relative", className)}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-medium text-slate-700 mb-1.5"
        >
          {label}
        </label>
      )}

      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
          <Search className="w-4 h-4" />
        </span>
        <input
          id={inputId}
          type="text"
          value={value}
          disabled={disabled || !configured}
          placeholder={configured ? placeholder : "Map search unavailable"}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          autoComplete="off"
          className={cn(
            "w-full rounded-xl border bg-white py-2.5 pl-9 pr-9 text-sm text-slate-900",
            "placeholder:text-slate-400 focus:outline-none focus:ring-2",
            error
              ? "border-red-300 focus:ring-red-200"
              : "border-slate-200 focus:border-[#4c6a48] focus:ring-[#4c6a48]/25",
            (disabled || !configured) && "bg-slate-50 text-slate-400"
          )}
        />
        {loading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin" />
          </span>
        )}
      </div>

      {open && suggestions.length > 0 && (
        <ul
          role="listbox"
          className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
        >
          {suggestions.map((s, i) => (
            <li key={s.placeId}>
              <button
                type="button"
                role="option"
                aria-selected={i === activeIndex}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => void handleSelect(s)}
                className={cn(
                  "flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors",
                  i === activeIndex ? "bg-slate-50" : "bg-white"
                )}
              >
                <MapPin className="mt-0.5 w-4 h-4 shrink-0 text-[#4c6a48]" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-slate-800">
                    {s.primary}
                  </span>
                  {s.secondary && (
                    <span className="block truncate text-xs text-slate-500">
                      {s.secondary}
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="mt-1 text-xs font-medium text-red-500">{error}</p>}
      {failed && !error && (
        <p className="mt-1 text-xs text-amber-600">
          Search is unavailable right now — you can still drop the pin manually.
        </p>
      )}
    </div>
  );
}
