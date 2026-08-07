import { View, ActivityIndicator, StyleSheet } from "react-native";
import { K } from "../../constants/theme";

/** List-screen loading state (unchanged behavior: shown while the list query is loading). */
export function BookingListLoading() {
  return (
    <View style={l.center}>
      <ActivityIndicator color={K.colors.accent} size="large" />
    </View>
  );
}

/** Detail-screen loading skeleton — same shimmer-block layout as before, just extracted. */
export function BookingDetailSkeleton() {
  return (
    <View style={l.skeletonWrap}>
      <View style={l.skeletonTitle} />
      {[80, 60, 100, 50, 90, 70].map((w, i) => (
        <View key={i} style={[l.skeletonLine, { width: `${w}%` as any }]} />
      ))}
    </View>
  );
}

const l = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, padding: 32 },
  skeletonWrap: { flex: 1, backgroundColor: K.colors.bgLight, padding: 20 },
  skeletonTitle: { height: 24, width: "60%", backgroundColor: K.colors.border, borderRadius: 6, marginBottom: 16 },
  skeletonLine: { height: 14, backgroundColor: K.colors.border, borderRadius: 6, marginBottom: 12 },
});
