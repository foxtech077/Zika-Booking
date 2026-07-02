import { useRef } from "react";
import { View, Text, TouchableOpacity, Animated, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { K } from "../../constants/theme";

interface Props {
  icon: keyof typeof Ionicons.glyphMap;
  iconBg?: string;
  iconColor?: string;
  label: string;
  sublabel?: string;
  onPress: () => void;
  danger?: boolean;
  showBorder?: boolean;
}

// Shared icon + title + subtitle + chevron row used by both the traveller and
// provider Profile screens (previously duplicated as MenuItem/MenuRow).
// Presses give a subtle elevation/scale bump for a premium feel.
export function MenuRow({
  icon,
  iconBg,
  iconColor,
  label,
  sublabel,
  onPress,
  danger,
  showBorder = true,
}: Props) {
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () => Animated.spring(scale, { toValue: 0.98, useNativeDriver: true, speed: 40, bounciness: 0 }).start();
  const onPressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 6 }).start();

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={[s.row, showBorder && s.rowBorder]}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={0.75}
      >
        <View style={[s.iconWrap, { backgroundColor: iconBg ?? K.colors.bgTint }, danger && s.iconWrapDanger]}>
          <Ionicons name={icon} size={18} color={danger ? K.colors.error : iconColor ?? K.colors.darkGreen} />
        </View>
        <View style={s.body}>
          <Text style={[s.label, danger && s.labelDanger]}>{label}</Text>
          {sublabel ? <Text style={s.sublabel}>{sublabel}</Text> : null}
        </View>
        <Ionicons name="chevron-forward" size={16} color={K.colors.textMuted} />
      </TouchableOpacity>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: K.colors.border },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: K.radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapDanger: { backgroundColor: "#FEE2E2" },
  body: { flex: 1 },
  label: { fontSize: K.font.base, fontWeight: "600", color: K.colors.textDark },
  labelDanger: { color: K.colors.error },
  sublabel: { fontSize: 12, color: K.colors.textMuted, marginTop: 2 },
});
