import { useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  Modal,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather, Ionicons } from "@expo/vector-icons";
import { listingApi } from "../../lib/listing-api";
import { K } from "../../constants/theme";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ProviderReply {
  body: string;
  repliedAt: string;
}

interface ReviewItem {
  id: string;
  bookingId?: string;
  listingTitle?: string;
  listingId?: string;
  rating: number;
  title?: string;
  body?: string;
  guestName?: string;
  guestFirstName?: string;
  guestLastName?: string;
  createdAt: string;
  providerReply?: ProviderReply | null;
}

interface ProviderReviewsResponse {
  averageRating: number | null;
  totalReviews: number;
  reviews?: ReviewItem[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function StarRow({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <View style={{ flexDirection: "row", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Ionicons
          key={s}
          name={s <= rating ? "star" : "star-outline"}
          size={size}
          color={s <= rating ? "#FBBF24" : "#D1D5DB"}
        />
      ))}
    </View>
  );
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function guestLabel(r: ReviewItem): string {
  if (r.guestName) return r.guestName;
  if (r.guestFirstName) {
    const init = r.guestLastName?.[0]?.toUpperCase();
    return init ? `${r.guestFirstName} ${init}.` : r.guestFirstName;
  }
  return "Guest";
}

// ── Reply Modal ───────────────────────────────────────────────────────────────

function ReplyModal({
  review,
  visible,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  review: ReviewItem | null;
  visible: boolean;
  onClose: () => void;
  onSubmit: (reviewId: string, body: string) => void;
  isSubmitting: boolean;
}) {
  const [body, setBody] = useState("");

  if (!review) return null;

  function handleSubmit() {
    if (!body.trim()) {
      Alert.alert("Empty Reply", "Please write a reply before submitting.");
      return;
    }
    onSubmit(review!.id, body.trim());
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={rm.overlay}>
          <View style={rm.sheet}>
            <View style={rm.sheetHeader}>
              <Text style={rm.sheetTitle}>Reply to Review</Text>
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Feather name="x" size={20} color={K.colors.textMid} />
              </TouchableOpacity>
            </View>

            {/* Original review context */}
            <View style={rm.reviewCtx}>
              <StarRow rating={review.rating} />
              {review.body ? (
                <Text style={rm.reviewBody} numberOfLines={3}>
                  "{review.body}"
                </Text>
              ) : null}
              <Text style={rm.reviewMeta}>— {guestLabel(review)}</Text>
            </View>

            <Text style={rm.inputLabel}>Your Response ({body.length}/500)</Text>
            <TextInput
              style={rm.input}
              value={body}
              onChangeText={(t) => setBody(t.slice(0, 500))}
              placeholder="Thank the guest, address their feedback, or share something helpful for future guests…"
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={5}
              maxLength={500}
              textAlignVertical="top"
              autoFocus
            />

            <TouchableOpacity
              style={[rm.submitBtn, (!body.trim() || isSubmitting) && rm.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={!body.trim() || isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={rm.submitBtnText}>Post Reply</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const rm = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: Platform.OS === "ios" ? 36 : 20,
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  sheetTitle: { fontSize: 16, fontWeight: "700", color: K.colors.textDark },
  reviewCtx: {
    backgroundColor: K.colors.bgLight,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: K.colors.border,
    gap: 6,
  },
  reviewBody: {
    fontSize: 13,
    color: K.colors.textMid,
    fontStyle: "italic",
    lineHeight: 18,
  },
  reviewMeta: { fontSize: 11, color: K.colors.textMuted, fontWeight: "600" },
  inputLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: K.colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: K.colors.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: K.colors.textDark,
    backgroundColor: K.colors.bgLight,
    minHeight: 120,
    marginBottom: 16,
  },
  submitBtn: {
    backgroundColor: K.colors.darkGreen,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  submitBtnDisabled: { opacity: 0.45 },
  submitBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});

// ── Review Card ───────────────────────────────────────────────────────────────

function ReviewCard({
  review,
  onReply,
}: {
  review: ReviewItem;
  onReply: (r: ReviewItem) => void;
}) {
  const hasReply = !!review.providerReply;

  return (
    <View style={s.card}>
      {/* Rating + date */}
      <View style={s.cardTop}>
        <StarRow rating={review.rating} size={16} />
        <Text style={s.cardDate}>{fmtDate(review.createdAt)}</Text>
      </View>

      {/* Guest + listing */}
      <View style={s.cardMeta}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>
            {(review.guestFirstName ?? review.guestName ?? "G")[0].toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.guestName}>{guestLabel(review)}</Text>
          {review.listingTitle ? (
            <Text style={s.listingName} numberOfLines={1}>{review.listingTitle}</Text>
          ) : null}
        </View>
      </View>

      {/* Review content */}
      {review.title ? <Text style={s.reviewTitle}>"{review.title}"</Text> : null}
      {review.body ? <Text style={s.reviewBody}>{review.body}</Text> : null}

      {/* Existing reply */}
      {hasReply ? (
        <View style={s.replyBox}>
          <View style={s.replyHeader}>
            <Feather name="corner-down-right" size={13} color={K.colors.accent} />
            <Text style={s.replyLabel}>Your Response</Text>
            <Text style={s.replyDate}>{fmtDate(review.providerReply!.repliedAt)}</Text>
          </View>
          <Text style={s.replyBody}>{review.providerReply!.body}</Text>
        </View>
      ) : (
        <TouchableOpacity style={s.replyBtn} onPress={() => onReply(review)} activeOpacity={0.8}>
          <Feather name="message-square" size={14} color={K.colors.accent} />
          <Text style={s.replyBtnText}>Reply to Review</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function ProviderReviewsScreen() {
  const qc = useQueryClient();
  const [selectedReview, setSelectedReview] = useState<ReviewItem | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const { data, isLoading, isError, refetch, isRefetching } = useQuery<ProviderReviewsResponse>({
    queryKey: ["providerReviews"],
    queryFn: async () => {
      const res = await listingApi.get<{ data: ProviderReviewsResponse }>("/provider/reviews", {
        params: { limit: 50 },
      });
      return res.data.data;
    },
  });

  const replyMutation = useMutation({
    mutationFn: async ({ reviewId, body }: { reviewId: string; body: string }) => {
      await listingApi.post(`/reviews/${reviewId}/reply`, { body });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["providerReviews"] });
      void qc.invalidateQueries({ queryKey: ["providerReviewsSnippet"] });
      setModalVisible(false);
      setSelectedReview(null);
      Alert.alert("Reply Posted", "Your response has been published and guests will be able to see it.");
    },
    onError: (err: any) => {
      const message =
        err?.response?.data?.error?.message ??
        err?.message ??
        "Could not post your reply. Please try again.";
      Alert.alert("Reply Failed", message);
    },
  });

  function handleOpenReply(review: ReviewItem) {
    setSelectedReview(review);
    setModalVisible(true);
  }

  function handleCloseReply() {
    if (replyMutation.isPending) return;
    setModalVisible(false);
    setSelectedReview(null);
  }

  function handleSubmitReply(reviewId: string, body: string) {
    replyMutation.mutate({ reviewId, body });
  }

  const reviews = data?.reviews ?? [];
  const avgRating = data?.averageRating;
  const totalReviews = data?.totalReviews ?? 0;

  return (
    <View style={s.container}>
      {/* Header */}
      <SafeAreaView edges={["top"]} style={s.header}>
        <View style={s.headerRow}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
            <Feather name="arrow-left" size={20} color="#fff" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>My Reviews</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Summary bar */}
        {!isLoading && !isError && totalReviews > 0 && (
          <View style={s.summaryRow}>
            <View style={s.summaryItem}>
              <Text style={s.summaryValue}>
                {avgRating != null ? avgRating.toFixed(1) : "—"}
              </Text>
              <Text style={s.summaryLabel}>Avg Rating</Text>
            </View>
            <View style={s.summaryDivider} />
            <View style={s.summaryItem}>
              <Text style={s.summaryValue}>{totalReviews}</Text>
              <Text style={s.summaryLabel}>Total Reviews</Text>
            </View>
            <View style={s.summaryDivider} />
            <View style={s.summaryItem}>
              <Text style={s.summaryValue}>
                {reviews.filter((r) => r.providerReply).length}
              </Text>
              <Text style={s.summaryLabel}>Replied</Text>
            </View>
            <View style={s.summaryDivider} />
            <View style={s.summaryItem}>
              <Text style={[s.summaryValue, { color: "#FCA5A5" }]}>
                {reviews.filter((r) => !r.providerReply).length}
              </Text>
              <Text style={s.summaryLabel}>Pending Reply</Text>
            </View>
          </View>
        )}
      </SafeAreaView>

      {/* Body */}
      {isLoading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={K.colors.accent} />
        </View>
      ) : isError ? (
        <View style={s.center}>
          <Feather name="alert-circle" size={44} color={K.colors.error} />
          <Text style={s.errorText}>Could not load reviews</Text>
          <TouchableOpacity style={s.retryBtn} onPress={() => refetch()}>
            <Text style={s.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : reviews.length === 0 ? (
        <View style={s.center}>
          <Ionicons name="star-outline" size={56} color={K.colors.border} />
          <Text style={s.emptyTitle}>No Reviews Yet</Text>
          <Text style={s.emptySub}>
            Guest reviews will appear here once your first booking is completed.
          </Text>
        </View>
      ) : (
        <FlatList
          data={reviews}
          keyExtractor={(item) => item.id}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={K.colors.accent}
            />
          }
          renderItem={({ item }) => (
            <ReviewCard review={item} onReply={handleOpenReply} />
          )}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          ListFooterComponent={() => <View style={{ height: 40 }} />}
          ListHeaderComponent={
            reviews.filter((r) => !r.providerReply).length > 0 ? (
              <View style={s.pendingBanner}>
                <Feather name="clock" size={14} color="#92400E" />
                <Text style={s.pendingBannerText}>
                  {reviews.filter((r) => !r.providerReply).length} review{reviews.filter((r) => !r.providerReply).length !== 1 ? "s" : ""} awaiting your reply
                </Text>
              </View>
            ) : null
          }
        />
      )}

      {/* Reply Modal */}
      <ReplyModal
        review={selectedReview}
        visible={modalVisible}
        onClose={handleCloseReply}
        onSubmit={handleSubmitReply}
        isSubmitting={replyMutation.isPending}
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: K.colors.bgLight },

  header: {
    backgroundColor: K.colors.darkGreen,
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 6,
    marginBottom: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 17, fontWeight: "800", color: "#fff" },

  summaryRow: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  summaryItem: { flex: 1, alignItems: "center" },
  summaryValue: { fontSize: 18, fontWeight: "800", color: "#fff", marginBottom: 2 },
  summaryLabel: { fontSize: 10, color: "rgba(255,255,255,0.7)", fontWeight: "600", textAlign: "center" },
  summaryDivider: { width: 1, backgroundColor: "rgba(255,255,255,0.2)", marginVertical: 4 },

  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 32 },
  errorText: { fontSize: 15, color: K.colors.textMuted },
  retryBtn: {
    backgroundColor: K.colors.accent,
    borderRadius: K.radius.md,
    paddingHorizontal: 28,
    paddingVertical: 10,
  },
  retryText: { color: "#fff", fontWeight: "700" },
  emptyTitle: { fontSize: 18, fontWeight: "800", color: K.colors.textDark },
  emptySub: {
    fontSize: 13,
    color: K.colors.textMuted,
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 260,
  },

  pendingBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEF3C7",
    borderRadius: K.radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  pendingBannerText: { fontSize: 12, fontWeight: "700", color: "#92400E", flex: 1 },

  list: { padding: 16 },

  card: {
    backgroundColor: K.colors.bgCard,
    borderRadius: K.radius.xl,
    padding: 16,
    borderWidth: 1,
    borderColor: K.colors.border,
    gap: 10,
    ...K.shadow.sm,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardDate: { fontSize: 11, color: K.colors.textMuted },

  cardMeta: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: K.colors.darkGreen,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  avatarText: { fontSize: 15, fontWeight: "800", color: "#fff" },
  guestName: { fontSize: 13, fontWeight: "700", color: K.colors.textDark },
  listingName: { fontSize: 11, color: K.colors.textMuted, marginTop: 1 },

  reviewTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: K.colors.textDark,
    fontStyle: "italic",
  },
  reviewBody: {
    fontSize: 13,
    color: K.colors.textMid,
    lineHeight: 19,
  },

  replyBox: {
    backgroundColor: K.colors.accentDim,
    borderRadius: K.radius.md,
    padding: 10,
    gap: 6,
    borderWidth: 1,
    borderColor: K.colors.accent + "30",
  },
  replyHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  replyLabel: { fontSize: 11, fontWeight: "700", color: K.colors.accent, flex: 1 },
  replyDate: { fontSize: 10, color: K.colors.textMuted },
  replyBody: { fontSize: 12, color: K.colors.textMid, lineHeight: 18 },

  replyBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: K.colors.accent + "60",
    borderRadius: K.radius.full,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: K.colors.accentDim,
  },
  replyBtnText: { fontSize: 12, fontWeight: "700", color: K.colors.accent },
});
