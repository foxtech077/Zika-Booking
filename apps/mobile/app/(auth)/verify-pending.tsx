import { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Image,
  TextInput,
  ScrollView,
} from "react-native";
import { useLocalSearchParams, Link, router } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { K } from "../../constants/theme";

// Extract the token from a full URL (e.g. http://localhost:3000/verify?token=abc)
// or return the input as-is if it looks like a raw token
function extractToken(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    const t = url.searchParams.get("token");
    if (t) return t;
  } catch {
    // not a URL — treat as raw token if long enough
  }
  if (trimmed.length >= 32) return trimmed;
  return null;
}

export default function VerifyPendingScreen() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const [cooldown, setCooldown] = useState(0);
  const [showPaste, setShowPaste] = useState(false);
  const [pastedLink, setPastedLink] = useState("");
  const [pasteError, setPasteError] = useState("");

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const resendMutation = useMutation({
    mutationFn: async () => {
      await api.post("/auth/resend-verification", { email });
    },
    onSuccess: () => {
      setCooldown(60);
      Alert.alert("Sent!", "A new verification email has been sent. Please check your inbox.");
    },
    onError: (err: unknown) => {
      const code = (err as any)?.response?.data?.error?.code ?? "";
      if (code === "COOLDOWN") {
        setCooldown(60);
      } else if (code === "RATE_LIMITED") {
        Alert.alert(
          "Limit reached",
          "You've requested the maximum number of verification emails. Please try again later or contact support.",
        );
      } else {
        Alert.alert("Error", "Something went wrong. Please try again.");
      }
    },
  });

  // Direct verification via pasted link — calls the hosted API
  const verifyMutation = useMutation({
    mutationFn: async (token: string) => {
      await api.get("/auth/verify", { params: { token } });
    },
    onSuccess: () => {
      Alert.alert(
        "Email verified!",
        "Your account is now active.",
        [{ text: "Sign In", onPress: () => router.replace("/(auth)/login") }],
      );
    },
    onError: (err: unknown) => {
      const code = (err as any)?.response?.data?.error?.code ?? "";
      if (code === "TOKEN_EXPIRED") {
        setPasteError("This link has expired. Please request a new verification email.");
      } else if (code === "TOKEN_USED" || code === "ALREADY_VERIFIED") {
        Alert.alert("Already verified!", "Your email is already verified. You can sign in.", [
          { text: "Sign In", onPress: () => router.replace("/(auth)/login") },
        ]);
      } else if (code === "INVALID_TOKEN") {
        setPasteError("Invalid link. Make sure you copied the full URL from the email.");
      } else {
        setPasteError("Something went wrong. Please try again.");
      }
    },
  });

  function handlePasteVerify() {
    setPasteError("");
    const token = extractToken(pastedLink);
    if (!token) {
      setPasteError("Please paste the full verification link from your email.");
      return;
    }
    verifyMutation.mutate(token);
  }

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* Brand mark */}
      <View style={styles.logoContainer}>
        <Image
          source={require("../../assets/logo.png")}
          style={styles.logoImage}
          resizeMode="contain"
        />
      </View>

      <Text style={styles.emoji}>✉️</Text>
      <Text style={styles.title}>Verify your email</Text>
      <Text style={styles.sub}>We sent a verification link to</Text>
      <Text style={styles.email}>{email}</Text>
      <Text style={styles.hint}>
        Open the email and tap the verification link.{"\n"}
        Check your spam folder if you don't see it.
      </Text>

      <TouchableOpacity
        style={[
          styles.resendBtn,
          (cooldown > 0 || resendMutation.isPending) && styles.resendBtnDisabled,
        ]}
        onPress={() => resendMutation.mutate()}
        disabled={cooldown > 0 || resendMutation.isPending}
        activeOpacity={0.85}
      >
        {resendMutation.isPending ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={styles.resendBtnText}>
            {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend verification email"}
          </Text>
        )}
      </TouchableOpacity>

      {/* ── Manual paste section ── */}
      <TouchableOpacity
        style={styles.pasteToggle}
        onPress={() => { setShowPaste((v) => !v); setPasteError(""); }}
        activeOpacity={0.7}
      >
        <Text style={styles.pasteToggleText}>
          {showPaste ? "▲ Hide" : "▼ Link not opening? Paste it here"}
        </Text>
      </TouchableOpacity>

      {showPaste && (
        <View style={styles.pasteCard}>
          <Text style={styles.pasteLabel}>
            In your email, long-press the "Verify Email" button → Copy Link → paste it below:
          </Text>
          <TextInput
            style={[styles.pasteInput, pasteError ? styles.pasteInputError : null]}
            value={pastedLink}
            onChangeText={(v) => { setPastedLink(v); setPasteError(""); }}
            placeholder="http://localhost:3000/verify?token=..."
            placeholderTextColor={K.colors.textLightDim}
            autoCapitalize="none"
            autoCorrect={false}
            multiline
            numberOfLines={3}
          />
          {pasteError ? (
            <Text style={styles.pasteErrorText}>{pasteError}</Text>
          ) : null}
          <TouchableOpacity
            style={[
              styles.pasteBtn,
              (!pastedLink.trim() || verifyMutation.isPending) && styles.pasteBtnDisabled,
            ]}
            onPress={handlePasteVerify}
            disabled={!pastedLink.trim() || verifyMutation.isPending}
            activeOpacity={0.85}
          >
            {verifyMutation.isPending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.pasteBtnText}>Verify Now</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      <Link href="/(auth)/login" asChild>
        <TouchableOpacity style={styles.backLink}>
          <Text style={styles.backLinkText}>Back to Sign In</Text>
        </TouchableOpacity>
      </Link>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: K.colors.darkGreen,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    paddingVertical: 48,
  },
  logoContainer: {
    width: 90,
    height: 90,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginBottom: 28,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  logoImage: { width: 80, height: 80 },
  emoji: { fontSize: 48, marginBottom: 16 },
  title: {
    fontSize: K.font.xxl,
    fontWeight: "800",
    color: "#fff",
    textAlign: "center",
    marginBottom: 10,
  },
  sub: {
    fontSize: K.font.base,
    color: K.colors.textLightMuted,
    textAlign: "center",
  },
  email: {
    fontSize: K.font.base,
    fontWeight: "700",
    color: "#fff",
    textAlign: "center",
    marginTop: 4,
    marginBottom: 16,
  },
  hint: {
    fontSize: K.font.sm,
    color: K.colors.textLightMuted,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 32,
  },
  resendBtn: {
    backgroundColor: K.colors.accent,
    borderRadius: K.radius.md,
    height: 54,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  resendBtnDisabled: { opacity: 0.45 },
  resendBtnText: { color: "#fff", fontSize: K.font.base, fontWeight: "700" },

  pasteToggle: {
    paddingVertical: 10,
    marginBottom: 4,
  },
  pasteToggleText: {
    color: K.colors.accentLight,
    fontSize: K.font.sm,
    fontWeight: "600",
    textAlign: "center",
  },

  pasteCard: {
    width: "100%",
    backgroundColor: K.colors.glassBg,
    borderRadius: K.radius.lg,
    borderWidth: 1,
    borderColor: K.colors.glassBorder,
    padding: 16,
    marginBottom: 8,
  },
  pasteLabel: {
    fontSize: K.font.sm,
    color: K.colors.textLightMuted,
    lineHeight: 20,
    marginBottom: 12,
  },
  pasteInput: {
    backgroundColor: K.colors.glassInput,
    borderWidth: 1,
    borderColor: K.colors.glassInputBorder,
    borderRadius: K.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    color: K.colors.textLight,
    minHeight: 72,
    textAlignVertical: "top",
    marginBottom: 8,
  },
  pasteInputError: { borderColor: K.colors.error },
  pasteErrorText: {
    fontSize: K.font.sm,
    color: "#FCA5A5",
    marginBottom: 10,
    lineHeight: 18,
  },
  pasteBtn: {
    backgroundColor: K.colors.accent,
    borderRadius: K.radius.md,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  pasteBtnDisabled: { opacity: 0.45 },
  pasteBtnText: { color: "#fff", fontSize: K.font.base, fontWeight: "700" },

  backLink: { paddingVertical: 12, marginTop: 8 },
  backLinkText: {
    color: K.colors.accentLight,
    fontSize: K.font.base,
    fontWeight: "600",
    textAlign: "center",
  },
});
