import { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ScrollView,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useQueries } from "@tanstack/react-query";
import { useAuthStore } from "../../store/auth";
import { useConversations } from "../../hooks/messaging";
import { listingApi } from "../../lib/listing-api";
import ConversationCard, { ConversationCardSkeleton } from "../../components/messaging/ConversationCard";
import { K } from "../../constants/theme";
import type { ListingBasics } from "../../hooks/messaging";
import { INACTIVE_LISTING } from "../../hooks/messaging";

// ── Filter chips ──────────────────────────────────────────────────────────────

type ChipKey = "all" | "unread" | "hotels" | "apartments" | "cars";

const CHIPS: { key: ChipKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "hotels", label: "Hotels" },
  { key: "apartments", label: "Homes" },
  { key: "cars", label: "Cars" },
];

// ── Shimmer ───────────────────────────────────────────────────────────────────

function useShimmer() {
  const opacity = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.85, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return opacity;
}

function ShimmerList() {
  const opacity = useShimmer();
  return (
    <View style={s.listContent}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Animated.View key={i} style={[{ opacity }, i > 0 && { marginTop: 10 }]}>
          <ConversationCardSkeleton />
        </Animated.View>
      ))}
    </View>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ hasFilter }: { hasFilter: boolean }) {
  return (
    <View style={s.emptyWrap}>
      <View style={s.emptyIcon}>
        <Ionicons name="chatbubbles-outline" size={40} color={K.colors.textMuted} />
      </View>
      <Text style={s.emptyTitle}>
        {hasFilter ? "No matches found" : "No conversations yet"}
      </Text>
      <Text style={s.emptySubtitle}>
        {hasFilter
          ? "Try a different filter or search term"
          : 'Browse listings and tap "Message Host" to start a conversation'}
      </Text>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function MessagesScreen() {
  const user = useAuthStore((s) => s.user);
  const currentUserId = user?.id ?? "";
  const { data, isLoading, isError, refetch, isFetching } = useConversations();
  const conversations = data?.conversations ?? [];

  const [search, setSearch] = useState("");
  const [activeChip, setActiveChip] = useState<ChipKey>("all");

  // Parallel-fetch listing basics for every conversation
  const listingQueries = useQueries({
    queries: conversations.map((c) => ({
      queryKey: ["listing-basics", c.listingId ?? ""],
      queryFn: async (): Promise<ListingBasics | null> => {
        if (!c.listingId) return null;
        try {
          const res = await listingApi.get<{
            data: { name: string | null; photos: { cdnUrl: string; position: number }[]; category: string };
          }>(`/listings/${c.listingId}/public`);
          const d = res.data.data;
          const sorted = [...d.photos].sort((a, b) => a.position - b.position);
          return { name: d.name, photoUrl: sorted[0]?.cdnUrl ?? null, category: d.category, isInactive: false };
        } catch (err: any) {
          if (err?.response?.status === 410) return INACTIVE_LISTING;
          throw err;
        }
      },
      enabled: !!c.listingId,
      staleTime: 5 * 60_000,
      retry: (failCount: number, err: any) => err?.response?.status !== 410 && failCount < 1,
    })),
  });

  // Enrich each conversation with its listing data
  const enriched = conversations.map((c, i) => ({
    ...c,
    listing: (listingQueries[i]?.data ?? null) as ListingBasics | null,
    isLoadingListing: listingQueries[i]?.isLoading ?? false,
  }));

  // Client-side filter
  const filtered = enriched.filter((c) => {
    if (activeChip === "hotels" && c.listing?.category !== "hotel") return false;
    if (activeChip === "apartments" && c.listing?.category !== "apartment") return false;
    if (activeChip === "cars" && c.listing?.category !== "car") return false;
    if (activeChip === "unread" && !(c.lastMessage && c.lastMessage.senderId !== currentUserId)) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const name = c.listing?.name?.toLowerCase() ?? "";
      if (!name.includes(q)) return false;
    }
    return true;
  });

  return (
    <SafeAreaView style={s.container} edges={["top"]}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Messages</Text>
      </View>

      {/* Search */}
      <View style={s.searchWrap}>
        <Ionicons name="search" size={16} color={K.colors.textMuted} />
        <TextInput
          style={s.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search conversations, listings, or host"
          placeholderTextColor={K.colors.textMuted}
          clearButtonMode="while-editing"
        />
      </View>

      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={s.chipsScroll}
        contentContainerStyle={s.chipsContent}
      >
        {CHIPS.map((chip) => (
          <TouchableOpacity
            key={chip.key}
            style={[s.chip, activeChip === chip.key && s.chipActive]}
            onPress={() => setActiveChip(chip.key)}
            activeOpacity={0.75}
          >
            <Text style={[s.chipText, activeChip === chip.key && s.chipTextActive]}>
              {chip.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Content */}
      {isLoading ? (
        <ShimmerList />
      ) : isError ? (
        <View style={s.emptyWrap}>
          <View style={s.emptyIcon}>
            <Ionicons name="warning-outline" size={36} color={K.colors.error} />
          </View>
          <Text style={s.emptyTitle}>Something went wrong</Text>
          <TouchableOpacity style={s.retryBtn} onPress={() => refetch()}>
            <Text style={s.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : filtered.length === 0 ? (
        <EmptyState hasFilter={activeChip !== "all" || !!search.trim()} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(c) => c.id}
          renderItem={({ item }) => (
            <ConversationCard
              item={item}
              currentUserId={currentUserId}
              listing={item.listing}
              isLoadingListing={item.isLoadingListing}
            />
          )}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isFetching && !isLoading}
              onRefresh={refetch}
              tintColor={K.colors.accent}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: K.colors.bgApp },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: K.spacing.screen,
    paddingTop: 8,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: K.font.xxxl,
    fontWeight: "800",
    color: K.colors.textDark,
    letterSpacing: -0.6,
  },
  headerActions: { flexDirection: "row", gap: 6 },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: K.radius.full,
    backgroundColor: K.colors.bgSubtle,
    alignItems: "center",
    justifyContent: "center",
  },

  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: K.spacing.screen,
    marginBottom: 14,
    backgroundColor: K.colors.bgCard,
    borderRadius: K.radius.full,
    borderWidth: 1,
    borderColor: K.colors.border,
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 10,
    ...K.shadow.xs,
  },
  searchInput: {
    flex: 1,
    fontSize: K.font.base,
    color: K.colors.textDark,
    padding: 0,
  },

  chipsScroll: { flexGrow: 0, marginBottom: 14 },
  chipsContent: { paddingHorizontal: K.spacing.screen, gap: 8 },
  chip: {
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: K.radius.full,
    backgroundColor: K.colors.bgCard,
    borderWidth: 1,
    borderColor: K.colors.border,
  },
  chipActive: {
    backgroundColor: K.colors.darkGreen,
    borderColor: K.colors.darkGreen,
  },
  chipText: { fontSize: K.font.sm, fontWeight: "600", color: K.colors.textMid },
  chipTextActive: { color: "#fff" },

  listContent: { paddingHorizontal: K.spacing.screen, paddingBottom: 24 },

  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 36,
  },
  emptyIcon: {
    width: 88,
    height: 88,
    borderRadius: K.radius.full,
    backgroundColor: K.colors.bgSubtle,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: K.font.lg,
    fontWeight: "700",
    color: K.colors.textDark,
    marginBottom: 10,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: K.font.sm,
    color: K.colors.textMuted,
    textAlign: "center",
    lineHeight: 21,
  },
  retryBtn: {
    marginTop: 18,
    backgroundColor: K.colors.accent,
    borderRadius: K.radius.button,
    paddingHorizontal: 28,
    paddingVertical: 12,
  },
  retryText: { color: "#fff", fontWeight: "700", fontSize: K.font.base },
});
