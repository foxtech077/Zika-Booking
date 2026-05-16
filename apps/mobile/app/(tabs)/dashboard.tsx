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
      return { label: "Confirmed", bg: "#dcfce7", textColor: "#16a34a" };
    case "pending_payment":
      return { label: "Pending", bg: "#fef3c7", textColor: "#92400e" };
    case "completed":
      return { label: "Completed", bg: "#f3f4f6", textColor: "#6b7280" };
    case "cancelled_by_guest":
    case "cancelled_by_provider":
    case "cancelled_by_system":
      return { label: "Cancelled", bg: "#fee2e2", textColor: "#dc2626" };
    default:
      return { label: status, bg: "#f3f4f6", textColor: "#6b7280" };
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
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#1a73e8" />
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
  container: { flex: 1, backgroundColor: "#f9fafb" },

  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  headerTitle: { fontSize: 24, fontWeight: "800", color: "#111827" },

  scrollContent: { padding: 16, gap: 14 },

  // Stats
  statsRow: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
  },
  statCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    alignItems: "flex-start",
    justifyContent: "center",
    minHeight: 70,
  },
  statCardAccent: {
    backgroundColor: "#eff6ff",
    borderColor: "#bfdbfe",
  },
  statValue: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 4,
    flexShrink: 1,
  },
  statLabel: {
    fontSize: 11,
    color: "#6b7280",
    fontWeight: "500",
  },

  // Chart
  chartCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 16,
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
    backgroundColor: "#1a73e8",
    borderRadius: 4,
    minHeight: 4,
  },
  chartBarLabel: {
    fontSize: 10,
    color: "#6b7280",
    marginTop: 6,
    textAlign: "center",
  },

  // Recent bookings
  recentCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  bookingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: 10,
  },
  bookingRowMain: { flex: 1, marginRight: 12 },
  bookingRowRight: { alignItems: "flex-end", gap: 6 },
  bookingTitle: { fontSize: 14, fontWeight: "700", color: "#111827", marginBottom: 2 },
  bookingGuest: { fontSize: 13, color: "#374151", marginBottom: 2 },
  bookingRef: { fontSize: 11, color: "#9ca3af", fontFamily: "monospace" },
  bookingAmount: { fontSize: 14, fontWeight: "700", color: "#111827" },

  statusBadge: {
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusBadgeText: { fontSize: 11, fontWeight: "600" },

  separator: { height: 1, backgroundColor: "#f3f4f6" },

  // Skeleton
  skeletonBox: {
    backgroundColor: "#e5e7eb",
    borderRadius: 12,
  },

  // Error
  errorState: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  errorText: { fontSize: 16, color: "#6b7280" },
  retryBtn: {
    backgroundColor: "#1a73e8",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  retryBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },

  emptyText: { fontSize: 14, color: "#9ca3af", textAlign: "center", paddingVertical: 16 },
});
