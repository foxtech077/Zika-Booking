"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { loadGoogleMaps, isGoogleMapsConfigured } from "@/lib/google-maps";

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  /** Rendered inside a pill marker. Omit for a plain pin. */
  label?: string;
  highlighted?: boolean;
  draggable?: boolean;
  onClick?: () => void;
  onHover?: (hovering: boolean) => void;
  onDragEnd?: (lat: number, lng: number) => void;
}

interface Props {
  markers: MapMarker[];
  center?: { lat: number; lng: number };
  zoom?: number;
  /** Fit the viewport around every marker instead of using `center`/`zoom`. */
  fitToMarkers?: boolean;
  /** Drop or move the primary pin by clicking the map. */
  onMapClick?: (lat: number, lng: number) => void;
  className?: string;
  /** Hide Google's POI/transit clutter — calmer behind price pills. */
  minimal?: boolean;
}

/** Pill marker drawn as an SVG data URI, so no Map ID is required. */
function pillIcon(
  maps: typeof google.maps,
  label: string,
  highlighted: boolean
): google.maps.Icon {
  const bg = highlighted ? "#0B1E3F" : "#ffffff";
  const fg = highlighted ? "#ffffff" : "#0B1E3F";
  // Approximate the text width — SVG cannot measure before layout.
  const width = Math.max(48, label.length * 7.2 + 22);
  const height = 28;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect x="1" y="1" rx="13" ry="13" width="${width - 2}" height="${height - 2}"
          fill="${bg}" stroke="#0B1E3F" stroke-width="2"/>
    <text x="50%" y="53%" dominant-baseline="middle" text-anchor="middle"
          font-family="system-ui,-apple-system,sans-serif" font-size="11"
          font-weight="800" fill="${fg}">${label.replace(/[<>&]/g, "")}</text>
  </svg>`;

  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new maps.Size(width, height),
    anchor: new maps.Point(width / 2, height / 2),
  };
}

const MINIMAL_STYLES: google.maps.MapTypeStyle[] = [
  { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "transit", elementType: "labels", stylers: [{ visibility: "off" }] },
];

const DEFAULT_CENTER = { lat: -1.2921, lng: 36.8219 }; // Nairobi

/**
 * Thin declarative wrapper over the Google Maps JS API.
 *
 * Markers are diffed against the live map rather than recreated on every
 * render — rebuilding them wholesale makes pins flicker and drops an in-flight
 * drag. Everything map-specific lives here so callers deal only in plain data.
 */
export function GoogleMap({
  markers,
  center,
  zoom = 13,
  fitToMarkers = false,
  onMapClick,
  className,
  minimal = true,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const mapsRef = useRef<typeof google.maps | null>(null);
  const markerRefs = useRef<Map<string, google.maps.Marker>>(new Map());
  const clickRef = useRef(onMapClick);
  clickRef.current = onMapClick;

  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  // ── Bootstrap ───────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    if (!isGoogleMapsConfigured()) {
      setStatus("error");
      return;
    }

    void loadGoogleMaps()
      .then((maps) => {
        if (cancelled || !hostRef.current) return;
        mapsRef.current = maps;
        mapRef.current = new maps.Map(hostRef.current, {
          center: center ?? DEFAULT_CENTER,
          zoom,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
          clickableIcons: false,
          ...(minimal ? { styles: MINIMAL_STYLES } : {}),
        });

        mapRef.current.addListener("click", (e: google.maps.MapMouseEvent) => {
          if (e.latLng && clickRef.current) {
            clickRef.current(e.latLng.lat(), e.latLng.lng());
          }
        });

        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
      markerRefs.current.forEach((m) => m.setMap(null));
      markerRefs.current.clear();
      mapRef.current = null;
    };
    // Intentionally mount-only: later center/zoom changes are handled below so
    // that user panning is not undone on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Markers ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const maps = mapsRef.current;
    const map = mapRef.current;
    if (status !== "ready" || !maps || !map) return;

    const live = markerRefs.current;
    const seen = new Set<string>();

    markers.forEach((m) => {
      seen.add(m.id);
      const icon = m.label ? pillIcon(maps, m.label, !!m.highlighted) : undefined;
      let marker = live.get(m.id);

      if (!marker) {
        marker = new maps.Marker({
          map,
          position: { lat: m.lat, lng: m.lng },
          draggable: !!m.draggable,
          ...(icon ? { icon } : {}),
          ...(m.draggable ? { cursor: "grab" } : {}),
        });
        live.set(m.id, marker);
      } else {
        const pos = marker.getPosition();
        if (!pos || pos.lat() !== m.lat || pos.lng() !== m.lng) {
          marker.setPosition({ lat: m.lat, lng: m.lng });
        }
        marker.setDraggable(!!m.draggable);
        if (icon) marker.setIcon(icon);
      }

      // Listeners capture the current callbacks, so replace them each pass.
      maps.event.clearInstanceListeners(marker);
      if (m.onClick) marker.addListener("click", m.onClick);
      if (m.onHover) {
        marker.addListener("mouseover", () => m.onHover!(true));
        marker.addListener("mouseout", () => m.onHover!(false));
      }
      if (m.onDragEnd) {
        marker.addListener("dragend", (e: google.maps.MapMouseEvent) => {
          if (e.latLng) m.onDragEnd!(e.latLng.lat(), e.latLng.lng());
        });
      }
    });

    live.forEach((marker, id) => {
      if (!seen.has(id)) {
        marker.setMap(null);
        live.delete(id);
      }
    });
  }, [markers, status]);

  // ── Viewport ────────────────────────────────────────────────────────────
  useEffect(() => {
    const maps = mapsRef.current;
    const map = mapRef.current;
    if (status !== "ready" || !maps || !map) return;

    if (fitToMarkers && markers.length > 1) {
      const bounds = new maps.LatLngBounds();
      markers.forEach((m) => bounds.extend({ lat: m.lat, lng: m.lng }));
      map.fitBounds(bounds, 48);
      return;
    }

    const target = center ?? (markers[0] ? { lat: markers[0].lat, lng: markers[0].lng } : null);
    if (target) map.panTo(target);
  }, [center?.lat, center?.lng, fitToMarkers, markers, status]);

  if (status === "error") {
    return (
      <div
        className={cn(
          "flex h-full w-full flex-col items-center justify-center gap-2 bg-slate-100 text-slate-400",
          className
        )}
      >
        <MapPin className="h-7 w-7" />
        <p className="text-xs font-semibold uppercase tracking-wider">
          Map unavailable
        </p>
      </div>
    );
  }

  return (
    <div className={cn("relative h-full w-full", className)}>
      <div ref={hostRef} className="h-full w-full" />
      {status === "loading" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-slate-100">
          <div className="h-6 w-6 animate-spin rounded-full border-4 border-[#0B1E3F] border-t-transparent" />
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Loading map…
          </p>
        </div>
      )}
    </div>
  );
}
