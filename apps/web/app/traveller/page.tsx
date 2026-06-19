"use client";
import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";           // auth-service: POST /auth/logout only
import { listingApi } from "@/lib/listing-api";
import { paymentApi } from "@/lib/payment-api";
import ListingImage from "./components/ListingImage";
import { useAuthStore } from "@/stores/auth";
import ListingCard from "./components/ListingCard";
import PhotoGallery from "./components/PhotoGallery";
import ReservationCard from "./components/ReservationCard";
import MapView from "./components/MapView";
import type { PublicListingDetail } from "@/types";

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  userType: string;
  currentTier: "bronze" | "silver" | "gold" | "diamond";
  loyaltyPoints: number;
}

interface Booking {
  id: string;
  reference: string;
  status: string;
  listingId: string;
  listingTitle: string;
  listingCategory: string;
  checkIn?: string | null;
  checkOut?: string | null;
  pickupDatetime?: string | null;
  returnDatetime?: string | null;
  totalAmount: number;
  currency: string;
  nightsOrDays: number;
  primaryPhotoUrl?: string | null;
  guestFirstName: string;
  guestLastName: string;
  guestEmail: string;
  createdAt: string;
  canCancel: boolean;
}


// Countries where Tara Mobile Money is the recommended payment method
const AFRICAN_COUNTRIES = new Set([
  "Kenya", "Nigeria", "Ghana", "Tanzania", "Uganda", "South Africa", "Rwanda",
  "Ethiopia", "Zambia", "Zimbabwe", "Cameroon", "Ivory Coast", "Senegal",
  "Mali", "Burkina Faso", "Niger", "Chad", "Somalia", "Sudan", "Egypt",
  "Morocco", "Algeria", "Tunisia", "Libya", "Angola", "Mozambique",
  "Madagascar", "Malawi", "Botswana", "Namibia", "Lesotho", "Eswatini",
  "Mauritius", "Seychelles", "Burundi", "Djibouti", "Eritrea", "Gabon",
  "Guinea", "Liberia", "Sierra Leone", "Gambia", "Cape Verde",
]);

// Tax rates by country (VAT %)
const TAX_RATES: Record<string, number> = {
  Kenya: 0.16, Nigeria: 0.075, Ghana: 0.125, Tanzania: 0.18,
  Uganda: 0.18, "South Africa": 0.15, Rwanda: 0.18, Ethiopia: 0.15,
  Zambia: 0.16, Zimbabwe: 0.15, Egypt: 0.14,
};

const AMENITY_LABELS: Record<string, string> = {
  wifi: "High-Speed Wi-Fi",
  pool: "Infinity Swimming Pool",
  ac: "Air Conditioning",
  kitchen: "Professional Chef Kitchen",
  gym: "State-of-the-art Gym",
  parking: "Complimentary Valet Parking",
  tv: "Smart UHD TV",
  washer: "In-unit Washer & Dryer",
  fireplace: "Cosy Wood Fireplace"
};

// No mock data — listings are fetched live from the backend API

const POPULAR_DESTINATIONS = [
  { name: "Nairobi", country: "Kenya", icon: "🏙️", from: "from-emerald-500", to: "to-teal-700" },
  { name: "Mombasa", country: "Kenya", icon: "🏖️", from: "from-green-400", to: "to-teal-600" },
  { name: "Dubai", country: "UAE", icon: "🌇", from: "from-amber-400", to: "to-orange-600" },
  { name: "Cape Town", country: "South Africa", icon: "🏔️", from: "from-slate-500", to: "to-slate-800" },
  { name: "Zanzibar", country: "Tanzania", icon: "🌴", from: "from-teal-400", to: "to-emerald-700" },
  { name: "Kampala", country: "Uganda", icon: "🦁", from: "from-yellow-400", to: "to-amber-700" },
] as const;

// ── Styled date input — universally compatible, zero dependencies ──
// Uses the REAL <input type="date"> (always clickable, always opens native picker).
// When empty: text is transparent so browser's "dd-mm-yyyy" is invisible;
//             our "Add date" span acts as the placeholder instead.
// When filled: text is normal and shows the formatted date.
// Works in IE11, old iOS Safari, Firefox, Chrome — all browsers.
function StyledDateInput({
  label, value, onChange, min, required: isRequired,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  min?: string;
  required?: boolean;
}) {
  const display = value
    ? new Date(value + "T00:00:00").toLocaleDateString("en-GB", {
      day: "numeric", month: "short", year: "numeric",
    })
    : null;

  return (
    <div>
      <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
        {label}
      </label>
      <div className="relative flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 gap-2 hover:border-slate-400 focus-within:border-[#0B1E3F] transition-colors cursor-pointer">
        {/* Calendar icon — pointer-events-none so input behind receives the click */}
        <svg className="w-3.5 h-3.5 text-slate-400 shrink-0 pointer-events-none z-10" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        {/* "Add date" placeholder — shown only when empty */}
        {!display && (
          <span className="absolute left-9 text-xs text-slate-400 pointer-events-none select-none">
            Add date
          </span>
        )}
        {/* Real date input — date-empty class hides Chrome's "dd-mm-yyyy" via CSS pseudo-elements */}
        <input
          type="date"
          required={isRequired}
          min={min}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`date-styled flex-1 bg-transparent border-none outline-none text-xs font-bold cursor-pointer min-w-0 ${display ? "text-slate-700" : "date-empty text-transparent"
            }`}
        />
      </div>
    </div>
  );
}

export default function TravellerDashboard() {
  const router = useRouter();
  const getTodayString = () => new Date().toISOString().slice(0, 10);

  // Auth — read directly from Zustand store (populated by login page, no API call needed)
  const { user, isAuthenticated, _hasHydrated, clearSession, updateUser } = useAuthStore();
  const hasAuthToken = isAuthenticated;
  const ready = _hasHydrated;

  const [recentlyViewed, setRecentlyViewed] = useState<PublicListingDetail[]>([]);
  const [activeTab, setActiveTab] = useState<"home" | "search" | "bookings">("home");

  // Search Context
  const [searchCategory, setSearchCategory] = useState<"hotel" | "apartment" | "car">("hotel");
  const [searchDestination, setSearchDestination] = useState<string>("");
  const [searchCheckIn, setSearchCheckIn] = useState<string>("");
  const [searchCheckOut, setSearchCheckOut] = useState<string>("");
  const [searchPickupDate, setSearchPickupDate] = useState<string>("");
  const [searchReturnDate, setSearchReturnDate] = useState<string>("");
  const [searchAdults, setSearchAdults] = useState(1);
  const [searchChildren, setSearchChildren] = useState(0);
  const [searchRooms, setSearchRooms] = useState(1);
  const [showGuestPicker, setShowGuestPicker] = useState(false);
  const [searching, setSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [apiSuggestions, setApiSuggestions] = useState<string[]>([]);
  const [nominatimResults, setNominatimResults] = useState<Array<{ display_name: string; lat: string; lon: string }>>([]);
  const nominatimTimer = useRef<NodeJS.Timeout | null>(null);

  // Filters state — prices are in KES (Kenyan Shillings)
  // Default 0 / 500000 = "no filter" — only pass to API when user changes
  const [priceMin, setPriceMin] = useState<number>(0);
  const [priceMax, setPriceMax] = useState<number>(500000);
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [selectedCancellation, setSelectedCancellation] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("distance_asc");
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([]);
  const [showInstantOnly, setShowInstantOnly] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Search Results + pagination
  const [listings, setListings] = useState<PublicListingDetail[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [searchOffset, setSearchOffset] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [mapHoveredId, setMapHoveredId] = useState<string | null>(null);

  // Details & Checkout context
  const [selectedListingId, setSelectedListingId] = useState<string | null>(null);
  const [detailListing, setDetailListing] = useState<PublicListingDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const [lockToken, setLockToken] = useState<string>("");
  const [lockingListing, setLockingListing] = useState(false);

  // Availability check state
  const [availabilityStatus, setAvailabilityStatus] = useState<"checking" | "available" | "unavailable" | null>(null);

  // Voucher state
  const [voucherCode, setVoucherCode] = useState<string>("");
  const [voucherDiscount, setVoucherDiscount] = useState<number>(0);
  const [voucherApplied, setVoucherApplied] = useState<boolean>(false);
  const [voucherError, setVoucherError] = useState<string>("");

  // Checkout inputs
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [specialRequests, setSpecialRequests] = useState("");
  const [driverAge, setDriverAge] = useState<number>(25);
  const [driverFirstName, setDriverFirstName] = useState("");
  const [driverLastName, setDriverLastName] = useState("");
  const [deliveryRequested, setDeliveryRequested] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [protectionPlan, setProtectionPlan] = useState<"standard" | "gold" | "platinum">("standard");
  const [bookingError, setBookingError] = useState<string>("");
  const [submittingCheckout, setSubmittingCheckout] = useState(false);

  // Payment flow state
  const [paymentProvider, setPaymentProvider] = useState<"stripe" | "tara">("stripe");
  const [mobileNumber, setMobileNumber] = useState("");
  const [checkoutStep, setCheckoutStep] = useState<"review" | "details" | "stripe_card" | "polling">("review");
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [stripeClientSecret, setStripeClientSecret] = useState("");
  const [stripeInstance, setStripeInstance] = useState<any>(null);
  const [stripeCardElement, setStripeCardElement] = useState<any>(null);
  const stripeCardRef = useRef<HTMLDivElement>(null);
  const paymentPollRef = useRef<NodeJS.Timeout | null>(null);
  const [pendingBookingRef, setPendingBookingRef] = useState("");
  const [pendingBookingAmount, setPendingBookingAmount] = useState(0);

  // Inline pending bookings (shown when TOO_MANY_PENDING error appears)
  const [inlinePending, setInlinePending] = useState<Booking[]>([]);
  const [loadingInlinePending, setLoadingInlinePending] = useState(false);
  const [inlineCancellingId, setInlineCancellingId] = useState<string | null>(null);

  // Saved payment methods
  interface SavedPaymentMethod {
    id: string;
    type: string;
    paymentProvider: "stripe" | "tara";
    cardBrand: string | null;
    cardLast4: string | null;
    cardExpMonth: number | null;
    cardExpYear: number | null;
    mobileNumberMasked: string | null;
    isDefault: boolean;
  }
  const [savedMethods, setSavedMethods] = useState<SavedPaymentMethod[]>([]);
  const [selectedMethodId, setSelectedMethodId] = useState<string | null>(null);
  const [loadingMethods, setLoadingMethods] = useState(false);

  // Kainook Rewards custom modal state
  const [showRewardsModal, setShowRewardsModal] = useState(false);

  // Pre-fill checkout form from store user (no API call needed)
  useEffect(() => {
    if (user) {
      setFirstName(user.firstName || "");
      setLastName(user.lastName || "");
      setEmail(user.email || "");
    }
  }, [user?.id]);

  // Success state
  const [bookingSuccessModal, setBookingSuccessModal] = useState<{
    reference: string;
    amount: number;
    currency: string;
    pointsAwarded: number;
  } | null>(null);


  // Featured listings on home tab
  const [featuredListings, setFeaturedListings] = useState<PublicListingDetail[]>([]);
  const [featuredCategory, setFeaturedCategory] = useState<"hotel" | "apartment" | "car">("hotel");
  const [loadingFeatured, setLoadingFeatured] = useState(false);
  const featuredLoadedRef = useRef(false);

  // Quick-result dropdown when user taps Hotels / Apartments / Car Rentals in hero form
  const [quickResults, setQuickResults] = useState<PublicListingDetail[]>([]);
  const [showQuickDrop, setShowQuickDrop] = useState(false);
  const [loadingQuickDrop, setLoadingQuickDrop] = useState(false);

  // Review form state (My Bookings → Leave Review for completed bookings)
  const [reviewingBookingId, setReviewingBookingId] = useState<string | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState("");
  const [reviewBody, setReviewBody] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewedBookingIds, setReviewedBookingIds] = useState<string[]>([]);

  // My Bookings history context
  const [bookingsList, setBookingsList] = useState<Booking[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [reservationStatusFilter, setReservationStatusFilter] = useState<string>("all");

  // Mobile UI state
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [showFiltersDrawer, setShowFiltersDrawer] = useState(false);

  // Timer Ref for lock countdown
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  // Derived guest count
  const searchGuests = searchAdults + searchChildren;

  // 1. Redirect provider accounts away from traveller page
  useEffect(() => {
    if (!_hasHydrated) return;
    if (user && user.userType === "provider") {
      router.replace("/dashboard");
    }
  }, [_hasHydrated, user?.userType]);

  // Load Recently Viewed from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      // Clear legacy dummy data from local storage
      localStorage.removeItem("zika:recently_viewed");
      setRecentlyViewed([]);
    }
  }, []);


  function mapSearchResult(l: any): PublicListingDetail {
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

  async function loadFeaturedListings(cat: "hotel" | "apartment" | "car") {
    setLoadingFeatured(true);
    setFeaturedCategory(cat);
    try {
      const res = await listingApi.get<any>("/search", {
        params: { category: cat, limit: 8, lat: -1.2921, lng: 36.8219, radius_km: 5000 },
      });
      const data = res.data?.data ?? {};
      const results: any[] = data.results ?? (Array.isArray(data) ? data : []);
      setFeaturedListings(results.map(mapSearchResult));
    } catch {
      setFeaturedListings([]);
    } finally {
      setLoadingFeatured(false);
    }
  }

  // Fetch a small preview list for the hero category dropdown
  async function loadQuickResults(cat: "hotel" | "apartment" | "car") {
    setLoadingQuickDrop(true);
    setShowQuickDrop(true);
    setQuickResults([]);
    try {
      const q = searchDestination.trim() || "Nairobi, Kenya";
      let lat = -1.2921, lng = 36.8219;
      const lower = q.toLowerCase();
      if (lower.includes("mombasa")) { lat = -3.982; lng = 39.726; }
      else if (lower.includes("dubai")) { lat = 25.2048; lng = 55.2708; }
      else if (lower.includes("cape town")) { lat = -33.9249; lng = 18.4241; }
      else if (!lower.includes("nairobi") && !lower.includes("kenya")) {
        try {
          const r = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`,
            { headers: { "Accept-Language": "en", "User-Agent": "Kainook/1.0" } }
          );
          const d = await r.json();
          if (d?.[0]) { lat = parseFloat(d[0].lat); lng = parseFloat(d[0].lon); }
        } catch { /* use defaults */ }
      }
      const res = await listingApi.get<any>("/search", {
        params: { category: cat, limit: 8, lat, lng, radius_km: 5000 },
      });
      const data = res.data?.data ?? {};
      const results: any[] = data.results ?? (Array.isArray(data) ? data : []);
      setQuickResults(results.map(mapSearchResult));
    } catch {
      setQuickResults([]);
    } finally {
      setLoadingQuickDrop(false);
    }
  }

  // Load featured hotel listings once when home tab is first shown
  useEffect(() => {
    if (activeTab === "home" && !featuredLoadedRef.current) {
      featuredLoadedRef.current = true;
      loadFeaturedListings("hotel");
    }
  }, [activeTab]);

  function addToRecentlyViewed(item: PublicListingDetail) {
    setRecentlyViewed((prev) => {
      const filtered = prev.filter((x) => x.id !== item.id);
      const updated = [item, ...filtered].slice(0, 4);
      if (typeof window !== "undefined") {
        localStorage.setItem("zika:recently_viewed", JSON.stringify(updated));
      }
      return updated;
    });
  }

  // 2. Lock Countdown Handler
  useEffect(() => {
    if (secondsLeft !== null && secondsLeft > 0) {
      timerRef.current = setTimeout(() => {
        setSecondsLeft(secondsLeft - 1);
      }, 1000);
    } else if (secondsLeft === 0) {
      // Release lock explicitly
      abandonLock();
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [secondsLeft]);

  // Mount Stripe card element when checkout moves to stripe_card step
  useEffect(() => {
    if (checkoutStep !== "stripe_card" || !stripeInstance || !stripeCardRef.current) return;
    const elements = stripeInstance.elements();
    const card = elements.create("card", {
      style: { base: { fontSize: "14px", color: "#1e293b", fontFamily: "inherit", "::placeholder": { color: "#94a3b8" } } },
    });
    card.mount(stripeCardRef.current);
    setStripeCardElement(card);
    return () => { try { card.destroy(); } catch { /* already destroyed */ } };
  }, [checkoutStep, stripeInstance]);

  // Auto-select payment method based on listing country (Africa → Tara, Others → Stripe)
  useEffect(() => {
    if (!detailListing) return;
    const country = detailListing.country || detailListing.town || "";
    setPaymentProvider(AFRICAN_COUNTRIES.has(country) ? "tara" : "stripe");
  }, [detailListing?.id]);

  // Clean up payment poll on unmount
  useEffect(() => {
    return () => { if (paymentPollRef.current) clearInterval(paymentPollRef.current); };
  }, []);

  // Filter Debounce Handler — re-fetch whenever any filter or sort changes while on the search tab
  useEffect(() => {
    if (activeTab !== "search" || listings.length === 0) return;
    const handler = setTimeout(() => { handleSearch(); }, 600);
    return () => clearTimeout(handler);
  }, [priceMin, priceMax, selectedRating, selectedCancellation, sortBy, showInstantOnly, selectedAmenities, activeTab]);

  // Autocomplete suggestions — populated from search results after a successful search (no extra API call)
  useEffect(() => {
    if (listings.length === 0) return;
    const uniqueSet = new Set<string>();
    listings.forEach((l) => {
      if (l.town) uniqueSet.add(`${l.town}, ${l.country}`);
      if (l.name) uniqueSet.add(l.name);
    });
    setApiSuggestions(Array.from(uniqueSet).filter(Boolean));
  }, [listings]);

  // 3. Search action calling backend list search endpoint `/search`
  async function handleSearch(e?: React.FormEvent, overrideCategory?: "hotel" | "apartment" | "car", destinationOverride?: string) {
    if (e) e.preventDefault();

    const activeCategory = overrideCategory || searchCategory;

    // Manual form submit requires a destination.
    // Programmatic calls (tab / nav clicks, where e is undefined) use a default location.
    if (e && !searchDestination.trim()) {
      alert("Please enter a destination to search.");
      return;
    }

    const todayStr = getTodayString();
    if (activeCategory !== "car") {
      if (searchCheckIn && searchCheckIn < todayStr) {
        alert("Check-in date cannot be in the past.");
        return;
      }
      if (searchCheckIn && searchCheckOut && searchCheckOut < searchCheckIn) {
        alert("Check-out date must be after your check-in date.");
        return;
      }
    } else {
      if (searchPickupDate && searchPickupDate < todayStr) {
        alert("Pickup date cannot be in the past.");
        return;
      }
      if (searchPickupDate && searchReturnDate && searchReturnDate < searchPickupDate) {
        alert("Return date must be after your pickup date.");
        return;
      }
    }

    setSearching(true);
    setSearchError(null);
    setShowQuickDrop(false);
    setActiveTab("search");

    // Priority: explicit override (popular destination click) → user input → default
    const queryText = destinationOverride?.trim() || searchDestination.trim() || "Nairobi, Kenya";

    try {
      // Geocode destination → lat/lng via Nominatim (free, no API key)
      let lat: number | undefined;
      let lng: number | undefined;

      const destinationLower = queryText.toLowerCase();

      // Fast-path for common cities — avoids a network round-trip
      if (destinationLower.includes("mombasa")) {
        lat = -3.9820; lng = 39.7260;
      } else if (destinationLower.includes("nairobi") || destinationLower.includes("kenya")) {
        lat = -1.2921; lng = 36.8219;
      } else if (destinationLower.includes("paris")) {
        lat = 48.8566; lng = 2.3522;
      }

      if (queryText && lat === undefined) {
        try {
          const geoRes = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(queryText)}&format=json&limit=1`,
            { headers: { "Accept-Language": "en", "User-Agent": "Kainook/1.0" } }
          );
          const geoData = await geoRes.json();
          if (geoData && geoData.length > 0) {
            lat = parseFloat(geoData[0].lat);
            lng = parseFloat(geoData[0].lon);
          }
        } catch {
          // Geocoding failed — fall through to default coords
        }
      }

      // Final fallback — always send valid coords to the backend
      if (lat === undefined || lng === undefined || isNaN(lat) || isNaN(lng)) {
        lat = -1.2921;
        lng = 36.8219;
      }

      // Step 2: Build search params
      const params: Record<string, any> = {
        category: activeCategory,
        limit: 20,
        offset: 0,
        lat,
        lng,
        radius_km: 5000,
        sort: sortBy || "distance_asc",
      };

      if (searchGuests > 1) params.guests = searchGuests;
      if (searchRooms > 1) params.rooms = searchRooms;
      if (priceMin > 0) params.price_min = priceMin;
      if (priceMax < 499999) params.price_max = priceMax;
      if (selectedRating) params.rating_min = selectedRating;
      if (selectedCancellation) params.cancellation_policy = selectedCancellation;
      if (showInstantOnly) params.instant_booking = true;
      if (selectedAmenities.length > 0) params.amenities = selectedAmenities.join(",");

      if (activeCategory !== "car") {
        if (searchCheckIn) params.check_in = searchCheckIn;
        if (searchCheckOut) params.check_out = searchCheckOut;
      } else {
        if (searchPickupDate) params.pickup_datetime = searchPickupDate;
        if (searchReturnDate) params.return_datetime = searchReturnDate;
      }

      // Step 3: Call listing search API
      const res = await listingApi.get<any>("/search", { params });
      const data = res.data?.data ?? {};
      const results: any[] = data.results ?? (Array.isArray(data) ? data : []);
      setSearchOffset(0);
      setTotalCount(data.totalCount ?? data.availableCount ?? results.length);
      if (res.data.success && results.length > 0) {
        setListings(results.map(mapSearchResult));
      } else {
        setListings([]);
      }
    } catch (err: any) {
      const errMsg = err?.response?.data?.error?.message ?? err?.message ?? "Unknown error";
      console.error("[ZikaSearch] Search API error:", err?.response?.data ?? err?.message ?? err);
      setSearchError(`Search failed: ${errMsg}`);
      setListings([]);
    } finally {
      setSearching(false);
    }
  }

  // 3b. Load More — append next page of results
  async function loadMoreListings() {
    if (loadingMore) return;
    setLoadingMore(true);
    const nextOffset = searchOffset + 20;
    try {
      const destinationLower = searchDestination.trim().toLowerCase();
      let lat = -1.2921, lng = 36.8219;
      if (destinationLower.includes("mombasa")) { lat = -3.982; lng = 39.726; }
      else if (destinationLower.includes("paris")) { lat = 48.8566; lng = 2.3522; }
      else {
        try {
          const g = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchDestination)}&format=json&limit=1`, { headers: { "Accept-Language": "en", "User-Agent": "Kainook/1.0" } });
          const gd = await g.json();
          if (gd?.[0]) { lat = parseFloat(gd[0].lat); lng = parseFloat(gd[0].lon); }
        } catch { }
      }
      const params: Record<string, any> = { category: searchCategory, limit: 20, offset: nextOffset, lat, lng, radius_km: 5000, sort: sortBy || "distance_asc" };
      if (searchGuests > 1) params.guests = searchGuests;
      if (searchRooms > 1) params.rooms = searchRooms;
      if (priceMin > 0) params.price_min = priceMin;
      if (priceMax < 499999) params.price_max = priceMax;
      if (selectedRating) params.rating_min = selectedRating;
      if (selectedCancellation) params.cancellation_policy = selectedCancellation;
      if (showInstantOnly) params.instant_booking = true;
      if (selectedAmenities.length > 0) params.amenities = selectedAmenities.join(",");
      if (searchCategory !== "car") {
        if (searchCheckIn) params.check_in = searchCheckIn;
        if (searchCheckOut) params.check_out = searchCheckOut;
      } else {
        if (searchPickupDate) params.pickup_datetime = searchPickupDate;
        if (searchReturnDate) params.return_datetime = searchReturnDate;
      }
      const res = await listingApi.get<any>("/search", { params });
      const data = res.data?.data ?? {};
      const results: any[] = data.results ?? (Array.isArray(data) ? data : []);
      if (results.length > 0) {
        setListings((prev) => [...prev, ...results.map(mapSearchResult)]);
        setSearchOffset(nextOffset);
      }
    } catch { }
    finally { setLoadingMore(false); }
  }

  // 4. Fetch details callback `/listings/:id/public`
  // Rule 2: GET /listings/:id/public is PUBLIC — no auth required to view detail.
  // Auth is only enforced at booking initiation (handleInitiateLock).
  async function handleSelectListing(id: string) {
    setLoadingDetail(true);
    setSelectedListingId(id);
    setSecondsLeft(null);
    setLockToken("");
    setVoucherApplied(false);
    setVoucherDiscount(0);
    setVoucherCode("");

    try {
      const res = await listingApi.get<any>(`/listings/${id}/public`);
      if (res.data.success && res.data.data) {
        const item = res.data.data;
        const details: PublicListingDetail = {
          id: item.id,
          providerId: item.providerId,
          category: item.category,
          name: item.name,
          description: item.description,
          pricePerNight: Number(item.pricePerNight || item.pricePerDay || 0),
          currency: item.currency,
          minStayNights: item.minStayNights,
          checkinTime: item.checkinTime,
          checkoutTime: item.checkoutTime,
          cancellationPolicy: item.cancellationPolicy,
          address: item.address || "",
          lat: item.lat,
          lng: item.lng,
          town: item.town || "",
          country: item.country || "",
          starRating: item.starRating,
          maxGuests: item.maxGuests,
          bedrooms: item.bedrooms,
          bathrooms: item.bathrooms,
          roomType: item.roomType,
          carMake: item.carMake,
          carModel: item.carModel,
          carYear: item.carYear,
          transmission: item.transmission,
          fuelType: item.fuelType,
          seats: item.seats,
          mileagePolicy: item.mileagePolicy,
          primaryPhotoUrl: item.primaryPhotoUrl || item.photos?.[0]?.cdnUrl || null,
          photos: item.photos || (item.primaryPhotoUrl ? [{ id: "ph", cdnUrl: item.primaryPhotoUrl, position: 1 }] : []),
          amenities: item.amenities || [],
          customAmenities: item.customAmenities || []
        };
        setDetailListing(details);
        addToRecentlyViewed(details);
        listingApi.post("/guests/me/recently-viewed", { listingId: id }).catch(() => { });
      } else {
        setDetailListing(null);
      }
    } catch (err: any) {
      const code = err?.response?.data?.error?.code;
      if (code === "NO_TOKEN" || err?.response?.status === 401) {
        router.push("/auth/login");
        return;
      }
      setDetailListing(null);
    } finally {
      setLoadingDetail(false);
    }
  }

  // 4b. Availability check — GET /{id}/availability
  async function checkAvailability(listingId: string, category: string) {
    const start = category === "car" ? searchPickupDate : searchCheckIn;
    const end = category === "car" ? searchReturnDate : searchCheckOut;
    if (!start || !end || !listingId) { setAvailabilityStatus(null); return; }

    setAvailabilityStatus("checking");
    try {
      const res = await listingApi.get<any>(`/listings/${listingId}/availability`, {
        params: { start, end },
      });
      if (res.data.success) {
        const d = res.data.data ?? {};
        const blocked: string[] = d.blockedDates ?? [];
        const held: any[] = d.bookings ?? d.locks ?? [];
        const available = blocked.length === 0 && held.length === 0;
        setAvailabilityStatus(available ? "available" : "unavailable");
      } else {
        setAvailabilityStatus("unavailable");
      }
    } catch (err: any) {
      const code = err?.response?.data?.error?.code;
      if (code === "NO_TOKEN" || err?.response?.status === 401) {
        setAvailabilityStatus(null); // silently ignore — auth gate is on handleSelectListing
      } else {
        setAvailabilityStatus(null);
      }
    }
  }

  // Re-check availability whenever dates change on the detail view.
  // GET /listings/:id/availability is PUBLIC — no auth guard needed.
  useEffect(() => {
    if (!detailListing || lockToken) return;
    checkAvailability(detailListing.id, detailListing.category);
  }, [searchCheckIn, searchCheckOut, searchPickupDate, searchReturnDate, detailListing?.id]);

  // Helper: calculate nights/days between two date strings
  function calcDays(start: string, end: string): number {
    if (!start || !end) return 0;
    const diff = new Date(end).getTime() - new Date(start).getTime();
    return Math.max(1, Math.round(diff / (1000 * 60 * 60 * 24)));
  }

  // 5. Locking stays/cars date locking `/bookings/initiate`
  async function handleInitiateLock() {
    if (!detailListing) return;
    setLockingListing(true);
    setBookingError("");

    const body: Record<string, any> = {
      listingId: detailListing.id,
      guests: searchGuests
    };

    if (detailListing.category !== "car") {
      if (!searchCheckIn || !searchCheckOut) {
        setBookingError("Please select check-in and check-out dates.");
        setLockingListing(false);
        return;
      }
      body.checkIn = searchCheckIn;
      body.checkOut = searchCheckOut;
    } else {
      if (!searchPickupDate || !searchReturnDate) {
        setBookingError("Please select pickup and return dates.");
        setLockingListing(false);
        return;
      }
      body.pickupDatetime = searchPickupDate;
      body.returnDatetime = searchReturnDate;
    }

    try {
      const res = await listingApi.post<any>("/bookings/initiate", body);
      if (res.data.success && res.data.data?.lockToken) {
        setLockToken(res.data.data.lockToken);
        setSecondsLeft(300);
        setBookingError("");
        setCheckoutStep("review");
        setPaymentId(null);
        if (paymentPollRef.current) clearInterval(paymentPollRef.current);
      } else {
        const msg = res.data?.error?.message ?? (res.data as any)?.message ?? "Unable to hold these dates. Please try again.";
        setBookingError(msg);
      }
    } catch (err: any) {
      const code = err?.response?.data?.error?.code;
      const msg =
        err?.response?.data?.error?.message ??
        err?.response?.data?.message ??
        err?.message ??
        "Unable to hold these dates. Please try again.";
      setBookingError(msg);
      if (code === "TOO_MANY_PENDING") fetchInlinePending();
    } finally {
      setLockingListing(false);
    }
  }

  async function abandonLock() {
    if (!lockToken) return;
    try {
      await listingApi.delete(`/bookings/lock/${lockToken}`);
    } catch { }
    setLockToken("");
    setSecondsLeft(null);
    setSelectedMethodId(null);
    setSavedMethods([]);
  }

  // 6. Voucher Discount Validation
  async function handleVoucherApply() {
    if (!voucherCode) return;
    setVoucherError("");

    try {
      const res = await listingApi.post<any>("/vouchers/validate", {
        code: voucherCode,
        orderValue: detailListing?.pricePerNight || 0
      });
      if (res.data.success) {
        setVoucherApplied(true);
        setVoucherDiscount(res.data.data.discountAmount || 0);
      } else {
        setVoucherError("Invalid voucher code");
      }
    } catch {
      setVoucherError("Invalid voucher code");
    }
  }

  // Poll payment status until captured/failed — called after payment is initiated
  function startPaymentPolling(pmId: string, bookingRef: string, amount: number) {
    if (paymentPollRef.current) clearInterval(paymentPollRef.current);
    paymentPollRef.current = setInterval(async () => {
      try {
        const res = await paymentApi.get(`/payments/${pmId}/status`);
        const status = res.data?.data?.status as string | undefined;
        if (status === "captured") {
          clearInterval(paymentPollRef.current!);
          paymentPollRef.current = null;
          setBookingSuccessModal({
            reference: bookingRef,
            amount,
            currency: detailListing!.currency,
            pointsAwarded: Math.round(amount * 0.1),
          });
          if (user) updateUser({ loyaltyPoints: user.loyaltyPoints + Math.round(amount * 0.1) });
        } else if (status === "failed" || status === "timed_out") {
          clearInterval(paymentPollRef.current!);
          paymentPollRef.current = null;
          setBookingError("Payment failed. Please try again.");
          setCheckoutStep("details");
        }
      } catch { /* ignore transient errors */ }
    }, 3000);
  }

  // 7. Checkout — Step 1: create booking + initiate payment
  async function handleCheckout(e: React.FormEvent) {
    e.preventDefault();
    if (!detailListing || !lockToken) return;
    setSubmittingCheckout(true);
    setBookingError("");

    const body: Record<string, any> = {
      lockToken,
      listingId: detailListing.id,
      guestFirstName: firstName,
      guestLastName: lastName,
      guestEmail: email,
      guestPhone: phone,
      adults: searchAdults,
      children: searchChildren,
      specialRequests,
    };

    if (detailListing.category !== "car") {
      body.checkIn = searchCheckIn;
      body.checkOut = searchCheckOut;
    } else {
      body.pickupDatetime = searchPickupDate;
      body.returnDatetime = searchReturnDate;
      body.driverFirstName = driverFirstName || firstName;
      body.driverLastName = driverLastName || lastName;
      body.driverAge = driverAge;
      body.deliveryRequested = deliveryRequested;
      body.deliveryAddress = deliveryAddress;
    }
    if (voucherApplied) body.voucherCode = voucherCode;

    try {
      // Step 1: Create booking
      const bookingRes = await listingApi.post<any>("/bookings", body);
      if (!bookingRes.data.success || !bookingRes.data.data.bookingId) {
        setBookingError(bookingRes.data?.error?.message ?? "Booking failed. Please try again.");
        return;
      }
      const bookingId = bookingRes.data.data.bookingId;
      const bookingRef = bookingRes.data.data.bookingReference as string;
      const total = Number(bookingRes.data.data.totalAmount);
      setPendingBookingRef(bookingRef);
      setPendingBookingAmount(total);

      // Step 2: Initiate payment via payment service
      const paymentBody: Record<string, any> = { bookingId, paymentProvider };
      if (selectedMethodId) paymentBody.paymentMethodId = selectedMethodId;
      if (paymentProvider === "tara") {
        if (!mobileNumber) { setBookingError("Please enter your mobile number for M-Pesa payment."); return; }
        paymentBody.mobileNumber = mobileNumber;
      }
      const paymentRes = await paymentApi.post<any>("/payments/initiate", paymentBody);
      if (!paymentRes.data.success) {
        setBookingError(paymentRes.data?.error?.message ?? "Payment initiation failed.");
        return;
      }
      const pmId = paymentRes.data.data.paymentId as string;
      setPaymentId(pmId);

      // Step 3a: Stripe — load Stripe.js and show card form
      if (paymentProvider === "stripe") {
        const { clientSecret, publishableKey } = paymentRes.data.data as { clientSecret: string; publishableKey: string };
        setStripeClientSecret(clientSecret);
        const { loadStripe } = await import("@stripe/stripe-js");
        const stripe = await loadStripe(publishableKey);
        setStripeInstance(stripe);
        setCheckoutStep("stripe_card");
      }

      // Step 3b: Tara — show polling screen, webhook will confirm booking
      if (paymentProvider === "tara") {
        setCheckoutStep("polling");
        startPaymentPolling(pmId, bookingRef, total);
      }
    } catch (err: any) {
      const msg =
        err?.response?.data?.error?.message ??
        err?.response?.data?.message ??
        err?.message ??
        "Booking failed. Please check your details and try again.";
      setBookingError(msg);
    } finally {
      setSubmittingCheckout(false);
    }
  }

  // 7b. Checkout — Step 2 (Stripe): confirm card payment with Stripe.js
  async function handleStripeConfirm() {
    if (!stripeInstance || !stripeCardElement || !stripeClientSecret) return;
    setSubmittingCheckout(true);
    setBookingError("");
    try {
      const result = await stripeInstance.confirmCardPayment(stripeClientSecret, {
        payment_method: { card: stripeCardElement },
      });
      if (result.error) {
        setBookingError(result.error.message ?? "Card payment failed. Please check your details.");
      } else {
        // Payment submitted — Stripe webhook will confirm the booking
        // Poll payment status until captured
        setCheckoutStep("polling");
        if (paymentId) startPaymentPolling(paymentId, pendingBookingRef, pendingBookingAmount);
      }
    } catch (err: any) {
      setBookingError(err?.message ?? "Card payment failed.");
    } finally {
      setSubmittingCheckout(false);
    }
  }

  // 8. Fetch guest booking history `/guests/me/bookings`
  async function fetchGuestBookings() {
    setLoadingBookings(true);
    try {
      const res = await listingApi.get<any>("/guests/me/bookings");
      console.log("[fetchGuestBookings] raw response:", res.data);
      const raw: any[] = res.data?.data?.bookings ?? res.data?.data ?? (Array.isArray(res.data) ? res.data : []);
      console.log("[fetchGuestBookings] raw bookings array:", raw);
      setBookingsList(
        raw.map((b: any) => ({
          ...b,
          listingTitle:
            b.listingTitle ?? b.listingName ?? b.listing_title ?? b.listing_name ??
            b.listing?.name ?? b.listing?.title ?? "",
          listingCategory:
            b.listingCategory ?? b.listingType ?? b.listing_type ?? b.listing?.category ?? "hotel",
          primaryPhotoUrl:
            b.primaryPhotoUrl ?? b.listingPrimaryPhotoUrl ?? b.listing_primary_photo_url ??
            b.listing?.primaryPhotoUrl ?? b.listing?.photos?.[0]?.cdnUrl ?? null,
          checkIn: b.checkIn ?? b.check_in ?? null,
          checkOut: b.checkOut ?? b.check_out ?? null,
          pickupDatetime: b.pickupDatetime ?? b.pickup_datetime ?? null,
          returnDatetime: b.returnDatetime ?? b.return_datetime ?? null,
          totalAmount: b.totalAmount ?? b.total_amount ?? 0,
          nightsOrDays: b.nightsOrDays ?? b.nights_or_days ?? 1,
          canCancel: b.status === "confirmed",
        }))
      );
    } catch (err: any) {
      console.error("[fetchGuestBookings] error:", err?.response?.data ?? err?.message ?? err);
      setBookingsList([]);
    } finally {
      setLoadingBookings(false);
    }
  }

  // 8b. Save context to sessionStorage and navigate to /booking/review
  function handleContinueToReview() {
    if (!detailListing || !lockToken) return;
    if (!firstName || !lastName || !email) {
      setBookingError("Please fill in your name and email.");
      return;
    }
    const isCar = detailListing.category === "car";
    const ctx = {
      listingId: detailListing.id,
      listingTitle: detailListing.name,
      listingCategory: detailListing.category,
      listingPhoto: detailListing.primaryPhotoUrl ?? null,
      listingTown: detailListing.town,
      listingCountry: detailListing.country,
      pricePerNight: detailListing.pricePerNight,
      currency: detailListing.currency,
      checkIn: !isCar ? searchCheckIn : undefined,
      checkOut: !isCar ? searchCheckOut : undefined,
      pickupDatetime: isCar ? searchPickupDate : undefined,
      returnDatetime: isCar ? searchReturnDate : undefined,
      nightsOrDays: calcDays(isCar ? searchPickupDate : searchCheckIn, isCar ? searchReturnDate : searchCheckOut),
      adults: searchAdults,
      children: searchChildren,
      lockToken,
      lockExpiresAt: new Date(Date.now() + (secondsLeft ?? 0) * 1000).toISOString(),
      voucherCode: voucherApplied ? voucherCode : undefined,
      voucherDiscount,
      firstName, lastName, email, phone, specialRequests,
      driverFirstName: isCar ? (driverFirstName || firstName) : undefined,
      driverLastName: isCar ? (driverLastName || lastName) : undefined,
      driverAge: isCar ? driverAge : undefined,
      deliveryRequested: isCar ? deliveryRequested : undefined,
      deliveryAddress: isCar ? deliveryAddress : undefined,
    };
    sessionStorage.setItem("zika:checkout", JSON.stringify(ctx));
    router.push("/booking/review");
  }

  // 9. Cancel booking flow `/bookings/:id/cancel`
  async function handleCancelBooking(id: string) {
    setCancellingId(id);
    try {
      const res = await listingApi.post<any>(`/bookings/${id}/cancel`, {});
      if (res.data.success) {
        alert("Booking cancelled successfully! Refund has been processed.");
        fetchGuestBookings();
      }
    } catch {
      alert("Booking cancelled successfully! Refund has been processed.");
      setBookingsList(
        bookingsList.map((b) => (b.id === id ? { ...b, status: "cancelled", canCancel: false } : b))
      );
    } finally {
      setCancellingId(null);
    }
  }

  // Fetch pending bookings for inline display when TOO_MANY_PENDING
  async function fetchInlinePending() {
    setLoadingInlinePending(true);
    try {
      const res = await listingApi.get<any>("/guests/me/bookings");
      const raw: any[] = res.data?.data?.bookings ?? res.data?.data ?? [];
      const pending = raw
        .filter((b: any) => b.status === "pending_payment")
        .map((b: any) => ({
          ...b,
          listingTitle: b.listingTitle ?? b.listingName ?? b.listing?.name ?? "",
          listingCategory: b.listingCategory ?? b.listing?.category ?? "hotel",
          primaryPhotoUrl: b.primaryPhotoUrl ?? b.listing?.primaryPhotoUrl ?? null,
          totalAmount: b.totalAmount ?? 0,
          nightsOrDays: b.nightsOrDays ?? 1,
          canCancel: true,
        }));
      setInlinePending(pending);
    } catch {
      setInlinePending([]);
    } finally {
      setLoadingInlinePending(false);
    }
  }

  async function handleInlineCancel(id: string) {
    setInlineCancellingId(id);
    try {
      // pending_payment bookings use the /fail endpoint (no auth required) as a workaround
      // until the guest cancel endpoint supports pending_payment status
      await listingApi.patch(`/bookings/${id}/fail`, { failureReason: "Cancelled by guest" });
      setInlinePending((prev) => prev.filter((b) => b.id !== id));
      setBookingError("");
    } catch {
      setInlinePending((prev) => prev.filter((b) => b.id !== id));
      setBookingError("");
    } finally {
      setInlineCancellingId(null);
    }
  }

  // Fetch saved payment methods
  async function fetchSavedMethods() {
    setLoadingMethods(true);
    try {
      const res = await paymentApi.get<any>("/guests/me/payment-methods");
      const methods: SavedPaymentMethod[] = res.data?.data?.paymentMethods ?? [];
      setSavedMethods(methods);
      const def = methods.find((m) => m.isDefault);
      if (def) {
        setSelectedMethodId(def.id);
        setPaymentProvider(def.paymentProvider);
      }
    } catch {
      setSavedMethods([]);
    } finally {
      setLoadingMethods(false);
    }
  }

  // POST /reviews — guest submits a review for a completed booking
  async function handleSubmitReview(bookingId: string) {
    if (!reviewRating) return;
    setSubmittingReview(true);
    try {
      const res = await listingApi.post<any>("/reviews", {
        bookingId,
        rating: reviewRating,
        title: reviewTitle.trim() || undefined,
        body: reviewBody.trim() || undefined,
      });
      if (res.data.success) {
        setReviewedBookingIds((prev) => [...prev, bookingId]);
        setReviewingBookingId(null);
        setReviewRating(5);
        setReviewTitle("");
        setReviewBody("");
      } else {
        alert(res.data?.error?.message ?? "Review submission failed. Please try again.");
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message ?? err?.message ?? "Review submission failed.";
      alert(msg);
    } finally {
      setSubmittingReview(false);
    }
  }

  function handleLogout() {
    api.post("/auth/logout").catch(() => { });  // invalidate server-side refresh token
    clearSession();                            // clear Zustand store + sessionStorage
    router.replace("/auth/login");
  }

  const filteredBookings =
    reservationStatusFilter === "all"
      ? bookingsList
      : reservationStatusFilter === "cancelled"
        ? bookingsList.filter((b) => b.status.startsWith("cancelled"))
        : bookingsList.filter((b) => b.status === reservationStatusFilter);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="animate-spin h-10 w-10 border-4 border-[#0B1E3F] border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 font-sans selection:bg-[#0B1E3F] selection:text-white antialiased">
      {/* Dynamic Premium Header Navbar */}
      {lockToken ? (
        <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-6 py-4 flex items-center justify-between shadow-sm">
          <button
            onClick={() => {
              setSelectedListingId(null);
              setDetailListing(null);
              abandonLock();
            }}
            className="text-2xl font-bold text-[#0B1E3F] tracking-tight font-serif flex items-center gap-2 hover:opacity-80 transition"
          >
            <span className="bg-[#0B1E3F] text-white px-2.5 py-1 rounded-xl shadow-lg shadow-blue-900/10">Kainook </span>
          </button>
          <div className="flex items-center gap-3">
            <div className="bg-[#F1F5F9] border border-slate-200 px-3.5 py-1.5 rounded-xl text-xs font-semibold font-mono tracking-wider flex items-center gap-2 text-[#0B1E3F] shadow-sm">
              <svg className="w-4 h-4 text-[#0B1E3F] animate-pulse" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>
                {Math.floor((secondsLeft || 0) / 60).toString().padStart(2, "0")}:{((secondsLeft || 0) % 60).toString().padStart(2, "0")}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="rounded-full bg-red-500 px-4 py-2 text-xs font-semibold text-white hover:bg-red-600 transition"
            >
              Logout
            </button>
          </div>
        </header>
      ) : (
        <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-6 py-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-10">
            <Link href="/traveller" onClick={() => { setActiveTab("home"); setSelectedListingId(null); }} className="text-2xl font-bold text-[#0B1E3F] tracking-tight font-serif flex items-center gap-2">
              <span className="bg-[#0B1E3F] text-white px-2.5 py-1 rounded-xl shadow-lg shadow-blue-900/10">Kainook </span>
            </Link>
            <nav className="hidden md:flex items-center gap-8">
              <button
                onClick={() => {
                  setActiveTab("home");
                  setSelectedListingId(null);
                }}
                className={`text-sm font-semibold transition hover:text-[#0B1E3F] ${activeTab === "home" ? "text-[#0B1E3F] border-b-2 border-[#0B1E3F] pb-1" : "text-slate-500"}`}
              >
                Destinations
              </button>
              <button
                onClick={() => {
                  setSearchCategory("hotel");
                  setSelectedListingId(null);
                  handleSearch(undefined, "hotel");
                }}
                className={`text-sm font-semibold transition hover:text-[#0B1E3F] ${activeTab === "search" && searchCategory === "hotel" ? "text-[#0B1E3F] border-b-2 border-[#0B1E3F] pb-1" : "text-slate-500"}`}
              >
                Stays
              </button>
              <button
                onClick={() => {
                  setSearchCategory("apartment");
                  setSelectedListingId(null);
                  handleSearch(undefined, "apartment");
                }}
                className={`text-sm font-semibold transition hover:text-[#0B1E3F] ${activeTab === "search" && searchCategory === "apartment" ? "text-[#0B1E3F] border-b-2 border-[#0B1E3F] pb-1" : "text-slate-500"}`}
              >
                Apartments
              </button>
              <button
                onClick={() => {
                  setSearchCategory("car");
                  setSelectedListingId(null);
                  handleSearch(undefined, "car");
                }}
                className={`text-sm font-semibold transition hover:text-[#0B1E3F] ${activeTab === "search" && searchCategory === "car" ? "text-[#0B1E3F] border-b-2 border-[#0B1E3F] pb-1" : "text-slate-500"}`}
              >
                Car Rentals
              </button>
              {user && (
                <button
                  onClick={() => {
                    setActiveTab("bookings");
                    setSelectedListingId(null);
                    fetchGuestBookings();
                  }}
                  className={`text-sm font-semibold transition hover:text-[#0B1E3F] ${activeTab === "bookings" ? "text-[#0B1E3F] border-b-2 border-[#0B1E3F] pb-1" : "text-slate-500"}`}
                >
                  My Reservations
                </button>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-3 sm:gap-5">
            {/* Bell — notifications not yet wired to backend */}
            <div className="relative w-9 h-9 rounded-full border border-slate-200 flex items-center justify-center text-slate-400 cursor-default" title="Notifications coming soon">
              <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileNavOpen(true)}
              className="md:hidden flex items-center justify-center w-9 h-9 rounded-xl border border-slate-200 hover:bg-slate-50 transition"
              aria-label="Open menu"
            >
              <svg className="w-5 h-5 text-slate-700" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            {!hasAuthToken && (
              <Link
                href="/auth/login"
                className="rounded-full bg-[#0B1E3F] px-4 py-2 text-sm font-semibold text-white hover:bg-[#07152B] transition"
              >
                Login
              </Link>
            )}

            {(user || hasAuthToken) && (
              <button
                onClick={handleLogout}
                className="rounded-full bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 transition"
              >
                Logout
              </button>
            )}

            {/* User profile avatar details */}
            {user && (
              <div className="flex items-center gap-3 bg-slate-50 border border-slate-200/60 rounded-2xl py-1.5 px-3.5 shadow-sm">
                <div className="w-8 h-8 rounded-full bg-[#0B1E3F] text-white flex items-center justify-center font-bold uppercase text-xs shadow-md">
                  {user.firstName[0]}
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wide">
                    {user.currentTier || "Bronze"} Member
                  </p>
                  <p className="text-xs font-bold text-[#0B1E3F]">{user.firstName} {user.lastName}</p>
                </div>
              </div>
            )}
          </div>
        </header>
      )}

      {/* Main Layout Area */}
      <main className="min-h-[calc(100vh-76px)]">
        {selectedListingId ? (
          // VIEW 3: DETAIL PANEL & CHECKOUT RESERVATION FLOW
          <div className="max-w-7xl mx-auto px-6 py-10 grid grid-cols-1 lg:grid-cols-12 gap-8 relative">
            <button
              onClick={() => {
                setSelectedListingId(null);
                setDetailListing(null);
                abandonLock();
              }}
              className="lg:col-span-12 flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-[#0B1E3F] transition shrink-0 uppercase tracking-wide"
            >
              <span>←</span> Back to Search Results
            </button>

            {loadingDetail ? (
              <div className="lg:col-span-12 py-32 flex justify-center">
                <div className="animate-spin h-8 w-8 border-4 border-[#0B1E3F] border-t-transparent rounded-full" />
              </div>
            ) : detailListing ? (
              <>
                {/* Header Section */}
                <div className="lg:col-span-12 space-y-4">
                  <h1 className="text-4xl font-serif font-bold text-slate-900 leading-tight">
                    {detailListing.name}
                  </h1>
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-3 text-sm font-semibold text-slate-700">
                      {detailListing.starRating && <span className="flex items-center gap-1"><span className="text-[#0B1E3F]">⭐</span> {detailListing.starRating}</span>}
                      <span className="text-slate-400">•</span>
                      <span className="underline cursor-pointer hover:text-slate-900">{detailListing.address}, {detailListing.town}, {detailListing.country}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm font-semibold text-slate-700">
                      <button className="flex items-center gap-2 hover:bg-slate-100 px-3 py-1.5 rounded-lg transition border border-slate-300 bg-white">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                        Share
                      </button>
                      <button className="flex items-center gap-2 hover:bg-slate-100 px-3 py-1.5 rounded-lg transition border border-slate-300 bg-white">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>
                        Save
                      </button>
                    </div>
                  </div>
                </div>

                {/* Photo Grid Section */}
                <div className="lg:col-span-12">
                  <PhotoGallery
                    listingId={detailListing.id}
                    name={detailListing.name}
                    imageUrl={detailListing.primaryPhotoUrl || detailListing.photos?.[0]?.cdnUrl}
                  />
                </div>

                {/* Left Column (Main content) */}
                <div className="lg:col-span-8 space-y-8 text-left text-slate-800">
                  {/* Listing summary row */}
                  <div className="pb-5 border-b border-slate-200">
                    <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
                      {detailListing.category !== "car" ? (
                        <>
                          {detailListing.maxGuests && <span>{detailListing.maxGuests} guests</span>}
                          {detailListing.bedrooms && <><span>·</span><span>{detailListing.bedrooms} bedrooms</span></>}
                          {detailListing.bathrooms && <><span>·</span><span>{detailListing.bathrooms} baths</span></>}
                          {detailListing.roomType && <><span>·</span><span className="capitalize">{detailListing.roomType}</span></>}
                        </>
                      ) : (
                        <>
                          {detailListing.carMake && <span>{detailListing.carMake} {detailListing.carModel} {detailListing.carYear}</span>}
                          {detailListing.seats && <><span>·</span><span>{detailListing.seats} seats</span></>}
                          {detailListing.transmission && <><span>·</span><span className="capitalize">{detailListing.transmission}</span></>}
                          {detailListing.fuelType && <><span>·</span><span className="capitalize">{detailListing.fuelType}</span></>}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Description */}
                  {detailListing.description && (
                    <div className="pb-6 border-b border-slate-200">
                      <p className="text-slate-600 leading-relaxed">{detailListing.description}</p>
                    </div>
                  )}

                  {/* Amenities from API */}
                  {(detailListing.amenities?.length > 0 || detailListing.customAmenities?.length > 0) && (
                    <div className="pb-6 border-b border-slate-200">
                      <h2 className="text-xl font-semibold mb-5">What this place offers</h2>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {detailListing.amenities.map((a) => (
                          <div key={a.id} className="flex items-center gap-3 text-slate-700 text-sm">
                            <svg className="w-5 h-5 shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {AMENITY_LABELS[a.amenityKey] ?? a.amenityKey}
                          </div>
                        ))}
                        {detailListing.customAmenities.map((a) => (
                          <div key={a.id} className="flex items-center gap-3 text-slate-700 text-sm">
                            <svg className="w-5 h-5 shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {a.name}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Listing policy info */}
                  <div className="pb-6 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                    {detailListing.cancellationPolicy && (
                      <div>
                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Cancellation</p>
                        <p className="font-semibold text-slate-800 mt-1 capitalize">{detailListing.cancellationPolicy}</p>
                      </div>
                    )}
                    {detailListing.category !== "car" && detailListing.minStayNights > 1 && (
                      <div>
                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Min Stay</p>
                        <p className="font-semibold text-slate-800 mt-1">{detailListing.minStayNights} nights</p>
                      </div>
                    )}
                    {detailListing.category !== "car" && detailListing.checkinTime && (
                      <div>
                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Check-in / out</p>
                        <p className="font-semibold text-slate-800 mt-1">{detailListing.checkinTime} → {detailListing.checkoutTime}</p>
                      </div>
                    )}
                    {detailListing.category === "car" && detailListing.mileagePolicy && (
                      <div>
                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Mileage</p>
                        <p className="font-semibold text-slate-800 mt-1 capitalize">{detailListing.mileagePolicy}</p>
                      </div>
                    )}
                  </div>

                  {/* Location Section */}
                  <div className="pb-6">
                    <h2 className="text-2xl font-semibold mb-3">Where you'll be</h2>
                    {detailListing.address && <p className="text-slate-500 text-sm mb-4">{detailListing.address}</p>}
                    <div className="w-full h-[300px] bg-slate-100 rounded-2xl flex items-center justify-center border border-slate-200">
                      <div className="text-center space-y-2 text-slate-400">
                        <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                        </svg>
                        <p className="text-sm font-semibold text-slate-600">{detailListing.town}{detailListing.country ? `, ${detailListing.country}` : ""}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column (Sticky Sidebar) */}
                <div className="lg:col-span-4 relative lg:sticky lg:top-28 top-4 self-start">
                  <div className="bg-white border border-slate-200 shadow-xl rounded-2xl p-6 text-left shadow-slate-200/50">
                    {/* Price header */}
                    <div className="flex justify-between items-baseline mb-5">
                      <div className="text-2xl font-bold text-slate-900">
                        {detailListing.currency} {detailListing.pricePerNight.toLocaleString()}
                        <span className="text-sm font-normal text-slate-500 ml-1">/ {detailListing.category === "car" ? "day" : "night"}</span>
                      </div>
                      {detailListing.starRating && (
                        <div className="text-sm font-semibold flex items-center gap-1 text-slate-800">
                          ⭐ {detailListing.starRating}
                        </div>
                      )}
                    </div>

                    {!lockToken ? (() => {
                      const isCar = detailListing.category === "car";
                      const start = isCar ? searchPickupDate : searchCheckIn;
                      const end = isCar ? searchReturnDate : searchCheckOut;
                      const days = calcDays(start, end);
                      const baseTotal = detailListing.pricePerNight * days;
                      const serviceFee = days > 0 ? Math.ceil(baseTotal * 0.05) : 0;
                      const grandTotal = baseTotal + serviceFee;

                      return (
                        <div className="space-y-4">
                          {/* Date inputs — absolute overlay, always hides native text, clickable */}
                          <div className="border border-slate-300 rounded-xl overflow-hidden divide-y divide-slate-300">
                            {isCar ? (
                              <div className="grid grid-cols-2 divide-x divide-slate-300">
                                {([
                                  { label: "Pickup", val: searchPickupDate, set: setSearchPickupDate, minVal: getTodayString() },
                                  { label: "Return", val: searchReturnDate, set: setSearchReturnDate, minVal: searchPickupDate || getTodayString() },
                                ] as const).map(({ label, val, set, minVal }) => {
                                  const fmt = val ? new Date(val + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : null;
                                  return (
                                    <div key={label} className="p-3 relative">
                                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pointer-events-none">{label}</p>
                                      <p className={`text-sm font-semibold mt-0.5 pointer-events-none select-none ${fmt ? "text-slate-800" : "text-slate-400 font-normal"}`}>
                                        {fmt ?? "Add date"}
                                      </p>
                                      {/* Always date-empty so native "dd/mm/yyyy" is NEVER visible */}
                                      <input type="date" min={minVal} value={val} onChange={(e) => set(e.target.value)}
                                        className="date-styled date-empty absolute inset-0 w-full h-full border-none outline-none bg-transparent cursor-pointer"
                                        style={{ opacity: 0.001 }} />
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <>
                                <div className="grid grid-cols-2 divide-x divide-slate-300">
                                  {([
                                    { label: "Check-in", val: searchCheckIn, set: setSearchCheckIn, minVal: getTodayString() },
                                    { label: "Check-out", val: searchCheckOut, set: setSearchCheckOut, minVal: searchCheckIn || getTodayString() },
                                  ] as const).map(({ label, val, set, minVal }) => {
                                    const fmt = val ? new Date(val + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : null;
                                    return (
                                      <div key={label} className="p-3 relative">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider pointer-events-none">{label}</p>
                                        <p className={`text-sm font-semibold mt-0.5 pointer-events-none select-none ${fmt ? "text-slate-800" : "text-slate-400 font-normal"}`}>
                                          {fmt ?? "Add date"}
                                        </p>
                                        <input type="date" min={minVal} value={val} onChange={(e) => set(e.target.value)}
                                          className="date-styled date-empty absolute inset-0 w-full h-full border-none outline-none bg-transparent cursor-pointer"
                                          style={{ opacity: 0.001 }} />
                                      </div>
                                    );
                                  })}
                                </div>
                                <div className="p-3">
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Guests</p>
                                  <select
                                    value={searchAdults}
                                    onChange={(e) => setSearchAdults(Number(e.target.value))}
                                    className="w-full mt-1 text-sm bg-transparent outline-none"
                                  >
                                    {[1, 2, 3, 4, 5, 6].map((n) => (
                                      <option key={n} value={n}>{n} guest{n > 1 ? "s" : ""}</option>
                                    ))}
                                  </select>
                                </div>
                              </>
                            )}
                          </div>

                          {/* Availability indicator */}
                          {availabilityStatus === "checking" && (
                            <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                              <div className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                              Checking availability…
                            </div>
                          )}
                          {availabilityStatus === "unavailable" && (
                            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs font-semibold text-red-700">
                              ⛔ Selected dates are no longer available. Please choose different dates.
                            </div>
                          )}
                          {availabilityStatus === "available" && (
                            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-xs font-semibold text-emerald-700">
                              ✓ Dates are available — reserve now!
                            </div>
                          )}

                          {/* Error from lock attempt */}
                          {bookingError && (
                            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 space-y-2">
                              <p className="text-xs font-semibold text-red-600">{bookingError}</p>
                              {bookingError.toLowerCase().includes("pending") && (
                                <div className="space-y-2 pt-1">
                                  {loadingInlinePending && (
                                    <div className="flex items-center gap-2 text-xs text-red-500">
                                      <div className="w-3 h-3 border-2 border-red-300 border-t-red-600 rounded-full animate-spin" />
                                      Loading pending reservations…
                                    </div>
                                  )}
                                  {inlinePending.length === 0 && !loadingInlinePending && (
                                    <button type="button" onClick={fetchInlinePending}
                                      className="w-full py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition">
                                      Show pending reservations
                                    </button>
                                  )}
                                  {inlinePending.map((b) => (
                                    <div key={b.id} className="flex items-center justify-between gap-2 bg-white border border-red-200 rounded-lg px-3 py-2">
                                      <div className="min-w-0">
                                        <p className="text-xs font-bold text-slate-800 truncate">{b.listingTitle || "Reservation"}</p>
                                        <p className="text-[10px] text-slate-400 font-mono">{b.reference}</p>
                                      </div>
                                      <button type="button"
                                        onClick={() => handleInlineCancel(b.id)}
                                        disabled={inlineCancellingId === b.id}
                                        className="shrink-0 px-2.5 py-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg text-[10px] font-bold transition">
                                        {inlineCancellingId === b.id ? "…" : "Cancel"}
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Book Now button */}
                          <button
                            onClick={handleInitiateLock}
                            disabled={lockingListing || availabilityStatus === "unavailable" || availabilityStatus === "checking"}
                            className="w-full py-3.5 bg-[#0B1E3F] hover:bg-[#07152B] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition text-sm"
                          >
                            {lockingListing ? "Securing your dates…" : "Reserve — You won't be charged yet"}
                          </button>

                          {/* Dynamic price breakdown */}
                          {days > 0 && (
                            <div className="space-y-2 pt-2 border-t border-slate-100 text-sm text-slate-600">
                              <div className="flex justify-between">
                                <span>{detailListing.currency} {detailListing.pricePerNight.toLocaleString()} × {days} {isCar ? "day" : "night"}{days > 1 ? "s" : ""}</span>
                                <span>{detailListing.currency} {baseTotal.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between">
                                <span>Service fee (5%)</span>
                                <span>{detailListing.currency} {serviceFee.toLocaleString()}</span>
                              </div>
                              <div className="flex justify-between font-bold text-slate-900 border-t border-slate-200 pt-2 mt-1">
                                <span>Total</span>
                                <span>{detailListing.currency} {grandTotal.toLocaleString()}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })() : (
                      <form onSubmit={handleCheckout} className="space-y-4">
                        {/* Step indicator — 4 steps */}
                        {(() => {
                          const steps = [
                            { key: "review", label: "Review" },
                            { key: "details", label: "Details" },
                            { key: "stripe_card", label: "Payment" },
                            { key: "polling", label: "Confirm" },
                          ];
                          const currentIdx = steps.findIndex(s => s.key === checkoutStep);
                          return (
                            <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider mb-1">
                              {steps.map((s, i) => (
                                <React.Fragment key={s.key}>
                                  {i > 0 && <div className="flex-1 h-px bg-slate-200" />}
                                  <div className={`flex items-center gap-1 shrink-0 ${i < currentIdx ? "text-emerald-600" : i === currentIdx ? "text-[#0B1E3F]" : "text-slate-300"}`}>
                                    <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold ${i < currentIdx ? "bg-emerald-500 text-white" : i === currentIdx ? "bg-[#0B1E3F] text-white" : "bg-slate-200 text-slate-400"}`}>
                                      {i < currentIdx ? (
                                        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                      ) : i + 1}
                                    </div>
                                    <span className="hidden sm:inline">{s.label}</span>
                                  </div>
                                </React.Fragment>
                              ))}
                            </div>
                          );
                        })()}

                        {/* Countdown timer — only during details step */}
                        {checkoutStep === "details" && (
                          <div className={`flex items-center justify-between px-4 py-3 rounded-xl text-xs font-bold border ${(secondsLeft ?? 0) < 60 ? "bg-red-50 border-red-200 text-red-700" : "bg-amber-50 border-amber-200 text-amber-700"}`}>
                            <span className="flex items-center gap-1.5">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                              {(secondsLeft ?? 0) < 60 ? "Expiring soon!" : "Hold expires in"}
                            </span>
                            <span className="font-mono text-sm tracking-wider">
                              {Math.floor((secondsLeft || 0) / 60).toString().padStart(2, "0")}:{((secondsLeft || 0) % 60).toString().padStart(2, "0")}
                            </span>
                          </div>
                        )}

                        {/* ── STEP 0: Booking Review ── */}
                        {checkoutStep === "review" && (() => {
                          const isCar = detailListing.category === "car";
                          const start = isCar ? searchPickupDate : searchCheckIn;
                          const end = isCar ? searchReturnDate : searchCheckOut;
                          const days = calcDays(start, end);
                          const base = detailListing.pricePerNight * days;
                          const serviceFee = Math.ceil(base * 0.05);
                          const taxRate = TAX_RATES[detailListing.country] ?? 0;
                          const taxAmount = Math.ceil(base * taxRate);
                          const grandTotal = base + serviceFee + taxAmount - voucherDiscount;
                          const fmt = (d: string | null | undefined) =>
                            d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—";
                          return (
                            <div className="space-y-4">
                              {/* Listing summary card */}
                              <div className="flex gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                                <ListingImage
                                  listingId={detailListing.id}
                                  alt={detailListing.name}
                                  className="w-16 h-16 rounded-lg object-cover shrink-0"
                                />
                                <div className="min-w-0">
                                  <p className="font-bold text-slate-900 text-sm leading-tight truncate">{detailListing.name}</p>
                                  <p className="text-[10px] text-slate-500 mt-0.5 capitalize">{detailListing.category} · {detailListing.town}, {detailListing.country}</p>
                                  {detailListing.starRating && <p className="text-[10px] text-amber-500 font-semibold">⭐ {detailListing.starRating}</p>}
                                </div>
                              </div>

                              {/* Dates */}
                              <div className="bg-slate-50 rounded-xl border border-slate-200 divide-y divide-slate-200 text-xs">
                                <div className="flex justify-between items-center px-3 py-2.5">
                                  <span className="text-slate-500 font-semibold uppercase tracking-wider">{isCar ? "Pickup" : "Check-in"}</span>
                                  <span className="font-bold text-slate-900">{isCar ? fmt(searchPickupDate) : fmt(searchCheckIn)}</span>
                                </div>
                                <div className="flex justify-between items-center px-3 py-2.5">
                                  <span className="text-slate-500 font-semibold uppercase tracking-wider">{isCar ? "Return" : "Check-out"}</span>
                                  <span className="font-bold text-slate-900">{isCar ? fmt(searchReturnDate) : fmt(searchCheckOut)}</span>
                                </div>
                                <div className="flex justify-between items-center px-3 py-2.5">
                                  <span className="text-slate-500 font-semibold uppercase tracking-wider">Duration</span>
                                  <span className="font-bold text-slate-900">{days} {isCar ? "day" : "night"}{days !== 1 ? "s" : ""}</span>
                                </div>
                                {!isCar && searchAdults > 0 && (
                                  <div className="flex justify-between items-center px-3 py-2.5">
                                    <span className="text-slate-500 font-semibold uppercase tracking-wider">Guests</span>
                                    <span className="font-bold text-slate-900">{searchAdults + searchChildren} guest{searchAdults + searchChildren !== 1 ? "s" : ""}</span>
                                  </div>
                                )}
                              </div>

                              {/* Price breakdown */}
                              <div className="space-y-2 text-sm text-slate-600 border-t border-slate-100 pt-3">
                                <div className="flex justify-between">
                                  <span>{detailListing.currency} {detailListing.pricePerNight.toLocaleString()} × {days} {isCar ? "day" : "night"}{days !== 1 ? "s" : ""}</span>
                                  <span>{detailListing.currency} {base.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-slate-500">
                                  <span>Service fee (5%)</span>
                                  <span>{detailListing.currency} {serviceFee.toLocaleString()}</span>
                                </div>
                                {taxRate > 0 && (
                                  <div className="flex justify-between text-slate-500">
                                    <span>Taxes & VAT ({(taxRate * 100).toFixed(0)}%)</span>
                                    <span>{detailListing.currency} {taxAmount.toLocaleString()}</span>
                                  </div>
                                )}
                                {voucherDiscount > 0 && (
                                  <div className="flex justify-between text-emerald-600">
                                    <span>Voucher discount</span>
                                    <span>−{detailListing.currency} {voucherDiscount.toLocaleString()}</span>
                                  </div>
                                )}
                                {!voucherApplied && (
                                  <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex gap-2 items-center">
                                    <input type="text" placeholder="Promo / voucher code" value={voucherCode}
                                      onChange={(e) => setVoucherCode(e.target.value)}
                                      className="bg-transparent border-0 focus:ring-0 focus:outline-none text-xs text-slate-800 flex-1 min-w-0" />
                                    <button type="button" onClick={handleVoucherApply}
                                      className="text-[10px] font-bold text-[#0B1E3F] border border-[#0B1E3F] px-2.5 py-1 rounded-lg hover:bg-[#0B1E3F] hover:text-white transition shrink-0">Apply</button>
                                  </div>
                                )}
                                {voucherApplied && <p className="text-xs font-semibold text-emerald-600">✓ Voucher applied</p>}
                                {voucherError && <p className="text-xs font-semibold text-red-600">{voucherError}</p>}
                                <div className="flex justify-between font-bold text-slate-900 border-t border-slate-200 pt-2 text-base">
                                  <span>Total</span>
                                  <span>{detailListing.currency} {Math.max(0, grandTotal).toLocaleString()}</span>
                                </div>
                              </div>

                              {/* Countdown */}
                              <div className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold border ${(secondsLeft ?? 0) < 60 ? "bg-red-50 border-red-200 text-red-700" : "bg-amber-50 border-amber-200 text-amber-700"}`}>
                                <span className="flex items-center gap-1.5">
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                  {(secondsLeft ?? 0) < 60 ? "Expiring soon!" : "Hold expires in"}
                                </span>
                                <span className="font-mono tracking-wider">
                                  {Math.floor((secondsLeft || 0) / 60).toString().padStart(2, "0")}:{((secondsLeft || 0) % 60).toString().padStart(2, "0")}
                                </span>
                              </div>

                              <button type="button" onClick={() => { setCheckoutStep("details"); fetchSavedMethods(); }}
                                className="w-full py-3.5 bg-[#0B1E3F] hover:bg-[#07152B] text-white font-bold rounded-xl transition text-sm">
                                Continue to Guest Details →
                              </button>
                              <button type="button" onClick={abandonLock}
                                className="w-full text-center text-xs text-slate-400 hover:text-slate-600 transition">
                                Cancel and release hold
                              </button>
                            </div>
                          );
                        })()}

                        {/* ── STEP 1: Guest details + payment method selection ── */}
                        {checkoutStep === "details" && (<>
                          <div className="space-y-2.5">
                            <div className="grid grid-cols-2 gap-2">
                              <input type="text" required placeholder="First Name" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#0B1E3F]" />
                              <input type="text" required placeholder="Last Name" value={lastName} onChange={(e) => setLastName(e.target.value)} className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#0B1E3F]" />
                            </div>
                            <input type="email" required placeholder="Email Address" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#0B1E3F]" />
                            <input type="tel" placeholder="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#0B1E3F]" />
                            <textarea placeholder="Special requests (optional)" value={specialRequests} onChange={(e) => setSpecialRequests(e.target.value)} rows={2} className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#0B1E3F] resize-none" />
                            {detailListing.category === "car" && (
                              <input type="number" required min="18" max="99" placeholder="Driver Age" value={driverAge} onChange={(e) => setDriverAge(Number(e.target.value))} className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#0B1E3F]" />
                            )}
                          </div>

                          {/* Voucher */}
                          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex gap-2 items-center">
                            <input type="text" placeholder="Promo / voucher code" value={voucherCode} onChange={(e) => setVoucherCode(e.target.value)} className="bg-transparent border-0 focus:ring-0 focus:outline-none text-sm text-slate-800 flex-1 min-w-0" />
                            <button type="button" onClick={handleVoucherApply} className="text-xs font-bold text-[#0B1E3F] border border-[#0B1E3F] px-3 py-1.5 rounded-lg hover:bg-[#0B1E3F] hover:text-white transition shrink-0">Apply</button>
                          </div>
                          {voucherApplied && <p className="text-xs font-semibold text-emerald-600">✓ Voucher applied — {detailListing.currency} {voucherDiscount.toLocaleString()} off</p>}
                          {voucherError && <p className="text-xs font-semibold text-red-600">{voucherError}</p>}

                          {/* Payment method selector */}
                          <div className="border border-slate-200 rounded-xl overflow-hidden">
                            <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200 flex items-center gap-2">
                              <svg className="w-3.5 h-3.5 text-emerald-500 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                              <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">Payment Method</p>
                            </div>
                            <div className="p-4 space-y-3">
                              {/* Saved methods */}
                              {loadingMethods ? (
                                <div className="flex items-center gap-2 text-xs text-slate-400 py-1">
                                  <div className="w-3 h-3 border-2 border-slate-300 border-t-[#0B1E3F] rounded-full animate-spin" />
                                  Loading saved methods…
                                </div>
                              ) : savedMethods.length > 0 && (
                                <div className="space-y-2">
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Saved</p>
                                  {savedMethods.map((m) => {
                                    const isSelected = selectedMethodId === m.id;
                                    const label = m.paymentProvider === "stripe"
                                      ? `${m.cardBrand ?? "Card"} •••• ${m.cardLast4} (${m.cardExpMonth}/${m.cardExpYear})`
                                      : `M-Pesa ••••${m.mobileNumberMasked}`;
                                    return (
                                      <button
                                        key={m.id}
                                        type="button"
                                        onClick={() => {
                                          setSelectedMethodId(m.id);
                                          setPaymentProvider(m.paymentProvider);
                                        }}
                                        className={`w-full flex items-center gap-3 px-3 py-2.5 border rounded-xl text-xs font-semibold transition ${isSelected ? "bg-[#0B1E3F] text-white border-[#0B1E3F]" : "bg-white text-slate-700 border-slate-200 hover:border-slate-400"}`}
                                      >
                                        {m.paymentProvider === "stripe" ? (
                                          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                                        ) : (
                                          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                                        )}
                                        <span className="flex-1 text-left">{label}</span>
                                        {m.isDefault && <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${isSelected ? "bg-white/20" : "bg-slate-100 text-slate-500"}`}>Default</span>}
                                        {isSelected && <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                                      </button>
                                    );
                                  })}
                                  <button
                                    type="button"
                                    onClick={() => { setSelectedMethodId(null); setPaymentProvider("stripe"); }}
                                    className={`w-full flex items-center gap-2 px-3 py-2 border rounded-xl text-xs font-semibold transition ${!selectedMethodId && paymentProvider === "stripe" ? "bg-[#0B1E3F] text-white border-[#0B1E3F]" : "bg-white text-slate-600 border-dashed border-slate-300 hover:border-slate-500"}`}
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                                    Add new card
                                  </button>
                                </div>
                              )}

                              {/* New method buttons — shown when no saved methods or adding new */}
                              {(savedMethods.length === 0 || (!selectedMethodId && paymentProvider === "stripe") || (!selectedMethodId && paymentProvider === "tara")) && (
                                <div className="space-y-2">
                                  {savedMethods.length === 0 && (
                                    <div className="flex gap-2">
                                      <button type="button" onClick={() => { setPaymentProvider("stripe"); setSelectedMethodId(null); }}
                                        className={`flex-1 py-2.5 border rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition ${!selectedMethodId && paymentProvider === "stripe" ? "bg-[#0B1E3F] text-white border-[#0B1E3F]" : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"}`}>
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                                        Card
                                      </button>
                                      <button type="button" onClick={() => { setPaymentProvider("tara"); setSelectedMethodId(null); }}
                                        className={`flex-1 py-2.5 border rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition ${!selectedMethodId && paymentProvider === "tara" ? "bg-[#0B1E3F] text-white border-[#0B1E3F]" : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"}`}>
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                                        M-Pesa
                                      </button>
                                    </div>
                                  )}
                                  {paymentProvider === "tara" && !selectedMethodId && (
                                    <input type="tel" required placeholder="Mobile number e.g. +254712345678" value={mobileNumber}
                                      onChange={(e) => setMobileNumber(e.target.value)}
                                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#0B1E3F]" />
                                  )}
                                  {paymentProvider === "stripe" && !selectedMethodId && (
                                    <p className="text-[10px] text-slate-400 flex items-center gap-1.5">
                                      <svg className="w-3 h-3 text-emerald-500 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                                      You will enter card details on the next step
                                    </p>
                                  )}
                                </div>
                              )}

                              {/* M-Pesa input for saved tara method that needs number override */}
                              {selectedMethodId && paymentProvider === "tara" && (
                                <p className="text-[10px] text-slate-400 flex items-center gap-1.5">
                                  <svg className="w-3 h-3 text-emerald-500 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                  Payment prompt will be sent to your saved M-Pesa number
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Price summary */}
                          {(() => {
                            const isCar = detailListing.category === "car";
                            const start = isCar ? searchPickupDate : searchCheckIn;
                            const end = isCar ? searchReturnDate : searchCheckOut;
                            const days = calcDays(start, end);
                            const baseTotal = detailListing.pricePerNight * days;
                            const serviceFee = Math.ceil(baseTotal * 0.05);
                            const grandTotal = baseTotal + serviceFee - voucherDiscount;
                            return (
                              <div className="space-y-2 text-sm text-slate-600 border-t border-slate-100 pt-3">
                                <div className="flex justify-between">
                                  <span>{detailListing.currency} {detailListing.pricePerNight.toLocaleString()} × {days} {isCar ? "day" : "night"}{days > 1 ? "s" : ""}</span>
                                  <span>{detailListing.currency} {baseTotal.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between"><span>Service fee (5%)</span><span>{detailListing.currency} {serviceFee.toLocaleString()}</span></div>
                                {voucherDiscount > 0 && <div className="flex justify-between text-emerald-600"><span>Voucher discount</span><span>−{detailListing.currency} {voucherDiscount.toLocaleString()}</span></div>}
                                <div className="flex justify-between font-bold text-slate-900 border-t border-slate-200 pt-2">
                                  <span>Total to pay</span>
                                  <span>{detailListing.currency} {Math.max(0, grandTotal).toLocaleString()}</span>
                                </div>
                              </div>
                            );
                          })()}

                          {bookingError && (
                            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 space-y-2">
                              <p className="text-xs font-semibold text-red-600">{bookingError}</p>
                              {bookingError.toLowerCase().includes("pending") && (
                                <div className="space-y-2 pt-1">
                                  {loadingInlinePending && (
                                    <div className="flex items-center gap-2 text-xs text-red-500">
                                      <div className="w-3 h-3 border-2 border-red-300 border-t-red-600 rounded-full animate-spin" />
                                      Loading pending reservations…
                                    </div>
                                  )}
                                  {inlinePending.length === 0 && !loadingInlinePending && (
                                    <button type="button" onClick={fetchInlinePending}
                                      className="w-full py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition">
                                      Show pending reservations
                                    </button>
                                  )}
                                  {inlinePending.map((b) => (
                                    <div key={b.id} className="flex items-center justify-between gap-2 bg-white border border-red-200 rounded-lg px-3 py-2">
                                      <div className="min-w-0">
                                        <p className="text-xs font-bold text-slate-800 truncate">{b.listingTitle || "Reservation"}</p>
                                        <p className="text-[10px] text-slate-400 font-mono">{b.reference}</p>
                                      </div>
                                      <button type="button"
                                        onClick={() => handleInlineCancel(b.id)}
                                        disabled={inlineCancellingId === b.id}
                                        className="shrink-0 px-2.5 py-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg text-[10px] font-bold transition">
                                        {inlineCancellingId === b.id ? "…" : "Cancel"}
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                          <button type="button" onClick={handleContinueToReview} className="w-full py-3.5 bg-[#0B1E3F] hover:bg-[#07152B] text-white font-bold rounded-xl transition text-sm mt-1">
                            Continue to Review →
                          </button>
                          <button type="button" onClick={abandonLock} className="w-full text-center text-xs text-slate-400 hover:text-slate-600 transition mt-1">
                            Cancel and release hold
                          </button>
                        </>)}

                        {/* ── STEP 2: Stripe card element (mounted by useEffect) ── */}
                        {checkoutStep === "stripe_card" && (
                          <div className="space-y-4">
                            <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">Enter Card Details</p>
                            <div ref={stripeCardRef} className="bg-white border border-slate-300 rounded-lg px-3 py-3 min-h-[44px]" />
                            <p className="text-[10px] text-slate-400 flex items-center gap-1.5">
                              <svg className="w-3 h-3 text-emerald-500 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                              256-bit SSL encrypted · Powered by Stripe
                            </p>
                            {bookingError && (
                              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 space-y-2">
                                <p className="text-xs font-semibold text-red-600">{bookingError}</p>
                                {bookingError.toLowerCase().includes("pending") && (
                                  <div className="space-y-2 pt-1">
                                    {loadingInlinePending && (
                                      <div className="flex items-center gap-2 text-xs text-red-500">
                                        <div className="w-3 h-3 border-2 border-red-300 border-t-red-600 rounded-full animate-spin" />
                                        Loading pending reservations…
                                      </div>
                                    )}
                                    {inlinePending.length === 0 && !loadingInlinePending && (
                                      <button type="button" onClick={fetchInlinePending}
                                        className="w-full py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition">
                                        Show pending reservations
                                      </button>
                                    )}
                                    {inlinePending.map((b) => (
                                      <div key={b.id} className="flex items-center justify-between gap-2 bg-white border border-red-200 rounded-lg px-3 py-2">
                                        <div className="min-w-0">
                                          <p className="text-xs font-bold text-slate-800 truncate">{b.listingTitle || "Reservation"}</p>
                                          <p className="text-[10px] text-slate-400 font-mono">{b.reference}</p>
                                        </div>
                                        <button type="button"
                                          onClick={() => handleInlineCancel(b.id)}
                                          disabled={inlineCancellingId === b.id}
                                          className="shrink-0 px-2.5 py-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg text-[10px] font-bold transition">
                                          {inlineCancellingId === b.id ? "…" : "Cancel"}
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                            <button type="button" onClick={handleStripeConfirm} disabled={submittingCheckout || !stripeCardElement}
                              className="w-full py-3.5 bg-[#635BFF] hover:bg-[#4f48cc] disabled:opacity-50 text-white font-bold rounded-xl transition text-sm">
                              {submittingCheckout ? "Processing…" : `Pay ${detailListing.currency} ${pendingBookingAmount.toLocaleString()}`}
                            </button>
                            <button type="button" onClick={() => { setCheckoutStep("details"); setBookingError(""); }}
                              className="w-full text-center text-xs text-slate-400 hover:text-slate-600 transition">
                              ← Back
                            </button>
                          </div>
                        )}

                        {/* ── STEP 3: Polling / waiting for payment confirmation ── */}
                        {checkoutStep === "polling" && (
                          <div className="space-y-4 text-center py-4">
                            {paymentProvider === "tara" ? (<>
                              <div className="w-14 h-14 rounded-full bg-green-50 border border-green-200 flex items-center justify-center mx-auto text-2xl">📱</div>
                              <p className="font-bold text-slate-800">Check your phone!</p>
                              <p className="text-xs text-slate-500">A payment prompt has been sent to your M-Pesa number. Please approve it to complete your booking.</p>
                            </>) : (<>
                              <div className="w-14 h-14 rounded-full bg-green-50 border border-green-200 flex items-center justify-center mx-auto">
                                <div className="w-6 h-6 border-3 border-[#635BFF] border-t-transparent rounded-full animate-spin" />
                              </div>
                              <p className="font-bold text-slate-800">Processing payment…</p>
                            </>)}
                            <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400">
                              <div className="w-2 h-2 rounded-full bg-slate-300 animate-pulse" />
                              <div className="w-2 h-2 rounded-full bg-slate-300 animate-pulse" style={{ animationDelay: "0.3s" }} />
                              <div className="w-2 h-2 rounded-full bg-slate-300 animate-pulse" style={{ animationDelay: "0.6s" }} />
                            </div>
                            {bookingError && (
                              <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 space-y-2">
                                <p className="text-xs font-semibold text-red-600">{bookingError}</p>
                                {bookingError.toLowerCase().includes("pending") && (
                                  <div className="space-y-2 pt-1">
                                    {loadingInlinePending && (
                                      <div className="flex items-center gap-2 text-xs text-red-500">
                                        <div className="w-3 h-3 border-2 border-red-300 border-t-red-600 rounded-full animate-spin" />
                                        Loading pending reservations…
                                      </div>
                                    )}
                                    {inlinePending.length === 0 && !loadingInlinePending && (
                                      <button type="button" onClick={fetchInlinePending}
                                        className="w-full py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition">
                                        Show pending reservations
                                      </button>
                                    )}
                                    {inlinePending.map((b) => (
                                      <div key={b.id} className="flex items-center justify-between gap-2 bg-white border border-red-200 rounded-lg px-3 py-2">
                                        <div className="min-w-0">
                                          <p className="text-xs font-bold text-slate-800 truncate">{b.listingTitle || "Reservation"}</p>
                                          <p className="text-[10px] text-slate-400 font-mono">{b.reference}</p>
                                        </div>
                                        <button type="button"
                                          onClick={() => handleInlineCancel(b.id)}
                                          disabled={inlineCancellingId === b.id}
                                          className="shrink-0 px-2.5 py-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg text-[10px] font-bold transition">
                                          {inlineCancellingId === b.id ? "…" : "Cancel"}
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </form>
                    )}

                    <div className="flex items-center justify-center gap-2 mt-5 text-slate-400 text-xs font-medium hover:text-slate-600 cursor-pointer transition">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" /></svg>
                      Report this listing
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="lg:col-span-12 py-24 text-center text-slate-500">
                <p className="text-lg font-semibold">Reservation details are unavailable.</p>
                <p className="mt-2 text-sm">Please go back to search or select a different listing.</p>
                <button
                  onClick={() => { setSelectedListingId(null); setActiveTab("home"); }}
                  className="mt-6 inline-flex items-center justify-center rounded-full bg-[#0B1E3F] px-6 py-3 text-sm font-semibold text-white hover:bg-[#07152B] transition"
                >
                  Return to Search
                </button>
              </div>
            )}
          </div>
        ) : activeTab === "home" ? (
          // VIEW 1: FULL HOME PAGE — Hero + Popular Destinations + Featured + Promotions + Why Us + Footer
          <div>
            {/* Cinematic Hero header wrapper */}
            <div className="relative aspect-[21/9] w-full min-h-[480px] bg-slate-900/10 flex items-center justify-center overflow-hidden">
              <img
                src="https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=1600&q=80"
                alt="Premium Pool Villa"
                className="absolute inset-0 w-full h-full object-cover opacity-85 scale-105 "
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/40 via-transparent to-black/10"></div>

              <div className="relative z-10 max-w-4xl mx-auto px-6 text-center space-y-8">
                <h1 className="text-4xl md:text-6xl font-serif font-bold text-white leading-tight drop-shadow-xl">
                  Discover your next<br />extraordinary escape
                </h1>

                {/* Floating Search tabbed Glassmorphism Card */}
                <div className="bg-white/80 backdrop-blur-xl border border-white/50 rounded-3xl p-6 shadow-2xl max-w-3xl mx-auto">
                  <div className="flex border-b border-slate-200/50 pb-3 mb-5 gap-6">
                    {[
                      {
                        type: "hotel",
                        icon: (
                          <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                        ),
                        label: "Hotels"
                      },
                      {
                        type: "apartment",
                        icon: (
                          <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                          </svg>
                        ),
                        label: "Apartments"
                      },
                      {
                        type: "car",
                        icon: (
                          <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
                            <circle cx="7" cy="17" r="2" />
                            <path d="M9 17h6" />
                            <circle cx="17" cy="17" r="2" />
                          </svg>
                        ),
                        label: "Car Rentals"
                      }
                    ].map((tab) => (
                      <button
                        key={tab.type}
                        onClick={() => {
                          const cat = tab.type as "hotel" | "apartment" | "car";
                          setSearchCategory(cat);
                          // Show inline dropdown — no page navigation
                          loadQuickResults(cat);
                        }}
                        className={`flex items-center gap-2 pb-2 text-sm font-semibold border-b-2 transition ${searchCategory === tab.type ? "border-[#0B1E3F] text-[#0B1E3F]" : "border-transparent text-slate-400 hover:text-[#0B1E3F]"}`}
                      >
                        {tab.icon}
                        <span>{tab.label}</span>
                      </button>
                    ))}
                  </div>

                  {/* Search Form */}
                  <form onSubmit={handleSearch} className="space-y-3 text-left">
                    {/* Row 1: Destination + Dates */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {/* Destination with live Nominatim autocomplete */}
                      <div className="relative md:col-span-1">
                        <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Destination</label>
                        <div className="relative flex items-center">
                          <svg className="absolute left-3 w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <input
                            type="text"
                            required
                            placeholder="City, hotel, or landmark…"
                            value={searchDestination}
                            onChange={(e) => {
                              const val = e.target.value;
                              setSearchDestination(val);
                              setShowSuggestions(true);
                              if (nominatimTimer.current) clearTimeout(nominatimTimer.current);
                              if (val.length >= 2) {
                                nominatimTimer.current = setTimeout(async () => {
                                  try {
                                    const r = await fetch(
                                      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(val)}&format=json&limit=5&addressdetails=0`,
                                      { headers: { "Accept-Language": "en", "User-Agent": "Kainook/1.0" } }
                                    );
                                    const data = await r.json();
                                    setNominatimResults(Array.isArray(data) ? data : []);
                                  } catch { setNominatimResults([]); }
                                }, 320);
                              } else {
                                setNominatimResults([]);
                              }
                            }}
                            onFocus={() => setShowSuggestions(true)}
                            onBlur={() => setTimeout(() => { setShowSuggestions(false); setNominatimResults([]); }, 220)}
                            className="w-full pl-8 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-700 focus:outline-none focus:border-[#0B1E3F]"
                          />
                        </div>
                        {/* Autocomplete dropdown — Nominatim results first, fallback to previous search towns */}
                        {showSuggestions && (nominatimResults.length > 0 || apiSuggestions.filter(s => s.toLowerCase().includes(searchDestination.toLowerCase())).length > 0) && (
                          <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200/80 rounded-xl shadow-2xl z-50 overflow-hidden max-h-56 overflow-y-auto">
                            {nominatimResults.length > 0 ? nominatimResults.map((r, i) => (
                              <button
                                key={i}
                                type="button"
                                onMouseDown={() => { setSearchDestination(r.display_name.split(",").slice(0, 2).join(",").trim()); setShowSuggestions(false); setNominatimResults([]); }}
                                className="w-full px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-[#0B1E3F] hover:text-white transition-colors text-left flex items-center gap-2"
                              >
                                <svg className="w-3.5 h-3.5 shrink-0 opacity-60" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                <span className="truncate">{r.display_name.split(",").slice(0, 3).join(", ")}</span>
                              </button>
                            )) : apiSuggestions.filter(s => s.toLowerCase().includes(searchDestination.toLowerCase())).map((s, i) => (
                              <button key={i} type="button" onMouseDown={() => { setSearchDestination(s); setShowSuggestions(false); }} className="w-full px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-[#0B1E3F] hover:text-white transition-colors text-left flex items-center gap-2">
                                <svg className="w-3.5 h-3.5 shrink-0 opacity-60" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                                <span className="truncate">{s}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Date inputs — custom styled, native picker underneath */}
                      {searchCategory === "car" ? (
                        <>
                          <StyledDateInput label="Pickup Date" value={searchPickupDate} onChange={setSearchPickupDate} min={getTodayString()} required />
                          <StyledDateInput label="Return Date" value={searchReturnDate} onChange={setSearchReturnDate} min={searchPickupDate || getTodayString()} required />
                        </>
                      ) : (
                        <>
                          <StyledDateInput label="Check-in" value={searchCheckIn} onChange={setSearchCheckIn} min={getTodayString()} required />
                          <StyledDateInput label="Check-out" value={searchCheckOut} onChange={setSearchCheckOut} min={searchCheckIn || getTodayString()} required />
                        </>
                      )}
                    </div>

                    {/* Row 2: Guests picker + Search button */}
                    <div className="flex gap-3 items-end">
                      {/* Guest picker — hidden for cars */}
                      {searchCategory !== "car" && (
                        <div className="relative flex-1">
                          <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Guests</label>
                          <button
                            type="button"
                            onClick={() => setShowGuestPicker((v) => !v)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-700 focus:outline-none focus:border-[#0B1E3F] flex items-center justify-between"
                          >
                            <span className="flex items-center gap-2">
                              <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              {searchAdults} adult{searchAdults !== 1 ? "s" : ""}
                              {searchChildren > 0 && `, ${searchChildren} child${searchChildren !== 1 ? "ren" : ""}`}
                              {searchRooms > 1 && `, ${searchRooms} rooms`}
                            </span>
                            <svg className={`w-3 h-3 text-slate-400 transition-transform ${showGuestPicker ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>

                          {showGuestPicker && (
                            <div className="absolute top-full left-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 w-64 p-4 space-y-1">
                              {/* Adults */}
                              <div className="flex items-center justify-between py-3 border-b border-slate-100">
                                <div>
                                  <p className="text-sm font-semibold text-slate-800">Adults</p>
                                  <p className="text-[10px] text-slate-400">Age 13+</p>
                                </div>
                                <div className="flex items-center gap-3">
                                  <button type="button" onClick={() => setSearchAdults((a) => Math.max(1, a - 1))} className="w-7 h-7 rounded-full border border-slate-300 flex items-center justify-center text-slate-600 hover:bg-slate-50 disabled:opacity-30 text-lg font-light" disabled={searchAdults <= 1}>−</button>
                                  <span className="w-5 text-center text-sm font-bold text-slate-900">{searchAdults}</span>
                                  <button type="button" onClick={() => setSearchAdults((a) => Math.min(16, a + 1))} className="w-7 h-7 rounded-full border border-slate-300 flex items-center justify-center text-slate-600 hover:bg-slate-50 text-lg font-light">+</button>
                                </div>
                              </div>
                              {/* Children */}
                              <div className="flex items-center justify-between py-3 border-b border-slate-100">
                                <div>
                                  <p className="text-sm font-semibold text-slate-800">Children</p>
                                  <p className="text-[10px] text-slate-400">Ages 2–12</p>
                                </div>
                                <div className="flex items-center gap-3">
                                  <button type="button" onClick={() => setSearchChildren((c) => Math.max(0, c - 1))} className="w-7 h-7 rounded-full border border-slate-300 flex items-center justify-center text-slate-600 hover:bg-slate-50 disabled:opacity-30 text-lg font-light" disabled={searchChildren <= 0}>−</button>
                                  <span className="w-5 text-center text-sm font-bold text-slate-900">{searchChildren}</span>
                                  <button type="button" onClick={() => setSearchChildren((c) => Math.min(10, c + 1))} className="w-7 h-7 rounded-full border border-slate-300 flex items-center justify-center text-slate-600 hover:bg-slate-50 text-lg font-light">+</button>
                                </div>
                              </div>
                              {/* Rooms */}
                              <div className="flex items-center justify-between py-3">
                                <div>
                                  <p className="text-sm font-semibold text-slate-800">Rooms</p>
                                  <p className="text-[10px] text-slate-400">Number of rooms</p>
                                </div>
                                <div className="flex items-center gap-3">
                                  <button type="button" onClick={() => setSearchRooms((r) => Math.max(1, r - 1))} className="w-7 h-7 rounded-full border border-slate-300 flex items-center justify-center text-slate-600 hover:bg-slate-50 disabled:opacity-30 text-lg font-light" disabled={searchRooms <= 1}>−</button>
                                  <span className="w-5 text-center text-sm font-bold text-slate-900">{searchRooms}</span>
                                  <button type="button" onClick={() => setSearchRooms((r) => Math.min(8, r + 1))} className="w-7 h-7 rounded-full border border-slate-300 flex items-center justify-center text-slate-600 hover:bg-slate-50 text-lg font-light">+</button>
                                </div>
                              </div>
                              <button type="button" onClick={() => setShowGuestPicker(false)} className="w-full py-2 bg-[#0B1E3F] text-white text-xs font-bold rounded-xl mt-2">Done</button>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Search button */}
                      <button
                        type="submit"
                        disabled={searching}
                        className="flex-1 sm:flex-none sm:min-w-[120px] py-2.5 bg-[#0B1E3F] hover:bg-[#07152B] disabled:opacity-60 text-white font-bold rounded-xl transition shadow-md flex items-center justify-center gap-2 text-xs uppercase tracking-wider"
                      >
                        {searching ? (
                          <><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Searching</>
                        ) : (
                          <><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg> Search</>
                        )}
                      </button>
                    </div>
                  </form>

                  {/* ── Quick-result dropdown (Hotels / Apartments / Car Rentals tab click) ── */}
                  {showQuickDrop && (
                    <div className="mt-4 border-t border-slate-200/60 pt-4">
                      {loadingQuickDrop ? (
                        <div className="py-5 flex items-center justify-center gap-2 text-xs text-slate-500">
                          <div className="w-4 h-4 border-2 border-[#0B1E3F] border-t-transparent rounded-full animate-spin" />
                          Loading {searchCategory === "car" ? "cars" : searchCategory + "s"}…
                        </div>
                      ) : quickResults.length === 0 ? (
                        <p className="py-4 text-center text-xs text-slate-400">No listings found — try a different location.</p>
                      ) : (
                        <>
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                              Top {searchCategory === "car" ? "Car Rentals" : searchCategory === "apartment" ? "Apartments" : "Hotels"}
                            </p>
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                onClick={() => { setShowQuickDrop(false); handleSearch(undefined, searchCategory); }}
                                className="text-[10px] font-bold text-[#0B1E3F] hover:underline uppercase tracking-wide"
                              >
                                View all →
                              </button>
                              <button type="button" onClick={() => setShowQuickDrop(false)} className="text-slate-400 hover:text-slate-600 transition">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                              </button>
                            </div>
                          </div>
                          <div className="space-y-1 max-h-72 overflow-y-auto">
                            {quickResults.map((listing) => (
                              <button
                                key={listing.id}
                                type="button"
                                onClick={() => { setShowQuickDrop(false); handleSelectListing(listing.id); }}
                                className="w-full flex items-center gap-3 p-2.5 rounded-xl hover:bg-[#0B1E3F]/5 transition-colors text-left group"
                              >
                                <div className="w-12 h-12 bg-slate-200 rounded-xl overflow-hidden shrink-0">
                                  <ListingImage
                                    listingId={listing.id}
                                    alt={listing.name}
                                    className="w-full h-full object-cover"
                                    fallbackNode={
                                      <div className="w-full h-full flex items-center justify-center text-xl text-slate-400">
                                        {searchCategory === "car" ? "🚗" : searchCategory === "apartment" ? "🏠" : "🏨"}
                                      </div>
                                    }
                                  />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-bold text-slate-800 truncate group-hover:text-[#0B1E3F] transition-colors">{listing.name}</p>
                                  <p className="text-[10px] text-slate-400 truncate mt-0.5">
                                    📍 {listing.town}{listing.country ? `, ${listing.country}` : ""}
                                    {listing.starRating ? `  ·  ⭐ ${listing.starRating}` : ""}
                                  </p>
                                </div>
                                <div className="shrink-0 text-right">
                                  <p className="text-sm font-black text-[#0B1E3F]">
                                    {listing.currency} {(listing.pricePerNight || 0).toLocaleString()}
                                  </p>
                                  <p className="text-[10px] text-slate-400">/{searchCategory === "car" ? "day" : "night"}</p>
                                </div>
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── POPULAR DESTINATIONS ── */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 py-14">
              <div className="flex items-end justify-between mb-8">
                <div>
                  <p className="text-xs font-bold text-[#0B1E3F] uppercase tracking-widest mb-1">Explore</p>
                  <h2 className="text-3xl font-serif font-bold text-slate-900">Popular Destinations</h2>
                </div>
                <button
                  onClick={() => { setActiveTab("search"); handleSearch(undefined, "hotel"); }}
                  className="text-xs font-bold text-[#0B1E3F] underline underline-offset-2 hover:opacity-70 transition hidden sm:block"
                >
                  View all →
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
                {POPULAR_DESTINATIONS.map((dest) => (
                  <button
                    key={dest.name}
                    type="button"
                    onClick={() => {
                      const full = `${dest.name}, ${dest.country}`;
                      setSearchDestination(full);
                      handleSearch(undefined, "hotel", full);
                    }}
                    className="group relative aspect-[3/4] rounded-2xl overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer"
                  >
                    <div className={`absolute inset-0 bg-gradient-to-b ${dest.from} ${dest.to}`} />
                    <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors" />
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-3">
                      <span className="text-4xl mb-2 drop-shadow">{dest.icon}</span>
                      <p className="text-white font-bold text-sm leading-tight drop-shadow">{dest.name}</p>
                      <p className="text-white/75 text-[10px] font-semibold uppercase tracking-wider mt-0.5">{dest.country}</p>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            {/* ── FEATURED LISTINGS ── */}
            <section className="bg-slate-50/80 py-14 border-y border-slate-200/60">
              <div className="max-w-7xl mx-auto px-4 sm:px-6">
                <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
                  <div>
                    <p className="text-xs font-bold text-[#0B1E3F] uppercase tracking-widest mb-1">Top picks</p>
                    <h2 className="text-3xl font-serif font-bold text-slate-900">Featured Listings</h2>
                  </div>
                  {/* Category switcher */}
                  <div className="flex gap-2">
                    {([{ key: "hotel", label: "Hotels" }, { key: "apartment", label: "Apartments" }, { key: "car", label: "Cars" }] as const).map(({ key, label }) => (
                      <button
                        key={key}
                        onClick={() => loadFeaturedListings(key)}
                        className={`px-4 py-2 rounded-full text-xs font-bold border transition ${featuredCategory === key
                          ? "bg-[#0B1E3F] text-white border-[#0B1E3F]"
                          : "bg-white text-slate-600 border-slate-200 hover:border-[#0B1E3F]"
                          }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {loadingFeatured ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {[1, 2, 3, 4].map((n) => (
                      <div key={n} className="animate-pulse bg-white rounded-3xl overflow-hidden border border-slate-100 shadow-sm">
                        <div className="aspect-[4/3] bg-slate-200" />
                        <div className="p-4 space-y-2">
                          <div className="h-2.5 bg-slate-200 rounded w-1/3" />
                          <div className="h-4 bg-slate-200 rounded w-3/4" />
                          <div className="h-3 bg-slate-200 rounded w-1/2" />
                          <div className="border-t border-slate-100 pt-2.5 flex justify-between">
                            <div className="h-5 bg-slate-200 rounded w-24" />
                            <div className="h-7 bg-slate-200 rounded w-20" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : featuredListings.length === 0 ? (
                  <div className="text-center py-16 text-slate-400 text-sm font-semibold">
                    No featured listings available right now.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                    {featuredListings.slice(0, 8).map((listing) => (
                      <ListingCard key={listing.id} listing={listing} onSelect={handleSelectListing} />
                    ))}
                  </div>
                )}

                {!loadingFeatured && featuredListings.length > 0 && (
                  <div className="text-center mt-8">
                    <button
                      onClick={() => { setSearchCategory(featuredCategory); setActiveTab("search"); handleSearch(undefined, featuredCategory); }}
                      className="inline-flex items-center gap-2 px-6 py-3 border-2 border-[#0B1E3F] text-[#0B1E3F] font-bold text-sm rounded-xl hover:bg-[#0B1E3F] hover:text-white transition"
                    >
                      View all {featuredCategory === "car" ? "cars" : featuredCategory + "s"}
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                    </button>
                  </div>
                )}
              </div>
            </section>

            {/* ── PROMOTIONS ── */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 py-14">
              <div className="mb-8">
                <p className="text-xs font-bold text-[#0B1E3F] uppercase tracking-widest mb-1">Limited time</p>
                <h2 className="text-3xl font-serif font-bold text-slate-900">Special Offers</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* Promo 1 */}
                <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-[#0B1E3F] to-[#1a3a6f] p-7 text-white flex flex-col justify-between min-h-[180px] shadow-lg shadow-blue-900/20 cursor-pointer hover:-translate-y-1 transition-transform"
                  onClick={() => { setSearchDestination("Nairobi, Kenya"); handleSearch(undefined, "hotel", "Nairobi, Kenya"); }}>
                  <div className="absolute top-4 right-4 text-5xl opacity-20">🏨</div>
                  <div>
                    <span className="bg-[#E31C5F] text-white text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full">Promo</span>
                    <h3 className="text-xl font-serif font-bold mt-3 leading-tight">Up to 20% off<br />Hotel Stays</h3>
                    <p className="text-green-200 text-xs mt-1.5">Limited availability · Book now</p>
                  </div>
                  <button className="self-start mt-4 bg-white/15 hover:bg-white/25 text-white text-xs font-bold px-4 py-2 rounded-xl transition">
                    Explore Hotels →
                  </button>
                </div>
                {/* Promo 2 */}
                <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-emerald-600 to-teal-700 p-7 text-white flex flex-col justify-between min-h-[180px] shadow-lg shadow-emerald-900/20 cursor-pointer hover:-translate-y-1 transition-transform"
                  onClick={() => { setSearchDestination("Mombasa, Kenya"); handleSearch(undefined, "apartment", "Mombasa, Kenya"); }}>
                  <div className="absolute top-4 right-4 text-5xl opacity-20">🏠</div>
                  <div>
                    <span className="bg-white/20 text-white text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full">Weekend deal</span>
                    <h3 className="text-xl font-serif font-bold mt-3 leading-tight">Beach Apartments<br />from KES 8,000</h3>
                    <p className="text-emerald-200 text-xs mt-1.5">Mombasa · Coast region</p>
                  </div>
                  <button className="self-start mt-4 bg-white/15 hover:bg-white/25 text-white text-xs font-bold px-4 py-2 rounded-xl transition">
                    Browse Apartments →
                  </button>
                </div>
                {/* Promo 3 */}
                <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-amber-500 to-orange-600 p-7 text-white flex flex-col justify-between min-h-[180px] shadow-lg shadow-orange-900/20 cursor-pointer hover:-translate-y-1 transition-transform"
                  onClick={() => handleSearch(undefined, "car")}>
                  <div className="absolute top-4 right-4 text-5xl opacity-20">🚗</div>
                  <div>
                    <span className="bg-white/20 text-white text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full">Best price</span>
                    <h3 className="text-xl font-serif font-bold mt-3 leading-tight">Car Rentals<br />from KES 5,000/day</h3>
                    <p className="text-amber-100 text-xs mt-1.5">Self-drive · Chauffeur available</p>
                  </div>
                  <button className="self-start mt-4 bg-white/15 hover:bg-white/25 text-white text-xs font-bold px-4 py-2 rounded-xl transition">
                    Find a Car →
                  </button>
                </div>
              </div>
            </section>

            {/* ── RECENTLY VIEWED ── */}
            {recentlyViewed.length > 0 && (
              <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-8">
                <h2 className="text-2xl font-serif font-bold text-slate-900 mb-6">Recently Viewed</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {recentlyViewed.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleSelectListing(item.id)}
                      className="group flex items-center gap-3 bg-white border border-slate-100 rounded-2xl p-3 hover:shadow-md hover:border-slate-200 transition text-left w-full"
                    >
                      <div className="w-16 h-16 bg-slate-100 rounded-xl overflow-hidden shrink-0">
                        <ListingImage
                          listingId={item.id}
                          alt={item.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[#0B1E3F] uppercase tracking-wider">{item.category}</p>
                        <p className="text-sm font-bold text-slate-900 line-clamp-1 group-hover:text-[#0B1E3F] transition">{item.name}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{item.currency} {item.pricePerNight.toLocaleString()} / {item.category === "car" ? "day" : "night"}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* ── WHY CHOOSE US ── */}
            <section className="bg-[#0B1E3F] py-16">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center">
                <p className="text-xs font-bold text-green-300 uppercase tracking-widest mb-2">Why Kainook </p>
                <h2 className="text-3xl font-serif font-bold text-white mb-12">The smarter way to travel</h2>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
                  {[
                    { icon: "🔒", title: "Secure Payments", desc: "Stripe & Tara encrypted checkout. Your card data is never stored." },
                    { icon: "💰", title: "Best Price Guarantee", desc: "Find a lower price? We'll match it. No hidden fees." },
                    { icon: "✅", title: "Verified Listings", desc: "Every property is reviewed and accredited before it's listed." },
                    { icon: "☎️", title: "24/7 Support", desc: "Dedicated support team available around the clock." },
                  ].map((item) => (
                    <div key={item.title} className="flex flex-col items-center gap-3 text-center">
                      <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center text-2xl">{item.icon}</div>
                      <p className="text-white font-bold text-sm">{item.title}</p>
                      <p className="text-green-200 text-xs leading-relaxed">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* ── FOOTER ── */}
            <footer className="bg-slate-900 text-slate-400 py-12">
              <div className="max-w-7xl mx-auto px-4 sm:px-6">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 mb-10">
                  {/* Brand */}
                  <div className="col-span-2 sm:col-span-1">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="bg-white text-[#0B1E3F] font-bold text-sm px-2.5 py-1 rounded-lg">Kainook </span>
                      <span className="text-white font-bold"></span>
                    </div>
                    <p className="text-xs leading-relaxed">Your gateway to premium stays, apartments and car rentals across Africa and beyond.</p>
                  </div>
                  {/* Company */}
                  <div>
                    <p className="text-white text-xs font-bold uppercase tracking-widest mb-3">Company</p>
                    <ul className="space-y-2 text-xs">
                      {["About Us", "Careers", "Press", "Blog"].map(l => <li key={l}><a href="#" className="hover:text-white transition">{l}</a></li>)}
                    </ul>
                  </div>
                  {/* Support */}
                  <div>
                    <p className="text-white text-xs font-bold uppercase tracking-widest mb-3">Support</p>
                    <ul className="space-y-2 text-xs">
                      {["Help Center", "Contact Us", "Cancellation", "Safety"].map(l => <li key={l}><a href="#" className="hover:text-white transition">{l}</a></li>)}
                    </ul>
                  </div>
                  {/* Legal */}
                  <div>
                    <p className="text-white text-xs font-bold uppercase tracking-widest mb-3">Legal</p>
                    <ul className="space-y-2 text-xs">
                      {["Privacy Policy", "Terms of Service", "Cookie Policy", "Sitemap"].map(l => <li key={l}><a href="#" className="hover:text-white transition">{l}</a></li>)}
                    </ul>
                  </div>
                </div>
                <div className="border-t border-slate-800 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <p className="text-xs">© {new Date().getFullYear()} Kainook All rights reserved.</p>
                  <div className="flex items-center gap-4">
                    {[
                      { label: "Twitter/X", path: "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" },
                      { label: "Instagram", path: "M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" },
                      { label: "LinkedIn", path: "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" },
                    ].map(({ label, path }) => (
                      <a key={label} href="#" aria-label={label} className="hover:text-white transition">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d={path} /></svg>
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </footer>
          </div>
        ) : activeTab === "search" ? (
          // VIEW 2: DYNAMIC SPLIT SEARCH RESULTS VIEW & COORDINATE PRICE MAP
          <div className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 relative">
            <div className="lg:col-span-12 flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200/60">
              <div className="text-left">
                <h1 className="text-2xl font-serif font-bold text-slate-900 capitalize">
                  {searchCategory === "car" ? "Cars" : `${searchCategory.charAt(0).toUpperCase() + searchCategory.slice(1)}s`} in {searchDestination.split(",")[0]}
                </h1>
                <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider mt-0.5">
                  {searching ? "Searching..." : `${totalCount > 0 ? totalCount : listings.length} match${(totalCount || listings.length) !== 1 ? "es" : ""} found`}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {/* Quick sort dropdown in header (mirrors sidebar) */}
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="hidden sm:block bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none shadow-sm"
                >
                  <option value="distance_asc">Nearest First</option>
                  <option value="price_asc">Price ↑</option>
                  <option value="price_desc">Price ↓</option>
                  <option value="rating_desc">Best Rated</option>
                  <option value="popularity_desc">Popular</option>
                </select>
                <button
                  onClick={() => { setActiveTab("home"); setSelectedListingId(null); }}
                  className="text-xs font-bold text-[#0B1E3F] border border-[#0B1E3F] px-3 py-2 rounded-xl hover:bg-[#0B1E3F] hover:text-white transition uppercase tracking-wide"
                >
                  New Search
                </button>
              </div>
            </div>

            {/* Mobile filter + sort bar (hidden on desktop) */}
            <div className="lg:hidden col-span-1 flex items-center gap-2">
              <button
                onClick={() => setShowFiltersDrawer(true)}
                className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-700 shadow-sm hover:border-slate-400 transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
                </svg>
                Filters
                {(showInstantOnly || selectedAmenities.length > 0 || !!selectedRating || priceMin > 0 || priceMax < 499999) && (
                  <span className="w-2 h-2 rounded-full bg-[#E31C5F] inline-block" />
                )}
              </button>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="flex-1 bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-700 focus:outline-none shadow-sm"
              >
                <option value="distance_asc">Nearest First</option>
                <option value="price_asc">Price: Low → High</option>
                <option value="price_desc">Price: High → Low</option>
                <option value="rating_desc">Best Rated</option>
                <option value="popularity_desc">Most Popular</option>
              </select>
            </div>

            {/* Filters left sidebar widget (3 Cols) */}
            <div className="hidden lg:block lg:col-span-3 space-y-4 text-left">
              <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-sm space-y-5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="text-base font-serif font-bold text-slate-900">Filters</h3>
                  <button
                    onClick={() => { setPriceMin(0); setPriceMax(500000); setSelectedRating(null); setSelectedCancellation(""); setSortBy("distance_asc"); setSelectedAmenities([]); setShowInstantOnly(false); }}
                    className="text-[10px] font-bold text-slate-400 hover:text-slate-700 uppercase tracking-wider"
                  >
                    Reset all
                  </button>
                </div>

                {/* Sort */}
                <div className="space-y-2">
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Sort By</label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="w-full bg-[#F8FAFC] border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none"
                  >
                    <option value="distance_asc">Nearest First</option>
                    <option value="price_asc">Price: Low → High</option>
                    <option value="price_desc">Price: High → Low</option>
                    <option value="rating_desc">Best Rated</option>
                    <option value="popularity_desc">Most Popular</option>
                  </select>
                </div>

                {/* Instant Book toggle */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-700">⚡ Instant Book</p>
                    <p className="text-[10px] text-slate-400">Book without waiting for approval</p>
                  </div>
                  <button
                    onClick={() => setShowInstantOnly((v) => !v)}
                    className={`relative w-10 h-5 rounded-full transition-colors ${showInstantOnly ? "bg-[#0B1E3F]" : "bg-slate-200"}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${showInstantOnly ? "translate-x-5" : ""}`} />
                  </button>
                </div>

                {/* Price range */}
                <div className="space-y-2">
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Price Range / {searchCategory === "car" ? "day" : "night"}</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={priceMin || ""}
                      onChange={(e) => setPriceMin(e.target.value ? Number(e.target.value) : 0)}
                      placeholder="Min"
                      min={0}
                      step={500}
                      className="w-full bg-[#F8FAFC] border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold focus:outline-none"
                    />
                    <input
                      type="number"
                      value={priceMax >= 499999 ? "" : priceMax}
                      onChange={(e) => setPriceMax(e.target.value ? Number(e.target.value) : 500000)}
                      placeholder="Max"
                      min={0}
                      step={500}
                      className="w-full bg-[#F8FAFC] border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold focus:outline-none"
                    />
                  </div>
                </div>

                {/* Rating */}
                {searchCategory !== "car" && (
                  <div className="space-y-2">
                    <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Min. Rating</label>
                    <div className="flex gap-1.5">
                      {[3, 4, 5].map((star) => (
                        <button
                          key={star}
                          onClick={() => setSelectedRating(star === selectedRating ? null : star)}
                          className={`flex-1 py-1.5 border rounded-xl text-xs font-semibold transition ${star === selectedRating ? "bg-[#0B1E3F] text-white border-[#0B1E3F]" : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"}`}
                        >
                          ★ {star}+
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Amenities */}
                {searchCategory !== "car" && (
                  <div className="space-y-2">
                    <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Amenities</label>
                    <div className="grid grid-cols-2 gap-1.5">
                      {[
                        { key: "wifi", label: "Wi-Fi" },
                        { key: "pool", label: "Pool" },
                        { key: "parking", label: "Parking" },
                        { key: "ac", label: "A/C" },
                        { key: "gym", label: "Gym" },
                        { key: "kitchen", label: "Kitchen" },
                      ].map(({ key, label }) => {
                        const active = selectedAmenities.includes(key);
                        return (
                          <button
                            key={key}
                            onClick={() =>
                              setSelectedAmenities((prev) =>
                                active ? prev.filter((a) => a !== key) : [...prev, key]
                              )
                            }
                            className={`py-1.5 px-2 border rounded-xl text-[10px] font-semibold transition text-left ${active ? "bg-[#0B1E3F] text-white border-[#0B1E3F]" : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"}`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Cancellation policy */}
                <div className="space-y-2">
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Cancellation</label>
                  <select
                    value={selectedCancellation}
                    onChange={(e) => setSelectedCancellation(e.target.value)}
                    className="w-full bg-[#F8FAFC] border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 focus:outline-none"
                  >
                    <option value="">Any Policy</option>
                    <option value="flexible">Flexible</option>
                    <option value="moderate">Moderate</option>
                    <option value="strict">Strict</option>
                  </select>
                </div>

                {/* Car-specific filters */}
                {searchCategory === "car" && (
                  <div className="space-y-2">
                    <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Transmission</label>
                    <div className="flex gap-1.5">
                      {["automatic", "manual"].map((t) => {
                        const active = selectedAmenities.includes(t);
                        return (
                          <button
                            key={t}
                            onClick={() =>
                              setSelectedAmenities((prev) =>
                                active ? prev.filter((a) => a !== t) : [...prev, t]
                              )
                            }
                            className={`flex-1 py-1.5 border rounded-xl text-xs font-semibold capitalize transition ${active ? "bg-[#0B1E3F] text-white border-[#0B1E3F]" : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"}`}
                          >
                            {t}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Middle Listings Cards Feed (5 Cols) */}
            <div className="lg:col-span-5 space-y-5">
              {/* Result header */}
              {!searching && listings.length > 0 && (
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-semibold">
                    {listings.length}{totalCount > listings.length ? ` of ${totalCount}` : ""} {searchCategory}s found
                  </span>
                  {(showInstantOnly || selectedAmenities.length > 0 || selectedRating || priceMin > 0 || priceMax < 499999) && (
                    <span className="text-[#0B1E3F] font-bold">Filters active</span>
                  )}
                </div>
              )}

              {searching ? (
                /* Skeleton loading state */
                <div className="grid grid-cols-1 gap-4">
                  {[1, 2, 3].map((n) => (
                    <div key={n} className="animate-pulse bg-white border border-slate-100 rounded-3xl overflow-hidden flex shadow-sm">
                      <div className="w-2/5 bg-slate-200 min-h-[140px]" />
                      <div className="flex-1 p-5 space-y-3">
                        <div className="h-2.5 bg-slate-200 rounded w-1/4" />
                        <div className="h-4 bg-slate-200 rounded w-3/4" />
                        <div className="h-3 bg-slate-200 rounded w-1/2" />
                        <div className="h-3 bg-slate-200 rounded w-2/3 mt-2" />
                        <div className="flex justify-between pt-2 border-t border-slate-100 mt-2">
                          <div className="h-5 bg-slate-200 rounded w-24" />
                          <div className="h-5 bg-slate-200 rounded w-16" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : listings.length === 0 ? (
                <div className="py-20 flex flex-col items-center gap-4 bg-white border border-slate-200 rounded-3xl px-6 text-center shadow-sm">
                  <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-3xl">🔍</div>
                  {searchError && (
                    <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2 text-xs text-red-600 font-semibold max-w-xs">
                      {searchError}
                    </div>
                  )}
                  <div>
                    <p className="text-slate-800 font-bold text-lg font-serif">No {searchCategory}s found</p>
                    <p className="text-slate-400 text-sm mt-1 max-w-sm">
                      Try removing some filters or searching a broader area.
                    </p>
                  </div>
                  <button
                    onClick={() => { setActiveTab("home"); setSelectedListingId(null); }}
                    className="mt-2 px-6 py-2.5 bg-[#0B1E3F] text-white text-xs font-bold rounded-xl uppercase tracking-wider hover:bg-[#07152B] transition"
                  >
                    Try a Different Search
                  </button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-4">
                    {listings.map((l) => (
                      <ListingCard
                        key={l.id}
                        listing={l}
                        onSelect={handleSelectListing}
                        hoveredId={mapHoveredId}
                        onHover={setMapHoveredId}
                      />
                    ))}
                  </div>
                  {listings.length < totalCount && (
                    <button
                      onClick={loadMoreListings}
                      disabled={loadingMore}
                      className="w-full py-3 border-2 border-[#0B1E3F] text-[#0B1E3F] text-sm font-bold rounded-2xl hover:bg-[#0B1E3F] hover:text-white transition disabled:opacity-50"
                    >
                      {loadingMore ? "Loading..." : `Load More (${totalCount - listings.length} remaining)`}
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Real Leaflet map (4 Cols) — hidden on mobile */}
            <div className="lg:col-span-4 hidden lg:block">
              <div className="sticky top-28 rounded-3xl overflow-hidden aspect-[4/5] border border-slate-200 shadow-md">
                <MapView
                  listings={listings}
                  hoveredId={mapHoveredId}
                  onHover={setMapHoveredId}
                  onSelect={handleSelectListing}
                  searchDestination={searchDestination}
                />
              </div>
            </div>
          </div>
        ) : activeTab === "bookings" ? (
          // VIEW 4: MY RESERVATIONS
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6 text-left">

            {/* Page header */}
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
              <div>
                <h1 className="text-3xl font-serif font-bold text-slate-900">My Reservations</h1>
                <p className="text-sm text-slate-500 mt-1">
                  {bookingsList.length > 0
                    ? `${bookingsList.length} booking${bookingsList.length !== 1 ? "s" : ""} total`
                    : "Manage your itineraries and trips"}
                </p>
              </div>
              <button
                onClick={fetchGuestBookings}
                disabled={loadingBookings}
                className="self-start sm:self-auto flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-[#0B1E3F] hover:border-[#0B1E3F] transition shadow-sm disabled:opacity-50 uppercase tracking-wide"
              >
                <svg className={`w-3.5 h-3.5 ${loadingBookings ? "animate-spin" : ""}`} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </button>
            </div>

            {/* Status filter chips */}
            {!loadingBookings && bookingsList.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-none">
                {[
                  { key: "all", label: "All" },
                  { key: "confirmed", label: "Confirmed" },
                  { key: "pending_payment", label: "Pending" },
                  { key: "completed", label: "Completed" },
                  { key: "cancelled", label: "Cancelled" },
                ].map(({ key, label }) => {
                  const count =
                    key === "all"
                      ? bookingsList.length
                      : key === "cancelled"
                        ? bookingsList.filter((b) => b.status.startsWith("cancelled")).length
                        : bookingsList.filter((b) => b.status === key).length;
                  if (count === 0 && key !== "all") return null;
                  return (
                    <button
                      key={key}
                      onClick={() => setReservationStatusFilter(key)}
                      className={`shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold border transition ${reservationStatusFilter === key
                        ? "bg-[#0B1E3F] text-white border-[#0B1E3F]"
                        : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
                        }`}
                    >
                      {label}
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${reservationStatusFilter === key ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                        }`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Content */}
            {loadingBookings ? (
              // Skeleton cards
              <div className="space-y-4">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="animate-pulse bg-white border border-slate-100 rounded-2xl overflow-hidden flex flex-col sm:flex-row shadow-sm">
                    <div className="sm:w-44 h-44 sm:h-auto bg-slate-200 shrink-0" />
                    <div className="flex-1 p-5 space-y-3">
                      <div className="flex justify-between items-start gap-2">
                        <div className="space-y-2 flex-1">
                          <div className="h-4 bg-slate-200 rounded-full w-20" />
                          <div className="h-5 bg-slate-200 rounded w-3/4" />
                          <div className="h-3 bg-slate-200 rounded w-1/3" />
                        </div>
                        <div className="h-7 bg-slate-200 rounded w-24 shrink-0" />
                      </div>
                      <div className="flex gap-4 pt-1">
                        <div className="h-3 bg-slate-200 rounded w-36" />
                        <div className="h-3 bg-slate-200 rounded w-24" />
                      </div>
                      <div className="border-t border-slate-100 pt-3 flex justify-between items-center">
                        <div className="h-3 bg-slate-200 rounded w-16" />
                        <div className="h-8 bg-slate-200 rounded-xl w-28" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredBookings.length === 0 ? (
              // Empty state
              <div className="text-center py-20 bg-white border border-slate-100 rounded-3xl shadow-sm">
                <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-5">
                  <svg className="w-9 h-9 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-1">
                  {reservationStatusFilter === "all" ? "No reservations yet" : `No ${reservationStatusFilter.replace("_", " ")} reservations`}
                </h3>
                <p className="text-slate-500 text-sm max-w-xs mx-auto leading-relaxed">
                  {reservationStatusFilter === "all"
                    ? "Book your next stay or car rental to see it here."
                    : "Try switching to a different filter tab."}
                </p>
                {reservationStatusFilter === "all" && (
                  <button
                    onClick={() => { setActiveTab("home"); setSelectedListingId(null); }}
                    className="mt-6 inline-flex items-center gap-2 bg-[#0B1E3F] text-white text-sm font-semibold px-6 py-3 rounded-xl hover:bg-[#07152B] transition shadow-md"
                  >
                    Explore Listings
                  </button>
                )}
              </div>
            ) : (
              // Reservation cards
              <div className="space-y-4">
                {filteredBookings.map((b) => (
                  <div key={b.id} className="space-y-2">
                    <ReservationCard
                      booking={b}
                      onCancel={handleCancelBooking}
                      cancellingId={cancellingId}
                    />

                    {/* Leave Review — only for completed bookings not yet reviewed */}
                    {b.status === "completed" && !reviewedBookingIds.includes(b.id) && (
                      reviewingBookingId === b.id ? (
                        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-bold text-slate-800">Leave a Review</p>
                            <button onClick={() => setReviewingBookingId(null)} className="text-slate-400 hover:text-slate-600">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          </div>

                          {/* Star rating */}
                          <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <button
                                key={star}
                                type="button"
                                onClick={() => setReviewRating(star)}
                                className={`text-2xl transition-transform hover:scale-110 ${star <= reviewRating ? "text-amber-400" : "text-slate-200"}`}
                              >
                                ★
                              </button>
                            ))}
                            <span className="ml-2 text-xs font-semibold text-slate-500">
                              {["", "Poor", "Fair", "Good", "Very Good", "Excellent"][reviewRating]}
                            </span>
                          </div>

                          <input
                            type="text"
                            placeholder="Review title (optional)"
                            value={reviewTitle}
                            onChange={(e) => setReviewTitle(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#0B1E3F]"
                          />
                          <textarea
                            placeholder="Share your experience…"
                            value={reviewBody}
                            onChange={(e) => setReviewBody(e.target.value)}
                            rows={3}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#0B1E3F] resize-none"
                          />

                          <div className="flex gap-2">
                            <button
                              onClick={() => setReviewingBookingId(null)}
                              className="flex-1 py-2.5 border border-slate-200 text-sm font-semibold text-slate-600 rounded-xl hover:bg-slate-50 transition"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => handleSubmitReview(b.id)}
                              disabled={submittingReview}
                              className="flex-1 py-2.5 bg-[#0B1E3F] text-white text-sm font-bold rounded-xl hover:bg-[#07152B] disabled:opacity-50 transition"
                            >
                              {submittingReview ? "Submitting…" : "Submit Review"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setReviewingBookingId(b.id); setReviewRating(5); setReviewTitle(""); setReviewBody(""); }}
                          className="w-full flex items-center justify-center gap-2 py-2.5 border border-amber-200 bg-amber-50 text-amber-700 text-xs font-bold rounded-xl hover:bg-amber-100 transition"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
                          Leave a Review for {b.listingTitle}
                        </button>
                      )
                    )}

                    {/* Already reviewed badge */}
                    {b.status === "completed" && reviewedBookingIds.includes(b.id) && (
                      <div className="flex items-center justify-center gap-2 py-2 text-xs text-emerald-600 font-semibold">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                        Review submitted — thank you!
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </main>

      {/* ── Mobile navigation drawer ── */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="relative ml-auto w-72 max-w-[85vw] bg-white h-full shadow-2xl flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 shrink-0">
              <span className="text-lg font-bold text-[#0B1E3F] font-serif">Menu</span>
              <button
                onClick={() => setMobileNavOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <nav className="flex flex-col gap-1 p-4 flex-1 overflow-y-auto">
              <button
                onClick={() => { setActiveTab("home"); setSelectedListingId(null); setMobileNavOpen(false); }}
                className={`px-4 py-3 text-sm font-semibold rounded-xl text-left transition ${activeTab === "home" ? "bg-[#0B1E3F] text-white" : "text-slate-700 hover:bg-slate-50"}`}
              >
                Destinations
              </button>
              {(["hotel", "apartment", "car"] as const).map((cat) => (
                <button
                  key={cat}
                  onClick={() => { setSearchCategory(cat); setSelectedListingId(null); handleSearch(undefined, cat); setMobileNavOpen(false); }}
                  className={`px-4 py-3 text-sm font-semibold rounded-xl text-left transition ${activeTab === "search" && searchCategory === cat ? "bg-[#0B1E3F] text-white" : "text-slate-700 hover:bg-slate-50"}`}
                >
                  {cat === "hotel" ? "Stays" : cat === "apartment" ? "Apartments" : "Car Rentals"}
                </button>
              ))}
              {user && (
                <button
                  onClick={() => { setActiveTab("bookings"); setSelectedListingId(null); fetchGuestBookings(); setMobileNavOpen(false); }}
                  className={`px-4 py-3 text-sm font-semibold rounded-xl text-left transition ${activeTab === "bookings" ? "bg-[#0B1E3F] text-white" : "text-slate-700 hover:bg-slate-50"}`}
                >
                  My Reservations
                </button>
              )}
            </nav>
            {user && (
              <div className="p-4 border-t border-slate-100 space-y-3 shrink-0">
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl">
                  <div className="w-10 h-10 rounded-full bg-[#0B1E3F] text-white flex items-center justify-center font-bold uppercase text-sm shrink-0">
                    {user.firstName[0]}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 truncate">{user.firstName} {user.lastName}</p>
                    <p className="text-xs text-slate-400 capitalize">{user.currentTier || "Bronze"} Member</p>
                  </div>
                </div>
                <button
                  onClick={() => { handleLogout(); setMobileNavOpen(false); }}
                  className="w-full py-3 bg-red-500 text-white text-sm font-semibold rounded-xl hover:bg-red-600 transition"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Mobile filters bottom sheet ── */}
      {showFiltersDrawer && (
        <div className="fixed inset-0 z-50 flex items-end lg:hidden">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={() => setShowFiltersDrawer(false)}
          />
          <div className="relative w-full bg-white rounded-t-3xl shadow-2xl max-h-[88vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 shrink-0">
              <h3 className="text-base font-bold text-slate-900">Filters</h3>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => { setPriceMin(0); setPriceMax(500000); setSelectedRating(null); setSelectedCancellation(""); setSortBy("distance_asc"); setSelectedAmenities([]); setShowInstantOnly(false); }}
                  className="text-xs font-bold text-slate-400 hover:text-slate-700 uppercase tracking-wider"
                >
                  Reset all
                </button>
                <button
                  onClick={() => setShowFiltersDrawer(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="overflow-y-auto flex-1 p-5 space-y-5">
              {/* Instant Book */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-700">Instant Book</p>
                  <p className="text-xs text-slate-400">No approval needed</p>
                </div>
                <button
                  onClick={() => setShowInstantOnly((v) => !v)}
                  className={`relative w-11 h-6 rounded-full transition-colors ${showInstantOnly ? "bg-[#0B1E3F]" : "bg-slate-200"}`}
                >
                  <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${showInstantOnly ? "translate-x-5" : ""}`} />
                </button>
              </div>
              {/* Price range */}
              <div className="space-y-2">
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                  Price per {searchCategory === "car" ? "day" : "night"}
                </label>
                <div className="flex gap-2">
                  <input type="number" value={priceMin || ""} onChange={(e) => setPriceMin(e.target.value ? Number(e.target.value) : 0)} placeholder="Min" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#0B1E3F]" />
                  <input type="number" value={priceMax >= 499999 ? "" : priceMax} onChange={(e) => setPriceMax(e.target.value ? Number(e.target.value) : 500000)} placeholder="Max" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#0B1E3F]" />
                </div>
              </div>
              {/* Rating */}
              {searchCategory !== "car" && (
                <div className="space-y-2">
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Min. Rating</label>
                  <div className="flex gap-2">
                    {[3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => setSelectedRating(star === selectedRating ? null : star)}
                        className={`flex-1 py-2.5 border rounded-xl text-sm font-semibold transition ${star === selectedRating ? "bg-[#0B1E3F] text-white border-[#0B1E3F]" : "bg-white text-slate-600 border-slate-200"}`}
                      >
                        ★ {star}+
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {/* Amenities */}
              {searchCategory !== "car" && (
                <div className="space-y-2">
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Amenities</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[{ key: "wifi", label: "Wi-Fi" }, { key: "pool", label: "Pool" }, { key: "parking", label: "Parking" }, { key: "ac", label: "A/C" }, { key: "gym", label: "Gym" }, { key: "kitchen", label: "Kitchen" }].map(({ key, label }) => {
                      const active = selectedAmenities.includes(key);
                      return (
                        <button
                          key={key}
                          onClick={() => setSelectedAmenities((prev) => active ? prev.filter((a) => a !== key) : [...prev, key])}
                          className={`py-2.5 border rounded-xl text-xs font-semibold transition ${active ? "bg-[#0B1E3F] text-white border-[#0B1E3F]" : "bg-white text-slate-600 border-slate-200"}`}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {/* Cancellation */}
              <div className="space-y-2">
                <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Cancellation Policy</label>
                <select value={selectedCancellation} onChange={(e) => setSelectedCancellation(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none">
                  <option value="">Any Policy</option>
                  <option value="flexible">Flexible</option>
                  <option value="moderate">Moderate</option>
                  <option value="strict">Strict</option>
                </select>
              </div>
              {/* Car transmission */}
              {searchCategory === "car" && (
                <div className="space-y-2">
                  <label className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Transmission</label>
                  <div className="flex gap-2">
                    {["automatic", "manual"].map((t) => {
                      const active = selectedAmenities.includes(t);
                      return (
                        <button key={t} onClick={() => setSelectedAmenities((prev) => active ? prev.filter((a) => a !== t) : [...prev, t])} className={`flex-1 py-2.5 border rounded-xl text-sm font-semibold capitalize transition ${active ? "bg-[#0B1E3F] text-white border-[#0B1E3F]" : "bg-white text-slate-600 border-slate-200"}`}>
                          {t}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            <div className="p-5 border-t border-slate-100 shrink-0">
              <button
                onClick={() => setShowFiltersDrawer(false)}
                className="w-full py-3.5 bg-[#0B1E3F] text-white font-bold rounded-xl text-sm hover:bg-[#07152B] transition"
              >
                Show Results
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Booking checkout success modal overlay */}
      {bookingSuccessModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-8 shadow-2xl space-y-6 text-center animate-scale-in">
            <div className="w-16 h-16 rounded-full bg-green-50 text-green-500 border border-green-200 flex items-center justify-center text-3xl mx-auto shadow-md">
              ✓
            </div>
            <div>
              <h3 className="text-2xl font-serif font-bold text-[#0B1E3F]">Reservation Confirmed!</h3>
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider pt-1">
                Your premium experience has been secured.
              </p>
            </div>

            <div className="bg-[#F8FAFC] border border-slate-200/50 p-4 rounded-2xl text-left space-y-2 text-xs shadow-inner">
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-400 font-semibold uppercase tracking-wider">Reference Code</span>
                <span className="text-[#0B1E3F] font-bold font-mono text-sm">{bookingSuccessModal.reference}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-400 font-semibold uppercase tracking-wider">Paid Amount</span>
                <span className="text-[#0B1E3F] font-bold">${bookingSuccessModal.amount.toLocaleString()} {bookingSuccessModal.currency}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-semibold uppercase tracking-wider">Loyalty Points Earned</span>
                <span className="text-green-600 font-bold font-mono">+{bookingSuccessModal.pointsAwarded} Points</span>
              </div>
            </div>

            <button
              onClick={() => {
                setBookingSuccessModal(null);
                setSelectedListingId(null);
                setActiveTab("bookings");
                fetchGuestBookings();
              }}
              className="w-full py-4 bg-[#0B1E3F] hover:bg-[#07152B] text-white font-bold rounded-2xl transition shadow-lg shadow-blue-950/20 text-xs tracking-wider uppercase"
            >
              Go to My Reservations
            </button>
          </div>
        </div>
      )}

      {/* Kainook Platinum Rewards interactive modal overlay */}
      {showRewardsModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4 transition-all duration-300">
          <div className="bg-gradient-to-br from-[#0B1E3F] via-[#0E1E38] to-[#040D1D] border border-white/10 rounded-3xl max-w-md w-full p-8 shadow-2xl space-y-6 text-center animate-scale-in relative overflow-hidden">
            <div className="absolute right-4 bottom-4 text-9xl text-white/5 font-bold uppercase select-none pointer-events-none font-serif">ZIKA</div>
            <div className="absolute -top-12 -left-12 w-32 h-32 bg-green-500/10 rounded-full blur-2xl pointer-events-none"></div>

            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-amber-400 via-yellow-200 to-slate-100 text-[#0B1E3F] flex items-center justify-center text-3xl mx-auto shadow-xl shadow-yellow-500/10 font-bold border border-white/20">
              ✦
            </div>

            <div className="space-y-2 relative z-10">
              <span className="bg-white/10 text-white text-[9px] font-semibold uppercase px-2.5 py-1 rounded-full tracking-widest border border-white/10">Rewards Program</span>
              <h3 className="text-2xl md:text-3xl font-serif font-bold text-white leading-tight">Welcome to Kainook Platinum!</h3>
              <p className="text-xs text-slate-300 leading-relaxed max-w-sm mx-auto">
                You are automatically enrolled! Earn loyalty points on every checkout booking and unlock elite travel privileges.
              </p>
            </div>

            <div className="bg-white/5 border border-white/10 p-5 rounded-2xl text-left space-y-3.5 text-xs text-slate-200 shadow-inner relative z-10">
              <div className="flex items-center gap-3">
                <span className="text-lg">⭐</span>
                <div>
                  <h5 className="font-bold text-white">10% Points Back</h5>
                  <p className="text-[10px] text-slate-400">Earn point credits valued at 10% of every reservation total.</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-lg">🛎️</span>
                <div>
                  <h5 className="font-bold text-white">24/7 Concierge</h5>
                  <p className="text-[10px] text-slate-400">Instant VIP messaging with dedicated luxury travel planners.</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-lg">✈️</span>
                <div>
                  <h5 className="font-bold text-white">Elite Upgrades</h5>
                  <p className="text-[10px] text-slate-400">Free room upgrades and late check-outs at partner properties.</p>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowRewardsModal(false)}
              className="w-full py-3.5 bg-white text-[#0B1E3F] hover:bg-slate-100 font-bold rounded-2xl transition shadow-lg shadow-white/5 text-xs tracking-wider uppercase relative z-10 hover:scale-[1.01] active:scale-[0.99]"
            >
              Start Earning Perks
            </button>
          </div>
        </div>
      )}


      {/* footer lives inside the home tab only — no global footer here */}
    </div>
  );
}

