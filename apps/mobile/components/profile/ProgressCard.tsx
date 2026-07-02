import { useEffect, useRef } from "react";
import { View, Animated, Easing, StyleSheet } from "react-native";

interface Props {
  pct: number; // 0..1
  trackColor?: string;
  fillColor?: string;
  height?: number;
}

// Animated progress bar used inside MembershipCard.
export function ProgressCard({ pct, trackColor = "rgba(255,255,255,0.25)", fillColor = "#fff", height = 8 }: Props) {
  const widthAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(widthAnim, {
      toValue: Math.max(0, Math.min(pct, 1)) * 100,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // animating `width` isn't supported by the native driver
    }).start();
  }, [pct, widthAnim]);

  return (
    <View style={[s.track, { backgroundColor: trackColor, height, borderRadius: height / 2 }]}>
      <Animated.View
        style={[
          s.fill,
          {
            backgroundColor: fillColor,
            height,
            borderRadius: height / 2,
            width: widthAnim.interpolate({ inputRange: [0, 100], outputRange: ["0%", "100%"] }),
          },
        ]}
      />
    </View>
  );
}

const s = StyleSheet.create({
  track: { width: "100%", overflow: "hidden" },
  fill: {},
});
