import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { AppLayout } from "../../components/layout/AppLayout";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { listingApi } from "../../lib/listing-api";
import { useAuthStore } from "../../store/auth";
import { getCurrencyForCountry } from "../../lib/currency";
import { K } from "../../constants/theme";

const { width } = Dimensions.get("window");
const CARD_W = (width - 48) / 2;

// ── Types ─────────────────────────────────────────────────────────────────────

interface CommissionRate { rate: number; country: string }
interface MonthlyRevenue { month: string; revenue: number; bookings: number }
interface EarningsData {
  totalEarnings: number;
  thisMonthEarnings: number;
  lastMonthEarnings: number;
  totalCommission: number;
  netPayout: number;
  totalBookings: number;
  completedBookings: number;
  averageBookingValue: number;
  occupancyRate: number;
  monthlyRevenue: MonthlyRevenue[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number, currency = "USD") {
  if (n >= 1_000_000) return `${currency} ${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000)     return `${currency} ${(n / 1_000).toFixed(1)}K`;
  return `${currency} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtCompact(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return n.toFixed(0);
}

function monthLabel(m: string) {
  const [y, mo] = m.split("-");
  return new Date(parseInt(y!, 10), parseInt(mo!, 10) - 1, 1)
    .toLocaleDateString("en", { month: "short" });
}

function pct(current: number, prev: number) {
  if (prev === 0) return current > 0 ? "+100%" : "—";
  const d = ((current - prev) / prev) * 100;
  return `${d >= 0 ? "+" : ""}${d.toFixed(1)}%`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ icon, label, value, sub, accent }: {
  icon: string; label: string; value: string; sub?: string; accent: string;
}) {
  return (
    <View style={[g.card, { width: CARD_W }]}>
      <View style={[g.iconBox, { backgroundColor: accent + "14" }]}>
        <Ionicons name={icon as any} size={18} color={accent} />
      </View>
      <Text style={g.value}>{value}</Text>
      <Text style={g.label}>{label}</Text>
      {sub ? <Text style={[g.sub, { color: accent }]}>{sub}</Text> : null}
    </View>
  );
}

const g = StyleSheet.create({
  card:    { backgroundColor: "#fff", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: K.colors.border, ...K.shadow.sm },
  iconBox: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  label:   { fontSize: 11, color: K.colors.textMuted, fontWeight: "600", marginTop: 4 },
  value:   { fontSize: 22, fontWeight: "900", color: K.colors.textDark, letterSpacing: -0.5 },
  sub:     { fontSize: 12, fontWeight: "700", marginTop: 3 },
});

function RevenueChart({ data, currency }: { data: MonthlyRevenue[]; currency: string }) {
  const slice  = data.slice(-6);
  const maxRev = Math.max(...slice.map((d) => d.revenue), 1);
  const BAR_H  = 96;

  return (
    <View style={ch.card}>
      <Text style={ch.title}>Monthly Revenue</Text>
      <View style={ch.bars}>
        {slice.map((item, i) => {
          const barH    = Math.max(6, Math.round(BAR_H * (item.revenue / maxRev)));
          const isLast  = i === slice.length - 1;
          const barColor = isLast ? K.colors.accent : K.colors.darkGreen + "60";
          return (
            <View key={item.month} style={ch.col}>
              {item.revenue > 0 && (
                <Text style={ch.barLabel}>
                  {fmtCompact(item.revenue)}
                </Text>
              )}
              <View style={ch.track}>
                <View
                  style={[
                    ch.bar,
                    { height: barH, backgroundColor: barColor },
                    isLast && ch.barActive,
                  ]}
                />
              </View>
              <Text style={[ch.xLabel, isLast && ch.xLabelActive]}>
                {monthLabel(item.month)}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const ch = StyleSheet.create({
  card:      { backgroundColor: "#fff", borderRadius: 20, padding: 20, borderWidth: 1, borderColor: K.colors.border, ...K.shadow.sm },
  title:     { fontSize: 15, fontWeight: "800", color: K.colors.textDark, marginBottom: 20, letterSpacing: -0.3 },
  bars:      { flexDirection: "row", alignItems: "flex-end", height: 130, gap: 4 },
  col:       { flex: 1, alignItems: "center" },
  barLabel:  { fontSize: 9, color: K.colors.textMuted, marginBottom: 4, textAlign: "center" },
  track:     { height: 96, justifyContent: "flex-end", width: "100%", alignItems: "center" },
  bar:       { width: "65%", borderRadius: 6 },
  barActive: { backgroundColor: K.colors.accent },
  xLabel:    { fontSize: 10, color: K.colors.textMuted, marginTop: 8, fontWeight: "500" },
  xLabelActive: { color: K.colors.accent, fontWeight: "700" },
});

function MonthlyTable({ data, currency }: { data: MonthlyRevenue[]; currency: string }) {
  const rows = data.slice(-6).reverse();
  return (
    <View style={tb.card}>
      <Text style={tb.title}>Monthly Breakdown</Text>
      <View style={tb.header}>
        <Text style={[tb.cell, tb.wide]}>Month</Text>
        <Text style={[tb.cell, tb.right]}>Revenue</Text>
        <Text style={[tb.cell, tb.right]}>Bookings</Text>
      </View>
      {rows.map((item, i) => (
        <View key={item.month} style={[tb.row, i % 2 === 0 && tb.rowAlt]}>
          <Text style={[tb.cell, tb.wide]}>{monthLabel(item.month)}</Text>
          <Text style={[tb.cell, tb.right, tb.bold]}>{fmt(item.revenue, currency)}</Text>
          <Text style={[tb.cell, tb.right]}>{item.bookings}</Text>
        </View>
      ))}
    </View>
  );
}

const tb = StyleSheet.create({
  card:    { backgroundColor: "#fff", borderRadius: 20, padding: 20, borderWidth: 1, borderColor: K.colors.border, ...K.shadow.sm },
  title:   { fontSize: 15, fontWeight: "800", color: K.colors.textDark, marginBottom: 16, letterSpacing: -0.3 },
  header:  { flexDirection: "row", paddingBottom: 10, borderBottomWidth: 1.5, borderBottomColor: K.colors.border, marginBottom: 4 },
  row:     { flexDirection: "row", paddingVertical: 11 },
  rowAlt:  { backgroundColor: K.colors.bgSubtle, borderRadius: 8, paddingHorizontal: 6 },
  cell:    { fontSize: 13, color: K.colors.textMuted },
  wide:    { flex: 1.2 },
  right:   { flex: 1, textAlign: "right" },
  bold:    { fontWeight: "700", color: K.colors.textDark },
});

// ── Screen ────────────────────────────────────────────────────────────────────

export default function AnalyticsScreen() {
  const router   = useRouter();
  const user     = useAuthStore((s) => s.user);
  const currency = getCurrencyForCountry(user?.country).code;

  const commissionQ = useQuery<CommissionRate>({
    queryKey: ["commissionRate", user?.country],
    queryFn: async () => {
      const country = user?.country ?? "ZA";
      const res = await listingApi.get<{ data: CommissionRate }>(`/commission-rates/effective/${country}`);
      return res.data.data;
    },
    staleTime: 300_000,
    enabled: !!user?.country,
  });

  const { data, isLoading, isError, refetch, isRefetching } = useQuery<EarningsData>({
    queryKey: ["providerEarnings"],
    queryFn: async () => {
      const res = await listingApi.get<{ data: any }>("/provider/earnings");
      const raw = res.data?.data || {};

      const allTime       = raw.allTime || { revenue: 0, commission: 0, payout: 0 };
      const monthly       = raw.monthly || [];
      const thisMonthData = monthly[monthly.length - 1] || { revenue: 0, payout: 0, commission: 0, bookings: 0 };
      const lastMonthData = monthly[monthly.length - 2] || { revenue: 0, payout: 0, commission: 0, bookings: 0 };
      const totalBookings = monthly.reduce((sum: number, m: any) => sum + (m.bookings || 0), 0);

      return {
        totalEarnings:       Number(allTime.revenue || 0),
        thisMonthEarnings:   Number(thisMonthData.revenue || 0),
        lastMonthEarnings:   Number(lastMonthData.revenue || 0),
        totalCommission:     Number(allTime.commission || 0),
        netPayout:           Number(allTime.payout || 0),
        totalBookings,
        completedBookings:   totalBookings,
        averageBookingValue: totalBookings > 0 ? Number(allTime.revenue || 0) / totalBookings : 0,
        occupancyRate:       0,
        monthlyRevenue:      monthly.map((m: any) => ({
          month:    m.month,
          revenue:  Number(m.revenue || 0),
          bookings: Number(m.bookings || 0),
        })),
      };
    },
  });

  const momChange = data ? pct(data.thisMonthEarnings, data.lastMonthEarnings) : "—";
  const momUp     = data ? data.thisMonthEarnings >= data.lastMonthEarnings : undefined;

  return (
    <AppLayout>
      <View style={s.container}>
      {isLoading ? (
        <View style={s.center}>
          <ActivityIndicator color={K.colors.accent} size="large" />
        </View>
      ) : isError || !data ? (
        <View style={s.center}>
          <Ionicons name="cloud-offline-outline" size={52} color="#d1d5db" />
          <Text style={s.errorText}>Could not load analytics</Text>
          <TouchableOpacity style={s.retryBtn} onPress={() => refetch()}>
            <Text style={s.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={K.colors.accent} />
          }
        >
          {/* Hero earnings card */}
          <View style={s.hero}>
            <Text style={s.heroSublabel}>TOTAL EARNINGS</Text>
            <Text style={s.heroValue}>{fmt(data.totalEarnings, currency)}</Text>

            <View style={s.heroDivider} />

            <View style={s.heroRow}>
              <View style={s.heroItem}>
                <Text style={s.heroItemLabel}>This Month</Text>
                <Text style={s.heroItemValue}>{fmt(data.thisMonthEarnings, currency)}</Text>
                <View style={s.momChip}>
                  <Ionicons
                    name={momUp ? "trending-up" : "trending-down"}
                    size={11}
                    color={momUp ? "#34d399" : "#f87171"}
                  />
                  <Text style={[s.momText, { color: momUp ? "#34d399" : "#f87171" }]}>
                    {momChange}
                  </Text>
                </View>
              </View>

              <View style={s.heroDividerV} />

              <View style={s.heroItem}>
                <Text style={s.heroItemLabel}>Net Payout</Text>
                <Text style={s.heroItemValue}>{fmt(data.netPayout, currency)}</Text>
                <Text style={s.heroItemNote}>after {fmt(data.totalCommission, currency)} fee</Text>
              </View>
            </View>

            <View style={s.heroDivider} />

            <TouchableOpacity
              style={s.withdrawBtn}
              onPress={() => router.push("/(provider)/payouts")}
              activeOpacity={0.8}
            >
              <Ionicons name="wallet-outline" size={16} color={K.colors.darkGreen} />
              <Text style={s.withdrawBtnText}>Withdraw Now</Text>
              <Ionicons name="arrow-forward" size={14} color={K.colors.darkGreen} style={{ marginLeft: "auto" }} />
            </TouchableOpacity>
          </View>

          {/* Stats grid */}
          <View style={s.statsRow}>
            <StatCard
              icon="cash-outline"
              label="Avg Booking"
              value={fmt(data.averageBookingValue, currency)}
              accent="#7c3aed"
            />
            <StatCard
              icon="calendar-outline"
              label="Total Bookings"
              value={String(data.totalBookings)}
              accent="#0891b2"
            />
          </View>
          <View style={s.statsRow}>
            <StatCard
              icon="checkmark-circle-outline"
              label="Completed"
              value={String(data.completedBookings)}
              accent="#16a34a"
            />
            <StatCard
              icon="home-outline"
              label="Occupancy"
              value={`${data.occupancyRate?.toFixed(1) ?? "0"}%`}
              accent="#d97706"
            />
          </View>

          {/* Commission rate banner */}
          {commissionQ.data && (
            <View style={s.commissionBanner}>
              <Ionicons name="information-circle-outline" size={16} color={K.colors.accent} />
              <Text style={s.commissionBannerText}>
                Your effective commission rate for {commissionQ.data.country}:{" "}
                <Text style={s.commissionBannerRate}>{(commissionQ.data.rate * 100).toFixed(1)}%</Text>
              </Text>
            </View>
          )}

          {/* Charts */}
          {data.monthlyRevenue?.length > 0 && (
            <>
              <RevenueChart data={data.monthlyRevenue} currency={currency} />
              <MonthlyTable data={data.monthlyRevenue} currency={currency} />
            </>
          )}

          <View style={{ height: 32 }} />
        </ScrollView>
      )}
      </View>
    </AppLayout>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F4F1" },

  scroll: { padding: 16, gap: 14 },

  hero: {
    backgroundColor: K.colors.darkGreen,
    borderRadius: 24,
    padding: 24,
    ...K.shadow.brand,
  },
  heroSublabel: { fontSize: 10, fontWeight: "800", color: "rgba(255,255,255,0.5)", letterSpacing: 1.2, marginBottom: 6 },
  heroValue:    { fontSize: 38, fontWeight: "900", color: "#fff", letterSpacing: -1.5, lineHeight: 44 },
  heroDivider:  { height: 1, backgroundColor: "rgba(255,255,255,0.12)", marginVertical: 18 },
  heroRow:      { flexDirection: "row", gap: 16 },
  heroItem:     { flex: 1 },
  heroItemLabel:{ fontSize: 10, fontWeight: "600", color: "rgba(255,255,255,0.55)", letterSpacing: 0.4, marginBottom: 4 },
  heroItemValue:{ fontSize: 18, fontWeight: "800", color: "#fff", marginBottom: 4 },
  heroItemNote: { fontSize: 10, color: "rgba(255,255,255,0.4)" },
  heroDividerV: { width: 1, backgroundColor: "rgba(255,255,255,0.12)" },
  momChip:  { flexDirection: "row", alignItems: "center", gap: 4 },
  momText:  { fontSize: 11, fontWeight: "700" },

  withdrawBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  withdrawBtnText: { fontSize: 14, fontWeight: "700", color: K.colors.darkGreen, flex: 1 },

  statsRow: { flexDirection: "row", gap: 12 },

  commissionBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderWidth: 1,
    borderColor: K.colors.border,
    ...K.shadow.sm,
  },
  commissionBannerText: { fontSize: 13, color: K.colors.textMuted, flex: 1 },
  commissionBannerRate: { fontWeight: "800", color: K.colors.darkGreen },

  center:    { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, padding: 32 },
  errorText: { fontSize: 16, fontWeight: "700", color: K.colors.textDark, textAlign: "center" },
  retryBtn:  { backgroundColor: K.colors.darkGreen, borderRadius: 12, paddingHorizontal: 28, paddingVertical: 13 },
  retryText: { color: "#fff", fontWeight: "700" },
});
