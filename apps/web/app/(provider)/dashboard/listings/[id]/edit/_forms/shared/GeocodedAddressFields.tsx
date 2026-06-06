"use client";

import { useMutation } from "@tanstack/react-query";
import { MapPin } from "lucide-react";
import { listingApi } from "@/lib/listing-api";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export interface GeoResult {
  lat: number;
  lng: number;
  town: string;
  country: string;
}

interface Props {
  address: string;
  town: string;
  country: string;
  onChange: (field: "address" | "town" | "country", value: string) => void;
  onGeocoded: (result: GeoResult) => void;
  addressLabel?: string;
  errors?: { address?: string; town?: string; country?: string };
}

export function GeocodedAddressFields({
  address, town, country, onChange, onGeocoded,
  addressLabel = "Address", errors,
}: Props) {
  const geo = useMutation({
    mutationFn: (addr: string) =>
      listingApi.get(`/geocode?address=${encodeURIComponent(addr)}`).then((r) => r.data),
    onSuccess: (data) => {
      if (data.lat && data.lng) onGeocoded(data as GeoResult);
    },
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
          />
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          loading={geo.isPending}
          disabled={!address.trim()}
          onClick={() => geo.mutate(address)}
          className="mb-0.5"
        >
          {geo.isSuccess ? "✓ Located" : "Geocode"}
        </Button>
      </div>
      <p className="text-xs text-slate-400">
        Click Geocode to auto-fill lat/lng, town and country — required before saving.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Input
          label="Town / City"
          value={town}
          onChange={(e) => onChange("town", e.target.value)}
          placeholder="Auto-filled on geocode"
          error={errors?.town}
        />
        <Input
          label="Country Code"
          value={country}
          onChange={(e) => onChange("country", e.target.value.toUpperCase().slice(0, 2))}
          placeholder="E.g., ZA, US"
          maxLength={2}
          error={errors?.country}
        />
      </div>
    </div>
  );
}
