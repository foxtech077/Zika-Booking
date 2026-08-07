import { useEffect, useState } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  TouchableOpacity,
  StyleSheet,
  Image,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuthStore } from "../store/auth";
import { handleRoleAndStatusRedirect } from "./(auth)/login";
import { K } from "../constants/theme";
import type { ApiResponse, AuthResponse } from "@zika/types";

type VerifyState =
  | "verifying"
  | "success"
  | "already_verified"
  | "expired"
  | "used"
  | "invalid"
  | "error";

export default function VerifyScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [state, setState] = useState<VerifyState>(token ? "verifying" : "invalid");

  const mutation = useMutation({
    mutationFn: async (t: string) => {
      const res = await api.get<ApiResponse<AuthResponse & { message: string }>>(
        "auth/verify",
        { params: { token: t } },
      );
      if (!res.data.success) throw res.data;
      return res.data.data;
    },
    onSuccess: async (data) => {
      await setAuth(data.user, data.tokens.accessToken);
      const isAlready = (data.message ?? "").toLowerCase().includes("already");
      setState(isAlready ? "already_verified" : "success");
      setTimeout(() => handleRoleAndStatusRedirect(data.user), 1500);
    },
    onError: (err: unknown) => {
      const code =
        (err as any)?.error?.code ??
        (err as any)?.response?.data?.error?.code ??
        "";
      if (code === "TOKEN_EXPIRED") setState("expired");
      else if (code === "TOKEN_USED" || code === "ALREADY_VERIFIED") setState("used");
      else if (code === "INVALID_TOKEN") setState("invalid");
      else setState("error");
    },
  });

  useEffect(() => {
    if (!token) return;
    mutation.mutate(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  type StateContent = {
    emoji: string;
    title: string;
    body: string;
    action?: { label: string; onPress: () => void };
  };

  const content: Record<VerifyState, StateContent> = {
    verifying: {
      emoji: "",
      title: "Verifying your email…",
      body: "Please wait a moment.",
    },
    success: {
      emoji: "🎉",
      title: "Email verified!",
      body: "Welcome to Kainook! Taking you in…",
    },
    already_verified: {
      emoji: "✅",
      title: "Already verified",
      body: "Your email is already verified. Taking you in…",
    },
    expired: {
      emoji: "⌛",
      title: "Link expired",
      body: "This verification link has expired. Links are valid for 24 hours. Please sign in and request a new one.",
      action: {
        label: "Back to Sign In",
        onPress: () => router.replace("/(auth)/login"),
      },
    },
    used: {
      emoji: "🔒",
      title: "Link already used",
      body: "This verification link has already been used. If your email is verified, you can sign in now.",
      action: {
        label: "Sign In",
        onPress: () => router.replace("/(auth)/login"),
      },
    },
    invalid: {
      emoji: "❌",
      title: "Invalid link",
      body: "This verification link is invalid or incomplete. Please check your email and try again.",
      action: {
        label: "Back to Sign In",
        onPress: () => router.replace("/(auth)/login"),
      },
    },
    error: {
      emoji: "⚠️",
      title: "Something went wrong",
      body: "We couldn't verify your email. Please try tapping the link again, or request a new verification email.",
      action: {
        label: "Back to Sign In",
        onPress: () => router.replace("/(auth)/login"),
      },
    },
  };

  const c = content[state];

  return (
    <View style={styles.container}>
      <View style={styles.logoContainer}>
        <Image
          source={require("../assets/logo.png")}
          style={styles.logoImage}
          resizeMode="contain"
        />
      </View>

      {state === "verifying" ? (
        <ActivityIndicator
          color={K.colors.accent}
          size="large"
          style={styles.spinner}
        />
      ) : (
        <Text style={styles.emoji}>{c.emoji}</Text>
      )}

      <Text style={styles.title}>{c.title}</Text>
      <Text style={styles.body}>{c.body}</Text>

      {c.action && (
        <TouchableOpacity
          style={styles.btn}
          onPress={c.action.onPress}
          activeOpacity={0.85}
        >
          <Text style={styles.btnText}>{c.action.label}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: K.colors.darkGreen,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
  },
  logoContainer: {
    width: 90,
    height: 90,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginBottom: 32,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  logoImage: { width: 80, height: 80 },
  spinner: { marginBottom: 24 },
  emoji: { fontSize: 56, marginBottom: 16 },
  title: {
    fontSize: K.font.xxl,
    fontWeight: "800",
    color: "#fff",
    textAlign: "center",
    marginBottom: 12,
  },
  body: {
    fontSize: K.font.base,
    color: K.colors.textLightMuted,
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 32,
  },
  btn: {
    backgroundColor: K.colors.accent,
    borderRadius: K.radius.md,
    paddingVertical: 14,
    paddingHorizontal: 40,
  },
  btnText: { color: "#fff", fontSize: K.font.base, fontWeight: "700" },
});
