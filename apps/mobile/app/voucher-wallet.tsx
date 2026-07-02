import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { listingApi } from "../lib/listing-api";
import { K } from "../constants/theme";
import type { VoucherWalletResponse, WalletVoucher } from "../lib/types/voucher";

// ── Data fetching ─────────────────────────────────────────────────────────────

function useVoucherWallet() {
  return useQuery<VoucherWalletResponse>({
    queryKey: ["vouchers", "wallet"],
    queryFn: async () => {
      const res = await listingApi.get<{ data: VoucherWalletResponse }>("/vouchers/wallet");
      return res.data.data;
    },
    staleTime: 60_000,
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function isExpired(iso: string): boolean {
  return new Date(iso) < new Date();
}

function discountLabel(v: WalletVoucher): string {
  if (v.discountType === "percentage") return `${v.discountValue}% off`;
  return `${v.discountValue} off`;
}

function activityLabel(activity: string): string {
  const map: Record<string, string> = {
    hotels:            "Hotels",
    apartments:        "Apartments",
    cars:              "Car rentals",
    hotels_apartments: "Hotels & Apartments",
    universal:         "All bookings",
  };
  return map[activity] ?? activity;
}

// ── Voucher Card ──────────────────────────────────────────────────────────────

function VoucherCard({ item }: { item: WalletVoucher }) {
  const expired   = isExpired(item.validUntil);
  const inactive  = item.isUsed || expired;

  return (
    <View style={[vc.card, inactive && vc.cardInactive]}>
      {/* Dashed left edge accent */}
      <View style={[vc.leftBar, inactive && vc.leftBarInactive]} />

      <View style={vc.body}>
        <View style={vc.topRow}>
          <Text style={[vc.discount, inactive && vc.textFaded]}>
            {discountLabel(item)}
          </Text>
          {item.isUsed ? (
            <View style={[vc.badge, vc.badgeUsed]}>
              <Text style={vc.badgeText}>Used</Text>
            </View>
          ) : expired ? (
            <View style={[vc.badge, vc.badgeExpired]}>
              <Text style={vc.badgeText}>Expired</Text>
            </View>
          ) : (
            <View style={[vc.badge, vc.badgeActive]}>
              <Text style={vc.badgeText}>Active</Text>
            </View>
          )}
        </View>

        <Text style={[vc.title, inactive && vc.textFaded]} numberOfLines={2}>
          {item.title}
        </Text>
        {item.description ? (
          <Text style={vc.desc} numberOfLines={2}>{item.description}</Text>
        ) : null}

        <View style={vc.metaRow}>
          <View style={vc.metaChip}>
            <Ionicons name="grid-outline" size={12} color={K.colors.textMuted} />
            <Text style={vc.metaText}>{activityLabel(item.activity)}</Text>
          </View>
          {item.minOrderValue ? (
            <View style={vc.metaChip}>
              <Ionicons name="cart-outline" size={12} color={K.colors.textMuted} />
              <Text style={vc.metaText}>Min {item.minOrderValue}</Text>
            </View>
          ) : null}
        </View>

        <View style={vc.codeRow}>
          <View style={vc.codeChip}>
            <Ionicons name="pricetag-outline" size={14} color={K.colors.accent} />
            <Text style={vc.code}>{item.code}</Text>
          </View>
          <Text style={[vc.validity, expired && { color: K.colors.error }]}>
            {item.isUsed && item.usedAt
              ? `Used ${fmtDate(item.usedAt)}`
              : expired
              ? `Expired ${fmtDate(item.validUntil)}`
              : `Valid until ${fmtDate(item.validUntil)}`}
          </Text>
        </View>
      </View>
    </View>
  );
}

const vc = StyleSheet.create({
  card: {
    backgroundColor: K.colors.bgCard,
    borderRadius: K.radius.card,
    borderWidth: 1,
    borderColor: K.colors.border,
    flexDirection: "row",
    overflow: "hidden",
    ...K.shadow.xs,
  },
  cardInactive: { opacity: 0.6 },
  leftBar: {
    width: 6,
    backgroundColor: K.colors.accent,
  },
  leftBarInactive: { backgroundColor: K.colors.borderStrong },
  body: { flex: 1, padding: 16 },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  discount: { fontSize: K.font.xl, fontWeight: "800", color: K.colors.darkGreen },
  textFaded: { color: K.colors.textMuted },
  badge: {
    borderRadius: K.radius.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeActive:  { backgroundColor: "#dcfce7" },
  badgeUsed:    { backgroundColor: K.colors.bgSubtle },
  badgeExpired: { backgroundColor: "#fee2e2" },
  badgeText:    { fontSize: 11, fontWeight: "700", color: K.colors.textMid },
  title:        { fontSize: K.font.base, fontWeight: "700", color: K.colors.textDark, marginBottom: 4 },
  desc:         { fontSize: K.font.sm, color: K.colors.textMuted, marginBottom: 8 },
  metaRow:      { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 10 },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: K.colors.bgSubtle,
    borderRadius: K.radius.full,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  metaText: { fontSize: 11, color: K.colors.textMuted, fontWeight: "500" },
  codeRow:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  codeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: K.colors.bgTint,
    borderRadius: K.radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: K.colors.accent,
  },
  code:     { fontSize: 13, fontWeight: "800", color: K.colors.accent, letterSpacing: 1 },
  validity: { fontSize: 11, color: K.colors.textMuted },
});

// ── Screen ────────────────────────────────────────────────────────────────────

export default function VoucherWalletScreen() {
  const { data, isLoading, isError, refetch, isFetching } = useVoucherWallet();
  const vouchers = data?.vouchers ?? [];

  const active  = vouchers.filter((v) => !v.isUsed && !isExpired(v.validUntil));
  const expired = vouchers.filter((v) => v.isUsed || isExpired(v.validUntil));

  return (
    <SafeAreaView style={s.container} edges={["top"]}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={24} color={K.colors.textDark} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>My Vouchers</Text>
        <View style={{ width: 36 }} />
      </View>

      {isLoading ? (
        <View style={s.centered}>
          <ActivityIndicator color={K.colors.accent} size="large" />
        </View>
      ) : isError ? (
        <View style={s.centered}>
          <Ionicons name="warning-outline" size={40} color={K.colors.textMuted} />
          <Text style={s.errorText}>Failed to load vouchers</Text>
          <TouchableOpacity style={s.retryBtn} onPress={() => refetch()}>
            <Text style={s.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : vouchers.length === 0 ? (
        <View style={s.centered}>
          <View style={s.emptyIcon}>
            <Ionicons name="pricetag-outline" size={40} color={K.colors.textMuted} />
          </View>
          <Text style={s.emptyTitle}>No vouchers yet</Text>
          <Text style={s.emptySubtitle}>
            Your claimed promo codes and vouchers will appear here
          </Text>
        </View>
      ) : (
        <FlatList
          data={[...active, ...expired]}
          keyExtractor={(item) => item.code}
          renderItem={({ item }) => <VoucherCard item={item} />}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          contentContainerStyle={s.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isFetching && !isLoading}
              onRefresh={refetch}
              tintColor={K.colors.accent}
            />
          }
          ListHeaderComponent={
            active.length > 0 ? (
              <Text style={s.sectionLabel}>
                {active.length} active · {expired.length} used / expired
              </Text>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: K.colors.bgApp },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: K.spacing.screen,
    paddingVertical: 12,
    backgroundColor: K.colors.bgCard,
    borderBottomWidth: 1,
    borderBottomColor: K.colors.border,
    justifyContent: "space-between",
  },
  backBtn:     { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: K.font.lg, fontWeight: "800", color: K.colors.textDark },

  centered: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },

  errorText: { fontSize: K.font.sm, color: K.colors.textMuted, marginTop: 12, textAlign: "center" },
  retryBtn:  { marginTop: 14, backgroundColor: K.colors.accent, borderRadius: K.radius.button, paddingHorizontal: 28, paddingVertical: 12 },
  retryText: { color: "#fff", fontWeight: "700", fontSize: K.font.base },

  emptyIcon: {
    width: 88,
    height: 88,
    borderRadius: K.radius.full,
    backgroundColor: K.colors.bgSubtle,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  emptyTitle:    { fontSize: K.font.lg, fontWeight: "700", color: K.colors.textDark, marginBottom: 8 },
  emptySubtitle: { fontSize: K.font.sm, color: K.colors.textMuted, textAlign: "center", lineHeight: 20 },

  listContent:  { padding: K.spacing.screen, paddingBottom: 40 },
  sectionLabel: { fontSize: K.font.sm, color: K.colors.textMuted, marginBottom: 16, fontWeight: "500" },
});
