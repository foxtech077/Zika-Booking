import { useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useListingReviewsInfinite } from "../../hooks/reviews";
import { ReviewList, type ReviewListItem } from "../../components/reviews/ReviewList";
import { ReviewSummary } from "../../components/reviews/ReviewSummary";
import { K } from "../../constants/theme";

export default function ListingReviewsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const {
    data,
    isLoading,
    isError,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
  } = useListingReviewsInfinite(id);

  const firstPage = data?.pages[0];
  const items: ReviewListItem[] = useMemo(
    () =>
      (data?.pages ?? []).flatMap((page) =>
        page.reviews.map((r) => ({
          id: r.id,
          rating: r.rating,
          title: r.title,
          body: r.body,
          createdAt: r.createdAt,
          providerReply: r.providerReply,
          providerRepliedAt: r.providerRepliedAt,
        })),
      ),
    [data],
  );

  return (
    <SafeAreaView style={s.container} edges={["top"]}>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={K.colors.textDark} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Guest Reviews</Text>
        <View style={{ width: 36 }} />
      </View>

      <ReviewList
        items={items}
        isLoading={isLoading}
        isError={isError}
        isFetchingMore={isFetchingNextPage}
        onEndReached={() => hasNextPage && !isFetchingNextPage && fetchNextPage()}
        refreshing={isFetching && !isLoading && !isFetchingNextPage}
        onRefresh={refetch}
        emptyTitle="No reviews yet"
        emptySubtitle="This listing hasn't received any reviews yet."
        ListHeaderComponent={
          firstPage && firstPage.total > 0 ? (
            <View style={s.summaryWrap}>
              <ReviewSummary averageRating={firstPage.averageRating} totalReviews={firstPage.total} />
            </View>
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
  summaryWrap: {
    backgroundColor: K.colors.bgCard,
    borderRadius: K.radius.xl,
    borderWidth: 1,
    borderColor: K.colors.border,
    paddingVertical: 20,
    marginBottom: 16,
    ...K.shadow.xs,
  },
});
