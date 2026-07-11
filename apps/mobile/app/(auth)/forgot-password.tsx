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
  ImageBackground,
  Dimensions,
  ScrollView,
} from "react-native";
import { Link, router } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../lib/api";
import { useKeyboard } from "../../hooks/useKeyboard";

const { height: SCREEN_H } = Dimensions.get("window");
const HERO_H = Math.round(SCREEN_H * 0.43);

const GREEN = "#024622";
const ACCENT = "#1D8D2B";
const TEXT = "#111827";
const MUTED = "#6B7280";
const BORDER = "#E5E7EB";
const INPUT_BG = "#F3F4F6";
const ERR = "#EF4444";

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
            <TouchableOpacity style={styles.successBtn}>
              <Text style={styles.successBtnText}>Back to Sign In</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={
        Platform.OS === "ios"
          ? "padding"
          : isKeyboardOpen
            ? "height"
            : undefined
      }
    >
      {/* Back button (fixed / floating) */}
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={24} color="#fff" />
      </TouchableOpacity>

      <ScrollView
        style={{
          flex: 1,
          backgroundColor: "#fff",
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
        }}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero section ── */}
        <ImageBackground
          source={require("../../assets/splash.png")}
          style={[styles.hero, { height: HERO_H }]}
          resizeMode="contain"
        >
          <View style={styles.heroOverlay} />
        </ImageBackground>

        <View style={{ paddingHorizontal: 24, marginTop: -30 }}>
          <Text style={styles.cardTitle}>Reset Password</Text>
          <Text style={styles.subheadline}>
            Enter your email and we'll send you a reset link.
          </Text>

          {/* Email */}
          <View style={styles.field}>
            <Text style={styles.label}>Email Address</Text>
            <View style={styles.inputRow}>
              <Ionicons
                name="mail-outline"
                size={18}
                color={MUTED}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor="#9CA3AF"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                returnKeyType="done"
                onSubmitEditing={() => { if (email.includes("@")) mutation.mutate(); }}
              />
            </View>
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={[styles.btn, (!email.includes("@") || mutation.isPending) && styles.btnDim]}
            onPress={() => mutation.mutate()}
            disabled={!email.includes("@") || mutation.isPending}
            activeOpacity={0.85}
          >
            {mutation.isPending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.btnTxt}>Send Reset Link</Text>
            )}
          </TouchableOpacity>

          {/* Register link */}
          <View style={styles.linkRow}>
            <Text style={styles.linkTxt}>Remember it? </Text>
            <Link href="/(auth)/login" asChild>
              <TouchableOpacity>
                <Text style={styles.link}>Sign In</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: GREEN },
  container: { flex: 1, backgroundColor: GREEN },

  hero: {
    width: "100%",
    justifyContent: "flex-end",
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    marginBottom: 16,
    overflow: "hidden",
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  backBtn: {
    position: "absolute",
    top: 48,
    left: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.3)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },

  scroll: {
    paddingTop: 24,
    paddingBottom: 36,
    backgroundColor: "#fff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: TEXT,
    marginBottom: 14,
    letterSpacing: -0.3,
  },
  subheadline: {
    fontSize: 14,
    color: MUTED,
    marginBottom: 24,
    lineHeight: 20,
  },

  field: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: "600", color: TEXT, marginBottom: 8 },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: INPUT_BG,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: BORDER,
    paddingHorizontal: 14,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, paddingVertical: 13, fontSize: 15, color: TEXT },

  btn: {
    backgroundColor: GREEN,
    borderRadius: 14,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  btnDim: { opacity: 0.6 },
  btnTxt: { color: "#fff", fontSize: 16, fontWeight: "700" },

  linkRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 24,
  },
  linkTxt: { color: MUTED, fontSize: 14 },
  link: { color: ACCENT, fontSize: 14, fontWeight: "700" },

  // Success screen
  successBox: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40 },
  successEmoji: { fontSize: 56, marginBottom: 20 },
  successTitle: { fontSize: 24, fontWeight: "800", color: "#fff", textAlign: "center", marginBottom: 12 },
  successSub: { fontSize: 15, color: "rgba(255,255,255,0.72)", textAlign: "center", lineHeight: 24, marginBottom: 32 },
  successBtn: {
    backgroundColor: ACCENT,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  successBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
