"use client";
import { useState, useMemo } from "react";
import {
  View,
  Text,
  Image,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Alert,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listingApi } from "../../lib/listing-api";
import { K } from "../../constants/theme";
import { useAuthStore } from "../../store/auth";
import { formatCurrency, getCurrencyForCountry } from "../../lib/currency";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ListingItem {
  id: string;
  name: string | null;
  category: "hotel" | "apartment" | "car";
  status: string;
  town: string | null;
  country: string | null;
  pricePerNight: number | null;
  currency: string | null;
  claimedStarRating: number | null;
  rejectionNote: string | null;
  photos: Array<{ cdnUrl: string }>;
}

interface SummaryItem {
  id: string;
  bookingCount: number;
  totalRevenue: number;
  averageRating: number | null;
  reviewCount: number;
}

interface DashboardStats {
  thisMonthEarnings: number;
  activeListingsCount: number;
}

// ── Config ────────────────────────────────────────────────────────────────────

const CAT_TABS = [
  { key: "",          label: "All" },
  { key: "hotel",     label: "Hotels" },
  { key: "apartment", label: "Apartments" },
  { key: "car",       label: "Car Rentals" },
];

const STATUS_TABS = [
  { key: "",                label: "All Statuses" },
  { key: "active",          label: "Active" },
  { key: "draft",           label: "Draft" },
  { key: "pending_review",  label: "Under Review" },
  { key: "suspended",       label: "Suspended" },
];

const CAT_LABEL: Record<string, string> = { hotel: "Hotel", apartment: "Apartment", car: "Car Rental" };

const STATUS_CFG: Record<string, { label: string; bg: string; text: string }> = {
  active:         { label: "Active",     bg: "#00A86B", text: "#fff" },
  approved:       { label: "Active",     bg: "#00A86B", text: "#fff" },
  draft:          { label: "Draft",      bg: "#1E293B", text: "#fff" },
  pending_review: { label: "Pending",    bg: "#F59E0B", text: "#fff" },
  rejected:       { label: "Rejected",   bg: "#EF4444", text: "#fff" },
  deactivated:    { label: "Offline",    bg: "#64748B", text: "#fff" },
  suspended:      { label: "Suspended",  bg: "#EF4444", text: "#fff" },
};

function fmtMoney(n: number, currency = "USD") {
  return formatCurrency(n, currency);
}

// ── ListingCard ───────────────────────────────────────────────────────────────

interface CardProps {
  item: ListingItem;
  summary?: SummaryItem;
  maxBookings: number;
  onEdit: () => void;
  onMore: () => void;
}

function ListingCard({ item, summary, maxBookings, onEdit, onMore }: CardProps) {
  const cfg = STATUS_CFG[item.status] ?? { label: item.status, bg: "#64748B", text: "#fff" };
  const coverUrl = item.photos[0]?.cdnUrl ?? null;
  const bookings  = summary?.bookingCount ?? 0;
  const barPct    = maxBookings > 0 ? Math.min(100, Math.round((bookings / maxBookings) * 100)) : 0;
  const barColor  = barPct >= 70 ? K.colors.accent : barPct >= 30 ? "#F59E0B" : "#E5E7EB";

  const priceLabel = item.pricePerNight != null
    ? formatCurrency(item.pricePerNight, item.currency ?? "USD")
    : "—";

  return (
    <View style={s.card}>
      {/* Photo */}
      <View style={s.photoWrap}>
        {coverUrl ? (
          <Image source={{ uri: coverUrl }} style={s.photo} resizeMode="cover" />
        ) : (
          <View style={s.photoPlaceholder}>
            <Feather
              name={item.category === "car" ? "truck" : "home"}
              size={40}
              color="#C7D9D1"
            />
          </View>
        )}

        {/* Status badge — top left */}
        <View style={[s.statusBadge, { backgroundColor: cfg.bg }]}>
          <Text style={[s.statusBadgeText, { color: cfg.text }]}>{cfg.label}</Text>
        </View>

        {/* Category badge — bottom left */}
        <View style={s.catBadge}>
          <Text style={s.catBadgeText}>
            {CAT_LABEL[item.category] ?? item.category}
          </Text>
        </View>
      </View>

      {/* Body */}
      <View style={s.body}>
        {/* Name row */}
        <View style={s.nameRow}>
          <Text style={s.name} numberOfLines={1}>{item.name ?? "Untitled Listing"}</Text>
          <TouchableOpacity onPress={onMore} hitSlop={10} style={s.moreBtn}>
            <Feather name="more-vertical" size={20} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        {/* Location */}
        {(item.town || item.country) && (
          <View style={s.locationRow}>
            <Feather name="map-pin" size={12} color={K.colors.textMuted} />
            <Text style={s.locationText} numberOfLines={1}>
              {[item.town, item.country].filter(Boolean).join(", ")}
            </Text>
          </View>
        )}

        {/* Occupancy / bookings bar */}
        <View style={s.occRow}>
          <View style={s.occLabelRow}>
            <Text style={s.occLabel}>
              {summary ? "Total Bookings" : "No bookings yet"}
            </Text>
            <Text style={[s.occPct, { color: barColor }]}>
              {bookings > 0 ? `${bookings}` : "0"}
            </Text>
          </View>
          <View style={s.barTrack}>
            <View style={[s.barFill, { width: `${barPct}%` as any, backgroundColor: barColor }]} />
          </View>
        </View>

        {/* Rejection note */}
        {item.status === "rejected" && item.rejectionNote && (
          <View style={s.rejectionBox}>
            <Feather name="alert-triangle" size={13} color="#DC2626" style={{ marginTop: 1 }} />
            <Text style={[s.rejectionText, { flex: 1 }]} numberOfLines={2}>{item.rejectionNote}</Text>
          </View>
        )}

        {/* Price + Actions */}
        <View style={s.footRow}>
          <View>
            <Text style={s.price}>{priceLabel}</Text>
            <Text style={s.priceUnit}>/ {item.category === "car" ? "day" : "night"}</Text>
          </View>
          <View style={s.actionsRow}>
            {item.status !== "pending_review" && (
              <TouchableOpacity style={s.editBtn} onPress={onEdit} activeOpacity={0.8}>
                <Feather name="edit-2" size={13} color={K.colors.accent} />
                <Text style={s.editBtnText}>Edit</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={s.viewBtn}
              onPress={() => router.push(`/listings/${item.id}/view` as any)}
              activeOpacity={0.85}
            >
              <Feather name="eye" size={13} color="#fff" />
              <Text style={s.viewBtnText}>View</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function ListingsScreen() {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const [search,    setSearch]    = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Main listings (with photos)
  const listingsQ = useQuery<{ listings: ListingItem[]; total: number }>({
    queryKey: ["myListings"],
    queryFn: async () => {
      const res = await listingApi.get<{ data: { listings: ListingItem[]; total: number } }>("/listings", {
        params: { limit: "50" },
      });
      return res.data.data;
    },
    enabled: !!user,
  });

  // Summary data (booking counts per listing)
  const summaryQ = useQuery<{ listings: SummaryItem[] }>({
    queryKey: ["myListingsSummary"],
    queryFn: async () => {
      const res = await listingApi.get<{ data: { listings: SummaryItem[] } }>("/provider/listings/summary");
      return res.data.data;
    },
    enabled: !!user && listingsQ.isSuccess,
  });

  // Dashboard stats (for the stats strip)
  const dashQ = useQuery<DashboardStats>({
    queryKey: ["providerDashboard"],
    queryFn: async () => {
      const res = await listingApi.get<{ data: DashboardStats }>("/provider/dashboard");
      return res.data.data;
    },
    enabled: !!user,
  });

  // Mutations
  const deactivateMut = useMutation({
    mutationFn: (id: string) => listingApi.post(`/listings/${id}/deactivate`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["myListings"] });
      qc.invalidateQueries({ queryKey: ["myListingsSummary"] });
    },
    onError: () => Alert.alert("Error", "Could not pause this listing."),
  });

  const reactivateMut = useMutation({
    mutationFn: (id: string) => listingApi.post(`/listings/${id}/reactivate`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["myListings"] });
    },
    onError: (e: any) => {
      const msg = e?.response?.data?.error?.message ?? "Could not resume listing.";
      Alert.alert("Cannot Resume", msg);
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => listingApi.delete(`/listings/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["myListings"] }),
    onError: () => Alert.alert("Error", "Only draft listings can be deleted."),
  });

  // Derived data
  const summaryMap = useMemo(() => {
    const m: Record<string, SummaryItem> = {};
    for (const s of summaryQ.data?.listings ?? []) m[s.id] = s;
    return m;
  }, [summaryQ.data]);

  const allListings = listingsQ.data?.listings ?? [];

  const filtered = useMemo(() => {
    return allListings.filter((l) => {
      if (catFilter && l.category !== catFilter) return false;
      if (statusFilter) {
        if (statusFilter === "active") {
          if (l.status !== "active" && l.status !== "approved") return false;
        } else if (statusFilter === "suspended") {
          if (!["suspended", "auto_suspended", "permanently_banned"].includes(l.status)) return false;
        } else {
          if (l.status !== statusFilter) return false;
        }
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        return (l.name ?? "").toLowerCase().includes(q) ||
               (l.town ?? "").toLowerCase().includes(q);
      }
      return true;
    });
  }, [allListings, catFilter, statusFilter, search]);

  const countByCategory = useMemo(() => {
    const map: Record<string, number> = { "": allListings.length };
    for (const l of allListings) map[l.category] = (map[l.category] ?? 0) + 1;
    return map;
  }, [allListings]);

  const maxBookings = useMemo(() => {
    return Math.max(...(summaryQ.data?.listings ?? []).map((s) => s.bookingCount), 1);
  }, [summaryQ.data]);

  const stats = dashQ.data;
  const totalRevMTD = stats?.thisMonthEarnings ?? 0;
  const activeCount = stats?.activeListingsCount ?? 0;

  function openMoreMenu(item: ListingItem) {
    const isLive   = item.status === "active" || item.status === "approved";
    const isPaused = item.status === "deactivated";
    const isDraft  = item.status === "draft";

    const options: Array<{ label: string; action: () => void; destructive?: boolean }> = [];

    if (item.status !== "pending_review") {
      options.push({ label: "Edit Listing", action: () => router.push(editRoute(item)) });
    }
    if (isLive) {
      options.push({
        label: "Pause Listing",
        action: () => deactivateMut.mutate(item.id),
      });
    }
    if (isPaused) {
      options.push({
        label: "Resume Listing",
        action: () => reactivateMut.mutate(item.id),
      });
    }
    if (isDraft) {
      options.push({
        label: "Delete Draft",
        action: () =>
          Alert.alert(
            "Delete Draft",
            `Delete "${item.name ?? "Untitled"}"? This cannot be undone.`,
            [
              { text: "Cancel", style: "cancel" },
              { text: "Delete", style: "destructive", onPress: () => deleteMut.mutate(item.id) },
            ]
          ),
        destructive: true,
      });
    }

    Alert.alert(
      item.name ?? "Listing",
      undefined,
      [
        ...options.map((o) => ({
          text: o.label,
          onPress: o.action,
          style: (o.destructive ? "destructive" : "default") as "destructive" | "default",
        })),
        { text: "Cancel", style: "cancel" as const },
      ]
    );
  }

  function editRoute(l: ListingItem) {
    return `/listings/${l.id}` as any;
  }

  const isLoading = listingsQ.isLoading;
  const isError   = listingsQ.isError;
  const refetch   = () => {
    listingsQ.refetch();
    summaryQ.refetch();
    dashQ.refetch();
  };
  const isRefreshing = listingsQ.isRefetching;

  return (
    <View style={s.container}>
      {/* ── Header ─────────────────────────────────────────── */}
      <SafeAreaView edges={["top"]} style={s.header}>
        <View style={s.headerRow}>
          <View style={s.headerLeft}>
            <Image
              source={require("../../assets/logo.png")}
              style={s.logo}
              resizeMode="contain"
            />
            <Text style={s.headerTitle}>Manage Listings</Text>
          </View>
          <View style={s.headerIcons}>
            <TouchableOpacity
              style={s.iconBtn}
              onPress={() => router.push("/notifications" as any)}
            >
              <Feather name="bell" size={17} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
              style={s.iconBtn}
              onPress={() => router.push("/(provider)/profile" as any)}
            >
              <Feather name="settings" size={17} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      {/* ── Scrollable body ─────────────────────────────────── */}
      <FlatList
        data={isLoading ? [] : filtered}
        keyExtractor={(l) => l.id}
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={refetch} tintColor={K.colors.accent} />
        }
        ListHeaderComponent={
          <View>
            {/* Search */}
            <View style={s.searchWrap}>
              <Feather name="search" size={15} color="#9CA3AF" />
              <TextInput
                style={s.searchInput}
                value={search}
                onChangeText={setSearch}
                placeholder="Search listings..."
                placeholderTextColor="#9CA3AF"
              />
              {search ? (
                <TouchableOpacity onPress={() => setSearch("")} hitSlop={8}>
                  <Text style={{ color: "#9CA3AF", fontSize: 14 }}>✕</Text>
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Category tabs */}
            <View style={s.tabRow}>
              {CAT_TABS.map((t) => {
                const cnt = countByCategory[t.key] ?? 0;
                const active = catFilter === t.key;
                return (
                  <TouchableOpacity
                    key={t.key}
                    style={[s.tab, active && s.tabActive]}
                    onPress={() => setCatFilter(t.key)}
                  >
                    <Text style={[s.tabText, active && s.tabTextActive]}>
                      {t.label}{active && cnt > 0 ? ` (${cnt})` : ""}
                    </Text>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity style={s.filterIcon} onPress={() => setStatusFilter(statusFilter ? "" : "active")}>
                <Feather name="sliders" size={16} color={K.colors.accent} />
              </TouchableOpacity>
            </View>

            {/* Status tabs */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.statusTabRow}>
              {STATUS_TABS.map((t) => {
                const active = statusFilter === t.key;
                return (
                  <TouchableOpacity
                    key={t.key}
                    style={[s.statusTab, active && s.statusTabActive]}
                    onPress={() => setStatusFilter(t.key)}
                  >
                    <Text style={[s.statusTabText, active && s.statusTabTextActive]}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Stats strip */}
            {!isLoading && (
              <View style={s.statsCard}>
                <View style={s.statItem}>
                  <View style={[s.statIconWrap, { backgroundColor: "#DCFCE7" }]}>
                    <Feather name="trending-up" size={18} color={K.colors.accent} />
                  </View>
                  <View>
                    <Text style={s.statLabel}>AVG. ACTIVE</Text>
                    <Text style={s.statValue}>{activeCount} listing{activeCount !== 1 ? "s" : ""}</Text>
                  </View>
                </View>
                <View style={s.statDivider} />
                <View style={s.statItem}>
                  <View>
                    <Text style={s.statLabel}>REVENUE (MTD)</Text>
                    <Text style={[s.statValue, { color: K.colors.textDark }]}>
                      {fmtMoney(totalRevMTD, getCurrencyForCountry(user?.country).code)}
                    </Text>
                  </View>
                </View>
              </View>
            )}
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={s.center}>
              <ActivityIndicator color={K.colors.accent} size="large" />
            </View>
          ) : isError ? (
            <View style={s.center}>
              <Text style={s.errText}>Could not load listings</Text>
              <TouchableOpacity style={s.retryBtn} onPress={refetch}>
                <Text style={s.retryText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={s.empty}>
              <View style={s.emptyIconWrap}>
                <Feather name="home" size={34} color={K.colors.accent} />
              </View>
              <Text style={s.emptyTitle}>No listings yet</Text>
              <Text style={s.emptySub}>
                Tap <Text style={{ fontWeight: "700" }}>+</Text> to create your first listing
              </Text>
              <TouchableOpacity
                style={s.emptyBtn}
                onPress={() => router.push("/listings/new" as any)}
              >
                <Text style={s.emptyBtnText}>Create Listing</Text>
              </TouchableOpacity>
            </View>
          )
        }
        renderItem={({ item }) => (
          <ListingCard
            item={item}
            summary={summaryMap[item.id]}
            maxBookings={maxBookings}
            onEdit={() => router.push(editRoute(item))}
            onMore={() => openMoreMenu(item)}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
        ListFooterComponent={() => <View style={{ height: 100 }} />}
      />

      {/* ── FAB ─────────────────────────────────────────────── */}
      <TouchableOpacity
        style={s.fab}
        onPress={() => router.push("/listings/new" as any)}
        activeOpacity={0.88}
      >
        <Feather name="plus" size={28} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F1F5F9" },

  // Header
  header: { backgroundColor: K.colors.darkGreen },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  logo: { width: 30, height: 30, borderRadius: 7 },
  headerTitle: { fontSize: K.font.xl, fontWeight: "800", color: "#fff" },
  headerIcons: { flexDirection: "row", gap: 8 },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: K.colors.glassBg,
    borderWidth: 1,
    borderColor: K.colors.glassBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBtnText: { fontSize: 16 },

  // Scroll
  scroll: { padding: 16, paddingTop: 0 },

  // Search
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: K.radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
    marginTop: 16,
    marginBottom: 12,
    ...K.shadow.sm,
  },
  searchIcon: { fontSize: 15, color: "#9CA3AF" },
  searchInput: { flex: 1, fontSize: K.font.sm, color: K.colors.textDark },

  // Category tabs
  tabRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: K.radius.full,
    backgroundColor: "#E2E8F0",
  },
  tabActive: { backgroundColor: K.colors.accent },
  tabText: { fontSize: K.font.sm, fontWeight: "600", color: "#64748B" },
  tabTextActive: { color: "#fff" },
  filterIcon: {
    marginLeft: "auto",
    padding: 6,
  },

  // Status tabs ScrollView
  statusTabRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
    paddingRight: 20,
  },
  statusTab: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: K.radius.md,
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
  },
  statusTabActive: {
    backgroundColor: K.colors.darkGreenMid,
    borderColor: K.colors.darkGreenMid,
  },
  statusTabText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statusTabTextActive: {
    color: "#fff",
  },

  // Stats card
  statsCard: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: K.radius.xl,
    padding: 16,
    marginBottom: 16,
    alignItems: "center",
    ...K.shadow.sm,
  },
  statItem: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  statIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  statIconEmoji: { fontSize: 20 },
  statDivider: { width: 1, height: 40, backgroundColor: "#E2E8F0", marginHorizontal: 12 },
  statLabel: { fontSize: 9, color: "#94A3B8", fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase" },
  statValue: { fontSize: K.font.lg, fontWeight: "800", color: K.colors.accent, marginTop: 2 },

  // Card
  card: {
    backgroundColor: "#fff",
    borderRadius: K.radius.xl,
    overflow: "hidden",
    ...K.shadow.md,
  },

  // Photo
  photoWrap: { height: 200, width: "100%", position: "relative" },
  photo: { width: "100%", height: "100%" },
  photoPlaceholder: {
    flex: 1,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  photoEmoji: { fontSize: 48 },

  // Badges on photo
  statusBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    borderRadius: K.radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusBadgeText: { fontSize: 11, fontWeight: "700" },
  catBadge: {
    position: "absolute",
    bottom: 12,
    left: 12,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: K.radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  catBadgeText: { fontSize: 11, color: "#fff", fontWeight: "600" },

  // Card body
  body: { padding: 16 },

  nameRow: { flexDirection: "row", alignItems: "center", marginBottom: 5 },
  name: { flex: 1, fontSize: K.font.lg, fontWeight: "800", color: K.colors.textDark },
  moreBtn: { padding: 4 },
  moreDots: { fontSize: 20, color: "#94A3B8", fontWeight: "700" },

  locationRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 10 },
  locationIcon: { fontSize: 13 },
  locationText: { fontSize: K.font.sm, color: "#64748B" },

  // Occupancy / bookings bar
  occRow: { marginBottom: 12 },
  occLabelRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 5 },
  occLabel: { fontSize: K.font.xs, color: "#94A3B8", fontWeight: "600" },
  occPct: { fontSize: K.font.xs, fontWeight: "800" },
  barTrack: {
    height: 6,
    backgroundColor: "#E2E8F0",
    borderRadius: K.radius.full,
    overflow: "hidden",
  },
  barFill: { height: 6, borderRadius: K.radius.full },

  rejectionBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    backgroundColor: "#FEF2F2",
    borderRadius: K.radius.sm,
    padding: 8,
    marginBottom: 10,
  },
  rejectionText: { fontSize: K.font.xs, color: "#DC2626", lineHeight: 16 },

  // Footer price + actions
  footRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  price: { fontSize: K.font.xl, fontWeight: "900", color: K.colors.textDark },
  priceUnit: { fontSize: K.font.xs, color: "#94A3B8", marginTop: 1 },

  actionsRow: { flexDirection: "row", gap: 8 },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1.5,
    borderColor: K.colors.accent,
    borderRadius: K.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  editBtnText: { fontSize: K.font.sm, fontWeight: "700", color: K.colors.accent },
  viewBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: K.colors.accent,
    borderRadius: K.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  viewBtnText: { fontSize: K.font.sm, fontWeight: "700", color: "#fff" },

  // States
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 60, gap: 12 },
  errText: { fontSize: K.font.base, color: K.colors.textMuted },
  retryBtn: { backgroundColor: K.colors.accent, borderRadius: K.radius.md, paddingHorizontal: 24, paddingVertical: 10 },
  retryText: { color: "#fff", fontWeight: "700" },

  empty: { alignItems: "center", paddingTop: 48, paddingHorizontal: 32 },
  emptyIconWrap: { width: 80, height: 80, borderRadius: 40, backgroundColor: K.colors.accentDim, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  emptyTitle: { fontSize: K.font.xl, fontWeight: "800", color: K.colors.textDark, marginBottom: 8 },
  emptySub: { fontSize: K.font.sm, color: K.colors.textMuted, textAlign: "center", lineHeight: 22, marginBottom: 24 },
  emptyBtn: { backgroundColor: K.colors.accent, borderRadius: K.radius.md, paddingVertical: 13, paddingHorizontal: 28 },
  emptyBtnText: { color: "#fff", fontWeight: "700" },

  // FAB
  fab: {
    position: "absolute",
    bottom: 96,
    right: 20,
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: K.colors.accent,
    alignItems: "center",
    justifyContent: "center",
    ...K.shadow.lg,
  },
});
