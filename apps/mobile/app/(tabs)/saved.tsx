import { useState, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient, useQueries } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { listingApi } from "../../lib/listing-api";
import { useAuthStore } from "../../store/auth";
import { ListingImage } from "../../components/ListingImage";
import { K } from "../../constants/theme";

// ── Types ─────────────────────────────────────────────────────────────────────

interface FavouriteListing {
  id: string;
  title: string;
  category: string;
  status: string;
  city: string | null;
  countryCode: string | null;
  nightlyRate: number | null;
  currency: string | null;
  primaryPhotoUrl: string | null;
}

interface Favourite {
  listingId: string;
  savedAt: string;
  listing: FavouriteListing;
}

interface FavouritesResponse {
  data: { favourites: Favourite[]; nextCursor: string | null };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysAgo(dateStr: string): string {
  try {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
    if (diff === 0) return "today";
    if (diff === 1) return "1 day ago";
    return `${diff} days ago`;
  } catch { return ""; }
}

function priceLabel(listing: FavouriteListing): string {
  if (listing.nightlyRate == null) return "Price on request";
  const unit = listing.category === "car" ? "day" : "night";
  return `${listing.currency ?? ""} ${listing.nightlyRate.toLocaleString()} / ${unit}`;
}

function categoryLabel(cat: string): string {
  return cat.charAt(0).toUpperCase() + cat.slice(1);
}

// ── Skeleton Card ─────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <View style={styles.card}>
      <View style={styles.skeletonPhoto} />
      <View style={styles.cardInfo}>
        <View style={[styles.skeletonLine, { width: "70%", height: 14, marginBottom: 8 }]} />
        <View style={[styles.skeletonLine, { width: "50%", height: 12, marginBottom: 8 }]} />
        <View style={[styles.skeletonLine, { width: "42%", height: 14, marginBottom: 6 }]} />
        <View style={[styles.skeletonLine, { width: "30%", height: 11 }]} />
      </View>
    </View>
  );
}

// ── Saved Listing Card ────────────────────────────────────────────────────────

function SavedCard({ item, onRemove, removePending, signedPhotoUrl }: {
  item: Favourite;
  onRemove: (listingId: string, title: string) => void;
  removePending: boolean;
  signedPhotoUrl: string | null;
}) {
  const router = useRouter();
  const [imgErr, setImgErr] = useState(false);
  const { listing, savedAt, listingId } = item;
  const location = [listing.city, listing.countryCode].filter(Boolean).join(", ");

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.82}
      onPress={() => router.push(`/listing/${listingId}` as any)}
    >
      {/* Cover photo */}
      {!imgErr && signedPhotoUrl ? (
        <ListingImage
          uri={signedPhotoUrl}
          style={styles.cardPhoto}
          resizeMode="cover"
          onError={() => setImgErr(true)}
        />
      ) : (
        <View style={styles.cardPhotoFallback}>
          <Ionicons
            name={listing.category === "car" ? "car-outline" : "business-outline"}
            size={28}
            color={K.colors.textMuted}
          />
        </View>
      )}

      {/* Category pill overlay */}
      <View style={styles.catPill}>
        <Text style={styles.catPillText}>{categoryLabel(listing.category)}</Text>
      </View>

      {/* Info */}
      <View style={styles.cardInfo}>
        <Text style={styles.cardTitle} numberOfLines={2}>{listing.title}</Text>
        {location ? (
          <View style={styles.locRow}>
            <Ionicons name="location-outline" size={11} color={K.colors.textMuted} />
            <Text style={styles.locText} numberOfLines={1}>{location}</Text>
          </View>
        ) : null}
        <Text style={styles.cardPrice}>{priceLabel(listing)}</Text>
        <Text style={styles.cardSaved}>Saved {daysAgo(savedAt)}</Text>
      </View>

      {/* Remove button */}
      <TouchableOpacity
        style={styles.removeBtn}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        onPress={() => onRemove(listingId, listing.title)}
        disabled={removePending}
      >
        <Ionicons name="heart" size={20} color={K.colors.error} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function SavedScreen() {
  const router = useRouter();
  const qc     = useQueryClient();
  const user   = useAuthStore((s) => s.user);

  const [cursor,       setCursor]       = useState<string | null>(null);
  const [allFavourites, setAllFavourites] = useState<Favourite[]>([]);
  const [loadingMore,  setLoadingMore]  = useState(false);

  // Fetch signed photo URLs for each favourite listing — must be before early returns
  const favouriteIds = useMemo(() => allFavourites.map((f) => f.listing.id), [allFavourites]);
  const signedPhotoQueries = useQueries({
    queries: favouriteIds.map((id) => ({
      queryKey: ["public-photo", id],
      queryFn: async (): Promise<string | null> => {
        try {
          const res = await listingApi.get<{
            data: { primaryPhotoUrl?: string | null; photos?: Array<{ cdnUrl: string }> };
          }>(`/listings/${id}/public`);
          return res.data.data?.primaryPhotoUrl ?? res.data.data?.photos?.[0]?.cdnUrl ?? null;
        } catch { return null; }
      },
      staleTime: 5 * 60_000,
      gcTime: 10 * 60_000,
      retry: false,
    })),
  });
  const signedPhotoMap = useMemo<Record<string, string | null>>(
    () => Object.fromEntries(favouriteIds.map((id, i) => [id, signedPhotoQueries[i]?.data ?? null])),
    [favouriteIds, signedPhotoQueries],
  );

  // Provider guard
  if (user?.userType === "provider") {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Saved</Text>
        </View>
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="information-circle-outline" size={32} color={K.colors.textMuted} />
          </View>
          <Text style={styles.emptyTitle}>Not available</Text>
          <Text style={styles.emptySub}>Favourites are for traveller accounts.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const { isLoading, refetch, isRefetching } = useQuery<FavouritesResponse>({
    queryKey: ["favourites"],
    queryFn:  async () => {
      const res = await listingApi.get<FavouritesResponse>("/guests/me/favourites");
      setAllFavourites(res.data.data.favourites);
      setCursor(res.data.data.nextCursor);
      return res.data;
    },
  });

  async function loadMore() {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await listingApi.get<FavouritesResponse>(`/guests/me/favourites?cursor=${cursor}`);
      setAllFavourites(prev => [...prev, ...res.data.data.favourites]);
      setCursor(res.data.data.nextCursor);
    } catch {
      Alert.alert("Error", "Could not load more saved listings.");
    } finally {
      setLoadingMore(false);
    }
  }

  const removeMutation = useMutation({
    mutationFn: async (listingId: string) => {
      await listingApi.delete(`/guests/me/favourites/${listingId}`);
    },
    onMutate: async (listingId) => {
      setAllFavourites(prev => prev.filter(f => f.listingId !== listingId));
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["favourites"] }); },
    onError:   () => {
      Alert.alert("Error", "Could not remove saved listing. Please try again.");
      refetch();
    },
  });

  function handleRemove(listingId: string, title: string) {
    Alert.alert(
      "Remove from Saved",
      `Remove "${title}" from your saved listings?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: () => removeMutation.mutate(listingId) },
      ]
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Saved</Text>
        </View>
        <View style={styles.listContent}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      </SafeAreaView>
    );
  }

  const isEmpty = allFavourites.length === 0;

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={allFavourites}
        keyExtractor={(item) => item.listingId}
        renderItem={({ item }) => (
          <SavedCard
            item={item}
            onRemove={handleRemove}
            removePending={removeMutation.isPending}
            signedPhotoUrl={signedPhotoMap[item.listing.id] ?? null}
          />
        )}
        contentContainerStyle={isEmpty ? styles.emptyListContent : styles.listContent}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={K.colors.accent} />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Saved</Text>
            {!isEmpty && (
              <Text style={styles.headerCount}>{allFavourites.length} listing{allFavourites.length !== 1 ? "s" : ""}</Text>
            )}
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="bookmark-outline" size={32} color={K.colors.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>Nothing saved yet</Text>
            <Text style={styles.emptySub}>
              Tap the bookmark icon on any listing to save it here.
            </Text>
            <TouchableOpacity
              style={styles.exploreBtn}
              onPress={() => router.replace("/(tabs)" as any)}
            >
              <Ionicons name="compass-outline" size={16} color="#fff" />
              <Text style={styles.exploreBtnText}>Explore</Text>
            </TouchableOpacity>
          </View>
        }
        ListFooterComponent={
          cursor ? (
            <TouchableOpacity style={styles.loadMoreBtn} onPress={loadMore} disabled={loadingMore}>
              {loadingMore
                ? <ActivityIndicator size="small" color={K.colors.accent} />
                : <Text style={styles.loadMoreText}>Load more</Text>}
            </TouchableOpacity>
          ) : null
        }
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: K.colors.bgApp },

  header: {
    paddingHorizontal: K.spacing.screen,
    paddingTop: 10,
    paddingBottom: 16,
    backgroundColor: K.colors.bgApp,
    flexDirection: "row",
    alignItems: "baseline",
    gap: 10,
  },
  headerTitle:  { fontSize: K.font.xxl, fontWeight: "800", color: K.colors.textDark, letterSpacing: -0.5 },
  headerCount:  { fontSize: K.font.sm, color: K.colors.textMuted, fontWeight: "500" },

  listContent:      { paddingHorizontal: K.spacing.screen, paddingBottom: 32 },
  emptyListContent: { flex: 1, paddingHorizontal: K.spacing.screen },

  // Saved card
  card: {
    flexDirection: "row",
    backgroundColor: K.colors.bgCard,
    borderRadius: K.radius.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: K.colors.border,
    alignItems: "center",
    ...K.shadow.xs,
  },
  cardPhoto: {
    width: 96,
    height: 104,
  },
  cardPhotoFallback: {
    width: 96,
    height: 104,
    backgroundColor: K.colors.bgSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  catPill: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "rgba(2,70,34,0.80)",
    borderRadius: K.radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  catPillText:  { color: "#fff", fontSize: 10, fontWeight: "700" },
  cardInfo:     { flex: 1, paddingHorizontal: 12, paddingVertical: 12 },
  cardTitle:    { fontSize: K.font.sm, fontWeight: "700", color: K.colors.textDark, marginBottom: 5, lineHeight: 18 },
  locRow:       { flexDirection: "row", alignItems: "center", gap: 3, marginBottom: 6 },
  locText:      { fontSize: 11, color: K.colors.textMuted, flex: 1 },
  cardPrice:    { fontSize: K.font.sm, fontWeight: "700", color: K.colors.darkGreen, marginBottom: 3 },
  cardSaved:    { fontSize: 11, color: K.colors.textMuted },
  removeBtn:    { paddingRight: 14, paddingLeft: 6 },

  // Empty state
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingTop: 40,
    gap: 10,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: K.radius.full,
    backgroundColor: K.colors.bgSubtle,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  emptyTitle: { fontSize: K.font.lg, fontWeight: "700", color: K.colors.textDark },
  emptySub:   { fontSize: K.font.sm, color: K.colors.textMuted, textAlign: "center", lineHeight: 20, marginBottom: 8 },
  exploreBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: K.colors.darkGreen,
    borderRadius: K.radius.button,
    paddingHorizontal: 28,
    paddingVertical: 13,
    marginTop: 6,
    ...K.shadow.brand,
  },
  exploreBtnText: { color: "#fff", fontWeight: "700", fontSize: K.font.base },

  // Load more
  loadMoreBtn:  { alignItems: "center", paddingVertical: 18, marginBottom: 24 },
  loadMoreText: { color: K.colors.accent, fontWeight: "600", fontSize: K.font.sm },

  // Skeleton
  skeletonPhoto: { width: 96, height: 104, backgroundColor: K.colors.bgSubtle },
  skeletonLine:  { backgroundColor: K.colors.bgSubtle, borderRadius: K.radius.sm },
});
