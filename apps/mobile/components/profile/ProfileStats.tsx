import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { K } from "../../constants/theme";

export interface StatItem {
  key: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}

interface Props {
  items: StatItem[];
}

// Reusable quick-stats row (e.g. Trips/Saved/Rewards for travellers,
// Listings/Reservations/Earnings for providers).
export function ProfileStats({ items }: Props) {
  return (
    <View style={s.row}>
      {items.map((item, i) => (
        <View key={item.key} style={{ flexDirection: "row", flex: 1 }}>
          <TouchableOpacity style={s.cell} onPress={item.onPress} activeOpacity={0.75}>
            <Ionicons name={item.icon} size={20} color={K.colors.darkGreen} />
            <Text style={s.label}>{item.label}</Text>
            <Ionicons name="chevron-forward" size={12} color={K.colors.textMuted} />
          </TouchableOpacity>
          {i < items.length - 1 && <View style={s.divider} />}
        </View>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: "row",
    backgroundColor: K.colors.bgCard,
    borderRadius: K.radius.xl,
    marginHorizontal: K.spacing.screen,
    borderWidth: 1,
    borderColor: K.colors.border,
    overflow: "hidden",
    ...K.shadow.xs,
  },
  cell: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 16 },
  label: { fontSize: K.font.sm, fontWeight: "600", color: K.colors.textMid },
  divider: { width: 1, backgroundColor: K.colors.border, marginVertical: 12 },
});
