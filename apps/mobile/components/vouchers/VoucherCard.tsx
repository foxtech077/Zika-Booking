import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { K } from "../../constants/theme";
import { isVoucherExpired } from "../../hooks/vouchers";
import type { WalletVoucher } from "../../lib/types/voucher";

export function fmtVoucherDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function voucherDiscountLabel(v: WalletVoucher): string {
  if (v.discountType === "percentage") return `${v.discountValue}% off`;
  return `${v.discountValue} off`;
}

export function voucherActivityLabel(activity: string): string {
  const map: Record<string, string> = {
    hotels:            "Hotels",
    apartments:        "Apartments",
    cars:              "Car rentals",
    hotels_apartments: "Hotels & Apartments",
    universal:         "All bookings",
  };
  return map[activity] ?? activity;
}

export function voucherActivityIcon(activity: string): keyof typeof Ionicons.glyphMap {
  const map: Record<string, keyof typeof Ionicons.glyphMap> = {
    hotels:            "bed-outline",
    apartments:        "home-outline",
    cars:              "car-outline",
    hotels_apartments: "bed-outline",
    universal:         "pricetag-outline",
  };
  return map[activity] ?? "pricetag-outline";
}

const STATUS_LABEL: Record<WalletVoucher["status"], string> = {
  active:    "Active",
  paused:    "Paused",
  expired:   "Expired",
  exhausted: "Exhausted",
};

export function VoucherCard({ item, onPress }: { item: WalletVoucher; onPress?: () => void }) {
  const expired  = item.status === "expired" || isVoucherExpired(item.validUntil);
  const inactive = item.status !== "active" || expired;

  const content = (
    <>
      <View style={[vc.leftBar, inactive && vc.leftBarInactive]} />

      <View style={vc.body}>
        <View style={vc.topRow}>
          <Text style={[vc.discount, inactive && vc.textFaded]}>
            {voucherDiscountLabel(item)}
          </Text>
          <View style={[vc.badge, inactive ? vc.badgeInactive : vc.badgeActive]}>
            <Text style={vc.badgeText}>{expired ? STATUS_LABEL.expired : STATUS_LABEL[item.status]}</Text>
          </View>
        </View>

        <Text style={[vc.title, inactive && vc.textFaded]} numberOfLines={2}>
          {item.title}
        </Text>
        {item.description ? (
          <Text style={vc.desc} numberOfLines={2}>{item.description}</Text>
        ) : null}

        <View style={vc.metaRow}>
          <View style={vc.metaChip}>
            <Ionicons name={voucherActivityIcon(item.activityScope)} size={12} color={K.colors.textMuted} />
            <Text style={vc.metaText}>{voucherActivityLabel(item.activityScope)}</Text>
          </View>
          {item.minOrderValue ? (
            <View style={vc.metaChip}>
              <Ionicons name="cart-outline" size={12} color={K.colors.textMuted} />
              <Text style={vc.metaText}>Min {item.minOrderValue}</Text>
            </View>
          ) : null}
          {item.maxDiscount ? (
            <View style={vc.metaChip}>
              <Ionicons name="trending-up-outline" size={12} color={K.colors.textMuted} />
              <Text style={vc.metaText}>Up to {item.maxDiscount}</Text>
            </View>
          ) : null}
        </View>

        <View style={vc.codeRow}>
          <View style={vc.codeChip}>
            <Ionicons name="pricetag-outline" size={14} color={K.colors.accent} />
            <Text style={vc.code}>{item.code}</Text>
          </View>
          <Text style={[vc.validity, expired && { color: K.colors.error }]}>
            {expired ? `Expired ${fmtVoucherDate(item.validUntil)}` : `Exp ${fmtVoucherDate(item.validUntil)}`}
          </Text>
        </View>
      </View>
    </>
  );

  if (onPress) {
    return (
      <TouchableOpacity style={[vc.card, inactive && vc.cardInactive]} onPress={onPress} activeOpacity={0.85}>
        {content}
      </TouchableOpacity>
    );
  }
  return <View style={[vc.card, inactive && vc.cardInactive]}>{content}</View>;
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
  badgeActive:   { backgroundColor: "#dcfce7" },
  badgeInactive: { backgroundColor: K.colors.bgSubtle },
  badgeText:     { fontSize: 11, fontWeight: "700", color: K.colors.textMid },
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
