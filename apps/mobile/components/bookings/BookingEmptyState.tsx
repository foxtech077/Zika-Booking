import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { K } from "../../constants/theme";

export function BookingEmptyState() {
  return (
    <View style={e.wrap}>
      <View style={e.iconWrap}>
        <Ionicons name="calendar-outline" size={36} color={K.colors.textMuted} />
      </View>
      <Text style={e.title}>No bookings found</Text>
      <Text style={e.sub}>Booking in this category will appear here.</Text>
    </View>
  );
}

export function BookingErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <View style={e.wrap}>
      <Ionicons name="alert-circle-outline" size={48} color="#fca5a5" />
      <Text style={e.title}>Could not load bookings</Text>
      <TouchableOpacity style={e.retryBtn} onPress={onRetry}>
        <Text style={e.retryText}>Try Again</Text>
      </TouchableOpacity>
    </View>
  );
}

const e = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingTop: 64, paddingHorizontal: 32 },
  iconWrap: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: "#fff", alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: K.colors.border,
    marginBottom: 4,
  },
  title: { fontSize: 17, fontWeight: "700", color: K.colors.textDark, textAlign: "center" },
  sub: { fontSize: 13, color: K.colors.textMuted, textAlign: "center", lineHeight: 18 },
  retryBtn: { backgroundColor: K.colors.darkGreen, borderRadius: K.radius.md, paddingHorizontal: 28, paddingVertical: 12 },
  retryText: { color: "#fff", fontWeight: "700" },
});
