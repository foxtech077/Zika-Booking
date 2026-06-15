import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  type TouchableOpacityProps,
  type StyleProp,
  type ViewStyle,
  type TextStyle,
} from "react-native";
import { K } from "../../constants/theme";

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  loading?: boolean;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  textStyle?: StyleProp<TextStyle>;
  containerStyle?: StyleProp<ViewStyle>;
}

export function Button({
  title,
  loading,
  variant = "primary",
  size = "md",
  disabled,
  style,
  textStyle,
  containerStyle,
  ...props
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      style={[
        styles.base,
        styles[variant],
        size === "sm" ? styles.sizeSm : size === "lg" ? styles.sizeLg : styles.sizeMd,
        isDisabled && styles.disabled,
        containerStyle,
        style,
      ]}
      disabled={isDisabled}
      activeOpacity={0.82}
      {...props}
    >
      {loading && (
        <ActivityIndicator
          size="small"
          color={variant === "primary" || variant === "danger" ? "#FFFFFF" : K.colors.accent}
          style={styles.spinner}
        />
      )}
      <Text
        style={[
          styles.text,
          variant === "secondary" ? styles.textSecondary
            : variant === "ghost" ? styles.textGhost
            : variant === "danger" ? styles.textDanger
            : styles.textPrimary,
          size === "sm" ? styles.textSm : size === "lg" ? styles.textLg : styles.textMd,
          textStyle,
        ]}
      >
        {title}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: K.radius.md,
  },

  // Variants
  primary: { backgroundColor: K.colors.accent },
  secondary: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: K.colors.accent,
  },
  ghost: { backgroundColor: "transparent" },
  danger: { backgroundColor: K.colors.error },

  // Sizes
  sizeSm: { paddingHorizontal: K.spacing.lg, paddingVertical: K.spacing.sm, minHeight: 40 },
  sizeMd: { paddingHorizontal: K.spacing.xxl, paddingVertical: K.spacing.md + 2, minHeight: 52 },
  sizeLg: { paddingHorizontal: K.spacing.xxxl, paddingVertical: K.spacing.lg, minHeight: 58 },

  // Text base
  text: { fontWeight: "700", letterSpacing: 0.2 },
  textPrimary: { color: "#FFFFFF" },
  textSecondary: { color: K.colors.accent },
  textGhost: { color: K.colors.accent },
  textDanger: { color: "#FFFFFF" },

  // Text sizes
  textSm: { fontSize: K.font.sm },
  textMd: { fontSize: K.font.base },
  textLg: { fontSize: K.font.lg },

  disabled: { opacity: 0.55 },
  spinner: { marginRight: K.spacing.sm },
});
