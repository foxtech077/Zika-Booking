import { useState } from "react";
import {
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { Link, router } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { useKeyboard } from "../../hooks/useKeyboard";
import { K } from "../../constants/theme";

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const isKeyboardOpen = useKeyboard();

  const mutation = useMutation({
    mutationFn: () => api.post("auth/forgot-password", { email }),
    onSuccess: () => setSent(true),
    onError: () => setSent(true), // always show success (enumeration prevention)
  });

  if (sent) {
    return (
      <View style={styles.container}>
        <View style={styles.successBox}>
          <Text style={styles.successEmoji}>📧</Text>
          <Text style={styles.successTitle}>Check your email</Text>
          <Text style={styles.successSub}>
            If an account with that email exists, we've sent a password reset link.
          </Text>
          <Link href="/(auth)/login" asChild>
            <TouchableOpacity style={styles.backBtn}>
              <Text style={styles.backBtnText}>Back to Sign In</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={
        Platform.OS === "ios"
          ? "padding"
          : isKeyboardOpen
            ? "height"
            : undefined
      }
    >
      <View style={styles.inner}>
        {/* Back button */}
        <TouchableOpacity style={styles.backArrow} onPress={() => router.back()}>
          <Text style={styles.backArrowText}>‹ Back</Text>
        </TouchableOpacity>

        {/* Brand mark */}
        <View style={styles.logoContainer}>
          <Image
            source={require("../../assets/logo.png")}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </View>

        <Text style={styles.headline}>Reset{"\n"}Password</Text>
        <Text style={styles.subheadline}>
          Enter your email and we'll send you a reset link.
        </Text>

        <View style={styles.card}>
          <Text style={styles.label}>Email Address</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={K.colors.textLightDim}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            returnKeyType="done"
            onSubmitEditing={() => { if (email.includes("@")) mutation.mutate(); }}
          />

          <TouchableOpacity
            style={[styles.primaryBtn, (!email.includes("@") || mutation.isPending) && styles.btnDisabled]}
            onPress={() => mutation.mutate()}
            disabled={!email.includes("@") || mutation.isPending}
            activeOpacity={0.85}
          >
            {mutation.isPending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.primaryBtnText}>Send Reset Link</Text>
            )}
          </TouchableOpacity>
        </View>

        <Link href="/(auth)/login" asChild>
          <TouchableOpacity style={styles.signInLink}>
            <Text style={styles.signInLinkText}>
              Remember it? <Text style={styles.signInLinkBold}>Sign In</Text>
            </Text>
          </TouchableOpacity>
        </Link>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: K.colors.darkGreen },
  inner: { flex: 1, paddingHorizontal: 24, paddingTop: 56 },

  backArrow: { marginBottom: 32, alignSelf: "flex-start" },
  backArrowText: { color: K.colors.textLightMuted, fontSize: K.font.base, fontWeight: "600" },

  logoContainer: {
    width: 110, height: 110, borderRadius: 18,
    backgroundColor: "#FFFFFF",
    alignItems: "center", justifyContent: "center",
    overflow: "hidden", marginBottom: 24,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 12, elevation: 6,
  },
  logoImage: { width: 100, height: 100 },

  headline: { fontSize: K.font.xxxl, fontWeight: "800", color: "#fff", lineHeight: 38, letterSpacing: -0.5 },
  subheadline: { fontSize: K.font.base, color: K.colors.textLightMuted, marginTop: 10, marginBottom: 28, lineHeight: 22 },

  card: {
    backgroundColor: K.colors.glassBg,
    borderRadius: K.radius.xxl,
    borderWidth: 1,
    borderColor: K.colors.glassBorder,
    padding: 24,
  },
  label: { fontSize: K.font.sm, fontWeight: "600", color: K.colors.textLightMuted, marginBottom: 8, letterSpacing: 0.3 },
  input: {
    backgroundColor: K.colors.glassInput,
    borderWidth: 1,
    borderColor: K.colors.glassInputBorder,
    borderRadius: K.radius.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: K.font.base,
    color: K.colors.textLight,
    marginBottom: 20,
  },
  primaryBtn: {
    backgroundColor: K.colors.accent,
    borderRadius: K.radius.md,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
  },
  btnDisabled: { opacity: 0.45 },
  primaryBtnText: { color: "#fff", fontSize: K.font.lg, fontWeight: "700", letterSpacing: 0.3 },

  signInLink: { alignItems: "center", marginTop: 24 },
  signInLinkText: { color: K.colors.textLightMuted, fontSize: K.font.sm },
  signInLinkBold: { color: K.colors.accentLight, fontWeight: "700" },

  // Success
  successBox: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40 },
  successEmoji: { fontSize: 56, marginBottom: 20 },
  successTitle: { fontSize: K.font.xxl, fontWeight: "800", color: "#fff", textAlign: "center", marginBottom: 12 },
  successSub: { fontSize: K.font.base, color: K.colors.textLightMuted, textAlign: "center", lineHeight: 24, marginBottom: 32 },
  backBtn: {
    backgroundColor: K.colors.accent,
    borderRadius: K.radius.md,
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  backBtnText: { color: "#fff", fontSize: K.font.base, fontWeight: "700" },
});
