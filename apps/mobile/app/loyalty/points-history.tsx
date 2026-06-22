import { useRef, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { usePointsHistoryInfinite } from "../../hooks/loyalty";
import type { PointsTransaction, PointsTransactionType } from "../../lib/types/loyalty";

// ── Helpers ───────────────────────────────────────────────────────────────────

const TYPE_META: Record<PointsTransactionType, { label: string; color: string; icon: string; sign: string }> = {
  earned:   { label: "Earned",   color: "#16a34a", icon: "arrow-up-circle",   sign: "+" },
  redeemed: { label: "Redeemed", color: "#7c3aed", icon: "arrow-down-circle", sign: "–" },
  reversed: { label: "Reversed", color: "#dc2626", icon: "close-circle",      sign: "–" },
  refunded: { label: "Refunded", color: "#2563eb", icon: "refresh-circle",    sign: "+" },
  expired:  { label: "Expired",  color: "#9ca3af", icon: "time-outline",      sign: "–" },
  adjusted: { label: "Adjusted", color: "#f59e0b", icon: "create-outline",    sign: "±" },
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ── Filter bar ────────────────────────────────────────────────────────────────

const ALL_FILTERS = ["all", "earned", "redeemed", "reversed", "refunded"] as const;
type FilterKey = typeof ALL_FILTERS[number];

// ── Row ───────────────────────────────────────────────────────────────────────

function TxRow({ tx }: { tx: PointsTransaction }) {
  const meta = TYPE_META[tx.type] ?? TYPE_META.adjusted;
  return (
    <View style={s.row}>
      <View style={[s.iconWrap, { backgroundColor: meta.color + "18" }]}>
        <Ionicons name={meta.icon as any} size={22} color={meta.color} />
      </View>
      <View style={s.rowMeta}>
        <Text style={s.rowDesc} numberOfLines={2}>{tx.description}</Text>
        {tx.bookingReference && (
          <Text style={s.rowRef}>{tx.bookingReference}</Text>
        )}
        <Text style={s.rowDate}>{fmtDate(tx.createdAt)}</Text>
      </View>
      <View style={s.rowRight}>
        <Text style={[s.rowPts, { color: meta.color }]}>
          {meta.sign}{tx.points.toLocaleString()}
        </Text>
        <Text style={[s.rowType, { color: meta.color }]}>{meta.label}</Text>
      </View>
    </View>
  );
}

// ── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonRow() {
  const anim = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1,   duration: 700, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, [anim]);
  const B = ({ w, h = 13 }: { w: number | string; h?: number }) => (
    <Animated.View style={{ width: w, height: h, backgroundColor: "#e5e7eb", borderRadius: 6, opacity: anim }} />
  );
  return (
    <View style={[s.row, { gap: 0 }]}>
      <Animated.View style={{ width: 40, height: 40, backgroundColor: "#e5e7eb", borderRadius: 20, opacity: anim, marginRight: 12 }} />
      <View style={{ flex: 1, gap: 6 }}>
        <B w="70%" h={14} />
        <B w="40%" h={11} />
      </View>
      <B w={52} h={18} />
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function PointsHistoryScreen() {
  const router = useRouter();

  const {
    data,
    isLoading,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = usePointsHistoryInfinite();

  const allTxs = data?.pages.flatMap((p) => p.transactions) ?? [];
  const summary = data?.pages[0];

  // Simple client-side filter state is not needed since the API paginates —
  // we show all transactions; a filter could be added as a query param later.

  const ListHeader = () => (
    <View>
      <Stack.Screen options={{ title: "Points History", headerShown: true, headerBackTitle: "AfriPoints" }} />

      {/* Summary chips */}
      {summary && (
        <View style={s.summaryRow}>
          {[
            { label: "Earned",   value: summary.totalEarned,   color: "#16a34a" },
            { label: "Redeemed", value: summary.totalRedeemed, color: "#7c3aed" },
            { label: "Reversed", value: summary.totalReversed, color: "#dc2626" },
            { label: "Refunded", value: summary.totalRefunded, color: "#2563eb" },
          ].map(({ label, value, color }) => (
            <View key={label} style={s.summaryChip}>
              <Text style={[s.summaryVal, { color }]}>{value.toLocaleString()}</Text>
              <Text style={s.summaryLabel}>{label}</Text>
            </View>
          ))}
        </View>
      )}

      <Text style={s.listHeading}>
        {allTxs.length > 0 ? `${allTxs.length}${hasNextPage ? "+" : ""} transactions` : ""}
      </Text>
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={s.container} edges={["bottom"]}>
        <Stack.Screen options={{ title: "Points History", headerShown: true, headerBackTitle: "AfriPoints" }} />
        <FlatList
          data={[1, 2, 3, 4, 5, 6]}
          keyExtractor={(i) => String(i)}
          contentContainerStyle={s.list}
          renderItem={() => <SkeletonRow />}
          ListHeaderComponent={<View style={{ height: 12 }} />}
          ItemSeparatorComponent={() => <View style={s.sep} />}
        />
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView style={s.container} edges={["bottom"]}>
        <Stack.Screen options={{ title: "Points History", headerShown: true, headerBackTitle: "AfriPoints" }} />
        <View style={s.centered}>
          <Ionicons name="cloud-offline-outline" size={56} color="#d1d5db" />
          <Text style={s.errTitle}>Could not load history</Text>
          <Text style={s.errBody}>Check your connection and try again.</Text>
          <TouchableOpacity style={s.retryBtn} onPress={() => void refetch()}>
            <Text style={s.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container} edges={["bottom"]}>
      <FlatList
        data={allTxs}
        keyExtractor={(tx) => tx.id}
        contentContainerStyle={s.list}
        ListHeaderComponent={<ListHeader />}
        ItemSeparatorComponent={() => <View style={s.sep} />}
        renderItem={({ item }) => <TxRow tx={item} />}
        ListEmptyComponent={
          <View style={s.empty}>
            <Ionicons name="star-outline" size={56} color="#d1d5db" />
            <Text style={s.emptyTitle}>No transactions yet</Text>
            <Text style={s.emptyBody}>
              Complete a booking to start earning AfriPoints.
            </Text>
          </View>
        }
        ListFooterComponent={
          hasNextPage ? (
            <TouchableOpacity
              style={s.loadMoreBtn}
              onPress={() => void fetchNextPage()}
              disabled={isFetchingNextPage}
            >
              {isFetchingNextPage
                ? <ActivityIndicator size="small" color="#16a34a" />
                : <Text style={s.loadMoreText}>Load More</Text>}
            </TouchableOpacity>
          ) : allTxs.length > 0 ? (
            <Text style={s.endText}>You've reached the end</Text>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f3f4f6" },
  list:      { padding: 16, paddingBottom: 40 },
  centered:  { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 },

  summaryRow: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  summaryChip: { flex: 1, alignItems: "center" },
  summaryVal:  { fontSize: 16, fontWeight: "800", marginBottom: 2 },
  summaryLabel: { fontSize: 10, color: "#9ca3af", fontWeight: "500" },

  listHeading: { fontSize: 12, color: "#9ca3af", marginBottom: 8, fontWeight: "500" },

  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
  },
  iconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", marginRight: 12 },
  rowMeta:  { flex: 1, marginRight: 8 },
  rowDesc:  { fontSize: 13, fontWeight: "600", color: "#111827", lineHeight: 18 },
  rowRef:   { fontSize: 11, color: "#6b7280", marginTop: 2, fontFamily: "monospace" },
  rowDate:  { fontSize: 11, color: "#9ca3af", marginTop: 2 },
  rowRight: { alignItems: "flex-end", minWidth: 64 },
  rowPts:   { fontSize: 16, fontWeight: "800" },
  rowType:  { fontSize: 10, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.3, marginTop: 2 },

  sep: { height: 6 },

  // Error
  errTitle: { fontSize: 18, fontWeight: "700", color: "#374151", textAlign: "center" },
  errBody:  { fontSize: 13, color: "#9ca3af", textAlign: "center" },
  retryBtn: { backgroundColor: "#16a34a", borderRadius: 10, paddingHorizontal: 24, paddingVertical: 12 },
  retryBtnText: { color: "#fff", fontWeight: "700" },

  // Empty
  empty:      { alignItems: "center", paddingVertical: 48, gap: 10 },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: "#374151" },
  emptyBody:  { fontSize: 13, color: "#9ca3af", textAlign: "center", lineHeight: 18 },

  // Pagination
  loadMoreBtn: { alignItems: "center", paddingVertical: 16, marginTop: 8 },
  loadMoreText: { fontSize: 14, color: "#16a34a", fontWeight: "700" },
  endText:     { fontSize: 12, color: "#9ca3af", textAlign: "center", paddingVertical: 20 },
});
