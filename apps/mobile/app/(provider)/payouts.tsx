import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { paymentApi } from "../../lib/payment-api";
import { K } from "../../constants/theme";

// ── Types ─────────────────────────────────────────────────────────────────────

type PayoutStatus = "scheduled" | "processing" | "paid" | "failed" | "cancelled";

interface Payout {
  id: string;
  reference?: string | null;
  amount: number;
  currency: string;
  status: PayoutStatus;
  payoutMethod: string | null;
  createdAt: string;
  paidAt?: string | null;
}

interface PayoutsPage {
  payouts: Payout[];
  total: number;
  page: number;
  limit: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(amount: number, currency: string) {
  return `${currency} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

const STATUS_CONFIG: Record<PayoutStatus, { label: string; color: string; icon: string }> = {
  scheduled:  { label: "Scheduled",  color: K.colors.info,    icon: "time-outline"           },
  processing: { label: "Processing", color: K.colors.warning,  icon: "hourglass-outline"      },
  paid:       { label: "Paid",       color: K.colors.success,  icon: "checkmark-circle-outline" },
  failed:     { label: "Failed",     color: K.colors.error,    icon: "close-circle-outline"   },
  cancelled:  { label: "Cancelled",  color: K.colors.textMuted, icon: "ban-outline"            },
};

// ── Payout Row ────────────────────────────────────────────────────────────────

function PayoutRow({ item, isLast }: { item: Payout; isLast: boolean }) {
  const cfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.scheduled;

  return (
    <View style={[r.row, !isLast && r.rowBorder]}>
      <View style={[r.iconWrap, { backgroundColor: cfg.color + "18" }]}>
        <Ionicons name={cfg.icon as any} size={20} color={cfg.color} />
      </View>
      <View style={r.mid}>
        <Text style={r.amount}>{fmt(item.amount, item.currency)}</Text>
        {item.reference ? <Text style={r.ref}>{item.reference}</Text> : null}
        <Text style={r.date}>{fmtDate(item.paidAt ?? item.createdAt)}</Text>
        {item.payoutMethod ? (
          <Text style={r.method}>{item.payoutMethod}</Text>
        ) : null}
      </View>
      <View style={[r.pill, { backgroundColor: cfg.color + "18" }]}>
        <Text style={[r.pillText, { color: cfg.color }]}>{cfg.label}</Text>
      </View>
    </View>
  );
}

const r = StyleSheet.create({
  row:       { flexDirection: "row", alignItems: "center", paddingVertical: 14, gap: 12 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: K.colors.border },
  iconWrap:  { width: 40, height: 40, borderRadius: K.radius.full, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  mid:       { flex: 1 },
  amount:    { fontSize: K.font.base, fontWeight: "800", color: K.colors.textDark, marginBottom: 3 },
  ref:       { fontSize: 11, color: K.colors.textMuted, fontFamily: "monospace", marginBottom: 2 },
  date:      { fontSize: 11, color: K.colors.textMuted },
  method:    { fontSize: 11, color: K.colors.accent, marginTop: 2 },
  pill:      { borderRadius: K.radius.full, paddingHorizontal: 10, paddingVertical: 4, flexShrink: 0 },
  pillText:  { fontSize: 11, fontWeight: "700" },
});

// ── Screen ────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

export default function ProviderPayoutsScreen() {
  const {
    data,
    isLoading,
    isError,
    refetch,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery<PayoutsPage>({
    queryKey: ["provider-payouts"],
    queryFn: async ({ pageParam }) => {
      const page = (pageParam as number) ?? 1;
      const res = await paymentApi.get("/provider/me/payouts", {
        params: { page, limit: PAGE_SIZE },
      });
      // API may return { data: PayoutsPage } or PayoutsPage directly
      const payload: PayoutsPage = res.data?.data ?? res.data;
      // Normalise — some endpoints return 'items' instead of 'payouts'
      if (!payload.payouts && (payload as any).items) {
        payload.payouts = (payload as any).items;
      }
      return payload;
    },
    initialPageParam: 1,
    getNextPageParam: (last) => {
      const items = last?.payouts;
      if (!items) return undefined;
      const loaded = (last.page - 1) * last.limit + items.length;
      return loaded < last.total ? last.page + 1 : undefined;
    },
    staleTime: 60_000,
  });

  const allPayouts: Payout[] = data?.pages.flatMap((p) => p.payouts ?? []) ?? [];
  const total = data?.pages[0]?.total ?? 0;

  return (
    <View style={s.container}>
      {/* Header */}
      <SafeAreaView edges={["top"]} style={s.header}>
        <View style={s.headerRow}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Payout History</Text>
          <View style={{ width: 40 }} />
        </View>
      </SafeAreaView>

      {isLoading ? (
        <View style={s.center}>
          <ActivityIndicator color={K.colors.accent} size="large" />
        </View>
      ) : isError ? (
        <View style={s.center}>
          <Ionicons name="cloud-offline-outline" size={44} color={K.colors.textMuted} />
          <Text style={s.errorText}>Could not load payouts</Text>
          <TouchableOpacity style={s.retryBtn} onPress={() => refetch()}>
            <Text style={s.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={allPayouts}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <PayoutRow item={item} isLast={index === allPayouts.length - 1} />
          )}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={K.colors.accent} />
          }
          ListHeaderComponent={
            <View style={s.listHeader}>
              <Text style={s.listHeaderTitle}>
                {total} payout{total !== 1 ? "s" : ""}
              </Text>
              <Text style={s.listHeaderSub}>Processed & scheduled disbursements</Text>
            </View>
          }
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="wallet-outline" size={48} color={K.colors.border} />
              <Text style={s.emptyTitle}>No payouts yet</Text>
              <Text style={s.emptySub}>
                Your first payout will appear here after a booking is confirmed.
              </Text>
              <TouchableOpacity
                style={s.setupBtn}
                onPress={() => router.push("/(provider)/stripe-connect" as any)}
                activeOpacity={0.85}
              >
                <Ionicons name="link-outline" size={16} color="#fff" />
                <Text style={s.setupBtnText}>Set Up Stripe Payouts</Text>
              </TouchableOpacity>
            </View>
          }
          ListFooterComponent={
            hasNextPage ? (
              <TouchableOpacity
                style={s.loadMore}
                onPress={() => fetchNextPage()}
                disabled={isFetchingNextPage}
              >
                {isFetchingNextPage ? (
                  <ActivityIndicator size="small" color={K.colors.accent} />
                ) : (
                  <Text style={s.loadMoreText}>Load more</Text>
                )}
              </TouchableOpacity>
            ) : null
          }
        />
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: K.colors.bgApp },

  header: { backgroundColor: K.colors.darkGreen },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: K.spacing.screen,
    paddingVertical: 14,
  },
  backBtn:     { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: K.font.xl, fontWeight: "800", color: "#fff" },

  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 14 },
  errorText: { fontSize: K.font.base, color: K.colors.textMuted, textAlign: "center" },
  retryBtn:  { backgroundColor: K.colors.accent, borderRadius: K.radius.button, paddingHorizontal: 24, paddingVertical: 11 },
  retryText: { color: "#fff", fontWeight: "700", fontSize: K.font.sm },

  list: { paddingHorizontal: K.spacing.screen, paddingBottom: 40 },

  listHeader: { paddingVertical: 18 },
  listHeaderTitle: { fontSize: K.font.xl, fontWeight: "800", color: K.colors.textDark, letterSpacing: -0.3 },
  listHeaderSub:   { fontSize: K.font.sm, color: K.colors.textMuted, marginTop: 3 },

  empty: { alignItems: "center", paddingTop: 60, gap: 10 },
  emptyTitle: { fontSize: K.font.lg, fontWeight: "700", color: K.colors.textMid },
  emptySub:   { fontSize: K.font.sm, color: K.colors.textMuted, textAlign: "center", lineHeight: 20, paddingHorizontal: 16 },
  setupBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: K.colors.darkGreen,
    borderRadius: K.radius.button,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: 8,
  },
  setupBtnText: { color: "#fff", fontWeight: "700", fontSize: K.font.sm },

  loadMore: { alignItems: "center", paddingVertical: 20 },
  loadMoreText: { color: K.colors.accent, fontWeight: "600", fontSize: K.font.sm },
});
