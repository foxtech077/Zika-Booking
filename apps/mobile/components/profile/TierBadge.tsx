import { View, Text, StyleSheet } from "react-native";
import type { LoyaltyTier } from "@zika/types";
import { TIER_COLORS, TIER_EMOJI, TIER_LABEL } from "../../constants/loyaltyTiers";

interface Props {
  tier: LoyaltyTier;
}

export function TierBadge({ tier }: Props) {
  const color = TIER_COLORS[tier];
  return (
    <View style={[s.badge, { backgroundColor: color + "20", borderColor: color + "55" }]}>
      <Text style={s.emoji}>{TIER_EMOJI[tier]}</Text>
      <Text style={[s.label, { color }]}>{TIER_LABEL[tier]} Member</Text>
    </View>
  );
}

const s = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: "center",
  },
  emoji: { fontSize: 13 },
  label: { fontSize: 12, fontWeight: "700" },
});
