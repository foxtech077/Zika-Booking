import { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  StyleSheet,
  Alert,
} from "react-native";
import { router } from "expo-router";
import { AppLayout } from "../../components/layout/AppLayout";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { listingApi } from "../../lib/listing-api";
import { K } from "../../constants/theme";
import { BookingCard, type BookingCardData } from "../../components/bookings/BookingCard";
import { BookingFilterBar, type FilterTab } from "../../components/bookings/BookingFilterBar";
import { BookingListLoading } from "../../components/bookings/BookingLoadingSkeleton";
import { BookingEmptyState, BookingErrorState } from "../../components/bookings/BookingEmptyState";

// ── Types ─────────────────────────────────────────────────────────────────────

type ProviderBooking = BookingCardData;

interface BookingListResponse {
  bookings: ProviderBooking[];
  total: number;
}

// ── Config ────────────────────────────────────────────────────────────────────

const FILTER_TABS: FilterTab[] = [
  { key: "all", label: "All", statusParam: undefined },
  { key: "upcoming", label: "Upcoming", statusParam: "confirmed" },
  { key: "completed", label: "Completed", statusParam: "completed" },
  { key: "cancelled", label: "Cancelled", statusParam: "cancelled" },
];

const COMMISSION_RATE = 0.05;

// ── Helpers ───────────────────────────────────────────────────────────────────

function netPayout(b: ProviderBooking): number {
  if (b.netPayout != null) return b.netPayout;
  return Math.round(b.totalAmount * (1 - COMMISSION_RATE) * 100) / 100;
}

function isToday(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
}

function showMessageStub() {
  Alert.alert(
    "Messaging Coming Soon",
    "In-app guest messaging is not yet available. Please use the contact details provided at check-in to communicate with your guest.",
    [{ text: "OK" }]
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

  // Stat strip — approximated from whatever the current tab's data already loaded (no new endpoint calls)
  const todaysCheckIns = bookings.filter((b) => b.status === "confirmed" && isToday(b.checkIn)).length;
  const now = Date.now();
  const upcomingCount = bookings.filter((b) => b.status === "confirmed" && new Date(b.checkIn).getTime() > now).length;

  const renderItem = useCallback(
    ({ item }: { item: ProviderBooking }) => (
      <BookingCard
        item={item}
        net={netPayout(item)}
        onPress={() => router.push(`/provider/booking/${item.id}` as any)}
        onMessage={showMessageStub}
      />
    ),
    []
  );

  return (
    <AppLayout>
      <View style={s.container}>
        <View style={s.header}>
          <View style={s.headerRow}>
            <View>
              <Text style={s.headerTitle}>Bookings</Text>
              <Text style={s.headerSub}>Manage your high-end property bookings.</Text>
            </View>
          </View>

          {/* Stat strip */}
          <View style={s.statsRow}>
            <View style={s.statCard}>
              <View style={s.statCardTop}>
                <View style={s.statIconWrap}>
                  <Ionicons name="log-in-outline" size={16} color={K.colors.darkGreen} />
                </View>
              </View>
              <Text style={s.statValue}>{String(todaysCheckIns).padStart(2, "0")}</Text>
              <Text style={s.statLabel}>Today's Check-ins</Text>
            </View>
            <View style={s.statCard}>
              <View style={s.statCardTop}>
                <View style={s.statIconWrap}>
                  <Ionicons name="calendar-outline" size={16} color={K.colors.darkGreen} />
                </View>
              </View>
              <Text style={s.statValue}>{upcomingCount}</Text>
              <Text style={s.statLabel}>Upcoming</Text>
            </View>
          </View>

          {/* Filter tabs */}
          <BookingFilterBar tabs={FILTER_TABS} activeKey={activeTab} onSelect={setActiveTab} />
        </View>

        {isLoading ? (
          <BookingListLoading />
        ) : isError ? (
          <BookingErrorState onRetry={() => refetch()} />
        ) : (
          <FlatList
            data={bookings}
            keyExtractor={(item) => item.id}
            contentContainerStyle={s.list}
            showsVerticalScrollIndicator={false}
            removeClippedSubviews
            windowSize={7}
            maxToRenderPerBatch={6}
            initialNumToRender={6}
            updateCellsBatchingPeriod={50}
            refreshControl={
              <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={K.colors.accent} />
            }
            ListEmptyComponent={<BookingEmptyState />}
            renderItem={renderItem}
            ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
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
    paddingTop: 16,
    paddingBottom: 16,
  },
  headerRow: { marginBottom: 16 },
  headerTitle: { fontSize: 22, fontWeight: "800", color: "#fff", letterSpacing: -0.5, marginBottom: 4 },
  headerSub: { fontSize: 13, color: "rgba(255,255,255,0.65)", lineHeight: 18 },

  statsRow: { flexDirection: "row", gap: 12, marginBottom: 16 },
  statCard: {
    flex: 1,
    backgroundColor: K.colors.bgTint,
    borderRadius: K.radius.xl,
    padding: 14,
  },
  statCardTop: { marginBottom: 10 },
  statIconWrap: {
    width: 34, height: 34, borderRadius: 11,
    backgroundColor: "#fff", alignItems: "center", justifyContent: "center",
  },
  statValue: { fontSize: K.font.xxl, fontWeight: "900", color: K.colors.darkGreen, letterSpacing: -0.5 },
  statLabel: { fontSize: 11, color: K.colors.darkGreenMid, fontWeight: "700", marginTop: 2 },

  list: { padding: 16 },
});
