import { useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { AppLayout } from "../../components/layout/AppLayout";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
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

const STATUS_CFG: Record<string, { label: string; bg: string; text: string; accent: string }> = {
  confirmed:             { label: "Confirmed",  bg: "#f0fdf4", text: "#15803d", accent: "#16a34a" },
  active:                { label: "Active",     bg: "#eff6ff", text: "#1d4ed8", accent: "#3b82f6" },
  pending_payment:       { label: "Pending",    bg: "#fffbeb", text: "#92400e", accent: "#f59e0b" },
  completed:             { label: "Completed",  bg: "#f8f8f8", text: "#6b7280", accent: "#9ca3af" },
  cancelled_by_guest:    { label: "Cancelled",  bg: "#fef2f2", text: "#b91c1c", accent: "#ef4444" },
  cancelled_by_provider: { label: "Cancelled",  bg: "#fef2f2", text: "#b91c1c", accent: "#ef4444" },
  cancelled_by_system:   { label: "Cancelled",  bg: "#fef2f2", text: "#b91c1c", accent: "#ef4444" },
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
  return new Date(iso).toLocaleDateString("en", { day: "numeric", month: "short" });
}

function netPayout(b: ProviderBooking): number {
  if (b.netPayout != null) return b.netPayout;
  return Math.round(b.totalAmount * (1 - COMMISSION_RATE) * 100) / 100;
}

function avatarColor(name: string): string {
  const COLORS = ["#0891b2", "#7c3aed", "#be185d", "#0f766e", "#b45309", "#1d4ed8", "#15803d"];
  const idx = (name.charCodeAt(0) ?? 0) % COLORS.length;
  return COLORS[idx]!;
}

// ── Booking Card ──────────────────────────────────────────────────────────────

function BookingCard({ item }: { item: ProviderBooking }) {
  const st      = STATUS_CFG[item.status] ?? STATUS_CFG.completed!;
  const isCar   = item.listingCategory === "car";
  const dur     = item.nightsOrDays;
  const durStr  = dur ? `${dur} ${isCar ? "day" : "night"}${dur !== 1 ? "s" : ""}` : null;
  const net     = netPayout(item);
  const initial = item.guestFirstName[0]?.toUpperCase() ?? "?";
  const acBg    = avatarColor(item.guestFirstName);

  return (
    <TouchableOpacity
      style={[c.card, { borderLeftColor: st.accent }]}
      onPress={() => router.push(`/provider/booking/${item.id}` as any)}
      activeOpacity={0.82}
    >
      {/* Top row */}
      <View style={c.topRow}>
        <View style={[c.avatar, { backgroundColor: acBg }]}>
          <Text style={c.avatarText}>{initial}</Text>
        </View>
        <View style={c.guestInfo}>
          <Text style={c.guestName}>{item.guestFirstName} {item.guestLastName[0]}.</Text>
          <Text style={c.listingName} numberOfLines={1}>{item.listingTitle}</Text>
        </View>
        <View style={[c.statusBadge, { backgroundColor: st.bg }]}>
          <View style={[c.statusDot, { backgroundColor: st.accent }]} />
          <Text style={[c.statusText, { color: st.text }]}>{st.label}</Text>
        </View>
      </View>

      {/* Dates row */}
      <View style={c.datesRow}>
        <View style={c.dateBlock}>
          <Text style={c.dateLabel}>{isCar ? "PICKUP" : "CHECK-IN"}</Text>
          <Text style={c.dateValue}>{fmtDate(item.checkIn)}</Text>
        </View>
        <View style={c.dateMid}>
          <View style={c.dateLine} />
          <View style={c.durationChip}>
            <Ionicons name={isCar ? "car-outline" : "bed-outline"} size={11} color={K.colors.textMuted} />
            {durStr ? <Text style={c.durationText}>{durStr}</Text> : null}
          </View>
          <View style={c.dateLine} />
        </View>
        <View style={[c.dateBlock, { alignItems: "flex-end" }]}>
          <Text style={c.dateLabel}>{isCar ? "RETURN" : "CHECK-OUT"}</Text>
          <Text style={c.dateValue}>{fmtDate(item.checkOut)}</Text>
        </View>
      </View>

      {/* Footer */}
      <View style={c.footer}>
        <Text style={c.refText}>#{item.reference}</Text>
        <View style={c.payoutRow}>
          <Ionicons name="cash-outline" size={13} color={K.colors.accent} />
          <Text style={c.payoutText}>{item.currency} {net.toLocaleString()}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const c = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: K.colors.border,
    borderLeftWidth: 4,
    ...K.shadow.sm,
  },
  topRow:    { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  avatar:    { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  avatarText:{ fontSize: 15, fontWeight: "800", color: "#fff" },
  guestInfo: { flex: 1 },
  guestName: { fontSize: 14, fontWeight: "700", color: K.colors.textDark, marginBottom: 2 },
  listingName:{ fontSize: 12, color: K.colors.textMuted },

  statusBadge: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 20, paddingHorizontal: 9, paddingVertical: 4 },
  statusDot:   { width: 6, height: 6, borderRadius: 3 },
  statusText:  { fontSize: 11, fontWeight: "700" },

  datesRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  dateBlock: { flex: 1 },
  dateLabel: { fontSize: 9, fontWeight: "700", color: K.colors.textMuted, letterSpacing: 0.8, marginBottom: 4 },
  dateValue: { fontSize: 14, fontWeight: "700", color: K.colors.textDark },
  dateMid:   { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 },
  dateLine:  { flex: 1, height: 1, backgroundColor: K.colors.border },
  durationChip: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: K.colors.bgSubtle, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 3 },
  durationText: { fontSize: 10, color: K.colors.textMuted, fontWeight: "600" },

  footer:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 10, borderTopWidth: 1, borderTopColor: K.colors.border },
  refText:    { fontSize: 11, color: K.colors.textMuted, fontFamily: "monospace" },
  payoutRow:  { flexDirection: "row", alignItems: "center", gap: 5 },
  payoutText: { fontSize: 14, fontWeight: "800", color: K.colors.darkGreen },
});

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
    <AppLayout>
      <View style={s.container}>
        <View style={s.header}>
          <View style={s.headerRow}>
            <View>
              <Text style={s.headerTitle}>Reservations</Text>
              {data && (
                <Text style={s.headerSub}>
                  {data.total} booking{data.total !== 1 ? "s" : ""}
                </Text>
              )}
            </View>
            <View style={[s.countBadge, data?.total ? {} : { opacity: 0 }]}>
              <Text style={s.countBadgeText}>{data?.total ?? 0}</Text>
            </View>
          </View>

          {/* Commission notice */}
          <View style={s.commissionBar}>
            <Ionicons name="information-circle-outline" size={13} color={K.colors.accentLight} />
            <Text style={s.commissionText}>Net amounts shown after Kainook's 5% service fee</Text>
          </View>

          {/* Filter tabs */}
          <FlatList
            data={FILTER_TABS}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(t) => t.key}
            contentContainerStyle={s.tabsRow}
            renderItem={({ item: tab }) => (
              <TouchableOpacity
                style={[s.tab, activeTab === tab.key && s.tabActive]}
                onPress={() => setActiveTab(tab.key)}
                activeOpacity={0.75}
              >
                <Text style={[s.tabText, activeTab === tab.key && s.tabTextActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>

      {isLoading ? (
        <View style={s.center}>
          <ActivityIndicator color={K.colors.accent} size="large" />
        </View>
      ) : isError ? (
        <View style={s.center}>
          <Ionicons name="alert-circle-outline" size={48} color="#fca5a5" />
          <Text style={s.errorTitle}>Could not load bookings</Text>
          <TouchableOpacity style={s.retryBtn} onPress={() => refetch()}>
            <Text style={s.retryText}>Try Again</Text>
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
            <View style={s.empty}>
              <View style={s.emptyIcon}>
                <Ionicons name="calendar-outline" size={36} color={K.colors.textMuted} />
              </View>
              <Text style={s.emptyTitle}>No bookings found</Text>
              <Text style={s.emptySub}>Reservations in this category will appear here.</Text>
            </View>
          }
          renderItem={({ item }) => <BookingCard item={item} />}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          ListFooterComponent={() => <View style={{ height: 32 }} />}
        />
      )}
      </View>
    </AppLayout>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F4F1" },

  header: {
    backgroundColor: K.colors.darkGreen,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  headerTitle: { fontSize: 22, fontWeight: "800", color: "#fff", letterSpacing: -0.5 },
  headerSub:   { fontSize: 12, color: "rgba(255,255,255,0.6)", marginTop: 2 },
  countBadge: {
    backgroundColor: K.colors.accent,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  countBadgeText: { fontSize: 13, fontWeight: "800", color: "#fff" },

  commissionBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginBottom: 14,
  },
  commissionText: { fontSize: 11, color: "rgba(255,255,255,0.65)", fontWeight: "500", flex: 1, lineHeight: 15 },

  tabsRow: { gap: 8 },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  tabActive:     { backgroundColor: "#fff" },
  tabText:       { fontSize: 12, color: "rgba(255,255,255,0.75)", fontWeight: "600" },
  tabTextActive: { color: K.colors.darkGreen },

  list: { padding: 16 },

  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, padding: 32 },
  errorTitle: { fontSize: 16, fontWeight: "700", color: K.colors.textDark, textAlign: "center" },
  retryBtn: {
    backgroundColor: K.colors.darkGreen,
    borderRadius: 12,
    paddingHorizontal: 28,
    paddingVertical: 12,
  },
  retryText: { color: "#fff", fontWeight: "700" },

  empty: { alignItems: "center", paddingTop: 64, gap: 10 },
  emptyIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: "#fff", alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: K.colors.border,
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: K.colors.textDark },
  emptySub:   { fontSize: 13, color: K.colors.textMuted, textAlign: "center", lineHeight: 18 },
});
