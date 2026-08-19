import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { listingApi } from "../lib/listing-api";
import { K } from "../constants/theme";

interface MonthlyEntry {
  month: string;
  revenue: number;
  commission: number;
  payout: number;
  bookings: number;
}

interface RecentPayout {
  id: string;
  reference: string;
  listingName: string;
  category: string;
  totalAmount: number;
  commission: number;
  payout: number;
  currency: string;
  status: string;
  confirmedAt: string | null;
}

interface EarningsData {
  currency?: string;
  allTime: { revenue: number; commission: number; payout: number };
  monthly: MonthlyEntry[];
  recentPayouts: RecentPayout[];
}

function fmt(n: number, currency = "USD") {
  return `${currency} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric" });
}

function monthShort(m: string) {
  const [y, mo] = m.split("-");
  return new Date(parseInt(y!, 10), parseInt(mo!, 10) - 1, 1)
    .toLocaleDateString("en", { month: "short" });
}

const CAT_EMOJI: Record<string, string> = { hotel: "🏨", apartment: "🏠", car: "🚗" };

function PayoutRow({ item, i }: { item: RecentPayout; i: number }) {
  return (
    <View style={[styles.txRow, i > 0 && styles.txRowBorder]}>
      <View style={styles.txIcon}>
        <Text style={styles.txEmoji}>{CAT_EMOJI[item.category] ?? "💰"}</Text>
      </View>
      <View style={styles.txMain}>
        <Text style={styles.txDesc} numberOfLines={1}>{item.listingName}</Text>
        <Text style={styles.txRef}>{item.reference}</Text>
        <Text style={styles.txDate}>{fmtDate(item.confirmedAt)}</Text>
      </View>
      <View style={styles.txRight}>
        <Text style={styles.txAmount}>+{fmt(item.payout, item.currency)}</Text>
        <Text style={styles.txCommission}>−{fmt(item.commission, item.currency)} fee</Text>
      </View>
    </View>
  );
}

export default function WalletScreen() {
  const { data, isLoading, isError, refetch, isRefetching } = useQuery<EarningsData>({
    queryKey: ["providerEarnings"],
    queryFn: async () => {
      const res = await listingApi.get<{ data: EarningsData }>("/provider/earnings");
      return res.data.data;
    },
  });

  // Aggregates (allTime/monthly) are returned in EUR by the API (the money of
  // record). localCurrency is the guest's arbitrary browsing-display preference
  // (picked from Profile), not this host's real payout currency, so it must
  // never label real earnings. Per-payout rows below keep their native currency.
  const recentPayouts = data?.recentPayouts ?? [];
  const currency = data?.currency ?? recentPayouts[0]?.currency ?? "EUR";

  // Current month earnings
  const monthly = data?.monthly ?? [];
  const thisMonth = monthly[monthly.length - 1];
  const lastMonth = monthly[monthly.length - 2];

  return (
    <View style={styles.container}>
      <SafeAreaView edges={["top"]} style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Wallet & Payouts</Text>
          <View style={{ width: 40 }} />
        </View>
      </SafeAreaView>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={K.colors.accent} size="large" />
        </View>
      ) : isError || !data ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>Could not load earnings</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={K.colors.accent} />
          }
        >
          {/* All-time payout balance card */}
          <View style={styles.balanceCard}>
            <Text style={styles.balanceLabel}>Total Provider Payout</Text>
            <Text style={styles.balanceValue}>{fmt(data.allTime.payout, currency)}</Text>
            <View style={styles.balanceDivider} />
            <View style={styles.balanceRow}>
              <View>
                <Text style={styles.balanceSubLabel}>Platform Revenue</Text>
                <Text style={styles.balanceSubValue}>{fmt(data.allTime.revenue, currency)}</Text>
              </View>
              <View style={styles.balanceSubDivider} />
              <View>
                <Text style={styles.balanceSubLabel}>Total Commission</Text>
                <Text style={styles.balanceSubValue}>{fmt(data.allTime.commission, currency)}</Text>
              </View>
            </View>
          </View>

          {/* This month summary */}
          {thisMonth && (
            <View style={styles.monthCard}>
              <Text style={styles.monthTitle}>
                {monthShort(thisMonth.month)} Earnings
              </Text>
              <View style={styles.monthRow}>
                <View style={styles.monthStat}>
                  <Text style={styles.monthStatLabel}>Payout</Text>
                  <Text style={styles.monthStatValue}>{fmt(thisMonth.payout, currency)}</Text>
                </View>
                <View style={styles.monthStatDivider} />
                <View style={styles.monthStat}>
                  <Text style={styles.monthStatLabel}>Bookings</Text>
                  <Text style={styles.monthStatValue}>{thisMonth.bookings}</Text>
                </View>
                <View style={styles.monthStatDivider} />
                <View style={styles.monthStat}>
                  <Text style={styles.monthStatLabel}>vs Last Month</Text>
                  <Text style={[
                    styles.monthStatValue,
                    {
                      color: lastMonth
                        ? thisMonth.payout >= lastMonth.payout
                          ? K.colors.success
                          : K.colors.error
                        : K.colors.textDark,
                    },
                  ]}>
                    {lastMonth
                      ? lastMonth.payout === 0
                        ? thisMonth.payout > 0 ? "+100%" : "—"
                        : `${thisMonth.payout >= lastMonth.payout ? "+" : ""}${(((thisMonth.payout - lastMonth.payout) / lastMonth.payout) * 100).toFixed(1)}%`
                      : "—"}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {/* Payout history */}
          <View style={styles.txCard}>
            <Text style={styles.txTitle}>Recent Payouts</Text>
            {data.recentPayouts.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyEmoji}>📭</Text>
                <Text style={styles.emptyText}>No payouts yet</Text>
              </View>
            ) : (
              data.recentPayouts.map((p, i) => (
                <PayoutRow key={p.id} item={p} i={i} />
              ))
            )}
          </View>

          {/* Info note about wallet API */}
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              💡 Direct wallet withdrawals and balance tracking are coming soon.
              Payouts are processed automatically per booking confirmation.
            </Text>
          </View>

          <View style={{ height: 32 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: K.colors.bgLight },

  header: { backgroundColor: K.colors.darkGreen, paddingBottom: 16 },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  backBtnText: { fontSize: 28, color: "#fff", fontWeight: "300" },
  headerTitle: { fontSize: K.font.xl, fontWeight: "800", color: "#fff" },

  scroll: { padding: 16, gap: 14 },

  balanceCard: {
    backgroundColor: K.colors.darkGreen,
    borderRadius: K.radius.xl,
    padding: 24,
    ...K.shadow.md,
  },
  balanceLabel: {
    fontSize: K.font.sm,
    color: K.colors.textLightMuted,
    fontWeight: "600",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  balanceValue: { fontSize: 34, fontWeight: "900", color: "#fff", letterSpacing: -1 },
  balanceDivider: { height: 1, backgroundColor: K.colors.glassBorder, marginVertical: 18 },
  balanceRow: { flexDirection: "row", gap: 16 },
  balanceSubDivider: { width: 1, backgroundColor: K.colors.glassBorder },
  balanceSubLabel: { fontSize: 11, color: K.colors.textLightDim, marginBottom: 4, fontWeight: "600" },
  balanceSubValue: { fontSize: K.font.base, fontWeight: "800", color: "#fff" },

  monthCard: {
    backgroundColor: K.colors.bgCard,
    borderRadius: K.radius.xl,
    padding: 18,
    borderWidth: 1,
    borderColor: K.colors.border,
    ...K.shadow.sm,
  },
  monthTitle: { fontSize: K.font.base, fontWeight: "700", color: K.colors.textDark, marginBottom: 14 },
  monthRow: { flexDirection: "row" },
  monthStat: { flex: 1, alignItems: "center" },
  monthStatDivider: { width: 1, backgroundColor: K.colors.border },
  monthStatLabel: { fontSize: K.font.xs, color: K.colors.textMuted, fontWeight: "600", marginBottom: 6 },
  monthStatValue: { fontSize: K.font.lg, fontWeight: "800", color: K.colors.textDark },

  txCard: {
    backgroundColor: K.colors.bgCard,
    borderRadius: K.radius.xl,
    padding: 20,
    borderWidth: 1,
    borderColor: K.colors.border,
    ...K.shadow.sm,
  },
  txTitle: { fontSize: K.font.base, fontWeight: "700", color: K.colors.textDark, marginBottom: 16 },
  txRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  txRowBorder: { borderTopWidth: 1, borderTopColor: K.colors.border },
  txIcon: {
    width: 42,
    height: 42,
    borderRadius: K.radius.md,
    backgroundColor: K.colors.bgLight,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: K.colors.border,
  },
  txEmoji: { fontSize: 20 },
  txMain: { flex: 1 },
  txDesc: { fontSize: K.font.sm, fontWeight: "600", color: K.colors.textDark },
  txRef: { fontSize: 10, color: K.colors.textMuted, fontFamily: "monospace", marginTop: 2 },
  txDate: { fontSize: K.font.xs, color: K.colors.textMuted, marginTop: 1 },
  txRight: { alignItems: "flex-end", gap: 2 },
  txAmount: { fontSize: K.font.sm, fontWeight: "700", color: K.colors.success },
  txCommission: { fontSize: K.font.xs, color: K.colors.textMuted },

  infoBox: {
    backgroundColor: "#EFF6FF",
    borderRadius: K.radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  infoText: { fontSize: K.font.sm, color: "#1D4ED8", lineHeight: 20 },

  emptyBox: { alignItems: "center", paddingVertical: 24, gap: 8 },
  emptyEmoji: { fontSize: 36 },
  emptyText: { fontSize: K.font.sm, color: K.colors.textMuted },

  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  errorText: { fontSize: K.font.base, color: K.colors.textMuted },
  retryBtn: {
    backgroundColor: K.colors.accent,
    borderRadius: K.radius.md,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  retryText: { color: "#fff", fontWeight: "700" },
});
