import { useState, useEffect } from "react";
import {
  View,
  Text,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useAuthStore } from "../store/auth";
import { handleRoleAndStatusRedirect } from "./(auth)/login";
import { K } from "../constants/theme";
import type { ApiResponse, AuthResponse } from "@zika/types";

function openDeepLink(token: string) {
  if (typeof window !== "undefined") {
    (window as any).location.href = `kainook://reset-password?token=${encodeURIComponent(token)}`;
  }
}

export default function ResetPasswordScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>();

  // On web: the email link opens localhost:3000/reset-password?token=...
  // Redirect to the native app deep link so the native screen handles the form
  useEffect(() => {
    if (Platform.OS === "web" && token) {
      openDeepLink(token);
    }
  }, [token]);

  if (Platform.OS === "web") {
    return (
      <View style={styles.container}>
        <View style={styles.center}>
          {token ? (
            <>
              <ActivityIndicator size="large" color="#16a34a" style={{ marginBottom: 24 }} />
              <Text style={styles.title}>Opening Kainook…</Text>
              <Text style={styles.sub}>
                The app should open automatically.{"\n"}
                If it doesn't, tap the button below.
              </Text>
              <TouchableOpacity style={styles.btn} onPress={() => openDeepLink(token)}>
                <Text style={styles.btnText}>Open in App</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.emoji}>❌</Text>
              <Text style={styles.title}>Invalid link</Text>
              <Text style={styles.sub}>
                This password reset link is invalid. Please request a new one.
              </Text>
            </>
          )}
        </View>
      </View>
    );
  }
  const [form, setForm] = useState({ password: "", confirmPassword: "" });
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState<{
    password?: string;
    confirmPassword?: string;
    general?: string;
  }>({});
  const setAuth = useAuthStore((s) => s.setAuth);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!token) throw new Error("Missing token");
      const res = await api.post<ApiResponse<AuthResponse & { message: string }>>(
        "/auth/reset-password",
        { token, password: form.password, confirmPassword: form.confirmPassword },
      );
      if (!res.data.success) throw res.data;
      return res.data.data;
    },
    onSuccess: async (data) => {
      await setAuth(data.user, data.tokens.accessToken);
      Alert.alert("Success", "Your password has been updated. You're now signed in.", [
        { text: "OK", onPress: () => handleRoleAndStatusRedirect(data.user) },
      ]);
    },
    onError: (err: unknown) => {
      const data = (
        err as {
          error?: {
            code?: string;
            message?: string;
            fields?: Record<string, string>;
          };
        }
      ).error;
      if (data?.code === "TOKEN_EXPIRED") {
        setErrors({
          general:
            "This password reset link has expired. Please request a new one.",
        });
      } else if (data?.code === "TOKEN_USED") {
        setErrors({
          general:
            "This reset link has already been used. Please request a new one.",
        });
      } else if (data?.fields) {
        setErrors(data.fields as typeof errors);
      } else {
        setErrors({
          general: data?.message ?? "Something went wrong. Please try again.",
        });
      }
    },
  });

  function handleSubmit() {
    if (form.password.length < 8) {
      setErrors({ password: "Password must be at least 8 characters." });
      return;
    }
    if (form.password !== form.confirmPassword) {
      setErrors({ confirmPassword: "Passwords do not match." });
      return;
    }
    setErrors({});
    mutation.mutate();
  }

  if (!token) {
    return (
      <View style={styles.container}>
        <View style={styles.center}>
          <Text style={styles.emoji}>❌</Text>
          <Text style={styles.title}>Invalid link</Text>
          <Text style={styles.sub}>
            This password reset link is invalid. Please request a new one from
            the Sign In screen.
          </Text>
          <TouchableOpacity
            style={styles.btn}
            onPress={() => router.replace("/(auth)/login")}
          >
            <Text style={styles.btnText}>Back to Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Brand mark */}
        <View style={styles.logoContainer}>
          <Image
            source={require("../assets/logo.png")}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </View>

        <Text style={styles.headline}>Set New{"\n"}Password</Text>
        <Text style={styles.subheadline}>
          Choose a strong password for your account.
        </Text>

        <View style={styles.card}>
          {/* New password */}
          <Text style={styles.label}>New Password</Text>
          <View style={styles.passRow}>
            <TextInput
              style={[
                styles.input,
                styles.inputFlex,
                errors.password ? styles.inputError : null,
              ]}
              value={form.password}
              onChangeText={(v) => {
                setForm((p) => ({ ...p, password: v }));
                setErrors({});
              }}
              placeholder="Min. 8 characters"
              placeholderTextColor={K.colors.textLightDim}
              secureTextEntry={!showPass}
              autoCapitalize="none"
            />
            <TouchableOpacity
              style={styles.eyeBtn}
              onPress={() => setShowPass((v) => !v)}
            >
              <Text style={styles.eyeIcon}>{showPass ? "🙈" : "👁️"}</Text>
            </TouchableOpacity>
          </View>
          {errors.password ? (
            <Text style={styles.fieldError}>{errors.password}</Text>
          ) : null}

          {/* Confirm password */}
          <Text style={[styles.label, { marginTop: 16 }]}>Confirm Password</Text>
          <View style={styles.passRow}>
            <TextInput
              style={[
                styles.input,
                styles.inputFlex,
                errors.confirmPassword ? styles.inputError : null,
              ]}
              value={form.confirmPassword}
              onChangeText={(v) => {
                setForm((p) => ({ ...p, confirmPassword: v }));
                setErrors({});
              }}
              placeholder="Repeat password"
              placeholderTextColor={K.colors.textLightDim}
              secureTextEntry={!showConfirm}
              autoCapitalize="none"
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
            />
            <TouchableOpacity
              style={styles.eyeBtn}
              onPress={() => setShowConfirm((v) => !v)}
            >
              <Text style={styles.eyeIcon}>{showConfirm ? "🙈" : "👁️"}</Text>
            </TouchableOpacity>
          </View>
          {errors.confirmPassword ? (
            <Text style={styles.fieldError}>{errors.confirmPassword}</Text>
          ) : null}

          {errors.general ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errors.general}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[
              styles.primaryBtn,
              mutation.isPending && styles.btnDisabled,
              { marginTop: 24 },
            ]}
            onPress={handleSubmit}
            disabled={mutation.isPending}
            activeOpacity={0.85}
          >
            {mutation.isPending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.primaryBtnText}>Set New Password</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: K.colors.darkGreen },
  scroll: { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 40 },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    paddingTop: 120,
  },
  emoji: { fontSize: 56, marginBottom: 20 },
  title: {
    fontSize: K.font.xxl,
    fontWeight: "800",
    color: "#fff",
    textAlign: "center",
    marginBottom: 12,
  },
  sub: {
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
    paddingHorizontal: 32,
  },
  btnText: { color: "#fff", fontSize: K.font.base, fontWeight: "700" },

  logoContainer: {
    width: 110,
    height: 110,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  logoImage: { width: 100, height: 100 },

  headline: {
    fontSize: K.font.xxxl,
    fontWeight: "800",
    color: "#fff",
    lineHeight: 38,
    letterSpacing: -0.5,
  },
  subheadline: {
    fontSize: K.font.base,
    color: K.colors.textLightMuted,
    marginTop: 10,
    marginBottom: 28,
    lineHeight: 22,
  },

  card: {
    backgroundColor: K.colors.glassBg,
    borderRadius: K.radius.xxl,
    borderWidth: 1,
    borderColor: K.colors.glassBorder,
    padding: 24,
  },
  label: {
    fontSize: K.font.sm,
    fontWeight: "600",
    color: K.colors.textLightMuted,
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  passRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  input: {
    backgroundColor: K.colors.glassInput,
    borderWidth: 1,
    borderColor: K.colors.glassInputBorder,
    borderRadius: K.radius.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: K.font.base,
    color: K.colors.textLight,
  },
  inputFlex: { flex: 1 },
  inputError: { borderColor: K.colors.error },
  eyeBtn: {
    backgroundColor: K.colors.glassInput,
    borderWidth: 1,
    borderColor: K.colors.glassInputBorder,
    borderRadius: K.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  eyeIcon: { fontSize: 16 },
  fieldError: { fontSize: 12, color: "#FCA5A5", marginTop: 4 },

  errorBox: {
    backgroundColor: "rgba(239,68,68,0.15)",
    borderRadius: K.radius.md,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.30)",
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 16,
  },
  errorText: { color: "#FCA5A5", fontSize: K.font.sm, lineHeight: 20 },

  primaryBtn: {
    backgroundColor: K.colors.accent,
    borderRadius: K.radius.md,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
  },
  btnDisabled: { opacity: 0.45 },
  primaryBtnText: {
    color: "#fff",
    fontSize: K.font.lg,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
});
