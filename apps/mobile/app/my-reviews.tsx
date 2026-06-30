import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { listingApi } from "../lib/listing-api";
import { K } from "../constants/theme";

// ── Types ─────────────────────────────────────────────────────────────────────

interface MyReview {
  id: string;
  listingId: string;
  listingTitle: string;
  listingType: string;
  bookingId?: string;
  rating: number;
  comment?: string | null;
  createdAt: string;
  reply?: {
    body: string;
    repliedAt: string;
  } | null;
}

interface MyReviewsResponse {
  reviews: MyReview[];
  total: number;
}

// ── Data fetching ─────────────────────────────────────────────────────────────

function useMyReviews() {
  return useQuery<MyReviewsResponse>({
    queryKey: ["reviews", "me"],
    queryFn: async () => {
      const res = await listingApi.get<{ data: MyReviewsResponse }>("/reviews/me");
      return res.data.data;
    },
    staleTime: 60_000,
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function StarRow({ rating }: { rating: number }) {
  return (
    <View style={sr.row}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Ionicons
          key={n}
          name={n <= rating ? "star" : "star-outline"}
          size={14}
          color={n <= rating ? K.colors.gold : K.colors.border}
        />
      ))}
    </View>
  );
}

const sr = StyleSheet.create({
  row: { flexDirection: "row", gap: 2 },
});

// ── Review Card ───────────────────────────────────────────────────────────────

function ReviewCard({ item }: { item: MyReview }) {
  const listingIcon =
    item.listingType === "car"
      ? "car-sport-outline"
      : item.listingType === "apartment"
      ? "home-outline"
      : "business-outline";

  return (
    <View style={rc.card}>
      {/* Listing info */}
      <TouchableOpacity
        style={rc.listingRow}
        onPress={() => router.push(`/listing/${item.listingId}` as any)}
        activeOpacity={0.75}
      >
        <View style={rc.listingIcon}>
          <Ionicons name={listingIcon as any} size={18} color={K.colors.darkGreen} />
        </View>
        <View style={rc.listingText}>
          <Text style={rc.listingTitle} numberOfLines={1}>{item.listingTitle}</Text>
          <Text style={rc.listingDate}>{fmtDate(item.createdAt)}</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={K.colors.textMuted} />
      </TouchableOpacity>

      {/* Rating + comment */}
      <View style={rc.reviewBody}>
        <StarRow rating={item.rating} />
        {item.comment ? (
          <Text style={rc.comment}>{item.comment}</Text>
        ) : (
          <Text style={rc.noComment}>No comment</Text>
        )}
      </View>

      {/* Host reply */}
      {item.reply ? (
        <View style={rc.reply}>
          <View style={rc.replyHeader}>
            <Ionicons name="return-down-forward-outline" size={14} color={K.colors.accent} />
            <Text style={rc.replyLabel}>Host replied · {fmtDate(item.reply.repliedAt)}</Text>
          </View>
          <Text style={rc.replyBody}>{item.reply.body}</Text>
        </View>
      ) : null}
    </View>
  );
}

const rc = StyleSheet.create({
  card: {
    backgroundColor: K.colors.bgCard,
    borderRadius: K.radius.card,
    borderWidth: 1,
    borderColor: K.colors.border,
    overflow: "hidden",
    ...K.shadow.xs,
  },
  listingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: K.colors.border,
    gap: 10,
  },
  listingIcon: {
    width: 36,
    height: 36,
    borderRadius: K.radius.full,
    backgroundColor: K.colors.bgTint,
    alignItems: "center",
    justifyContent: "center",
  },
  listingText:  { flex: 1 },
  listingTitle: { fontSize: K.font.base, fontWeight: "700", color: K.colors.textDark },
  listingDate:  { fontSize: 11, color: K.colors.textMuted, marginTop: 2 },

  reviewBody: { padding: 14, gap: 8 },
  comment:    { fontSize: K.font.sm, color: K.colors.textMid, lineHeight: 20 },
  noComment:  { fontSize: K.font.sm, color: K.colors.textMuted, fontStyle: "italic" },

  reply: {
    marginHorizontal: 14,
    marginBottom: 14,
    backgroundColor: K.colors.bgSubtle,
    borderRadius: K.radius.md,
    padding: 12,
  },
  replyHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  replyLabel:  { fontSize: 11, fontWeight: "600", color: K.colors.accent },
  replyBody:   { fontSize: K.font.sm, color: K.colors.textMid, lineHeight: 20 },
});

// ── Screen ────────────────────────────────────────────────────────────────────

export default function MyReviewsScreen() {
  const { data, isLoading, isError, refetch, isFetching } = useMyReviews();
  const reviews = data?.reviews ?? [];

  return (
    <SafeAreaView style={s.container} edges={["top"]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={K.colors.textDark} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>My Reviews</Text>
        <View style={{ width: 36 }} />
      </View>

      {isLoading ? (
        <View style={s.centered}>
          <ActivityIndicator color={K.colors.accent} size="large" />
        </View>
      ) : isError ? (
        <View style={s.centered}>
          <Ionicons name="warning-outline" size={40} color={K.colors.textMuted} />
          <Text style={s.errorText}>Failed to load reviews</Text>
          <TouchableOpacity style={s.retryBtn} onPress={() => refetch()}>
            <Text style={s.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : reviews.length === 0 ? (
        <View style={s.centered}>
          <View style={s.emptyIcon}>
            <Ionicons name="star-outline" size={40} color={K.colors.textMuted} />
          </View>
          <Text style={s.emptyTitle}>No reviews yet</Text>
          <Text style={s.emptySubtitle}>
            After completing a stay or rental, you can leave a review from your trip details
          </Text>
        </View>
      ) : (
        <FlatList
          data={reviews}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ReviewCard item={item} />}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isFetching && !isLoading}
              onRefresh={refetch}
              tintColor={K.colors.accent}
            />
          }
          ListHeaderComponent={
            <Text style={s.totalLabel}>{data?.total ?? 0} review{(data?.total ?? 0) !== 1 ? "s" : ""}</Text>
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
    paddingHorizontal: K.spacing.screen,
    paddingVertical: 12,
    backgroundColor: K.colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: K.colors.border,
    justifyContent: "space-between",
  },
  backBtn:     { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: K.font.lg, fontWeight: "800", color: K.colors.textDark },

  centered: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },

  errorText: { fontSize: K.font.sm, color: K.colors.textMuted, marginTop: 12, textAlign: "center" },
  retryBtn:  { marginTop: 14, backgroundColor: K.colors.accent, borderRadius: K.radius.button, paddingHorizontal: 28, paddingVertical: 12 },
  retryText: { color: "#fff", fontWeight: "700", fontSize: K.font.base },

  emptyIcon: {
    width: 88,
    height: 88,
    borderRadius: K.radius.full,
    backgroundColor: K.colors.bgSubtle,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  emptyTitle:    { fontSize: K.font.lg, fontWeight: "700", color: K.colors.textDark, marginBottom: 8 },
  emptySubtitle: { fontSize: K.font.sm, color: K.colors.textMuted, textAlign: "center", lineHeight: 20 },

  listContent: { padding: K.spacing.screen, paddingBottom: 40 },
  totalLabel:  { fontSize: K.font.sm, color: K.colors.textMuted, marginBottom: 16, fontWeight: "500" },
});
