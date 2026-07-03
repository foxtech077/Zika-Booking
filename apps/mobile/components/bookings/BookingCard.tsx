import { memo } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons, Feather } from "@expo/vector-icons";
import { K } from "../../constants/theme";
import { BookingStatusBadge } from "./BookingStatusBadge";

export interface BookingCardData {
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

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en", { day: "numeric", month: "short" });
}

function avatarColor(name: string): string {
  const COLORS = ["#0891b2", "#7c3aed", "#be185d", "#0f766e", "#b45309", "#1d4ed8", "#15803d"];
  const idx = (name.charCodeAt(0) ?? 0) % COLORS.length;
  return COLORS[idx]!;
}

/**
 * Presentational-only booking card. All data is passed in as props; the
 * screen owns navigation (onPress) and the message-stub handler (onMessage).
 */
export const BookingCard = memo(function BookingCard({
  item,
  net,
  onPress,
  onMessage,
}: {
  item: BookingCardData;
  /** Pre-computed net payout (screen keeps the existing commission-fallback math) */
  net: number;
  onPress: () => void;
  onMessage: () => void;
}) {
  const isCar  = item.listingCategory === "car";
  const dur    = item.nightsOrDays;
  const durStr = dur ? `${dur} ${isCar ? "day" : "night"}${dur !== 1 ? "s" : ""}` : null;
  const initial = item.guestFirstName[0]?.toUpperCase() ?? "?";
  const acBg    = avatarColor(item.guestFirstName);
  const catIcon = isCar ? "car-sport" : item.listingCategory === "hotel" ? "business" : "home";

  return (
    <View style={c.card}>
      {/* Property header — no photo field exists on this data, so use a category icon tile */}
      <View style={c.propHeader}>
        <View style={c.propIconWrap}>
          <Ionicons name={catIcon as any} size={18} color={K.colors.darkGreen} />
        </View>
        <Text style={c.propName} numberOfLines={1}>{item.listingTitle}</Text>
        <BookingStatusBadge status={item.status} size="sm" />
      </View>

      {/* Guest row */}
      <View style={c.guestRow}>
        <View style={[c.avatar, { backgroundColor: acBg }]}>
          <Text style={c.avatarText}>{initial}</Text>
        </View>
        <View style={c.guestInfo}>
          <Text style={c.guestName}>{item.guestFirstName} {item.guestLastName[0]}.</Text>
          <Text style={c.refText}>#{item.reference}</Text>
        </View>
        <TouchableOpacity style={c.msgBtn} onPress={onMessage} hitSlop={8} activeOpacity={0.75}>
          <Feather name="message-circle" size={16} color={K.colors.darkGreen} />
        </TouchableOpacity>
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

      {/* Footer: payout + primary action */}
      <View style={c.footer}>
        <View style={c.payoutRow}>
          <Ionicons name="cash-outline" size={13} color={K.colors.accent} />
          <Text style={c.payoutText}>{item.currency} {net.toLocaleString()}</Text>
        </View>
        <TouchableOpacity style={c.viewBtn} onPress={onPress} activeOpacity={0.85}>
          <Text style={c.viewBtnText}>View Details</Text>
          <Feather name="arrow-right" size={13} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
});

const c = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: K.radius.xl,
    padding: 16,
    borderWidth: 1,
    borderColor: K.colors.border,
    ...K.shadow.sm,
  },

  propHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  propIconWrap: {
    width: 34, height: 34, borderRadius: K.radius.md,
    backgroundColor: K.colors.bgTint, alignItems: "center", justifyContent: "center",
  },
  propName: { flex: 1, fontSize: K.font.sm, fontWeight: "700", color: K.colors.textDark },

  guestRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 14, fontWeight: "800", color: "#fff" },
  guestInfo: { flex: 1 },
  guestName: { fontSize: 14, fontWeight: "700", color: K.colors.textDark, marginBottom: 2 },
  refText: { fontSize: 11, color: K.colors.textMuted, fontFamily: "monospace" },
  msgBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: K.colors.bgTint, alignItems: "center", justifyContent: "center",
  },

  datesRow: { flexDirection: "row", alignItems: "center", marginBottom: 14 },
  dateBlock: { flex: 1 },
  dateLabel: { fontSize: 9, fontWeight: "700", color: K.colors.textMuted, letterSpacing: 0.8, marginBottom: 4 },
  dateValue: { fontSize: 14, fontWeight: "700", color: K.colors.textDark },
  dateMid: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 },
  dateLine: { flex: 1, height: 1, backgroundColor: K.colors.border },
  durationChip: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: K.colors.bgSubtle, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 3 },
  durationText: { fontSize: 10, color: K.colors.textMuted, fontWeight: "600" },

  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 12, borderTopWidth: 1, borderTopColor: K.colors.border },
  payoutRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  payoutText: { fontSize: 14, fontWeight: "800", color: K.colors.darkGreen },
  viewBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: K.colors.darkGreen, borderRadius: K.radius.md,
    paddingHorizontal: 14, paddingVertical: 9,
  },
  viewBtnText: { fontSize: 12, fontWeight: "700", color: "#fff" },
});
