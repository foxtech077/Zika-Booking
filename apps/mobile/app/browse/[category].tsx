"use no memo";
import { useState, useCallback } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, TextInput, Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { listingApi } from "../../lib/listing-api";
import { useAuthStore } from "../../store/auth";
import { ListingImage } from "../../components/ListingImage";

// ── Constants ─────────────────────────────────────────────────────────────────
const GREEN = "#1B5E20";
const TEXT = "#111827";
const MUTED = "#6B7280";
const BORDER = "#E5E7EB";
const BG = "#F9FAFB";
const { width: W } = Dimensions.get("window");

const SORT_OPTIONS = [
  { key: "recommended", label: "Recommended" },
  { key: "price_asc", label: "Price ↑" },
  { key: "price_desc", label: "Price ↓" },
];

// Sort map: UI label → API param (API has price_asc/price_desc inverted)
const SORT_MAP: Record<string, string> = {
  recommended: "recommended",
  price_asc: "price_desc",
  price_desc: "price_asc",
};

// ── Types ─────────────────────────────────────────────────────────────────────
interface Listing {
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
  starRating: number | null;
  isAccredited: boolean;
  bedrooms: number | null;
  bathrooms: number | null;
  maxGuests: number | null;
  carMake: string | null;
  carModel: string | null;
  carYear: number | null;
  transmission: string | null;
  seats: number | null;
  isFavourited?: boolean;
  cancellationPolicy?: string;
  longStayDiscountEnabled?: boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function matchesKeyword(item: Listing, kw: string): boolean {
  const q = kw.toLowerCase();
  return (
    (item.title ?? "").toLowerCase().includes(q) ||
    (item.city ?? "").toLowerCase().includes(q) ||
    (item.countryCode ?? "").toLowerCase().includes(q) ||
    (item.carMake ?? "").toLowerCase().includes(q) ||
    (item.carModel ?? "").toLowerCase().includes(q)
  );
}

function fmtPrice(n: number | null, currency: string): string {
  if (!n) return "";
  return `${currency} ${n.toLocaleString()}`;
}

// ── Category Badge ────────────────────────────────────────────────────────────
function CategoryBadge({ type }: { type: string }) {
  const label = type === "hotel" ? "🏨 Hotel" : type === "apartment" ? "🏠 Apartment" : "🚗 Car";
  const bg = type === "hotel" ? "#EFF6FF" : type === "apartment" ? "#F0FDF4" : "#FFF7ED";
  const color = type === "hotel" ? "#1D4ED8" : type === "apartment" ? "#15803D" : "#C2410C";
  return (
    <View style={[badge.wrap, { backgroundColor: bg, borderColor: color + "40" }]}>
      <Text style={[badge.text, { color }]}>{label}</Text>
    </View>
  );
}
const badge = StyleSheet.create({
  wrap: { borderRadius: 6, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3, alignSelf: "flex-start", marginBottom: 6 },
  text: { fontSize: 11, fontWeight: "700" },
});

// ── Listing Card ──────────────────────────────────────────────────────────────
function ListingCard({ item, apiCategory, onPress }: {
  item: Listing; apiCategory: string; onPress: () => void;
}) {
  const [imgErr, setImgErr] = useState(false);
  const isCar = apiCategory === "car";
  const price = isCar ? item.dailyRate : item.nightlyRate;
  const unit = isCar ? "/day" : "/night";

  return (
    <TouchableOpacity style={card.wrap} onPress={onPress} activeOpacity={0.88}>
      {/* Photo */}
      <View style={card.photoWrap}>
        {!imgErr && item.primaryPhotoUrl ? (
          <ListingImage uri={item.primaryPhotoUrl} style={card.photo} onError={() => setImgErr(true)} />
        ) : (
          <View style={[card.photo, card.photoFallback]}>
            <Text style={{ fontSize: 32 }}>{isCar ? "🚗" : apiCategory === "apartment" ? "🏠" : "🏨"}</Text>
          </View>
        )}
        {item.isAccredited && (
          <View style={card.accreditedBadge}>
            <Ionicons name="checkmark-circle" size={10} color="#fff" />
            <Text style={card.accreditedText}> Verified</Text>
          </View>
        )}
        {item.starRating != null && item.starRating > 0 && (
          <View style={card.starBadge}>
            <Ionicons name="star" size={10} color="#F59E0B" />
            <Text style={card.starText}> {item.starRating}</Text>
          </View>
        )}
      </View>

      {/* Body */}
      <View style={card.body}>
        <CategoryBadge type={item.listingType} />
        <Text style={card.title} numberOfLines={2}>{item.title}</Text>

        <View style={card.locRow}>
          <Ionicons name="location-outline" size={12} color={MUTED} />
          <Text style={card.loc} numberOfLines={1}>
            {item.city}{item.countryCode ? `, ${item.countryCode}` : ""}
          </Text>
        </View>

        {/* Category-specific details */}
        {apiCategory === "car" && (item.carMake || item.carModel) && (
          <Text style={card.detail}>
            {[item.carMake, item.carModel, item.carYear].filter(Boolean).join(" ")}
            {item.transmission ? ` · ${item.transmission}` : ""}
            {item.seats ? ` · ${item.seats} seats` : ""}
          </Text>
        )}
        {apiCategory === "apartment" && item.bedrooms != null && (
          <Text style={card.detail}>
            {item.bedrooms} bed · {item.bathrooms} bath
            {item.maxGuests ? ` · up to ${item.maxGuests} guests` : ""}
          </Text>
        )}

        <View style={card.footer}>
          {price != null ? (
            <Text style={card.price}>
              <Text style={card.currency}>{item.currency} </Text>
              {price.toLocaleString()}
              <Text style={card.unit}>{unit}</Text>
            </Text>
          ) : (
            <Text style={card.noPrice}>Price on request</Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const card = StyleSheet.create({
  wrap: {
    backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: BORDER,
    marginBottom: 14, overflow: "hidden",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  photoWrap: { position: "relative" },
  photo: { width: "100%", height: 200 },
  photoFallback: { backgroundColor: "#E5F3E6", alignItems: "center", justifyContent: "center" },
  accreditedBadge: {
    position: "absolute", top: 10, left: 10, backgroundColor: GREEN,
    borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4,
    flexDirection: "row", alignItems: "center",
  },
  accreditedText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  starBadge: {
    position: "absolute", top: 10, right: 10, backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 10, paddingHorizontal: 7, paddingVertical: 4,
    flexDirection: "row", alignItems: "center",
  },
  starText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  body: { padding: 14 },
  title: { fontSize: 15, fontWeight: "700", color: TEXT, marginBottom: 5 },
  locRow: { flexDirection: "row", alignItems: "center", gap: 3, marginBottom: 5 },
  loc: { fontSize: 13, color: MUTED, flex: 1 },
  detail: { fontSize: 13, color: MUTED, marginBottom: 6 },
  footer: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  price: { fontSize: 16, fontWeight: "800", color: TEXT },
  currency: { fontSize: 12, fontWeight: "600", color: GREEN },
  unit: { fontSize: 12, fontWeight: "400", color: MUTED },
  noPrice: { fontSize: 13, color: MUTED, fontStyle: "italic" },
});

// ── Skeleton ──────────────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <View style={[card.wrap, { overflow: "hidden" }]}>
      <View style={[card.photo, { backgroundColor: "#E5E7EB" }]} />
      <View style={{ padding: 14, gap: 8 }}>
        <View style={{ height: 13, width: "40%", backgroundColor: "#E5E7EB", borderRadius: 4 }} />
        <View style={{ height: 15, width: "80%", backgroundColor: "#E5E7EB", borderRadius: 4 }} />
        <View style={{ height: 13, width: "55%", backgroundColor: "#E5E7EB", borderRadius: 4 }} />
        <View style={{ height: 16, width: "35%", backgroundColor: "#E5E7EB", borderRadius: 4 }} />
      </View>
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function BrowseCategoryScreen() {
  const router = useRouter();
  const { category } = useLocalSearchParams<{ category: string }>();
  const user = useAuthStore((s) => s.user);

  // Map URL segment to API category value
  const apiCategory = category === "apartments" ? "apartment" : category === "cars" ? "car" : "hotel";
  const screenTitle = category === "apartments" ? "All Apartments" : category === "cars" ? "All Cars" : "All Hotels";
  const icon = category === "cars" ? "🚗" : category === "apartments" ? "🏠" : "🏨";

  const [keyword, setKeyword] = useState("");
  const [sort, setSort] = useState<string>("recommended");
  const [cursor, setCursor] = useState(0);
  const [allResults, setAllResults] = useState<Listing[]>([]);
  const [favouriteLoading, setFavouriteLoading] = useState<string | null>(null);

  const { data, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: ["browse", apiCategory, sort, cursor],
    queryFn: async () => {
      const qp = new URLSearchParams({
        category: apiCategory,
        lat: "0",
        lng: "0",
        radius_km: "20000",
        sort: SORT_MAP[sort] ?? "recommended",
        limit: "50",  // Max allowed — gets all listings in one page for small datasets
      });
      if (cursor > 0) qp.set("cursor", String(cursor));

      const res = await listingApi.get(`/search?${qp.toString()}`);
      const incoming: { totalCount: number; nextCursor: string | null; results: Listing[] } = res.data.data;
      const fresh = (incoming.results ?? []).filter((r) => r.listingType === apiCategory);

      if (cursor === 0) {
        setAllResults(fresh);
      } else {
        setAllResults((prev) => {
          const seen = new Set(prev.map((r) => r.id));
          return [...prev, ...fresh.filter((r) => !seen.has(r.id))];
        });
      }
      return incoming;
    },
    staleTime: 30_000,
  });

  // Client-side keyword filter — applied to all loaded results
  const displayResults = keyword.trim()
    ? allResults.filter((r) => matchesKeyword(r, keyword))
    : allResults;

  const totalFromApi = data?.totalCount ?? 0;
  const hasNextPage = !!data?.nextCursor;
  const isLoadingMore = isFetching && cursor > 0;
  const isFirstLoad = isLoading && cursor === 0;

  function handleSortChange(newSort: string) {
    if (newSort === sort) return;
    setSort(newSort);
    setCursor(0);
    setAllResults([]);
  }

  function handleLoadMore() {
    if (hasNextPage && !isFetching) {
      const nextOffset = cursor + 50;
      setCursor(nextOffset);
    }
  }

  const handleFavouriteToggle = useCallback(async (id: string, current: boolean) => {
    setFavouriteLoading(id);
    try {
      if (current) {
        await listingApi.delete(`/guests/me/favourites/${id}`);
      } else {
        await listingApi.post("/guests/me/favourites", { listingId: id });
      }
      setAllResults((prev) => prev.map((r) => r.id === id ? { ...r, isFavourited: !current } : r));
    } catch { /* silent */ } finally {
      setFavouriteLoading(null);
    }
  }, []);

  function navToListing(id: string) {
    router.push({ pathname: `/listing/${id}` as any });
  }

  return (
    <SafeAreaView style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={24} color={TEXT} />
        </TouchableOpacity>
        <View style={s.headerTitleWrap}>
          <Text style={s.headerTitle}>{icon} {screenTitle}</Text>
          {!isFirstLoad && (
            <Text style={s.headerCount}>
              {keyword.trim() ? `${displayResults.length} matching` : `${totalFromApi} listings`}
            </Text>
          )}
        </View>
      </View>

      {/* Search bar */}
      <View style={s.searchBar}>
        <Ionicons name="search" size={18} color={MUTED} style={{ marginRight: 8 }} />
        <TextInput
          style={s.searchInput}
          placeholder={`Search ${screenTitle.toLowerCase()}…`}
          placeholderTextColor={MUTED}
          value={keyword}
          onChangeText={setKeyword}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        {keyword.length > 0 && (
          <TouchableOpacity onPress={() => setKeyword("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={18} color={MUTED} />
          </TouchableOpacity>
        )}
      </View>

      {/* Sort bar */}
      <View style={s.sortRow}>
        {SORT_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.key}
            style={[s.sortChip, sort === opt.key && s.sortChipActive]}
            onPress={() => handleSortChange(opt.key)}
          >
            <Text style={[s.sortChipText, sort === opt.key && s.sortChipTextActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Error */}
      {isError && (
        <View style={s.center}>
          <Ionicons name="wifi-outline" size={48} color={BORDER} />
          <Text style={s.errTitle}>Failed to load listings</Text>
          <Text style={s.errSub}>Please check your connection and try again.</Text>
          <TouchableOpacity style={s.retryBtn} onPress={() => { setCursor(0); setAllResults([]); void refetch(); }}>
            <Text style={s.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* First load skeletons */}
      {isFirstLoad && !isError && (
        <FlatList
          data={Array.from({ length: 5 })}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={s.list}
          renderItem={() => <Skeleton />}
        />
      )}

      {/* Results */}
      {!isFirstLoad && !isError && (
        <FlatList
          data={displayResults}
          keyExtractor={(item) => item.id}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <ListingCard
              item={item}
              apiCategory={apiCategory}
              onPress={() => navToListing(item.id)}
            />
          )}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={{ fontSize: 40, marginBottom: 12 }}>{icon}</Text>
              <Text style={s.emptyTitle}>
                {keyword.trim() ? `No ${screenTitle.toLowerCase()} matching "${keyword}"` : `No ${screenTitle.toLowerCase()} found`}
              </Text>
              {keyword.trim() && (
                <TouchableOpacity onPress={() => setKeyword("")} style={s.clearBtn}>
                  <Text style={s.clearBtnText}>Clear search</Text>
                </TouchableOpacity>
              )}
            </View>
          }
          ListFooterComponent={
            displayResults.length > 0 ? (
              <View style={s.footer}>
                {isLoadingMore && <ActivityIndicator size="small" color={GREEN} />}
                {hasNextPage && !isLoadingMore && !keyword.trim() && (
                  <TouchableOpacity style={s.loadMore} onPress={handleLoadMore}>
                    <Text style={s.loadMoreText}>Load more</Text>
                  </TouchableOpacity>
                )}
                {!hasNextPage && displayResults.length > 0 && (
                  <Text style={s.endText}>All {screenTitle.toLowerCase()} loaded</Text>
                )}
              </View>
            ) : null
          }
          onEndReached={!keyword.trim() ? handleLoadMore : undefined}
          onEndReachedThreshold={0.3}
        />
      )}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },

  header: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#fff", paddingHorizontal: 12, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  backBtn: { padding: 6, marginRight: 8 },
  headerTitleWrap: { flex: 1 },
  headerTitle: { fontSize: 17, fontWeight: "800", color: TEXT },
  headerCount: { fontSize: 12, color: MUTED, marginTop: 2 },

  searchBar: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#fff", marginHorizontal: 16, marginVertical: 10,
    borderRadius: 12, borderWidth: 1.5, borderColor: BORDER,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 14, color: TEXT },

  sortRow: {
    flexDirection: "row", paddingHorizontal: 16, paddingBottom: 10, gap: 8,
    backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: BORDER,
  },
  sortChip: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1.5, borderColor: BORDER, backgroundColor: "#fff",
  },
  sortChipActive: { borderColor: GREEN, backgroundColor: "#F0FFF4" },
  sortChipText: { fontSize: 13, color: MUTED, fontWeight: "500" },
  sortChipTextActive: { color: GREEN, fontWeight: "700" },

  list: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 32 },

  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  errTitle: { fontSize: 18, fontWeight: "700", color: TEXT, marginTop: 16, textAlign: "center" },
  errSub: { fontSize: 14, color: MUTED, marginTop: 8, textAlign: "center", lineHeight: 20 },
  retryBtn: { backgroundColor: GREEN, borderRadius: 12, paddingVertical: 13, paddingHorizontal: 32, marginTop: 20 },
  retryText: { color: "#fff", fontWeight: "700", fontSize: 15 },

  empty: { alignItems: "center", paddingTop: 60 },
  emptyTitle: { fontSize: 16, fontWeight: "600", color: MUTED, textAlign: "center" },
  clearBtn: { marginTop: 16, paddingVertical: 10, paddingHorizontal: 24, borderRadius: 20, borderWidth: 1.5, borderColor: GREEN },
  clearBtnText: { color: GREEN, fontWeight: "700", fontSize: 14 },

  footer: { alignItems: "center", paddingVertical: 16 },
  loadMore: { borderWidth: 1.5, borderColor: GREEN, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 36 },
  loadMoreText: { color: GREEN, fontWeight: "700", fontSize: 15 },
  endText: { fontSize: 13, color: MUTED },
});
