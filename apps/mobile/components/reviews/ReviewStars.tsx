import { useRef } from "react";
import { View, TouchableOpacity, Animated } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { K } from "../../constants/theme";

interface Props {
  rating: number;
  size?: number;
  onChange?: (rating: number) => void; // interactive mode when provided
  gap?: number;
}

// Dual-mode star row: read-only display (ReviewStars rating={4}) or an
// interactive picker (ReviewStars rating={value} onChange={setValue}) used by
// ReviewForm — a single component instead of separate display/input variants.
export function ReviewStars({ rating, size = 16, onChange, gap = 2 }: Props) {
  const scales = useRef([1, 2, 3, 4, 5].map(() => new Animated.Value(1))).current;

  function handlePress(n: number) {
    if (!onChange) return;
    onChange(n);
    Animated.sequence([
      Animated.spring(scales[n - 1], { toValue: 1.35, useNativeDriver: true, speed: 30, bounciness: 12 }),
      Animated.spring(scales[n - 1], { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 8 }),
    ]).start();
  }

  return (
    <View style={{ flexDirection: "row", gap }}>
      {[1, 2, 3, 4, 5].map((n) => {
        const icon = n <= rating ? "star" : "star-outline";
        const color = n <= rating ? K.colors.gold : K.colors.border;
        const star = (
          <Animated.View style={{ transform: [{ scale: scales[n - 1] }] }}>
            <Ionicons name={icon} size={size} color={color} />
          </Animated.View>
        );
        return onChange ? (
          <TouchableOpacity key={n} onPress={() => handlePress(n)} activeOpacity={0.7} hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}>
            {star}
          </TouchableOpacity>
        ) : (
          <View key={n}>{star}</View>
        );
      })}
    </View>
  );
}
