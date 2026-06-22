import { useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
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
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
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

function nightsLabel(booking: BookingSummary): string {
  const n = booking.nightsOrDays;
  if (!n) return "";
  if (booking.listingType === "car") return `${n} day${n !== 1 ? "s" : ""}`;
  return `${n} night${n !== 1 ? "s" : ""}`;
}

function statusConfig(status: BookingStatus): { label: string; bg: string; text: string; dot: string; stripe: string } {
  switch (status) {
    case "confirmed":
      return { label: "Confirmed",       ...K.colors.confirmed  };
    case "pending":
    case "pending_payment":
      return { label: "Pending",         ...K.colors.pending    };
    case "active":
      return { label: "Active",          ...K.colors.active     };
    case "completed":
      return { label: "Completed",       ...K.colors.completed  };
    case "refunded":
      return { label: "Refunded",        bg: "#f0fdf4", text: "#16a34a", dot: "#16a34a", stripe: "#16a34a" };
    default:
      return { label: "Cancelled",       ...K.colors.cancelled  };
  }
}

// ── Skeleton Card ─────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <View style={styles.card}>
      <View style={[styles.statusStripe, { backgroundColor: K.colors.border }]} />
      <View style={[styles.thumb, { backgroundColor: K.colors.bgSubtle }]} />
      <View style={styles.cardInner}>
        <View style={[styles.skeletonLine, { width: "65%", height: 14, marginBottom: 8 }]} />
        <View style={[styles.skeletonLine, { width: "40%", height: 11, marginBottom: 8 }]} />
        <View style={[styles.skeletonLine, { width: "55%", height: 11, marginBottom: 12 }]} />
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View style={[styles.skeletonLine, { width: "38%", height: 16 }]} />
          <View style={[styles.skeletonLine, { width: "24%", height: 22, borderRadius: K.radius.full }]} />
        </View>
      </View>
    </View>
  );
}

// ── Booking Card ──────────────────────────────────────────────────────────────

function BookingCard({ booking }: { booking: BookingSummary }) {
  const router = useRouter();
  const cfg    = statusConfig(booking.status);
  const [imgErr, setImgErr] = useState(false);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/booking/${booking.id}` as any)}
      activeOpacity={0.8}
    >
      {/* Left status stripe */}
      <View style={[styles.statusStripe, { backgroundColor: cfg.stripe }]} />

      {/* Thumbnail */}
      {!imgErr && booking.listingPrimaryPhotoUrl ? (
        <ListingImage
          uri={booking.listingPrimaryPhotoUrl}
          style={styles.thumb}
          resizeMode="cover"
          onError={() => setImgErr(true)}
        />
      ) : (
        <View style={[styles.thumb, styles.thumbFallback]}>
          <Ionicons
            name={booking.listingType === "car" ? "car-outline" : "business-outline"}
            size={22}
            color={K.colors.textMuted}
          />
        </View>
      )}

      {/* Content */}
      <View style={styles.cardInner}>
        <Text style={styles.cardTitle} numberOfLines={1}>{booking.listingTitle}</Text>
        <Text style={styles.cardRef}>{booking.reference}</Text>
        <Text style={styles.cardDates} numberOfLines={1}>{formatDateRange(booking)}</Text>
        {nightsLabel(booking) ? (
          <Text style={styles.cardNights}>{nightsLabel(booking)}</Text>
        ) : null}

        <View style={styles.cardFooter}>
          <Text style={styles.cardAmount}>
            {booking.currency} {booking.totalAmount.toLocaleString()}
          </Text>
          <View style={[styles.statusPill, { backgroundColor: cfg.bg }]}>
            <View style={[styles.statusDot, { backgroundColor: cfg.dot }]} />
            <Text style={[styles.statusLabel, { color: cfg.text }]}>{cfg.label}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── Empty State ───────────────────────────────────────────────────────────────

function EmptyState({ tab }: { tab: TabFilter }) {
  const config: Record<TabFilter, { icon: string; title: string; sub: string }> = {
    upcoming:  { icon: "airplane-outline",    title: "No upcoming trips",        sub: "Book a stay or car to see it here"  },
    active:    { icon: "navigate-outline",    title: "No active bookings",       sub: "Your current stays appear here"     },
    completed: { icon: "checkmark-circle-outline", title: "No completed trips",  sub: "Past bookings will appear here"     },
    cancelled: { icon: "close-circle-outline", title: "No cancelled bookings",   sub: "Cancelled bookings will show here"  },
  };
  const cfg = config[tab];

  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconWrap}>
        <Ionicons name={cfg.icon as any} size={32} color={K.colors.textMuted} />
      </View>
      <Text style={styles.emptyTitle}>{cfg.title}</Text>
      <Text style={styles.emptySub}>{cfg.sub}</Text>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

const TABS: { key: TabFilter; label: string }[] = [
  { key: "upcoming",  label: "Upcoming"  },
  { key: "active",    label: "Active"    },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
];

export default function BookingsScreen() {
  const [activeTab, setActiveTab] = useState<TabFilter>("upcoming");

  const { data, isLoading, isError, refetch, isRefetching } = useQuery<BookingsResponse>({
    queryKey: ["myBookings", activeTab],
    queryFn:  async () => {
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
        <Text style={styles.headerTitle}>My Trips</Text>
        {data?.total != null && data.total > 0 && (
          <View style={styles.totalBadge}>
            <Text style={styles.totalBadgeText}>{data.total}</Text>
          </View>
        )}
      </View>

      {/* Tab pills */}
      <View style={styles.tabBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabScroll}>
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tabChip, activeTab === tab.key && styles.tabChipActive]}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabChipLabel, activeTab === tab.key && styles.tabChipLabelActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Content */}
      {isLoading ? (
        <ScrollView contentContainerStyle={styles.listContent}>
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </ScrollView>
      ) : isError ? (
        <View style={styles.emptyState}>
          <Ionicons name="cloud-offline-outline" size={40} color={K.colors.textMuted} />
          <Text style={styles.emptyTitle}>Couldn't load trips</Text>
          <Text style={styles.emptySub}>Pull down to retry</Text>
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
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        />
      )}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: K.colors.bgApp },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: K.spacing.screen,
    paddingTop: 8,
    paddingBottom: 14,
    backgroundColor: K.colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: K.colors.border,
  },
  headerTitle: { fontSize: K.font.xxl, fontWeight: "800", color: K.colors.textDark, letterSpacing: -0.5 },
  totalBadge: {
    backgroundColor: K.colors.darkGreen,
    borderRadius: K.radius.full,
    minWidth: 24,
    height: 24,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  totalBadgeText: { color: "#fff", fontSize: 12, fontWeight: "700" },

  // Tab bar
  tabBar: {
    backgroundColor: K.colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: K.colors.border,
  },
  tabScroll: {
    paddingHorizontal: K.spacing.screen,
    paddingVertical: 12,
    gap: 8,
  },
  tabChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: K.radius.full,
    backgroundColor: K.colors.bgSubtle,
    borderWidth: 1.5,
    borderColor: K.colors.border,
  },
  tabChipActive: {
    backgroundColor: K.colors.darkGreen,
    borderColor:     K.colors.darkGreen,
  },
  tabChipLabel: {
    fontSize: K.font.sm,
    fontWeight: "600",
    color: K.colors.textMuted,
  },
  tabChipLabelActive: {
    color: "#fff",
  },

  // List
  listContent:      { padding: K.spacing.screen },
  listContentEmpty: { flex: 1 },

  // Booking Card
  card: {
    flexDirection: "row",
    backgroundColor: K.colors.bgCard,
    borderRadius: K.radius.lg,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: K.colors.border,
    ...K.shadow.xs,
  },
  statusStripe: {
    width: 4,
  },
  thumb: {
    width: 88,
    height: 110,
    backgroundColor: K.colors.bgSubtle,
  },
  thumbFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  cardInner: {
    flex: 1,
    padding: 12,
    justifyContent: "space-between",
  },
  cardTitle:   { fontSize: K.font.base, fontWeight: "700", color: K.colors.textDark, marginBottom: 3 },
  cardRef:     { fontSize: 11, color: K.colors.textMuted, fontFamily: "monospace", marginBottom: 4 },
  cardDates:   { fontSize: 12, color: K.colors.textMid, marginBottom: 2 },
  cardNights:  { fontSize: 11, color: K.colors.textMuted, marginBottom: 8 },
  cardFooter:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6 },
  cardAmount:  { fontSize: 14, fontWeight: "800", color: K.colors.textDark },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: K.radius.full,
  },
  statusDot:   { width: 6, height: 6, borderRadius: 3 },
  statusLabel: { fontSize: 11, fontWeight: "700" },

  // Skeleton
  skeletonLine: {
    backgroundColor: K.colors.bgSubtle,
    borderRadius: K.radius.sm,
  },

  // Empty state
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 10,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: K.radius.full,
    backgroundColor: K.colors.bgSubtle,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  emptyTitle: { fontSize: K.font.lg, fontWeight: "700", color: K.colors.textDark },
  emptySub:   { fontSize: K.font.sm, color: K.colors.textMuted, textAlign: "center" },
});
