import { useEffect, useRef } from "react";
import { Animated } from "react-native";
import { K } from "../../constants/theme";

interface Props {
  w: number | string;
  h?: number;
  mb?: number;
  radius?: number;
}

// Shared shimmer/pulse placeholder used across skeleton loading states
// (moved here from app/(tabs)/loyalty.tsx so the Profile screens can reuse it).
export function SkeletonPulse({ w, h = 14, mb = 0, radius = 6 }: Props) {
  const anim = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);
  return (
    <Animated.View
      style={{
        width: w as any,
        height: h,
        backgroundColor: K.colors.bgSubtle,
        borderRadius: radius,
        marginBottom: mb,
        opacity: anim,
      }}
    />
  );
}
