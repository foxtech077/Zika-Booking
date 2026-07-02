import { View, Text, StyleSheet } from "react-native";
import { ReviewStars } from "./ReviewStars";
import { K } from "../../constants/theme";

interface Props {
  averageRating: number | null;
  totalReviews: number;
  compact?: boolean;
}

export function ReviewSummary({ averageRating, totalReviews, compact }: Props) {
  if (averageRating == null || totalReviews === 0) return null;
  return (
    <View style={compact ? s.compactWrap : s.wrap}>
      <Text style={compact ? s.compactValue : s.value}>{averageRating.toFixed(1)}</Text>
      <ReviewStars rating={Math.round(averageRating)} size={compact ? 12 : 16} />
      <Text style={s.count}>
        {totalReviews.toLocaleString()} review{totalReviews !== 1 ? "s" : ""}
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { alignItems: "center", gap: 4 },
  value: { fontSize: 32, fontWeight: "900", color: K.colors.textDark, letterSpacing: -0.5 },
  compactWrap: { alignItems: "center", gap: 2 },
  compactValue: { fontSize: 20, fontWeight: "800", color: K.colors.textDark },
  count: { fontSize: 12, color: K.colors.textMuted, fontWeight: "500" },
});
