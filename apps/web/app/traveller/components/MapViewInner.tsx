"use client";
import React, { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { PublicListingDetail } from "@/types";

// Fix broken webpack default icon paths
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

interface Props {
  listings: PublicListingDetail[];
  hoveredId: string | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
}

function RecenterOnChange({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => { map.setView(center, map.getZoom(), { animate: true }); }, [center[0], center[1]]);
  return null;
}

function makePriceIcon(listing: PublicListingDetail, isHovered: boolean) {
  const label = `${listing.currency} ${(listing.pricePerNight || 0).toLocaleString()}`;
  return L.divIcon({
    className: "",
    iconAnchor: [36, 14],
    html: `<div style="
      background:${isHovered ? "#0B1E3F" : "#fff"};
      color:${isHovered ? "#fff" : "#0B1E3F"};
      border:2px solid #0B1E3F;
      padding:3px 10px;
      border-radius:20px;
      font-size:11px;
      font-weight:800;
      font-family:system-ui,sans-serif;
      white-space:nowrap;
      box-shadow:0 2px 10px rgba(0,0,0,0.18);
      cursor:pointer;
      transform:${isHovered ? "scale(1.13)" : "scale(1)"};
      transition:all 0.15s;
    ">${label}</div>`,
  });
}

export default function MapViewInner({ listings, hoveredId, onHover, onSelect }: Props) {
  const pinnable = listings.filter((l): l is typeof l & { lat: number; lng: number } => !!l.lat && !!l.lng);
  const center: [number, number] =
    pinnable.length > 0 ? [pinnable[0]!.lat, pinnable[0]!.lng] : [-1.2921, 36.8219];

  return (
    <MapContainer
      center={center}
      zoom={12}
      scrollWheelZoom
      style={{ width: "100%", height: "100%", borderRadius: "1.5rem" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <RecenterOnChange center={center} />
      {pinnable.map((listing) => (
        <Marker
          key={listing.id}
          position={[listing.lat, listing.lng]}
          icon={makePriceIcon(listing, hoveredId === listing.id)}
          eventHandlers={{
            click:     () => onSelect(listing.id),
            mouseover: () => onHover(listing.id),
            mouseout:  () => onHover(null),
          }}
        >
          <Popup>
            <div style={{ minWidth: 140 }}>
              <p style={{ fontWeight: 700, fontSize: 12, color: "#0f172a", marginBottom: 2 }}>{listing.name}</p>
              <p style={{ fontWeight: 700, fontSize: 11, color: "#0B1E3F" }}>
                {listing.currency} {(listing.pricePerNight || 0).toLocaleString()} / {listing.category === "car" ? "day" : "night"}
              </p>
              {listing.starRating && (
                <p style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>⭐ {listing.starRating}</p>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
