import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { listingApi } from "../../lib/listing-api";
import { useAuthStore } from "../../store/auth";
import { getCurrencyForCountry } from "../../lib/currency";
import { K } from "../../constants/theme";

const { width } = Dimensions.get("window");

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

function fmt(n: number, currency = "USD") {
  if (n >= 1_000_000) return `${currency} ${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${currency} ${(n / 1_000).toFixed(1)}K`;
  return `${currency} ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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

function StatCard({
  label, value, sub, positive,
}: { label: string; value: string; sub?: string; positive?: boolean }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      {sub ? (
        <Text style={[styles.statSub, { color: positive === false ? K.colors.error : K.colors.success }]}>
          {sub}
        </Text>
      ) : null}
    </View>
  );
}

function RevenueChart({ data, currency }: { data: MonthlyRevenue[]; currency: string }) {
  const slice = data.slice(-6);
  const maxRev = Math.max(...slice.map((d) => d.revenue), 1);
  const BAR_H = 100;

  return (
    <View style={styles.chartCard}>
      <Text style={styles.chartTitle}>Monthly Revenue</Text>
      <View style={styles.chartBars}>
        {slice.map((item) => (
          <View key={item.month} style={styles.chartCol}>
            <Text style={styles.chartValue}>
              {item.revenue >= 1000 ? `${currency} ${(item.revenue / 1000).toFixed(0)}K` : ""}
            </Text>
            <View style={styles.chartTrack}>
              <View
                style={[
                  styles.chartBar,
                  { height: Math.max(4, Math.round(BAR_H * (item.revenue / maxRev))) },
                ]}
              />
            </View>
            <Text style={styles.chartXLabel}>{monthLabel(item.month)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function MonthlyTable({ data, currency }: { data: MonthlyRevenue[]; currency: string }) {
  return (
    <View style={styles.tableCard}>
      <Text style={styles.chartTitle}>Monthly Breakdown</Text>
      <View style={styles.tableHeader}>
        <Text style={[styles.tableCell, styles.tableCellWide]}>Month</Text>
        <Text style={[styles.tableCell, styles.tableCellRight]}>Revenue</Text>
        <Text style={[styles.tableCell, styles.tableCellRight]}>Bookings</Text>
      </View>
      {data.slice(-6).reverse().map((item, i) => (
        <View key={item.month} style={[styles.tableRow, i % 2 === 1 && styles.tableRowAlt]}>
          <Text style={[styles.tableCell, styles.tableCellWide]}>{monthLabel(item.month)}</Text>
          <Text style={[styles.tableCell, styles.tableCellRight, styles.tableCellBold]}>
            {fmt(item.revenue, currency)}
          </Text>
          <Text style={[styles.tableCell, styles.tableCellRight]}>{item.bookings}</Text>
        </View>
      ))}
    </View>
  );
}

export default function AnalyticsScreen() {
  const user = useAuthStore((s) => s.user);
  const currency = getCurrencyForCountry(user?.country).code;

  const { data, isLoading, isError, refetch, isRefetching } = useQuery<EarningsData>({
    queryKey: ["providerEarnings"],
    queryFn: async () => {
      const res = await listingApi.get<{ data: any }>("/provider/earnings");
      const raw = res.data?.data || {};
      
      const allTime = raw.allTime || { revenue: 0, commission: 0, payout: 0 };
      const monthly = raw.monthly || [];
      
      const thisMonthData = monthly[monthly.length - 1] || { revenue: 0, payout: 0, commission: 0, bookings: 0 };
      const lastMonthData = monthly[monthly.length - 2] || { revenue: 0, payout: 0, commission: 0, bookings: 0 };
      
      const totalBookings = monthly.reduce((sum: number, m: any) => sum + (m.bookings || 0), 0);
      
      return {
        totalEarnings: Number(allTime.revenue || 0),
        thisMonthEarnings: Number(thisMonthData.revenue || 0),
        lastMonthEarnings: Number(lastMonthData.revenue || 0),
        totalCommission: Number(allTime.commission || 0),
        netPayout: Number(allTime.payout || 0),
        totalBookings: totalBookings,
        completedBookings: totalBookings,
        averageBookingValue: totalBookings > 0 ? (Number(allTime.revenue || 0) / totalBookings) : 0,
        occupancyRate: 0,
        monthlyRevenue: monthly.map((m: any) => ({
          month: m.month,
          revenue: Number(m.revenue || 0),
          bookings: Number(m.bookings || 0),
        })),
      };
    },
  });

  const momChange = data ? pct(data.thisMonthEarnings, data.lastMonthEarnings) : "—";
  const momUp = data ? data.thisMonthEarnings >= data.lastMonthEarnings : undefined;

  return (
    <View style={styles.container}>
      <SafeAreaView edges={["top"]} style={styles.header}>
        <View style={styles.headerRow}>
          <Image
            source={require("../../assets/logo.png")}
            style={styles.logo}
            resizeMode="contain"
          />
          <View>
            <Text style={styles.headerTitle}>Analytics</Text>
            <Text style={styles.headerSub}>Earnings &amp; Performance</Text>
          </View>
        </View>
      </SafeAreaView>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={K.colors.accent} size="large" />
        </View>
      ) : isError || !data ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>Could not load analytics</Text>
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
          {/* Hero */}
          <View style={styles.heroCard}>
            <Text style={styles.heroLabel}>Total Earnings</Text>
            <Text style={styles.heroValue}>{fmt(data.totalEarnings, currency)}</Text>
            <View style={styles.heroDivider} />
            <View style={styles.heroSubRow}>
              <View style={styles.heroSubItem}>
                <Text style={styles.heroSubLabel}>This Month</Text>
                <Text style={styles.heroSubValue}>{fmt(data.thisMonthEarnings, currency)}</Text>
                <Text style={[styles.heroDelta, { color: momUp ? K.colors.accentLight : "#FCA5A5" }]}>
                  {momChange} vs last month
                </Text>
              </View>
              <View style={styles.heroSubDivider} />
              <View style={styles.heroSubItem}>
                <Text style={styles.heroSubLabel}>Net Payout</Text>
                <Text style={styles.heroSubValue}>{fmt(data.netPayout, currency)}</Text>
                <Text style={styles.heroSubNote}>after {fmt(data.totalCommission, currency)} commission</Text>
              </View>
            </View>
          </View>

          {/* Stats grid */}
          <View style={styles.statsGrid}>
            <StatCard
              label="Avg Booking Value"
              value={fmt(data.averageBookingValue, currency)}
            />
            <StatCard
              label="Occupancy Rate"
              value={`${data.occupancyRate?.toFixed(1) ?? "—"}%`}
            />
            <StatCard
              label="Total Bookings"
              value={String(data.totalBookings)}
            />
            <StatCard
              label="Completed"
              value={String(data.completedBookings)}
            />
          </View>

          {/* Revenue chart */}
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
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: K.colors.bgLight },

  header: {
    backgroundColor: K.colors.darkGreen,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  logo: { width: 32, height: 32, borderRadius: 8 },
  headerTitle: { fontSize: K.font.xl, fontWeight: "800", color: "#fff" },
  headerSub: { fontSize: K.font.sm, color: K.colors.textLightMuted, marginTop: 2 },

  scroll: { padding: 16, gap: 16 },

  heroCard: {
    backgroundColor: K.colors.darkGreen,
    borderRadius: K.radius.xl,
    padding: 24,
    ...K.shadow.md,
  },
  heroLabel: { fontSize: K.font.sm, color: K.colors.textLightMuted, fontWeight: "600", letterSpacing: 0.5, marginBottom: 6 },
  heroValue: { fontSize: 40, fontWeight: "900", color: "#fff", letterSpacing: -1 },
  heroDivider: { height: 1, backgroundColor: K.colors.glassBorder, marginVertical: 18 },
  heroSubRow: { flexDirection: "row", gap: 16 },
  heroSubItem: { flex: 1 },
  heroSubDivider: { width: 1, backgroundColor: K.colors.glassBorder },
  heroSubLabel: { fontSize: 11, color: K.colors.textLightDim, marginBottom: 4, fontWeight: "600" },
  heroSubValue: { fontSize: K.font.xl, fontWeight: "800", color: "#fff", marginBottom: 4 },
  heroDelta: { fontSize: 11, fontWeight: "600" },
  heroSubNote: { fontSize: 10, color: K.colors.textLightDim },

  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  statCard: {
    width: (width - 44) / 2,
    backgroundColor: K.colors.bgCard,
    borderRadius: K.radius.xl,
    padding: 16,
    borderWidth: 1,
    borderColor: K.colors.border,
    ...K.shadow.sm,
  },
  statLabel: { fontSize: 11, color: K.colors.textMuted, fontWeight: "600", marginBottom: 8, letterSpacing: 0.3 },
  statValue: { fontSize: K.font.xl, fontWeight: "800", color: K.colors.textDark },
  statSub: { fontSize: 12, fontWeight: "600", marginTop: 4 },

  chartCard: {
    backgroundColor: K.colors.bgCard,
    borderRadius: K.radius.xl,
    padding: 20,
    borderWidth: 1,
    borderColor: K.colors.border,
    ...K.shadow.sm,
  },
  chartTitle: { fontSize: K.font.base, fontWeight: "700", color: K.colors.textDark, marginBottom: 16 },
  chartBars: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", height: 130 },
  chartCol: { flex: 1, alignItems: "center" },
  chartValue: { fontSize: 9, color: K.colors.textMuted, marginBottom: 4, textAlign: "center" },
  chartTrack: { height: 100, justifyContent: "flex-end", width: "100%", alignItems: "center" },
  chartBar: { width: "55%", backgroundColor: K.colors.accent, borderRadius: 3 },
  chartXLabel: { fontSize: 10, color: K.colors.textMuted, marginTop: 6, fontWeight: "500" },

  tableCard: {
    backgroundColor: K.colors.bgCard,
    borderRadius: K.radius.xl,
    padding: 20,
    borderWidth: 1,
    borderColor: K.colors.border,
    ...K.shadow.sm,
  },
  tableHeader: {
    flexDirection: "row",
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: K.colors.border,
    marginBottom: 4,
  },
  tableRow: { flexDirection: "row", paddingVertical: 11 },
  tableRowAlt: { backgroundColor: K.colors.bgLight, borderRadius: K.radius.sm },
  tableCell: { fontSize: K.font.sm, color: K.colors.textMid },
  tableCellWide: { flex: 1.2 },
  tableCellRight: { flex: 1, textAlign: "right" },
  tableCellBold: { fontWeight: "700", color: K.colors.textDark },

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
