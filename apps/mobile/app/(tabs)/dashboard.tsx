import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { listingApi } from "../../lib/listing-api";
import { K } from "../../constants/theme";

// ── Types ─────────────────────────────────────────────────────────────────────

interface RecentBooking {
  id: string;
  reference: string;
  listingTitle: string;
  guestFirstName: string;
  guestLastName: string;
  status: string;
  totalAmount: number;
  currency: string;
  checkIn: string;
  checkOut: string;
}

interface MonthlyRevenue {
  month: string;
  revenue: number;
}

interface DashboardData {
  totalEarnings: number;
  thisMonthEarnings: number;
  activeListingsCount: number;
  pendingBookingsCount: number;
  completedBookingsCount: number;
  recentBookings: RecentBooking[];
  monthlyRevenue: MonthlyRevenue[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCurrency(amount: number, currency?: string): string {
  return `${currency ?? "USD"} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function statusInfo(status: string): { label: string; bg: string; textColor: string } {
  switch (status) {
    case "confirmed":
      return { label: "Confirmed", bg: K.colors.confirmed.bg, textColor: K.colors.confirmed.text };
    case "pending_payment":
      return { label: "Pending", bg: K.colors.pending.bg, textColor: K.colors.pending.text };
    case "completed":
      return { label: "Completed", bg: K.colors.completed.bg, textColor: K.colors.completed.text };
    case "cancelled_by_guest":
    case "cancelled_by_provider":
    case "cancelled_by_system":
      return { label: "Cancelled", bg: K.colors.cancelled.bg, textColor: K.colors.cancelled.text };
    default:
      return { label: status, bg: K.colors.completed.bg, textColor: K.colors.completed.text };
  }
}

function formatMonthLabel(month: string): string {
  // month is "YYYY-MM"
  const [year, m] = month.split("-");
  const d = new Date(parseInt(year ?? "2026", 10), parseInt(m ?? "1", 10) - 1, 1);
  return d.toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonBox({ width, height }: { width: number | string; height: number }) {
  return (
    <View style={[styles.skeletonBox, { width: width as any, height }]} />
  );
}

function LoadingSkeleton() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Provider Dashboard</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.statsRow}>
          <SkeletonBox width="30%" height={70} />
          <SkeletonBox width="30%" height={70} />
          <SkeletonBox width="30%" height={70} />
        </View>
        <View style={styles.statsRow}>
          <SkeletonBox width="47%" height={70} />
          <SkeletonBox width="47%" height={70} />
        </View>
        <SkeletonBox width="100%" height={200} />
        <SkeletonBox width="100%" height={300} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={[styles.statCard, accent && styles.statCardAccent]}>
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

// ── Bar Chart ─────────────────────────────────────────────────────────────────

function RevenueChart({ data }: { data: MonthlyRevenue[] }) {
  const maxRevenue = Math.max(...data.map((d) => d.revenue), 1);

  return (
    <View style={styles.chartCard}>
      <Text style={styles.sectionTitle}>Monthly Revenue</Text>
      <View style={styles.chartBars}>
        {data.map((item) => {
          const barHeightPct = item.revenue / maxRevenue;
          const BAR_MAX_HEIGHT = 100;
          return (
            <View key={item.month} style={styles.chartBarWrapper}>
              <View style={styles.chartBarContainer}>
                <View
                  style={[
                    styles.chartBar,
                    { height: Math.max(4, Math.round(BAR_MAX_HEIGHT * barHeightPct)) },
                  ]}
                />
              </View>
              <Text style={styles.chartBarLabel}>{formatMonthLabel(item.month)}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// ── Recent Booking Row ────────────────────────────────────────────────────────

function RecentBookingRow({ booking }: { booking: RecentBooking }) {
  const router = useRouter();
  const { label, bg, textColor } = statusInfo(booking.status);

  return (
    <TouchableOpacity
      style={styles.bookingRow}
      onPress={() => router.push(`/booking/${booking.id}` as any)}
      activeOpacity={0.7}
    >
      <View style={styles.bookingRowMain}>
        <Text style={styles.bookingTitle} numberOfLines={1}>{booking.listingTitle}</Text>
        <Text style={styles.bookingGuest}>
          {booking.guestFirstName} {booking.guestLastName}
        </Text>
        <Text style={styles.bookingRef}>{booking.reference}</Text>
      </View>
      <View style={styles.bookingRowRight}>
        <Text style={styles.bookingAmount}>
          {booking.currency} {booking.totalAmount.toLocaleString()}
        </Text>
        <View style={[styles.statusBadge, { backgroundColor: bg }]}>
          <Text style={[styles.statusBadgeText, { color: textColor }]}>{label}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function ProviderDashboardScreen() {
  const { data, isLoading, isError, refetch, isRefetching } = useQuery<DashboardData>({
    queryKey: ["providerDashboard"],
    queryFn: async () => {
      const res = await listingApi.get<{ data: DashboardData }>("/provider/dashboard");
      return res.data.data;
    },
  });

  if (isLoading) return <LoadingSkeleton />;

  if (isError || !data) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Provider Dashboard</Text>
        </View>
        <View style={styles.errorState}>
          <Text style={styles.errorText}>Could not load dashboard.</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const monthlyRevenue = data.monthlyRevenue?.slice(-6) ?? [];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Provider Dashboard</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={K.colors.accent} />
        }
      >
        {/* Stats row 1 */}
        <View style={styles.statsRow}>
          <StatCard
            label="Total Earnings"
            value={formatCurrency(data.totalEarnings)}
            accent
          />
          <StatCard label="This Month" value={formatCurrency(data.thisMonthEarnings)} />
          <StatCard label="Active Listings" value={String(data.activeListingsCount)} />
        </View>

        {/* Stats row 2 */}
        <View style={styles.statsRow}>
          <StatCard label="Pending Bookings" value={String(data.pendingBookingsCount)} />
          <StatCard label="Completed" value={String(data.completedBookingsCount)} />
        </View>

        {/* Monthly Revenue Chart */}
        {monthlyRevenue.length > 0 && <RevenueChart data={monthlyRevenue} />}

        {/* Recent Bookings */}
        <View style={styles.recentCard}>
          <Text style={styles.sectionTitle}>Recent Bookings</Text>
          {data.recentBookings.length === 0 ? (
            <Text style={styles.emptyText}>No bookings yet.</Text>
          ) : (
            data.recentBookings.map((booking, index) => (
              <View key={booking.id}>
                <RecentBookingRow booking={booking} />
                {index < data.recentBookings.length - 1 && (
                  <View style={styles.separator} />
                )}
              </View>
            ))
          )}
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: K.colors.bgSubtle },

  header: {
    paddingHorizontal: K.spacing.lg,
    paddingTop: K.spacing.sm,
    paddingBottom: K.spacing.md,
    backgroundColor: K.colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: K.colors.border,
  },
  headerTitle: { fontSize: K.font.xxl, fontWeight: "800", color: K.colors.textDark },

  scrollContent: { padding: K.spacing.lg, gap: 14 },

  // Stats
  statsRow: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
  },
  statCard: {
    flex: 1,
    backgroundColor: K.colors.bgCard,
    borderRadius: K.radius.lg,
    padding: K.spacing.lg,
    borderWidth: 1,
    borderColor: K.colors.border,
    alignItems: "flex-start",
    justifyContent: "center",
    minHeight: 70,
    ...K.shadow.xs,
  },
  statCardAccent: {
    backgroundColor: K.colors.accentSurface,
    borderColor: K.colors.accentDim,
  },
  statValue: {
    fontSize: K.font.lg,
    fontWeight: "800",
    color: K.colors.textDark,
    marginBottom: 4,
    flexShrink: 1,
  },
  statLabel: {
    fontSize: K.font.xs,
    color: K.colors.textMuted,
    fontWeight: "500",
  },

  // Chart
  chartCard: {
    backgroundColor: K.colors.bgCard,
    borderRadius: K.radius.lg,
    padding: K.spacing.lg,
    borderWidth: 1,
    borderColor: K.colors.border,
    ...K.shadow.xs,
  },
  sectionTitle: {
    fontSize: K.font.base,
    fontWeight: "700",
    color: K.colors.textDark,
    marginBottom: K.spacing.lg,
  },
  chartBars: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-around",
    height: 120,
  },
  chartBarWrapper: {
    alignItems: "center",
    flex: 1,
  },
  chartBarContainer: {
    height: 100,
    justifyContent: "flex-end",
    width: "100%",
    alignItems: "center",
  },
  chartBar: {
    width: "60%",
    backgroundColor: K.colors.accent,
    borderRadius: K.radius.xs,
    minHeight: 4,
  },
  chartBarLabel: {
    fontSize: K.font.xs,
    color: K.colors.textMuted,
    marginTop: 6,
    textAlign: "center",
  },

  // Recent bookings
  recentCard: {
    backgroundColor: K.colors.bgCard,
    borderRadius: K.radius.lg,
    padding: K.spacing.lg,
    borderWidth: 1,
    borderColor: K.colors.border,
    ...K.shadow.xs,
  },
  bookingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: K.spacing.sm + 2,
  },
  bookingRowMain: { flex: 1, marginRight: K.spacing.md },
  bookingRowRight: { alignItems: "flex-end", gap: 6 },
  bookingTitle: { fontSize: K.font.sm + 1, fontWeight: "700", color: K.colors.textDark, marginBottom: 2 },
  bookingGuest: { fontSize: K.font.sm, color: K.colors.textBody, marginBottom: 2 },
  bookingRef: { fontSize: K.font.xs, color: K.colors.textSubtle, fontFamily: "monospace" },
  bookingAmount: { fontSize: K.font.sm + 1, fontWeight: "700", color: K.colors.textDark },

  statusBadge: {
    borderRadius: K.radius.full,
    paddingHorizontal: K.spacing.sm,
    paddingVertical: 3,
  },
  statusBadgeText: { fontSize: K.font.xs, fontWeight: "600" },

  separator: { height: 1, backgroundColor: K.colors.bgSection },

  // Skeleton
  skeletonBox: {
    backgroundColor: K.colors.bgSection,
    borderRadius: K.radius.md,
  },

  // Error
  errorState: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  errorText: { fontSize: K.font.base, color: K.colors.textMuted },
  retryBtn: {
    backgroundColor: K.colors.accent,
    borderRadius: K.radius.sm + 2,
    paddingVertical: K.spacing.sm + 2,
    paddingHorizontal: K.spacing.xxl,
  },
  retryBtnText: { color: K.colors.textLight, fontWeight: "700", fontSize: K.font.sm + 1 },

  emptyText: { fontSize: K.font.sm + 1, color: K.colors.textSubtle, textAlign: "center", paddingVertical: K.spacing.lg },
});
