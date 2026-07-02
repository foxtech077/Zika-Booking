"use client";
import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { listingApi } from "@/lib/listing-api";
import { useAuthStore } from "@/stores/auth";
import { useFavourites } from "@/hooks/useFavourites";
import { useLocation } from "@/hooks/useLocation";
import DestinationDropdown, { type DestinationSuggestion } from "./DestinationDropdown";
import dynamic from "next/dynamic";
import ListingCard from "./ListingCard";
import type { PublicListingDetail } from "@/types";
import { ActivityPromoBanner } from "./PromoBanner";
import { isPromotionValid, type ActivePromotion } from "../utils/promo-utils";
import { AMENITY_OPTIONS as CANONICAL_AMENITY_OPTIONS } from "@/app/(provider)/dashboard/listings/[id]/edit/_forms/shared/amenities";

/* ── lazy-loaded map ──────────────────────────────────────────── */
const MapView = dynamic(() => import("./MapView"), { ssr: false });

/* ── constants ───────────────────────────────────────────────── */
const PAGE_SIZE = 20;

const CATEGORY_META = {
  hotel: {
    label: "Hotels",
    plural: "hotels",
    title: "Hotels",
    subtitle: "Exceptional stays hand-picked for the discerning traveller.",
  },
  apartment: {
    label: "Apartments",
    plural: "apartments",
    title: "Apartments",
    subtitle: "Spacious apartments that feel like home, wherever you are.",
  },
  car: {
    label: "Cars",
    plural: "car rentals",
    title: "Car Rentals",
    subtitle: "Explore every destination with the perfect vehicle.",
  },
} as const;

const NAV_ITEMS: Array<{ label: string; category: "hotel" | "apartment" | "car" }> = [
  { label: "Hotels", category: "hotel" },
  { label: "Apartments", category: "apartment" },
  { label: "Cars", category: "car" },
];

const CAT_HREF: Record<"hotel" | "apartment" | "car", string> = {
  hotel: "/traveller/hotels",
  apartment: "/traveller/apartments",
  car: "/traveller/cars",
};

// Reuse the canonical amenity vocabulary providers select from when creating a listing
// (services/listing-service stores ListingAmenity.amenityKey using these exact values —
// the previous local list used keys like "gym"/"tv"/"washer" that never matched real data).
const AMENITY_OPTIONS = CANONICAL_AMENITY_OPTIONS.filter((o) =>
  ["wifi", "smart_tv", "kitchen", "pool", "fitness_centre", "ac", "parking", "laundry", "breakfast", "pet_friendly"].includes(o.value)
).map((o) => ({ key: o.value, label: o.label }));

const CAR_CATEGORIES = [
  "Economy", "Compact", "SUV", "Minivan", "Pickup", "Luxury", "Electric", "Convertible",
];

const SORT_OPTIONS = [
  { value: "recommended", label: "Recommended" },
  { value: "price_asc", label: "Price: Low to High" },
  { value: "price_desc", label: "Price: High to Low" },
  { value: "rating_desc", label: "Highest Rated" },
  { value: "distance_asc", label: "Distance" },
];

// The backend's `sort` enum only supports recommended/price_asc/price_desc/distance/newest
// (services/listing-service/src/routes/search.ts) — "Highest Rated" has no server-side
// equivalent and is applied client-side after fetch instead.
const SORT_MAP: Record<string, string> = {
  recommended: "recommended",
  price_asc: "price_asc",
  price_desc: "price_desc",
  distance_asc: "distance",
  rating_desc: "recommended",
};

/* ── helpers ─────────────────────────────────────────────────── */
function today() {
  return new Date().toISOString().slice(0, 10);
}

function mapListing(l: any): PublicListingDetail {
  const town = l.town || l.city || "";
  const country = l.country || l.countryCode || "";
  return {
    id: l.id,
    providerId: l.providerId,
    category: l.category || l.listingType,
    name: l.name || l.title,
    pricePerNight: Number(l.pricePerNight || l.nightlyRate || l.pricePerDay || l.dailyRate || 0),
    currency: l.currency || "KES",
    minStayNights: l.minStayNights || 1,
    checkinTime: l.checkinTime || "",
    checkoutTime: l.checkoutTime || "",
    cancellationPolicy: l.cancellationPolicy || "flexible",
    address: l.address || (town ? `${town}, ${country}` : ""),
    lat: l.lat || 0,
    lng: l.lng || 0,
    town,
    country,
    starRating: l.starRating,
    maxGuests: l.maxGuests,
    bedrooms: l.bedrooms,
    bathrooms: l.bathrooms,
    carMake: l.carMake,
    carModel: l.carModel,
    carYear: l.carYear,
    transmission: l.transmission,
    fuelType: l.fuelType,
    seats: l.seats,
    mileagePolicy: l.mileagePolicy,
    primaryPhotoUrl: l.primaryPhotoUrl || l.photos?.[0]?.cdnUrl || null,
    photos: l.photos || (l.primaryPhotoUrl ? [{ id: "ph", cdnUrl: l.primaryPhotoUrl, position: 1 }] : []),
    amenities: l.amenities || [],
    customAmenities: l.customAmenities || [],
    description: l.description || "",
    distanceKm: l.distanceKm ?? undefined,
    isFavourited: l.isFavourited ?? false,
    isAccredited: l.isAccredited ?? false,
    longStayDiscountEnabled: l.longStayDiscountEnabled ?? false,
    instantBooking: l.instantBooking ?? l.instant_booking ?? false,
  };
}

/* ── skeleton ────────────────────────────────────────────────── */
function SkeletonCard() {
  return (
    <div className="animate-pulse flex flex-col rounded-2xl overflow-hidden border border-slate-100 bg-white shadow-sm">
      <div className="aspect-[4/3] bg-slate-200 w-full" />
      <div className="p-4 space-y-2.5">
        <div className="h-2.5 bg-slate-200 rounded w-1/4" />
        <div className="h-4 bg-slate-200 rounded w-3/4" />
        <div className="h-3 bg-slate-200 rounded w-1/2" />
        <div className="border-t border-slate-100 pt-2.5 flex justify-between items-center">
          <div className="h-5 bg-slate-200 rounded w-24" />
          <div className="h-8 bg-slate-200 rounded-lg w-20" />
        </div>
      </div>
    </div>
  );
}

/* ── tiny Toggle ──────────────────────────────────────────────── */
function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`relative w-10 h-5 rounded-full transition-colors ${on ? "bg-[#0c2614]" : "bg-slate-200"}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${on ? "translate-x-5" : ""}`}
      />
    </button>
  );
}

/* ── checkbox chip ─────────────────────────────────────────────── */
function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
        active
          ? "bg-[#0c2614] text-white border-[#0c2614]"
          : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
      }`}
    >
      {children}
    </button>
  );
}

/* ── section label ─────────────────────────────────────────────── */
function FilterLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-xs font-semibold text-slate-700 mb-1.5">{children}</span>
  );
}

/* ── StyledDateInput ──────────────────────────────────────────── */
function StyledDateInput({
  label,
  value,
  onChange,
  min,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  min?: string;
}) {
  const display = value
    ? new Date(value + "T00:00:00").toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;
  return (
    <div>
      <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
        {label}
      </label>
      <div className="relative flex items-center bg-white border border-slate-200 rounded-xl px-3 py-2.5 gap-2 hover:border-slate-400 focus-within:border-[#1D8D2B] transition-colors cursor-pointer">
        <svg
          className="w-3.5 h-3.5 text-slate-400 shrink-0 pointer-events-none z-10"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        {!display && (
          <span className="absolute left-9 text-xs text-slate-400 pointer-events-none select-none">
            Add date
          </span>
        )}
        <input
          type="date"
          min={min}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`flex-1 bg-transparent border-none outline-none text-xs font-bold cursor-pointer min-w-0 ${
            display ? "text-slate-700" : "text-transparent"
          }`}
        />
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   FILTER PANEL — shared for sidebar + mobile drawer
══════════════════════════════════════════════════════════════ */
// NOTE: smoking/pets/instant-book/min-stay/fuel-type/airport-pickup/delivery-available
// filters were removed — the /search endpoint neither filters on nor returns those
// fields (services/listing-service/src/routes/search.ts), so the controls were dead
// weight that silently did nothing. See final report for backend follow-up.
interface FilterState {
  priceMax: number;
  rating: number | null;
  amenities: string[];
  cancellation: string;
  // apartments
  bedrooms: number | null;
  bathrooms: number | null;
  longStayDiscount: boolean;
  // cars
  carCategory: string;
  transmission: string;
  seats: number | null;
  minDriverAge: number | null;
}

const DEFAULT_FILTERS: FilterState = {
  priceMax: 500000,
  rating: null,
  amenities: [],
  cancellation: "",
  bedrooms: null,
  bathrooms: null,
  longStayDiscount: false,
  carCategory: "",
  transmission: "",
  seats: null,
  minDriverAge: null,
};

function countActiveFilters(f: FilterState) {
  let n = 0;
  if (f.priceMax < 500000) n++;
  if (f.rating) n++;
  if (f.amenities.length) n++;
  if (f.cancellation) n++;
  if (f.bedrooms) n++;
  if (f.bathrooms) n++;
  if (f.longStayDiscount) n++;
  if (f.carCategory) n++;
  if (f.transmission) n++;
  if (f.seats) n++;
  if (f.minDriverAge) n++;
  return n;
}

function FilterPanel({
  category,
  filters,
  onChange,
  onApply,
  onReset,
}: {
  category: "hotel" | "apartment" | "car";
  filters: FilterState;
  onChange: (patch: Partial<FilterState>) => void;
  onApply: () => void;
  onReset: () => void;
}) {
  const isCar = category === "car";
  const isApt = category === "apartment";

  return (
    <div className="space-y-6">
      {/* Price range */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <FilterLabel>Price Range</FilterLabel>
          <span className="text-xs font-semibold text-slate-500">
            {filters.priceMax >= 500000
              ? "KES 500+"
              : `KES ${filters.priceMax.toLocaleString()}`}
          </span>
        </div>
        <input
          type="range"
          min={500}
          max={50000}
          step={500}
          value={filters.priceMax >= 500000 ? 50000 : filters.priceMax}
          onChange={(e) => {
            const v = Number(e.target.value);
            onChange({ priceMax: v >= 50000 ? 500000 : v });
          }}
          className="w-full h-1.5 accent-[#1D8D2B] cursor-pointer"
        />
      </div>

      {/* Hotel / Apartment: Star Rating */}
      {!isCar && (
        <div className="space-y-2">
          <FilterLabel>Min. Rating</FilterLabel>
          <div className="flex gap-2">
            {[3, 4, 5].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onChange({ rating: s === filters.rating ? null : s })}
                className={`flex-1 py-2 border rounded-xl text-xs font-semibold transition ${
                  s === filters.rating
                    ? "bg-[#0c2614] text-white border-[#0c2614]"
                    : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
                }`}
              >
                ★ {s}+
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Apartment: Bedrooms & Bathrooms */}
      {isApt && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FilterLabel>Bedrooms</FilterLabel>
            <select
              value={filters.bedrooms ?? ""}
              onChange={(e) => onChange({ bedrooms: e.target.value ? Number(e.target.value) : null })}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 bg-white focus:outline-none focus:border-[#1D8D2B] transition"
            >
              <option value="">Any</option>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>{n}{n === 5 ? "+" : ""}</option>
              ))}
            </select>
          </div>
          <div>
            <FilterLabel>Bathrooms</FilterLabel>
            <select
              value={filters.bathrooms ?? ""}
              onChange={(e) => onChange({ bathrooms: e.target.value ? Number(e.target.value) : null })}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 bg-white focus:outline-none focus:border-[#1D8D2B] transition"
            >
              <option value="">Any</option>
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>{n}{n === 4 ? "+" : ""}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Hotel / Apartment: Amenities */}
      {!isCar && (
        <div className="space-y-2">
          <FilterLabel>Amenities</FilterLabel>
          <div className="flex flex-wrap gap-2">
            {AMENITY_OPTIONS.map(({ key, label }) => (
              <Chip
                key={key}
                active={filters.amenities.includes(key)}
                onClick={() =>
                  onChange({
                    amenities: filters.amenities.includes(key)
                      ? filters.amenities.filter((a) => a !== key)
                      : [...filters.amenities, key],
                  })
                }
              >
                {label}
              </Chip>
            ))}
          </div>
        </div>
      )}

      {/* Hotel / Apartment: Cancellation policy */}
      {!isCar && (
        <div className="space-y-2">
          <FilterLabel>Cancellation Policy</FilterLabel>
          <div className="flex flex-col gap-1.5">
            {[
              { value: "", label: "Any" },
              { value: "flexible", label: "Flexible" },
              { value: "moderate", label: "Moderate" },
              { value: "strict", label: "Strict" },
            ].map(({ value, label }) => (
              <label key={value} className="flex items-center gap-2.5 cursor-pointer py-0.5 group">
                <button
                  type="button"
                  onClick={() => onChange({ cancellation: value })}
                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition ${
                    filters.cancellation === value
                      ? "bg-[#0c2614] border-[#0c2614]"
                      : "border-slate-300 group-hover:border-[#1D8D2B]"
                  }`}
                >
                  {filters.cancellation === value && (
                    <span className="w-1.5 h-1.5 bg-white rounded-full" />
                  )}
                </button>
                <span className="text-sm text-slate-700">{label}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Car: Category */}
      {isCar && (
        <div className="space-y-2">
          <FilterLabel>Vehicle Category</FilterLabel>
          <div className="flex flex-wrap gap-2">
            {CAR_CATEGORIES.map((cat) => (
              <Chip
                key={cat}
                active={filters.carCategory === cat}
                onClick={() => onChange({ carCategory: filters.carCategory === cat ? "" : cat })}
              >
                {cat}
              </Chip>
            ))}
          </div>
        </div>
      )}

      {/* Car: Transmission */}
      {isCar && (
        <div className="space-y-2">
          <FilterLabel>Transmission</FilterLabel>
          <div className="flex gap-2">
            {["automatic", "manual"].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => onChange({ transmission: filters.transmission === t ? "" : t })}
                className={`flex-1 py-2 border rounded-xl text-xs font-semibold capitalize transition ${
                  filters.transmission === t
                    ? "bg-[#0c2614] text-white border-[#0c2614]"
                    : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Car: Seats */}
      {isCar && (
        <div className="space-y-2">
          <FilterLabel>Min. Seats</FilterLabel>
          <div className="flex gap-2">
            {[2, 4, 5, 7].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onChange({ seats: filters.seats === s ? null : s })}
                className={`flex-1 py-2 border rounded-xl text-xs font-semibold transition ${
                  filters.seats === s
                    ? "bg-[#0c2614] text-white border-[#0c2614]"
                    : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
                }`}
              >
                {s}+
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Car: Min Driver Age */}
      {isCar && (
        <div className="space-y-2">
          <FilterLabel>Min. Driver Age</FilterLabel>
          <select
            value={filters.minDriverAge ?? ""}
            onChange={(e) => onChange({ minDriverAge: e.target.value ? Number(e.target.value) : null })}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 bg-white focus:outline-none focus:border-[#1D8D2B] transition"
          >
            <option value="">Any</option>
            <option value="18">18+</option>
            <option value="21">21+</option>
            <option value="25">25+</option>
          </select>
        </div>
      )}

      {/* Apartment: Long-stay discount */}
      {isApt && (
        <div className="flex items-center justify-between py-1">
          <div>
            <p className="text-xs font-semibold text-slate-700">Long-stay Discount</p>
            <p className="text-[10px] text-slate-400">Monthly discount available</p>
          </div>
          <Toggle
            on={filters.longStayDiscount}
            onToggle={() => onChange({ longStayDiscount: !filters.longStayDiscount })}
          />
        </div>
      )}

      {/* Action buttons */}
      <button
        type="button"
        onClick={onApply}
        className="w-full py-3 bg-[#0c2614] text-white text-sm font-semibold rounded-xl hover:bg-[#1D8D2B] transition"
      >
        Apply Filters
      </button>
      <button
        type="button"
        onClick={onReset}
        className="w-full text-xs font-bold text-slate-400 hover:text-slate-700 transition"
      >
        Reset all filters
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════ */
interface Props {
  category: "hotel" | "apartment" | "car";
}

export default function CategoryListingsClient({ category }: Props) {
  const meta = CATEGORY_META[category];
  const isCar = category === "car";
  const router = useRouter();
  const sp = useSearchParams();
  const { user, clearSession, isAuthenticated } = useAuthStore();
  const { isFavourited, toggleFavourite } = useFavourites();
  // Detected via GET /location — anchors browsing (no typed destination) near the visitor.
  const detectedLocation = useLocation();
  const [showAuthModal, setShowAuthModal] = useState(false);

  /* ── search bar state (read initial values from URL) ──────── */
  const initialDestination = sp.get("q") || "";
  const [destination, setDestination] = useState(initialDestination);
  // Resolved coordinates for `destination` — only set once the visitor picks a
  // suggestion from the dropdown (see DestinationDropdown). The backend's /search
  // requires numeric lat/lng, so raw free text is never sent on its own.
  const [selectedDestination, setSelectedDestination] = useState<DestinationSuggestion | null>(null);
  const [destinationError, setDestinationError] = useState<string | null>(null);
  const [checkIn, setCheckIn] = useState(sp.get("checkin") || "");
  const [checkOut, setCheckOut] = useState(sp.get("checkout") || "");
  const [pickupDate, setPickupDate] = useState(sp.get("pickup") || "");
  const [returnDate, setReturnDate] = useState(sp.get("return") || "");
  const [guests, setGuests] = useState(Number(sp.get("guests") || 1));

  /* ── filter state (read initial values from URL) ──────────── */
  const [filters, setFilters] = useState<FilterState>({
    ...DEFAULT_FILTERS,
    priceMax: sp.get("price_max") ? Number(sp.get("price_max")) : 500000,
    rating: sp.get("rating") ? Number(sp.get("rating")) : null,
    amenities: sp.get("amenities") ? sp.get("amenities")!.split(",") : [],
    cancellation: sp.get("cancellation") || "",
    transmission: sp.get("transmission") || "",
    carCategory: sp.get("car_category") || "",
    seats: sp.get("seats") ? Number(sp.get("seats")) : null,
    minDriverAge: sp.get("min_age") ? Number(sp.get("min_age")) : null,
    bedrooms: sp.get("bedrooms") ? Number(sp.get("bedrooms")) : null,
    bathrooms: sp.get("bathrooms") ? Number(sp.get("bathrooms")) : null,
  });

  /* ── results state ────────────────────────────────────────── */
  const [listings, setListings] = useState<PublicListingDetail[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState(sp.get("sort") || "recommended");

  /* ── promotion state ──────────────────────────────────────── */
  const [promotion, setPromotion] = useState<{ label: string; colour: string } | null>(null);
  const [activePromo, setActivePromo] = useState<ActivePromotion | null>(null);

  /* ── UI state ─────────────────────────────────────────────── */
  const [showFiltersDrawer, setShowFiltersDrawer] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  /* ── refs ─────────────────────────────────────────────────── */
  const filterDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialFetch = useRef(false);

  /* ─────────────────────────────────────────────────────────── */
  /* URL sync                                                    */
  /* ─────────────────────────────────────────────────────────── */
  function buildUrl(extra: Record<string, string | number | null> = {}) {
    const params = new URLSearchParams();
    if (destination) params.set("q", destination);
    if (checkIn) params.set("checkin", checkIn);
    if (checkOut) params.set("checkout", checkOut);
    if (pickupDate) params.set("pickup", pickupDate);
    if (returnDate) params.set("return", returnDate);
    if (guests > 1) params.set("guests", String(guests));
    if (filters.priceMax < 500000) params.set("price_max", String(filters.priceMax));
    if (filters.rating) params.set("rating", String(filters.rating));
    if (filters.amenities.length) params.set("amenities", filters.amenities.join(","));
    if (filters.cancellation) params.set("cancellation", filters.cancellation);
    if (filters.transmission) params.set("transmission", filters.transmission);
    if (filters.carCategory) params.set("car_category", filters.carCategory);
    if (filters.seats) params.set("seats", String(filters.seats));
    if (filters.minDriverAge) params.set("min_age", String(filters.minDriverAge));
    if (filters.bedrooms) params.set("bedrooms", String(filters.bedrooms));
    if (filters.bathrooms) params.set("bathrooms", String(filters.bathrooms));
    if (sortBy !== "recommended") params.set("sort", sortBy);
    for (const [k, v] of Object.entries(extra)) {
      if (v !== null) params.set(k, String(v));
      else params.delete(k);
    }
    return `${CAT_HREF[category]}?${params.toString()}`;
  }

  /* ─────────────────────────────────────────────────────────── */
  /* Fetch listings                                              */
  /* ─────────────────────────────────────────────────────────── */
  async function fetchListings(newOffset: number, append: boolean, destOverride?: string) {
    if (newOffset === 0) {
      setLoading(true);
      setError(null);
      setListings([]); // Clear previous results immediately — never show stale data during a new search
    } else {
      setLoadingMore(true);
    }

    // Use destOverride when provided (e.g. Load More must stay scoped to the active query)
    const dest = typeof destOverride === "string" ? destOverride : destination.trim();

    // Coordinates only ever come from a resolved destination (dropdown selection or the
    // one-time URL resolve above) — never from re-geocoding raw text at fetch time.
    // When browsing (no text): anchor on the visitor's detected location (GET /location)
    // when available, so "nearest" sorting is meaningful; fall back to Nairobi otherwise.
    if (dest && (!selectedDestination || selectedDestination.displayName !== dest)) {
      setDestinationError("Please select a destination from the list.");
      setLoading(false);
      setLoadingMore(false);
      return;
    }
    const lat = dest ? selectedDestination!.lat : (detectedLocation.lat ?? -1.2921);
    const lng = dest ? selectedDestination!.lng : (detectedLocation.lng ?? 36.8219);
    const destCountryCode = dest ? selectedDestination!.countryCode : null;

    // Backend caps `limit` at 50 (services/listing-service/src/routes/search.ts) —
    // requesting more just gets silently truncated, so match it exactly.
    const effectiveLimit = dest ? 50 : PAGE_SIZE;

    const params: Record<string, any> = {
      category,
      limit: effectiveLimit,
      cursor: newOffset,
      lat,
      lng,
      // Use global radius for ALL text searches so results are not constrained by geography.
      // Browse (no text) uses global radius too for a full category inventory view.
      radius_km: 20000,
      sort: SORT_MAP[sortBy] ?? "recommended",
    };

    // Always pass the user's text as `q` — the backend has no text-matching param
    // (ignored server-side); actual relevance filtering happens client-side below.
    if (dest) {
      params.q = dest;
      params.name = dest;
    }

    // `guests` is accepted by the backend schema but never applied to the query —
    // the supported capacity filter is `max_guests_min` (hotel/apartment only).
    if (guests > 1 && !isCar) params.max_guests_min = guests;
    if (filters.priceMax < 500000) params.price_max = filters.priceMax;
    if (filters.amenities.length) params.amenity_ids = filters.amenities.join(",");
    if (filters.cancellation) params.cancellation_policy = filters.cancellation;

    if (!isCar) {
      if (checkIn) params.check_in = checkIn;
      if (checkOut) params.check_out = checkOut;
    }

    if (category === "apartment") {
      if (filters.bedrooms) params.bedrooms_min = filters.bedrooms;
      if (filters.longStayDiscount) params.long_stay_discount = true;
    }

    if (isCar) {
      if (pickupDate) params.pickup_datetime = pickupDate;
      if (returnDate) params.return_datetime = returnDate;
      if (filters.carCategory) params.car_category = filters.carCategory.toLowerCase();
      if (filters.transmission) params.transmission = filters.transmission;
      if (filters.seats) params.seats_min = filters.seats;
      if (filters.minDriverAge) params.driver_age = filters.minDriverAge;
    }

    try {
      const res = await listingApi.get<any>("/search", { params });
      const data = res.data?.data ?? {};
      const results: any[] = data.results ?? (Array.isArray(data) ? data : []);

      const mapped = results.map(mapListing);

      // Client-side text filter — the definitive gate that ensures ONLY matching listings
      // are rendered, regardless of what the geo-radius API returned.
      // Matches when either:
      //   - the listing's ISO country code equals the selected destination's country code
      //     (fixes country-name searches like "India" — Listing.country stores a 2-letter
      //     code, e.g. "IN", so a raw substring check against the word "India" never matches)
      //   - any of name/town/country/address/description (+ carMake/carModel for cars)
      //     contains the search term as a substring
      let displayListings = mapped;
      if (dest) {
        const term = dest.toLowerCase().trim();
        displayListings = mapped.filter((listing) => {
          if (destCountryCode && listing.country && listing.country.toUpperCase() === destCountryCode) return true;
          const fields: (string | undefined | null)[] = [
            listing.name,
            listing.town,
            listing.country,
            listing.address,
            listing.description,
          ];
          if (category === "car") {
            fields.push(listing.carMake, listing.carModel);
          }
          return fields.some((f) => f && String(f).toLowerCase().includes(term));
        });
      }

      // Client-side rating & bathroom filters — the backend accepts `rating_min` but
      // never applies it to the query, and has no bathroom filter at all. Both fields
      // ARE present on the /search response, so filter on them here instead.
      if (filters.rating) {
        displayListings = displayListings.filter((l) => (l.starRating ?? 0) >= filters.rating!);
      }
      if (category === "apartment" && filters.bathrooms) {
        displayListings = displayListings.filter((l) => (l.bathrooms ?? 0) >= filters.bathrooms!);
      }
      // Client-side rating sort — the backend's `sort` enum has no rating option.
      if (sortBy === "rating_desc") {
        displayListings = [...displayListings].sort((a, b) => (b.starRating ?? 0) - (a.starRating ?? 0));
      }

      // When a text search is active, report the filtered count as the total so the
      // heading and Load More logic reflect exactly what the user sees.
      const total = dest
        ? displayListings.length
        : (data.totalCount ?? data.availableCount ?? results.length + newOffset);
      setTotalCount(total);
      setListings((prev) => (append ? [...prev, ...displayListings] : displayListings));
      setOffset(newOffset);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? err?.message ?? "Failed to load listings.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  /* ─────────────────────────────────────────────────────────── */
  /* Fetch active promotion for badge                            */
  /* ─────────────────────────────────────────────────────────── */
  async function fetchPromotion() {
    try {
      const res = await listingApi.get<any>("/promotions/active", { params: { category } });
      console.log(`[ZikaSearch - CategoryListingsClient] Active promotions API response for category ${category}:`, res.data);
      if (res.data.success) {
        const raw = res.data.data ?? [];
        const promos: any[] = Array.isArray(raw) ? raw : (raw?.promotions ?? []);
        // Coerce discountValue to number — API may return it as a string
        const normalised = promos.map((p: any) => ({ ...p, discountValue: Number(p.discountValue) }));
        const matched = normalised.filter(
          (p: any) => p.activity === category && isPromotionValid(p)
        );
        console.log(`[Promotion] Active promotion loaded & matched for category ${category}:`, matched);
        console.log(`[ZikaSearch - CategoryListingsClient] Active promotion count received & matched for category ${category}:`, matched.length);
        if (matched.length > 0) {
          const p = matched[0];
          setActivePromo(p);
          const label =
            p.labelText ||
            (p.discountType === "percentage"
              ? `${p.discountValue}% OFF`
              : `KES ${p.discountValue} OFF`);
          setPromotion({ label, colour: p.labelColour || "#E31C5F" });
        } else {
          setActivePromo(null);
          setPromotion(null);
        }
      } else {
        setActivePromo(null);
        setPromotion(null);
      }
    } catch (e) {
      console.error(`[ZikaSearch - CategoryListingsClient] fetchPromotion error for category ${category}:`, e);
      setActivePromo(null);
      setPromotion(null);
    }
  }

  /* ─────────────────────────────────────────────────────────── */
  /* Initial load                                                */
  /* ─────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (initialFetch.current) return;
    initialFetch.current = true;
    fetchPromotion();
    if (!initialDestination) {
      fetchListings(0, false);
      return;
    }
    // A destination arrived via the URL (e.g. a shared link) — DestinationDropdown
    // only resolves coordinates when the visitor actively picks a suggestion, so
    // resolve this one exactly once here before the first fetch.
    let cancelled = false;
    fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(initialDestination)}&format=json&limit=1&addressdetails=1`,
      { headers: { "Accept-Language": "en", "User-Agent": "Kainook/1.0" } },
    )
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const r0 = Array.isArray(data) ? data[0] : null;
        if (r0) {
          const resolved: DestinationSuggestion = {
            displayName: r0.display_name,
            lat: parseFloat(r0.lat),
            lng: parseFloat(r0.lon),
            countryCode: r0.address?.country_code ? String(r0.address.country_code).toUpperCase() : null,
            city: r0.address?.city ?? r0.address?.town ?? r0.address?.village ?? null,
          };
          setSelectedDestination(resolved);
          fetchListings(0, false, resolved.displayName);
        } else {
          setDestinationError(`Could not find "${initialDestination}". Showing all ${meta.plural} instead.`);
          setDestination("");
          fetchListings(0, false, "");
        }
      })
      .catch(() => {
        setDestination("");
        fetchListings(0, false, "");
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reload promotions and listings when category prop changes
  useEffect(() => {
    if (!initialFetch.current) return;
    fetchListings(0, false);
    fetchPromotion();
  }, [category]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ─────────────────────────────────────────────────────────── */
  /* Filter debounce — auto-search when sort changes             */
  /* ─────────────────────────────────────────────────────────── */
  useEffect(() => {
    if (!initialFetch.current) return;
    if (filterDebounce.current) clearTimeout(filterDebounce.current);
    filterDebounce.current = setTimeout(() => {
      router.replace(buildUrl(), { scroll: false });
      fetchListings(0, false);
    }, 600);
    return () => { if (filterDebounce.current) clearTimeout(filterDebounce.current); };
  }, [sortBy]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ─────────────────────────────────────────────────────────── */
  /* Destination autocomplete — see DestinationDropdown           */
  /* ─────────────────────────────────────────────────────────── */
  function handleDestinationQueryChange(v: string) {
    setDestination(v);
    setDestinationError(null);
    // Typing invalidates any previously selected coordinates — they no longer
    // correspond to the text on screen.
    if (selectedDestination && selectedDestination.displayName !== v) {
      setSelectedDestination(null);
    }
  }

  function handleDestinationSelect(s: DestinationSuggestion) {
    setDestination(s.displayName);
    setSelectedDestination(s);
    setDestinationError(null);
  }

  /* ─────────────────────────────────────────────────────────── */
  /* Search submit                                               */
  /* ─────────────────────────────────────────────────────────── */
  function handleSearch(e?: React.FormEvent) {
    e?.preventDefault();
    const trimmed = destination.trim();
    // The backend requires numeric lat/lng — a destination must be picked from the
    // dropdown (which resolves coordinates) before a text search can run.
    if (trimmed && (!selectedDestination || selectedDestination.displayName !== trimmed)) {
      setDestinationError("Please select a destination from the list.");
      return;
    }
    router.replace(buildUrl(), { scroll: false });
    fetchListings(0, false, trimmed || undefined);
    setShowFiltersDrawer(false);
  }

  /* ─────────────────────────────────────────────────────────── */
  /* Clear search — remove active query and reload browse state  */
  /* ─────────────────────────────────────────────────────────── */
  function handleClearSearch() {
    setDestination("");
    setSelectedDestination(null);
    setDestinationError(null);
    router.replace(buildUrl(), { scroll: false });
    // Reload default category inventory (no text filter)
    fetchListings(0, false, "");
  }

  /* ─────────────────────────────────────────────────────────── */
  /* Filter apply / reset                                        */
  /* ─────────────────────────────────────────────────────────── */
  function handleApplyFilters() {
    router.replace(buildUrl(), { scroll: false });
    fetchListings(0, false);
    setShowFiltersDrawer(false);
  }

  function handleResetFilters() {
    setFilters(DEFAULT_FILTERS);
    router.replace(buildUrl(), { scroll: false });
    fetchListings(0, false);
    setShowFiltersDrawer(false);
  }

  /* ─────────────────────────────────────────────────────────── */
  /* Logout                                                      */
  /* ─────────────────────────────────────────────────────────── */
  function handleLogout() {
    clearSession();
    router.push("/auth/login");
  }

  /* ─────────────────────────────────────────────────────────── */
  /* Select listing → open in main traveller page               */
  /* ─────────────────────────────────────────────────────────── */
  function handleSelect(id: string) {
    router.push(`/traveller?listing=${id}`);
  }

  async function handleToggleFavourite(listingId: string) {
    if (!isAuthenticated) {
      setShowAuthModal(true);
      return;
    }
    await toggleFavourite(listingId);
  }

  const activeFilterCount = countActiveFilters(filters);
  const hasMore = listings.length > 0 && listings.length < totalCount;

  /* ══════════════════════════════════════════════════════════
     RENDER
  ══════════════════════════════════════════════════════════ */
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 font-sans antialiased">

      {/* ── HEADER ───────────────────────────────────────────── */}
      {/*
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-100 px-6 lg:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-8 lg:gap-10">
          <Link href="/traveller" className="text-xl font-bold text-[#0c2614] tracking-tight shrink-0">
            Kainook
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map(({ label, category: cat }) => (
              <Link
                key={cat}
                href={CAT_HREF[cat] as string}
                className={`relative px-4 py-2 text-sm font-medium tracking-wide transition-colors ${
                  cat === category
                    ? "text-[#0c2614] font-semibold"
                    : "text-slate-500 hover:text-[#0c2614]"
                }`}
              >
                {label}
                {cat === category && (
                  <span className="absolute bottom-0 left-4 right-4 h-0.5 bg-[#0c2614] rounded-full" />
                )}
              </Link>
            ))}
            {user && (
              <Link
                href="/traveller/wishlist"
                className="relative px-4 py-2 text-sm font-medium tracking-wide transition-colors text-slate-500 hover:text-[#0c2614] flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
                Wishlist
              </Link>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-3 lg:gap-4">
          {user ? (
            <div className="flex items-center gap-3">
              <button
                onClick={handleLogout}
                className="hidden sm:block text-sm font-medium text-slate-400 hover:text-red-500 transition"
              >
                Logout
              </button>
              <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-full py-1.5 px-3 shadow-sm">
                <div className="w-7 h-7 rounded-full bg-[#0c2614] text-white flex items-center justify-center font-bold uppercase text-xs">
                  {user.firstName[0]}
                </div>
                <div className="hidden sm:block">
                  <p className="text-xs font-semibold text-slate-800">{user.firstName}</p>
                  <p className="text-[10px] text-[#1D8D2B] font-bold uppercase tracking-widest">
                    {(user as any).currentTier || "Bronze"}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <>
              <Link
                href="/auth/login"
                className="hidden sm:block text-sm font-medium text-slate-500 hover:text-[#0c2614] transition"
              >
                Sign In
              </Link>
              <Link
                href="/auth/login"
                className="rounded-full bg-[#0c2614] hover:bg-[#1D8D2B] px-5 py-2 text-sm font-semibold text-white transition shadow-sm"
              >
                Sign Up
              </Link>
            </>
          )}
        </div>
      </header>
      */}

      {/* ── SEARCH BAR ───────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-100 shadow-sm">
        <form
          onSubmit={handleSearch}
          className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* Destination */}
            <div className="lg:col-span-2">
              <DestinationDropdown
                label={isCar ? "Pickup Location" : "Destination"}
                value={destination}
                onQueryChange={handleDestinationQueryChange}
                onSelect={handleDestinationSelect}
                placeholder={isCar ? "City, airport, address…" : "City, country or property…"}
                fieldClassName="relative flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 gap-2 hover:border-slate-400 focus-within:border-[#1D8D2B] transition-colors"
                inputClassName="flex-1 bg-transparent border-none outline-none text-xs font-medium text-slate-800 placeholder-slate-400 min-w-0"
                icon={
                  <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                }
                rightAdornment={
                  destination && (
                    <button
                      type="button"
                      onClick={handleClearSearch}
                      className="text-slate-300 hover:text-slate-500"
                      title="Clear search"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )
                }
              />
              {destinationError && (
                <p className="mt-1 text-[11px] font-medium text-red-500">{destinationError}</p>
              )}
            </div>

            {/* Dates */}
            {!isCar ? (
              <>
                <StyledDateInput label="Check-in" value={checkIn} onChange={setCheckIn} min={today()} />
                <StyledDateInput label="Check-out" value={checkOut} onChange={setCheckOut} min={checkIn || today()} />
              </>
            ) : (
              <>
                <StyledDateInput label="Pickup Date" value={pickupDate} onChange={setPickupDate} min={today()} />
                <StyledDateInput label="Return Date" value={returnDate} onChange={setReturnDate} min={pickupDate || today()} />
              </>
            )}

            {/* Guests / Search */}
            {!isCar ? (
              <div>
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Guests
                </label>
                <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 gap-2 hover:border-slate-400 transition-colors">
                  <svg className="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={guests}
                    onChange={(e) => setGuests(Math.max(1, Number(e.target.value)))}
                    className="flex-1 bg-transparent border-none outline-none text-xs font-medium text-slate-800 min-w-0 w-12"
                  />
                  <span className="text-xs text-slate-400 shrink-0">Guest{guests !== 1 ? "s" : ""}</span>
                </div>
              </div>
            ) : (
              <div className="flex items-end">
                <button
                  type="submit"
                  className="w-full py-[11px] bg-[#0c2614] hover:bg-[#1D8D2B] text-white text-sm font-bold rounded-xl transition shadow-sm"
                >
                  Search Cars
                </button>
              </div>
            )}
          </div>

          {!isCar && (
            <div className="flex justify-end mt-3">
              <button
                type="submit"
                className="px-8 py-2.5 bg-[#0c2614] hover:bg-[#1D8D2B] text-white text-sm font-bold rounded-xl transition shadow-sm"
              >
                Search {meta.label}
              </button>
            </div>
          )}
        </form>
      </div>

      {/* ── MAIN LAYOUT ──────────────────────────────────────── */}
      <div className="flex min-h-[calc(100vh-140px)]">

        {/* ── SIDEBAR (desktop) ──────────────────────────────── */}
        <aside className="hidden lg:flex flex-col w-72 xl:w-80 shrink-0 bg-white border-r border-slate-200 overflow-y-auto">
          <div className="p-6">
            <div className="flex items-center gap-2 mb-5">
              <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
              </svg>
              <h2 className="text-base font-bold text-slate-900">Refine Results</h2>
              {activeFilterCount > 0 && (
                <span className="ml-auto text-[10px] font-bold bg-[#0c2614] text-white rounded-full px-2 py-0.5">
                  {activeFilterCount}
                </span>
              )}
            </div>
            <FilterPanel
              category={category}
              filters={filters}
              onChange={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
              onApply={handleApplyFilters}
              onReset={handleResetFilters}
            />
          </div>
        </aside>

        {/* ── RIGHT: Results ────────────────────────────────── */}
        <div className="flex-1 min-w-0 flex flex-col">

          {/* Mobile toolbar: filter + sort */}
          <div className="lg:hidden flex items-center gap-2 px-4 pt-4 pb-2">
            <button
              type="button"
              onClick={() => setShowFiltersDrawer(true)}
              className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-700 shadow-sm hover:border-slate-400 transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
              </svg>
              Filters
              {activeFilterCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-[#E31C5F] text-white text-[9px] font-bold flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-700 focus:outline-none shadow-sm"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Results header bar */}
          <div className="px-6 lg:px-8 pt-5 pb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                {loading
                  ? "Loading…"
                  : `${totalCount > 0 ? totalCount.toLocaleString() : listings.length} ${meta.label} Found`}
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                {destination
                  ? `${meta.label} in ${destination.split(",")[0]}`
                  : `Browse ${meta.plural} worldwide`}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {/* Map toggle */}
              <button
                type="button"
                onClick={() => setShowMap((v) => !v)}
                className={`hidden lg:flex items-center gap-2 px-4 py-2 rounded-xl border text-xs font-semibold transition ${
                  showMap
                    ? "bg-[#0c2614] text-white border-[#0c2614]"
                    : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
                {showMap ? "Hide Map" : "Show Map"}
              </button>

              {/* Desktop sort */}
              <div className="hidden lg:flex items-center gap-2">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Sort:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 focus:outline-none shadow-sm"
                >
                  {SORT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Promotion banner */}
          {activePromo && activePromo.activity === category && isPromotionValid(activePromo) && !loading && (
            <div className="mx-6 lg:mx-8 mb-6">
              <ActivityPromoBanner activePromotion={activePromo} />
            </div>
          )}

          {/* Error */}
          {error && !loading && (
            <div className="mx-6 lg:mx-8 mb-4 bg-red-50 border border-red-200 rounded-xl p-4 flex items-center justify-between text-red-700 text-sm font-medium">
              <span>{error}</span>
              <button
                type="button"
                onClick={() => fetchListings(0, false)}
                className="ml-4 underline hover:no-underline shrink-0"
              >
                Retry
              </button>
            </div>
          )}

          {/* Map + grid layout */}
          <div className={`flex-1 flex ${showMap ? "gap-0" : ""}`}>

            {/* Map panel */}
            {showMap && (
              <div className="hidden lg:block w-[45%] h-[calc(100vh-210px)] sticky top-[140px] overflow-hidden border-r border-slate-200">
                <MapView
                  listings={listings}
                  hoveredId={hoveredId}
                  onHover={setHoveredId}
                  onSelect={handleSelect}
                  searchDestination={destination}
                />
              </div>
            )}

            {/* Listings grid */}
            <div className={`flex-1 px-6 lg:px-8 pb-10 ${showMap ? "overflow-y-auto" : ""}`}>
              {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                  {Array.from({ length: 12 }).map((_, i) => <SkeletonCard key={i} />)}
                </div>
              ) : listings.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center bg-white border border-slate-100 rounded-3xl shadow-sm">
                  <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-5 text-3xl">🔍</div>
                  <h3 className="text-lg font-bold text-slate-900 mb-1">
                    {destination.trim()
                      ? `No results found for "${destination.trim()}"`
                      : `No ${meta.plural} found`}
                  </h3>
                  <p className="text-slate-500 text-sm max-w-xs leading-relaxed">
                    {destination.trim()
                      ? "No listings match your search. Try a different location or property name."
                      : "Try adjusting your filters, changing dates, or searching a broader location."}
                  </p>
                  {activeFilterCount > 0 && (
                    <button
                      type="button"
                      onClick={handleResetFilters}
                      className="mt-5 px-6 py-2.5 bg-[#0c2614] text-white text-xs font-bold rounded-xl uppercase tracking-wider hover:bg-[#1D8D2B] transition"
                    >
                      Clear All Filters
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <div
                    className={`grid gap-5 ${
                      showMap
                        ? "grid-cols-1 sm:grid-cols-2"
                        : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                    }`}
                  >
                    {listings.map((listing) => (
                      <ListingCard
                        key={listing.id}
                        listing={listing}
                        onSelect={handleSelect}
                        hoveredId={hoveredId}
                        onHover={setHoveredId}
                        variant="compact"
                        promotionBadge={promotion ?? undefined}
                        activePromotion={activePromo}
                        isFavourited={isFavourited(listing.id)}
                        onToggleFavourite={handleToggleFavourite}
                      />
                    ))}
                  </div>

                  {/* Load More — always scoped to the active search query */}
                  {hasMore && (
                    <div className="text-center mt-10">
                      <button
                        type="button"
                        onClick={() => fetchListings(offset + (destination.trim() ? 50 : PAGE_SIZE), true, destination.trim() || undefined)}
                        disabled={loadingMore}
                        className="inline-flex items-center gap-2 px-8 py-3 border border-[#0c2614] text-[#0c2614] font-semibold text-sm rounded-full hover:bg-[#0c2614] hover:text-white transition disabled:opacity-50"
                      >
                        {loadingMore ? (
                          <>
                            <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            Loading…
                          </>
                        ) : (
                          <>
                            Load More {meta.label}
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                          </>
                        )}
                      </button>
                      <p className="text-xs text-slate-400 mt-2">
                        Showing {listings.length} of {totalCount.toLocaleString()}
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── MOBILE FILTER DRAWER ─────────────────────────────── */}
      {showFiltersDrawer && (
        <div className="fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowFiltersDrawer(false)}
          />
          {/* Drawer */}
          <div className="relative ml-auto w-full max-w-sm bg-white h-full overflow-y-auto shadow-2xl flex flex-col">
            {/* Drawer header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 sticky top-0 bg-white z-10">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-slate-900">Filters</h2>
                {activeFilterCount > 0 && (
                  <span className="text-[10px] font-bold bg-[#0c2614] text-white rounded-full px-2 py-0.5">
                    {activeFilterCount} active
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowFiltersDrawer(false)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center hover:bg-slate-200 transition"
              >
                <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-5 flex-1">
              <FilterPanel
                category={category}
                filters={filters}
                onChange={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
                onApply={handleApplyFilters}
                onReset={handleResetFilters}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Auth required modal — shown when guest clicks heart without login ── */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl space-y-4 text-center">
            <div className="w-14 h-14 bg-rose-100 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-7 h-7 text-rose-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-slate-800">Sign in to save to wishlist</h2>
            <p className="text-slate-500 text-sm leading-relaxed">
              Create an account or sign in to save listings and access your wishlist from any device.
            </p>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setShowAuthModal(false)}
                className="flex-1 py-2.5 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition text-sm"
              >
                Cancel
              </button>
              <Link
                href="/auth/login"
                className="flex-1 py-2.5 bg-[#0c2614] text-white font-bold rounded-xl hover:bg-[#1D8D2B] transition text-sm text-center"
              >
                Sign In
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
