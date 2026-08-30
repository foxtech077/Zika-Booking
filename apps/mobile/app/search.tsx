import { useState, useCallback, useEffect, useMemo, memo, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  TextInput,
  Modal,
  Alert,
  Dimensions,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";

// Safely load MapView and Marker to prevent crashes in environments without the native module
let MapView: any = null;
let Marker: any = null;
try {
  const Maps = require("react-native-maps");
  MapView = Maps.default || Maps;
  Marker = Maps.Marker;
} catch (e) {
  // console.warn("react-native-maps native module not available:", e);
}

import { listingApi } from "../lib/listing-api";
import { useAuthStore } from "../store/auth";
import { ListingImage } from "../components/ListingImage";
import { ActivePromotion, applyPromotion } from "../lib/promotions";
import { useLocationStore } from "../store/location";
import { useRefreshOnFocus } from "../hooks/useRefreshOnFocus";
import { CurrencyPickerModal } from "../components/CurrencyPickerModal";
import { approxPrefix } from "../lib/currency";
import { useResponsive, padToColumns } from "../lib/responsive";
import { PlaceAutocomplete } from "../components/maps/PlaceAutocomplete";
import type { ResolvedPlace } from "../lib/google-maps";

/**
 * The search API returns `COALESCE(ST_Distance(...), 999999)`, so a listing with
 * no stored geography arrives as 999999 rather than null. Rendering that
 * verbatim produced "999999.0 km" on the card.
 */
function hasKnownDistance(km: number | null | undefined): km is number {
  return km != null && km < 999999;
}

// Deterministic coordinates calculator from search center + distance
function getListingCoordinates(
  item: SearchResult,
  centerLat: number,
  centerLng: number,
) {
  if ((item as any).lat != null && (item as any).lng != null) {
    return {
      latitude: Number((item as any).lat),
      longitude: Number((item as any).lng),
    };
  }

  const distance = hasKnownDistance(item.distanceKm) ? item.distanceKm : 0.1;
  let hash = 0;
  const idStr = item.id || "";
  for (let i = 0; i < idStr.length; i++) {
    hash = idStr.charCodeAt(i) + ((hash << 5) - hash);
  }
  const angle = Math.abs(hash % 360) * (Math.PI / 180);

  // 1 degree latitude = 111.32 km
  const latOffset = (distance / 111.32) * Math.cos(angle);
  const radLat = (centerLat * Math.PI) / 180;
  const lngOffset =
    (distance / (111.32 * Math.cos(radLat) || 1)) * Math.sin(angle);

  return {
    latitude: centerLat + latOffset,
    longitude: centerLng + lngOffset,
  };
}

import DateRangePickerModal, { calcNights, fmtDisplay } from "../components/ui/DateRangePickerModal";

// ─── Constants & Types ────────────────────────────────────────────────────────────────

const PRIMARY = "#1B5E20";
const DANGER = "#dc2626";
const SUCCESS = "#16a34a";
const TEXT = "#111827";
const MUTED = "#6b7280";
const BORDER = "#e5e7eb";
const BG = "#f9fafb";

// ─── Types ────────────────────────────────────────────────────────────────────

type SortOption =
  | "recommended"
  | "price_asc"
  | "price_desc"
  | "distance"
  | "newest"
  | "user_ratings_desc";

interface GeoResult {
  lat: number;
  lng: number;
  town: string;
  country: string;
}

interface PromoBadge {
  labelText: string;
  labelColour?: string;
}

interface RoomTypeSummary {
  id: string;
  name: string;
  roomType: string;
  pricePerNight: number | string;
  unitCount?: number | null;
  maxGuests?: number | null;
}

interface SearchResult {
  id: string;
  listingType: string;
  title: string;
  city: string;
  countryCode: string;
  distanceKm: number;
  lat?: number | null;
  lng?: number | null;
  primaryPhotoUrl: string | null;
  nightlyRate: number | null;
  dailyRate: number | null;
  currency: string;
  // Prices converted to the guest's local currency by the API. Absent when no
  // currency was requested or no rate exists, so always fall back to the base.
  localizedNightlyRate?: number | null;
  localizedDailyRate?: number | null;
  localizedCurrency?: string | null;
  cancellationPolicy: string;
  minStayNights: number | null;
  starRating: number | null;
  isAccredited: boolean;
  roomType: string | null;
  roomTypes?: RoomTypeSummary[] | null;
  bedrooms: number | null;
  bathrooms: number | null;
  maxGuests: number | null;
  carMake: string | null;
  carModel: string | null;
  carYear: number | null;
  transmission: string | null;
  seats: number | null;
  isFavourited: boolean;
  longStayDiscountEnabled?: boolean;
  promoBadge?: PromoBadge | null;
}

interface SearchResponse {
  data: {
    totalCount: number;
    nextCursor: string | null;
    results: SearchResult[];
    /** How far the backend actually reached (Airbnb-style adaptive area). */
    searchArea?: { effectiveRadiusKm: number | null; expanded: boolean };
  };
}

interface Promotion {
  id: string;
  title: string;
  description?: string;
  discountPercent?: number | null;
  discountAmount?: number | null;
  activity?: string | null;
  expiresAt?: string | null;
  ctaRoute?: string | null;
}

// ─── Category tabs ────────────────────────────────────────────────────────────

const CATEGORY_TABS: {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
    { key: "hotel", label: "Hotels", icon: "business-outline" },
    { key: "apartment", label: "Homes", icon: "home-outline" },
    { key: "car", label: "Cars", icon: "car-outline" },
  ];

// ─── Sort options ─────────────────────────────────────────────────────────────

const SORT_OPTIONS: { key: SortOption; label: string }[] = [
  { key: "recommended", label: "Recommended" },
  { key: "price_asc", label: "Price ↑" },
  { key: "price_desc", label: "Price ↓" },
  { key: "user_ratings_desc", label: "Top Rated" },
  { key: "distance", label: "Distance" },
  { key: "newest", label: "Newest" },
];

// ─── Helper: star rendering ───────────────────────────────────────────────────

function StarRating({ rating }: { rating: number }) {
  const stars = Math.min(5, Math.max(0, Math.round(rating)));
  return (
    <View style={starStyles.row}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Ionicons
          key={i}
          name={i < stars ? "star" : "star-outline"}
          size={12}
          color={i < stars ? "#f59e0b" : BORDER}
          style={{ marginRight: 1 }}
        />
      ))}
    </View>
  );
}

const starStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", marginRight: 6 },
});

// ─── Helper: cancellation badge ───────────────────────────────────────────────

function CancellationBadge({ policy }: { policy: string }) {
  const isGreen = policy === "flexible" || policy === "free";
  const isAmber = policy === "moderate";
  const color = isGreen ? SUCCESS : isAmber ? "#d97706" : DANGER;
  const bg = isGreen ? "#ecfdf5" : isAmber ? "#fffbeb" : "#fef2f2";
  const label = policy.charAt(0).toUpperCase() + policy.slice(1);
  return (
    <View
      style={[badgeStyles.badge, { backgroundColor: bg, borderColor: color }]}
    >
      <Text style={[badgeStyles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  badge: {
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    alignSelf: "flex-start",
  },
  badgeText: { fontSize: 11, fontWeight: "600" },
});

// ─── Skeleton card ────────────────────────────────────────────────────────────

function SkeletonCard() {
  const pulseAnim = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.85,
          duration: 750,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.35,
          duration: 750,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [pulseAnim]);

  return (
    <View style={cardStyles.card}>
      <View style={cardStyles.photoWrapper}>
        <Animated.View style={[cardStyles.photo, skStyles.bone, { opacity: pulseAnim }]} />
        <View style={cardStyles.badgeOverlayContainer}>
          <Animated.View style={[skStyles.bone, { width: 75, height: 22, borderRadius: 6, opacity: pulseAnim }]} />
        </View>
      </View>
      <View style={cardStyles.body}>
        <Animated.View
          style={[
            skStyles.bone,
            { height: 16, width: "75%", borderRadius: 4, marginBottom: 8, opacity: pulseAnim },
          ]}
        />
        <Animated.View
          style={[
            skStyles.bone,
            { height: 12, width: "48%", borderRadius: 4, marginBottom: 12, opacity: pulseAnim },
          ]}
        />
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Animated.View
            style={[
              skStyles.bone,
              { height: 12, width: "32%", borderRadius: 4, opacity: pulseAnim },
            ]}
          />
          <Animated.View
            style={[
              skStyles.bone,
              { height: 22, width: "35%", borderRadius: 6, opacity: pulseAnim },
            ]}
          />
        </View>
      </View>
    </View>
  );
}

const skStyles = StyleSheet.create({
  bone: { backgroundColor: "#E5E7EB" },
});

// ─── Result card ──────────────────────────────────────────────────────────────

interface ResultCardProps {
  item: SearchResult;
  category: string;
  checkIn?: string;
  checkOut?: string;
  guests?: string;
  pickupDatetime?: string;
  returnDatetime?: string;
  onFavouriteToggle: (id: string, current: boolean) => void;
  favouriteLoading: string | null;
  signedPhotoUrl: string | null;
  promotion?: ActivePromotion | null;
  /** Columns in the parent grid. 1 on phones — the card keeps its phone layout. */
  columns?: number;
}

const ResultCard = memo(function ResultCard({
  item,
  category,
  checkIn,
  checkOut,
  guests,
  pickupDatetime,
  returnDatetime,
  onFavouriteToggle,
  favouriteLoading,
  signedPhotoUrl,
  promotion,
  columns = 1,
}: ResultCardProps) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [imgError, setImgError] = useState(false);
  const isCar = category === "car";
  const price = isCar
    ? (item.localizedDailyRate ?? item.dailyRate)
    : (item.localizedNightlyRate ?? item.nightlyRate);
  const priceCurrency = item.localizedCurrency ?? item.currency;
  const pricePrefix = approxPrefix(item.localizedCurrency, item.currency);
  const priceLabel = isCar ? "/day" : "/night";

  // Derive promotion: item.promoBadge takes priority over global active promotion
  const promoPercentFromBadge = item.promoBadge?.labelText
    ? parseFloat(item.promoBadge.labelText.replace(/[^0-9.]/g, ""))
    : 0;

  const effectivePromo: ActivePromotion | null = item.promoBadge && promoPercentFromBadge > 0
    ? {
      activity: isCar ? "car" : category === "apartment" ? "apartment" : "hotel",
      discountType: "percentage",
      discountValue: String(promoPercentFromBadge),
      labelText: item.promoBadge.labelText,
      bannerTitle: item.promoBadge.labelText,
      status: "active",
      applyToBooking: true,
    }
    : promotion ?? null;

  const promoted = applyPromotion(price, effectivePromo);

  function handlePress() {
    const params: Record<string, string> = {};
    if (!isCar) {
      if (checkIn) params.checkIn = checkIn;
      if (checkOut) params.checkOut = checkOut;
      if (guests) params.guests = guests;
    } else {
      if (pickupDatetime) params.pickupDatetime = pickupDatetime;
      if (returnDatetime) params.returnDatetime = returnDatetime;
    }
    router.push({ pathname: `/listing/${item.id}` as any, params });
  }

  // Only display voucher badge if backend explicitly returns a voucher code
  const voucherCode = (item as any).voucherCode || (item as any).activeVoucher?.code || null;

  return (
    <TouchableOpacity
      style={[cardStyles.card, columns > 1 && cardStyles.cardInGrid]}
      onPress={handlePress}
      activeOpacity={0.88}
    >
      {/* Photo */}
      <View style={cardStyles.photoWrapper}>
        {!imgError && signedPhotoUrl ? (
          <ListingImage
            uri={signedPhotoUrl}
            style={[cardStyles.photo, columns > 1 && cardStyles.photoInGrid]}
            onError={() => setImgError(true)}
          />
        ) : (
          <View
            style={[
              cardStyles.photo,
              columns > 1 && cardStyles.photoInGrid,
              cardStyles.photoPlaceholder,
              { alignItems: "center", justifyContent: "center" },
            ]}
          >
            <Text style={{ fontSize: 36 }}>{isCar ? "🚗" : "🏨"}</Text>
          </View>
        )}

        {/* Badges Overlaid on Photo */}
        <View style={cardStyles.badgeOverlayContainer}>
          {item.isAccredited && (
            <View
              style={[cardStyles.overlayBadge, { backgroundColor: SUCCESS }]}
            >
              <Ionicons
                name="checkmark-circle"
                size={10}
                color="#fff"
                style={{ marginRight: 2 }}
              />
              <Text style={cardStyles.overlayBadgeText}>Verified</Text>
            </View>
          )}
          {item.longStayDiscountEnabled && (
            <View
              style={[cardStyles.overlayBadge, { backgroundColor: DANGER }]}
            >
              <Ionicons
                name="trending-down"
                size={10}
                color="#fff"
                style={{ marginRight: 2 }}
              />
              <Text style={cardStyles.overlayBadgeText}>Long Stay Offer</Text>
            </View>
          )}
          {voucherCode && (
            <View style={[cardStyles.overlayBadge, { backgroundColor: PRIMARY }]}>
              <Ionicons
                name="pricetag"
                size={10}
                color="#fff"
                style={{ marginRight: 2 }}
              />
              <Text style={cardStyles.overlayBadgeText}>{voucherCode}</Text>
            </View>
          )}
          {!isCar && item.minStayNights != null && item.minStayNights > 1 && (
            <View style={[cardStyles.overlayBadge, { backgroundColor: "#475569" }]}>
              <Ionicons
                name="moon"
                size={10}
                color="#fff"
                style={{ marginRight: 2 }}
              />
              <Text style={cardStyles.overlayBadgeText}>
                Min {item.minStayNights} nights
              </Text>
            </View>
          )}
        </View>

        {/* Favourite button */}
        {user && (
          <TouchableOpacity
            style={cardStyles.heartBtn}
            onPress={() => onFavouriteToggle(item.id, item.isFavourited)}
            disabled={favouriteLoading === item.id}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            {favouriteLoading === item.id ? (
              <ActivityIndicator size="small" color={DANGER} />
            ) : (
              <Ionicons
                name={item.isFavourited ? "heart" : "heart-outline"}
                size={22}
                color={item.isFavourited ? DANGER : "#fff"}
              />
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Body */}
      <View style={cardStyles.body}>
        {/* Title row */}
        <Text style={cardStyles.title} numberOfLines={2}>
          {item.title}
        </Text>

        {/* Location + distance + Rating Row */}
        <View style={cardStyles.metaRow}>
          <View style={cardStyles.locationRow}>
            <Ionicons name="location" size={13} color={PRIMARY} />
            <Text style={cardStyles.locationText} numberOfLines={1}>
              {item.city}
              {hasKnownDistance(item.distanceKm)
                ? ` · ${item.distanceKm.toFixed(1)} km`
                : ""}
            </Text>
          </View>

          {/* Rating */}
          <View style={cardStyles.ratingRow}>
            <Ionicons
              name="star"
              size={14}
              color="#f59e0b"
              style={{ marginRight: 3 }}
            />
            <Text style={cardStyles.ratingText}>
              {item.starRating ? item.starRating.toFixed(1) : "5.0"}
            </Text>
            <Text style={cardStyles.reviewsCountText}>
              {" "}
              ({(item as any).reviewCount ?? (item as any).reviewsCount ?? 12})
            </Text>
          </View>
        </View>

        {/* Category-specific details */}
        {category === "hotel" && (
          <View style={cardStyles.detailRow}>
            {item.roomType && (
              <Text style={cardStyles.detailText}>
                {item.roomType
                  .replace(/_/g, " ")
                  .replace(/\b\w/g, (c) => c.toUpperCase())}{" "}
                Room
              </Text>
            )}
            {item.isAccredited && (
              <Text style={cardStyles.detailText}>
                {" "}
                · Kainook Accredited Stay
              </Text>
            )}
          </View>
        )}

        {category === "apartment" && (
          <View style={cardStyles.detailRow}>
            {item.bedrooms != null && item.bathrooms != null && (
              <Text style={cardStyles.detailText}>
                {item.bedrooms} bed · {item.bathrooms} bath
              </Text>
            )}
            {item.maxGuests != null && (
              <Text style={cardStyles.detailText}>
                {" "}
                · up to {item.maxGuests} guests
              </Text>
            )}
          </View>
        )}

        {category === "car" && (
          <View style={cardStyles.detailRow}>
            {(item.carMake || item.carModel || item.carYear) && (
              <Text style={cardStyles.detailText}>
                {[item.carMake, item.carModel, item.carYear]
                  .filter(Boolean)
                  .join(" ")}
              </Text>
            )}
            {item.transmission && (
              <Text style={cardStyles.detailText}> · {item.transmission}</Text>
            )}
            {item.seats != null && (
              <Text style={cardStyles.detailText}> · {item.seats} seats</Text>
            )}
          </View>
        )}

        {/* Footer: price + cancellation */}
        <View style={cardStyles.footer}>
          {price != null ? (
            promoted.hasPromotion && promoted.discountedPrice != null ? (
              <View>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    marginBottom: 2,
                  }}
                >
                  <Text style={cardStyles.originalPrice}>
                    {pricePrefix}{priceCurrency} {price.toLocaleString()}
                  </Text>
                  <Text style={cardStyles.promoBadge}>
                    🔥 {promoted.labelText}
                  </Text>
                </View>
                <Text style={cardStyles.price}>
                  <Text style={cardStyles.priceCurrency}>{pricePrefix}{priceCurrency} </Text>
                  {Math.round(promoted.discountedPrice).toLocaleString()}
                  <Text style={cardStyles.priceUnit}>{priceLabel}</Text>
                </Text>
              </View>
            ) : (
              <Text style={cardStyles.price}>
                {item.roomTypes && item.roomTypes.length > 1 ? (
                  <Text style={{ fontSize: 11, color: MUTED, fontWeight: "500" }}>From </Text>
                ) : null}
                <Text style={cardStyles.priceCurrency}>{pricePrefix}{priceCurrency} </Text>
                {price.toLocaleString()}
                <Text style={cardStyles.priceUnit}>{priceLabel}</Text>
              </Text>
            )
          ) : (
            <Text style={cardStyles.priceUnavailable}>Price on request</Text>
          )}
          {item.cancellationPolicy && (
            <CancellationBadge policy={item.cancellationPolicy} />
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
});

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 14,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  // In a multi-column grid the card must share the row evenly. `flex: 1`
  // combined with `columnWrapperStyle`'s gap does that without hard-coding a
  // width against the screen size, so it survives rotation and split view.
  cardInGrid: { flex: 1, marginBottom: 0 },
  photoWrapper: { position: "relative" },
  photo: { width: "100%", height: 200 },
  // A fixed 200dp photo looks squat once the card is only a third of the
  // screen wide, so grid cards scale the photo with the column instead.
  photoInGrid: { height: undefined, aspectRatio: 4 / 3 },
  photoPlaceholder: { backgroundColor: "#e5e7eb" },
  heartBtn: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "rgba(0,0,0,0.35)",
    borderRadius: 20,
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  body: { padding: 14 },
  title: { fontSize: 15, fontWeight: "700", color: TEXT, marginBottom: 5 },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    flex: 1,
    marginRight: 8,
  },
  locationText: { fontSize: 13, color: MUTED, flex: 1 },
  ratingRow: { flexDirection: "row", alignItems: "center" },
  ratingText: { fontSize: 13, fontWeight: "700", color: TEXT },
  reviewsCountText: { fontSize: 12, color: MUTED },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: 8,
  },
  detailText: { fontSize: 13, color: MUTED },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  price: { fontSize: 16, fontWeight: "800", color: TEXT },
  priceCurrency: { fontSize: 12, fontWeight: "600", color: PRIMARY },
  priceUnit: { fontSize: 12, fontWeight: "400", color: MUTED },
  priceUnavailable: { fontSize: 13, color: MUTED, fontStyle: "italic" },
  originalPrice: {
    fontSize: 13,
    color: MUTED,
    textDecorationLine: "line-through",
  },
  promoBadge: { fontSize: 11, fontWeight: "800", color: "#DC2626" },

  // Overlay Badges
  badgeOverlayContainer: {
    position: "absolute",
    top: 12,
    left: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    zIndex: 10,
  },
  overlayBadge: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 1.5,
    elevation: 2,
  },
  overlayBadgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function SearchScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const localCurrency = useAuthStore((s) => s.localCurrency);
  const setLocalCurrency = useAuthStore((s) => s.setLocalCurrency);
  const [currencyModalVisible, setCurrencyModalVisible] = useState(false);
  const params = useLocalSearchParams<{
    category: string;
    placeName: string;
    checkIn?: string;
    checkOut?: string;
    guests?: string;
    pickupDatetime?: string;
    returnDatetime?: string;
    detectedLat?: string;
    detectedLng?: string;
  }>();

  const {
    category: initialCategory = "hotel",
    placeName = "",
    checkIn,
    checkOut,
    guests,
    pickupDatetime,
    returnDatetime,
    detectedLat: rawDetectedLat,
    detectedLng: rawDetectedLng,
  } = params;

  // Category is local state (not just a route param) so the user can switch
  // between Hotels/Apartments/Cars from within the Search screen itself,
  // instead of having to navigate back and re-enter with a different category.
  const [category, setCategory] = useState(initialCategory);

  // Date Range state
  const [localCheckIn, setLocalCheckIn] = useState<string | undefined>(checkIn);
  const [localCheckOut, setLocalCheckOut] = useState<string | undefined>(checkOut);
  const [localPickup, setLocalPickup] = useState<string | undefined>(pickupDatetime);
  const [localReturn, setLocalReturn] = useState<string | undefined>(returnDatetime);
  const [showRangePicker, setShowRangePicker] = useState(false);

  // IP-based detected location — used as default when user hasn't typed a place
  const detectedLoc = useLocationStore((s) => s.location);
  const fallbackLat = rawDetectedLat
    ? Number(rawDetectedLat)
    : (detectedLoc?.lat ?? null);
  const fallbackLng = rawDetectedLng
    ? Number(rawDetectedLng)
    : (detectedLoc?.lng ?? null);

  // Search destination refiner state
  const [searchInput, setSearchInput] = useState(placeName);
  const [selectedPlace, setSelectedPlace] = useState<ResolvedPlace | null>(null);

  // Filter Sheet visible state
  const [filterVisible, setFilterVisible] = useState(false);

  // Map View toggle
  const [showMapView, setShowMapView] = useState(false);
  const [selectedListing, setSelectedListing] = useState<SearchResult | null>(
    null,
  );
  const [mapRegion, setMapRegion] = useState<any>(null);

  // Dynamic filter state variables
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  // Radius is optional — null means nearest-first with no distance cap
  const [radiusKm, setRadiusKm] = useState<number | null>(null);
  const [onlyPromotions, setOnlyPromotions] = useState(false); // apartment-only: long_stay_discount
  const [cancellationPolicy, setCancellationPolicy] = useState<string | null>(
    null,
  );

  const [lastPlaceName, setLastPlaceName] = useState("");

  // Hotel specifics
  const [starRating, setStarRating] = useState<string[]>([]);
  const [amenityIds, setAmenityIds] = useState<string[]>([]);

  // Hotel + Apartment (backend's max_guests_min isn't category-gated)
  const [maxGuestsMin, setMaxGuestsMin] = useState<number | null>(null);

  // Hotel + Apartment — user rating (average guest review score, rating_min)
  const [userRating, setUserRating] = useState<number | null>(null);

  // Apartment specifics
  const [bedroomsMin, setBedroomsMin] = useState<number | null>(null);

  // Car specifics
  const [carCategory, setCarCategory] = useState<string | null>(null);
  const [transmission, setTransmission] = useState<string | null>(null);
  const [mileagePolicy, setMileagePolicy] = useState<string | null>(null);
  const [driveType, setDriveType] = useState<string | null>(null);
  const [airConditioning, setAirConditioning] = useState(false);
  const [airportPickup, setAirportPickup] = useState(false);
  const [deliveryAvailable, setDeliveryAvailable] = useState(false);
  const [seatsMin, setSeatsMin] = useState<number | null>(null);
  const [driverAge, setDriverAge] = useState("");

  const [sort, setSort] = useState<SortOption>("recommended");
  const [cursor, setCursor] = useState<string | null>(null);
  const [allResults, setAllResults] = useState<SearchResult[]>([]);
  const [favouriteLoading, setFavouriteLoading] = useState<string | null>(null);

  // FlatList ref — used to programmatically scroll to the top when the user
  // switches categories so they always see new-category results from the start.
  // Item type is nullable because the grid pads its last row with spacers.
  const flatListRef = useRef<import("react-native").FlatList<SearchResult | null>>(null);
  // Tablet grid: 2–4 result cards per row instead of one stretched card.
  const { columns } = useResponsive();
  // Tracks the current vertical scroll offset for optional future restoration.
  const scrollY = useRef(0);
  const [refreshing, setRefreshing] = useState(false);

  // Active filters calculation
  const hasActiveFilters =
    priceMin !== "" ||
    priceMax !== "" ||
    radiusKm !== null ||
    onlyPromotions ||
    cancellationPolicy !== null ||
    userRating !== null ||
    starRating.length > 0 ||
    amenityIds.length > 0 ||
    bedroomsMin !== null ||
    maxGuestsMin !== null ||
    carCategory !== null ||
    transmission !== null ||
    mileagePolicy !== null ||
    driveType !== null ||
    airConditioning ||
    airportPickup ||
    deliveryAvailable ||
    seatsMin !== null ||
    driverAge !== "";

  const handleResetFilters = () => {
    setPriceMin("");
    setPriceMax("");
    setRadiusKm(null);
    setOnlyPromotions(false);
    setCancellationPolicy(null);
    setUserRating(null);
    setStarRating([]);
    setAmenityIds([]);
    setBedroomsMin(null);
    setMaxGuestsMin(null);
    setCarCategory(null);
    setTransmission(null);
    setMileagePolicy(null);
    setDriveType(null);
    setAirConditioning(false);
    setAirportPickup(false);
    setDeliveryAvailable(false);
    setSeatsMin(null);
    setDriverAge("");
    setCursor(null);
    setAllResults([]);
  };

  // Category-specific filters don't carry over between Hotels/Apartments/Cars
  // (e.g. star_rating means nothing for a car search) — price/cancellation
  // policy/radius/sort are general enough to keep across the switch.
  function handleCategoryChange(next: string) {
    if (next === category) return;
    setCategory(next);
    setStarRating([]);
    setAmenityIds([]);
    setBedroomsMin(null);
    setMaxGuestsMin(null);
    setUserRating(null);
    setOnlyPromotions(false);
    setCarCategory(null);
    setTransmission(null);
    setMileagePolicy(null);
    setDriveType(null);
    setAirConditioning(false);
    setAirportPickup(false);
    setDeliveryAvailable(false);
    setSeatsMin(null);
    setDriverAge("");
    setCursor(null);
    setAllResults([]);
    // Scroll to the top immediately so the user sees the new category's
    // results from the beginning rather than from a mid-list position.
    flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
  }

  // Coordinates are available only after an autocomplete selection. Raw text
  // is never geocoded because it represents a strict text search.
  const geo: GeoResult | null = selectedPlace
    ? { lat: selectedPlace.lat, lng: selectedPlace.lng, town: selectedPlace.town, country: selectedPlace.country }
    : null;

  // Sync map center region on searched place coords
  useEffect(() => {
    if (geo && placeName !== lastPlaceName) {
      setLastPlaceName(placeName);
      setMapRegion({
        latitude: Number(geo.lat),
        longitude: Number(geo.lng),
        latitudeDelta: radiusKm ? radiusKm / 40 : 0.0922,
        longitudeDelta: radiusKm ? radiusKm / 40 : 0.0421,
      });
      setSelectedListing(null);
    }
  }, [geo, placeName, radiusKm]);

  // Reset pagination cursor when category changes.
  // We deliberately do NOT call setAllResults([]) here — keeping the previous
  // category's items visible (via placeholderData) prevents a blank-screen flash
  // while the next category's results are loading.
  useEffect(() => {
    setCursor(null);
  }, [category]);

  // Center on user's current GPS location
  const centerOnUserLocation = () => {
    if (typeof navigator !== "undefined" && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const newRegion = {
            latitude,
            longitude,
            latitudeDelta: 0.015,
            longitudeDelta: 0.015,
          };
          setMapRegion(newRegion);
          setSelectedListing(null);
        },
        () => {
          Alert.alert(
            "Location Error",
            "Could not get current location. Ensure location services are enabled.",
          );
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
      );
    } else {
      Alert.alert(
        "Location Error",
        "Geolocation is not supported on this device.",
      );
    }
  };

  // ── Step 2: Search ──
  // SortOption keys match the backend's `sort` enum exactly (recommended, price_asc,
  // price_desc, distance, newest) — sent straight through, no remapping needed.
  const searchQueryKey = [
    "search",
    category,
    selectedPlace?.placeId ?? searchInput.trim(),
    sort,
    localCheckIn,
    localCheckOut,
    guests,
    localPickup,
    localReturn,
    cursor,
    priceMin,
    priceMax,
    radiusKm,
    onlyPromotions,
    cancellationPolicy,
    starRating,
    amenityIds,
    bedroomsMin,
    maxGuestsMin,
    carCategory,
    transmission,
    mileagePolicy,
    driveType,
    airConditioning,
    seatsMin,
    driverAge,
    // Prices are localized per currency by the API, so the currency is part of
    // the cache identity — without it a currency change serves cached amounts
    // still labelled with the previous currency.
    localCurrency,
    selectedPlace?.lat,
    selectedPlace?.lng,
  ];

  const {
    data: searchData,
    isLoading: searchLoading,
    isError: searchError,
    isFetching: searchFetching,
    isPlaceholderData,
    refetch: retrySearch,
  } = useQuery<SearchResponse["data"]>({
    queryKey: searchQueryKey,
    queryFn: async () => {
      const qText = searchInput.trim();
      const isPlaceSearch = !!qText && !!selectedPlace;

      const qp = new URLSearchParams({
         category,
         sort,
         limit: "50",
          search_mode: isPlaceSearch ? "place" : qText ? "text" : "browse",
       });

      let anchorLat: number | null = null;
      let anchorLng: number | null = null;

      if (qText) {
        qp.set("q", qText);
        if (isPlaceSearch) {
          if (selectedPlace.placeId) qp.set("place_id", selectedPlace.placeId);
          anchorLat = selectedPlace.lat;
          anchorLng = selectedPlace.lng;
        }
      } else {
        // Browse (no typed text) — anchor at the detected visitor location.
        anchorLat = fallbackLat ?? null;
        anchorLng = fallbackLng ?? null;
      }

      if (
        anchorLat != null &&
        anchorLng != null &&
        Number.isFinite(anchorLat) &&
        Number.isFinite(anchorLng) &&
        (anchorLat !== 0 || anchorLng !== 0)
      ) {
        qp.set("lat", String(anchorLat));
        qp.set("lng", String(anchorLng));
        // Radius is only applied when the user explicitly picks one
        if (radiusKm !== null) qp.set("radius_km", String(radiusKm));
      }

      if (priceMin) qp.set("price_min", priceMin);
      if (priceMax) qp.set("price_max", priceMax);
      // user rating (average guest review score) — hotel + apartment
      if (userRating !== null && category !== "car")
        qp.set("rating_min", String(userRating));
      if (cancellationPolicy) qp.set("cancellation_policy", cancellationPolicy);
      // long_stay_discount only makes sense for apartments (the field it filters,
      // listing.longStayEnabled, is an apartment long-stay-discount toggle)
      if (onlyPromotions && category === "apartment")
        qp.set("long_stay_discount", "true");
      // max_guests_min isn't category-gated server-side — offered for hotel + apartment
      if (maxGuestsMin !== null && category !== "car")
        qp.set("max_guests_min", String(maxGuestsMin));

      if (category === "hotel") {
        if (starRating.length) qp.set("star_rating", starRating.join(","));
        if (amenityIds.length) qp.set("amenity_ids", amenityIds.join(","));
      } else if (category === "apartment") {
        if (bedroomsMin !== null) qp.set("bedrooms_min", String(bedroomsMin));
        if (amenityIds.length) qp.set("amenity_ids", amenityIds.join(","));
      } else if (category === "car") {
        if (carCategory) qp.set("car_category", carCategory);
        if (transmission) qp.set("transmission", transmission);
        if (mileagePolicy) qp.set("mileage_policy", mileagePolicy);
        if (driveType) qp.set("drive_type", driveType);
        if (airConditioning) qp.set("air_conditioning", "true");
        if (airportPickup) qp.set("airport_pickup", "true");
        if (deliveryAvailable) qp.set("delivery", "true");
        if (seatsMin !== null) qp.set("seats_min", String(seatsMin));
        if (driverAge.trim()) qp.set("driver_age", driverAge.trim());
      }

      if (category === "hotel" || category === "apartment") {
        if (localCheckIn) qp.set("check_in", localCheckIn);
        if (localCheckOut) qp.set("check_out", localCheckOut);
        if (guests) qp.set("guests", guests);
      } else if (category === "car") {
        if (localPickup) qp.set("pickup_datetime", localPickup);
        if (localReturn) qp.set("return_datetime", localReturn);
      }

      if (cursor) qp.set("cursor", cursor);

      const res = await listingApi.get<SearchResponse>(
        `/search?${qp.toString()}`,
      );
      const incoming = res.data.data;

      const filteredResults = (incoming.results ?? []).filter(
        (r) => r.listingType === category,
      );

      // Return filtered results — allResults is synced via the useEffect below
      // so that cache hits (where queryFn is NOT re-run) are also handled.
      return { ...incoming, results: filteredResults };
    },
    // Show the previous query's data while a new query is loading.
    // This prevents the blank-screen flash when the user switches categories
    // or changes filters — they continue to see the last visible list.
    placeholderData: (previousData) => previousData,
    enabled: true,
    retry: 1,
    staleTime: 0,
  });

  useRefreshOnFocus(retrySearch);

  // ── Sync React Query data → accumulated local state ──────────────────────────
  // This useEffect replaces the old setAllResults() calls that lived inside
  // queryFn.  Moving them here means cache hits (where queryFn is skipped
  // entirely) still update allResults correctly.
  useEffect(() => {
    // Skip placeholder data — it belongs to a different query key and must not
    // overwrite the accumulated list that is still valid for the current context.
    if (isPlaceholderData || !searchData) return;

    if (!cursor) {
      // Page 1 — replace the entire list (new category, new filter, new sort).
      setAllResults(searchData.results ?? []);
    } else {
      // Subsequent pages — append, deduplicating by id.
      setAllResults((prev) => {
        const existingIds = new Set(prev.map((r) => r.id));
        const fresh = (searchData.results ?? []).filter(
          (r) => !existingIds.has(r.id),
        );
        return [...prev, ...fresh];
      });
    }
  }, [searchData, cursor, isPlaceholderData]);

  // ── Favourite toggle ──
  const handleFavouriteToggle = useCallback(
    async (id: string, current: boolean) => {
      setFavouriteLoading(id);
      try {
        if (current) {
          await listingApi.delete(`/guests/me/favourites/${id}`);
        } else {
          await listingApi.post("/guests/me/favourites", { listingId: id });
        }
        setAllResults((prev) =>
          prev.map((r) => (r.id === id ? { ...r, isFavourited: !current } : r)),
        );
      } catch {
        // silently ignore
      } finally {
        setFavouriteLoading(null);
      }
    },
    [],
  );

  // ── Sort change ──
  function handleSortChange(newSort: SortOption) {
    if (newSort === sort) return;
    setSort(newSort);
    setCursor(null);
    // Do NOT call setAllResults([]) — the previous sorted list stays visible
    // (via placeholderData) until the freshly sorted results arrive.
  }

  // ── Load more ──
  function handleLoadMore() {
    if (searchData?.nextCursor) {
      setCursor(searchData.nextCursor);
    }
  }

  // ── Checkbox Toggles ──
  const toggleStarRating = (star: string) => {
    setStarRating((prev) =>
      prev.includes(star) ? prev.filter((s) => s !== star) : [...prev, star],
    );
  };

  const toggleAmenity = (amenity: string) => {
    setAmenityIds((prev) =>
      prev.includes(amenity)
        ? prev.filter((a) => a !== amenity)
        : [...prev, amenity],
    );
  };

  // ── Pull to refresh ──
  async function handleRefresh() {
    setRefreshing(true);
    setCursor(null);
    await retrySearch();
    setRefreshing(false);
  }

  // Derived effective results: if on page 1 (!cursor), use searchData.results directly
  // if available to avoid 1-frame useEffect sync delay. Otherwise use accumulated allResults.
  const effectiveResults = useMemo(() => {
    if (!cursor && searchData?.results && !isPlaceholderData) {
      return searchData.results;
    }
    return allResults;
  }, [cursor, searchData, isPlaceholderData, allResults]);

  // Currency the price filter is expressed in — the converted code when the API
  // could convert, otherwise the guest's chosen one. Matches the card labels,
  // and never a hardcoded currency.
  const priceFilterCurrency =
    effectiveResults.find((r: any) => r.localizedCurrency)?.localizedCurrency
    ?? effectiveResults[0]?.currency
    ?? localCurrency;

  // Slider/input bounds read off the prices actually returned, so there is no
  // invented floor or ceiling.
  const priceBounds = useMemo(() => {
    const values = effectiveResults
      .map((r: any) => r.localizedNightlyRate ?? r.nightlyRate ?? r.localizedDailyRate ?? r.dailyRate)
      .filter((v: any): v is number => typeof v === "number" && Number.isFinite(v) && v > 0);
    if (values.length === 0) return null;
    return { lo: Math.floor(Math.min(...values)), hi: Math.ceil(Math.max(...values)) };
  }, [effectiveResults]);

  // ── Active filter badges (shown above results, each individually removable) ──
  const currencyPrefix = `${priceFilterCurrency} `;
  interface FilterBadge {
    key: string;
    label: string;
    onRemove: () => void;
  }
  const activeFilterBadges: FilterBadge[] = useMemo(() => {
    const badges: FilterBadge[] = [];
    if (priceMin || priceMax) {
      const label =
        priceMin && priceMax
          ? `${currencyPrefix}${priceMin}-${priceMax}`
          : priceMin
            ? `${currencyPrefix}${priceMin}+`
            : `Up to ${currencyPrefix}${priceMax}`;
      badges.push({
        key: "price",
        label,
        onRemove: () => {
          setPriceMin("");
          setPriceMax("");
        },
      });
    }
    if (cancellationPolicy) {
      badges.push({
        key: "cancellation",
        label:
          cancellationPolicy.charAt(0).toUpperCase() +
          cancellationPolicy.slice(1),
        onRemove: () => setCancellationPolicy(null),
      });
    }
    if (userRating !== null) {
      badges.push({
        key: "userrating",
        label: `User rating ${userRating}+`,
        onRemove: () => setUserRating(null),
      });
    }
    if (starRating.length) {
      badges.push({
        key: "stars",
        label: `★${starRating.join(",")}+`,
        onRemove: () => setStarRating([]),
      });
    }
    for (const a of amenityIds) {
      badges.push({
        key: `amenity-${a}`,
        label: a.replace(/_/g, " "),
        onRemove: () => toggleAmenity(a),
      });
    }
    if (bedroomsMin !== null) {
      badges.push({
        key: "bedrooms",
        label: `${bedroomsMin}+ bed`,
        onRemove: () => setBedroomsMin(null),
      });
    }
    if (maxGuestsMin !== null) {
      badges.push({
        key: "guests",
        label: `${maxGuestsMin}+ guests`,
        onRemove: () => setMaxGuestsMin(null),
      });
    }
    if (onlyPromotions) {
      badges.push({
        key: "longstay",
        label: "Long-stay discount",
        onRemove: () => setOnlyPromotions(false),
      });
    }
    if (carCategory) {
      badges.push({
        key: "carcat",
        label: carCategory,
        onRemove: () => setCarCategory(null),
      });
    }
    if (transmission) {
      badges.push({
        key: "transmission",
        label: transmission.charAt(0).toUpperCase() + transmission.slice(1),
        onRemove: () => setTransmission(null),
      });
    }
    if (mileagePolicy) {
      badges.push({
        key: "mileage",
        label: mileagePolicy.charAt(0).toUpperCase() + mileagePolicy.slice(1),
        onRemove: () => setMileagePolicy(null),
      });
    }
    if (driveType) {
      badges.push({
        key: "drivetype",
        label: driveType,
        onRemove: () => setDriveType(null),
      });
    }
    if (airConditioning) {
      badges.push({
        key: "ac",
        label: "A/C",
        onRemove: () => setAirConditioning(false),
      });
    }
    if (airportPickup) {
      badges.push({
        key: "airport",
        label: "Airport pickup",
        onRemove: () => setAirportPickup(false),
      });
    }
    if (deliveryAvailable) {
      badges.push({
        key: "delivery",
        label: "Delivery",
        onRemove: () => setDeliveryAvailable(false),
      });
    }
    if (seatsMin !== null) {
      badges.push({
        key: "seats",
        label: `${seatsMin}+ seats`,
        onRemove: () => setSeatsMin(null),
      });
    }
    if (driverAge) {
      badges.push({
        key: "driverage",
        label: `Age ${driverAge}`,
        onRemove: () => setDriverAge(""),
      });
    }
    return badges;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    priceMin,
    priceMax,
    cancellationPolicy,
    userRating,
    starRating,
    amenityIds,
    bedroomsMin,
    maxGuestsMin,
    onlyPromotions,
    carCategory,
    transmission,
    mileagePolicy,
    driveType,
    airConditioning,
    airportPickup,
    deliveryAvailable,
    seatsMin,
    driverAge,
  ]);

  // Any filter change resets pagination to page 1.
  // We deliberately do NOT call setAllResults([]) here — the previous list
  // stays visible (via placeholderData) while the fresh filtered page loads.
  useEffect(() => {
    setCursor(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    priceMin,
    priceMax,
    radiusKm,
    onlyPromotions,
    cancellationPolicy,
    userRating,
    starRating,
    amenityIds,
    bedroomsMin,
    maxGuestsMin,
    carCategory,
    transmission,
    mileagePolicy,
    driveType,
    airConditioning,
    airportPickup,
    deliveryAvailable,
    seatsMin,
    driverAge,
  ]);

  // Geo is optional — if unavailable, search falls back to global (lat=0,lng=0,radius=20000)

  const isFirstLoad = (searchLoading || searchFetching || isPlaceholderData) && effectiveResults.length === 0;
  const isLoadingMore = searchFetching && effectiveResults.length > 0;
  const hasNextPage = !!searchData?.nextCursor;
  const totalCount = searchData?.totalCount ?? 0;
  // True when the local area was too sparse and the backend widened the search.
  const areaExpanded = !!searchData?.searchArea?.expanded;

  // Active promotion for the current search category
  const { data: categoryPromotions } = useQuery<Promotion[]>({
    queryKey: ["promotions-active", category],
    queryFn: async () => {
      try {
        const res = await listingApi.get<any>(
          `/promotions/active?activity=${category}`,
        );
        const d = res.data?.data;
        if (Array.isArray(d)) return d;
        if (d && Array.isArray(d.promotions)) return d.promotions;
        return [];
      } catch {
        return [];
      }
    },
    staleTime: 5 * 60_000,
    retry: false,
  });

  const activePromotion = useMemo(() => {
    if (!Array.isArray(categoryPromotions)) return null;
    return categoryPromotions.find((p) => p && p.title && typeof p.title === "string" && p.title.trim().length > 0) ?? null;
  }, [categoryPromotions]);

  // /search already returns primaryPhotoUrl on every result — this used to
  // re-fetch it per listing via GET /listings/:id/public (one parallel request
  // per card on screen) for data already in hand.

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      {/* ── Search header refiner bar ── */}
      <View style={styles.searchHeaderBand}>
        <View style={[styles.searchHeader, styles.bandInner]}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.searchBackBtn}
          >
            <Ionicons name="arrow-back" size={24} color={TEXT} />
          </TouchableOpacity>

          <View style={{ flex: 1 }}>
            <PlaceAutocomplete
              value={searchInput}
              onChange={(value) => {
                setSearchInput(value);
                setSelectedPlace(null);
                setCursor(null);
                setAllResults([]);
              }}
              onResolved={(place) => {
                setSelectedPlace(place);
                setSearchInput(place.address);
                setCursor(null);
                setAllResults([]);
              }}
              placeholder="Where to? (or type a listing name)"
            />
          </View>

          <TouchableOpacity
            onPress={() => setCurrencyModalVisible(true)}
            style={styles.currencyHeaderBtn}
            activeOpacity={0.8}
          >
            <Text style={styles.currencyHeaderBtnText}>{localCurrency ?? "EUR"}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setFilterVisible(true)}
            style={[styles.filterBtn, hasActiveFilters && styles.filterBtnActive]}
            activeOpacity={0.8}
          >
            <Ionicons
              name="funnel-outline"
              size={20}
              color={hasActiveFilters ? "#fff" : TEXT}
            />
            {hasActiveFilters && <View style={styles.filterDot} />}
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Category tabs ── */}
      <View style={styles.categoryTabRow}>
        {CATEGORY_TABS.map((tab) => {
          const active = category === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.categoryTab, active && styles.categoryTabActive]}
              onPress={() => handleCategoryChange(tab.key)}
              activeOpacity={0.85}
            >
              <Ionicons
                name={tab.icon}
                size={16}
                color={active ? "#fff" : MUTED}
              />
              <Text
                style={[
                  styles.categoryTabText,
                  active && styles.categoryTabTextActive,
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Date Range Bar ── */}
      <View style={[{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 2 }, styles.bandInner]}>
        <TouchableOpacity
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: "#F3F4F6",
            borderRadius: 12,
            paddingHorizontal: 14,
            paddingVertical: 10,
            borderWidth: 1,
            borderColor: "#E5E7EB",
          }}
          onPress={() => setShowRangePicker(true)}
          activeOpacity={0.8}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
            <Ionicons name="calendar-outline" size={16} color={PRIMARY} />
            <Text style={{ fontSize: 13, fontWeight: "700", color: TEXT }} numberOfLines={1}>
              {category !== "car"
                ? (localCheckIn && localCheckOut
                  ? `${fmtDisplay(localCheckIn)} – ${fmtDisplay(localCheckOut)} (${calcNights(localCheckIn, localCheckOut)} night${calcNights(localCheckIn, localCheckOut) !== 1 ? "s" : ""})`
                  : "Select Dates (Min 1 night)")
                : (localPickup && localReturn
                  ? `${fmtDisplay(localPickup)} – ${fmtDisplay(localReturn)}`
                  : "Select Rental Dates")}
            </Text>
          </View>
          <Ionicons name="chevron-down" size={16} color={MUTED} />
        </TouchableOpacity>
      </View>

      {/* ── Sort bar ── */}
      <View style={styles.sortBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.sortScroll}
        >
          {SORT_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.key}
              style={[
                styles.sortChip,
                sort === opt.key && styles.sortChipActive,
              ]}
              onPress={() => handleSortChange(opt.key)}
            >
              <Text
                style={[
                  styles.sortChipText,
                  sort === opt.key && styles.sortChipTextActive,
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* ── Result count ── */}
      {!isFirstLoad && !searchFetching && !searchError && (
        <View style={styles.resultCount}>
          <Ionicons name="search" size={13} color={MUTED} />
          <Text style={styles.resultCountText}>
            {totalCount > 0
              ? `${effectiveResults.length.toLocaleString()} listing${effectiveResults.length !== 1 ? "s" : ""} ${geo ? `near ${geo.town}` : placeName ? `matching "${placeName}"` : "found"}`
              : `No listings found${geo ? ` near ${geo.town}` : placeName ? ` for "${placeName}"` : ""}`}
          </Text>
        </View>
      )}

      {/* Airbnb-style area note: results reach further than the searched area */}
      {!isFirstLoad && !searchFetching && !searchError && areaExpanded && effectiveResults.length > 0 && (
        <View style={styles.areaNote}>
          <Ionicons name="navigate-outline" size={12} color={MUTED} />
          <Text style={styles.areaNoteText}>
            Not many places {geo ? `right in ${geo.town}` : "nearby"} — showing the nearest options further out.
          </Text>
        </View>
      )}

      {/* ── Active filter badges ── */}
      {!isFirstLoad && !searchError && activeFilterBadges.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.badgesRow}
          style={styles.badgesScroll}
        >
          {activeFilterBadges.map((b) => (
            <TouchableOpacity
              key={b.key}
              style={styles.filterBadge}
              onPress={b.onRemove}
              activeOpacity={0.75}
            >
              <Text style={styles.filterBadgeText} numberOfLines={1}>
                {b.label}
              </Text>
              <Ionicons name="close-circle" size={15} color={PRIMARY} />
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={styles.clearAllBadge}
            onPress={handleResetFilters}
            activeOpacity={0.75}
          >
            <Text style={styles.clearAllBadgeText}>Clear all</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* ── Active promotion banner ── */}
      {activePromotion && activePromotion.title && activePromotion.title.trim().length > 0 && !isFirstLoad && !searchError && (
        <View style={promoBannerStyles.wrap}>
          <Text style={promoBannerStyles.fire}>🔥</Text>
          <View style={{ flex: 1 }}>
            <Text style={promoBannerStyles.text} numberOfLines={1}>
              {activePromotion.title}
            </Text>
            {activePromotion.description ? (
              <Text style={promoBannerStyles.sub} numberOfLines={1}>
                {activePromotion.description}
              </Text>
            ) : null}
          </View>
          {(activePromotion.discountPercent != null ||
            activePromotion.discountAmount != null) && (
              <View style={promoBannerStyles.discBadge}>
                <Text style={promoBannerStyles.discText}>
                  {activePromotion.discountPercent != null
                    ? `-${activePromotion.discountPercent}%`
                    : `-${activePromotion.discountAmount}`}
                </Text>
              </View>
            )}
        </View>
      )}

      {/* ── Search error ── */}
      {searchError && (
        <View style={styles.center}>
          <Ionicons name="wifi-outline" size={48} color={BORDER} />
          <Text style={styles.errorTitle}>Search failed</Text>
          <Text style={styles.errorSub}>
            Please check your connection and try again.
          </Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => void retrySearch()}
          >
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Skeleton loading state ── */}
      {isFirstLoad && !searchError && (
        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
        >
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </ScrollView>
      )}

      {/* ── Results List or Map View ── */}
      {!isFirstLoad &&
        !searchError &&
        (showMapView ? (
          <View style={styles.mapContainer}>
            {MapView ? (
              <>
                <MapView
                  style={styles.map}
                  initialRegion={{
                    latitude: geo ? Number(geo.lat) : -1.286389,
                    longitude: geo ? Number(geo.lng) : 36.817223,
                    latitudeDelta: radiusKm ? radiusKm / 40 : 0.0922,
                    longitudeDelta: radiusKm ? radiusKm / 40 : 0.0421,
                  }}
                  region={mapRegion ?? undefined}
                  onRegionChangeComplete={(r: any) => setMapRegion(r)}
                >
                  {/* Center Search Marker */}
                  {geo && Marker && (
                    <Marker
                      coordinate={{
                        latitude: Number(geo.lat),
                        longitude: Number(geo.lng),
                      }}
                      title="Search Center"
                      pinColor="#15803D"
                    />
                  )}

                  {/* Listings Markers */}
                  {effectiveResults.map((item) => {
                    const coords = getListingCoordinates(
                      item,
                      geo ? Number(geo.lat) : -1.286389,
                      geo ? Number(geo.lng) : 36.817223,
                    );
                    const itemPrice =
                      category === "car" ? item.dailyRate : item.nightlyRate;
                    if (!Marker) return null;
                    return (
                      <Marker
                        key={item.id}
                        coordinate={coords}
                        onPress={() => setSelectedListing(item)}
                      >
                        <View style={styles.priceMarker}>
                          <Text style={styles.priceMarkerText}>
                            {item.currency}{" "}
                            {itemPrice ? itemPrice.toLocaleString() : ""}
                          </Text>
                        </View>
                      </Marker>
                    );
                  })}
                </MapView>

                {/* My Location Button */}
                <TouchableOpacity
                  style={styles.myLocationBtn}
                  onPress={centerOnUserLocation}
                >
                  <Ionicons name="locate" size={22} color={PRIMARY} />
                </TouchableOpacity>
              </>
            ) : (
              <View
                style={[
                  styles.map,
                  styles.center,
                  { backgroundColor: "#fff", paddingHorizontal: 24 },
                ]}
              >
                <View
                  style={{
                    backgroundColor: "#eff6ff",
                    width: 80,
                    height: 80,
                    borderRadius: 40,
                    alignItems: "center",
                    justifyContent: "center",
                    marginBottom: 20,
                  }}
                >
                  <Ionicons name="map-outline" size={40} color={PRIMARY} />
                </View>
                <Text style={[styles.errorTitle, { fontSize: 20 }]}>
                  Interactive Map Unavailable
                </Text>
                <Text
                  style={[styles.errorSub, { maxWidth: 300, marginBottom: 24 }]}
                >
                  The native map module is missing on this client. Switch to
                  List View to browse all properties.
                </Text>
                <TouchableOpacity
                  style={[styles.retryBtn, { marginTop: 0 }]}
                  onPress={() => setShowMapView(false)}
                >
                  <Text style={styles.retryBtnText}>View as List</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Selected Listing Card Preview Overlay */}
            {selectedListing && (
              <View style={styles.previewCardContainer}>
                <ResultCard
                  item={selectedListing}
                  category={category}
                  checkIn={checkIn}
                  checkOut={checkOut}
                  guests={guests}
                  pickupDatetime={pickupDatetime}
                  returnDatetime={returnDatetime}
                  onFavouriteToggle={handleFavouriteToggle}
                  favouriteLoading={favouriteLoading}
                  signedPhotoUrl={selectedListing.primaryPhotoUrl}
                  promotion={
                    activePromotion as unknown as ActivePromotion | null
                  }
                />
                <TouchableOpacity
                  style={styles.closePreviewBtn}
                  onPress={() => setSelectedListing(null)}
                >
                  <Ionicons name="close" size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            )}
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={padToColumns(effectiveResults, columns)}
            keyExtractor={(item, index) => item?.id ?? `spacer-${index}`}
            // FlatList cannot change numColumns on an existing list, so the
            // key forces a remount on rotation / split-view resize.
            key={`grid-${columns}`}
            numColumns={columns}
            columnWrapperStyle={columns > 1 ? styles.gridRow : undefined}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            // Track scroll position so handleCategoryChange can scroll to top.
            onScroll={(e) => { scrollY.current = e.nativeEvent.contentOffset.y; }}
            scrollEventThrottle={150}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => void handleRefresh()}
                tintColor={PRIMARY}
              />
            }
            windowSize={7}
            maxToRenderPerBatch={8}
            removeClippedSubviews
            renderItem={({ item }) => (
              item == null ? <View style={{ flex: 1 }} /> : (
              <ResultCard
                item={item}
                category={category}
                checkIn={checkIn}
                checkOut={checkOut}
                guests={guests}
                pickupDatetime={pickupDatetime}
                returnDatetime={returnDatetime}
                onFavouriteToggle={handleFavouriteToggle}
                favouriteLoading={favouriteLoading}
                signedPhotoUrl={item.primaryPhotoUrl}
                promotion={activePromotion as unknown as ActivePromotion | null}
                columns={columns}
              />
              )
            )}
            ListEmptyComponent={
              (searchLoading || searchFetching || isPlaceholderData) ? (
                <View style={{ paddingTop: 12 }}>
                  {Array.from({ length: 4 }).map((_, i) => (
                    <SkeletonCard key={i} />
                  ))}
                </View>
              ) : (
                <View style={styles.emptyState}>
                  <Ionicons name="home-outline" size={52} color={BORDER} />
                  <Text style={styles.emptyTitle}>No listings found</Text>
                  <Text style={styles.emptySub}>
                    No listings match your filter criteria or search radius. Try
                    resetting filters.
                  </Text>
                  <TouchableOpacity
                    style={styles.backBtn}
                    onPress={handleResetFilters}
                  >
                    <Text style={styles.backBtnText}>Reset all filters</Text>
                  </TouchableOpacity>
                </View>
              )
            }
            ListFooterComponent={
              effectiveResults.length > 0 ? (
                <View style={styles.footer}>
                  {isLoadingMore && (
                    <ActivityIndicator
                      size="small"
                      color={PRIMARY}
                      style={{ marginBottom: 12 }}
                    />
                  )}
                  {hasNextPage && !isLoadingMore && (
                    <TouchableOpacity
                      style={styles.loadMoreBtn}
                      onPress={handleLoadMore}
                    >
                      <Text style={styles.loadMoreText}>Load more</Text>
                    </TouchableOpacity>
                  )}
                  {!hasNextPage && effectiveResults.length > 0 && (
                    <Text style={styles.endText}>All listings loaded</Text>
                  )}
                </View>
              ) : null
            }
          />
        ))}

      {/* Floating Map/List Toggle Button */}
      {!isFirstLoad && !searchError && (
        <TouchableOpacity
          style={styles.floatingToggleBtn}
          onPress={() => {
            setShowMapView(!showMapView);
            setSelectedListing(null);
          }}
          activeOpacity={0.9}
        >
          <Ionicons
            name={showMapView ? "list" : "map"}
            size={18}
            color="#fff"
            style={{ marginRight: 6 }}
          />
          <Text style={styles.floatingToggleBtnText}>
            {showMapView ? "Show List" : "Show Map"}
          </Text>
        </TouchableOpacity>
      )}

      {/* ─── Date Range Picker Modal ─── */}
      <DateRangePickerModal
        visible={showRangePicker}
        isCar={category === "car"}
        initialStartDate={category !== "car" ? localCheckIn : (localPickup ? localPickup.slice(0, 10) : null)}
        initialEndDate={category !== "car" ? localCheckOut : (localReturn ? localReturn.slice(0, 10) : null)}
        onConfirm={(start, end) => {
          if (category !== "car") {
            setLocalCheckIn(start);
            setLocalCheckOut(end);
          } else {
            setLocalPickup(start);
            setLocalReturn(end);
          }
          setCursor(null);
        }}
        onClose={() => setShowRangePicker(false)}
      />

      {/* ─── Currency Picker Modal ─── */}
      <CurrencyPickerModal
        visible={currencyModalVisible}
        selected={localCurrency ?? "EUR"}
        onSelect={async (code) => {
          await setLocalCurrency(code);
          setCurrencyModalVisible(false);
          setCursor(null);
          setAllResults([]);
          queryClient.invalidateQueries({ queryKey: ["listings"] });
        }}
        onClose={() => setCurrencyModalVisible(false)}
      />

      {/* ─── Premium Filter Sheet Modal ─── */}
      <Modal
        visible={filterVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setFilterVisible(false)}
      >
        <SafeAreaView style={filterStyles.container}>
          {/* Header */}
          <View style={filterStyles.header}>
            <TouchableOpacity onPress={() => setFilterVisible(false)}>
              <Ionicons name="close" size={24} color={TEXT} />
            </TouchableOpacity>
            <Text style={filterStyles.headerTitle}>
              Filters ({category.toUpperCase()})
            </Text>
            <TouchableOpacity onPress={handleResetFilters}>
              <Text style={filterStyles.resetText}>Reset All</Text>
            </TouchableOpacity>
          </View>

          {/* Scrollable Filters */}
          <ScrollView
            style={filterStyles.scroll}
            contentContainerStyle={filterStyles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* PRICE RANGE */}
            <Text style={filterStyles.sectionTitle}>Price Range</Text>
            <View style={filterStyles.row}>
              <View style={filterStyles.priceInputBox}>
                <Text style={filterStyles.priceLabel}>Min Price ({priceFilterCurrency})</Text>
                <TextInput
                  style={filterStyles.priceInput}
                  placeholder={priceBounds ? String(priceBounds.lo) : "Any"}
                  keyboardType="numeric"
                  value={priceMin}
                  onChangeText={setPriceMin}
                />
              </View>
              <View style={filterStyles.priceInputBox}>
                <Text style={filterStyles.priceLabel}>Max Price ({priceFilterCurrency})</Text>
                <TextInput
                  style={filterStyles.priceInput}
                  placeholder={priceBounds ? String(priceBounds.hi) : "Any"}
                  keyboardType="numeric"
                  value={priceMax}
                  onChangeText={setPriceMax}
                />
              </View>
            </View>

            {/* CANCELLATION POLICY */}
            <Text style={filterStyles.sectionTitle}>Cancellation Policy</Text>
            <View style={filterStyles.rowChips}>
              {[null as any, "flexible", "moderate", "strict"].map((policy) => (
                <TouchableOpacity
                  key={policy ?? "any"}
                  style={[
                    filterStyles.chip,
                    cancellationPolicy === policy && filterStyles.chipActive,
                  ]}
                  onPress={() => setCancellationPolicy(policy)}
                >
                  <Text
                    style={[
                      filterStyles.chipText,
                      cancellationPolicy === policy &&
                      filterStyles.chipTextActive,
                    ]}
                  >
                    {policy === null
                      ? "Any"
                      : policy.charAt(0).toUpperCase() + policy.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* SEARCH RADIUS */}
            <Text style={filterStyles.sectionTitle}>
              Search Radius (Distance)
            </Text>
            <View style={filterStyles.rowChips}>
              {([null, 25, 100, 500, 2000] as Array<number | null>).map(
                (radius) => (
                  <TouchableOpacity
                    key={radius ?? "any"}
                    style={[
                      filterStyles.chip,
                      radiusKm === radius && filterStyles.chipActive,
                    ]}
                    onPress={() => setRadiusKm(radius)}
                  >
                    <Text
                      style={[
                        filterStyles.chipText,
                        radiusKm === radius && filterStyles.chipTextActive,
                      ]}
                    >
                      {radius === null ? "Any" : `${radius} km`}
                    </Text>
                  </TouchableOpacity>
                ),
              )}
            </View>

            {/* USER RATING — average guest review score (hotel + apartment) */}
            {category !== "car" && (
              <>
                <Text style={filterStyles.sectionTitle}>User Rating</Text>
                <View style={filterStyles.rowChips}>
                  {[null as any, 3, 4, 5].map((r) => (
                    <TouchableOpacity
                      key={r ?? "any"}
                      style={[
                        filterStyles.chip,
                        userRating === r && filterStyles.chipActive,
                      ]}
                      onPress={() => setUserRating(r)}
                    >
                      <Text
                        style={[
                          filterStyles.chipText,
                          userRating === r && filterStyles.chipTextActive,
                        ]}
                      >
                        {r === null ? "Any" : `${r}+`}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {/* PROMOTIONS ONLY — apartment only (filters listing.longStayEnabled) */}
            {category === "apartment" && (
              <View style={filterStyles.rowToggle}>
                <View style={{ flex: 1 }}>
                  <Text style={filterStyles.toggleTitle}>
                    Long-stay discount
                  </Text>
                  <Text style={filterStyles.toggleSub}>
                    Show listings offering a long-stay discount
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setOnlyPromotions(!onlyPromotions)}
                  style={[
                    filterStyles.toggleSwitch,
                    onlyPromotions && filterStyles.toggleSwitchActive,
                  ]}
                >
                  <View
                    style={[
                      filterStyles.toggleDot,
                      onlyPromotions && filterStyles.toggleDotActive,
                    ]}
                  />
                </TouchableOpacity>
              </View>
            )}

            {/* Max Guests — hotel + apartment (backend's max_guests_min isn't category-gated) */}
            {(category === "hotel" || category === "apartment") && (
              <>
                <Text style={filterStyles.sectionTitle}>
                  Min Guest Capacity
                </Text>
                <View style={filterStyles.rowChips}>
                  {[null as any, 2, 4, 6].map((cap) => (
                    <TouchableOpacity
                      key={cap ?? "any"}
                      style={[
                        filterStyles.chip,
                        maxGuestsMin === cap && filterStyles.chipActive,
                      ]}
                      onPress={() => setMaxGuestsMin(cap)}
                    >
                      <Text
                        style={[
                          filterStyles.chipText,
                          maxGuestsMin === cap && filterStyles.chipTextActive,
                        ]}
                      >
                        {cap === null ? "Any" : `${cap}+ guests`}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {/* HOTEL SPECIFIC FILTERS */}
            {category === "hotel" && (
              <>
                {/* Stars Rating */}
                <Text style={filterStyles.sectionTitle}>Hotel Star Rating</Text>
                <View style={filterStyles.rowChips}>
                  {["3", "4", "5"].map((star) => (
                    <TouchableOpacity
                      key={star}
                      style={[
                        filterStyles.chip,
                        starRating.includes(star) && filterStyles.chipActive,
                      ]}
                      onPress={() => toggleStarRating(star)}
                    >
                      <Text
                        style={[
                          filterStyles.chipText,
                          starRating.includes(star) &&
                          filterStyles.chipTextActive,
                        ]}
                      >
                        {star} Star
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Amenities */}
                <Text style={filterStyles.sectionTitle}>Amenities</Text>
                <View style={filterStyles.groupedChips}>
                  {[
                    "wifi",
                    "pool",
                    "gym",
                    "spa",
                    "restaurant",
                    "bar",
                    "parking",
                    "air_conditioning",
                  ].map((a) => (
                    <TouchableOpacity
                      key={a}
                      style={[
                        filterStyles.chip,
                        amenityIds.includes(a) && filterStyles.chipActive,
                        { marginBottom: 8 },
                      ]}
                      onPress={() => toggleAmenity(a)}
                    >
                      <Text
                        style={[
                          filterStyles.chipText,
                          amenityIds.includes(a) && filterStyles.chipTextActive,
                        ]}
                      >
                        {a.replace("_", " ")}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {/* APARTMENT SPECIFIC FILTERS */}
            {category === "apartment" && (
              <>
                {/* Bedrooms */}
                <Text style={filterStyles.sectionTitle}>Min Bedrooms</Text>
                <View style={filterStyles.rowChips}>
                  {[null as any, 1, 2, 3].map((beds) => (
                    <TouchableOpacity
                      key={beds ?? "any"}
                      style={[
                        filterStyles.chip,
                        bedroomsMin === beds && filterStyles.chipActive,
                      ]}
                      onPress={() => setBedroomsMin(beds)}
                    >
                      <Text
                        style={[
                          filterStyles.chipText,
                          bedroomsMin === beds && filterStyles.chipTextActive,
                        ]}
                      >
                        {beds === null ? "Any" : `${beds}+ bed`}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Amenities */}
                <Text style={filterStyles.sectionTitle}>Amenities</Text>
                <View style={filterStyles.groupedChips}>
                  {[
                    "wifi",
                    "kitchen",
                    "parking",
                    "air_conditioning",
                    "smart_tv",
                    "work_desk",
                    "security_24h",
                    "elevator",
                  ].map((a) => (
                    <TouchableOpacity
                      key={a}
                      style={[
                        filterStyles.chip,
                        amenityIds.includes(a) && filterStyles.chipActive,
                        { marginBottom: 8 },
                      ]}
                      onPress={() => toggleAmenity(a)}
                    >
                      <Text
                        style={[
                          filterStyles.chipText,
                          amenityIds.includes(a) && filterStyles.chipTextActive,
                        ]}
                      >
                        {a.replace("_", " ")}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {/* CAR SPECIFIC FILTERS */}
            {category === "car" && (
              <>
                {/* Vehicle Category */}
                <Text style={filterStyles.sectionTitle}>Vehicle Category</Text>
                <View style={filterStyles.groupedChips}>
                  {[
                    "Economy",
                    "Compact",
                    "SUV",
                    "Minivan",
                    "Pickup",
                    "Luxury",
                    "Electric",
                    "Convertible",
                  ].map((catOption) => (
                    <TouchableOpacity
                      key={catOption}
                      style={[
                        filterStyles.chip,
                        carCategory === catOption && filterStyles.chipActive,
                        { marginBottom: 8 },
                      ]}
                      onPress={() =>
                        setCarCategory(
                          carCategory === catOption ? null : catOption,
                        )
                      }
                    >
                      <Text
                        style={[
                          filterStyles.chipText,
                          carCategory === catOption &&
                          filterStyles.chipTextActive,
                        ]}
                      >
                        {catOption}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Transmission */}
                <Text style={filterStyles.sectionTitle}>Transmission</Text>
                <View style={filterStyles.rowChips}>
                  {[null as any, "automatic", "manual"].map((trans) => (
                    <TouchableOpacity
                      key={trans ?? "any"}
                      style={[
                        filterStyles.chip,
                        transmission === trans && filterStyles.chipActive,
                      ]}
                      onPress={() => setTransmission(trans)}
                    >
                      <Text
                        style={[
                          filterStyles.chipText,
                          transmission === trans && filterStyles.chipTextActive,
                        ]}
                      >
                        {trans === null
                          ? "Any"
                          : trans.charAt(0).toUpperCase() + trans.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Mileage Policy */}
                <Text style={filterStyles.sectionTitle}>Mileage Policy</Text>
                <View style={filterStyles.rowChips}>
                  {[null as any, "unlimited", "limited"].map((policy) => (
                    <TouchableOpacity
                      key={policy ?? "any"}
                      style={[
                        filterStyles.chip,
                        mileagePolicy === policy && filterStyles.chipActive,
                      ]}
                      onPress={() => setMileagePolicy(policy)}
                    >
                      <Text
                        style={[
                          filterStyles.chipText,
                          mileagePolicy === policy &&
                          filterStyles.chipTextActive,
                        ]}
                      >
                        {policy === null
                          ? "Any"
                          : policy.charAt(0).toUpperCase() + policy.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Drive Type */}
                <Text style={filterStyles.sectionTitle}>Drive Type</Text>
                <View style={filterStyles.rowChips}>
                  {[null as any, "2WD", "4WD", "AWD"].map((dt) => (
                    <TouchableOpacity
                      key={dt ?? "any"}
                      style={[
                        filterStyles.chip,
                        driveType === dt && filterStyles.chipActive,
                      ]}
                      onPress={() => setDriveType(dt)}
                    >
                      <Text
                        style={[
                          filterStyles.chipText,
                          driveType === dt && filterStyles.chipTextActive,
                        ]}
                      >
                        {dt === null ? "Any" : dt}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Seats */}
                <Text style={filterStyles.sectionTitle}>Min Seats</Text>
                <View style={filterStyles.rowChips}>
                  {[null as any, 2, 4, 5, 7].map((n) => (
                    <TouchableOpacity
                      key={n ?? "any"}
                      style={[
                        filterStyles.chip,
                        seatsMin === n && filterStyles.chipActive,
                      ]}
                      onPress={() => setSeatsMin(n)}
                    >
                      <Text
                        style={[
                          filterStyles.chipText,
                          seatsMin === n && filterStyles.chipTextActive,
                        ]}
                      >
                        {n === null ? "Any" : `${n}+ seats`}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Driver Age */}
                <Text style={filterStyles.sectionTitle}>Your Age</Text>
                <View style={filterStyles.row}>
                  <View style={filterStyles.priceInputBox}>
                    <Text style={filterStyles.priceLabel}>
                      Excludes cars requiring an older minimum driver age
                    </Text>
                    <TextInput
                      style={filterStyles.priceInput}
                      placeholder="Any"
                      keyboardType="numeric"
                      value={driverAge}
                      onChangeText={(t) => setDriverAge(t.replace(/\D/g, ""))}
                      maxLength={2}
                    />
                  </View>
                </View>

                {/* Air Conditioning */}
                <View style={filterStyles.rowToggle}>
                  <View style={{ flex: 1 }}>
                    <Text style={filterStyles.toggleTitle}>
                      Air Conditioning
                    </Text>
                    <Text style={filterStyles.toggleSub}>
                      Only show cars with air conditioning
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setAirConditioning(!airConditioning)}
                    style={[
                      filterStyles.toggleSwitch,
                      airConditioning && filterStyles.toggleSwitchActive,
                    ]}
                  >
                    <View
                      style={[
                        filterStyles.toggleDot,
                        airConditioning && filterStyles.toggleDotActive,
                      ]}
                    />
                  </TouchableOpacity>
                </View>

                {/* Airport Pickup */}
                <View style={filterStyles.rowToggle}>
                  <View style={{ flex: 1 }}>
                    <Text style={filterStyles.toggleTitle}>Airport Pickup</Text>
                    <Text style={filterStyles.toggleSub}>
                      Only show cars with airport pickup
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setAirportPickup(!airportPickup)}
                    style={[
                      filterStyles.toggleSwitch,
                      airportPickup && filterStyles.toggleSwitchActive,
                    ]}
                  >
                    <View
                      style={[
                        filterStyles.toggleDot,
                        airportPickup && filterStyles.toggleDotActive,
                      ]}
                    />
                  </TouchableOpacity>
                </View>

                {/* Delivery Available */}
                <View style={filterStyles.rowToggle}>
                  <View style={{ flex: 1 }}>
                    <Text style={filterStyles.toggleTitle}>
                      Delivery Available
                    </Text>
                    <Text style={filterStyles.toggleSub}>
                      Only show cars that offer delivery
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setDeliveryAvailable(!deliveryAvailable)}
                    style={[
                      filterStyles.toggleSwitch,
                      deliveryAvailable && filterStyles.toggleSwitchActive,
                    ]}
                  >
                    <View
                      style={[
                        filterStyles.toggleDot,
                        deliveryAvailable && filterStyles.toggleDotActive,
                      ]}
                    />
                  </TouchableOpacity>
                </View>
              </>
            )}
          </ScrollView>

          {/* Apply Button */}
          <View style={filterStyles.footer}>
            <TouchableOpacity
              style={filterStyles.applyBtn}
              onPress={() => setFilterVisible(false)}
            >
              <Text style={filterStyles.applyBtnText}>Apply Filters</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Promotion banner styles ──────────────────────────────────────────────────

const promoBannerStyles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF7ED",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#FED7AA",
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginBottom: 8,
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 1,
  },
  fire: { fontSize: 18 },
  text: { fontSize: 13, fontWeight: "700", color: "#92400e" },
  sub: { fontSize: 11, color: "#b45309", marginTop: 2 },
  discBadge: {
    backgroundColor: "#dc2626",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  discText: { color: "#fff", fontSize: 11, fontWeight: "800" },
});

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },

  // Search Header refiner bar
  // The band stays edge-to-edge; `bandInner` caps the controls inside it so a
  // tablet does not get a 1000dp-wide text field or three enormous pills.
  bandInner: { maxWidth: 860, width: "100%", alignSelf: "center" },
  searchHeaderBand: {
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  searchHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 0,
    borderBottomColor: BORDER,
  },
  searchBackBtn: {
    padding: 6,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f3f4f6",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginHorizontal: 10,
  },
  searchTextInput: {
    flex: 1,
    fontSize: 14,
    color: TEXT,
    padding: 0,
  },
  currencyHeaderBtn: {
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: BORDER,
    marginRight: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F9FAFB",
  },
  currencyHeaderBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: TEXT,
  },
  filterBtn: {
    padding: 8,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: BORDER,
    position: "relative",
  },
  filterBtnActive: {
    backgroundColor: PRIMARY,
    borderColor: PRIMARY,
  },
  filterDot: {
    position: "absolute",
    top: 2,
    right: 2,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: DANGER,
  },

  // Category tabs
  categoryTabRow: {
    flexDirection: "row",
    backgroundColor: "#fff",
    justifyContent: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  categoryTab: {
    flex: 1,
    maxWidth: 240,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1.5,
    borderColor: BORDER,
    borderRadius: 10,
    paddingVertical: 9,
    backgroundColor: "#fff",
  },
  categoryTabActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  categoryTabText: { fontSize: 13, fontWeight: "600", color: MUTED },
  categoryTabTextActive: { color: "#fff", fontWeight: "700" },

  // Sort bar
  sortBar: {
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    paddingVertical: 10,
  },
  sortScroll: { paddingHorizontal: 16, gap: 8 },
  sortChip: {
    borderWidth: 1.5,
    borderColor: BORDER,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: "#fff",
  },
  sortChipActive: { borderColor: PRIMARY, backgroundColor: "#eff6ff" },
  sortChipText: { fontSize: 13, color: MUTED, fontWeight: "500" },
  sortChipTextActive: { color: PRIMARY, fontWeight: "700" },

  // Result count
  resultCount: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  resultCountText: { fontSize: 13, color: MUTED },
  areaNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 16,
    paddingBottom: 6,
  },
  areaNoteText: { fontSize: 12, color: MUTED, flexShrink: 1 },

  // Active filter badges
  badgesScroll: { maxHeight: 44 },
  badgesRow: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 8,
    alignItems: "center",
  },
  filterBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#eff6ff",
    borderWidth: 1,
    borderColor: PRIMARY,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  filterBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: PRIMARY,
    maxWidth: 140,
  },
  clearAllBadge: { paddingHorizontal: 8, paddingVertical: 6 },
  clearAllBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: DANGER,
    textDecorationLine: "underline",
  },

  // List
  list: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 32 },
  // `gap` supplies both the column gutter and the row spacing that
  // `cardInGrid` drops by zeroing marginBottom.
  gridRow: { gap: 14, marginBottom: 14, alignItems: "stretch" },

  // Center states (loading/error/empty)
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  centerText: { fontSize: 15, color: MUTED, marginTop: 12 },
  errorTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: TEXT,
    marginTop: 16,
    textAlign: "center",
  },
  errorSub: {
    fontSize: 14,
    color: MUTED,
    marginTop: 8,
    textAlign: "center",
    lineHeight: 20,
  },

  // Empty state
  emptyState: { alignItems: "center", paddingTop: 60, paddingHorizontal: 16 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: TEXT, marginTop: 16 },
  emptySub: {
    fontSize: 14,
    color: MUTED,
    marginTop: 8,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },

  // Buttons
  retryBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 32,
    marginTop: 20,
  },
  retryBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  backBtn: {
    borderWidth: 1.5,
    borderColor: BORDER,
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 32,
    marginTop: 12,
  },
  backBtnText: { color: TEXT, fontWeight: "600", fontSize: 15 },

  // Footer
  footer: { alignItems: "center", paddingVertical: 16 },
  loadMoreBtn: {
    borderWidth: 1.5,
    borderColor: PRIMARY,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 36,
  },
  loadMoreText: { color: PRIMARY, fontWeight: "700", fontSize: 15 },
  endText: { fontSize: 13, color: MUTED },

  // Maps styles
  mapContainer: { flex: 1, position: "relative" },
  map: { ...StyleSheet.absoluteFillObject },
  priceMarker: {
    backgroundColor: PRIMARY,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1.5,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
    elevation: 2,
  },
  priceMarkerText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  myLocationBtn: {
    position: "absolute",
    right: 14,
    top: 14,
    backgroundColor: "#fff",
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  previewCardContainer: {
    position: "absolute",
    bottom: 14,
    left: 14,
    right: 14,
    zIndex: 20,
  },
  closePreviewBtn: {
    position: "absolute",
    top: -8,
    right: -8,
    backgroundColor: "rgba(0,0,0,0.65)",
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 30,
  },
  floatingToggleBtn: {
    position: "absolute",
    bottom: 49,
    alignSelf: "center",
    backgroundColor: TEXT,
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 4.84,
    elevation: 5,
    zIndex: 30,
  },
  floatingToggleBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});

// ─── Filter Sheet Styles ───────────────────────────────────────────────────────

const filterStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  headerTitle: { fontSize: 16, fontWeight: "700", color: TEXT },
  resetText: { fontSize: 14, fontWeight: "600", color: PRIMARY },

  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingVertical: 20 },

  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: TEXT,
    marginTop: 18,
    marginBottom: 12,
  },

  row: { flexDirection: "row", gap: 12 },
  priceInputBox: { flex: 1 },
  priceLabel: {
    fontSize: 11,
    color: MUTED,
    fontWeight: "500",
    marginBottom: 5,
  },
  priceInput: {
    borderWidth: 1.5,
    borderColor: BORDER,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: TEXT,
    backgroundColor: "#fafafa",
  },

  rowChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  groupedChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderWidth: 1.5,
    borderColor: BORDER,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "#fff",
  },
  chipActive: {
    borderColor: PRIMARY,
    backgroundColor: "#eff6ff",
  },
  chipText: { fontSize: 13, color: MUTED, fontWeight: "500" },
  chipTextActive: { color: PRIMARY, fontWeight: "700" },

  rowToggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 24,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: BORDER,
  },
  toggleTitle: { fontSize: 14, fontWeight: "700", color: TEXT },
  toggleSub: { fontSize: 12, color: MUTED, marginTop: 2 },
  toggleSwitch: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#e5e7eb",
    padding: 2,
    justifyContent: "center",
  },
  toggleSwitchActive: {
    backgroundColor: PRIMARY,
  },
  toggleDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
    elevation: 2,
  },
  toggleDotActive: {
    alignSelf: "flex-end",
  },

  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: BORDER,
    backgroundColor: "#fff",
  },
  applyBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  applyBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
