import { useState } from "react";
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
  data: {
    favourites: Favourite[];
    nextCursor: string | null;
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function daysAgo(dateStr: string): string {
  try {
    const saved = new Date(dateStr).getTime();
    const now = Date.now();
    const diff = Math.floor((now - saved) / (1000 * 60 * 60 * 24));
    if (diff === 0) return "today";
    if (diff === 1) return "1 day ago";
    return `${diff} days ago`;
  } catch {
    return "";
  }
}

function categoryLabel(cat: string): string {
  return cat.charAt(0).toUpperCase() + cat.slice(1);
}

// ── Skeleton card ─────────────────────────────────────────────────────────────


// ── Skeleton card ─────────────────────────────────────────────────────────────


function SkeletonCard() {
  return (
    <View style={styles.card}>
      <View style={styles.skeletonPhoto} />
      <View style={styles.skeletonContent}>
        <View style={[styles.skeletonLine, { width: "70%", height: 16 }]} />
        <View style={[styles.skeletonLine, { width: "50%", height: 13, marginTop: 8 }]} />
        <View style={[styles.skeletonLine, { width: "40%", height: 15, marginTop: 8 }]} />
        <View style={[styles.skeletonLine, { width: "35%", height: 12, marginTop: 6 }]} />
      </View>
    </View>
  );
}

// ── Saved Listing Card ────────────────────────────────────────────────────────

function SavedListingCard({
  item,
  onRemove,
  removePending,
}: {
  item: Favourite;
  onRemove: (listingId: string, title: string) => void;
  removePending: boolean;
}) {
  const router = useRouter();
  const [imgError, setImgError] = useState(false);
  const { listing, savedAt, listingId } = item;
  const locationParts = [listing.city, listing.countryCode].filter(Boolean);
  const locationStr = locationParts.join(", ");
  const priceLabel = listing.nightlyRate != null
    ? `${listing.currency ?? ""} ${listing.nightlyRate.toLocaleString()} / ${listing.category === "car" ? "day" : "night"}`
    : "Price on request";

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.8}
      onPress={() => router.push(`/listing/${listingId}`)}
    >
      {/* Cover photo */}
      {!imgError && listing.primaryPhotoUrl ? (
        <ListingImage
          uri={listing.primaryPhotoUrl}
          style={styles.cardPhoto}
          resizeMode="cover"
          onError={() => setImgError(true)}
        />
      ) : (
        <View style={styles.cardPhotoPlaceholder}>
          <Ionicons name="image-outline" size={28} color={K.colors.textSubtle} />
        </View>
      )}

      {/* Info */}
      <View style={styles.cardInfo}>
        <Text style={styles.cardTitle} numberOfLines={2}>{listing.title}</Text>
        <Text style={styles.cardMeta} numberOfLines={1}>
          {categoryLabel(listing.category)}{locationStr ? ` · ${locationStr}` : ""}
        </Text>
        <Text style={styles.cardPrice}>{priceLabel}</Text>
        <Text style={styles.cardSaved}>Saved {daysAgo(savedAt)}</Text>
      </View>

      {/* Trash button */}
      <TouchableOpacity
        style={styles.trashButton}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        onPress={() => onRemove(listingId, listing.title)}
        disabled={removePending}
      >
        <Ionicons name="trash-outline" size={20} color={K.colors.error} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function SavedScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);

  const [cursor, setCursor] = useState<string | null>(null);
  const [allFavourites, setAllFavourites] = useState<Favourite[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);

  // Provider guard
  if (user?.userType === "provider") {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Saved</Text>
        </View>
        <View style={styles.emptyContainer}>
          <Ionicons name="information-circle-outline" size={56} color={K.colors.textSubtle} />
          <Text style={styles.emptyTitle}>Not available</Text>
          <Text style={styles.emptySubtitle}>
            Favourites are available for traveller accounts.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Data fetching ────────────────────────────────────────────────────────

  const { data, isLoading, refetch, isRefetching } = useQuery<FavouritesResponse>({
    queryKey: ["favourites"],
    queryFn: async () => {
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
      setAllFavourites((prev) => [...prev, ...res.data.data.favourites]);
      setCursor(res.data.data.nextCursor);
    } catch {
      Alert.alert("Error", "Could not load more saved listings.");
    } finally {
      setLoadingMore(false);
    }
  }

  // ── Remove favourite ─────────────────────────────────────────────────────

  const removeMutation = useMutation({
    mutationFn: async (listingId: string) => {
      await listingApi.delete(`/guests/me/favourites/${listingId}`);
    },
    onMutate: async (listingId) => {
      // Optimistic remove
      setAllFavourites((prev) => prev.filter((f) => f.listingId !== listingId));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["favourites"] });
    },
    onError: () => {
      Alert.alert("Error", "Could not remove saved listing. Please try again.");
      // Re-fetch to restore correct state
      refetch();
    },
  });

  function handleRemove(listingId: string, title: string) {
    Alert.alert(
      "Remove from Saved",
      `Remove "${title}" from your saved listings?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => removeMutation.mutate(listingId),
        },
      ]
    );
  }

  // ── Render item ──────────────────────────────────────────────────────────

  function renderItem({ item }: { item: Favourite }) {
    return (
      <SavedListingCard
        item={item}
        onRemove={handleRemove}
        removePending={removeMutation.isPending}
      />
    );
  }

  // ── Loading state ────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Saved</Text>
        </View>
        {[1, 2, 3].map((k) => <SkeletonCard key={k} />)}
      </SafeAreaView>
    );
  }

  const favourites = allFavourites;
  const isEmpty = favourites.length === 0;

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={favourites}
        keyExtractor={(item) => item.listingId}
        renderItem={renderItem}
        contentContainerStyle={isEmpty ? styles.emptyListContent : styles.listContent}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={K.colors.accent} />
        }
        ListHeaderComponent={
          <View style={styles.headerRow}>
            <Text style={styles.headerTitle}>Saved</Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="heart-outline" size={64} color={K.colors.borderMid} />
            <Text style={styles.emptyTitle}>No saved listings yet</Text>
            <Text style={styles.emptySubtitle}>
              Start exploring to save listings you love.
            </Text>
            <TouchableOpacity
              style={styles.exploreBtn}
              onPress={() => router.replace("/(tabs)")}
            >
              <Text style={styles.exploreBtnText}>Explore</Text>
            </TouchableOpacity>
          </View>
        }
        ListFooterComponent={
          cursor ? (
            <TouchableOpacity
              style={styles.loadMoreBtn}
              onPress={loadMore}
              disabled={loadingMore}
            >
              {loadingMore ? (
                <ActivityIndicator size="small" color={K.colors.accent} />
              ) : (
                <Text style={styles.loadMoreText}>Load more</Text>
              )}
            </TouchableOpacity>
          ) : null
        }
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: K.colors.bgSubtle },

  headerRow: {
    paddingHorizontal: K.spacing.xl,
    paddingTop: K.spacing.sm,
    paddingBottom: K.spacing.md,
    backgroundColor: K.colors.bgSubtle,
  },
  headerTitle: { fontSize: K.font.xxl + 2, fontWeight: "700", color: K.colors.textDark },

  listContent: { paddingHorizontal: K.spacing.lg, paddingBottom: K.spacing.xxxl },
  emptyListContent: { flex: 1, paddingHorizontal: K.spacing.lg },

  // Card
  card: {
    flexDirection: "row",
    backgroundColor: K.colors.bgCard,
    borderRadius: K.radius.lg,
    marginBottom: K.spacing.md,
    borderWidth: 1,
    borderColor: K.colors.border,
    overflow: "hidden",
    alignItems: "center",
    paddingRight: K.spacing.md,
    ...K.shadow.sm,
  },
  cardPhoto: { width: 90, height: 90 },
  cardPhotoPlaceholder: {
    width: 90,
    height: 90,
    backgroundColor: K.colors.bgSection,
    alignItems: "center",
    justifyContent: "center",
  },
  cardInfo: { flex: 1, paddingHorizontal: K.spacing.md, paddingVertical: K.spacing.sm + 2 },
  cardTitle: { fontSize: K.font.sm + 1, fontWeight: "600", color: K.colors.textDark, marginBottom: 3, lineHeight: 20 },
  cardMeta: { fontSize: K.font.xs, color: K.colors.textMuted, marginBottom: 4 },
  cardPrice: { fontSize: K.font.sm + 1, fontWeight: "700", color: K.colors.textDark, marginBottom: 2 },
  cardSaved: { fontSize: K.font.xs, color: K.colors.textSubtle },
  trashButton: { paddingLeft: K.spacing.sm },

  // Empty state
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: K.spacing.xxxl,
    paddingTop: 60,
  },
  emptyTitle: { fontSize: K.font.lg + 1, fontWeight: "700", color: K.colors.textDark, marginTop: K.spacing.lg, marginBottom: K.spacing.sm },
  emptySubtitle: { fontSize: K.font.sm + 1, color: K.colors.textMuted, textAlign: "center", lineHeight: 20, marginBottom: K.spacing.xxl },
  exploreBtn: {
    backgroundColor: K.colors.accent,
    borderRadius: K.radius.md,
    paddingHorizontal: K.spacing.xxxl,
    paddingVertical: K.spacing.md + 1,
  },
  exploreBtnText: { color: K.colors.textLight, fontWeight: "700", fontSize: K.font.base },

  // Load more
  loadMoreBtn: {
    alignItems: "center",
    paddingVertical: K.spacing.lg,
    marginTop: K.spacing.xs,
    marginBottom: K.spacing.xxl,
  },
  loadMoreText: { color: K.colors.accent, fontWeight: "600", fontSize: K.font.sm + 1 },

  // Skeleton
  skeletonPhoto: { width: 90, height: 90, backgroundColor: K.colors.bgSection },
  skeletonContent: { flex: 1, paddingHorizontal: K.spacing.md, paddingVertical: K.spacing.md },
  skeletonLine: { backgroundColor: K.colors.bgSection, borderRadius: K.radius.xs },
});
