import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  type TextInputProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { K } from "../../constants/theme";

interface FormFieldProps extends TextInputProps {
  label: string;
  error?: string;
  hint?: string;
  containerStyle?: StyleProp<ViewStyle>;
}

export function FormField({
  label,
  error,
  hint,
  secureTextEntry,
  containerStyle,
  ...props
}: FormFieldProps) {
  const [isSecure, setIsSecure] = useState(secureTextEntry);
  const showToggle = secureTextEntry !== undefined;

  return (
    <View style={[styles.container, containerStyle]}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputWrapper}>
        <TextInput
          style={[
            styles.input,
            error ? styles.inputError : styles.inputDefault,
            showToggle && styles.inputWithToggle,
          ]}
          placeholderTextColor={K.colors.textSubtle}
          autoCapitalize="none"
          {...props}
          secureTextEntry={isSecure}
        />
        {showToggle && (
          <TouchableOpacity
            style={styles.toggle}
            onPress={() => setIsSecure(!isSecure)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={isSecure ? "eye-off-outline" : "eye-outline"}
              size={20}
              color={K.colors.textMuted}
            />
          </TouchableOpacity>
        )}
      </View>
      {hint && !error ? <Text style={styles.hint}>{hint}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: K.spacing.lg },
  label: {
    fontSize: K.font.sm,
    fontWeight: "600",
    color: K.colors.textBody,
    marginBottom: 6,
  },
  inputWrapper: { position: "relative", justifyContent: "center" },
  input: {
    borderWidth: 1,
    borderRadius: K.radius.md,
    paddingHorizontal: K.spacing.lg,
    paddingVertical: K.spacing.md,
    fontSize: K.font.base,
    color: K.colors.textDark,
    backgroundColor: K.colors.bgCard,
    height: 52,
  },
  inputDefault: { borderColor: K.colors.borderMid },
  inputError: { borderColor: K.colors.error },
  inputWithToggle: { paddingRight: 48 },
  toggle: { position: "absolute", right: 12, padding: 4 },
  hint: { fontSize: K.font.xs, color: K.colors.textMuted, marginTop: 4 },
  error: { fontSize: K.font.xs, color: K.colors.error, marginTop: 4 },
});
