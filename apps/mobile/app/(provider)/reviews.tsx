import { useState } from "react";
import { View, Text, TouchableOpacity, Alert, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Feather, Ionicons } from "@expo/vector-icons";
import { useProviderReviews, useReplyToReview, extractReviewErrorMessage, type ProviderReview } from "../../hooks/reviews";
import { ReviewList } from "../../components/reviews/ReviewList";
import { ReviewCard } from "../../components/reviews/ReviewCard";
import { ReviewDistribution } from "../../components/reviews/ReviewDistribution";
import { ProviderReplyModal, type ReplyTargetReview } from "../../components/reviews/ProviderReplyModal";
import { K } from "../../constants/theme";

// ── Screen ────────────────────────────────────────────────────────────────────

export default function ProviderReviewsScreen() {
  const [selectedReview, setSelectedReview] = useState<ProviderReview | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const { data, isLoading, isError, isFetching, refetch } = useProviderReviews({ limit: 50 });
  const replyMutation = useReplyToReview();

  function handleOpenReply(review: ProviderReview) {
    setSelectedReview(review);
    setModalVisible(true);
  }

  function handleCloseReply() {
    if (replyMutation.isPending) return;
    setModalVisible(false);
    setSelectedReview(null);
  }

  function handleSubmitReply(reviewId: string, reply: string) {
    replyMutation.mutate(
      { reviewId, reply },
      {
        onSuccess: () => {
          setModalVisible(false);
          setSelectedReview(null);
          Alert.alert("Reply Posted", "Your response has been published and guests will be able to see it.");
        },
        onError: (err) => {
          Alert.alert("Reply Failed", extractReviewErrorMessage(err, "Could not post your reply. Please try again."));
        },
      },
    );
  }

  const reviews = data?.reviews ?? [];
  const pendingCount = reviews.filter((r) => !r.providerReply).length;

  const replyTarget: ReplyTargetReview | null = selectedReview
    ? { id: selectedReview.id, rating: selectedReview.rating, body: selectedReview.body, guestName: selectedReview.guestName }
    : null;

  return (
    <View style={s.container}>
      <SafeAreaView edges={["top"]} style={s.header}>
        <View style={s.headerRow}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
            <Feather name="arrow-left" size={20} color="#fff" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>My Reviews</Text>
          <View style={{ width: 40 }} />
        </View>

        {!isLoading && !isError && data && data.totalReviews > 0 && (
          <>
            <View style={s.summaryRow}>
              <View style={s.summaryItem}>
                <Text style={s.summaryValue}>{data.averageRating != null ? data.averageRating.toFixed(1) : "—"}</Text>
                <Text style={s.summaryLabel}>Avg Rating</Text>
              </View>
              <View style={s.summaryDivider} />
              <View style={s.summaryItem}>
                <Text style={s.summaryValue}>{data.totalReviews}</Text>
                <Text style={s.summaryLabel}>Total Reviews</Text>
              </View>
              <View style={s.summaryDivider} />
              <View style={s.summaryItem}>
                <Text style={s.summaryValue}>{reviews.length - pendingCount}</Text>
                <Text style={s.summaryLabel}>Replied</Text>
              </View>
              <View style={s.summaryDivider} />
              <View style={s.summaryItem}>
                <Text style={[s.summaryValue, { color: "#FCA5A5" }]}>{pendingCount}</Text>
                <Text style={s.summaryLabel}>Pending Reply</Text>
              </View>
            </View>

            <View style={s.distributionCard}>
              <ReviewDistribution distribution={data.distribution} total={data.totalReviews} />
            </View>
          </>
        )}
      </SafeAreaView>

      <ReviewList
        items={reviews}
        isLoading={isLoading}
        isError={isError}
        refreshing={isFetching && !isLoading}
        onRefresh={refetch}
        emptyTitle="No Reviews Yet"
        emptySubtitle="Guest reviews will appear here once your first booking is completed."
        renderItem={(review) => (
          <ReviewCard
            rating={review.rating}
            title={review.title}
            body={review.body}
            createdAt={review.createdAt}
            guestName={review.guestName}
            providerReply={review.providerReply}
            providerRepliedAt={review.providerRepliedAt}
            onReplyPress={() => handleOpenReply(review)}
          />
        )}
        ListHeaderComponent={
          pendingCount > 0 ? (
            <View style={s.pendingBanner}>
              <Feather name="clock" size={14} color="#92400E" />
              <Text style={s.pendingBannerText}>
                {pendingCount} review{pendingCount !== 1 ? "s" : ""} awaiting your reply
              </Text>
            </View>
          ) : null
        }
      />

      <ProviderReplyModal
        review={replyTarget}
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
  container: { flex: 1, backgroundColor: K.colors.bgApp },

  header: { backgroundColor: K.colors.darkGreen, paddingHorizontal: 16, paddingBottom: 14 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 6, marginBottom: 12 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontWeight: "800", color: "#fff" },

  summaryRow: { flexDirection: "row", backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 12, paddingVertical: 12, paddingHorizontal: 8, marginBottom: 12 },
  summaryItem: { flex: 1, alignItems: "center" },
  summaryValue: { fontSize: 18, fontWeight: "800", color: "#fff", marginBottom: 2 },
  summaryLabel: { fontSize: 10, color: "rgba(255,255,255,0.7)", fontWeight: "600", textAlign: "center" },
  summaryDivider: { width: 1, backgroundColor: "rgba(255,255,255,0.2)", marginVertical: 4 },

  distributionCard: { backgroundColor: "#fff", borderRadius: 12, padding: 14 },

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
});
