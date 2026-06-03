import { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  ScrollView,
  TextInput,
  Modal,
  Platform,
  Linking,
  Alert,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
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

const LISTING_BASE = process.env["EXPO_PUBLIC_LISTING_API_URL"] ?? "https://api.kainook.com/listings";
function resolvePhoto(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  return `${LISTING_BASE}${url.startsWith("/") ? "" : "/"}${url}`;
}

function ListingImage({ uri, style, resizeMode = "cover", onError }: {
  uri: string | null | undefined;
  style: any;
  resizeMode?: "cover" | "contain" | "stretch" | "center";
  onError?: () => void;
}) {
  const token = useAuthStore((s) => s.accessToken);
  const resolved = resolvePhoto(uri);
  if (!resolved) return null;
  const isApiUrl = resolved.includes("api.kainook.com") && !resolved.includes("amazonaws.com");
  return (
    <Image
      source={isApiUrl && token
        ? { uri: resolved, headers: { Authorization: `Bearer ${token}` } }
        : { uri: resolved }}
      style={style}
      resizeMode={resizeMode}
      onError={onError}
    />
  );
}

// Deterministic coordinates calculator from search center + distance
function getListingCoordinates(item: SearchResult, centerLat: number, centerLng: number) {
  if ((item as any).lat != null && (item as any).lng != null) {
    return {
      latitude: Number((item as any).lat),
      longitude: Number((item as any).lng),
    };
  }

  const distance = item.distanceKm ?? 0.1;
  let hash = 0;
  const idStr = item.id || "";
  for (let i = 0; i < idStr.length; i++) {
    hash = idStr.charCodeAt(i) + ((hash << 5) - hash);
  }
  const angle = Math.abs(hash % 360) * (Math.PI / 180);

  // 1 degree latitude = 111.32 km
  const latOffset = (distance / 111.32) * Math.cos(angle);
  const radLat = (centerLat * Math.PI) / 180;
  const lngOffset = (distance / (111.32 * Math.cos(radLat) || 1)) * Math.sin(angle);

  return {
    latitude: centerLat + latOffset,
    longitude: centerLng + lngOffset,
  };
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PRIMARY = "#1B5E20";
const DANGER = "#dc2626";
const SUCCESS = "#16a34a";
const TEXT = "#111827";
const MUTED = "#6b7280";
const BORDER = "#e5e7eb";
const BG = "#f9fafb";

// Fallback coordinates for common cities (used when geocoding API fails due to auth)
const CITY_COORDS: Record<string, { lat: number; lng: number; town: string; country: string }> = {
  nairobi: { lat: -1.2921, lng: 36.8219, town: "Nairobi", country: "KE" },
  mombasa: { lat: -4.0435, lng: 39.6682, town: "Mombasa", country: "KE" },
  kisumu: { lat: -0.0917, lng: 34.7679, town: "Kisumu", country: "KE" },
  kampala: { lat: 0.3476, lng: 32.5825, town: "Kampala", country: "UG" },
  "dar es salaam": { lat: -6.7924, lng: 39.2083, town: "Dar es Salaam", country: "TZ" },
  lagos: { lat: 6.5244, lng: 3.3792, town: "Lagos", country: "NG" },
  accra: { lat: 5.6037, lng: -0.1870, town: "Accra", country: "GH" },
  cairo: { lat: 30.0444, lng: 31.2357, town: "Cairo", country: "EG" },
  dubai: { lat: 25.2048, lng: 55.2708, town: "Dubai", country: "AE" },
  london: { lat: 51.5074, lng: -0.1278, town: "London", country: "GB" },
  paris: { lat: 48.8566, lng: 2.3522, town: "Paris", country: "FR" },
  "new york": { lat: 40.7128, lng: -74.0060, town: "New York", country: "US" },
};

// ─── Types ────────────────────────────────────────────────────────────────────

type SortOption = "recommended" | "price_asc" | "price_desc" | "nearest";

interface GeoResult {
  lat: number;
  lng: number;
  town: string;
  country: string;
}

interface SearchResult {
  id: string;
  listingType: string;
  title: string;
  city: string;
  countryCode: string;
  distanceKm: number;
  primaryPhotoUrl: string | null;
  nightlyRate: number | null;
  dailyRate: number | null;
  currency: string;
  cancellationPolicy: string;
  starRating: number | null;
  isAccredited: boolean;
  roomType: string | null;
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
}

interface SearchResponse {
  data: {
    totalCount: number;
    nextCursor: string | null;
    results: SearchResult[];
  };
}

// ─── Sort options ─────────────────────────────────────────────────────────────

const SORT_OPTIONS: { key: SortOption; label: string }[] = [
  { key: "recommended", label: "Recommended" },
  { key: "price_asc", label: "Price ↑" },
  { key: "price_desc", label: "Price ↓" },
  { key: "nearest", label: "Nearest" },
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
    <View style={[badgeStyles.badge, { backgroundColor: bg, borderColor: color }]}>
      <Text style={[badgeStyles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  badge: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, alignSelf: "flex-start" },
  badgeText: { fontSize: 11, fontWeight: "600" },
});

// ─── Skeleton card ────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <View style={cardStyles.card}>
      <View style={[cardStyles.photo, skStyles.rect]} />
      <View style={cardStyles.body}>
        <View style={[skStyles.rect, { height: 14, width: "70%", borderRadius: 4, marginBottom: 8 }]} />
        <View style={[skStyles.rect, { height: 12, width: "45%", borderRadius: 4, marginBottom: 8 }]} />
        <View style={[skStyles.rect, { height: 12, width: "55%", borderRadius: 4 }]} />
      </View>
    </View>
  );
}

const skStyles = StyleSheet.create({
  rect: { backgroundColor: "#e5e7eb" },
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
}

function ResultCard({
  item,
  category,
  checkIn,
  checkOut,
  guests,
  pickupDatetime,
  returnDatetime,
  onFavouriteToggle,
  favouriteLoading,
}: ResultCardProps) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [imgError, setImgError] = useState(false);
  const isCar = category === "car";
  const price = isCar ? item.dailyRate : item.nightlyRate;
  const priceLabel = isCar ? "/day" : "/night";

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

  // Prefer backend-provided voucher details if exposed, otherwise fall back to category default
  const voucherCode = (item as any).voucherCode || (item as any).activeVoucher?.code || (isCar ? "SAFARI20" : "WELCOME10");

  return (
    <TouchableOpacity style={cardStyles.card} onPress={handlePress} activeOpacity={0.88}>
      {/* Photo */}
      <View style={cardStyles.photoWrapper}>
        {!imgError && item.primaryPhotoUrl ? (
          <ListingImage uri={item.primaryPhotoUrl} style={cardStyles.photo} onError={() => setImgError(true)} />
        ) : (
          <View style={[cardStyles.photo, cardStyles.photoPlaceholder, { alignItems: "center", justifyContent: "center" }]}>
            <Text style={{ fontSize: 36 }}>{isCar ? "🚗" : "🏨"}</Text>
          </View>
        )}

        {/* Badges Overlaid on Photo */}
        <View style={cardStyles.badgeOverlayContainer}>
          {item.isAccredited && (
            <View style={[cardStyles.overlayBadge, { backgroundColor: SUCCESS }]}>
              <Ionicons name="checkmark-circle" size={10} color="#fff" style={{ marginRight: 2 }} />
              <Text style={cardStyles.overlayBadgeText}>Verified</Text>
            </View>
          )}
          {item.longStayDiscountEnabled && (
            <View style={[cardStyles.overlayBadge, { backgroundColor: DANGER }]}>
              <Ionicons name="trending-down" size={10} color="#fff" style={{ marginRight: 2 }} />
              <Text style={cardStyles.overlayBadgeText}>Promo</Text>
            </View>
          )}
          <View style={[cardStyles.overlayBadge, { backgroundColor: PRIMARY }]}>
            <Ionicons name="pricetag" size={10} color="#fff" style={{ marginRight: 2 }} />
            <Text style={cardStyles.overlayBadgeText}>{voucherCode}</Text>
          </View>
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
        <Text style={cardStyles.title} numberOfLines={2}>{item.title}</Text>

        {/* Location + distance + Rating Row */}
        <View style={cardStyles.metaRow}>
          <View style={cardStyles.locationRow}>
            <Ionicons name="location" size={13} color={PRIMARY} />
            <Text style={cardStyles.locationText} numberOfLines={1}>
              {item.city}
              {item.distanceKm != null ? ` · ${item.distanceKm.toFixed(1)} km` : ""}
            </Text>
          </View>

          {/* Rating */}
          <View style={cardStyles.ratingRow}>
            <Ionicons name="star" size={14} color="#f59e0b" style={{ marginRight: 3 }} />
            <Text style={cardStyles.ratingText}>
              {item.starRating ? item.starRating.toFixed(1) : "5.0"}
            </Text>
            <Text style={cardStyles.reviewsCountText}> ({(item as any).reviewCount ?? (item as any).reviewsCount ?? 12})</Text>
          </View>
        </View>

        {/* Category-specific details */}
        {category === "hotel" && (
          <View style={cardStyles.detailRow}>
            {item.roomType && (
              <Text style={cardStyles.detailText}>
                {item.roomType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())} Room
              </Text>
            )}
            {item.isAccredited && (
              <Text style={cardStyles.detailText}> · Zika Accredited Stay</Text>
            )}
          </View>
        )}

        {category === "apartment" && (
          <View style={cardStyles.detailRow}>
            {item.bedrooms != null && item.bathrooms != null && (
              <Text style={cardStyles.detailText}>{item.bedrooms} bed · {item.bathrooms} bath</Text>
            )}
            {item.maxGuests != null && (
              <Text style={cardStyles.detailText}> · up to {item.maxGuests} guests</Text>
            )}
          </View>
        )}

        {category === "car" && (
          <View style={cardStyles.detailRow}>
            {(item.carMake || item.carModel || item.carYear) && (
              <Text style={cardStyles.detailText}>
                {[item.carMake, item.carModel, item.carYear].filter(Boolean).join(" ")}
              </Text>
            )}
            {item.transmission && <Text style={cardStyles.detailText}> · {item.transmission}</Text>}
            {item.seats != null && <Text style={cardStyles.detailText}> · {item.seats} seats</Text>}
          </View>
        )}

        {/* Footer: price + cancellation */}
        <View style={cardStyles.footer}>
          {price != null ? (
            <Text style={cardStyles.price}>
              <Text style={cardStyles.priceCurrency}>{item.currency} </Text>
              {price.toLocaleString()}
              <Text style={cardStyles.priceUnit}>{priceLabel}</Text>
            </Text>
          ) : (
            <Text style={cardStyles.priceUnavailable}>Price on request</Text>
          )}
          {item.cancellationPolicy && <CancellationBadge policy={item.cancellationPolicy} />}
        </View>
      </View>
    </TouchableOpacity>
  );
}

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
  photoWrapper: { position: "relative" },
  photo: { width: "100%", height: 200 },
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
  metaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 3, flex: 1, marginRight: 8 },
  locationText: { fontSize: 13, color: MUTED, flex: 1 },
  ratingRow: { flexDirection: "row", alignItems: "center" },
  ratingText: { fontSize: 13, fontWeight: "700", color: TEXT },
  reviewsCountText: { fontSize: 12, color: MUTED },
  detailRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", marginBottom: 8 },
  detailText: { fontSize: 13, color: MUTED },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
  price: { fontSize: 16, fontWeight: "800", color: TEXT },
  priceCurrency: { fontSize: 12, fontWeight: "600", color: PRIMARY },
  priceUnit: { fontSize: 12, fontWeight: "400", color: MUTED },
  priceUnavailable: { fontSize: 13, color: MUTED, fontStyle: "italic" },

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
  const params = useLocalSearchParams<{
    category: string;
    placeName: string;
    checkIn?: string;
    checkOut?: string;
    guests?: string;
    pickupDatetime?: string;
    returnDatetime?: string;
  }>();

  const { category = "hotel", placeName = "", checkIn, checkOut, guests, pickupDatetime, returnDatetime } = params;

  // Search destination refiner state
  const [searchInput, setSearchInput] = useState(placeName);

  // Filter Sheet visible state
  const [filterVisible, setFilterVisible] = useState(false);

  // Map View toggle
  const [showMapView, setShowMapView] = useState(false);
  const [selectedListing, setSelectedListing] = useState<SearchResult | null>(null);
  const [mapRegion, setMapRegion] = useState<any>(null);

  // Dynamic filter state variables
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [ratingMin, setRatingMin] = useState<number | null>(null);
  const [radiusKm, setRadiusKm] = useState(25);
  const [onlyPromotions, setOnlyPromotions] = useState(false);

  const [lastPlaceName, setLastPlaceName] = useState("");

  // Hotel specifics
  const [starRating, setStarRating] = useState<string[]>([]);
  const [roomType, setRoomType] = useState<string | null>(null);
  const [amenityIds, setAmenityIds] = useState<string[]>([]);

  // Apartment specifics
  const [bedroomsMin, setBedroomsMin] = useState<number | null>(null);
  const [bathroomsMin, setBathroomsMin] = useState<number | null>(null);
  const [maxGuestsMin, setMaxGuestsMin] = useState<number | null>(null);

  // Car specifics
  const [carCategory, setCarCategory] = useState<string | null>(null);
  const [transmission, setTransmission] = useState<string | null>(null);
  const [mileagePolicy, setMileagePolicy] = useState<string | null>(null);

  const [sort, setSort] = useState<SortOption>("recommended");
  const [cursor, setCursor] = useState<string | null>(null);
  const [allResults, setAllResults] = useState<SearchResult[]>([]);
  const [favouriteLoading, setFavouriteLoading] = useState<string | null>(null);

  // Active filters calculation
  const hasActiveFilters =
    priceMin !== "" ||
    priceMax !== "" ||
    ratingMin !== null ||
    radiusKm !== 25 ||
    onlyPromotions ||
    starRating.length > 0 ||
    roomType !== null ||
    amenityIds.length > 0 ||
    bedroomsMin !== null ||
    bathroomsMin !== null ||
    maxGuestsMin !== null ||
    carCategory !== null ||
    transmission !== null ||
    mileagePolicy !== null;

  const handleResetFilters = () => {
    setPriceMin("");
    setPriceMax("");
    setRatingMin(null);
    setRadiusKm(25);
    setOnlyPromotions(false);
    setStarRating([]);
    setRoomType(null);
    setAmenityIds([]);
    setBedroomsMin(null);
    setBathroomsMin(null);
    setMaxGuestsMin(null);
    setCarCategory(null);
    setTransmission(null);
    setMileagePolicy(null);
    setCursor(null);
    setAllResults([]);
  };

  // ── Step 1: Geocode (falls back to local city map when API requires auth) ──
  const {
    data: geo,
    isLoading: geoLoading,
    isError: geoError,
    refetch: retryGeo,
  } = useQuery<GeoResult>({
    queryKey: ["geocode", placeName],
    queryFn: async () => {
      try {
        const res = await listingApi.get<{ data: GeoResult }>(`/geocode?address=${encodeURIComponent(placeName)}`);
        return res.data.data;
      } catch {
        // API may require auth — fall back to known city coordinates
        const key = placeName.trim().toLowerCase();
        const fallback = CITY_COORDS[key];
        if (fallback) return fallback;
        // Try prefix match (e.g. "Nairobi, Kenya" → "nairobi")
        const prefixMatch = Object.keys(CITY_COORDS).find(k => key.startsWith(k) || k.startsWith(key.split(",")[0].trim()));
        if (prefixMatch) return CITY_COORDS[prefixMatch]!;
        throw new Error("Location not found");
      }
    },
    enabled: !!placeName,
    retry: 0,
    staleTime: 5 * 60_000,
  });

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

  // Reset results and cursor when category changes (tab transition)
  useEffect(() => {
    setCursor(null);
    setAllResults([]);
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
          Alert.alert("Location Error", "Could not get current location. Ensure location services are enabled.");
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
      );
    } else {
      Alert.alert("Location Error", "Geolocation is not supported on this device.");
    }
  };

  // ── Step 2: Search ──
  // API returns price_asc as expensive-first and price_desc as cheap-first (inverted)
  const sortParamMap: Record<SortOption, string> = {
    recommended: "recommended",
    price_asc: "price_desc",
    price_desc: "price_asc",
    nearest: "nearest",
  };

  const searchQueryKey = [
    "search",
    category,
    geo?.lat,
    geo?.lng,
    sort,
    checkIn,
    checkOut,
    guests,
    pickupDatetime,
    returnDatetime,
    cursor,
    priceMin,
    priceMax,
    ratingMin,
    radiusKm,
    onlyPromotions,
    starRating,
    roomType,
    amenityIds,
    bedroomsMin,
    bathroomsMin,
    maxGuestsMin,
    carCategory,
    transmission,
    mileagePolicy,
  ];

  const {
    data: searchData,
    isLoading: searchLoading,
    isError: searchError,
    isFetching: searchFetching,
    refetch: retrySearch,
  } = useQuery<SearchResponse["data"]>({
    queryKey: searchQueryKey,
    queryFn: async () => {
      if (!geo) throw new Error("No geo data");

      const qp = new URLSearchParams({
        category,
        lat: String(geo.lat),
        lng: String(geo.lng),
        radius_km: String(radiusKm),
        sort: sortParamMap[sort],
        limit: "20",
      });

      if (priceMin) qp.set("price_min", priceMin);
      if (priceMax) qp.set("price_max", priceMax);
      if (ratingMin) qp.set("rating_min", String(ratingMin));
      if (onlyPromotions) qp.set("long_stay_discount", "true");

      if (category === "hotel") {
        if (starRating.length) qp.set("star_rating", starRating.join(","));
        if (roomType) qp.set("room_type", roomType);
        if (amenityIds.length) qp.set("amenity_ids", amenityIds.join(","));
      } else if (category === "apartment") {
        if (bedroomsMin !== null) qp.set("bedrooms_min", String(bedroomsMin));
        if (bathroomsMin !== null) qp.set("bathrooms_min", String(bathroomsMin));
        if (maxGuestsMin !== null) qp.set("max_guests_min", String(maxGuestsMin));
        if (amenityIds.length) qp.set("amenity_ids", amenityIds.join(","));
      } else if (category === "car") {
        if (carCategory) qp.set("car_category", carCategory);
        if (transmission) qp.set("transmission", transmission);
        if (mileagePolicy) qp.set("mileage_policy", mileagePolicy);
      }

      if (category === "hotel" || category === "apartment") {
        if (checkIn) qp.set("check_in", checkIn);
        if (checkOut) qp.set("check_out", checkOut);
        if (guests) qp.set("guests", guests);
      } else if (category === "car") {
        if (pickupDatetime) qp.set("pickup_datetime", pickupDatetime);
        if (returnDatetime) qp.set("return_datetime", returnDatetime);
      }

      if (cursor) qp.set("cursor", cursor);

      const res = await listingApi.get<SearchResponse>(`/search?${qp.toString()}`);
      const incoming = res.data.data;

      const filteredResults = (incoming.results ?? []).filter((r) => r.listingType === category);
      if (!cursor) {
        setAllResults(filteredResults);
      } else {
        setAllResults((prev) => {
          const existingIds = new Set(prev.map((r) => r.id));
          const fresh = filteredResults.filter((r) => !existingIds.has(r.id));
          return [...prev, ...fresh];
        });
      }

      return incoming;
    },
    enabled: !!geo,
    retry: 1,
    staleTime: 30_000,
  });

  // ── Favourite toggle ──
  const handleFavouriteToggle = useCallback(async (id: string, current: boolean) => {
    setFavouriteLoading(id);
    try {
      if (current) {
        await listingApi.delete(`/guests/me/favourites/${id}`);
      } else {
        await listingApi.post("/guests/me/favourites", { listingId: id });
      }
      setAllResults((prev) =>
        prev.map((r) => r.id === id ? { ...r, isFavourited: !current } : r),
      );
    } catch {
      // silently ignore
    } finally {
      setFavouriteLoading(null);
    }
  }, []);

  // ── Sort change ──
  function handleSortChange(newSort: SortOption) {
    if (newSort === sort) return;
    setSort(newSort);
    setCursor(null);
    setAllResults([]);
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
      prev.includes(star) ? prev.filter((s) => s !== star) : [...prev, star]
    );
  };

  const toggleAmenity = (amenity: string) => {
    setAmenityIds((prev) =>
      prev.includes(amenity) ? prev.filter((a) => a !== amenity) : [...prev, amenity]
    );
  };

  // ── Render: geo loading ──
  if (geoLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={PRIMARY} />
          <Text style={styles.centerText}>Finding {placeName}...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Render: geo error ──
  if (geoError || (!geoLoading && !geo)) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Ionicons name="location-outline" size={48} color={BORDER} />
          <Text style={styles.errorTitle}>Location not found</Text>
          <Text style={styles.errorSub}>
            We could not locate "{placeName}". Try a different city or country name.
          </Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => void retryGeo()}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isFirstLoad = searchLoading && allResults.length === 0;
  const isLoadingMore = searchFetching && allResults.length > 0;
  const hasNextPage = !!searchData?.nextCursor;
  const totalCount = searchData?.totalCount ?? 0;

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      {/* ── Search header refiner bar ── */}
      <View style={styles.searchHeader}>
        <TouchableOpacity onPress={() => router.back()} style={styles.searchBackBtn}>
          <Ionicons name="arrow-back" size={24} color={TEXT} />
        </TouchableOpacity>

        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={18} color={MUTED} style={{ marginRight: 6 }} />
          <TextInput
            style={styles.searchTextInput}
            placeholder="Where to? (e.g. Nairobi, Mombasa)"
            value={searchInput}
            onChangeText={setSearchInput}
            onSubmitEditing={() => {
              if (searchInput.trim()) {
                router.setParams({ placeName: searchInput.trim() });
                setCursor(null);
                setAllResults([]);
              }
            }}
          />
        </View>

        <TouchableOpacity
          onPress={() => setFilterVisible(true)}
          style={[styles.filterBtn, hasActiveFilters && styles.filterBtnActive]}
          activeOpacity={0.8}
        >
          <Ionicons name="funnel-outline" size={20} color={hasActiveFilters ? "#fff" : TEXT} />
          {hasActiveFilters && <View style={styles.filterDot} />}
        </TouchableOpacity>
      </View>

      {/* ── Sort bar ── */}
      <View style={styles.sortBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sortScroll}>
          {SORT_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.key}
              style={[styles.sortChip, sort === opt.key && styles.sortChipActive]}
              onPress={() => handleSortChange(opt.key)}
            >
              <Text style={[styles.sortChipText, sort === opt.key && styles.sortChipTextActive]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* ── Result count ── */}
      {!isFirstLoad && !searchError && (
        <View style={styles.resultCount}>
          <Ionicons name="search" size={13} color={MUTED} />
          <Text style={styles.resultCountText}>
            {totalCount > 0
              ? `${totalCount.toLocaleString()} listing${totalCount !== 1 ? "s" : ""} near ${geo?.town ?? placeName}`
              : "0 listings found near " + (geo?.town ?? placeName)}
          </Text>
        </View>
      )}

      {/* ── Search error ── */}
      {searchError && (
        <View style={styles.center}>
          <Ionicons name="wifi-outline" size={48} color={BORDER} />
          <Text style={styles.errorTitle}>Search failed</Text>
          <Text style={styles.errorSub}>Please check your connection and try again.</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => void retrySearch()}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Skeleton loading state ── */}
      {isFirstLoad && !searchError && (
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
        </ScrollView>
      )}

      {/* ── Results List or Map View ── */}
      {!isFirstLoad && !searchError && (
        showMapView ? (
          <View style={styles.mapContainer}>
            {MapView ? (
              <>
                <MapView
                  style={styles.map}
                  initialRegion={{
                    latitude: geo?.lat ? Number(geo.lat) : -1.286389,
                    longitude: geo?.lng ? Number(geo.lng) : 36.817223,
                    latitudeDelta: radiusKm ? radiusKm / 40 : 0.0922,
                    longitudeDelta: radiusKm ? radiusKm / 40 : 0.0421,
                  }}
                  region={mapRegion ?? undefined}
                  onRegionChangeComplete={(r: any) => setMapRegion(r)}
                >
                  {/* Center Search Marker */}
                  {geo && Marker && (
                    <Marker
                      coordinate={{ latitude: Number(geo.lat), longitude: Number(geo.lng) }}
                      title="Search Center"
                      pinColor="#dc2626"
                    />
                  )}

                  {/* Listings Markers */}
                  {allResults.map((item) => {
                    const coords = getListingCoordinates(item, geo?.lat ? Number(geo.lat) : -1.286389, geo?.lng ? Number(geo.lng) : 36.817223);
                    const itemPrice = category === "car" ? item.dailyRate : item.nightlyRate;
                    if (!Marker) return null;
                    return (
                      <Marker
                        key={item.id}
                        coordinate={coords}
                        onPress={() => setSelectedListing(item)}
                      >
                        <View style={styles.priceMarker}>
                          <Text style={styles.priceMarkerText}>
                            {item.currency} {itemPrice ? itemPrice.toLocaleString() : ""}
                          </Text>
                        </View>
                      </Marker>
                    );
                  })}
                </MapView>

                {/* My Location Button */}
                <TouchableOpacity style={styles.myLocationBtn} onPress={centerOnUserLocation}>
                  <Ionicons name="locate" size={22} color={PRIMARY} />
                </TouchableOpacity>
              </>
            ) : (
              <View style={[styles.map, styles.center, { backgroundColor: "#fff", paddingHorizontal: 24 }]}>
                <View style={{ backgroundColor: "#eff6ff", width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center", marginBottom: 20 }}>
                  <Ionicons name="map-outline" size={40} color={PRIMARY} />
                </View>
                <Text style={[styles.errorTitle, { fontSize: 20 }]}>Interactive Map Unavailable</Text>
                <Text style={[styles.errorSub, { maxWidth: 300, marginBottom: 24 }]}>
                  The native map module is missing on this client. Switch to List View to browse all properties.
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
            data={allResults}
            keyExtractor={(item) => item.id}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
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
              />
            )}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="home-outline" size={52} color={BORDER} />
                <Text style={styles.emptyTitle}>No listings found</Text>
                <Text style={styles.emptySub}>
                  No listings match your filter criteria or search radius. Try resetting filters.
                </Text>
                <TouchableOpacity style={styles.backBtn} onPress={handleResetFilters}>
                  <Text style={styles.backBtnText}>Reset all filters</Text>
                </TouchableOpacity>
              </View>
            }
            ListFooterComponent={
              allResults.length > 0 ? (
                <View style={styles.footer}>
                  {isLoadingMore && (
                    <ActivityIndicator size="small" color={PRIMARY} style={{ marginBottom: 12 }} />
                  )}
                  {hasNextPage && !isLoadingMore && (
                    <TouchableOpacity style={styles.loadMoreBtn} onPress={handleLoadMore}>
                      <Text style={styles.loadMoreText}>Load more</Text>
                    </TouchableOpacity>
                  )}
                  {!hasNextPage && allResults.length > 0 && (
                    <Text style={styles.endText}>All listings loaded</Text>
                  )}
                </View>
              ) : null
            }
          />
        )
      )}

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
          <Ionicons name={showMapView ? "list" : "map"} size={18} color="#fff" style={{ marginRight: 6 }} />
          <Text style={styles.floatingToggleBtnText}>{showMapView ? "Show List" : "Show Map"}</Text>
        </TouchableOpacity>
      )}

      {/* ─── Premium Filter Sheet Modal ─── */}
      <Modal visible={filterVisible} animationType="slide" transparent={false} onRequestClose={() => setFilterVisible(false)}>
        <SafeAreaView style={filterStyles.container}>
          {/* Header */}
          <View style={filterStyles.header}>
            <TouchableOpacity onPress={() => setFilterVisible(false)}>
              <Ionicons name="close" size={24} color={TEXT} />
            </TouchableOpacity>
            <Text style={filterStyles.headerTitle}>Filters ({category.toUpperCase()})</Text>
            <TouchableOpacity onPress={handleResetFilters}>
              <Text style={filterStyles.resetText}>Reset All</Text>
            </TouchableOpacity>
          </View>

          {/* Scrollable Filters */}
          <ScrollView style={filterStyles.scroll} contentContainerStyle={filterStyles.scrollContent} showsVerticalScrollIndicator={false}>

            {/* PRICE RANGE */}
            <Text style={filterStyles.sectionTitle}>Price Range</Text>
            <View style={filterStyles.row}>
              <View style={filterStyles.priceInputBox}>
                <Text style={filterStyles.priceLabel}>Min Price (KES)</Text>
                <TextInput
                  style={filterStyles.priceInput}
                  placeholder="Any"
                  keyboardType="numeric"
                  value={priceMin}
                  onChangeText={setPriceMin}
                />
              </View>
              <View style={filterStyles.priceInputBox}>
                <Text style={filterStyles.priceLabel}>Max Price (KES)</Text>
                <TextInput
                  style={filterStyles.priceInput}
                  placeholder="Any"
                  keyboardType="numeric"
                  value={priceMax}
                  onChangeText={setPriceMax}
                />
              </View>
            </View>

            {/* RATINGS FILTER */}
            <Text style={filterStyles.sectionTitle}>Minimum Guest Rating</Text>
            <View style={filterStyles.rowChips}>
              {[(null as any), 3, 4, 5].map((stars) => (
                <TouchableOpacity
                  key={stars ?? "any"}
                  style={[filterStyles.chip, ratingMin === stars && filterStyles.chipActive]}
                  onPress={() => setRatingMin(stars)}
                >
                  <Text style={[filterStyles.chipText, ratingMin === stars && filterStyles.chipTextActive]}>
                    {stars === null ? "Any" : `${stars} ★ & up`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* SEARCH RADIUS */}
            <Text style={filterStyles.sectionTitle}>Search Radius (Distance)</Text>
            <View style={filterStyles.rowChips}>
              {[5, 10, 25, 50].map((radius) => (
                <TouchableOpacity
                  key={radius}
                  style={[filterStyles.chip, radiusKm === radius && filterStyles.chipActive]}
                  onPress={() => setRadiusKm(radius)}
                >
                  <Text style={[filterStyles.chipText, radiusKm === radius && filterStyles.chipTextActive]}>
                    {radius} km
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* PROMOTIONS ONLY */}
            <View style={filterStyles.rowToggle}>
              <View style={{ flex: 1 }}>
                <Text style={filterStyles.toggleTitle}>Long-stay promotions</Text>
                <Text style={filterStyles.toggleSub}>Show listings offering active long stay discounts</Text>
              </View>
              <TouchableOpacity
                onPress={() => setOnlyPromotions(!onlyPromotions)}
                style={[filterStyles.toggleSwitch, onlyPromotions && filterStyles.toggleSwitchActive]}
              >
                <View style={[filterStyles.toggleDot, onlyPromotions && filterStyles.toggleDotActive]} />
              </TouchableOpacity>
            </View>

            {/* HOTEL SPECIFIC FILTERS */}
            {category === "hotel" && (
              <>
                {/* Stars Rating */}
                <Text style={filterStyles.sectionTitle}>Hotel Star Rating</Text>
                <View style={filterStyles.rowChips}>
                  {["3", "4", "5"].map((star) => (
                    <TouchableOpacity
                      key={star}
                      style={[filterStyles.chip, starRating.includes(star) && filterStyles.chipActive]}
                      onPress={() => toggleStarRating(star)}
                    >
                      <Text style={[filterStyles.chipText, starRating.includes(star) && filterStyles.chipTextActive]}>
                        {star} Star
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Room Types */}
                <Text style={filterStyles.sectionTitle}>Room Style</Text>
                <View style={filterStyles.rowChips}>
                  {["standard", "superior", "deluxe", "suite"].map((style) => (
                    <TouchableOpacity
                      key={style}
                      style={[filterStyles.chip, roomType === style && filterStyles.chipActive]}
                      onPress={() => setRoomType(roomType === style ? null : style)}
                    >
                      <Text style={[filterStyles.chipText, roomType === style && filterStyles.chipTextActive]}>
                        {style.charAt(0).toUpperCase() + style.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Amenities */}
                <Text style={filterStyles.sectionTitle}>Amenities</Text>
                <View style={filterStyles.groupedChips}>
                  {["wifi", "pool", "gym", "spa", "restaurant", "bar", "parking", "air_conditioning"].map((a) => (
                    <TouchableOpacity
                      key={a}
                      style={[filterStyles.chip, amenityIds.includes(a) && filterStyles.chipActive, { marginBottom: 8 }]}
                      onPress={() => toggleAmenity(a)}
                    >
                      <Text style={[filterStyles.chipText, amenityIds.includes(a) && filterStyles.chipTextActive]}>
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
                  {[(null as any), 1, 2, 3].map((beds) => (
                    <TouchableOpacity
                      key={beds ?? "any"}
                      style={[filterStyles.chip, bedroomsMin === beds && filterStyles.chipActive]}
                      onPress={() => setBedroomsMin(beds)}
                    >
                      <Text style={[filterStyles.chipText, bedroomsMin === beds && filterStyles.chipTextActive]}>
                        {beds === null ? "Any" : `${beds}+ bed`}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Bathrooms */}
                <Text style={filterStyles.sectionTitle}>Min Bathrooms</Text>
                <View style={filterStyles.rowChips}>
                  {[(null as any), 1, 2, 3].map((baths) => (
                    <TouchableOpacity
                      key={baths ?? "any"}
                      style={[filterStyles.chip, bathroomsMin === baths && filterStyles.chipActive]}
                      onPress={() => setBathroomsMin(baths)}
                    >
                      <Text style={[filterStyles.chipText, bathroomsMin === baths && filterStyles.chipTextActive]}>
                        {baths === null ? "Any" : `${baths}+ bath`}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Guests */}
                <Text style={filterStyles.sectionTitle}>Min Guest Capacity</Text>
                <View style={filterStyles.rowChips}>
                  {[(null as any), 2, 4, 6].map((cap) => (
                    <TouchableOpacity
                      key={cap ?? "any"}
                      style={[filterStyles.chip, maxGuestsMin === cap && filterStyles.chipActive]}
                      onPress={() => setMaxGuestsMin(cap)}
                    >
                      <Text style={[filterStyles.chipText, maxGuestsMin === cap && filterStyles.chipTextActive]}>
                        {cap === null ? "Any" : `${cap}+ guests`}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Amenities */}
                <Text style={filterStyles.sectionTitle}>Amenities</Text>
                <View style={filterStyles.groupedChips}>
                  {["wifi", "kitchen", "washing_machine", "parking", "air_conditioning", "workspace", "tv", "security"].map((a) => (
                    <TouchableOpacity
                      key={a}
                      style={[filterStyles.chip, amenityIds.includes(a) && filterStyles.chipActive, { marginBottom: 8 }]}
                      onPress={() => toggleAmenity(a)}
                    >
                      <Text style={[filterStyles.chipText, amenityIds.includes(a) && filterStyles.chipTextActive]}>
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
                  {["Economy", "Compact", "SUV", "Minivan", "Luxury", "Electric", "Convertible"].map((catOption) => (
                    <TouchableOpacity
                      key={catOption}
                      style={[filterStyles.chip, carCategory === catOption && filterStyles.chipActive, { marginBottom: 8 }]}
                      onPress={() => setCarCategory(carCategory === catOption ? null : catOption)}
                    >
                      <Text style={[filterStyles.chipText, carCategory === catOption && filterStyles.chipTextActive]}>
                        {catOption}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Transmission */}
                <Text style={filterStyles.sectionTitle}>Transmission</Text>
                <View style={filterStyles.rowChips}>
                  {[(null as any), "automatic", "manual"].map((trans) => (
                    <TouchableOpacity
                      key={trans ?? "any"}
                      style={[filterStyles.chip, transmission === trans && filterStyles.chipActive]}
                      onPress={() => setTransmission(trans)}
                    >
                      <Text style={[filterStyles.chipText, transmission === trans && filterStyles.chipTextActive]}>
                        {trans === null ? "Any" : trans.charAt(0).toUpperCase() + trans.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Mileage Policy */}
                <Text style={filterStyles.sectionTitle}>Mileage Policy</Text>
                <View style={filterStyles.rowChips}>
                  {[(null as any), "unlimited", "limited"].map((policy) => (
                    <TouchableOpacity
                      key={policy ?? "any"}
                      style={[filterStyles.chip, mileagePolicy === policy && filterStyles.chipActive]}
                      onPress={() => setMileagePolicy(policy)}
                    >
                      <Text style={[filterStyles.chipText, mileagePolicy === policy && filterStyles.chipTextActive]}>
                        {policy === null ? "Any" : policy.charAt(0).toUpperCase() + policy.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

          </ScrollView>

          {/* Apply Button */}
          <View style={filterStyles.footer}>
            <TouchableOpacity style={filterStyles.applyBtn} onPress={() => setFilterVisible(false)}>
              <Text style={filterStyles.applyBtnText}>Apply Filters</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },

  // Search Header refiner bar
  searchHeader: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
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

  // List
  list: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 32 },

  // Center states (loading/error/empty)
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  centerText: { fontSize: 15, color: MUTED, marginTop: 12 },
  errorTitle: { fontSize: 18, fontWeight: "700", color: TEXT, marginTop: 16, textAlign: "center" },
  errorSub: { fontSize: 14, color: MUTED, marginTop: 8, textAlign: "center", lineHeight: 20 },

  // Empty state
  emptyState: { alignItems: "center", paddingTop: 60, paddingHorizontal: 16 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: TEXT, marginTop: 16 },
  emptySub: { fontSize: 14, color: MUTED, marginTop: 8, textAlign: "center", lineHeight: 20, marginBottom: 24 },

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
    bottom: 24,
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

  sectionTitle: { fontSize: 15, fontWeight: "700", color: TEXT, marginTop: 18, marginBottom: 12 },

  row: { flexDirection: "row", gap: 12 },
  priceInputBox: { flex: 1 },
  priceLabel: { fontSize: 11, color: MUTED, fontWeight: "500", marginBottom: 5 },
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
