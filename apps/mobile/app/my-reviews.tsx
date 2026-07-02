import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useMyReviews } from "../hooks/reviews";
import { useListingBasics } from "../hooks/messaging";
import { MyReviewCard } from "../components/reviews/MyReviewCard";
import { ReviewList } from "../components/reviews/ReviewList";
import { K } from "../constants/theme";
import type { MyReview } from "../hooks/reviews";

// Wraps MyReviewCard so each row can look up its own listing photo (cached
// per listingId — most reviews share only a handful of listings, so this
// stays cheap) without blocking the rest of the list on it.
function MyReviewRow({ review }: { review: MyReview }) {
  const { data: listing } = useListingBasics(review.listingId);
  return (
    <MyReviewCard
      photoUrl={listing?.photoUrl ?? null}
      listingName={review.listingName || "Listing"}
      rating={review.rating}
      title={review.title}
      body={review.body}
      createdAt={review.createdAt}
      providerReply={review.providerReply}
      providerRepliedAt={review.providerRepliedAt}
      onPress={() => router.push(`/listing/${review.listingId}` as any)}
    />
  );
}

export default function MyReviewsScreen() {
  const { data, isLoading, isError, isFetching, refetch } = useMyReviews();
  const reviews = data ?? [];

  return (
    <SafeAreaView style={s.container} edges={["top"]}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={K.colors.textDark} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>My Reviews</Text>
        <View style={{ width: 36 }} />
      </View>

      <ReviewList
        items={reviews}
        renderItem={(review) => <MyReviewRow review={review} />}
        isLoading={isLoading}
        isError={isError}
        refreshing={isFetching && !isLoading}
        onRefresh={refetch}
        emptyTitle="No reviews yet"
        emptySubtitle="After completing a stay or rental, you can leave a review from your trip details."
        ListHeaderComponent={
          reviews.length > 0 ? (
            <Text style={s.totalLabel}>
              {reviews.length} review{reviews.length !== 1 ? "s" : ""}
            </Text>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

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
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: K.font.lg, fontWeight: "800", color: K.colors.textDark },
  totalLabel: { fontSize: K.font.sm, color: K.colors.textMuted, marginBottom: 16, fontWeight: "500" },
});
