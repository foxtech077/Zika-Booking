"use client";

import { useMemo } from "react";
import { GoogleMap, type MapMarker } from "@/components/maps/GoogleMap";
import type { PublicListingDetail } from "@/types";

interface Props {
  listings: PublicListingDetail[];
  hoveredId: string | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
}

/**
 * Results/detail map. Renders each listing as a price pill.
 *
 * The props are unchanged from the Leaflet version this replaces, so every
 * caller kept working — only the rendering engine swapped.
 */
export default function MapViewInner({
  listings,
  hoveredId,
  onHover,
  onSelect,
}: Props) {
  const markers = useMemo<MapMarker[]>(
    () =>
      listings
        .filter(
          (l): l is PublicListingDetail & { lat: number; lng: number } =>
            typeof l.lat === "number" && typeof l.lng === "number"
        )
        .map((l) => ({
          id: l.id,
          lat: l.lat,
          lng: l.lng,
          label: `${l.currency} ${(l.pricePerNight || 0).toLocaleString()}`,
          highlighted: hoveredId === l.id,
          onClick: () => onSelect(l.id),
          onHover: (hovering: boolean) => onHover(hovering ? l.id : null),
        })),
    [listings, hoveredId, onHover, onSelect]
  );

  return (
    <div className="h-full w-full overflow-hidden rounded-3xl">
      <GoogleMap markers={markers} fitToMarkers={markers.length > 1} zoom={14} />
    </div>
  );
}
