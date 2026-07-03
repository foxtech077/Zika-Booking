import { View, Text, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { K } from "../../constants/theme";

/**
 * Single shared status config, unifying the two slightly different STATUS_CFG
 * objects that previously lived separately in the list and detail screens.
 * Same status keys, same fallback ("completed" style) behavior as before.
 */
export const BOOKING_STATUS_CFG: Record<
  string,
  { label: string; bg: string; text: string; dot: string; icon: React.ComponentProps<typeof Feather>["name"] }
> = {
  confirmed:             { label: "Confirmed", bg: "#D1FAE5", text: "#065F46", dot: "#059669", icon: "check-circle" },
  pending_payment:       { label: "Pending",   bg: "#FEF3C7", text: "#92400E", dot: "#F59E0B", icon: "clock" },
  completed:             { label: "Completed", bg: "#F1F5F9", text: "#475569", dot: "#94A3B8", icon: "check-square" },
  cancelled_by_guest:    { label: "Cancelled", bg: "#FEE2E2", text: "#DC2626", dot: "#EF4444", icon: "x-circle" },
  cancelled_by_provider: { label: "Cancelled", bg: "#FEE2E2", text: "#DC2626", dot: "#EF4444", icon: "x-circle" },
  cancelled_by_system:   { label: "Cancelled", bg: "#FEE2E2", text: "#DC2626", dot: "#EF4444", icon: "x-circle" },
  refunded:              { label: "Refunded",  bg: "#D1FAE5", text: "#065F46", dot: "#059669", icon: "rotate-ccw" },
};

export function bookingStatusCfg(status: string) {
  return BOOKING_STATUS_CFG[status] ?? BOOKING_STATUS_CFG.completed!;
}

export function BookingStatusBadge({
  status,
  size = "md",
}: {
  status: string;
  /** "sm" = compact pill for cards, "md" = fuller pill for the detail header */
  size?: "sm" | "md";
}) {
  const cfg = bookingStatusCfg(status);
  const compact = size === "sm";
  return (
    <View style={[b.pill, { backgroundColor: cfg.bg }, compact && b.pillCompact]}>
      <Feather name={cfg.icon} size={compact ? 10 : 12} color={cfg.text} />
      <Text style={[b.text, { color: cfg.text }, compact && b.textCompact]}>{cfg.label}</Text>
    </View>
  );
}

const b = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: K.radius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  pillCompact: { paddingHorizontal: 9, paddingVertical: 4 },
  text: { fontSize: 12, fontWeight: "700" },
  textCompact: { fontSize: 11 },
});
