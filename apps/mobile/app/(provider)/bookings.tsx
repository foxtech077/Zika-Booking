import { useState } from "react";
import {
  View,
  Text,
  Image,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { listingApi } from "../../lib/listing-api";
import { K } from "../../constants/theme";

interface Booking {
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
  nightsCount?: number;
}

interface BookingList {
  bookings: Booking[];
  total: number;
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  confirmed: { label: "Confirmed", bg: "#D1FAE5", text: "#065F46", dot: "#00A86B" },
  pending_payment: { label: "Pending", bg: "#FEF3C7", text: "#92400E", dot: "#F59E0B" },
  completed: { label: "Completed", bg: "#F3F4F6", text: "#6B7280", dot: "#9CA3AF" },
  cancelled_by_guest: { label: "Cancelled", bg: "#FEE2E2", text: "#DC2626", dot: "#EF4444" },
  cancelled_by_provider: { label: "Cancelled", bg: "#FEE2E2", text: "#DC2626", dot: "#EF4444" },
  cancelled_by_system: { label: "Cancelled", bg: "#FEE2E2", text: "#DC2626", dot: "#EF4444" },
};

const FILTER_TABS = [
  { key: "all",             label: "All",      statusParam: undefined },
  { key: "upcoming",        label: "Upcoming",  statusParam: "confirmed" },
  { key: "pending_payment", label: "Pending",   statusParam: "pending_payment" },
  { key: "completed",       label: "Completed", statusParam: "completed" },
];

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en", { day: "numeric", month: "short", year: "2-digit" });
}

function BookingCard({ item }: { item: Booking }) {
  const st = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.completed!;
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/booking/${item.id}` as any)}
      activeOpacity={0.85}
    >
      <View style={styles.cardHeader}>
        <View style={styles.guestInfo}>
          <View style={styles.guestAvatar}>
            <Text style={styles.guestAvatarText}>
              {item.guestFirstName[0]?.toUpperCase() ?? "?"}
            </Text>
          </View>
          <View>
            <Text style={styles.guestName}>{item.guestFirstName} {item.guestLastName}</Text>
            <Text style={styles.listingName} numberOfLines={1}>{item.listingTitle}</Text>
          </View>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
          <View style={[styles.statusDot, { backgroundColor: st.dot }]} />
          <Text style={[styles.statusText, { color: st.text }]}>{st.label}</Text>
        </View>
      </View>

      <View style={styles.cardDivider} />

      <View style={styles.cardBody}>
        <View style={styles.dateBlock}>
          <Text style={styles.dateLabel}>Check-in</Text>
          <Text style={styles.dateValue}>{fmtDate(item.checkIn)}</Text>
        </View>
        <View style={styles.dateSeparator}>
          <View style={styles.dateLine} />
          <Text style={styles.dateNights}>{item.nightsCount ?? "?"} nights</Text>
          <View style={styles.dateLine} />
        </View>
        <View style={[styles.dateBlock, { alignItems: "flex-end" }]}>
          <Text style={styles.dateLabel}>Check-out</Text>
          <Text style={styles.dateValue}>{fmtDate(item.checkOut)}</Text>
        </View>
      </View>

      <View style={styles.cardFooter}>
        <Text style={styles.refText}>{item.reference}</Text>
        <Text style={styles.amountText}>{item.currency} {item.totalAmount.toLocaleString()}</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function BookingsScreen() {
  const [activeTab, setActiveTab] = useState("all");

  const { data, isLoading, isError, refetch, isRefetching } = useQuery<BookingList>({
    queryKey: ["providerBookings", activeTab],
    queryFn: async () => {
      const tab = FILTER_TABS.find((t) => t.key === activeTab);
      const params = tab?.statusParam ? { status: tab.statusParam } : {};
      const res = await listingApi.get<{ data: BookingList }>("/provider/bookings", { params });
      return res.data.data;
    },
  });

  const bookings = data?.bookings ?? [];

  return (
    <View style={styles.container}>
      <SafeAreaView edges={["top"]} style={styles.header}>
        <View style={styles.headerTop}>
          <Image
            source={require("../../assets/logo.png")}
            style={styles.logo}
            resizeMode="contain"
          />
          <View>
            <Text style={styles.headerTitle}>Reservations</Text>
            <Text style={styles.headerSub}>
              {data ? `${data.total} total` : "Loading…"}
            </Text>
          </View>
        </View>

        {/* Filter tabs */}
        <View style={styles.tabs}>
          {FILTER_TABS.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, activeTab === tab.key && styles.tabActive]}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.75}
            >
              <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </SafeAreaView>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={K.colors.accent} size="large" />
        </View>
      ) : isError ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>Could not load bookings</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => refetch()}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={K.colors.accent} />
          }
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyEmoji}>📅</Text>
              <Text style={styles.emptyTitle}>No bookings found</Text>
              <Text style={styles.emptySub}>Bookings in this category will appear here</Text>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: K.colors.bgLight },

  header: {
    backgroundColor: K.colors.darkGreen,
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerTop: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 0 },
  logo: { width: 32, height: 32, borderRadius: 8 },
  headerTitle: { fontSize: K.font.xl, fontWeight: "800", color: "#fff" },
  headerSub: { fontSize: K.font.sm, color: K.colors.textLightMuted, marginTop: 2, marginBottom: 14 },

  tabs: { flexDirection: "row", gap: 8 },
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
  guestInfo: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  guestAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: K.colors.darkGreen,
    alignItems: "center",
    justifyContent: "center",
  },
  guestAvatarText: { fontSize: K.font.lg, fontWeight: "800", color: "#fff" },
  guestName: { fontSize: K.font.base, fontWeight: "700", color: K.colors.textDark },
  listingName: { fontSize: K.font.sm, color: K.colors.textMuted, marginTop: 2, maxWidth: 180 },

  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: K.radius.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: "700" },

  cardDivider: { height: 1, backgroundColor: K.colors.border, marginVertical: 14 },

  cardBody: { flexDirection: "row", alignItems: "center" },
  dateBlock: { flex: 1 },
  dateLabel: { fontSize: 11, color: K.colors.textMuted, fontWeight: "600", marginBottom: 4 },
  dateValue: { fontSize: K.font.sm, fontWeight: "700", color: K.colors.textDark },
  dateSeparator: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6 },
  dateLine: { flex: 1, height: 1, backgroundColor: K.colors.border },
  dateNights: { fontSize: 11, color: K.colors.textMuted, fontWeight: "600" },

  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: K.colors.border,
  },
  refText: { fontSize: 11, color: K.colors.textMuted, fontFamily: "monospace" },
  amountText: { fontSize: K.font.base, fontWeight: "800", color: K.colors.textDark },

  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  errorText: { fontSize: K.font.base, color: K.colors.textMuted },
  retryBtn: {
    backgroundColor: K.colors.accent,
    borderRadius: K.radius.md,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  retryText: { color: "#fff", fontWeight: "700" },

  emptyBox: { alignItems: "center", paddingTop: 60 },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: K.font.xl, fontWeight: "800", color: K.colors.textDark, marginBottom: 8 },
  emptySub: { fontSize: K.font.sm, color: K.colors.textMuted, textAlign: "center" },
});
