"use client";
import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";           // auth-service: POST /auth/logout only
import { listingApi } from "@/lib/listing-api";
import { paymentApi } from "@/lib/payment-api";
import { fetchFavourites, fetchRecentlyViewed } from "@/services/traveller";
import ListingImage from "./components/ListingImage";
import { TravellerWorkspaceNav } from "./components/TravellerWorkspaceNav";
import { MessageProviderButton } from "./components/MessageProviderButton";
import { PublicReviewsSection } from "./components/PublicReviewsSection";
import { GiveReviewEntry } from "./components/GiveReviewEntry";
import { useAuthStore } from "@/stores/auth";
import { capitalize } from "@/lib/utils";
import { useFavourites } from "@/hooks/useFavourites";
import ListingCard from "./components/ListingCard";
import { ActivityPromoBanner, PersonalVoucherBanner } from "./components/PromoBanner";
import { isPromotionValid } from "./utils/promo-utils";
import PhotoGallery from "./components/PhotoGallery";
import ReservationCard from "./components/ReservationCard";
import MapView from "./components/MapView";
import DateRangePicker from "./components/DateRangePicker";
import type { PublicListingDetail } from "@/types";

const AMENITY_CATEGORY: Record<string, string> = {
  wifi: "Connectivity", smart_tv: "Connectivity", work_desk: "Connectivity",
  printer: "Connectivity", workspace: "Connectivity",
  breakfast: "Food & Drink", restaurant_on_site: "Food & Drink",
  coffee_machine: "Food & Drink", minibar: "Food & Drink", kitchen: "Food & Drink",
  pool: "Wellness", gym: "Wellness", spa: "Wellness", sauna: "Wellness",
  hot_tub: "Wellness", fitness_centre: "Wellness",
  ac: "Comfort", heating: "Comfort", laundry: "Comfort", parking: "Comfort",
  elevator: "Comfort", accessible: "Comfort",
  reception_24h: "Services", housekeeping_daily: "Services",
  airport_shuttle: "Services", security_24h: "Services",
  shop_on_site: "Services", pet_friendly: "Services",
  tv: "Services", fireplace: "Comfort", balcony: "Comfort", washer: "Comfort",
};

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

interface ActivePromotion {
  id: string;
  name: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  description?: string;
  category?: string;
  activity?: string;
  labelText?: string;
  labelColour?: string;
  bannerTitle?: string;
  bannerSubtitle?: string;
  validUntil?: string;
  applyToBooking?: boolean;
}

interface ApplicableVoucher {
  id: string;
  code: string;
  description?: string;
  discountAmount: number;
}

interface WalletVoucher {
  id: string;
  code: string;
  description?: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  minOrderValue?: number;
  validUntil?: string;
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
  wifi: "High-Speed Wi-Fi", "Connectivity:wifi": "High-Speed Wi-Fi",
  smart_tv: "Smart TV", "Connectivity:smart_tv": "Smart TV",
  work_desk: "Work Desk", "Connectivity:work_desk": "Work Desk",
  printer: "Printer", "Connectivity:printer": "Printer",
  workspace: "Workspace", "Connectivity:workspace": "Workspace",
  breakfast: "Breakfast", "Food & Drink:breakfast": "Breakfast",
  restaurant_on_site: "Restaurant", "Food & Drink:restaurant_on_site": "Restaurant",
  coffee_machine: "Coffee Machine", "Food & Drink:coffee_machine": "Coffee Machine",
  minibar: "Minibar", "Food & Drink:minibar": "Minibar",
  kitchen: "Kitchen", "Food & Drink:kitchen": "Kitchen",
  pool: "Pool", "Wellness:pool": "Pool",
  gym: "Gym", "Wellness:gym": "Gym",
  spa: "Spa", "Wellness:spa": "Spa",
  sauna: "Sauna", "Wellness:sauna": "Sauna",
  hot_tub: "Hot Tub", "Wellness:hot_tub": "Hot Tub",
  fitness_centre: "Fitness Centre", "Wellness:fitness_centre": "Fitness Centre",
  ac: "Air Conditioning", "Comfort:ac": "Air Conditioning",
  heating: "Heating", "Comfort:heating": "Heating",
  laundry: "Laundry", "Comfort:laundry": "Laundry",
  parking: "Parking", "Comfort:parking": "Parking",
  elevator: "Elevator", "Comfort:elevator": "Elevator",
  accessible: "Wheelchair Accessible", "Comfort:accessible": "Wheelchair Accessible",
  reception_24h: "24/7 Reception", "Services:reception_24h": "24/7 Reception",

  airport_shuttle: "Airport Shuttle", "Services:airport_shuttle": "Airport Shuttle",
  security_24h: "24/7 Security", "Services:security_24h": "24/7 Security",
  shop_on_site: "Shop On-Site", "Services:shop_on_site": "Shop On-Site",
  pet_friendly: "Pet Friendly", "Services:pet_friendly": "Pet Friendly",
  tv: "TV", "Services:tv": "TV",
  fireplace: "Fireplace", "Comfort:fireplace": "Fireplace",
  balcony: "Balcony", "Comfort:balcony": "Balcony",
  washer: "Washer & Dryer", "Comfort:washer": "Washer & Dryer",
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

function toIsoDatetime(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  if (dateStr.includes("T")) return dateStr;
  return new Date(dateStr + "T00:00:00Z").toISOString();
}

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
      <div className="relative flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 gap-2 hover:border-slate-400 focus-within:border-[#1D8D2B] transition-colors cursor-pointer">
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
  const searchParams = useSearchParams();
  const getTodayString = () => new Date().toISOString().slice(0, 10);

  // Auth — read directly from Zustand store (populated by login page, no API call needed)
  const { user, isAuthenticated, _hasHydrated, clearSession, updateUser } = useAuthStore();
  const hasAuthToken = isAuthenticated;
  const ready = _hasHydrated;

  const { isFavourited, toggleFavourite } = useFavourites();
  const [showFavAuthPrompt, setShowFavAuthPrompt] = useState(false);

  const [recentlyViewed, setRecentlyViewed] = useState<PublicListingDetail[]>([]);
  const [favouritedIds, setFavouritedIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<"home" | "search" | "bookings">("home");

  // Search Context
  const [searchCategory, setSearchCategory] = useState<"hotel" | "apartment" | "car">("hotel");
  const [searchDestination, setSearchDestination] = useState<string>("");
  const [searchCheckIn, setSearchCheckIn] = useState<string>("");
  const [searchCheckOut, setSearchCheckOut] = useState<string>("");
  const [searchPickupDate, setSearchPickupDate] = useState<string>("");
  const [searchReturnDate, setSearchReturnDate] = useState<string>("");
  // Separate date state for the listing detail panel (independent of the search bar)
  const [detailCheckIn, setDetailCheckIn] = useState<string>("");
  const [detailCheckOut, setDetailCheckOut] = useState<string>("");
  const [detailPickupDate, setDetailPickupDate] = useState<string>("");
  const [detailReturnDate, setDetailReturnDate] = useState<string>("");
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
  const [selectedRoomTypeId, setSelectedRoomTypeId] = useState<string | null>(null);
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
  // Banner-level voucher UI state (pre-checkout)
  const [voucherBannerDismissed, setVoucherBannerDismissed] = useState<boolean>(false);
  const [pendingVoucherCode, setPendingVoucherCode] = useState<string>("");

  // Promotion state
  const [activePromotion, setActivePromotion] = useState<ActivePromotion | null>(null);
  const [promotionDiscount, setPromotionDiscount] = useState<number>(0);

  // Auto-applicable vouchers (context-filtered, fetched after lock)
  const [applicableVouchers, setApplicableVouchers] = useState<ApplicableVoucher[]>([]);
  const [loadingApplicableVouchers, setLoadingApplicableVouchers] = useState(false);

  // Full wallet — all vouchers assigned to this user (GET /vouchers/wallet)
  const [walletVouchers, setWalletVouchers] = useState<WalletVoucher[]>([]);
  const [loadingWalletVouchers, setLoadingWalletVouchers] = useState(false);

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
  const [pricingPreview, setPricingPreview] = useState<any>(null);
  const [estimatedPricing, setEstimatedPricing] = useState<any>(null);
  const [estimatingPricing, setEstimatingPricing] = useState(false);
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

  // Handle ?tab=bookings, ?listing=<id>, and date query params on first mount
  const urlTabHandled = useRef(false);
  useEffect(() => {
    if (!ready || urlTabHandled.current) return;
    const tab = searchParams.get("tab");
    const listingId = searchParams.get("listing");
    const checkin = searchParams.get("checkin") || searchParams.get("checkIn");
    const checkout = searchParams.get("checkout") || searchParams.get("checkOut");
    const pickup = searchParams.get("pickup") || searchParams.get("pickupDate");
    const ret = searchParams.get("return") || searchParams.get("returnDate");

    if (checkin) { setSearchCheckIn(checkin); setDetailCheckIn(checkin); }
    if (checkout) { setSearchCheckOut(checkout); setDetailCheckOut(checkout); }
    if (pickup) { setSearchPickupDate(pickup); setDetailPickupDate(pickup); }
    if (ret) { setSearchReturnDate(ret); setDetailReturnDate(ret); }

    if (tab === "bookings") {
      urlTabHandled.current = true;
      setActiveTab("bookings");
      if (user) fetchGuestBookings();
    } else if (listingId) {
      urlTabHandled.current = true;
      handleSelectListing(listingId);
    }
  }, [ready, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // My Bookings history context
  const [bookingsList, setBookingsList] = useState<Booking[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [reservationStatusFilter, setReservationStatusFilter] = useState<string>("all");

  // Mobile UI state
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [showFiltersDrawer, setShowFiltersDrawer] = useState(false);

  // Client-side filter state (applied on top of API results)
  const [filterBedrooms, setFilterBedrooms] = useState<number | null>(null);
  const [filterBathrooms, setFilterBathrooms] = useState<number | null>(null);
  const [filterPropertyTypes, setFilterPropertyTypes] = useState<string[]>([]);

  // Timer Ref for lock countdown
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  // Derived guest count
  const searchGuests = searchAdults + searchChildren;

  // Client-side filtered listings (bedrooms / bathrooms applied on top of API results)
  const displayedListings = React.useMemo(() => {
    let result = listings;
    if (filterBedrooms !== null) {
      result = result.filter((l) => {
        const beds = l.bedrooms ?? 0;
        return filterBedrooms >= 3 ? beds >= 3 : beds === filterBedrooms;
      });
    }
    if (filterBathrooms !== null) {
      result = result.filter((l) => {
        const baths = l.bathrooms ?? 0;
        return filterBathrooms >= 3 ? baths >= 3 : baths === filterBathrooms;
      });
    }
    return result;
  }, [listings, filterBedrooms, filterBathrooms]);

  // Derived discount — explicit voucher selection always wins over auto-promotion.
  // Neither stacks with the other; we always pick the higher value.
  const effectiveDiscountSource: "voucher" | "promotion" | null =
    voucherApplied ? "voucher"
      : promotionDiscount > 0 ? "promotion"
        : null;
  const bestDiscount =
    effectiveDiscountSource === "voucher" ? voucherDiscount
      : effectiveDiscountSource === "promotion" ? promotionDiscount
        : 0;

  // Red badge shown on every listing card when an active activity promotion matches the active tab
  const promotionBadge = activePromotion && isPromotionValid(activePromotion) ? {
    label: activePromotion.labelText || (
      activePromotion.discountType === "percentage"
        ? `${activePromotion.discountValue}%`
        : `${activePromotion.discountValue} OFF`
    ),
    colour: activePromotion.labelColour || "#C84B2F",
  } : undefined;

  // 1. Redirect provider accounts away from traveller page
  useEffect(() => {
    if (!_hasHydrated) return;
    if (user && user.userType === "provider") {
      router.replace("/dashboard");
    }
  }, [_hasHydrated, user?.userType]);

  // Load recently-viewed and favourites from backend on mount (when authenticated)
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("zika:recently_viewed");
    }
    if (!isAuthenticated) return;
    fetchRecentlyViewed().then((items) => {
      setRecentlyViewed(
        items.slice(0, 4).map((v) => ({
          id: v.listing.id,
          providerId: "",
          category: v.listing.category as "hotel" | "apartment" | "car",
          name: v.listing.title,
          pricePerNight: v.listing.nightlyRate ?? 0,
          currency: v.listing.currency ?? "KES",
          primaryPhotoUrl: v.listing.primaryPhotoUrl ?? null,
          photos: [],
          amenities: [],
          customAmenities: [],
          description: "",
          address: v.listing.city ?? "",
          lat: 0,
          lng: 0,
          town: v.listing.city ?? "",
          country: "",
          minStayNights: 1,
          checkinTime: "",
          checkoutTime: "",
          cancellationPolicy: "flexible" as const,
          isFavourited: false,
          isAccredited: false,
          longStayDiscountEnabled: false,
          instantBooking: false,
        }))
      );
    }).catch(() => { });
    fetchFavourites().then((res) => {
      setFavouritedIds(new Set(res.favourites.map((f) => f.listingId)));
    }).catch(() => { });
  }, [isAuthenticated]);


  function mapSearchResult(l: any): PublicListingDetail {
    const town = l.town || l.city || "";
    const country = l.country || l.countryCode || "";
    const rawRoomTypes = l.hotelRoomTypes || l.roomTypes || [];
    return {
      id: l.id,
      providerId: l.providerId,
      category: l.category || l.listingType,
      name: l.name || l.title,
      pricePerNight: (() => {
        let basePrice = Number(l.pricePerNight || l.nightlyRate || l.pricePerDay || l.dailyRate || 0);
        if ((l.category === "hotel" || l.listingType === "hotel") && Array.isArray(rawRoomTypes) && rawRoomTypes.length > 0) {
          const activeRts = rawRoomTypes.filter((rt: any) => rt.isActive !== false);
          if (activeRts.length > 0) {
            const prices = activeRts
              .map((rt: any) => Number(rt.pricePerNight))
              .filter((p: number) => !isNaN(p) && p > 0);
            if (prices.length > 0) {
              return Math.min(...prices);
            }
          }
        }
        return basePrice;
      })(),
      currency: l.currency || "KES",
      minStayNights: l.minStayNights || 1,
      checkinTime: l.checkinTime || "",
      checkoutTime: l.checkoutTime || "",
      cancellationPolicy: l.cancellationPolicy || "flexible",
      address: l.address || (town ? `${town}, ${country}` : ""),
      lat: l.lat || 0,
      lng: l.lng || 0,
      town,
      neighborhood: l.neighborhood,
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
      distanceKm: l.distanceKm ?? undefined,
      description: l.description || "",
      isFavourited: l.isFavourited ?? false,
      isAccredited: l.isAccredited ?? false,
      longStayDiscountEnabled: l.longStayDiscountEnabled ?? false,
      instantBooking: l.instantBooking ?? l.instant_booking ?? false,
      roomTypes: rawRoomTypes,
    };
  }

  async function loadFeaturedListings(cat: "hotel" | "apartment" | "car") {
    setLoadingFeatured(true);
    setFeaturedCategory(cat);
    fetchActivePromotion(cat);
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

  // Fetch wallet vouchers for the personal banner as soon as the user is authenticated
  useEffect(() => {
    if (hasAuthToken) fetchWalletVouchers();
  }, [hasAuthToken]); // eslint-disable-line react-hooks/exhaustive-deps

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
      return [item, ...filtered].slice(0, 4);
    });
  }

  function handleFavToggle(listingId: string, isFavourited: boolean) {
    setFavouritedIds((prev) => {
      const next = new Set(prev);
      if (isFavourited) next.add(listingId);
      else next.delete(listingId);
      return next;
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

  // Reload active promotions when searchCategory changes
  useEffect(() => {
    console.log("[ZikaSearch] Category changed, fetching promotions for:", searchCategory);
    fetchActivePromotion(searchCategory);
  }, [searchCategory]);

  // Log calculation results whenever listing details, dates, or discounts change
  useEffect(() => {
    if (detailListing) {
      const isCar = detailListing.category === "car";
      const isHotel = detailListing.category === "hotel";
      const selectedRt = isHotel
        ? (detailListing.roomTypes ?? []).find((r) => r.id === selectedRoomTypeId)
        : null;
      const pricePerNight = selectedRt ? selectedRt.pricePerNight : detailListing.pricePerNight;
      const start = isCar ? detailPickupDate : detailCheckIn;
      const end = isCar ? detailReturnDate : detailCheckOut;
      const days = calcDays(start, end);
      const baseTotal = pricePerNight * days;
      const discountedTotal = Math.max(0, baseTotal - bestDiscount);
      const serviceFee = days > 0 ? Math.ceil(discountedTotal * 0.05) : 0;
      const taxRate = TAX_RATES[detailListing.country] ?? 0;
      const taxAmount = Math.ceil(baseTotal * taxRate);
      const grandTotal = Math.max(0, baseTotal + serviceFee + taxAmount - bestDiscount);

      console.log("[ZikaSearch] Discount/Price calculation details:", {
        listingName: detailListing.name,
        days,
        baseTotal,
        serviceFee,
        taxAmount,
        promotionDiscount,
        voucherDiscount,
        effectiveDiscountSource,
        bestDiscountApplied: bestDiscount,
        finalPrice: grandTotal,
      });
    }
  }, [detailListing?.id, detailCheckIn, detailCheckOut, detailPickupDate, detailReturnDate, bestDiscount, voucherApplied, voucherDiscount, promotionDiscount, selectedRoomTypeId]);

  // Reusable Voucher dropdown & Manual entry component
  function renderVoucherSelector() {
    if (!detailListing) return null;
    return (
      <div className="space-y-3 pt-3 border-t border-slate-100">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">Voucher / Promo Code</p>
          {voucherApplied && (
            <button
              type="button"
              onClick={() => {
                console.log("[ZikaSearch] Removing applied voucher:", voucherCode);
                setVoucherApplied(false);
                setVoucherDiscount(0);
                setVoucherCode("");
                setVoucherError("");
              }}
              className="text-[10px] font-bold text-slate-400 hover:text-red-500 uppercase tracking-wider"
            >
              Remove
            </button>
          )}
        </div>
        {!voucherApplied && (
          <div className="space-y-2">
            {/* Wallet dropdown */}
            {loadingWalletVouchers ? (
              <div className="flex items-center gap-2 text-xs text-slate-400 py-0.5">
                <div className="w-3.5 h-3.5 border-2 border-slate-300 border-t-[#1D8D2B] rounded-full animate-spin" />
                Loading your vouchers…
              </div>
            ) : walletVouchers.length > 0 ? (
              <div className="relative">
                <select
                  value={voucherCode}
                  onChange={(e) => {
                    const code = e.target.value;
                    setVoucherCode(code);
                    if (code) {
                      console.log("[ZikaSearch] Voucher selected from dropdown:", code);
                      handleVoucherApply(code);
                    }
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs text-slate-700 appearance-none cursor-pointer focus:outline-none focus:border-[#1D8D2B] pr-7"
                >
                  <option value="">Select an available voucher…</option>
                  {walletVouchers.map((v) => {
                    const discountStr = v.discountType === "percentage"
                      ? `${v.discountValue}% off`
                      : `${detailListing.currency} ${v.discountValue.toLocaleString()} off`;
                    const expiryStr = v.validUntil
                      ? ` (Exp: ${new Date(v.validUntil).toLocaleDateString("en-GB", { day: "numeric", month: "short" })})`
                      : "";
                    const descStr = v.description ? ` — ${v.description}` : "";
                    return (
                      <option key={v.id} value={v.code}>
                        {v.code}: {discountStr}{descStr}{expiryStr}
                      </option>
                    );
                  })}
                </select>
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                </div>
              </div>
            ) : null}

            {/* Manual code input */}
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 flex gap-2 items-center">
              <input
                type="text"
                placeholder={walletVouchers.length > 0 ? "Or enter code manually" : "Enter voucher code"}
                value={voucherCode}
                onChange={(e) => setVoucherCode(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleVoucherApply();
                  }
                }}
                className="bg-transparent border-0 focus:ring-0 focus:outline-none text-xs text-slate-800 flex-1 min-w-0"
              />
              <button
                type="button"
                onClick={() => handleVoucherApply()}
                className="text-[10px] font-bold text-[#1D8D2B] border border-[#1D8D2B] px-2.5 py-1 rounded-lg hover:bg-[#0c2614] hover:text-white transition shrink-0"
              >
                Apply
              </button>
            </div>
          </div>
        )}
        {voucherApplied && (
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2 text-xs font-medium text-emerald-800">
            ✓ Voucher applied — saves {detailListing.currency} {voucherDiscount.toLocaleString()}
          </div>
        )}
        {voucherError && <p className="text-xs font-semibold text-red-600">{voucherError}</p>}
      </div>
    );
  }

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
    // Clear stale listings immediately so the grid never shows results from a previous search
    setListings([]);

    // Priority: explicit override (popular destination click) → user input → default
    const queryText = destinationOverride?.trim() || searchDestination.trim() || "Nairobi, Kenya";
    // Flag: is this a real user-typed text search (not a programmatic global browse)?
    const isTextSearch = !!(destinationOverride?.trim() || searchDestination.trim());

    try {
      // Geocode destination → lat/lng via Nominatim (free, no API key).
      // NOTE: geocoding is used ONLY to seed the lat/lng the API requires.
      // It is NOT the primary matching mechanism — the `q` param and the
      // client-side text filter handle actual text relevance.
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

      // Build search params.
      // For ALL text searches (hotel name, apartment name, car name, city, country, etc.):
      //   - Use radius_km = 20 000 (global) so results are NOT constrained by geography.
      //   - Pass `q` and `name` so the backend's full-text index can match on listing names.
      // For programmatic global browse (no user text): also use 20 000 km radius.
      const isGlobalBrowse = !e && !searchDestination.trim() && !destinationOverride;
      const params: Record<string, any> = {
        category: activeCategory,
        limit: 100, // Fetch a large batch so the client-side filter has enough candidates
        lat,
        lng,
        // Always use global radius — text searches must not be geographically constrained.
        radius_km: 20000,
      };

      // Pass the user's raw search term as both `q` (standard) and `name` (some backends).
      // This is the primary mechanism for finding listings by name, town, or country.
      if (isTextSearch) {
        params.q = queryText;
        params.name = queryText;
      }

      if (searchGuests > 1) params.guests = searchGuests;
      if (searchRooms > 1) params.rooms = searchRooms;
      if (priceMin > 0) params.price_min = priceMin;
      if (priceMax < 499999) params.price_max = priceMax;
      if (selectedRating) params.rating_min = selectedRating;
      if (selectedCancellation) params.cancellation_policy = selectedCancellation;
      if (showInstantOnly) params.instant_booking = true;
      if (selectedAmenities.length > 0) params.amenity_ids = selectedAmenities.flatMap(k => AMENITY_CATEGORY[k] ? [`${AMENITY_CATEGORY[k]}:${k}`, k] : [k]).join(",");

      if (activeCategory !== "car") {
        if (searchCheckIn) params.check_in = searchCheckIn;
        if (searchCheckOut) params.check_out = searchCheckOut;
      } else {
        if (searchPickupDate) params.pickup_datetime = searchPickupDate;
        if (searchReturnDate) params.return_datetime = searchReturnDate;
      }

      // Call listing search API
      const res = await listingApi.get<any>("/search", { params });
      const data = res.data?.data ?? {};
      const results: any[] = data.results ?? (Array.isArray(data) ? data : []);
      const mapped = results.map(mapSearchResult);

      // Client-side text filter — the definitive gate that ensures ONLY matching listings
      // are rendered, regardless of what the geo-radius API returned.
      // Fields matched (any field containing the term wins):
      //   Hotels / Apartments: name, town, country, address, description
      //   Cars:                name, town, country, address, description, carMake, carModel
      let displayListings = mapped;
      if (isTextSearch) {
        const term = queryText.toLowerCase().trim();
        displayListings = mapped.filter((listing) => {
          const fields: (string | undefined | null)[] = [
            listing.name,
            listing.town,
            listing.country,
            listing.address,
            listing.description,
          ];
          if (activeCategory === "car") {
            fields.push(listing.carMake, listing.carModel);
          }
          return fields.some((f) => f && String(f).toLowerCase().includes(term));
        });
      }

      setSearchOffset(0);
      setTotalCount(isTextSearch ? displayListings.length : (data.totalCount ?? data.availableCount ?? displayListings.length));
      if (displayListings.length > 0) {
        setListings(displayListings);
        fetchActivePromotion(activeCategory);
      } else {
        setListings([]);
        setActivePromotion(null);
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

  // 3b. Load More — append next page of search results, always scoped to the active query
  async function loadMoreListings() {
    if (loadingMore) return;
    setLoadingMore(true);
    const nextOffset = searchOffset + 20;
    const activeQuery = searchDestination.trim();
    try {
      const destinationLower = activeQuery.toLowerCase();
      let lat = -1.2921, lng = 36.8219;
      if (destinationLower.includes("mombasa")) { lat = -3.982; lng = 39.726; }
      else if (destinationLower.includes("paris")) { lat = 48.8566; lng = 2.3522; }
      else if (activeQuery) {
        try {
          const g = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(activeQuery)}&format=json&limit=1`, { headers: { "Accept-Language": "en", "User-Agent": "Kainook/1.0" } });
          const gd = await g.json();
          if (gd?.[0]) { lat = parseFloat(gd[0].lat); lng = parseFloat(gd[0].lon); }
        } catch { }
      }
      // Always use global radius and pass the search term so Load More stays
      // scoped to the active query — never falls back to the full inventory.
      const params: Record<string, any> = { category: searchCategory, limit: 100, offset: nextOffset, lat, lng, radius_km: 20000 };
      if (activeQuery) {
        params.q = activeQuery;
        params.name = activeQuery;
      }
      if (searchGuests > 1) params.guests = searchGuests;
      if (searchRooms > 1) params.rooms = searchRooms;
      if (priceMin > 0) params.price_min = priceMin;
      if (priceMax < 499999) params.price_max = priceMax;
      if (selectedRating) params.rating_min = selectedRating;
      if (selectedCancellation) params.cancellation_policy = selectedCancellation;
      if (showInstantOnly) params.instant_booking = true;
      if (selectedAmenities.length > 0) params.amenity_ids = selectedAmenities.flatMap(k => AMENITY_CATEGORY[k] ? [`${AMENITY_CATEGORY[k]}:${k}`, k] : [k]).join(",");
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
      const mapped = results.map(mapSearchResult);
      // Apply the same client-side text filter so appended pages are also accurate
      const filtered = activeQuery
        ? mapped.filter((listing) => {
          const term = activeQuery.toLowerCase();
          const fields: (string | undefined | null)[] = [
            listing.name, listing.town, listing.country, listing.address, listing.description,
          ];
          if (searchCategory === "car") fields.push(listing.carMake, listing.carModel);
          return fields.some((f) => f && String(f).toLowerCase().includes(term));
        })
        : mapped;
      if (filtered.length > 0) {
        setListings((prev) => [...prev, ...filtered]);
        setSearchOffset(nextOffset);
      }
    } catch { }
    finally { setLoadingMore(false); }
  }

  async function handleToggleFavourite(listingId: string) {
    if (!hasAuthToken) {
      setShowFavAuthPrompt(true);
      return;
    }
    await toggleFavourite(listingId);
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
    setVoucherError("");
    setActivePromotion(null);
    setPromotionDiscount(0);
    setApplicableVouchers([]);
    setWalletVouchers([]);
    setDetailCheckIn(searchCheckIn || "");
    setDetailCheckOut(searchCheckOut || "");
    setDetailPickupDate(searchPickupDate || "");
    setDetailReturnDate(searchReturnDate || "");

    try {
      const res = await listingApi.get<any>(`/listings/${id}/public`);
      if (res.data.success && res.data.data) {
        const item = res.data.data;
        const rawRoomTypes = item.hotelRoomTypes || item.roomTypes || [];
        const details: PublicListingDetail = {
          id: item.id,
          providerId: item.providerId,
          category: item.category,
          name: item.name,
          description: item.description,
          pricePerNight: (() => {
            let basePrice = Number(item.pricePerNight || item.pricePerDay || 0);
            if ((item.category === "hotel" || item.listingType === "hotel") && Array.isArray(rawRoomTypes) && rawRoomTypes.length > 0) {
              const activeRts = rawRoomTypes.filter((rt: any) => rt.isActive !== false);
              if (activeRts.length > 0) {
                const prices = activeRts
                  .map((rt: any) => Number(rt.pricePerNight))
                  .filter((p: number) => !isNaN(p) && p > 0);
                if (prices.length > 0) {
                  return Math.min(...prices);
                }
              }
            }
            return basePrice;
          })(),
          currency: item.currency,
          minStayNights: item.minStayNights,
          checkinTime: item.checkinTime,
          checkoutTime: item.checkoutTime,
          cancellationPolicy: item.cancellationPolicy,
          address: item.address || "",
          lat: item.lat,
          lng: item.lng,
          town: item.town || "",
          neighborhood: item.neighborhood || "",
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
          customAmenities: item.customAmenities || [],
          roomTypes: rawRoomTypes
        };
        setDetailListing(details);

        let cheapestRtId: string | null = null;
        if (details.category === "hotel" && details.roomTypes && details.roomTypes.length > 0) {
          const activeRts = details.roomTypes.filter((rt) => rt.isActive !== false);
          if (activeRts.length > 0) {
            const sorted = [...activeRts].sort((a, b) => a.pricePerNight - b.pricePerNight);
            cheapestRtId = sorted[0]?.id ?? null;
          }
        }
        setSelectedRoomTypeId(cheapestRtId);

        addToRecentlyViewed(details);
        listingApi.post("/guests/me/recently-viewed", { listingId: id }).catch(() => { });
        fetchActivePromotion(details.category);
        // Fetch wallet + applicable vouchers as soon as the listing opens so the
        // dropdown is populated in the details step (before the booking lock).
        if (hasAuthToken) {
          fetchWalletVouchers();
          fetchApplicableVouchers(details.id, details.category, details.country);
        }
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
    const start = category === "car" ? detailPickupDate : detailCheckIn;
    const end = category === "car" ? detailReturnDate : detailCheckOut;
    if (!start || !end || !listingId) { setAvailabilityStatus(null); return; }

    setAvailabilityStatus("checking");
    try {
      const res = await listingApi.get<any>(`/listings/${listingId}/availability`, {
        params: { start, end },
      });
      if (res.data.success) {
        const d = res.data.data ?? {};
        let unavailableRanges: { start: string; end: string }[] = [];

        if (category === "hotel") {
          if (!selectedRoomTypeId) {
            setAvailabilityStatus(null);
            return;
          }
          const rtAvail = (d.roomTypeAvailability ?? []).find(
            (rt: any) => rt.roomTypeId === selectedRoomTypeId
          );
          unavailableRanges = rtAvail?.unavailableRanges ?? [];
        } else {
          unavailableRanges = d.unavailableRanges ?? [];
        }

        const userStart = category === "car" ? detailPickupDate : detailCheckIn;
        const userEnd = category === "car" ? detailReturnDate : detailCheckOut;
        if (!userStart || !userEnd) {
          setAvailabilityStatus(null);
          return;
        }
        const hasOverlap = unavailableRanges.some(
          (r) => userStart < r.end && userEnd > r.start
        );
        setAvailabilityStatus(hasOverlap ? "unavailable" : "available");
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

  async function fetchPricingEstimate() {
    if (!detailListing || lockToken) return;
    const isCar = detailListing.category === "car";
    const start = isCar ? detailPickupDate : detailCheckIn;
    const end = isCar ? detailReturnDate : detailCheckOut;
    if (!start || !end || !detailListing.id) { setEstimatedPricing(null); setEstimatingPricing(false); return; }

    setEstimatedPricing(null);
    setEstimatingPricing(true);
    try {
      const res = await listingApi.post<any>("/bookings/pricing-estimate", {
        listingId: detailListing.id,
        roomTypeId: selectedRoomTypeId || undefined,
        checkIn: isCar ? undefined : detailCheckIn || undefined,
        checkOut: isCar ? undefined : detailCheckOut || undefined,
        pickupDatetime: isCar ? detailPickupDate || undefined : undefined,
        returnDatetime: isCar ? detailReturnDate || undefined : undefined,
        guests: searchAdults + searchChildren,
      });
      if (res.data?.success && res.data.data?.pricingPreview) {
        setEstimatedPricing(res.data.data.pricingPreview);
      } else {
        setEstimatedPricing(null);
      }
    } catch {
      setEstimatedPricing(null);
    } finally {
      setEstimatingPricing(false);
    }
  }

  // Re-check availability + fetch pricing estimate whenever dates change.
  // GET /listings/:id/availability is PUBLIC — no auth guard needed.
  useEffect(() => {
    if (!detailListing || lockToken) return;
    setBookingError("");
    checkAvailability(detailListing.id, detailListing.category);
    fetchPricingEstimate();
  }, [detailCheckIn, detailCheckOut, detailPickupDate, detailReturnDate, detailListing?.id, selectedRoomTypeId, searchAdults, searchChildren]);

  // Recompute promotion discount whenever dates or active promotion changes.
  // effectiveDiscountSource is derived — no state mutation needed here.
  useEffect(() => {
    if (!activePromotion || !detailListing || !isPromotionValid(activePromotion) || activePromotion.activity !== detailListing.category) {
      setPromotionDiscount(0);
      return;
    }
    const isCar = detailListing.category === "car";
    const start = isCar ? detailPickupDate : detailCheckIn;
    const end = isCar ? detailReturnDate : detailCheckOut;
    const days = calcDays(start, end);
    if (days <= 0) { setPromotionDiscount(0); return; }

    const isHotel = detailListing.category === "hotel";
    const selectedRt = isHotel
      ? (detailListing.roomTypes ?? []).find((r) => r.id === selectedRoomTypeId)
      : null;
    const pricePerNight = selectedRt ? selectedRt.pricePerNight : detailListing.pricePerNight;

    const base = pricePerNight * days;
    const pDiscount = activePromotion.discountType === "percentage"
      ? Math.round(base * activePromotion.discountValue / 100)
      : Math.round(activePromotion.discountValue);
    setPromotionDiscount(pDiscount);
  }, [activePromotion, detailCheckIn, detailCheckOut, detailPickupDate, detailReturnDate, detailListing?.id, selectedRoomTypeId]);

  // Helper: calculate nights/days between two date strings
  function calcDays(start: string, end: string): number {
    if (!start || !end) return 0;
    try {
      const [sy, sm, sd] = start.split("-").map(Number);
      const [ey, em, ed] = end.split("-").map(Number);
      if (
        sy !== undefined && sm !== undefined && sd !== undefined &&
        ey !== undefined && em !== undefined && ed !== undefined &&
        !isNaN(sy) && !isNaN(sm) && !isNaN(sd) &&
        !isNaN(ey) && !isNaN(em) && !isNaN(ed)
      ) {
        const s = new Date(sy, sm - 1, sd).getTime();
        const e = new Date(ey, em - 1, ed).getTime();
        const diff = Math.round((e - s) / (1000 * 60 * 60 * 24));
        return Math.max(1, diff);
      }
      const diff = new Date(end).getTime() - new Date(start).getTime();
      return Math.max(1, Math.round(diff / (1000 * 60 * 60 * 24)));
    } catch {
      return 0;
    }
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

    if (detailListing.category === "hotel") {
      if (!selectedRoomTypeId) {
        setBookingError("Please select a room type.");
        setLockingListing(false);
        return;
      }
      body.roomTypeId = selectedRoomTypeId;
    }

    if (detailListing.category !== "car") {
      if (!detailCheckIn || !detailCheckOut) {
        setBookingError("Please select check-in and check-out dates.");
        setLockingListing(false);
        return;
      }
      body.checkIn = detailCheckIn;
      body.checkOut = detailCheckOut;
    } else {
      if (!detailPickupDate || !detailReturnDate) {
        setBookingError("Please select pickup and return dates.");
        setLockingListing(false);
        return;
      }
      body.pickupDatetime = toIsoDatetime(detailPickupDate);
      body.returnDatetime = toIsoDatetime(detailReturnDate);
    }

    try {
      const res = await listingApi.post<any>("/bookings/initiate", body);
      if (res.data.success && res.data.data?.lockToken) {
        setLockToken(res.data.data.lockToken);
        if (res.data.data.pricingPreview) {
          setPricingPreview(res.data.data.pricingPreview);
        }
        setSecondsLeft(300);
        setBookingError("");
        setCheckoutStep("review");
        setPaymentId(null);
        if (paymentPollRef.current) clearInterval(paymentPollRef.current);
        fetchApplicableVouchers(detailListing.id, detailListing.category, detailListing.country);
        fetchWalletVouchers();
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

  function toActivity(category: string): string {
    const map: Record<string, string> = { hotel: "hotels", apartment: "apartments", car: "cars" };
    return map[category] ?? category;
  }

  // 6. Voucher Discount Validation — sends full booking context for tier/scope/country checks
  async function handleVoucherApply(codeOverride?: string) {
    const code = codeOverride ?? voucherCode;
    if (!code || !detailListing) return;
    if (codeOverride) setVoucherCode(codeOverride);
    setVoucherError("");

    const isCar = detailListing.category === "car";
    const start = isCar ? detailPickupDate : detailCheckIn;
    const end = isCar ? detailReturnDate : detailCheckOut;
    const days = calcDays(start, end);
    const orderValue = detailListing.pricePerNight * Math.max(1, days);

    try {
      console.log("[ZikaSearch] Validating voucher code:", code, "with order value:", orderValue);
      const res = await listingApi.post<any>("/vouchers/validate", {
        code,
        totalAmount: orderValue,
        listingId: detailListing.id,
        activity: toActivity(detailListing.category),
        guestCountry: detailListing.country,
        guestId: user?.id ?? "",
        guestTier: user?.currentTier ? capitalize(user.currentTier) : undefined,
      });
      console.log("[ZikaSearch] Voucher validation API response:", res.data);
      if (res.data.success && res.data.data.valid) {
        const vDiscount = res.data.data.discountAmount || 0;
        console.log("[ZikaSearch] Voucher discount amount computed:", vDiscount);

        // Promotion stacking guard — reject voucher if an active promotion gives more
        if (activePromotion && promotionDiscount > vDiscount) {
          console.log("[ZikaSearch] Voucher rejected: active promotion gives better discount", { promotionDiscount, voucherDiscount: vDiscount });
          setVoucherError(`A better promotion (${activePromotion.name || "Category Discount"}) is active. Vouchers cannot be stacked with active promotions.`);
          return;
        }

        console.log("[ZikaSearch] Voucher accepted");
        setVoucherApplied(true);
        setVoucherDiscount(vDiscount);
      } else {
        const errMsg = res.data?.data?.message ?? res.data?.error?.message ?? "Invalid voucher code";
        console.error("[ZikaSearch] Voucher validation failed:", errMsg);
        setVoucherError(errMsg);
      }
    } catch (err: any) {
      const errMsg = err?.response?.data?.error?.message ?? "Invalid voucher code";
      console.error("[ZikaSearch] Voucher validation error:", err);
      setVoucherError(errMsg);
    }
  }

  // Fetch active promotions for a listing category
  async function fetchActivePromotion(category: string) {
    try {
      console.log("[ZikaSearch] Fetching active promotions for category:", category);
      const res = await listingApi.get<any>("/promotions/active", { params: { category } });
      console.log("[ZikaSearch] Active promotions API response:", res.data);
      if (res.data.success) {
        const raw = res.data.data ?? [];
        const promos: ActivePromotion[] = Array.isArray(raw)
          ? raw
          : (raw?.promotions ?? []);
        // Coerce discountValue to number — API may return it as a string
        const normalised = promos.map((p: any) => ({
          ...p,
          discountValue: Number(p.discountValue),
        }));
        const matched = normalised.filter(
          (p: any) => p.activity === category && isPromotionValid(p)
        );
        console.log("[Promotion] Active promotion loaded & matched:", matched);
        console.log("[ZikaSearch] Active promotion count received & matched:", matched.length);
        setActivePromotion(matched.length > 0 ? (matched[0] ?? null) : null);
      } else {
        console.warn("[ZikaSearch] Active promotions fetch was not successful:", res.data);
        setActivePromotion(null);
      }
    } catch (err) {
      console.error("[ZikaSearch] fetchActivePromotion error:", err);
      setActivePromotion(null);
    }
  }

  // Fetch auto-assigned vouchers applicable to the current booking context.
  // Guard removed: if a lock was obtained, the backend already confirmed the user is authenticated.
  async function fetchApplicableVouchers(listingId: string, category: string, country: string) {
    setLoadingApplicableVouchers(true);
    try {
      console.log("[ZikaSearch] Fetching applicable vouchers for listing:", listingId, category, country);
      const res = await listingApi.get<any>("/vouchers/applicable", {
        params: { listingId, category, country },
      });
      console.log("[ZikaSearch] Applicable vouchers API response:", res.data);
      if (res.data.success) {
        const vouchers = res.data.data ?? [];
        console.log("[ZikaSearch] Applicable vouchers count received:", vouchers.length);
        setApplicableVouchers(vouchers);
      } else {
        setApplicableVouchers([]);
      }
    } catch (err) {
      console.error("[ZikaSearch] fetchApplicableVouchers error:", err);
      setApplicableVouchers([]);
    } finally {
      setLoadingApplicableVouchers(false);
    }
  }

  // Fetch the user's full voucher wallet — GET /vouchers/wallet (no booking context needed).
  async function fetchWalletVouchers() {
    setLoadingWalletVouchers(true);
    try {
      console.log("[ZikaSearch] Fetching wallet vouchers...");
      const res = await listingApi.get<any>("/vouchers/wallet");
      console.log("[ZikaSearch] Wallet vouchers API response:", res.data);
      if (res.data.success) {
        const vouchers = res.data.data ?? [];
        console.log("[ZikaSearch] Wallet vouchers count received:", vouchers.length);
        setWalletVouchers(vouchers);
      } else {
        setWalletVouchers([]);
      }
    } catch (err) {
      console.error("[ZikaSearch] fetchWalletVouchers error:", err);
      setWalletVouchers([]);
    } finally {
      setLoadingWalletVouchers(false);
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
            currency: detailListing?.currency || "USD",
            pointsAwarded: Math.round(amount * 0.1),
          });
          if (user) updateUser({ loyaltyPoints: user.loyaltyPoints + Math.round(amount * 0.1) });
          // Webhook confirms booking asynchronously — pre-fetch bookings after delay so "My Reservations" shows confirmed status
          setTimeout(() => fetchGuestBookings(), 7000);
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
      body.checkIn = detailCheckIn;
      body.checkOut = detailCheckOut;
    } else {
      body.pickupDatetime = toIsoDatetime(detailPickupDate);
      body.returnDatetime = toIsoDatetime(detailReturnDate);
      body.driverFirstName = driverFirstName || firstName;
      body.driverLastName = driverLastName || lastName;
      body.driverAge = driverAge;
      body.deliveryRequested = deliveryRequested;
      body.deliveryAddress = deliveryAddress;
    }
    if (effectiveDiscountSource === "voucher" && voucherApplied) body.voucherCode = voucherCode;
    if (effectiveDiscountSource === "promotion" && activePromotion) body.promotionId = activePromotion.id;

    try {
      // Step 1: Create booking
      const bookingRes = await listingApi.post<any>("/bookings", body);
      if (!bookingRes.data.success || !bookingRes.data.data.bookingId) {
        setBookingError(bookingRes.data?.error?.message ?? "Booking failed. Please try again.");
        return;
      }
      const bookingId = bookingRes.data.data.bookingId;
      const bookingRef = bookingRes.data.data.bookingReference as string;
      const total = Number(bookingRes.data.data.totalAmount) || 0;
      setPendingBookingRef(bookingRef);
      setPendingBookingAmount(total);

      // Step 2: Initiate payment via payment service
      let pmId: string;
      if (paymentProvider === "stripe" && !selectedMethodId) {
        // New card — create PaymentIntent first
        const intentRes = await paymentApi.post<any>("/payments/create-intent", { bookingId });
        if (!intentRes.data.success) {
          setBookingError(intentRes.data?.error?.message ?? "Payment initiation failed.");
          return;
        }
        pmId = intentRes.data.data.paymentId as string;
        const clientSecret = intentRes.data.data.clientSecret as string;
        const publishableKey =
          (intentRes.data.data.publishableKey as string) ||
          process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!;
        setPaymentId(pmId);
        setStripeClientSecret(clientSecret);
        const { loadStripe } = await import("@stripe/stripe-js");
        const stripe = await loadStripe(publishableKey);
        setStripeInstance(stripe);
        setCheckoutStep("stripe_card");
      } else {
        // Saved card (Stripe off-session) or Tara
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
        pmId = paymentRes.data.data.paymentId as string;
        setPaymentId(pmId);

        if (paymentProvider === "stripe") {
          // Saved card — backend may return clientSecret for 3DS auth
          const { clientSecret, publishableKey } = paymentRes.data.data as { clientSecret?: string; publishableKey?: string };
          if (clientSecret) {
            setStripeClientSecret(clientSecret);
            const { loadStripe } = await import("@stripe/stripe-js");
            const stripe = await loadStripe(publishableKey || process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);
            setStripeInstance(stripe);
            setCheckoutStep("stripe_card");
          } else {
            setCheckoutStep("polling");
            startPaymentPolling(pmId, bookingRef, total);
          }
        } else if (paymentProvider === "tara") {
          setCheckoutStep("polling");
          startPaymentPolling(pmId, bookingRef, total);
        }
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
        raw.map((b: any) => {
          const mapped = {
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
          };
          return mapped;
        })
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
    const isHotel = detailListing.category === "hotel";
    const selectedRt = isHotel
      ? (detailListing.roomTypes ?? []).find((r) => r.id === selectedRoomTypeId)
      : null;
    const pricePerNight = selectedRt ? selectedRt.pricePerNight : detailListing.pricePerNight;

    const ctx = {
      listingId: detailListing.id,
      listingTitle: detailListing.name,
      listingCategory: detailListing.category,
      listingPhoto: detailListing.primaryPhotoUrl ?? null,
      listingTown: detailListing.town,
      listingCountry: detailListing.country,
      pricePerNight,
      currency: detailListing.currency,
      checkIn: !isCar ? detailCheckIn : undefined,
      checkOut: !isCar ? detailCheckOut : undefined,
      pickupDatetime: isCar ? toIsoDatetime(detailPickupDate) : undefined,
      returnDatetime: isCar ? toIsoDatetime(detailReturnDate) : undefined,
      nightsOrDays: calcDays(isCar ? detailPickupDate : detailCheckIn, isCar ? detailReturnDate : detailCheckOut),
      adults: searchAdults,
      children: searchChildren,
      lockToken,
      lockExpiresAt: new Date(Date.now() + (secondsLeft ?? 0) * 1000).toISOString(),
      voucherCode: effectiveDiscountSource === "voucher" && voucherApplied ? voucherCode : undefined,
      voucherDiscount: bestDiscount,
      promotionId: effectiveDiscountSource === "promotion" && activePromotion ? activePromotion.id : undefined,
      discountSource: effectiveDiscountSource ?? undefined,
      firstName, lastName, email, phone, specialRequests,
      driverFirstName: isCar ? (driverFirstName || firstName) : undefined,
      driverLastName: isCar ? (driverLastName || lastName) : undefined,
      driverAge: isCar ? driverAge : undefined,
      deliveryRequested: isCar ? deliveryRequested : undefined,
      deliveryAddress: isCar ? deliveryAddress : undefined,
      roomTypeId: selectedRoomTypeId ?? undefined,
      roomTypeName: selectedRt ? selectedRt.name : undefined,
      roomType: selectedRt ? selectedRt.roomType : undefined,
      pricingPreview: pricingPreview ?? undefined,
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
        <div className="animate-spin h-10 w-10 border-4 border-[#1D8D2B] border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-800 font-sans selection:bg-[#0c2614] selection:text-white antialiased">
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
              className="lg:col-span-12 flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-[#1D8D2B] transition shrink-0 uppercase tracking-wide"
            >
              <span>←</span> Back to Search Results
            </button>

            {loadingDetail ? (
              <div className="lg:col-span-12 py-32 flex justify-center">
                <div className="animate-spin h-8 w-8 border-4 border-[#1D8D2B] border-t-transparent rounded-full" />
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
                      {detailListing.starRating && <span className="flex items-center gap-1"><span className="text-[#1D8D2B]">⭐</span> {detailListing.starRating}</span>}
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
                    photos={detailListing.photos}
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
                    <div className="w-full h-[300px] rounded-2xl overflow-hidden border border-slate-200 relative z-0">
                      {detailListing.lat && detailListing.lng ? (
                        <MapView
                          listings={[detailListing]}
                          hoveredId={detailListing.id}
                          onHover={() => {}}
                          onSelect={() => {}}
                        />
                      ) : (
                        <div className="w-full h-full bg-slate-100 flex items-center justify-center">
                          <div className="text-center space-y-2 text-slate-400">
                            <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                            </svg>
                            <p className="text-sm font-semibold text-slate-600">{detailListing.town}{detailListing.country ? `, ${detailListing.country}` : ""}</p>
                            <p className="text-xs text-slate-400 mt-1">Location coordinates not available</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Column (Sticky Sidebar) */}
                <div className="lg:col-span-4 relative lg:sticky lg:top-28 top-4 self-start">
                  <div className="bg-white border border-slate-200 shadow-xl rounded-2xl p-6 text-left shadow-slate-200/50">
                    {/* Price header */}
                    {(() => {
                      const isHotel = detailListing.category === "hotel";
                      const selectedRt = isHotel
                        ? (detailListing.roomTypes ?? []).find((r) => r.id === selectedRoomTypeId)
                        : null;
                      const basePrice = selectedRt ? selectedRt.pricePerNight : detailListing.pricePerNight;

                      // Calculate discount
                      const hasLongStay = detailListing.longStayDiscountEnabled;
                      const longStayPct = hasLongStay ? 15 : 0;
                      let displayPrice = basePrice;
                      const isValidPromo = activePromotion && activePromotion.activity === detailListing.category && isPromotionValid(activePromotion);

                      if (isValidPromo) {
                        const promoDiscount = activePromotion.discountType === "percentage"
                          ? Math.round(basePrice * (Number(activePromotion.discountValue) / 100))
                          : Math.round(Number(activePromotion.discountValue));
                        displayPrice = Math.max(0, basePrice - promoDiscount);
                      } else if (hasLongStay) {
                        displayPrice = Math.round(basePrice * (1 - longStayPct / 100));
                      }

                      return (
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <div className="flex items-baseline gap-2 flex-wrap">
                              <span className="text-2xl font-extrabold text-slate-900">
                                {detailListing.currency} {displayPrice.toLocaleString()}
                              </span>
                              {basePrice > displayPrice && (
                                <span className="text-sm font-semibold line-through text-slate-400">
                                  {detailListing.currency} {basePrice.toLocaleString()}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-400 font-medium mt-0.5">
                              / {detailListing.category === "car" ? "day" : "night"}
                            </div>
                          </div>
                          {detailListing.starRating && (
                            <div className="text-sm font-semibold flex items-center gap-1 text-slate-800 bg-slate-50 border border-slate-100 rounded-full px-2.5 py-1">
                              ⭐ {detailListing.starRating}
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Best Offer banner — shown when an active promotion exists */}
                    {activePromotion && (
                      <div className="mb-4 flex items-center gap-2.5 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5">
                        <span className="text-base shrink-0">🏷️</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Best Offer</p>
                          <p className="text-xs font-semibold text-emerald-800 truncate">{activePromotion.name}</p>
                        </div>
                        <span className="shrink-0 text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full whitespace-nowrap">
                          {activePromotion.discountType === "percentage"
                            ? `${activePromotion.discountValue}% off`
                            : `${detailListing.currency} ${activePromotion.discountValue} off`}
                        </span>
                      </div>
                    )}

                    <div className="mb-4 space-y-3">
                      <MessageProviderButton listingId={detailListing.id} />
                      <GiveReviewEntry listingId={detailListing.id} listingName={detailListing.name} />
                    </div>

                    {!lockToken ? (() => {
                      const isCar = detailListing.category === "car";
                      const isHotel = detailListing.category === "hotel";
                      const selectedRt = isHotel
                        ? (detailListing.roomTypes ?? []).find((r) => r.id === selectedRoomTypeId)
                        : null;
                      const pricePerNight = selectedRt ? selectedRt.pricePerNight : detailListing.pricePerNight;

                      const start = isCar ? detailPickupDate : detailCheckIn;
                      const end = isCar ? detailReturnDate : detailCheckOut;
                      const days = calcDays(start, end);
                      const baseTotal = pricePerNight * days;
                      const sidebarDiscount = bestDiscount;

                      return (
                        <div className="space-y-4">
                          {/* Date inputs */}
                          <div className="space-y-3">
                            {isCar ? (
                              <DateRangePicker
                                label="Rental Dates"
                                isCar
                                startDate={detailPickupDate}
                                endDate={detailReturnDate}
                                onChange={(start, end) => {
                                  setDetailPickupDate(start);
                                  setDetailReturnDate(end);
                                }}
                                minDate={getTodayString()}
                              />
                            ) : (
                              <>
                                <DateRangePicker
                                  label="Check-in – Check-out"
                                  startDate={detailCheckIn}
                                  endDate={detailCheckOut}
                                  onChange={(start, end) => {
                                    setDetailCheckIn(start);
                                    setDetailCheckOut(end);
                                  }}
                                  minDate={getTodayString()}
                                />
                                <div className="border border-slate-200 rounded-xl p-3 bg-slate-50">
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Guests</p>
                                  <select
                                    value={searchAdults}
                                    onChange={(e) => setSearchAdults(Number(e.target.value))}
                                    className="w-full mt-1 text-sm bg-transparent outline-none font-bold text-slate-700"
                                  >
                                    {[1, 2, 3, 4, 5, 6].map((n) => (
                                      <option key={n} value={n}>{n} guest{n > 1 ? "s" : ""}</option>
                                    ))}
                                  </select>
                                </div>
                              </>
                            )}
                          </div>
                          {detailListing.category === "hotel" && detailListing.roomTypes && detailListing.roomTypes.length > 0 && (
                                  <div className="p-3 border-t border-slate-200">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Room Type</p>
                                    <select
                                      value={selectedRoomTypeId || ""}
                                      onChange={(e) => setSelectedRoomTypeId(e.target.value || null)}
                                      className="w-full mt-1 text-sm bg-transparent outline-none font-semibold text-slate-800"
                                    >
                                      {detailListing.roomTypes
                                        .filter((rt) => rt.isActive !== false)
                                        .map((rt) => {
                                          const baseRtPrice = rt.pricePerNight;
                                          let displayRtPrice = baseRtPrice;
                                          const isValidPromo = activePromotion && activePromotion.activity === detailListing.category && isPromotionValid(activePromotion);
                                          const hasLongStay = detailListing.longStayDiscountEnabled;
                                          const longStayPct = hasLongStay ? 15 : 0;

                                          if (isValidPromo) {
                                            const promoDiscount = activePromotion.discountType === "percentage"
                                              ? Math.round(baseRtPrice * (Number(activePromotion.discountValue) / 100))
                                              : Math.round(Number(activePromotion.discountValue));
                                            displayRtPrice = Math.max(0, baseRtPrice - promoDiscount);
                                          } else if (hasLongStay) {
                                            displayRtPrice = Math.round(baseRtPrice * (1 - longStayPct / 100));
                                          }

                                          return (
                                            <option key={rt.id} value={rt.id}>
                                              {rt.name} — {detailListing.currency} {displayRtPrice.toLocaleString()}/night{baseRtPrice > displayRtPrice ? ` (was ${detailListing.currency} ${baseRtPrice.toLocaleString()})` : ""}
                                            </option>
                                          );
                                        })}
                                    </select>
                                  </div>
                                )}

                          {/* Voucher / Promo code selector */}
                          {renderVoucherSelector()}

                          {/* Availability indicator */}
                          {availabilityStatus === "checking" && (
                            <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                              <div className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                              Checking availability…
                            </div>
                          )}
                          {availabilityStatus === "unavailable" && (
                            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs font-semibold text-red-700">
                              Selected dates are no longer available. Please choose different dates.
                            </div>
                          )}
                          {availabilityStatus === "available" && (
                            <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-xs font-semibold text-emerald-700">
                              Dates are available — reserve now!
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
                            className="w-full py-3.5 bg-[#0c2614] hover:bg-[#081b0d] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition text-sm"
                          >
                            {lockingListing ? "Securing your dates…" : "Reserve — You won't be charged yet"}
                          </button>

                          {/* Dynamic price breakdown */}
                          {days > 0 && (
                            estimatingPricing && !estimatedPricing ? (
                              <div className="space-y-3 pt-2 border-t border-slate-100 animate-pulse">
                                <div className="h-4 bg-slate-200 rounded w-3/4" />
                                <div className="h-4 bg-slate-200 rounded w-1/2" />
                                <div className="h-4 bg-slate-200 rounded w-5/6" />
                                <div className="h-5 bg-slate-200 rounded w-2/3 mt-2" />
                              </div>
                            ) : estimatedPricing ? (
                              <div className="space-y-2 pt-2 border-t border-slate-100 text-sm text-slate-600">
                                <div className="flex justify-between">
                                  <span>{detailListing.currency} {pricePerNight.toLocaleString()} × {days} {isCar ? "day" : "night"}{days > 1 ? "s" : ""}</span>
                                  <span>{detailListing.currency} {estimatedPricing.baseAmount.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Service fee{estimatedPricing.commissionRate ? ` (${Math.round(estimatedPricing.commissionRate * 100)}%)` : ''}</span>
                                  <span>{detailListing.currency} {estimatedPricing.serviceFee.toLocaleString()}</span>
                                </div>
                                {sidebarDiscount > 0 && (
                                  <div className="flex justify-between text-emerald-600 font-semibold">
                                    <span>{effectiveDiscountSource === "promotion" ? "Promotion discount" : "Voucher discount"}</span>
                                    <span>−{detailListing.currency} {sidebarDiscount.toLocaleString()}</span>
                                  </div>
                                )}
                                {estimatedPricing.taxAmount > 0 && (
                                  <div className="flex justify-between text-slate-500">
                                    <span>Taxes{estimatedPricing.taxRate ? ` (${Math.round(estimatedPricing.taxRate * 100)}%)` : ''}</span>
                                    <span>{detailListing.currency} {estimatedPricing.taxAmount.toLocaleString()}</span>
                                  </div>
                                )}
                                <div className="flex justify-between font-bold text-slate-900 border-t border-slate-200 pt-2 mt-1">
                                  <span>Total</span>
                                  <span>{detailListing.currency} {estimatedPricing.totalAmount.toLocaleString()}</span>
                                </div>
                              </div>
                            ) : days > 0 && (
                              <div className="space-y-2 pt-2 border-t border-slate-100 text-sm text-slate-600">
                                <div className="flex justify-between">
                                  <span>{detailListing.currency} {pricePerNight.toLocaleString()} × {days} {isCar ? "day" : "night"}{days > 1 ? "s" : ""}</span>
                                  <span>{detailListing.currency} {baseTotal.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-slate-400 text-xs italic">
                                  <span>Pricing estimate unavailable</span>
                                </div>
                              </div>
                            )
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
                                  <div className={`flex items-center gap-1 shrink-0 ${i < currentIdx ? "text-emerald-600" : i === currentIdx ? "text-[#1D8D2B]" : "text-slate-300"}`}>
                                    <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold ${i < currentIdx ? "bg-emerald-500 text-white" : i === currentIdx ? "bg-[#0c2614] text-white" : "bg-slate-200 text-slate-400"}`}>
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
                          const isHotel = detailListing.category === "hotel";
                          const selectedRt = isHotel
                            ? (detailListing.roomTypes ?? []).find((r) => r.id === selectedRoomTypeId)
                            : null;
                          const pricePerNight = selectedRt ? selectedRt.pricePerNight : detailListing.pricePerNight;
                          const start = isCar ? detailPickupDate : detailCheckIn;
                          const end = isCar ? detailReturnDate : detailCheckOut;
                          const days = pricingPreview ? pricingPreview.units : calcDays(start, end);
                          const base = pricingPreview ? pricingPreview.baseAmount : pricePerNight * days;
                          const discount = pricingPreview
                            ? (pricingPreview.promotionDiscount + (effectiveDiscountSource === "voucher" ? bestDiscount : 0))
                            : bestDiscount;
                          const subtotal = base - discount;
                          const serviceFee = pricingPreview ? pricingPreview.serviceFee : Math.ceil(subtotal * 0.05);
                          const taxAmount = pricingPreview ? pricingPreview.taxAmount : 0;
                          const grandTotal = pricingPreview
                            ? base - discount + serviceFee + taxAmount + (pricingPreview.deliveryFee ?? 0)
                            : Math.max(0, base + serviceFee + taxAmount - bestDiscount);
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
                                  <span className="font-bold text-slate-900">{isCar ? fmt(detailPickupDate) : fmt(detailCheckIn)}</span>
                                </div>
                                <div className="flex justify-between items-center px-3 py-2.5">
                                  <span className="text-slate-500 font-semibold uppercase tracking-wider">{isCar ? "Return" : "Check-out"}</span>
                                  <span className="font-bold text-slate-900">{isCar ? fmt(detailReturnDate) : fmt(detailCheckOut)}</span>
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
                                  <span>{detailListing.currency} {pricePerNight.toLocaleString()} × {days} {isCar ? "day" : "night"}{days !== 1 ? "s" : ""}</span>
                                  <span>{detailListing.currency} {base.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-slate-500">
                                  <span>Service fee{pricingPreview?.commissionRate ? ` (${Math.round(pricingPreview.commissionRate * 100)}%)` : ''}</span>
                                  <span>{detailListing.currency} {serviceFee.toLocaleString()}</span>
                                </div>
                                {taxAmount > 0 && (
                                  <div className="flex justify-between text-slate-500">
                                    <span>Taxes & VAT{pricingPreview?.taxRate ? ` (${Math.round(pricingPreview.taxRate * 100)}%)` : ''}</span>
                                    <span>{detailListing.currency} {taxAmount.toLocaleString()}</span>
                                  </div>
                                )}
                                {discount > 0 && (
                                  <div className="flex justify-between text-emerald-600 font-semibold">
                                    <span>{effectiveDiscountSource === "promotion" ? "Promotion discount" : "Voucher discount"}</span>
                                    <span>−{detailListing.currency} {discount.toLocaleString()}</span>
                                  </div>
                                )}

                                {renderVoucherSelector()}
                                <div className="flex justify-between font-bold text-slate-900 border-t border-slate-200 pt-2 text-base">
                                  <span>Total</span>
                                  <span>{detailListing.currency} {grandTotal.toLocaleString()}</span>
                                </div>
                              </div>

                              {/* Countdown */}
                              <div className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold border ${(secondsLeft ?? 0) < 60 ? "bg-red-50 border-red-200 text-red-700" : "bg-amber-50 border-amber-200 text-amber-700"}`}>
                                <span className="flex items-center gap-1.5">
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 018 0z" /></svg>
                                  {(secondsLeft ?? 0) < 60 ? "Expiring soon!" : "Hold expires in"}
                                </span>
                                <span className="font-mono tracking-wider">
                                  {Math.floor((secondsLeft || 0) / 60).toString().padStart(2, "0")}:{((secondsLeft || 0) % 60).toString().padStart(2, "0")}
                                </span>
                              </div>

                              <button type="button" onClick={() => { setCheckoutStep("details"); fetchSavedMethods(); }}
                                className="w-full py-3.5 bg-[#0c2614] hover:bg-[#081b0d] text-white font-bold rounded-xl transition text-sm">
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
                              <input type="text" required placeholder="First Name" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#1D8D2B]" />
                              <input type="text" required placeholder="Last Name" value={lastName} onChange={(e) => setLastName(e.target.value)} className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#1D8D2B]" />
                            </div>
                            <input type="email" required placeholder="Email Address" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#1D8D2B]" />
                            <input type="tel" placeholder="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#1D8D2B]" />
                            <textarea placeholder="Special requests (optional)" value={specialRequests} onChange={(e) => setSpecialRequests(e.target.value)} rows={2} className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#1D8D2B] resize-none" />
                            {detailListing.category === "car" && (
                              <input type="number" required min="18" max="99" placeholder="Driver Age" value={driverAge} onChange={(e) => setDriverAge(Number(e.target.value))} className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-[#1D8D2B]" />
                            )}
                          </div>

                          {/* Discount section — promotion badge + wallet vouchers + manual entry always visible */}
                          <div className="space-y-2">
                            {/* Promotion badge — always shown when a promotion exists */}
                            {promotionDiscount > 0 && activePromotion && (
                              <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5">
                                <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                                  <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                  {activePromotion.name}
                                  {effectiveDiscountSource === "voucher" && (
                                    <span className="text-slate-400 font-normal"> (voucher saves more)</span>
                                  )}
                                </span>
                                <span className="text-xs font-bold text-emerald-700">−{detailListing.currency} {promotionDiscount.toLocaleString()}</span>
                              </div>
                            )}

                            {renderVoucherSelector()}
                          </div>

                          {/* Price summary */}
                          {(() => {
                            const isCar = detailListing.category === "car";
                            const isHotel = detailListing.category === "hotel";
                            const selectedRt = isHotel
                              ? (detailListing.roomTypes ?? []).find((r) => r.id === selectedRoomTypeId)
                              : null;
                            const pricePerNight = selectedRt ? selectedRt.pricePerNight : detailListing.pricePerNight;
                            const start = isCar ? detailPickupDate : detailCheckIn;
                            const end = isCar ? detailReturnDate : detailCheckOut;
                            const days = pricingPreview ? pricingPreview.units : calcDays(start, end);
                            const baseTotal = pricingPreview ? pricingPreview.baseAmount : pricePerNight * days;
                            const discount = pricingPreview
                              ? (pricingPreview.promotionDiscount + (effectiveDiscountSource === "voucher" ? bestDiscount : 0))
                              : bestDiscount;
                            const subtotal = baseTotal - discount;
                            const serviceFee = pricingPreview ? pricingPreview.serviceFee : Math.ceil(subtotal * 0.05);
                            const grandTotal = pricingPreview
                              ? baseTotal - discount + serviceFee + (pricingPreview.deliveryFee ?? 0)
                              : Math.max(0, baseTotal + serviceFee - bestDiscount);
                            return (
                              <div className="space-y-2 text-sm text-slate-600 border-t border-slate-100 pt-3">
                                <div className="flex justify-between">
                                  <span>{detailListing.currency} {pricePerNight.toLocaleString()} × {days} {isCar ? "day" : "night"}{days > 1 ? "s" : ""}</span>
                                  <span>{detailListing.currency} {baseTotal.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between"><span>Service fee{pricingPreview?.commissionRate ? ` (${Math.round(pricingPreview.commissionRate * 100)}%)` : ''}</span><span>{detailListing.currency} {serviceFee.toLocaleString()}</span></div>
                                {discount > 0 && (
                                  <div className="flex justify-between text-emerald-600 font-semibold">
                                    <span>{effectiveDiscountSource === "promotion" ? "Promotion discount" : "Voucher discount"}</span>
                                    <span>−{detailListing.currency} {discount.toLocaleString()}</span>
                                  </div>
                                )}
                                <div className="flex justify-between font-bold text-slate-900 border-t border-slate-200 pt-2">
                                  <span>Total to pay</span>
                                  <span>{detailListing.currency} {grandTotal.toLocaleString()}</span>
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
                          <button type="button" onClick={handleContinueToReview} className="w-full py-3.5 bg-[#0c2614] hover:bg-[#081b0d] text-white font-bold rounded-xl transition text-sm mt-1">
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
                <div className="lg:col-span-12">
                  <PublicReviewsSection listingId={detailListing.id} />
                </div>
              </>
            ) : (
              <div className="lg:col-span-12 py-24 text-center text-slate-500">
                <p className="text-lg font-semibold">Reservation details are unavailable.</p>
                <p className="mt-2 text-sm">Please go back to search or select a different listing.</p>
                <button
                  onClick={() => { setSelectedListingId(null); setActiveTab("home"); }}
                  className="mt-6 inline-flex items-center justify-center rounded-full bg-[#0c2614] px-6 py-3 text-sm font-semibold text-white hover:bg-[#081b0d] transition"
                >
                  Return to Search
                </button>
              </div>
            )}
          </div>
        ) : activeTab === "home" ? (
          // VIEW 1: FULL HOME PAGE
          <div>
            {/* Hero */}
            <div className="relative w-full flex items-center justify-center z-20" style={{ minHeight: "85vh" }}>
              {/* Background image & gradient overlays — overflow clipped strictly here */}
              <div className="absolute inset-0 overflow-hidden">
                <img
                  src="https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1920&q=95"
                  alt="Lakeside hotel at evening"
                  className="absolute inset-0 w-full h-full object-cover object-center"
                />
                {/* Dark cinematic overlay */}
                <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/35 to-black/75" />
                {/* Bottom blend — fades hero into the dark-green ticker below */}
                <div className="absolute bottom-0 left-0 right-0 h-36 bg-gradient-to-t from-[#0c2614] to-transparent pointer-events-none" />
              </div>

              <div className="relative z-10 w-full max-w-4xl mx-auto px-6 text-center py-12 md:py-20">
                <p className="text-white/55 text-[10px] font-semibold tracking-[0.4em] uppercase mb-3">Private Collections 2026</p>
                <h1 className="text-4xl md:text-6xl lg:text-7xl font-serif italic font-light text-white leading-tight drop-shadow-xl mb-5 md:mb-7">
                  Extraordinary Stays,<br />Unforgettable Journeys
                </h1>

                {/* Category pills */}
                <div className="flex items-center justify-center gap-2 mb-3">
                  {([
                    { key: "hotel" as const, label: "Hotels", icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg> },
                    { key: "apartment" as const, label: "Home", icon: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg> },
                    { key: "car" as const, label: "Cars", icon: <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" /><circle cx="7" cy="17" r="2" /><path d="M9 17h6" /><circle cx="17" cy="17" r="2" /></svg> },
                  ] as const).map(({ key, label, icon }) => (
                    <button
                      key={key}
                      onClick={() => { setSearchCategory(key); }}
                      className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition border ${searchCategory === key
                        ? "bg-white text-[#0c2614] border-white shadow-md"
                        : "bg-white/15 text-white border-white/30 hover:bg-white/25 backdrop-blur-sm"
                        }`}
                    >
                      {icon}
                      {label}
                    </button>
                  ))}
                </div>

                {/* Unified flat search bar */}
                <form onSubmit={handleSearch}>
                  <div className="relative bg-white rounded-2xl shadow-2xl flex flex-col md:flex-row items-stretch overflow-visible">

                    {/* Destination */}
                    <div className="relative flex-[2] min-w-0">
                      <div className="flex items-center gap-2 px-5 py-4 md:border-r border-slate-200">
                        <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <div className="flex-1 min-w-0">
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Where to?</p>
                          <input
                            type="text"
                            required
                            placeholder="Destination"
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
                            className="w-full bg-transparent border-none outline-none text-sm font-semibold text-slate-800 placeholder-slate-400"
                          />
                        </div>
                      </div>
                      {/* Autocomplete dropdown */}
                      {showSuggestions && (nominatimResults.length > 0 || apiSuggestions.filter(s => s.toLowerCase().includes(searchDestination.toLowerCase())).length > 0) && (
                        <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200/80 rounded-2xl shadow-2xl z-50 overflow-hidden max-h-56 overflow-y-auto">
                          {nominatimResults.length > 0 ? nominatimResults.map((r, i) => (
                            <button key={i} type="button"
                              onMouseDown={() => { setSearchDestination(r.display_name.split(",").slice(0, 2).join(",").trim()); setShowSuggestions(false); setNominatimResults([]); }}
                              className="w-full px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-[#0c2614] hover:text-white transition-colors text-left flex items-center gap-2"
                            >
                              <svg className="w-3.5 h-3.5 shrink-0 opacity-60" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                              <span className="truncate">{r.display_name.split(",").slice(0, 3).join(", ")}</span>
                            </button>
                          )) : apiSuggestions.filter(s => s.toLowerCase().includes(searchDestination.toLowerCase())).map((s, i) => (
                            <button key={i} type="button" onMouseDown={() => { setSearchDestination(s); setShowSuggestions(false); }}
                              className="w-full px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-[#0c2614] hover:text-white transition-colors text-left flex items-center gap-2">
                              <svg className="w-3.5 h-3.5 shrink-0 opacity-60" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                              <span className="truncate">{s}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Date fields */}
                    <div className="relative flex items-center gap-2 px-5 py-4 md:border-r border-slate-200 flex-1 min-w-[220px]">
                      {searchCategory === "car" ? (
                        <DateRangePicker
                          label="Rental Dates"
                          isCar
                          startDate={searchPickupDate}
                          endDate={searchReturnDate}
                          onChange={(start, end) => {
                            setSearchPickupDate(start);
                            setSearchReturnDate(end);
                          }}
                          minDate={getTodayString()}
                          variant="searchBar"
                          className="w-full"
                        />
                      ) : (
                        <DateRangePicker
                          label="Check-in – Check-out"
                          startDate={searchCheckIn}
                          endDate={searchCheckOut}
                          onChange={(start, end) => {
                            setSearchCheckIn(start);
                            setSearchCheckOut(end);
                          }}
                          minDate={getTodayString()}
                          variant="searchBar"
                          className="w-full"
                        />
                      )}
                    </div>

                    {/* Guests */}
                    {searchCategory !== "car" && (
                      <div className="relative flex items-center gap-2 px-5 py-4 md:border-r border-slate-200 flex-1 min-w-0">
                        <svg className="w-4 h-4 text-slate-400 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <button type="button" onClick={() => setShowGuestPicker((v) => !v)} className="flex-1 min-w-0 text-left">
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Guests</p>
                          <p className="text-sm font-semibold text-slate-800 truncate">
                            {searchAdults} Adult{searchAdults !== 1 ? "s" : ""}{searchChildren > 0 ? `, ${searchChildren} Child${searchChildren !== 1 ? "ren" : ""}` : ""}
                          </p>
                        </button>
                        {showGuestPicker && (
                          <div className="absolute top-full left-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 w-72 p-4 space-y-1">
                            <div className="flex items-center justify-between py-3 border-b border-slate-100">
                              <div><p className="text-sm font-semibold text-slate-800">Adults</p><p className="text-[10px] text-slate-400">Age 13+</p></div>
                              <div className="flex items-center gap-3">
                                <button type="button" onClick={() => setSearchAdults((a) => Math.max(1, a - 1))} className="w-7 h-7 rounded-full border border-slate-300 flex items-center justify-center text-slate-600 hover:bg-slate-50 disabled:opacity-30 text-lg font-light" disabled={searchAdults <= 1}>−</button>
                                <span className="w-5 text-center text-sm font-bold text-slate-900">{searchAdults}</span>
                                <button type="button" onClick={() => setSearchAdults((a) => Math.min(16, a + 1))} className="w-7 h-7 rounded-full border border-slate-300 flex items-center justify-center text-slate-600 hover:bg-slate-50 text-lg font-light">+</button>
                              </div>
                            </div>
                            <div className="flex items-center justify-between py-3 border-b border-slate-100">
                              <div><p className="text-sm font-semibold text-slate-800">Children</p><p className="text-[10px] text-slate-400">Ages 2–12</p></div>
                              <div className="flex items-center gap-3">
                                <button type="button" onClick={() => setSearchChildren((c) => Math.max(0, c - 1))} className="w-7 h-7 rounded-full border border-slate-300 flex items-center justify-center text-slate-600 hover:bg-slate-50 disabled:opacity-30 text-lg font-light" disabled={searchChildren <= 0}>−</button>
                                <span className="w-5 text-center text-sm font-bold text-slate-900">{searchChildren}</span>
                                <button type="button" onClick={() => setSearchChildren((c) => Math.min(10, c + 1))} className="w-7 h-7 rounded-full border border-slate-300 flex items-center justify-center text-slate-600 hover:bg-slate-50 text-lg font-light">+</button>
                              </div>
                            </div>
                            <div className="flex items-center justify-between py-3">
                              <div><p className="text-sm font-semibold text-slate-800">Rooms</p><p className="text-[10px] text-slate-400">Number of rooms</p></div>
                              <div className="flex items-center gap-3">
                                <button type="button" onClick={() => setSearchRooms((r) => Math.max(1, r - 1))} className="w-7 h-7 rounded-full border border-slate-300 flex items-center justify-center text-slate-600 hover:bg-slate-50 disabled:opacity-30 text-lg font-light" disabled={searchRooms <= 1}>−</button>
                                <span className="w-5 text-center text-sm font-bold text-slate-900">{searchRooms}</span>
                                <button type="button" onClick={() => setSearchRooms((r) => Math.min(8, r + 1))} className="w-7 h-7 rounded-full border border-slate-300 flex items-center justify-center text-slate-600 hover:bg-slate-50 text-lg font-light">+</button>
                              </div>
                            </div>
                            <button type="button" onClick={() => setShowGuestPicker(false)} className="w-full py-2 bg-[#0c2614] text-white text-xs font-bold rounded-xl mt-2">Done</button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Explore Now button */}
                    <div className="p-2 flex items-center shrink-0">
                      <button
                        type="submit"
                        disabled={searching}
                        className="h-full w-full md:w-auto px-6 py-3 bg-[#0c2614] hover:bg-[#081b0d] disabled:opacity-60 text-white font-semibold rounded-xl transition flex items-center justify-center gap-2 text-sm whitespace-nowrap"
                      >
                        {searching ? (
                          <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Searching</>
                        ) : (
                          <><svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg> Explore Now</>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Trending chips */}
                  {/* <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs">
                    <span className="text-white/50 font-medium tracking-wide">Trending:</span>
                    {[["Cape Town", "South Africa"], ["Marrakesh", "Morocco"], ["Nairobi", "Kenya"], ["Lagos", "Nigeria"]].map(([city, country]) => (
                      <button key={city} type="button"
                        onClick={() => { const full = `${city}, ${country}`; setSearchDestination(full); handleSearch(undefined, searchCategory !== "car" ? "hotel" : "car", full); }}
                        className="px-3 py-1 rounded-full border border-white/25 text-white/70 hover:border-white hover:text-white hover:bg-white/10 transition font-medium backdrop-blur-sm">
                        {city}
                      </button>
                    ))}
                  </div> */}
                </form>
              </div>
            </div>

            {/* ── TICKER ── */}
            <div className="bg-[#0c2614] overflow-hidden py-2">
              <div className="flex items-center gap-16 animate-[marquee_25s_linear_infinite] whitespace-nowrap">
                {Array.from({ length: 8 }).map((_, i) => (
                  <span key={i} className="text-green-300/80 text-[10px] font-medium tracking-[0.25em] uppercase flex items-center gap-4">
                    <span className="text-[#58B430]">✦</span> Exclusive Member Rates · Private Collections 2026 · Complimentary Concierge
                  </span>
                ))}
              </div>
            </div>

            {/* ── CURATED WORLDS ── */}
            <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10">
                <div>
                  <p className="text-[10px] font-semibold text-[#1D8D2B] uppercase tracking-[0.3em] mb-2">Curated Worlds</p>
                  <h2 className="text-3xl md:text-4xl font-serif text-slate-900 leading-snug">
                    Discover Destinations Selected for the<br className="hidden sm:block" /> Discerning Traveler.
                  </h2>
                </div>
                {/* <button
                  onClick={() => handleSearch(undefined, "hotel")}
                  className="text-sm font-semibold text-[#0c2614] hover:text-[#1D8D2B] transition underline underline-offset-4 shrink-0"
                >
                  View All Destinations
                </button> */}
              </div>

              {/* Asymmetric grid: 1 large left + 2 stacked right */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Large left */}
                <button
                  type="button"
                  onClick={() => { setSearchDestination("Amalfi Coast, Italy"); handleSearch(undefined, "hotel", "Amalfi Coast, Italy"); }}
                  className="group relative rounded-2xl overflow-hidden cursor-pointer shadow-md hover:shadow-xl transition-all duration-300"
                  style={{ minHeight: "420px" }}
                >
                  <img
                    src="https://images.unsplash.com/photo-1533104816931-20fa691ff6ca?w=900&q=85"
                    alt="Amalfi Coast, Italy"
                    className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
                  <div className="absolute bottom-0 left-0 p-6 text-left">
                    <p className="text-white font-serif text-2xl font-light leading-snug">Amalfi Coast, Italy</p>
                    <p className="text-white/65 text-xs font-medium mt-1 tracking-wide">120+ Exclusive Properties</p>
                  </div>
                </button>

                {/* Right column — 2 stacked */}
                <div className="grid grid-rows-2 gap-4">
                  {[
                    { name: "Kyoto", country: "Japan", img: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=600&q=85", props: "80+" },
                    { name: "Santorini", country: "Greece", img: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600&q=85", props: "95+" },
                  ].map((dest) => (
                    <button
                      key={dest.name}
                      type="button"
                      onClick={() => { setSearchDestination(`${dest.name}, ${dest.country}`); handleSearch(undefined, "hotel", `${dest.name}, ${dest.country}`); }}
                      className="group relative rounded-2xl overflow-hidden cursor-pointer shadow-md hover:shadow-xl transition-all duration-300"
                      style={{ minHeight: "198px" }}
                    >
                      <img src={dest.img} alt={`${dest.name}, ${dest.country}`} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition duration-700" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
                      <div className="absolute bottom-0 left-0 p-5 text-left">
                        <p className="text-white font-serif text-xl font-light">{dest.name}, {dest.country}</p>
                        <p className="text-white/65 text-xs font-medium mt-0.5 tracking-wide">{dest.props} Exclusive Properties</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {/* ── STAY IN EXCELLENCE ── */}
            <section className="bg-[#f7f6f3] py-16 border-y border-slate-200/60">
              <div className="max-w-7xl mx-auto px-4 sm:px-6">
                <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10">
                  <div>
                    <p className="text-[10px] font-semibold text-[#1D8D2B] uppercase tracking-[0.3em] mb-2">Top Picks</p>
                    <h2 className="text-3xl md:text-4xl font-serif text-slate-900">Stay in Excellence</h2>
                  </div>
                  <div className="flex gap-2">
                    {([{ key: "hotel", label: "Hotels" }, { key: "apartment", label: "Home" }, { key: "car", label: "Cars" }] as const).map(({ key, label }) => (
                      <button
                        key={key}
                        onClick={() => loadFeaturedListings(key)}
                        className={`px-4 py-1.5 rounded-full text-xs font-semibold border transition ${featuredCategory === key
                          ? "bg-[#0c2614] text-white border-[#0c2614]"
                          : "bg-white text-slate-600 border-slate-200 hover:border-[#0c2614] hover:text-[#0c2614]"
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
                      <ListingCard
                        key={listing.id}
                        listing={listing}
                        onSelect={handleSelectListing}
                        variant="compact"
                        promotionBadge={promotionBadge}
                        activePromotion={activePromotion}
                        isFavourited={isFavourited(listing.id)}
                        onToggleFavourite={handleToggleFavourite}
                      />
                    ))}
                  </div>
                )}

                {!loadingFeatured && featuredListings.length > 0 && (
                  <div className="text-center mt-8">
                    <button
                      onClick={() => { setSearchCategory(featuredCategory); setActiveTab("search"); handleSearch(undefined, featuredCategory); }}
                      className="inline-flex items-center gap-2 px-6 py-3 border border-[#0c2614] text-[#0c2614] font-semibold text-sm rounded-full hover:bg-[#0c2614] hover:text-white transition"
                    >
                      View all {featuredCategory === "car" ? "cars" : featuredCategory + "s"}
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                    </button>
                  </div>
                )}
              </div>
            </section>

            {/* ── ELEVATE YOUR EVERY EXPERIENCE ── */}
            <section className="bg-[#0c2614] py-16 px-4 sm:px-6">
              <div className="max-w-7xl mx-auto">
                <div className="text-center mb-12">
                  <p className="text-[10px] font-semibold text-[#58B430] uppercase tracking-[0.35em] mb-3">Kainook Privilege</p>
                  <h2 className="text-3xl md:text-4xl font-serif font-light text-white leading-snug">Elevate Your Every Experience</h2>
                  <p className="text-green-300/70 text-sm mt-3 max-w-md mx-auto">
                    Join our membership programme to unlock exclusive rates, personal concierges, and first-class transfers.
                  </p>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
                  {[
                    {
                      tier: "Bronze",
                      label: "THE ENTRY",
                      level: "1 Stay",
                      perks: ["Access to member-only pricing", "Welcome amenities"],
                      border: "border-amber-700/30",
                      iconBg: "bg-amber-700/20",
                      popular: false,
                      icon: (
                        <svg className="w-6 h-6 text-amber-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                        </svg>
                      ),
                    },
                    {
                      tier: "Silver",
                      label: "ACHIEVEMENT",
                      level: "5 Stays",
                      perks: ["Early check-in, late check-out", "Luxury suite upgrades"],
                      border: "border-slate-400/25",
                      iconBg: "bg-slate-400/15",
                      popular: false,
                      icon: (
                        <svg className="w-6 h-6 text-slate-300" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                        </svg>
                      ),
                    },
                    {
                      tier: "Gold",
                      label: "ACHIEVEMENT",
                      level: "10 Stays",
                      perks: ["Personal travel designer", "Sustainable breakfast"],
                      border: "border-[#58B430]/50",
                      iconBg: "bg-[#58B430]/15",
                      popular: true,
                      icon: (
                        <svg className="w-6 h-6 text-[#58B430]" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 002.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 012.916.52 6.003 6.003 0 01-5.395 4.972m0 0a6.726 6.726 0 01-2.749 1.35m0 0a6.772 6.772 0 01-3.044 0" />
                        </svg>
                      ),
                    },
                    {
                      tier: "Diamond",
                      label: "REQUIREMENT",
                      level: "Invitation Only",
                      perks: ["24/7 dedicated butler", "Private jet transfers"],
                      border: "border-cyan-400/25",
                      iconBg: "bg-cyan-400/10",
                      popular: false,
                      icon: (
                        <svg className="w-6 h-6 text-cyan-300" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                        </svg>
                      ),
                    },
                  ].map((t) => (
                    <div
                      key={t.tier}
                      className={`bg-[#0a1f0d] ${t.border} border rounded-2xl pt-6 pb-8 px-4 text-center text-white flex flex-col items-center gap-4 relative`}
                    >
                      {t.popular && (
                        <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#58B430] text-white text-[9px] font-bold uppercase tracking-widest px-3 py-1 rounded-full whitespace-nowrap">
                          Most Popular
                        </span>
                      )}
                      <div className={`w-12 h-12 ${t.iconBg} rounded-2xl flex items-center justify-center`}>
                        {t.icon}
                      </div>
                      <div>
                        <p className="font-semibold text-base tracking-wide">{t.tier}</p>
                        <p className="text-green-300/50 text-[10px] font-medium mt-0.5 tracking-widest uppercase">{t.perks[0]}</p>
                      </div>
                      <div className="border-t border-white/10 w-full pt-3 space-y-1">
                        <p className="text-[9px] font-bold text-green-400/60 uppercase tracking-widest">{t.label}</p>
                        <p className="text-white font-semibold text-sm">{t.level}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="text-center">
                  <button
                    onClick={() => { if (!user) { window.location.href = "/auth/login"; } }}
                    className="bg-white hover:bg-green-50 text-[#0c2614] font-semibold px-8 py-3 rounded-full text-sm transition shadow-lg"
                  >
                    Join Kainook Privilege
                  </button>
                </div>
              </div>
            </section>

            {/* ── RECENTLY VIEWED ── */}
            {recentlyViewed.length > 0 && (
              <section className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
                <h2 className="text-2xl font-bold text-slate-900 mb-6">Recently Viewed</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {recentlyViewed.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleSelectListing(item.id)}
                      className="group flex items-center gap-3 bg-white border border-slate-100 rounded-2xl p-3 hover:shadow-md hover:border-slate-200 transition text-left w-full"
                    >
                      <div className="w-16 h-16 bg-slate-100 rounded-xl overflow-hidden shrink-0">
                        <ListingImage listingId={item.id} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-[#1D8D2B] uppercase tracking-wider">{item.category}</p>
                        <p className="text-sm font-bold text-slate-900 line-clamp-1 group-hover:text-[#1D8D2B] transition">{item.name}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{item.currency} {item.pricePerNight.toLocaleString()} / {item.category === "car" ? "day" : "night"}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* ── BENEFITS ── */}
            <section className="bg-white py-16 border-t border-slate-100">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center">
                <p className="text-[10px] font-semibold text-[#1D8D2B] uppercase tracking-[0.3em] mb-2">Why Kainook</p>
                <h2 className="text-3xl md:text-4xl font-serif text-slate-900 mb-12">Crafted for the Discerning Traveler</h2>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-10">
                  {[
                    { icon: "⚡", title: "Instant Booking", desc: "Confirmed in seconds, no approval delays." },
                    { icon: "🛡️", title: "Secure Payments", desc: "Bank-grade encryption on every transaction." },
                    { icon: "🌍", title: "Global Portfolio", desc: "10,000+ curated properties across 40 countries." },
                    { icon: "🎧", title: "24/7 Concierge", desc: "Personal support at every step of your journey." },
                  ].map((item) => (
                    <div key={item.title} className="flex flex-col items-center gap-3 text-center">
                      <div className="w-14 h-14 bg-[#0c2614]/8 rounded-2xl flex items-center justify-center text-2xl border border-[#0c2614]/10">{item.icon}</div>
                      <p className="text-slate-900 font-semibold text-sm">{item.title}</p>
                      <p className="text-slate-400 text-xs leading-relaxed">{item.desc}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* ── TESTIMONIALS ── */}
            <section className="bg-[#f7f6f3] py-16 border-t border-slate-100">
              <div className="max-w-7xl mx-auto px-4 sm:px-6">
                <p className="text-[10px] font-semibold text-[#1D8D2B] uppercase tracking-[0.3em] mb-2">Guest Voices</p>
                <h2 className="text-3xl md:text-4xl font-serif text-slate-900 mb-10">What Our Guests Say</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {[
                    { rating: 5, text: "The curation of hotels on Kainook is unmatched. I found a boutique hotel in Morocco that I couldn't find anywhere else. Flawless experience!", name: "Amara Nwosu", location: "Lagos, Nigeria", initials: "AN" },
                    { rating: 5, text: "Easy, fast, and secure. The VIP rewards program actually delivers real value from the first booking. Highly recommended.", name: "Kofi Danku", location: "Accra, Ghana", initials: "KD" },
                    { rating: 5, text: "Travelling across Africa has never been this organised. The car rental feature integrated with my hotel booking saved me so much time.", name: "Sarah Louw", location: "Cape Town, SA", initials: "SL" },
                  ].map((t) => (
                    <div key={t.name} className="bg-white rounded-2xl p-6 space-y-4 border border-slate-100 shadow-sm">
                      <div className="flex gap-0.5">{[1, 2, 3, 4, 5].map(s => <span key={s} className="text-amber-400 text-base">★</span>)}</div>
                      <p className="text-slate-600 text-sm leading-relaxed font-light">&ldquo;{t.text}&rdquo;</p>
                      <div className="flex items-center gap-3 pt-1 border-t border-slate-100">
                        <div className="w-9 h-9 rounded-full bg-[#0c2614] text-white flex items-center justify-center text-[10px] font-bold shrink-0">{t.initials}</div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{t.name}</p>
                          <p className="text-[10px] text-slate-400 tracking-wide">{t.location}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* ── FOOTER ── */}
            <footer className="bg-[#0c2614] text-green-300/70 py-14">
              <div className="max-w-7xl mx-auto px-4 sm:px-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
                  {/* Brand */}
                  <div className="col-span-2 md:col-span-1">
                    <p className="text-white font-serif text-xl font-light mb-1">Kainook</p>
                    <p className="text-[10px] text-[#58B430]/70 uppercase tracking-[0.2em] mb-3">Private Collections</p>
                    <p className="text-xs leading-relaxed mb-5">Redefining the standards of luxury travel through curated storytelling and architectural excellence.</p>
                    <div className="flex gap-3">
                      {[
                        { label: "Twitter/X", path: "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" },
                        { label: "Instagram", path: "M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" },
                        { label: "LinkedIn", path: "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" },
                      ].map(({ label, path }) => (
                        <a key={label} href="#" aria-label={label} className="text-green-300 hover:text-white transition">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d={path} /></svg>
                        </a>
                      ))}
                    </div>
                  </div>
                  {/* Explore */}
                  <div>
                    <p className="text-white text-[10px] font-semibold uppercase tracking-[0.25em] mb-4">Explore</p>
                    <ul className="space-y-2.5 text-xs">
                      {["Destinations", "Hotels", "Villas", "Car Rentals", "Experiences"].map(l => <li key={l}><a href="#" className="hover:text-white transition-colors">{l}</a></li>)}
                    </ul>
                  </div>
                  {/* Legal */}
                  <div>
                    <p className="text-white text-[10px] font-semibold uppercase tracking-[0.25em] mb-4">Kainook</p>
                    <ul className="space-y-2.5 text-xs">
                      {["Our Story", "Sustainability", "Rewards Program", "Press & Media", "Contact Us"].map(l => <li key={l}><a href="#" className="hover:text-white transition-colors">{l}</a></li>)}
                    </ul>
                  </div>
                  {/* Newsletter */}
                  <div>
                    <p className="text-white text-[10px] font-semibold uppercase tracking-[0.25em] mb-4">Newsletter</p>
                    <p className="text-xs mb-4 leading-relaxed">Receive curated travel inspiration and exclusive member offers.</p>
                    <div className="space-y-2">
                      <input type="email" placeholder="Your email address" className="w-full bg-[#081b0d]/60 border border-[#081b0d] rounded-lg px-3 py-2 text-xs text-white placeholder-green-600 focus:outline-none focus:border-white/40" />
                      <button className="w-full bg-white hover:bg-green-50 text-[#0c2614] text-xs font-semibold py-2 rounded-lg transition">Subscribe</button>
                    </div>
                  </div>
                </div>
                <div className="border-t border-[#081b0d]/60 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <p className="text-[10px] tracking-wide">© {new Date().getFullYear()} Kainook · All rights reserved.</p>
                  <div className="flex items-center gap-4">
                    {[
                      { label: "Twitter/X", path: "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" },
                      { label: "Instagram", path: "M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" },
                      { label: "LinkedIn", path: "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" },
                    ].map(({ label, path }) => (
                      <a key={label} href="#" aria-label={label} className="text-green-300 hover:text-white transition">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d={path} /></svg>
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </footer>
          </div>
        ) : activeTab === "search" ? (
          // VIEW 2: REDESIGNED SEARCH RESULTS — sidebar + cards feed
          <div className="flex min-h-[calc(100vh-76px)]">

            {/* ── LEFT SIDEBAR — Refine Search ── */}
            <aside className="hidden lg:flex flex-col w-72 xl:w-80 shrink-0 bg-white border-r border-slate-200 overflow-y-auto">
              <div className="p-6 space-y-6">
                {/* Header */}
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
                    </svg>
                    <h2 className="text-base font-bold text-slate-900">Refine Search</h2>
                  </div>
                  <p className="text-[11px] text-slate-400 pl-6">Luxury Preferences</p>
                </div>

                {/* Price Range slider */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-700">Price Range</label>
                    <span className="text-xs font-semibold text-slate-500">
                      {priceMin > 0 ? `KES ${priceMin.toLocaleString()}` : "KES 500"} – {priceMax >= 499999 ? "KES 5,000+" : `KES ${priceMax.toLocaleString()}`}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={50000}
                    step={500}
                    value={priceMax >= 499999 ? 50000 : priceMax}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setPriceMax(v >= 50000 ? 500000 : v);
                    }}
                    className="w-full h-1.5 accent-[#1D8D2B] cursor-pointer"
                  />
                </div>

                {/* Bedrooms & Bathrooms */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Bedrooms</label>
                    <select
                      value={filterBedrooms ?? ""}
                      onChange={(e) => setFilterBedrooms(e.target.value ? Number(e.target.value) : null)}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 bg-white focus:outline-none focus:border-[#1D8D2B] transition"
                    >
                      <option value="">Any</option>
                      <option value="1">1</option>
                      <option value="2">2</option>
                      <option value="3">3+</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Bathrooms</label>
                    <select
                      value={filterBathrooms ?? ""}
                      onChange={(e) => setFilterBathrooms(e.target.value ? Number(e.target.value) : null)}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 bg-white focus:outline-none focus:border-[#1D8D2B] transition"
                    >
                      <option value="">Any</option>
                      <option value="1">1</option>
                      <option value="2">2</option>
                      <option value="3">3+</option>
                    </select>
                  </div>
                </div>

                {/* Property Type (hotels/apartments) */}
                {searchCategory !== "car" && (
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-slate-700">Property Type</label>
                    <div className="space-y-2 pt-0.5">
                      {(searchCategory === "hotel"
                        ? ["Standard", "Boutique", "Resort"]
                        : ["Studio", "Penthouse", "Villa"]
                      ).map((type) => {
                        const active = filterPropertyTypes.includes(type);
                        return (
                          <label key={type} className="flex items-center gap-3 cursor-pointer group py-0.5">
                            <button
                              type="button"
                              onClick={() => setFilterPropertyTypes((prev) =>
                                active ? prev.filter((t) => t !== type) : [...prev, type]
                              )}
                              className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition ${active ? "bg-[#0c2614] border-[#0c2614]" : "border-slate-300 group-hover:border-[#1D8D2B]"
                                }`}
                            >
                              {active && (
                                <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </button>
                            <span className="text-sm text-slate-700">{type}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Amenities chips */}
                {searchCategory !== "car" && (
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-slate-700">Amenities</label>
                    <div className="flex flex-wrap gap-2 pt-0.5">
                      {[
                        { key: "wifi", label: "Wi-Fi" },
                        { key: "pool", label: "Pool" },
                        { key: "ac", label: "Air Conditioning" },
                        { key: "kitchen", label: "Kitchen" },
                        { key: "gym", label: "Gym" },
                        { key: "parking", label: "Parking" },
                        { key: "spa", label: "Spa" },
                        { key: "breakfast", label: "Breakfast" },
                      ].map(({ key, label }) => {
                        const active = selectedAmenities.includes(key);
                        return (
                          <button
                            key={key}
                            onClick={() => setSelectedAmenities((prev) =>
                              active ? prev.filter((a) => a !== key) : [...prev, key]
                            )}
                            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${active
                              ? "bg-[#0c2614] text-white border-[#0c2614]"
                              : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
                              }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Car transmission */}
                {searchCategory === "car" && (
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-slate-700">Transmission</label>
                    <div className="flex gap-2 pt-0.5">
                      {["automatic", "manual"].map((t) => {
                        const active = selectedAmenities.includes(t);
                        return (
                          <button
                            key={t}
                            onClick={() => setSelectedAmenities((prev) =>
                              active ? prev.filter((a) => a !== t) : [...prev, t]
                            )}
                            className={`flex-1 py-2 border rounded-xl text-xs font-semibold capitalize transition ${active ? "bg-[#0c2614] text-white border-[#0c2614]" : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
                              }`}
                          >
                            {t}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Min Rating */}
                {searchCategory !== "car" && (
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-slate-700">Min. Rating</label>
                    <div className="flex gap-2 pt-0.5">
                      {[3, 4, 5].map((star) => (
                        <button
                          key={star}
                          onClick={() => setSelectedRating(star === selectedRating ? null : star)}
                          className={`flex-1 py-2 border rounded-xl text-xs font-semibold transition ${star === selectedRating ? "bg-[#0c2614] text-white border-[#0c2614]" : "bg-white text-slate-600 border-slate-200 hover:border-slate-400"
                            }`}
                        >
                          ★ {star}+
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Instant Book */}
                <div className="flex items-center justify-between py-1">
                  <div>
                    <p className="text-xs font-semibold text-slate-700">⚡ Instant Book</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">No approval needed</p>
                  </div>
                  <button
                    onClick={() => setShowInstantOnly((v) => !v)}
                    className={`relative w-10 h-5 rounded-full transition-colors ${showInstantOnly ? "bg-[#0c2614]" : "bg-slate-200"}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${showInstantOnly ? "translate-x-5" : ""}`} />
                  </button>
                </div>

                {/* Apply Filters button */}
                <button
                  onClick={() => handleSearch()}
                  className="w-full py-3 bg-[#0c2614] text-white text-sm font-semibold rounded-xl hover:bg-[#1D8D2B] transition shadow-sm"
                >
                  Apply Filters
                </button>

                {/* Reset */}
                <button
                  onClick={() => {
                    setPriceMin(0); setPriceMax(500000); setSelectedRating(null);
                    setSelectedCancellation(""); setSortBy("distance_asc");
                    setSelectedAmenities([]); setShowInstantOnly(false);
                    setFilterBedrooms(null); setFilterBathrooms(null); setFilterPropertyTypes([]);
                  }}
                  className="w-full text-xs font-bold text-slate-400 hover:text-slate-700 transition"
                >
                  Reset all filters
                </button>
              </div>
            </aside>

            {/* ── RIGHT CONTENT AREA ── */}
            <div className="flex-1 overflow-y-auto min-w-0">

              {/* Mobile filter + sort bar */}
              <div className="lg:hidden flex items-center gap-2 px-4 pt-4">
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

              {/* Results header */}
              <div className="px-6 lg:px-8 pt-6 pb-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h1 className="text-2xl font-bold text-slate-900">
                      {searching
                        ? "Searching..."
                        : searchDestination.trim()
                          ? `${totalCount > 0 ? totalCount : displayedListings.length} result${(totalCount > 0 ? totalCount : displayedListings.length) !== 1 ? "s" : ""} for "${searchDestination.trim()}"`
                          : `Found ${totalCount > 0 ? totalCount : displayedListings.length} Properties`}
                    </h1>
                    <p className="text-sm text-slate-500 mt-0.5">
                      {searchDestination.trim()
                        ? `${searchCategory === "car" ? "Car rentals" : searchCategory === "hotel" ? "Hotels" : "Homes"} matching your search`
                        : `Browse ${searchCategory === "car" ? "car rentals" : searchCategory + "s"} worldwide`}
                    </p>
                  </div>
                  <div className="hidden lg:flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Sort By</span>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-semibold text-slate-700 focus:outline-none shadow-sm"
                    >
                      <option value="distance_asc">Nearest First</option>
                      <option value="price_asc">Price: Low to High</option>
                      <option value="price_desc">Price: High to Low</option>
                      <option value="rating_desc">Best Rated</option>
                      <option value="popularity_desc">Popular</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Listings content */}
              <div className="px-6 lg:px-8 pb-10">
                {searching ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((n) => (
                      <div key={n} className="animate-pulse bg-white border border-slate-100 rounded-2xl overflow-hidden flex shadow-sm" style={{ minHeight: 190 }}>
                        <div className="w-[42%] bg-slate-200 shrink-0" />
                        <div className="flex-1 p-5 space-y-3">
                          <div className="h-2.5 bg-slate-200 rounded w-1/4" />
                          <div className="h-5 bg-slate-200 rounded w-3/4" />
                          <div className="h-3 bg-slate-200 rounded w-1/2" />
                          <div className="flex gap-4 mt-1">
                            <div className="h-3 bg-slate-200 rounded w-16" />
                            <div className="h-3 bg-slate-200 rounded w-16" />
                            <div className="h-3 bg-slate-200 rounded w-16" />
                          </div>
                          <div className="flex justify-between items-end pt-4 border-t border-slate-100 mt-4">
                            <div className="h-7 bg-slate-200 rounded w-28" />
                            <div className="h-9 bg-slate-200 rounded w-32" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : displayedListings.length === 0 ? (
                  <div className="py-20 flex flex-col items-center gap-4 bg-white border border-slate-200 rounded-3xl px-6 text-center shadow-sm">
                    <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-3xl">🔍</div>
                    {searchError && (
                      <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-2 text-xs text-red-600 font-semibold max-w-xs">
                        {searchError}
                      </div>
                    )}
                    <div>
                      <p className="text-slate-800 font-bold text-lg">
                        {searchDestination.trim()
                          ? `No results found for "${searchDestination.trim()}"`
                          : `No ${searchCategory}s found`}
                      </p>
                      <p className="text-slate-400 text-sm mt-1 max-w-sm">
                        {searchDestination.trim()
                          ? "No listings match your search. Try a different location, property name, or search term."
                          : "Try adjusting your filters or searching a broader location."}
                      </p>
                    </div>
                    <button
                      onClick={() => { setActiveTab("home"); setSelectedListingId(null); }}
                      className="mt-2 px-6 py-2.5 bg-[#0c2614] text-white text-xs font-bold rounded-xl uppercase tracking-wider hover:bg-[#081b0d] transition"
                    >
                      Try a Different Search
                    </button>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {/* First featured card */}
                    {displayedListings[0] && (
                      <ListingCard
                        listing={displayedListings[0]}
                        onSelect={handleSelectListing}
                        hoveredId={mapHoveredId}
                        onHover={setMapHoveredId}
                        variant="featured"
                        promotionBadge={promotionBadge}
                        activePromotion={activePromotion}
                        isFavourited={isFavourited(displayedListings[0].id)}
                        onToggleFavourite={handleToggleFavourite}
                      />
                    )}

                    {/* Activity promotion banner — non-dismissable, driven by backend (PRD §6.4) */}
                    {activePromotion && activePromotion.activity === searchCategory && isPromotionValid(activePromotion) && (
                      <ActivityPromoBanner
                        activePromotion={activePromotion}
                      />
                    )}

                    {/* Personal voucher banner — dismissable, shown only to authenticated users with wallet vouchers (PRD §6.2) */}
                    {hasAuthToken && walletVouchers.length > 0 && (
                      <PersonalVoucherBanner
                        vouchers={walletVouchers.map((v) => ({
                          id: v.id,
                          code: v.code,
                          description: v.description,
                          discountAmount: v.discountValue,
                          validUntil: v.validUntil,
                        }))}
                        voucherApplied={voucherApplied}
                        voucherDiscount={voucherDiscount}
                        currency={detailListing?.currency ?? "KES"}
                        dismissed={voucherBannerDismissed}
                        pendingCode={pendingVoucherCode}
                        onDismiss={() => setVoucherBannerDismissed(true)}
                        onApply={(code) => {
                          setPendingVoucherCode(code);
                          setVoucherCode(code);
                        }}
                      />
                    )}

                    {/* Cards 2 and 3 as featured */}
                    {displayedListings[1] && (
                      <ListingCard
                        listing={displayedListings[1]}
                        onSelect={handleSelectListing}
                        hoveredId={mapHoveredId}
                        onHover={setMapHoveredId}
                        variant="featured"
                        promotionBadge={promotionBadge}
                        activePromotion={activePromotion}
                        isFavourited={isFavourited(displayedListings[1].id)}
                        onToggleFavourite={handleToggleFavourite}
                      />
                    )}
                    {displayedListings[2] && (
                      <ListingCard
                        listing={displayedListings[2]}
                        onSelect={handleSelectListing}
                        hoveredId={mapHoveredId}
                        onHover={setMapHoveredId}
                        variant="featured"
                        promotionBadge={promotionBadge}
                        activePromotion={activePromotion}
                        isFavourited={isFavourited(displayedListings[2].id)}
                        onToggleFavourite={handleToggleFavourite}
                      />
                    )}

                    {/* Remaining cards in 2-column compact grid */}
                    {displayedListings.length > 3 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        {displayedListings.slice(3).map((l) => (
                          <ListingCard
                            key={l.id}
                            listing={l}
                            onSelect={handleSelectListing}
                            hoveredId={mapHoveredId}
                            onHover={setMapHoveredId}
                            variant="compact"
                            promotionBadge={promotionBadge}
                            activePromotion={activePromotion}
                            isFavourited={isFavourited(l.id)}
                            onToggleFavourite={handleToggleFavourite}
                          />
                        ))}
                      </div>
                    )}

                    {/* Load More */}
                    {listings.length < totalCount && (
                      <button
                        onClick={loadMoreListings}
                        disabled={loadingMore}
                        className="w-full py-3 border-2 border-[#1D8D2B] text-[#1D8D2B] text-sm font-bold rounded-2xl hover:bg-[#0c2614] hover:text-white transition disabled:opacity-50"
                      >
                        {loadingMore ? "Loading..." : `Load More (${totalCount - listings.length} remaining)`}
                      </button>
                    )}
                  </div>
                )}
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
                className="self-start sm:self-auto flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-[#1D8D2B] hover:border-[#1D8D2B] transition shadow-sm disabled:opacity-50 uppercase tracking-wide"
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
                        ? "bg-[#0c2614] text-white border-[#1D8D2B]"
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
                    className="mt-6 inline-flex items-center gap-2 bg-[#0c2614] text-white text-sm font-semibold px-6 py-3 rounded-xl hover:bg-[#081b0d] transition shadow-md"
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
              <span className="text-lg font-bold text-[#1D8D2B] font-serif">Menu</span>
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
              <TravellerWorkspaceNav orientation="stack" showHome={false} showAvatar={false} className="mb-3" />
              <button
                onClick={() => { setSelectedListingId(null); setMobileNavOpen(false); router.push("/traveller"); }}
                className={`px-4 py-3 text-sm font-semibold rounded-xl text-left transition ${activeTab === "home" ? "bg-[#0c2614] text-white" : "text-slate-700 hover:bg-slate-50"}`}
              >
                Destinations
              </button>
              {(["hotel", "apartment", "car"] as const).map((cat) => (
                <button
                  key={cat}
                  onClick={() => {
                    setSelectedListingId(null);
                    setMobileNavOpen(false);
                    router.push(cat === "hotel" ? "/traveller/hotels" : cat === "apartment" ? "/traveller/apartments" : "/traveller/cars");
                  }}
                  className={`px-4 py-3 text-sm font-semibold rounded-xl text-left transition ${activeTab === "search" && searchCategory === cat ? "bg-[#0c2614] text-white" : "text-slate-700 hover:bg-slate-50"}`}
                >
                  {cat === "hotel" ? "Stays" : cat === "apartment" ? "Home" : "Car Rentals"}
                </button>
              ))}
              {user && (
                <button
                  onClick={() => { setSelectedListingId(null); setMobileNavOpen(false); router.push("/traveller?tab=bookings"); }}
                  className={`px-4 py-3 text-sm font-semibold rounded-xl text-left transition ${activeTab === "bookings" ? "bg-[#0c2614] text-white" : "text-slate-700 hover:bg-slate-50"}`}
                >
                  My Reservations
                </button>
              )}
            </nav>
            {user && (
              <div className="p-4 border-t border-slate-100 space-y-3 shrink-0">
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl">
                  <div className="w-10 h-10 rounded-full bg-[#0c2614] text-white flex items-center justify-center font-bold uppercase text-sm shrink-0">
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
                  className={`relative w-11 h-6 rounded-full transition-colors ${showInstantOnly ? "bg-[#0c2614]" : "bg-slate-200"}`}
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
                  <input type="number" value={priceMin || ""} onChange={(e) => setPriceMin(e.target.value ? Number(e.target.value) : 0)} placeholder="Min" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#1D8D2B]" />
                  <input type="number" value={priceMax >= 499999 ? "" : priceMax} onChange={(e) => setPriceMax(e.target.value ? Number(e.target.value) : 500000)} placeholder="Max" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-[#1D8D2B]" />
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
                        className={`flex-1 py-2.5 border rounded-xl text-sm font-semibold transition ${star === selectedRating ? "bg-[#0c2614] text-white border-[#1D8D2B]" : "bg-white text-slate-600 border-slate-200"}`}
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
                    {[
                      { key: "wifi", label: "Wi-Fi" },
                      { key: "smart_tv", label: "Smart TV" },
                      { key: "work_desk", label: "Work Desk" },
                      { key: "workspace", label: "Workspace" },
                      { key: "breakfast", label: "Breakfast" },
                      { key: "restaurant_on_site", label: "Restaurant" },
                      { key: "coffee_machine", label: "Coffee Machine" },
                      { key: "minibar", label: "Minibar" },
                      { key: "kitchen", label: "Kitchen" },
                      { key: "pool", label: "Pool" },
                      { key: "gym", label: "Gym" },
                      { key: "spa", label: "Spa" },
                      { key: "sauna", label: "Sauna" },
                      { key: "hot_tub", label: "Hot Tub" },
                      { key: "fitness_centre", label: "Fitness Centre" },
                      { key: "ac", label: "Air Conditioning" },
                      { key: "heating", label: "Heating" },
                      { key: "laundry", label: "Laundry" },
                      { key: "parking", label: "Parking" },
                      { key: "elevator", label: "Elevator" },
                      { key: "accessible", label: "Wheelchair Accessible" },
                      { key: "reception_24h", label: "24/7 Reception" },
                      { key: "housekeeping_daily", label: "Daily Housekeeping" },
                      { key: "airport_shuttle", label: "Airport Shuttle" },
                      { key: "security_24h", label: "24/7 Security" },
                      { key: "shop_on_site", label: "Shop On-Site" },
                      { key: "pet_friendly", label: "Pet Friendly" },
                      { key: "tv", label: "TV" },
                      { key: "fireplace", label: "Fireplace" },
                      { key: "balcony", label: "Balcony" },
                    ].map(({ key, label }) => {
                      const active = selectedAmenities.includes(key);
                      return (
                        <button
                          key={key}
                          onClick={() => setSelectedAmenities((prev) => active ? prev.filter((a) => a !== key) : [...prev, key])}
                          className={`py-2.5 border rounded-xl text-xs font-semibold transition ${active ? "bg-[#0c2614] text-white border-[#1D8D2B]" : "bg-white text-slate-600 border-slate-200"}`}
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
                        <button key={t} onClick={() => setSelectedAmenities((prev) => active ? prev.filter((a) => a !== t) : [...prev, t])} className={`flex-1 py-2.5 border rounded-xl text-sm font-semibold capitalize transition ${active ? "bg-[#0c2614] text-white border-[#1D8D2B]" : "bg-white text-slate-600 border-slate-200"}`}>
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
                className="w-full py-3.5 bg-[#0c2614] text-white font-bold rounded-xl text-sm hover:bg-[#081b0d] transition"
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
              <h3 className="text-2xl font-serif font-bold text-[#1D8D2B]">Reservation Confirmed!</h3>
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider pt-1">
                Your premium experience has been secured.
              </p>
            </div>

            <div className="bg-[#F8FAFC] border border-slate-200/50 p-4 rounded-2xl text-left space-y-2 text-xs shadow-inner">
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-400 font-semibold uppercase tracking-wider">Reference Code</span>
                <span className="text-[#1D8D2B] font-bold font-mono text-sm">{bookingSuccessModal.reference}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-2">
                <span className="text-slate-400 font-semibold uppercase tracking-wider">Paid Amount</span>
                <span className="text-[#1D8D2B] font-bold">{bookingSuccessModal.currency} {bookingSuccessModal.amount?.toLocaleString()}</span>
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
                // Re-fetch 6s later in case webhook hasn't confirmed the booking yet
                setTimeout(() => fetchGuestBookings(), 6000);
              }}
              className="w-full py-4 bg-[#0c2614] hover:bg-[#081b0d] text-white font-bold rounded-2xl transition shadow-lg shadow-blue-950/20 text-xs tracking-wider uppercase"
            >
              Go to My Reservations
            </button>
          </div>
        </div>
      )}

      {/* Kainook Platinum Rewards interactive modal overlay */}
      {showRewardsModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4 transition-all duration-300">
          <div className="bg-gradient-to-br from-[#166534] via-[#0E1E38] to-[#040D1D] border border-white/10 rounded-3xl max-w-md w-full p-8 shadow-2xl space-y-6 text-center animate-scale-in relative overflow-hidden">
            <div className="absolute right-4 bottom-4 text-9xl text-white/5 font-bold uppercase select-none pointer-events-none font-serif">ZIKA</div>
            <div className="absolute -top-12 -left-12 w-32 h-32 bg-green-500/10 rounded-full blur-2xl pointer-events-none"></div>

            <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-amber-400 via-yellow-200 to-slate-100 text-[#1D8D2B] flex items-center justify-center text-3xl mx-auto shadow-xl shadow-yellow-500/10 font-bold border border-white/20">
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
              className="w-full py-3.5 bg-white text-[#1D8D2B] hover:bg-slate-100 font-bold rounded-2xl transition shadow-lg shadow-white/5 text-xs tracking-wider uppercase relative z-10 hover:scale-[1.01] active:scale-[0.99]"
            >
              Start Earning Perks
            </button>
          </div>
        </div>
      )}


      {/* footer lives inside the home tab only — no global footer here */}

      {/* ── Auth required modal — shown when guest clicks heart without login ── */}
      {showFavAuthPrompt && (
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
                onClick={() => setShowFavAuthPrompt(false)}
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


