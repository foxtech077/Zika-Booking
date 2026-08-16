"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Crosshair, MapPin, Loader2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { GoogleMap, type MapMarker } from "./GoogleMap";
import { PlaceAutocomplete } from "./PlaceAutocomplete";
import { reverseGeocode, type ResolvedPlace } from "@/lib/google-maps";

export interface PickedLocation {
  lat: number;
  lng: number;
  address: string;
  town: string;
  neighborhood: string;
  country: string;
}

interface Props {
  /** Current pin, or null when the listing has never been located. */
  value: { lat: number | null; lng: number | null; address: string };
  onChange: (next: PickedLocation) => void;
  /** Called when only the pin moved, leaving the typed address alone. */
  onCoordinatesChange?: (lat: number, lng: number) => void;
  /**
   * Fallback country for a GPS fix that reverse-geocoding could not resolve.
   * Deliberately NOT used to filter search: results stay worldwide.
   */
  countryHint?: string;
  label?: string;
  error?: string;
  className?: string;
}

const PIN_ID = "listing-pin";

/**
 * Search for a property, then fine-tune its pin.
 *
 * Search alone is not enough: a geocoder returns its best interpretation of a
 * string with no way to signal doubt, which is how a Douala hotel ended up
 * pinned 6.5 km from its front door. Showing the pin and letting the provider
 * drag it turns a silent error into an obvious one.
 */
export function LocationPicker({
  value,
  onChange,
  onCoordinatesChange,
  countryHint,
  label = "Find your property",
  error,
  className,
}: Props) {
  const [search, setSearch] = useState(value.address ?? "");
  const [locating, setLocating] = useState(false);
  const [gpsError, setGpsError] = useState("");
  const [justMoved, setJustMoved] = useState(false);

  const hasPin = value.lat != null && value.lng != null;

  const emittedRef = useRef(value.address ?? "");

  useEffect(() => {
    const incoming = value.address ?? "";
    if (incoming !== emittedRef.current) {
      emittedRef.current = incoming;
      setSearch(incoming);
    }
  }, [value.address]);

  /** Adopt a fully resolved place — from search, or from reverse geocoding. */
  const adopt = useCallback(
    (place: ResolvedPlace) => {
      setGpsError("");
      emittedRef.current = place.address;
      setSearch(place.address);
      onChange(place);
    },
    [onChange]
  );

  /**
   * A drag is a deliberate correction, so the coordinates are authoritative
   * and applied immediately. The reverse lookup that follows only refreshes the
   * descriptive fields; if it fails, the pin still stands.
   */
  const handlePinMoved = useCallback(
    async (lat: number, lng: number) => {
      onCoordinatesChange?.(lat, lng);
      setJustMoved(true);
      const resolved = await reverseGeocode(lat, lng);
      if (resolved) {
        emittedRef.current = resolved.address;
        setSearch(resolved.address);
        onChange(resolved);
      }
    },
    [onChange, onCoordinatesChange]
  );

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setGpsError("This browser cannot share your location.");
      return;
    }
    setLocating(true);
    setGpsError("");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        const resolved = await reverseGeocode(latitude, longitude);
        if (resolved) {
          adopt(resolved);
        } else {
          // Coordinates are the valuable part — keep them even with no address.
          onCoordinatesChange?.(latitude, longitude);
          onChange({
            lat: latitude,
            lng: longitude,
            address: value.address,
            town: "",
            neighborhood: "",
            country: countryHint ?? "",
          });
        }
        setJustMoved(true);
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        setGpsError(
          err.code === err.PERMISSION_DENIED
            ? "Location permission was denied. Search for the address instead."
            : "Could not read your location. Search for the address instead."
        );
      },
      { enableHighAccuracy: true, timeout: 10_000 }
    );
  };

  const markers = useMemo<MapMarker[]>(() => {
    if (!hasPin) return [];
    return [
      {
        id: PIN_ID,
        lat: value.lat!,
        lng: value.lng!,
        draggable: true,
        onDragEnd: (lat, lng) => void handlePinMoved(lat, lng),
      },
    ];
  }, [hasPin, value.lat, value.lng, handlePinMoved]);

  return (
    <div className={cn("space-y-3", className)}>
      <PlaceAutocomplete
        label={label}
        value={search}
        onChange={setSearch}
        onResolved={adopt}
        // Rank nearby results first once a pin exists, without ever limiting
        // the search to one country.
        biasLocation={hasPin ? { lat: value.lat!, lng: value.lng! } : null}
        error={error}
      />

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={useMyLocation}
          disabled={locating}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
        >
          {locating ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Crosshair className="h-3.5 w-3.5" />
          )}
          Use my current location
        </button>
        <p className="text-xs text-slate-400">
          Most accurate when you are at the property.
        </p>
      </div>

      <div className="relative h-[320px] w-full overflow-hidden rounded-2xl border border-slate-200">
        <GoogleMap
          markers={markers}
          center={hasPin ? { lat: value.lat!, lng: value.lng! } : undefined}
          zoom={hasPin ? 17 : 12}
          onMapClick={(lat, lng) => void handlePinMoved(lat, lng)}
        />

        {!hasPin && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-900/75 to-transparent px-4 py-3">
            <p className="text-xs font-medium text-white">
              Search above, use your current location, or click the map to drop a pin.
            </p>
          </div>
        )}
      </div>

      {hasPin && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2">
          <span className="inline-flex items-center gap-1.5 text-xs text-slate-600">
            <MapPin className="h-3.5 w-3.5 text-[#4c6a48]" />
            Drag the pin to the exact entrance —{" "}
            <span className="font-mono text-[11px] text-slate-500">
              {value.lat!.toFixed(6)}, {value.lng!.toFixed(6)}
            </span>
          </span>
          {justMoved && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#3d533a]">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Pin updated
            </span>
          )}
        </div>
      )}

      {gpsError && <p className="text-xs font-medium text-amber-600">{gpsError}</p>}
    </div>
  );
}
