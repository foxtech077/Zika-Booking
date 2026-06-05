import { useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { listingApi } from "../../lib/listing-api";
import { K } from "../../constants/theme";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ProviderBooking {
  id: string;
  reference: string;
  listingTitle: string;
  listingCategory: "hotel" | "apartment" | "car";
  guestFirstName: string;
  guestLastName: string;
  status: string;
  totalAmount: number;
  netPayout?: number;
  currency: string;
  checkIn: string;
  checkOut: string;
  nightsOrDays?: number;
  guests?: number;
}

interface BookingListResponse {
  bookings: ProviderBooking[];
  total: number;
}

// ── Config ────────────────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  confirmed:            { label: "Confirmed",  bg: "#D1FAE5", text: "#065F46", dot: "#059669" },
  active:               { label: "Active",     bg: "#DBEAFE", text: "#1D4ED8", dot: "#3B82F6" },
  pending_payment:      { label: "Pending",    bg: "#FEF3C7", text: "#92400E", dot: "#F59E0B" },
  completed:            { label: "Completed",  bg: "#F3F4F6", text: "#6B7280", dot: "#9CA3AF" },
  cancelled_by_guest:   { label: "Cancelled",  bg: "#FEE2E2", text: "#DC2626", dot: "#EF4444" },
  cancelled_by_provider:{ label: "Cancelled",  bg: "#FEE2E2", text: "#DC2626", dot: "#EF4444" },
  cancelled_by_system:  { label: "Cancelled",  bg: "#FEE2E2", text: "#DC2626", dot: "#EF4444" },
};

const FILTER_TABS = [
  { key: "all",       label: "All",       statusParam: undefined },
  { key: "upcoming",  label: "Upcoming",  statusParam: "confirmed" },
  { key: "active",    label: "Active",    statusParam: "active" },
  { key: "completed", label: "Completed", statusParam: "completed" },
  { key: "cancelled", label: "Cancelled", statusParam: "cancelled" },
];

const COMMISSION_RATE = 0.05;

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en", { day: "numeric", month: "short", year: "2-digit" });
}

function guestDisplay(first: string, last: string) {
  const initial = last?.[0]?.toUpperCase();
  return initial ? `${first} ${initial}.` : first;
}

function netPayout(booking: ProviderBooking): number {
  if (booking.netPayout != null) return booking.netPayout;
  return Math.round(booking.totalAmount * (1 - COMMISSION_RATE) * 100) / 100;
}

// ── Booking card ──────────────────────────────────────────────────────────────

function BookingCard({ item }: { item: ProviderBooking }) {
  const st = STATUS_CFG[item.status] ?? STATUS_CFG.completed!;
  const isCar = item.listingCategory === "car";
  const duration = item.nightsOrDays;
  const durationLabel = duration
    ? `${duration} ${isCar ? (duration === 1 ? "day" : "days") : (duration === 1 ? "night" : "nights")}`
    : null;
  const net = netPayout(item);

  return (
    <TouchableOpacity
      style={s.card}
      onPress={() => router.push(`/provider/booking/${item.id}` as any)}
      activeOpacity={0.85}
    >
      {/* Header row */}
      <View style={s.cardHeader}>
        <View style={s.guestRow}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{item.guestFirstName[0]?.toUpperCase() ?? "?"}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.guestName}>{guestDisplay(item.guestFirstName, item.guestLastName)}</Text>
            <Text style={s.listingName} numberOfLines={1}>{item.listingTitle}</Text>
          </View>
        </View>
        <View style={[s.badge, { backgroundColor: st.bg }]}>
          <View style={[s.badgeDot, { backgroundColor: st.dot }]} />
          <Text style={[s.badgeText, { color: st.text }]}>{st.label}</Text>
        </View>
      </View>

      <View style={s.divider} />

      {/* Dates row */}
      <View style={s.datesRow}>
        <View style={s.dateBlock}>
          <Text style={s.dateLabel}>{isCar ? "Pickup" : "Check-in"}</Text>
          <Text style={s.dateValue}>{fmtDate(item.checkIn)}</Text>
        </View>
        <View style={s.dateMid}>
          <View style={s.dateLine} />
          {durationLabel && <Text style={s.durLabel}>{durationLabel}</Text>}
          <View style={s.dateLine} />
        </View>
        <View style={[s.dateBlock, { alignItems: "flex-end" }]}>
          <Text style={s.dateLabel}>{isCar ? "Return" : "Check-out"}</Text>
          <Text style={s.dateValue}>{fmtDate(item.checkOut)}</Text>
        </View>
      </View>

      {/* Footer row */}
      <View style={s.cardFooter}>
        <Text style={s.refText}>{item.reference}</Text>
        <View style={s.payoutBadge}>
          <Feather name="trending-up" size={11} color={K.colors.accent} />
          <Text style={s.payoutText}>{item.currency} {net.toLocaleString()}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function ProviderBookingsScreen() {
  const [activeTab, setActiveTab] = useState("all");

  const { data, isLoading, isError, refetch, isRefetching } = useQuery<BookingListResponse>({
    queryKey: ["providerBookings", activeTab],
    queryFn: async () => {
      const tab = FILTER_TABS.find((t) => t.key === activeTab);
      const params: Record<string, string> = {};
      if (tab?.statusParam) params.status = tab.statusParam;
      const res = await listingApi.get<{ data: BookingListResponse }>("/provider/bookings", { params });
      return res.data.data;
    },
  });

  const bookings = data?.bookings ?? [];

  return (
    <View style={s.container}>
      <SafeAreaView edges={["top"]} style={s.header}>
        <View style={s.headerTop}>
          <Image source={require("../../assets/logo.png")} style={s.logo} resizeMode="contain" />
          <View>
            <Text style={s.headerTitle}>Reservations</Text>
            <Text style={s.headerSub}>{data ? `${data.total} total` : "Loading…"}</Text>
          </View>
        </View>

        {/* Commission info banner */}
        <View style={s.commissionBanner}>
          <Feather name="info" size={12} color={K.colors.accent} />
          <Text style={s.commissionBannerText}>
            Amounts shown are your net earnings after ZikaBooking's 5% service fee.
          </Text>
        </View>

        {/* Filter tabs */}
        <FlatList
          data={FILTER_TABS}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(t) => t.key}
          contentContainerStyle={s.tabsScroll}
          renderItem={({ item: tab }) => (
            <TouchableOpacity
              style={[s.tab, activeTab === tab.key && s.tabActive]}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.75}
            >
              <Text style={[s.tabText, activeTab === tab.key && s.tabTextActive]}>{tab.label}</Text>
            </TouchableOpacity>
          )}
        />
      </SafeAreaView>

      {isLoading ? (
        <View style={s.center}>
          <ActivityIndicator color={K.colors.accent} size="large" />
        </View>
      ) : isError ? (
        <View style={s.center}>
          <Feather name="alert-circle" size={40} color={K.colors.error} />
          <Text style={s.errorText}>Could not load bookings</Text>
          <TouchableOpacity style={s.retryBtn} onPress={() => refetch()}>
            <Text style={s.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={(item) => item.id}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={K.colors.accent} />
          }
          ListEmptyComponent={
            <View style={s.emptyBox}>
              <Feather name="calendar" size={52} color={K.colors.border} />
              <Text style={s.emptyTitle}>No bookings found</Text>
              <Text style={s.emptySub}>Reservations in this category will appear here.</Text>
            </View>
          }
          renderItem={({ item }) => <BookingCard item={item} />}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          ListFooterComponent={() => <View style={{ height: 32 }} />}
        />
      )}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: K.colors.bgLight },

  header: { backgroundColor: K.colors.darkGreen, paddingHorizontal: 20, paddingBottom: 14 },
  headerTop: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 },
  logo: { width: 32, height: 32, borderRadius: 8 },
  headerTitle: { fontSize: K.font.xl, fontWeight: "800", color: "#fff" },
  headerSub: { fontSize: K.font.sm, color: K.colors.textLightMuted, marginTop: 1 },

  commissionBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: K.colors.accentDim,
    borderRadius: K.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: K.colors.accent + "40",
  },
  commissionBannerText: { fontSize: 11, color: K.colors.accent, fontWeight: "600", flex: 1, lineHeight: 15 },

  tabsScroll: { gap: 8, paddingBottom: 2 },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: K.radius.full,
    backgroundColor: K.colors.glassBg,
    borderWidth: 1,
    borderColor: K.colors.glassBorder,
  },
  tabActive: { backgroundColor: K.colors.accent, borderColor: K.colors.accent },
  tabText: { fontSize: K.font.sm, color: K.colors.textLightMuted, fontWeight: "600" },
  tabTextActive: { color: "#fff" },

  list: { padding: 16 },

  card: {
    backgroundColor: K.colors.bgCard,
    borderRadius: K.radius.xl,
    padding: 16,
    borderWidth: 1,
    borderColor: K.colors.border,
    ...K.shadow.sm,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  guestRow: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  avatar: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: K.colors.darkGreen,
    alignItems: "center", justifyContent: "center",
  },
  avatarText: { fontSize: K.font.lg, fontWeight: "800", color: "#fff" },
  guestName: { fontSize: K.font.base, fontWeight: "700", color: K.colors.textDark },
  listingName: { fontSize: K.font.sm, color: K.colors.textMuted, marginTop: 2, maxWidth: 160 },

  badge: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: K.radius.full, paddingHorizontal: 10, paddingVertical: 5 },
  badgeDot: { width: 6, height: 6, borderRadius: 3 },
  badgeText: { fontSize: 11, fontWeight: "700" },

  divider: { height: 1, backgroundColor: K.colors.border, marginVertical: 14 },

  datesRow: { flexDirection: "row", alignItems: "center" },
  dateBlock: { flex: 1 },
  dateLabel: { fontSize: 11, color: K.colors.textMuted, fontWeight: "600", marginBottom: 4 },
  dateValue: { fontSize: K.font.sm, fontWeight: "700", color: K.colors.textDark },
  dateMid: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6 },
  dateLine: { flex: 1, height: 1, backgroundColor: K.colors.border },
  durLabel: { fontSize: 11, color: K.colors.textMuted, fontWeight: "600" },

  cardFooter: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    marginTop: 14, paddingTop: 12, borderTopWidth: 1, borderTopColor: K.colors.border,
  },
  refText: { fontSize: 11, color: K.colors.textMuted },
  payoutBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: K.colors.accentDim, borderRadius: K.radius.full,
    paddingHorizontal: 10, paddingVertical: 4,
    borderWidth: 1, borderColor: K.colors.accent + "40",
  },
  payoutText: { fontSize: K.font.sm, fontWeight: "800", color: K.colors.darkGreen },

  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14 },
  errorText: { fontSize: K.font.base, color: K.colors.textMuted },
  retryBtn: { backgroundColor: K.colors.accent, borderRadius: K.radius.md, paddingHorizontal: 24, paddingVertical: 10 },
  retryText: { color: "#fff", fontWeight: "700" },

  emptyBox: { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyTitle: { fontSize: K.font.xl, fontWeight: "800", color: K.colors.textDark },
  emptySub: { fontSize: K.font.sm, color: K.colors.textMuted, textAlign: "center" },
});
