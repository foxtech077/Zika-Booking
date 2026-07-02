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
import { Ionicons } from "@expo/vector-icons";
import { K } from "../constants/theme";
import { useVoucherWallet, useMergedVouchers, isVoucherActive } from "../hooks/vouchers";
import { VoucherCard } from "../components/vouchers/VoucherCard";
import type { WalletVoucher } from "../lib/types/voucher";

// ── Screen ────────────────────────────────────────────────────────────────────

export default function VoucherWalletScreen() {
  // Wallet-only data still drives the "used / expired" tail of the list (the
  // /vouchers/applicable fallback has no concept of a guest's redemption history).
  const { data: walletData } = useVoucherWallet();
  const { bestVoucher, otherVouchers, isLoading, isError, refetch, isFetching } = useMergedVouchers();

  const active: WalletVoucher[] = bestVoucher ? [bestVoucher, ...otherVouchers] : otherVouchers;
  const inactive = (walletData?.vouchers ?? []).filter((v) => !isVoucherActive(v));
  const vouchers = [...active, ...inactive]; // combined active + used/expired for the empty-state check below

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
          data={vouchers}
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
                {active.length} active · {inactive.length} used / expired
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
