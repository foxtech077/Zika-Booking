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
import { useAuthStore } from "../../store/auth";
import { ListingImage } from "../../components/ListingImage";
import { K } from "../../constants/theme";


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
      return { label: "Pending", bg: K.colors.pending.bg, textColor: K.colors.pending.text };
    case "confirmed":
      return { label: "Confirmed", bg: K.colors.confirmed.bg, textColor: K.colors.confirmed.text };
    case "pending_payment":
      return { label: "Pending Payment", bg: K.colors.pending.bg, textColor: K.colors.pending.text };
    case "active":
      return { label: "Active", bg: K.colors.active.bg, textColor: K.colors.active.text };
    case "completed":
      return { label: "Completed", bg: K.colors.completed.bg, textColor: K.colors.completed.text };
    case "refunded":
      return { label: "Refunded", bg: K.colors.refunded.bg, textColor: K.colors.refunded.text };
    case "cancelled_by_guest":
    case "cancelled_by_provider":
    case "cancelled_by_system":
      return { label: "Cancelled", bg: K.colors.cancelled.bg, textColor: K.colors.cancelled.text };
    default:
      return { label: status, bg: K.colors.completed.bg, textColor: K.colors.completed.text };
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
  const [imgError, setImgError] = useState(false);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/booking/${booking.id}` as any)}
      activeOpacity={0.7}
    >
      {!imgError && booking.listingPrimaryPhotoUrl ? (
        <ListingImage
          uri={booking.listingPrimaryPhotoUrl}
          style={styles.cardThumb}
          resizeMode="cover"
          onError={() => setImgError(true)}
        />
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
              tintColor={K.colors.accent}
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

  // Tabs
  tabRow: {
    flexDirection: "row",
    backgroundColor: K.colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: K.colors.border,
  },
  tabItem: {
    flex: 1,
    paddingVertical: K.spacing.md,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabItemActive: { borderBottomColor: K.colors.accent },
  tabLabel: { fontSize: K.font.sm, fontWeight: "500", color: K.colors.textMuted },
  tabLabelActive: { color: K.colors.accent, fontWeight: "700" },

  // List
  listContent: { padding: K.spacing.lg },
  listContentEmpty: { flex: 1 },
  separator: { height: K.spacing.md },

  // Card
  card: {
    flexDirection: "row",
    backgroundColor: K.colors.bgCard,
    borderRadius: K.radius.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: K.colors.border,
    ...K.shadow.sm,
  },
  cardThumb: {
    width: 80,
    height: 100,
    backgroundColor: K.colors.bgSection,
  },
  cardThumbPlaceholder: { backgroundColor: K.colors.borderMid },
  cardContent: {
    flex: 1,
    padding: K.spacing.md,
    justifyContent: "space-between",
  },
  cardTitle: { fontSize: K.font.base, fontWeight: "700", color: K.colors.textDark, marginBottom: 2 },
  cardReference: { fontSize: K.font.xs, color: K.colors.textMuted, marginBottom: 4, fontFamily: "monospace" },
  cardDateRange: { fontSize: K.font.xs, color: K.colors.textBody, marginBottom: 6 },
  cardFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardAmount: { fontSize: K.font.sm, fontWeight: "700", color: K.colors.textDark },

  // Status badge
  statusBadge: {
    borderRadius: K.radius.full,
    paddingHorizontal: K.spacing.sm,
    paddingVertical: 3,
  },
  statusBadgeText: { fontSize: K.font.xs, fontWeight: "600" },

  // Skeleton
  skeletonLine: {
    height: 12,
    borderRadius: K.radius.xs,
    backgroundColor: K.colors.bgSection,
  },

  // Empty state
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: K.spacing.xxxl,
  },
  emptyStateText: { fontSize: K.font.base, color: K.colors.textMuted, textAlign: "center" },
});
