import { useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { listingApi } from "../../lib/listing-api";

// ── Types ─────────────────────────────────────────────────────────────────────

type BookingStatus =
  | "pending"
  | "confirmed"
  | "pending_payment"
  | "active"
  | "completed"
  | "cancelled_by_guest"
  | "cancelled_by_provider"
  | "cancelled_by_system"
  | "refunded";

type TabFilter = "upcoming" | "active" | "completed" | "cancelled";

interface BookingSummary {
  id: string;
  reference: string;
  status: BookingStatus;
  listingType: string;
  listingTitle: string;
  listingPrimaryPhotoUrl: string | null;
  checkIn?: string;
  checkOut?: string;
  pickupDatetime?: string;
  returnDatetime?: string;
  nightsOrDays: number;
  totalAmount: number;
  currency: string;
  createdAt: string;
}

interface BookingsResponse {
  total: number;
  nextCursor: number | null;
  bookings: BookingSummary[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function formatDateTime(isoStr: string): string {
  const d = new Date(isoStr);
  return `${formatShortDate(isoStr)} ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
}

function formatDateRange(booking: BookingSummary): string {
  if (booking.pickupDatetime && booking.returnDatetime) {
    return `${formatDateTime(booking.pickupDatetime)} → ${formatDateTime(booking.returnDatetime)}`;
  }
  if (booking.checkIn && booking.checkOut) {
    return `${formatShortDate(booking.checkIn)} – ${formatShortDate(booking.checkOut)}`;
  }
  return "";
}

function statusInfo(status: BookingStatus): { label: string; bg: string; textColor: string } {
  switch (status) {
    case "pending":
      return { label: "Pending", bg: "#fef3c7", textColor: "#92400e" };
    case "confirmed":
      return { label: "Confirmed", bg: "#dcfce7", textColor: "#16a34a" };
    case "pending_payment":
      return { label: "Pending Payment", bg: "#fef3c7", textColor: "#92400e" };
    case "active":
      return { label: "Active", bg: "#dbeafe", textColor: "#1d4ed8" };
    case "completed":
      return { label: "Completed", bg: "#f3f4f6", textColor: "#6b7280" };
    case "refunded":
      return { label: "Refunded", bg: "#f0fdf4", textColor: "#15803d" };
    case "cancelled_by_guest":
    case "cancelled_by_provider":
    case "cancelled_by_system":
      return { label: "Cancelled", bg: "#fee2e2", textColor: "#dc2626" };
    default:
      return { label: status, bg: "#f3f4f6", textColor: "#6b7280" };
  }
}

// ── Skeleton card ─────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <View style={styles.card}>
      <View style={styles.cardThumb} />
      <View style={styles.cardContent}>
        <View style={[styles.skeletonLine, { width: "70%", marginBottom: 8 }]} />
        <View style={[styles.skeletonLine, { width: "45%", marginBottom: 8 }]} />
        <View style={[styles.skeletonLine, { width: "55%" }]} />
      </View>
    </View>
  );
}

// ── Booking card ──────────────────────────────────────────────────────────────

function BookingCard({ booking }: { booking: BookingSummary }) {
  const router = useRouter();
  const { label, bg, textColor } = statusInfo(booking.status);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/booking/${booking.id}` as any)}
      activeOpacity={0.7}
    >
      {booking.listingPrimaryPhotoUrl ? (
        <Image source={{ uri: booking.listingPrimaryPhotoUrl }} style={styles.cardThumb} />
      ) : (
        <View style={[styles.cardThumb, styles.cardThumbPlaceholder]} />
      )}

      <View style={styles.cardContent}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {booking.listingTitle}
        </Text>
        <Text style={styles.cardReference}>{booking.reference}</Text>
        <Text style={styles.cardDateRange} numberOfLines={1}>
          {formatDateRange(booking)}
        </Text>
        <View style={styles.cardFooter}>
          <Text style={styles.cardAmount}>
            {booking.currency} {booking.totalAmount.toLocaleString()}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: bg }]}>
            <Text style={[styles.statusBadgeText, { color: textColor }]}>{label}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ tab }: { tab: TabFilter }) {
  const messages: Record<TabFilter, string> = {
    upcoming: "No upcoming bookings",
    active: "No active bookings",
    completed: "No completed bookings",
    cancelled: "No cancelled bookings",
  };
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateText}>{messages[tab]}</Text>
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

const TABS: { key: TabFilter; label: string }[] = [
  { key: "upcoming", label: "Upcoming" },
  { key: "active", label: "Active" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
];

export default function BookingsScreen() {
  const [activeTab, setActiveTab] = useState<TabFilter>("upcoming");

  const { data, isLoading, isError, refetch, isRefetching } = useQuery<BookingsResponse>({
    queryKey: ["myBookings", activeTab],
    queryFn: async () => {
      const res = await listingApi.get<{ data: BookingsResponse }>(
        `/guests/me/bookings?status=${activeTab}&cursor=0`
      );
      return res.data.data;
    },
  });

  const bookings = data?.bookings ?? [];

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Bookings</Text>
      </View>

      {/* Tab row */}
      <View style={styles.tabRow}>
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tabItem, activeTab === tab.key && styles.tabItemActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text
              style={[styles.tabLabel, activeTab === tab.key && styles.tabLabelActive]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      {isLoading ? (
        <View style={styles.listContent}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ) : isError ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>Could not load bookings. Pull down to retry.</Text>
        </View>
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <BookingCard booking={item} />}
          contentContainerStyle={[
            styles.listContent,
            bookings.length === 0 && styles.listContentEmpty,
          ]}
          ListEmptyComponent={<EmptyState tab={activeTab} />}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor="#1a73e8"
            />
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
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

  // Tabs
  tabRow: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  tabItem: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabItemActive: { borderBottomColor: "#1a73e8" },
  tabLabel: { fontSize: 14, fontWeight: "500", color: "#6b7280" },
  tabLabelActive: { color: "#1a73e8", fontWeight: "700" },

  // List
  listContent: { padding: 16 },
  listContentEmpty: { flex: 1 },
  separator: { height: 12 },

  // Card
  card: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  cardThumb: {
    width: 80,
    height: 100,
    backgroundColor: "#f3f4f6",
  },
  cardThumbPlaceholder: { backgroundColor: "#e5e7eb" },
  cardContent: {
    flex: 1,
    padding: 12,
    justifyContent: "space-between",
  },
  cardTitle: { fontSize: 15, fontWeight: "700", color: "#111827", marginBottom: 2 },
  cardReference: { fontSize: 12, color: "#6b7280", marginBottom: 4, fontFamily: "monospace" },
  cardDateRange: { fontSize: 12, color: "#374151", marginBottom: 6 },
  cardFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardAmount: { fontSize: 14, fontWeight: "700", color: "#111827" },

  // Status badge
  statusBadge: {
    borderRadius: 20,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusBadgeText: { fontSize: 11, fontWeight: "600" },

  // Skeleton
  skeletonLine: {
    height: 12,
    borderRadius: 6,
    backgroundColor: "#e5e7eb",
  },

  // Empty state
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  emptyStateText: { fontSize: 16, color: "#6b7280", textAlign: "center" },
});
