"use client";

import { useEffect, useMemo, useState, useCallback, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus, Eye, Edit3, Trash2, CheckCircle,
  XCircle, ArrowUpRight, Hotel, Car, Home,
  X, ChevronLeft, ChevronRight, Images, MapPin, Clock,
  Cigarette, PawPrint, CalendarDays, Star, Fuel, Users,
  DoorOpen, Gauge, TrendingDown, BedDouble, Bath,
} from "lucide-react";
import Link from "next/link";
import { listingApi } from "@/lib/listing-api";
import { Card, SectionHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DataTable, FilterBar, Pagination, type Column } from "@/components/tables/DataTable";
import { ConfirmModal } from "@/components/modals/Modals";
import { formatDate, formatCurrency, slugToLabel, cn } from "@/lib/utils";
import type { Listing, ListingCategory } from "@/types/provider";
import { useAuthStore } from "@/stores/auth";
import type { HotelRoomType } from "@/types";

const TOKEN_KEY = "zika:access_token";

const getAuthToken = (storeToken: string | null) =>
  storeToken ??
  (typeof window !== "undefined" ? sessionStorage.getItem(TOKEN_KEY) : null);

const getAuthConfig = (storeToken: string | null) => {
  const token = getAuthToken(storeToken);
  if (!token) throw new Error("AUTH_REQUIRED");
  if (typeof window !== "undefined") sessionStorage.setItem(TOKEN_KEY, token);
  return { headers: { Authorization: `Bearer ${token}` } };
};

let refreshPromise: Promise<string> | null = null;

const refreshAccessToken = async () => {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const res = await fetch("/api/auth/refresh", {
        method: "POST",
        credentials: "include",
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error?.message ?? "Session expired. Please sign in again.");
      const accessToken =
        body?.data?.tokens?.accessToken ??
        body?.tokens?.accessToken ??
        body?.data?.accessToken ??
        body?.accessToken;
      if (!accessToken) throw new Error("Refresh succeeded, but no access token was returned.");
      if (typeof window !== "undefined") sessionStorage.setItem(TOKEN_KEY, accessToken);
      const { user, setSession } = useAuthStore.getState();
      const refreshedUser = body?.data?.user ?? body?.user ?? user;
      if (refreshedUser) setSession(accessToken, refreshedUser);
      return accessToken as string;
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
};

const withTokenRefresh = async <T,>(
  request: (tokenOverride: string | null) => Promise<T>,
  currentToken: string | null,
) => {
  try {
    return await request(currentToken);
  } catch (err: any) {
    if (err?.response?.status !== 401) throw err;
    const freshToken = await refreshAccessToken();
    return request(freshToken);
  }
};

const fetchListings = (params: Record<string, string>, token: string | null) =>
  withTokenRefresh(
    (tokenOverride) =>
      listingApi
        .get(`/listings?${new URLSearchParams(Object.entries(params).filter(([, value]) => value))}`, getAuthConfig(tokenOverride))
        .then((r) => r.data.data ?? r.data),
    token,
  );

const getListingTitle = (listing: Listing | any) =>
  listing?.listingTitle ?? listing?.name ?? "";

const getPhotoUrl = (photo: any) =>
  photo?.cdnUrl ?? photo?.url ?? photo?.publicUrl ?? photo?.src ?? "";

const getListingId = (listing: Listing | any) =>
  listing?.id ?? listing?.listingId ?? listing?._id ?? "";

// ── Amenity helpers ───────────────────────────────────────────────────────────

const AMENITY_LABEL_MAP: Record<string, string> = {
  wifi:               "High-Speed Wi-Fi",
  smart_tv:           "Smart TV",
  work_desk:          "Work Desk",
  printer:            "Printer",
  breakfast:          "Breakfast Included",
  restaurant_on_site: "Restaurant On-Site",
  coffee_machine:     "Coffee Machine",
  minibar:            "Minibar",
  kitchen:            "Kitchen / Kitchenette",
  pool:               "Swimming Pool",
  spa:                "Spa",
  sauna:              "Sauna",
  hot_tub:            "Hot Tub",
  fitness_centre:     "Fitness Centre",
  ac:                 "Air Conditioning",
  heating:            "Heating",
  laundry:            "Laundry",
  parking:            "Parking",
  elevator:           "Elevator",
  accessible:         "Accessible",
  reception_24h:      "24h Reception",
  housekeeping_daily: "Daily Housekeeping",
  airport_shuttle:    "Airport Shuttle",
  security_24h:       "24h Security",
  shop_on_site:       "Shop On-Site",
  pet_friendly:       "Pet-Friendly",
  workspace:          "Workspace",
};

const AMENITY_CATEGORY_MAP: Record<string, string> = {
  wifi:               "Connectivity",
  smart_tv:           "Connectivity",
  work_desk:          "Connectivity",
  printer:            "Connectivity",
  workspace:          "Connectivity",
  breakfast:          "Food & Drink",
  restaurant_on_site: "Food & Drink",
  coffee_machine:     "Food & Drink",
  minibar:            "Food & Drink",
  kitchen:            "Food & Drink",
  pool:               "Wellness",
  spa:                "Wellness",
  sauna:              "Wellness",
  hot_tub:            "Wellness",
  fitness_centre:     "Wellness",
  ac:                 "Comfort",
  heating:            "Comfort",
  laundry:            "Comfort",
  parking:            "Comfort",
  elevator:           "Comfort",
  accessible:         "Comfort",
  reception_24h:      "Services",
  housekeeping_daily: "Services",
  airport_shuttle:    "Services",
  security_24h:       "Services",
  shop_on_site:       "Services",
  pet_friendly:       "Services",
};

const AMENITY_CATEGORY_ICONS: Record<string, string> = {
  "Connectivity": "📶",
  "Food & Drink": "🍽️",
  "Wellness":     "🧘",
  "Comfort":      "🛋️",
  "Services":     "🛎️",
};

function flattenAmenities(raw: unknown): string[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  return (Object.values(raw) as string[][]).flat().filter(Boolean);
}

function getAmenityLabel(key: string): string {
  return AMENITY_LABEL_MAP[key] ?? slugToLabel(key);
}

const unwrapListingId = (payload: any): string | null =>
  payload?.data?.id ??
  payload?.id ??
  payload?.data?.listing?.id ??
  payload?.listing?.id ??
  payload?.listingId ??
  null;

function CategoryIcon({ category }: { category: ListingCategory }) {
  if (category === "hotel")     return <Hotel className="w-4 h-4 text-green-500" />;
  if (category === "car")       return <Car className="w-4 h-4 text-amber-500" />;
  return <Home className="w-4 h-4 text-emerald-500" />;
}

// ── Image Gallery Lightbox ────────────────────────────────────────────────────

function ImageGallery({ images, open, onClose, initialIndex = 0 }: {
  images: string[];
  open: boolean;
  onClose: () => void;
  initialIndex?: number;
}) {
  const [current, setCurrent] = useState(initialIndex);

  useEffect(() => { if (open) setCurrent(initialIndex); }, [open, initialIndex]);

  const prev = useCallback(() => setCurrent(i => (i - 1 + images.length) % images.length), [images.length]);
  const next = useCallback(() => setCurrent(i => (i + 1) % images.length), [images.length]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose, prev, next]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open || images.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-black/95 backdrop-blur-sm animate-fade-in">
      {/* Lightbox Header */}
      <div className="flex items-center justify-between px-5 py-4 shrink-0">
        <span className="text-white/80 text-sm font-medium">
          {current + 1} / {images.length}
        </span>
        <button
          onClick={onClose}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all"
          aria-label="Close gallery"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main Image Viewer */}
      <div className="flex-1 flex items-center justify-center relative px-4 min-h-0">
        {images.length > 1 && (
          <button
            onClick={prev}
            className="absolute left-4 z-10 w-11 h-11 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/25 text-white transition-all"
            aria-label="Previous image"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}
        <img
          key={current}
          src={images[current]}
          alt={`Image ${current + 1}`}
          className="max-h-full max-w-full object-contain rounded-xl select-none shadow-2xl"
          style={{ maxHeight: "calc(100vh - 220px)" }}
        />
        {images.length > 1 && (
          <button
            onClick={next}
            className="absolute right-4 z-10 w-11 h-11 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/25 text-white transition-all"
            aria-label="Next image"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Thumbnail Strip */}
      {images.length > 1 && (
        <div className="shrink-0 px-4 py-4 overflow-x-auto">
          <div className="flex gap-2 justify-center min-w-max mx-auto">
            {images.map((src, idx) => (
              <button
                key={idx}
                onClick={() => setCurrent(idx)}
                className={cn(
                  "w-14 h-14 rounded-lg overflow-hidden shrink-0 border-2 transition-all",
                  idx === current
                    ? "border-white scale-105 shadow-lg"
                    : "border-white/20 opacity-60 hover:opacity-90"
                )}
              >
                <img src={src} alt={`Thumb ${idx + 1}`} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Info Field helper ─────────────────────────────────────────────────────────

function InfoField({ label, value, icon, wide }: { label: string; value?: ReactNode; icon?: ReactNode; wide?: boolean }) {
  if (!value && value !== 0) return null;
  return (
    <div className={wide ? "col-span-2 sm:col-span-3" : ""}>
      <p className="text-[10px] uppercase tracking-widest text-slate-400 font-semibold mb-1 flex items-center gap-1">
        {icon && <span className="opacity-70">{icon}</span>}
        {label}
      </p>
      <p className="text-sm text-slate-900 font-medium leading-snug">{value}</p>
    </div>
  );
}

function SectionDivider({ title }: { title: string }) {
  return (
    <div className="col-span-2 sm:col-span-3 flex items-center gap-3 pt-2">
      <span className="text-[10px] uppercase tracking-widest font-bold text-slate-400">{title}</span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

// ── View Listing Modal ────────────────────────────────────────────────────────

function ViewListingModal({
  listing,
  isLoadingFull,
  roomTypes,
  isLoadingRoomTypes,
  onClose,
  onAction,
}: {
  listing: Listing | null;
  isLoadingFull: boolean;
  roomTypes?: HotelRoomType[] | null;
  isLoadingRoomTypes?: boolean;
  onClose: () => void;
  onAction: (action: string, l: Listing) => void;
}) {
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState(0);

  // Collect all image URLs
  const allImages = useMemo(() => {
    if (!listing) return [];
    return (listing.photos ?? []).map(getPhotoUrl).filter(Boolean) as string[];
  }, [listing]);

  const coverUrl = allImages[0] ?? "";

  useEffect(() => {
    if (listing) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [listing]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape" && !galleryOpen) onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose, galleryOpen]);

  if (!listing) return null;

  const l = listing;
  const title = getListingTitle(l) || "Listing Details";

  // ── Build field groups ───────────────────────────────
  const locationValue = [l.address, l.town, l.country].filter(Boolean).join(", ") || "—";
  const priceValue = formatListingPrice(l);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50"
        onClick={onClose}
      />

      {/* Modal Shell */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[95vh] animate-slide-in-up overflow-hidden">

          {/* ── FIXED HEADER ── */}
          <div className="flex items-start justify-between px-5 pt-5 pb-4 border-b border-border shrink-0 bg-white">
            <div className="min-w-0 pr-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge label={l.status} status={l.status} dot />
                <Badge label={l.category} />
              </div>
              <h2 className="font-bold text-slate-900 text-lg mt-1 leading-tight truncate">{title}</h2>
              {(l.town || l.country) && (
                <p className="text-sm text-slate-500 flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  {[l.town, l.country].filter(Boolean).join(", ")}
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="w-9 h-9 shrink-0 flex items-center justify-center rounded-xl text-slate-400 hover:bg-surface-muted hover:text-slate-700 transition-all"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* ── FIXED COVER IMAGE ── */}
          {coverUrl && (
            <div
              className="relative w-full shrink-0 bg-slate-100 cursor-pointer group"
              style={{ height: "220px" }}
              onClick={() => { setGalleryIndex(0); setGalleryOpen(true); }}
            >
              <img
                src={coverUrl}
                alt={title}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
                <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 text-slate-800 text-xs font-semibold px-3 py-1.5 rounded-full shadow">
                  View images
                </span>
              </div>
              {allImages.length > 1 && (
                <div className="absolute bottom-3 right-3 flex items-center gap-1.5 bg-black/60 text-white text-xs font-medium px-2.5 py-1 rounded-full">
                  <Images className="w-3.5 h-3.5" />
                  {allImages.length} photos
                </div>
              )}
            </div>
          )}

          {/* ── SCROLLABLE CONTENT ── */}
          <div className="flex-1 overflow-y-auto min-h-0 scrollbar-thin">
            {isLoadingFull && !listing ? (
              <div className="py-12 flex flex-col items-center gap-3 text-slate-400">
                <div className="w-8 h-8 border-2 border-slate-200 border-t-primary rounded-full animate-spin" />
                <span className="text-sm">Loading full details…</span>
              </div>
            ) : (
              <div className="p-5 space-y-5">

                {/* ── Geo Verification Warning ── */}
                {l.category === "apartment" && (l as any).temporaryActivation && (l as any).geoVerificationDueAt && (
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
                    <span className="text-amber-600 font-bold text-sm shrink-0 mt-0.5">⚠</span>
                    <div className="text-sm text-amber-800">
                      <p className="font-semibold">Temporary activation — geolocation pending</p>
                      <p className="text-amber-700 mt-0.5">
                        Your apartment is live but the location has not yet been verified. Geolocation verification is due by{" "}
                        <span className="font-semibold">{formatDate((l as any).geoVerificationDueAt)}</span>.{" "}
                        If not verified, the listing will be auto-suspended. Please update your address or contact support.
                      </p>
                    </div>
                  </div>
                )}

                {/* ── Room Types Section ── */}
                {l.category === "hotel" && (
                  <div className="rounded-2xl border border-border/60 bg-slate-50 p-5 space-y-4">
                    <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Room Types Setup</p>
                    {isLoadingRoomTypes ? (
                      <div className="py-4 flex flex-col items-center gap-2 text-slate-400">
                        <div className="w-5 h-5 border-2 border-slate-200 border-t-primary rounded-full animate-spin" />
                        <span className="text-xs">Loading room types...</span>
                      </div>
                    ) : !roomTypes || roomTypes.length === 0 ? (
                      <p className="text-xs text-slate-500 italic">No room types defined yet.</p>
                    ) : (
                      <div className="overflow-x-auto border border-border/60 rounded-xl bg-white">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-50 border-b border-border/60 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                              <th className="p-3">Room Name</th>
                              <th className="p-3">Classification</th>
                              <th className="p-3">Price/Night</th>
                              <th className="p-3">Inventory</th>
                              <th className="p-3">Max Guests</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-slate-700">
                            {roomTypes.map((rt) => (
                              <tr key={rt.id} className="hover:bg-slate-50/50">
                                <td className="p-3 font-semibold text-slate-900">{rt.name}</td>
                                <td className="p-3 capitalize">{rt.roomType.replace("_", " ")}</td>
                                <td className="p-3 font-semibold text-slate-800">
                                  {formatCurrency(Number(rt.pricePerNight), l.currency ?? "USD")}
                                </td>
                                <td className="p-3">{rt.unitCount} {rt.unitCount > 1 ? "rooms" : "room"}</td>
                                <td className="p-3">{rt.maxGuests ?? 2} guest{(rt.maxGuests ?? 2) > 1 ? "s" : ""}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* ── Core Info Grid ── */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-5 bg-slate-50 rounded-2xl p-5 border border-border/60">

                  {/* <InfoField label={getPriceLabel(l)} value={priceValue} icon={<span className="text-xs">💰</span>} /> */}
                  <InfoField label="Currency" value={l.currency ?? "—"} />
                  <InfoField label="Status" value={slugToLabel(l.status)} />
                  <InfoField label="Category" value={slugToLabel(l.category)} />
                  <InfoField label="Location" value={locationValue} icon={<MapPin className="w-3 h-3" />} wide />

                  {l.lat != null && l.lng != null && (
                    <InfoField label="Coordinates" value={`${l.lat}, ${l.lng}`} />
                  )}

                  {/* Dates */}
                  <SectionDivider title="Dates" />
                  <InfoField label="Created" value={formatDate(l.createdAt)} icon={<CalendarDays className="w-3 h-3" />} />
                  <InfoField label="Updated" value={formatDate(l.updatedAt)} icon={<CalendarDays className="w-3 h-3" />} />
                  {l.submittedAt && <InfoField label="Submitted" value={formatDate(l.submittedAt)} />}
                  {l.approvedAt && <InfoField label="Approved" value={formatDate(l.approvedAt)} />}
                  {l.activatedAt && <InfoField label="Activated" value={formatDate(l.activatedAt)} />}
                  {l.rejectedAt && <InfoField label="Rejected" value={formatDate(l.rejectedAt)} />}
                  {l.suspendedAt && <InfoField label="Suspended" value={formatDate(l.suspendedAt)} />}

                  {/* Policies */}
                  <SectionDivider title="Policies" />
                  {l.category === "car" && (
                    <InfoField label="Daily Rate" value={l.pricePerDay ? `${l.currency ?? "USD"} ${Number(l.pricePerDay).toLocaleString()}` : "—"} />
                  )}
                  {l.securityDeposit != null && l.securityDeposit > 0 && (
                    <InfoField label="Security Deposit" value={`${l.currency ?? "USD"} ${Number(l.securityDeposit).toLocaleString()}`} />
                  )}
                  {l.cancellationPolicy && (
                    <InfoField label="Cancellation" value={slugToLabel(l.cancellationPolicy)} />
                  )}
                  {l.minStayNights != null && (
                    <InfoField label="Min Stay" value={`${l.minStayNights} night(s)`} />
                  )}
                  {l.checkinTime && (
                    <InfoField label="Check-in" value={l.checkinTime} icon={<Clock className="w-3 h-3" />} />
                  )}
                  {l.checkoutTime && (
                    <InfoField label="Check-out" value={l.checkoutTime} icon={<Clock className="w-3 h-3" />} />
                  )}
                  <InfoField
                    label="Smoking"
                    value={l.smokingAllowed ? "✅ Allowed" : "🚫 Not Allowed"}
                    icon={<Cigarette className="w-3 h-3" />}
                  />
                  <InfoField
                    label="Pets"
                    value={l.petsAllowed ? "✅ Allowed" : "🚫 Not Allowed"}
                    icon={<PawPrint className="w-3 h-3" />}
                  />

                  {/* Hotel-specific */}
                  {l.category === "hotel" && (
                    <>
                      <SectionDivider title="Hotel Details" />
                      <InfoField label="Unit Count" value={l.unitCount ?? undefined} />
                      <InfoField label="Room Type" value={l.roomType ? slugToLabel(l.roomType) : undefined} />
                      {l.starRating != null && (
                        <InfoField label="Star Rating" value={`${l.starRating} ★`} icon={<Star className="w-3 h-3" />} />
                      )}
                      {l.claimedStarRating != null && (
                        <InfoField label="Claimed Rating" value={`${l.claimedStarRating} ★`} />
                      )}
                    </>
                  )}

                  {/* Apartment-specific */}
                  {l.category === "apartment" && (
                    <>
                      <SectionDivider title="Apartment Details" />
                      {(l as any).apartmentType && (
                        <InfoField label="Type" value={slugToLabel((l as any).apartmentType)} />
                      )}
                      <InfoField label="Max Guests" value={l.maxGuests ?? undefined} icon={<Users className="w-3 h-3" />} />
                      <InfoField label="Bedrooms" value={l.bedrooms ?? undefined} icon={<BedDouble className="w-3 h-3" />} />
                      <InfoField label="Bathrooms" value={l.bathrooms ?? undefined} icon={<Bath className="w-3 h-3" />} />
                      <InfoField
                        label="Geo verification"
                        value={(l as any).temporaryActivation ? "Temporary activation" : "Verified"}
                        icon={<MapPin className="w-3 h-3" />}
                      />
                      {l.longStayEnabled && (
                        <>
                          <SectionDivider title="Long Stay" />
                          <InfoField label="Min Nights" value={l.longStayMinNights ?? undefined} />
                          {l.longStayDiscountType && (
                            <InfoField label="Discount Type" value={slugToLabel(l.longStayDiscountType)} icon={<TrendingDown className="w-3 h-3" />} />
                          )}
                          {l.longStayDiscountValue != null && (
                            <InfoField label="Discount Value" value={`${l.longStayDiscountValue}`} />
                          )}
                        </>
                      )}
                    </>
                  )}

                  {/* Car-specific */}
                  {l.category === "car" && (
                    <>
                      <SectionDivider title="Vehicle Details" />
                      <InfoField label="Make" value={l.carMake ?? undefined} />
                      <InfoField label="Model" value={l.carModel ?? undefined} />
                      <InfoField label="Year" value={l.carYear ?? undefined} />
                      <InfoField label="Transmission" value={l.transmission ? slugToLabel(l.transmission) : undefined} />
                      <InfoField label="Fuel Type" value={l.fuelType ? slugToLabel(l.fuelType) : undefined} icon={<Fuel className="w-3 h-3" />} />
                      <InfoField label="Seats" value={l.seats ?? undefined} icon={<Users className="w-3 h-3" />} />
                      <InfoField label="Doors" value={l.doors ?? undefined} icon={<DoorOpen className="w-3 h-3" />} />
                      {l.mileagePolicy && (
                        <InfoField label="Mileage Policy" value={slugToLabel(l.mileagePolicy)} icon={<Gauge className="w-3 h-3" />} />
                      )}
                      {l.mileageLimitKm != null && (
                        <InfoField label="Mileage Limit" value={`${l.mileageLimitKm} km`} />
                      )}
                    </>
                  )}

                  {/* Submission info */}
                  {l.submissionCount > 0 && (
                    <>
                      <SectionDivider title="Submission" />
                      <InfoField label="Submission Count" value={l.submissionCount} />
                    </>
                  )}
                </div>

                {/* ── Amenities Section ── */}
                {(() => {
                  const lAny = l as any;
                  const stdKeys = flattenAmenities(lAny.amenities);
                  const customAmens: string[] = (lAny.customAmenities ?? []).map((a: any) =>
                    typeof a === "string" ? a : (a?.label ?? "")
                  ).filter(Boolean);
                  if (stdKeys.length === 0 && customAmens.length === 0) return null;

                  // Group standard amenities by category for display
                  const grouped: Record<string, string[]> = {};
                  for (const key of stdKeys) {
                    const cat = AMENITY_CATEGORY_MAP[key] ?? "Other";
                    (grouped[cat] ??= []).push(key);
                  }

                  return (
                    <div className="rounded-2xl border border-border/60 bg-slate-50 p-5 space-y-4">
                      <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Amenities</p>

                      {Object.entries(grouped).map(([cat, keys]) => (
                        <div key={cat}>
                          <p className="text-xs font-semibold text-slate-500 mb-2 flex items-center gap-1.5">
                            <span>{AMENITY_CATEGORY_ICONS[cat] ?? "✦"}</span>
                            {cat}
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {keys.map((key) => (
                              <span
                                key={key}
                                className="inline-flex items-center gap-1 bg-primary-50 text-primary-700 border border-primary/20 text-xs font-semibold px-2.5 py-1 rounded-full"
                              >
                                ✓ {getAmenityLabel(key)}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}

                      {customAmens.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-slate-500 mb-2">✦ Custom</p>
                          <div className="flex flex-wrap gap-2">
                            {customAmens.map((tag, i) => (
                              <span
                                key={i}
                                className="inline-flex items-center bg-slate-100 text-slate-700 border border-slate-200 text-xs font-semibold px-2.5 py-1 rounded-full"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* ── Description ── */}
                {l.description && (
                  <div className="rounded-2xl border border-border/60 bg-slate-50 p-5">
                    <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-2">Description</p>
                    <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{l.description}</p>
                  </div>
                )}

                {/* ── Rejection info ── */}
                {l.rejectionReasons?.length > 0 && (
                  <div className="rounded-2xl border border-danger/20 bg-red-50 p-5">
                    <p className="text-sm font-bold text-danger mb-2">⚠ Rejection Reasons</p>
                    <ul className="space-y-1.5 list-disc pl-4">
                      {l.rejectionReasons.map((r: string, i: number) => (
                        <li key={i} className="text-sm text-danger-dark">{r}</li>
                      ))}
                    </ul>
                    {l.rejectionNote && (
                      <p className="text-xs text-danger-dark mt-3 pt-3 border-t border-danger/20">
                        {l.rejectionNote}
                      </p>
                    )}
                  </div>
                )}

                {/* ── View All Images ── */}
                {allImages.length > 0 && (
                  <button
                    onClick={() => { setGalleryIndex(0); setGalleryOpen(true); }}
                    className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-2xl border-2 border-dashed border-slate-200 text-sm font-semibold text-slate-500 hover:border-primary hover:text-primary hover:bg-primary-50/40 transition-all group"
                  >
                    <Images className="w-4 h-4 group-hover:scale-110 transition-transform" />
                    View All Images
                    <span className="text-xs font-normal opacity-70">({allImages.length} photo{allImages.length !== 1 ? "s" : ""})</span>
                  </button>
                )}

              </div>
            )}
          </div>

          {/* ── FOOTER ACTIONS ── */}
          <div className="border-t border-border px-5 py-4 shrink-0 bg-white">
            <div className="flex flex-wrap items-center justify-end gap-2">
              <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
              {canSubmit(l) && (
                <Button variant="primary" size="sm" onClick={() => onAction("submit", l)}>
                  Submit for Review
                </Button>
              )}
              {canActivate(l) && (
                <Button variant="success" size="sm" onClick={() => onAction("activate", l)}>
                  {getActivationLabel(l.status)}
                </Button>
              )}
              {canDeactivate(l.status) && (
                <Button variant="secondary" size="sm" onClick={() => onAction("deactivate", l)}>
                  Deactivate
                </Button>
              )}
              {canDelete(l.status) && (
                <Button variant="danger" size="sm" onClick={() => onAction("delete", l)}>
                  Delete Draft
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Image Gallery Lightbox */}
      <ImageGallery
        images={allImages}
        open={galleryOpen}
        onClose={() => setGalleryOpen(false)}
        initialIndex={galleryIndex}
      />
    </>
  );
}

function canSubmit(listing: Listing) {
  return listing.category === "hotel" && ["draft", "rejected"].includes(listing.status);
}
function canActivate(listing: Listing) {
  return ["apartment", "car"].includes(listing.category) && ["draft", "deactivated"].includes(listing.status);
}
function canDeactivate(status: string) { return ["active", "approved"].includes(status); }
function canDelete(status: string)     { return status === "draft"; }
function actionForStatus(action: string, status: string) {
  return action === "activate" && status === "deactivated" ? "reactivate" : action;
}

function getActivationLabel(status: string) {
  return status === "deactivated" ? "Reactivate" : "Activate Live";
}

function getActivationTitle(status: string) {
  return status === "deactivated" ? "Reactivate listing?" : "Activate listing?";
}

function getActivationMessage(status: string) {
  return status === "deactivated"
    ? "This listing will go live again and be visible to guests."
    : "This listing will be activated and visible to guests.";
}

const getListingPrice = (listing: Listing | any) => {
  if (listing.category === "car") {
    // Try all possible field names the API might return for the car daily rate
    const raw =
      listing.pricePerDay ??
      listing.dailyRate ??
      listing.price_per_day ??
      listing.dailyPrice ??
      listing.rate ??
      listing.price ??
      listing.pricePerNight ?? // last-resort: some backends share the column
      null;
    return raw;
  }
  return (
    listing.pricePerNight ??
    listing.nightlyRate ??
    listing.price ??
    null
  );
};

const getPriceLabel = (listing: Listing | any) =>
  listing.category === "car" ? "Price / Day" : "Price / Night";

const formatListingPrice = (listing: Listing | any) => {
  const price = getListingPrice(listing);
  // Treat null, undefined, empty string, and NaN as missing
  if (price == null || price === "" || Number.isNaN(Number(price))) return "—";
  const num = Number(price);
  return num > 0 ? formatCurrency(num, listing.currency ?? "USD") : "—";
};

const formatReviewRating = (listing: Listing | any) =>
  listing.starRating ? `⭐ ${listing.starRating}★` : "No reviews yet";

export default function ListingsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const token = useAuthStore((state) => state.token);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [geoPendingOnly, setGeoPendingOnly] = useState(false);
  const [offset, setOffset] = useState(0);
  const [pageSize, setPageSize] = useState<number>(5);
  const [selected, setSelected] = useState<Listing | null>(null);
  const [confirm, setConfirm] = useState<{ action: string; listing: Listing } | null>(null);
  const [createError, setCreateError] = useState("");

  useEffect(() => {
    if (token && typeof window !== "undefined") sessionStorage.setItem(TOKEN_KEY, token);
  }, [token]);

  const hasClientFilters = Boolean(search.trim() || category || geoPendingOnly);
  const limit = hasClientFilters ? 50 : pageSize;
  const page = Math.floor(offset / limit) + 1;
  const params = { status, geoPending: geoPendingOnly ? "true" : "", page: String(page), limit: String(limit) };
  const { data, isLoading } = useQuery({
    queryKey: ["provider-listings", params, Boolean(getAuthToken(token))],
    queryFn:  () => fetchListings(params, token),
  });

  const { data: fullSelectedQuery, isLoading: isLoadingFull } = useQuery({
    queryKey: ["provider-listing", selected?.id, Boolean(getAuthToken(token))],
    queryFn: () => withTokenRefresh(
      (tokenOverride) => listingApi.get(`/listings/${selected?.id}`, getAuthConfig(tokenOverride)).then(r => r.data.data ?? r.data),
      token
    ),
    enabled: !!selected?.id,
  });

  const { data: roomTypes, isLoading: isLoadingRoomTypes } = useQuery<HotelRoomType[]>({
    queryKey: ["provider-listing-room-types", selected?.id, Boolean(getAuthToken(token))],
    queryFn: () => withTokenRefresh(
      (tokenOverride) => listingApi.get(`/listings/${selected?.id}/room-types`, getAuthConfig(tokenOverride)).then(r => r.data.data ?? r.data),
      token
    ),
    enabled: !!selected?.id && selected?.category === "hotel",
  });

  const fullSelected = fullSelectedQuery || selected;

  const listings: Listing[] = data?.listings ?? [];
  const filteredListings = useMemo(() => {
    const q = search.trim().toLowerCase();
    return listings.filter((listing) => {
      const matchesCategory = !category || listing.category === category;
      const name = (getListingTitle(listing) || "").toLowerCase();
      const matchesSearch = !q || name.includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [category, listings, search]);
  const total: number = hasClientFilters ? filteredListings.length : data?.total ?? 0;
  const resetToFirstPage = (setter: (value: string) => void) => (value: string) => {
    setter(value);
    setOffset(0);
  };

  const actionMutation = useMutation({
    mutationFn: ({ action, id }: { action: string; id: string }) =>
      withTokenRefresh(
        (tokenOverride) => listingApi.post(`/listings/${id}/${action}`, undefined, getAuthConfig(tokenOverride)),
        token,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["provider-listings"] });
      qc.invalidateQueries({ queryKey: ["provider-dashboard"] });
      setConfirm(null);
      setSelected(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      withTokenRefresh(
        (tokenOverride) => listingApi.delete(`/listings/${id}`, getAuthConfig(tokenOverride)),
        token,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["provider-listings"] });
      setConfirm(null);
      setSelected(null);
    },
  });

  const createMutation = useMutation({
    mutationFn: (cat: ListingCategory) =>
      withTokenRefresh(
        (tokenOverride) =>
          listingApi.post("/listings", { category: cat }, getAuthConfig(tokenOverride)).then((r) => r.data),
        token,
      ),
    onSuccess: (data) => {
      const id = unwrapListingId(data);
      if (!id) {
        setCreateError("Listing was created, but the server did not return a listing id. Please refresh the listings page.");
        return;
      }
      qc.invalidateQueries({ queryKey: ["provider-listings"] });
      router.push(`/dashboard/listings/${id}/edit`);
    },
    onError: (err: any) => {
      if (err.message === "AUTH_REQUIRED") {
        setCreateError("Please sign in again.");
        router.replace("/auth/login");
        return;
      }
      setCreateError(err.response?.data?.error?.message ?? "Failed to create listing. Please try again.");
    },
  });

  const columns: Column<Listing>[] = [
    {
      key: "listing",
      label: "Listing",
      width: "300px",
      render: (l) => (
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 overflow-hidden">
            {getPhotoUrl(l.photos?.[0]) ? (
              <img src={getPhotoUrl(l.photos?.[0])} alt={getListingTitle(l)} className="w-full h-full object-cover" />
            ) : (
              <CategoryIcon category={l.category} />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900 truncate">{getListingTitle(l) || "(Untitled)"}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <CategoryIcon category={l.category} />
              <span className="text-xs text-slate-500 capitalize">{l.category}</span>
              {l.town && <span className="text-xs text-slate-400">· {l.town}</span>}
            </div>
          </div>
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (l) => (
        <div className="flex items-center gap-1.5">
          <Badge label={l.status} status={l.status} dot />
          {l.category === "apartment" && (l as any).temporaryActivation && (
            <span title={`Geo verification pending — due by ${formatDate((l as any).geoVerificationDueAt)}`}>
              <Clock className="h-3.5 w-3.5 text-amber-500" />
            </span>
          )}
        </div>
      ),
    },
    {
      key: "price",
      label: "Price",
      render: (l) => (
        <div>
          <p className="text-sm font-semibold text-slate-900">{formatListingPrice(l)}</p>
          <p className="text-[11px] text-slate-400">{l.category === "car" ? "per day" : "per night"}</p>
        </div>
      ),
    },
    {
      key: "rating",
      label: "Rating",
      render: (l) => (
        <span className="text-sm text-slate-600">
          {formatReviewRating(l)}
        </span>
      ),
    },
    {
      key: "updated",
      label: "Updated",
      render: (l) => <span className="text-xs text-slate-400">{formatDate(l.updatedAt)}</span>,
    },
    {
      key: "actions",
      label: "Actions",
      render: (l) => (
        <div className="flex items-center gap-1">
          <button
            onClick={() => setSelected(l)}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-surface-muted hover:text-slate-700 transition-all"
            title="View Details"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          {l.status !== "pending_review" && (
            <Link href={`/dashboard/listings/${getListingId(l)}/edit`}>
              <button
                disabled={!getListingId(l)}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-surface-muted hover:text-slate-700 transition-all"
                title="Edit Listing"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
            </Link>
          )}
          {canDelete(l.status) && (
            <button
              onClick={() => setConfirm({ action: "delete", listing: l })}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-danger-light hover:text-danger transition-all"
              title="Delete Draft"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          {canActivate(l) && (
            <button
              onClick={() => setConfirm({ action: "activate", listing: l })}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-success-light hover:text-success transition-all"
              title={getActivationLabel(l.status)}
            >
              <CheckCircle className="w-3.5 h-3.5" />
            </button>
          )}
          {canDeactivate(l.status) && (
            <button
              onClick={() => setConfirm({ action: "deactivate", listing: l })}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-warning-light hover:text-warning transition-all"
              title="Deactivate"
            >
              <XCircle className="w-3.5 h-3.5" />
            </button>
          )}
          {canSubmit(l) && (
            <button
              onClick={() => setConfirm({ action: "submit", listing: l })}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:bg-primary-50 hover:text-primary transition-all"
              title="Submit for review"
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ),
    },
  ];

  const isActing = actionMutation.isPending || deleteMutation.isPending;

  return (
    <div className="space-y-5 animate-fade-in">
      <SectionHeader
        title="My Listings"
        subtitle={`${total} listing${total !== 1 ? "s" : ""} in your portfolio`}
        action={
          <div className="flex gap-2">
            {(["hotel", "apartment", "car"] as ListingCategory[]).map((cat) => (
              <Button
                key={cat}
                variant="outline"
                size="sm"
                onClick={() => { setCreateError(""); createMutation.mutate(cat); }}
                loading={createMutation.isPending}
                icon={<Plus />}
              >
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </Button>
            ))}
          </div>
        }
      />

      {createError && (
        <div className="rounded-xl border border-danger/20 bg-danger-50 px-4 py-3 text-sm text-danger-dark">
          {createError}
        </div>
      )}

      <Card padding="none">
        <div className="p-4 border-b border-border">
          <FilterBar
            search={search}
            onSearch={resetToFirstPage(setSearch)}
            searchPlaceholder="Search listings…"
            filters={[
              {
                key: "status",
                value: status,
                onChange: resetToFirstPage(setStatus),
                placeholder: "All statuses",
                options: [
                  { value: "draft",          label: "Draft" },
                  { value: "pending_review", label: "Pending Review" },
                  { value: "approved",       label: "Approved" },
                  { value: "active",         label: "Active" },
                  { value: "deactivated",    label: "Deactivated" },
                  { value: "rejected",       label: "Rejected" },
                  { value: "suspended",      label: "Suspended" },
                ],
              },
              {
                key: "category",
                value: category,
                onChange: resetToFirstPage(setCategory),
                placeholder: "All categories",
                options: [
                  { value: "hotel",     label: "Hotel" },
                  { value: "apartment", label: "Apartment" },
                  { value: "car",       label: "Car" },
                ],
              },
            ]}
            actions={
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-500">Per page</label>
                <select
                  value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value)); setOffset(0); }}
                  className="h-10 rounded-xl border border-border bg-white px-3 text-sm text-slate-700 focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                >
                  {[5,10,15,20,25,30].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
            }
          />
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={geoPendingOnly}
              onChange={(e) => { setGeoPendingOnly(e.target.checked); setOffset(0); }}
              className="rounded border-slate-300 text-amber-500 focus:ring-amber-400"
            />
            Awaiting Geo-Verification
          </label>
        </div>

        <DataTable
          columns={columns}
          data={filteredListings}
          keyExtractor={(l) => getListingId(l)}
          loading={isLoading}
          emptyTitle="No listings yet"
          emptyMessage={hasClientFilters ? "No listings match the selected filters." : "Create your first listing using the buttons above."}
        />

        <Pagination
          total={total}
          limit={limit}
          offset={offset}
          onOffsetChange={setOffset}
        />
      </Card>

      {/* Detail Modal */}
      <ViewListingModal
        listing={fullSelected as Listing | null}
        isLoadingFull={isLoadingFull}
        roomTypes={roomTypes}
        isLoadingRoomTypes={isLoadingRoomTypes}
        onClose={() => setSelected(null)}
        onAction={(action, l) => {
          setSelected(null);
          setConfirm({ action, listing: l });
        }}
      />

      <ConfirmModal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={() => {
          if (!confirm) return;
          if (confirm.action === "delete") {
            deleteMutation.mutate(confirm.listing.id);
          } else {
            actionMutation.mutate({
              action: actionForStatus(confirm.action, confirm.listing.status),
              id: confirm.listing.id,
            });
          }
        }}
        title={
          confirm?.action === "delete"     ? "Delete listing?" :
          confirm?.action === "submit"     ? "Submit for review?" :
          confirm?.action === "activate"   ? getActivationTitle(confirm.listing.status) :
          "Deactivate listing?"
        }
        message={
          confirm?.action === "delete"
            ? `"${getListingTitle(confirm.listing) || "This draft"}" will be permanently deleted.`
            : confirm?.action === "submit"
            ? "Your listing will be sent to our team for review. This may take up to 48 hours."
            : confirm?.action === "activate"
            ? getActivationMessage(confirm.listing.status)
            : "This listing will be hidden from guests."
        }
        variant={confirm?.action === "delete" || confirm?.action === "deactivate" ? "danger" : "primary"}
        confirmLabel={
          confirm?.action === "delete"     ? "Delete" :
          confirm?.action === "submit"     ? "Submit" :
          confirm?.action === "activate"   ? getActivationLabel(confirm.listing.status) :
          "Deactivate"
        }
        loading={isActing}
      />
    </div>
  );
}

