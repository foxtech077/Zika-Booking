import { useEffect, useRef } from "react";
import { View, Text, Animated, StyleSheet, ActivityIndicator } from "react-native";
import Svg, { Circle } from "react-native-svg";

// See TierProfileRing.tsx for why this cast is needed (react-native-svg / @types/react version mismatch).
const AnimatedCircle = Animated.createAnimatedComponent(Circle as any);

interface Props {
  size: number;
  progress: number; // 0..1
  label?: string; // e.g. "Uploading…" / "Saving…"
  indeterminate?: boolean; // spinner instead of a % ring (compressing/presigning/saving have no progress)
}

// Dims the avatar and overlays either a determinate progress ring (while the
// S3 PUT is streaming) or a spinner (compress/presign/save — no % available).
export function UploadProgressOverlay({ size, progress, label, indeterminate }: Props) {
  const strokeWidth = 3;
  const radius = size / 2 - strokeWidth * 2;
  const circumference = 2 * Math.PI * radius;

  const animatedProgress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animatedProgress, {
      toValue: progress,
      duration: 200,
      useNativeDriver: false, // strokeDashoffset isn't a supported native-driver prop
    }).start();
  }, [progress, animatedProgress]);

  const strokeDashoffset = animatedProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  });

  return (
    <View style={[StyleSheet.absoluteFillObject, s.overlay, { borderRadius: size / 2 }]}>
      {indeterminate ? (
        <ActivityIndicator color="#fff" size="small" />
      ) : (
        <Svg width={size} height={size} style={{ transform: [{ rotate: "-90deg" }] }}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="rgba(255,255,255,0.3)"
            strokeWidth={strokeWidth}
            fill="none"
          />
          <AnimatedCircle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#fff"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            fill="none"
          />
        </Svg>
      )}
      {label ? <Text style={s.label}>{label}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  overlay: {
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  label: { color: "#fff", fontSize: 10, fontWeight: "700" },
});
