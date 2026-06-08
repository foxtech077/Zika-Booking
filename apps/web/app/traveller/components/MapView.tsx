"use client";
import dynamic from "next/dynamic";
import React from "react";
import type { PublicListingDetail } from "@/types";

interface MapViewProps {
  listings: PublicListingDetail[];
  hoveredId: string | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
  searchDestination?: string;
}

// Leaflet requires window — load only on the client, never on the server
const MapViewInner = dynamic(() => import("./MapViewInner"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-slate-100 rounded-3xl flex flex-col items-center justify-center gap-3">
      <div className="animate-spin h-6 w-6 border-4 border-[#0B1E3F] border-t-transparent rounded-full" />
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Loading map…</p>
    </div>
  ),
});

export default function MapView(props: MapViewProps) {
  return <MapViewInner {...props} />;
}
