import { View, StyleSheet } from "react-native";
import { SkeletonPulse } from "../ui/SkeletonPulse";
import { K } from "../../constants/theme";

export function ReviewCardSkeleton() {
  return (
    <View style={s.card}>
      <View style={s.topRow}>
        <SkeletonPulse w={34} h={34} radius={17} />
        <View style={{ flex: 1, gap: 6 }}>
          <SkeletonPulse w={100} h={12} />
          <SkeletonPulse w={70} h={11} />
        </View>
      </View>
      <SkeletonPulse w="100%" h={13} mb={6} />
      <SkeletonPulse w="80%" h={13} />
    </View>
  );
}

export function ReviewListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <View style={{ gap: 12 }}>
      {Array.from({ length: count }).map((_, i) => (
        <ReviewCardSkeleton key={i} />
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: K.colors.bgCard,
    borderRadius: K.radius.card,
    borderWidth: 1,
    borderColor: K.colors.border,
    padding: 16,
  },
  topRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
});
