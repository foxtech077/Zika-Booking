import { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { listingApi } from "../lib/listing-api";
import { useAuthStore } from "../store/auth";

// ─── Constants ────────────────────────────────────────────────────────────────

const PRIMARY = "#1a73e8";
const DANGER = "#dc2626";
const SUCCESS = "#16a34a";
const TEXT = "#111827";
const MUTED = "#6b7280";
const BORDER = "#e5e7eb";
const BG = "#f9fafb";

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

  return (
    <TouchableOpacity style={cardStyles.card} onPress={handlePress} activeOpacity={0.88}>
      {/* Photo */}
      <View style={cardStyles.photoWrapper}>
        {item.primaryPhotoUrl ? (
          <Image source={{ uri: item.primaryPhotoUrl }} style={cardStyles.photo} resizeMode="cover" />
        ) : (
          <View style={[cardStyles.photo, cardStyles.photoPlaceholder]} />
        )}

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

        {/* Location + distance */}
        <View style={cardStyles.locationRow}>
          <Ionicons name="location-outline" size={13} color={MUTED} />
          <Text style={cardStyles.locationText} numberOfLines={1}>
            {item.city}
            {item.distanceKm != null ? ` · ${item.distanceKm.toFixed(1)} km away` : ""}
          </Text>
        </View>

        {/* Category-specific details */}
        {category === "hotel" && (
          <View style={cardStyles.detailRow}>
            {item.starRating != null && <StarRating rating={item.starRating} />}
            {item.isAccredited && (
              <View style={cardStyles.accreditedBadge}>
                <Ionicons name="checkmark-circle" size={12} color={SUCCESS} />
                <Text style={cardStyles.accreditedText}>Accredited</Text>
              </View>
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
  },
  body: { padding: 14 },
  title: { fontSize: 16, fontWeight: "700", color: TEXT, marginBottom: 5 },
  locationRow: { flexDirection: "row", alignItems: "center", marginBottom: 8, gap: 3 },
  locationText: { fontSize: 13, color: MUTED, flex: 1 },
  detailRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", marginBottom: 8 },
  detailText: { fontSize: 13, color: MUTED },
  accreditedBadge: { flexDirection: "row", alignItems: "center", gap: 3 },
  accreditedText: { fontSize: 12, color: SUCCESS, fontWeight: "500" },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
  price: { fontSize: 17, fontWeight: "700", color: TEXT },
  priceCurrency: { fontSize: 13, fontWeight: "500", color: MUTED },
  priceUnit: { fontSize: 13, fontWeight: "400", color: MUTED },
  priceUnavailable: { fontSize: 14, color: MUTED, fontStyle: "italic" },
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

  const [sort, setSort] = useState<SortOption>("recommended");
  const [cursor, setCursor] = useState<string | null>(null);
  const [allResults, setAllResults] = useState<SearchResult[]>([]);
  const [favouriteLoading, setFavouriteLoading] = useState<string | null>(null);

  // ── Step 1: Geocode ──
  const {
    data: geo,
    isLoading: geoLoading,
    isError: geoError,
    refetch: retryGeo,
  } = useQuery<GeoResult>({
    queryKey: ["geocode", placeName],
    queryFn: async () => {
      const res = await listingApi.get<{ data: GeoResult }>(`/geocode?address=${encodeURIComponent(placeName)}`);
      return res.data.data;
    },
    enabled: !!placeName,
    retry: 1,
    staleTime: 5 * 60_000,
  });

  // ── Step 2: Search ──
  const sortParamMap: Record<SortOption, string> = {
    recommended: "recommended",
    price_asc: "price_asc",
    price_desc: "price_desc",
    nearest: "nearest",
  };

  const searchQueryKey = ["search", category, geo?.lat, geo?.lng, sort, checkIn, checkOut, guests, pickupDatetime, returnDatetime, cursor];

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
        radius_km: "25",
        sort: sortParamMap[sort],
        limit: "20",
      });

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

      // Accumulate results across cursors; reset when sort changes (cursor resets to null)
      if (!cursor) {
        setAllResults(incoming.results);
      } else {
        setAllResults((prev) => {
          const existingIds = new Set(prev.map((r) => r.id));
          const fresh = incoming.results.filter((r) => !existingIds.has(r.id));
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
      // silently ignore — optimistic failure
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
              : ""}
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

      {/* ── Results list ── */}
      {!isFirstLoad && !searchError && (
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
                No listings found in this area. Try expanding your search radius or changing your dates.
              </Text>
              <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                <Text style={styles.backBtnText}>Modify search</Text>
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
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },

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
});
