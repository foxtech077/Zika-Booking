import { View, StyleSheet } from "react-native";
import { SkeletonPulse } from "../ui/SkeletonPulse";
import { K } from "../../constants/theme";

// Premium skeleton for the Profile screen's loading state — no full-screen spinner.
export function ProfileSkeleton() {
  return (
    <View>
      <View style={s.header}>
        <SkeletonPulse w={100} h={100} radius={50} mb={14} />
        <SkeletonPulse w={160} h={20} mb={6} />
        <SkeletonPulse w={120} h={13} mb={12} />
        <SkeletonPulse w={110} h={26} radius={13} />
      </View>

      <View style={s.section}>
        <SkeletonPulse w="100%" h={130} radius={K.radius.xl} mb={16} />
        <SkeletonPulse w="100%" h={70} radius={K.radius.xl} mb={16} />
        {[1, 2, 3].map((i) => (
          <SkeletonPulse key={i} w="100%" h={140} radius={K.radius.xl} mb={16} />
        ))}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    alignItems: "center",
    paddingVertical: 28,
    marginBottom: 16,
    marginHorizontal: K.spacing.screen,
  },
  section: { marginHorizontal: K.spacing.screen },
});
