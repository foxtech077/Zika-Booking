import { View, Text, StyleSheet } from "react-native";
import { Ionicons, Feather } from "@expo/vector-icons";
import { K } from "../../constants/theme";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
}

export interface BookingSummaryData {
  listingTitle: string;
  listingCategory: "hotel" | "apartment" | "car";
  checkIn?: string;
  checkOut?: string;
  pickupDatetime?: string;
  returnDatetime?: string;
  nightsOrDays: number;
  adults?: number;
  children?: number;
  specialRequests?: string;
}

/** Presentational-only — property + stay/rental info block for the detail screen. */
export function BookingSummaryCard({ booking }: { booking: BookingSummaryData }) {
  const isCar = booking.listingCategory === "car";
  const catIcon = isCar ? "car-sport" : booking.listingCategory === "hotel" ? "business" : "home";
  const catLabel = isCar ? "Car Rental" : booking.listingCategory === "hotel" ? "Hotel" : "Home";

  const startLabel = isCar ? "Pickup" : "Check-in";
  const endLabel = isCar ? "Return" : "Check-out";
  const startVal = isCar && booking.pickupDatetime
    ? fmtDateTime(booking.pickupDatetime)
    : booking.checkIn ? fmtDate(booking.checkIn) : "—";
  const endVal = isCar && booking.returnDatetime
    ? fmtDateTime(booking.returnDatetime)
    : booking.checkOut ? fmtDate(booking.checkOut) : "—";

  const guestsLabel = booking.adults != null
    ? `${booking.adults} adult${booking.adults !== 1 ? "s" : ""}${booking.children ? `, ${booking.children} child${booking.children !== 1 ? "ren" : ""}` : ""}`
    : null;

  return (
    <View style={s.wrap}>
      {/* Property card — no photo field exists on this data, so a category icon tile stands in */}
      <View style={s.propCard}>
        <View style={s.propIconWrap}>
          <Ionicons name={catIcon as any} size={22} color={K.colors.darkGreen} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.propLabel}>PROPERTY</Text>
          <Text style={s.propName} numberOfLines={1}>{booking.listingTitle}</Text>
          <View style={s.catPill}>
            <Text style={s.catPillText}>{catLabel}</Text>
          </View>
        </View>
      </View>

      {/* Date tiles */}
      <View style={s.dateRow}>
        <View style={s.dateTile}>
          <Text style={s.dateTileLabel}>{startLabel.toUpperCase()}</Text>
          <Text style={s.dateTileValue}>{startVal}</Text>
        </View>
        <View style={s.dateTile}>
          <Text style={s.dateTileLabel}>{endLabel.toUpperCase()}</Text>
          <Text style={s.dateTileValue}>{endVal}</Text>
        </View>
      </View>

      {/* Nights / Guests chips */}
      <View style={s.chipRow}>
        <View style={s.chip}>
          <Feather name={isCar ? "calendar" : "moon"} size={13} color={K.colors.textMuted} />
          <Text style={s.chipText}>
            {booking.nightsOrDays} {isCar ? (booking.nightsOrDays === 1 ? "Day" : "Days") : (booking.nightsOrDays === 1 ? "Night" : "Nights")}
          </Text>
        </View>
        {guestsLabel && (
          <View style={s.chip}>
            <Feather name="users" size={13} color={K.colors.textMuted} />
            <Text style={s.chipText}>{guestsLabel}</Text>
          </View>
        )}
      </View>

      {booking.specialRequests ? (
        <View style={s.specialBox}>
          <Text style={s.specialLabel}>Special Requests</Text>
          <Text style={s.specialText}>{booking.specialRequests}</Text>
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: 12 },

  propCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: "#fff",
    borderRadius: K.radius.xl,
    padding: 16,
    borderWidth: 1,
    borderColor: K.colors.border,
    ...K.shadow.sm,
  },
  propIconWrap: {
    width: 52, height: 52, borderRadius: K.radius.lg,
    backgroundColor: K.colors.bgTint, alignItems: "center", justifyContent: "center",
  },
  propLabel: { fontSize: 10, fontWeight: "800", color: K.colors.textMuted, letterSpacing: 0.8, marginBottom: 2 },
  propName: { fontSize: K.font.lg, fontWeight: "800", color: K.colors.textDark, marginBottom: 6 },
  catPill: {
    alignSelf: "flex-start", backgroundColor: K.colors.bgTint,
    borderRadius: K.radius.full, paddingHorizontal: 10, paddingVertical: 3,
  },
  catPillText: { fontSize: 11, fontWeight: "700", color: K.colors.darkGreen },

  dateRow: { flexDirection: "row", gap: 12 },
  dateTile: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: K.radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: K.colors.border,
  },
  dateTileLabel: { fontSize: 10, fontWeight: "800", color: K.colors.textMuted, letterSpacing: 0.6, marginBottom: 6 },
  dateTileValue: { fontSize: K.font.base, fontWeight: "800", color: K.colors.textDark },

  chipRow: { flexDirection: "row", gap: 10 },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: K.colors.bgSubtle, borderRadius: K.radius.full,
    paddingHorizontal: 12, paddingVertical: 7,
  },
  chipText: { fontSize: 12, fontWeight: "600", color: K.colors.textMid },

  specialBox: {
    backgroundColor: K.colors.bgLight, borderRadius: K.radius.md,
    padding: 12, borderWidth: 1, borderColor: K.colors.border,
  },
  specialLabel: { fontSize: 11, fontWeight: "700", color: K.colors.textMuted, marginBottom: 4 },
  specialText: { fontSize: K.font.sm, color: K.colors.textDark, lineHeight: 18 },
});
