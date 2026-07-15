"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { MapPin } from "lucide-react";
import { listingApi } from "@/lib/listing-api";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { CountryCombobox } from "@/components/ui/CountryCombobox";
import { cn } from "@/lib/utils";

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
  onChange: (field: "address" | "town" | "neighborhood" | "country", value: string) => void;
  onGeocoded: (result: GeoResult) => void;
  addressLabel?: string;
  errors?: { address?: string; town?: string; neighborhood?: string; country?: string };
}

export function GeocodedAddressFields({
  address, town, neighborhood, country, onChange, onGeocoded,
  addressLabel = "Address", errors,
}: Props) {
  const [geoError, setGeoError] = useState("");

  const geo = useMutation({
    mutationFn: async (addr: string) => {
      setGeoError("");
      try {
        const res = await listingApi.get(`/geocode?address=${encodeURIComponent(addr)}`);
        if (res.data?.data?.lat && res.data?.data?.lng) {
          return res.data.data;
        }
      } catch (err) {
        console.warn("Backend geocoding failed, trying frontend Nominatim fallback...", err);
      }

      // Client-side Nominatim fallback
      const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(addr)}&format=json&limit=1&addressdetails=1`;
      const response = await fetch(nominatimUrl, {
        headers: { "Accept-Language": "en", "User-Agent": "Kainook/1.0" }
      });
      if (!response.ok) throw new Error("Address not found");
      const results = await response.json();
      if (!results || results.length === 0) throw new Error("Address not found");

      const r = results[0];
      const details = r.address ?? {};
      const townVal = details.city ?? details.town ?? details.village ?? details.county ?? details.state ?? "";
      const neighborhoodVal = details.neighbourhood ?? details.suburb ?? details.subdistrict ?? "";
      const countryVal = (details.country_code ?? "").toUpperCase();
      return {
        lat: parseFloat(r.lat),
        lng: parseFloat(r.lon),
        town: townVal,
        neighborhood: neighborhoodVal,
        country: countryVal,
      };
    },
    onSuccess: (data) => {
      if (data?.lat && data?.lng) {
        onGeocoded({
          lat: data.lat,
          lng: data.lng,
          town: data.town || "",
          neighborhood: data.neighborhood || "",
          country: data.country || "",
        });
      } else {
        setGeoError("Location not found. Please try a more specific address or enter details manually.");
      }
    },
    onError: (err: any) => {
      setGeoError("Unable to locate address. Please check your spelling or enter details manually.");
    }
  });

  return (
    <div className="space-y-3">
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <Input
            label={addressLabel}
            value={address}
            onChange={(e) => onChange("address", e.target.value)}
            placeholder="Enter full street address"
            leftIcon={<MapPin />}
            error={errors?.address}
            className="focus:ring-[#4c6a48] focus:border-[#4c6a48]"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          loading={geo.isPending}
          disabled={!address.trim()}
          onClick={() => geo.mutate(address)}
          className={cn(
            "mb-0.5 transition-all duration-200 border-slate-200 text-slate-700 hover:bg-slate-50 focus:ring-[#4c6a48] bg-white",
            geo.isSuccess && "bg-[#e6ebe4]/60 text-[#3d533a] border-[#4c6a48]/30 hover:bg-[#e6ebe4]/80"
          )}
        >
          {geo.isSuccess ? "✓ Located" : "Geocode"}
        </Button>
      </div>
      <p className="text-xs text-slate-400">
        Click Geocode to auto-fill lat/lng, town and country — optional, but helpful for map accuracy.
      </p>
      {geoError && (
        <p className="text-xs text-red-500 font-medium">
          ⚠️ {geoError}
        </p>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Town / City"
          value={town}
          onChange={(e) => onChange("town", e.target.value)}
          placeholder="Auto-filled on geocode"
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
      <div>
        <CountryCombobox
          label="Country"
          value={country}
          onChange={(val) => onChange("country", val)}
          error={errors?.country}
        />
      </div>
    </div>
  );
}
