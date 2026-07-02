import { View, ActivityIndicator, RefreshControl, FlatList } from "react-native";
import { ReviewCard, type ReviewCardProps } from "./ReviewCard";
import { ReviewListSkeleton } from "./ReviewSkeleton";
import { EmptyReviewState } from "./EmptyReviewState";
import { K } from "../../constants/theme";

export interface ReviewListItem extends ReviewCardProps {
  id: string;
}

interface Props<T extends { id: string }> {
  items: T[];
  isLoading: boolean;
  isError: boolean;
  isFetchingMore?: boolean;
  onEndReached?: () => void;
  refreshing?: boolean;
  onRefresh?: () => void;
  ListHeaderComponent?: React.ReactElement | null;
  emptyTitle?: string;
  emptySubtitle?: string;
  // Defaults to rendering a plain ReviewCard — override when the item needs
  // extra per-row data (e.g. MyReviewCard's async listing-photo lookup).
  renderItem?: (item: T) => React.ReactElement;
}

// Shared paginated/infinite-scroll review list — used by the "View All
// Reviews" screen (and reusable anywhere else a review feed is needed).
export function ReviewList<T extends { id: string }>({
  items,
  isLoading,
  isError,
  isFetchingMore,
  onEndReached,
  refreshing,
  onRefresh,
  ListHeaderComponent,
  emptyTitle,
  emptySubtitle,
  renderItem,
}: Props<T>) {
  if (isLoading) {
    return (
      <View style={{ padding: K.spacing.screen }}>
        {ListHeaderComponent}
        <ReviewListSkeleton />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={{ padding: K.spacing.screen }}>
        {ListHeaderComponent}
        <EmptyReviewState title="Could not load reviews" subtitle="Please check your connection and try again." />
      </View>
    );
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (renderItem ? renderItem(item) : <ReviewCard {...(item as unknown as ReviewCardProps)} />)}
      ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      contentContainerStyle={{ padding: K.spacing.screen, paddingBottom: 40, flexGrow: 1 }}
      showsVerticalScrollIndicator={false}
      onEndReachedThreshold={0.4}
      onEndReached={onEndReached}
      ListHeaderComponent={ListHeaderComponent}
      ListEmptyComponent={<EmptyReviewState title={emptyTitle} subtitle={emptySubtitle} />}
      ListFooterComponent={isFetchingMore ? <ActivityIndicator style={{ marginTop: 12 }} color={K.colors.accent} /> : null}
      refreshControl={
        onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={K.colors.accent} /> : undefined
      }
      // Reasonable defaults for a text-heavy list — avoids over-rendering offscreen cards.
      windowSize={7}
      maxToRenderPerBatch={8}
      removeClippedSubviews
    />
  );
}
