import { useEffect, useRef } from "react";
import { View, Text, Animated, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { K } from "../../constants/theme";
import type { ProviderReviewDistributionRow } from "../../hooks/reviews";

interface Props {
  distribution: ProviderReviewDistributionRow[];
  total: number;
}

// Visual 5→1 star percentage bars. Only real distribution data is ever passed
// in (currently only GET /provider/reviews returns one) — the public
// per-listing endpoint doesn't provide a distribution, so this component is
// never rendered against a partial/inferred dataset.
export function ReviewDistribution({ distribution, total }: Props) {
  const countByRating = new Map(distribution.map((d) => [d.rating, d.count]));

  return (
    <View style={s.wrap}>
      {[5, 4, 3, 2, 1].map((star) => {
        const count = countByRating.get(star) ?? 0;
        const pct = total > 0 ? count / total : 0;
        return <DistributionRow key={star} star={star} count={count} pct={pct} />;
      })}
    </View>
  );
}

function DistributionRow({ star, count, pct }: { star: number; count: number; pct: number }) {
  const widthAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(widthAnim, { toValue: pct * 100, duration: 600, useNativeDriver: false }).start();
  }, [pct, widthAnim]);

  return (
    <View style={s.row}>
      <View style={s.starLabel}>
        <Text style={s.starLabelText}>{star}</Text>
        <Ionicons name="star" size={11} color={K.colors.gold} />
      </View>
      <View style={s.track}>
        <Animated.View
          style={[s.fill, { width: widthAnim.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"] }) }]}
        />
      </View>
      <Text style={s.count}>{count}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  starLabel: { flexDirection: "row", alignItems: "center", gap: 3, width: 28 },
  starLabelText: { fontSize: 12, fontWeight: "600", color: K.colors.textMid },
  track: { flex: 1, height: 7, borderRadius: 4, backgroundColor: K.colors.bgSubtle, overflow: "hidden" },
  fill: { height: 7, borderRadius: 4, backgroundColor: K.colors.gold },
  count: { fontSize: 11, color: K.colors.textMuted, width: 24, textAlign: "right" },
});
