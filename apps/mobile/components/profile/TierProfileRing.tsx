import { useEffect, useRef } from "react";
import { View, Animated, Easing, StyleSheet } from "react-native";
import Svg, { Defs, LinearGradient, Stop, Circle } from "react-native-svg";
import type { LoyaltyTier } from "@zika/types";
import { TIER_RING_CONFIG } from "../../constants/loyaltyTiers";

// react-native-svg ships its own (older) copy of @types/react, which TS sees as
// structurally incompatible with Animated.createAnimatedComponent's ComponentType
// — a known type-only conflict, harmless at runtime. Cast through `any` here.
const AnimatedSvg = Animated.createAnimatedComponent(Svg as any);

interface Props {
  tier: LoyaltyTier;
  size?: number; // avatar diameter (content circle, excludes ring)
  strokeWidth?: number;
  children: React.ReactNode;
}

// Premium animated tier border: an SVG gradient ring that slowly rotates
// (speed + color set per tier in TIER_RING_CONFIG), plus a soft pulsing glow
// behind it. Bronze stays static with just the glow — silver/gold/diamond
// rotate at increasing "premium-ness", which doubles as the shine/shimmer.
export function TierProfileRing({ tier, size = 96, strokeWidth = 4, children }: Props) {
  const cfg = TIER_RING_CONFIG[tier];
  const outerSize = size + strokeWidth * 2 + 6;
  const radius = outerSize / 2 - strokeWidth;

  const rotateAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    let rotateLoop: Animated.CompositeAnimation | null = null;
    if (cfg.rotationMs) {
      rotateAnim.setValue(0);
      rotateLoop = Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: cfg.rotationMs,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      );
      rotateLoop.start();
    }
    const glowLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 0.6, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.32, duration: 1400, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    glowLoop.start();
    return () => {
      rotateLoop?.stop();
      glowLoop.stop();
    };
  }, [tier, cfg.rotationMs, rotateAnim, glowAnim]);

  const rotate = rotateAnim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const gradientId = `tierRingGradient-${tier}`;

  return (
    <View style={{ width: outerSize, height: outerSize, alignItems: "center", justifyContent: "center" }}>
      {/* Soft pulsing glow behind the ring */}
      <Animated.View
        style={[
          StyleSheet.absoluteFillObject,
          {
            borderRadius: outerSize / 2,
            backgroundColor: cfg.glowColor,
            opacity: glowAnim,
            transform: [{ scale: 1.12 }],
          },
        ]}
      />

      <AnimatedSvg
        width={outerSize}
        height={outerSize}
        style={cfg.rotationMs ? { transform: [{ rotate }] } : undefined}
      >
        <Defs>
          <LinearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            {cfg.gradientColors.map((color, i) => (
              <Stop key={i} offset={`${(i / (cfg.gradientColors.length - 1)) * 100}%`} stopColor={color} />
            ))}
          </LinearGradient>
        </Defs>
        <Circle
          cx={outerSize / 2}
          cy={outerSize / 2}
          r={radius}
          stroke={`url(#${gradientId})`}
          strokeWidth={strokeWidth}
          fill="none"
        />
      </AnimatedSvg>

      {/* Avatar content, centered inside the ring */}
      <View style={{ position: "absolute", width: size, height: size, borderRadius: size / 2, overflow: "hidden" }}>
        {children}
      </View>
    </View>
  );
}
