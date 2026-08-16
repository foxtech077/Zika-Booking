"use client";

import { Input } from "@/components/ui/Input";
import { CountryCombobox } from "@/components/ui/CountryCombobox";
import { LocationPicker, type PickedLocation } from "@/components/maps/LocationPicker";

export interface GeoResult {
  lat: number;
  lng: number;
  town: string;
  neighborhood: string;
  country: string;
}

interface Props {
  address: string;
  town: string;
  neighborhood: string;
  country: string;
  /** Current pin. Optional so existing callers keep compiling. */
  lat?: number | null;
  lng?: number | null;
  onChange: (field: "address" | "town" | "neighborhood" | "country", value: string) => void;
  onGeocoded: (result: GeoResult) => void;
  addressLabel?: string;
  errors?: { address?: string; town?: string; neighborhood?: string; country?: string };
}

/**
 * Address block for the listing forms.
 *
 * Replaces the old "type an address, press Geocode" flow. That flow accepted
 * whatever a geocoder returned without ever showing it, which let a listing go
 * live pinned kilometres from the property. Here the provider searches Google
 * Places, sees the pin, and can drag it.
 */
export function GeocodedAddressFields({
  address, town, neighborhood, country, lat = null, lng = null,
  onChange, onGeocoded, addressLabel = "Address", errors,
}: Props) {
  /**
   * Fan a resolved place out to the parent's individual field setters.
   *
   * Google omits components it has no data for — rural addresses routinely come
   * back with no neighborhood, and sometimes no locality. Falling back to the
   * current value stops a successful search from blanking a field the provider
   * filled in by hand, and stops an empty country from resetting the currency
   * the parent derives from it.
   */
  const applyPlace = (place: PickedLocation) => {
    const next = {
      town: place.town || town,
      neighborhood: place.neighborhood || neighborhood,
      country: place.country || country,
    };
    onChange("address", place.address);
    if (next.town !== town) onChange("town", next.town);
    if (next.neighborhood !== neighborhood) onChange("neighborhood", next.neighborhood);
    if (next.country !== country) onChange("country", next.country);
    onGeocoded({ lat: place.lat, lng: place.lng, ...next });
  };

  return (
    <div className="space-y-4">
      <LocationPicker
        label={addressLabel}
        value={{ lat, lng, address }}
        onChange={applyPlace}
        // A drag is authoritative even when reverse geocoding adds nothing.
        onCoordinatesChange={(nextLat, nextLng) =>
          onGeocoded({ lat: nextLat, lng: nextLng, town, neighborhood, country })
        }
        countryHint={country || undefined}
        error={errors?.address}
      />

      <Input
        label="Full address"
        value={address}
        onChange={(e) => onChange("address", e.target.value)}
        placeholder="Filled in from the search — edit if the building needs more detail"
        error={errors?.address}
        className="focus:ring-[#4c6a48] focus:border-[#4c6a48]"
      />

      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Town / City"
          value={town}
          onChange={(e) => onChange("town", e.target.value)}
          placeholder="Filled in from the map"
          error={errors?.town}
          className="focus:ring-[#4c6a48] focus:border-[#4c6a48]"
        />
        <Input
          label="Neighborhood"
          value={neighborhood}
          onChange={(e) => onChange("neighborhood", e.target.value)}
          placeholder="Neighborhood"
          error={errors?.neighborhood}
          className="focus:ring-[#4c6a48] focus:border-[#4c6a48]"
        />
      </div>

      <CountryCombobox
        label="Country"
        value={country}
        onChange={(val) => onChange("country", val)}
        error={errors?.country}
      />
    </div>
  );
}
