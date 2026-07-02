import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { K } from "../../constants/theme";

interface Props {
  title?: string;
  subtitle?: string;
}

export function EmptyReviewState({ title = "No reviews yet", subtitle }: Props) {
  return (
    <View style={s.wrap}>
      <View style={s.iconCircle}>
        <Ionicons name="chatbubble-ellipses-outline" size={36} color={K.colors.textMuted} />
      </View>
      <Text style={s.title}>{title}</Text>
      {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { alignItems: "center", paddingVertical: 32, gap: 8 },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: K.colors.bgSubtle,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  title: { fontSize: K.font.lg, fontWeight: "700", color: K.colors.textDark },
  subtitle: { fontSize: K.font.sm, color: K.colors.textMuted, textAlign: "center", lineHeight: 20, paddingHorizontal: 24 },
});
