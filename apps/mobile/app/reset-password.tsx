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
  ImageBackground,
  Dimensions,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../lib/api";
import { useAuthStore } from "../store/auth";
import { handleRoleAndStatusRedirect } from "./(auth)/login";
import type { ApiResponse, AuthResponse } from "@zika/types";
import { useKeyboard } from "../hooks/useKeyboard";

const { height: SCREEN_H } = Dimensions.get("window");
const HERO_H = 280;

const GREEN = "#024622";
const ACCENT = "#1D8D2B";
const TEXT = "#111827";
const MUTED = "#6B7280";
const BORDER = "#E5E7EB";
const INPUT_BG = "#F3F4F6";
const ERR = "#EF4444";

function openDeepLink(token: string) {
  if (typeof window !== "undefined") {
    (window as any).location.href = `kainook://reset-password?token=${encodeURIComponent(token)}`;
  }
}

export default function ResetPasswordScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const isKeyboardOpen = useKeyboard();

  // On web: the email link opens localhost:3000/reset-password?token=...
  // Redirect to the native app deep link so the native screen handles the form
  useEffect(() => {
    if (Platform.OS === "web" && token) {
      openDeepLink(token);
    }
  }, [token]);

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
                <Text style={styles.btnTxt}>Open in App</Text>
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
            <Text style={styles.btnTxt}>Back to Sign In</Text>
          </TouchableOpacity>
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
          source={require("../assets/splash.png")}
          style={[styles.hero, { height: HERO_H }]}
          resizeMode="cover"
        >
          <View style={styles.heroOverlay} />
        </ImageBackground>

        <View style={{ paddingHorizontal: 24 }}>
          <Text style={styles.cardTitle}>Set New Password</Text>
          <Text style={styles.subheadline}>
            Choose a strong password for your account.
          </Text>

          {/* New password */}
          <View style={styles.field}>
            <Text style={styles.label}>New Password</Text>
            <View style={[styles.inputRow, errors.password ? styles.inputError : null]}>
              <Ionicons
                name="lock-closed-outline"
                size={18}
                color={MUTED}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                value={form.password}
                onChangeText={(v) => {
                  setForm((p) => ({ ...p, password: v }));
                  setErrors({});
                }}
                placeholder="Min. 8 characters"
                placeholderTextColor="#9CA3AF"
                secureTextEntry={!showPass}
                autoCapitalize="none"
              />
              <TouchableOpacity
                onPress={() => setShowPass((p) => !p)}
                style={styles.eye}
              >
                <Ionicons
                  name={showPass ? "eye-off-outline" : "eye-outline"}
                  size={18}
                  color={MUTED}
                />
              </TouchableOpacity>
            </View>
            {errors.password ? (
              <Text style={styles.fieldError}>{errors.password}</Text>
            ) : null}
          </View>

          {/* Confirm password */}
          <View style={styles.field}>
            <Text style={styles.label}>Confirm Password</Text>
            <View style={[styles.inputRow, errors.confirmPassword ? styles.inputError : null]}>
              <Ionicons
                name="lock-closed-outline"
                size={18}
                color={MUTED}
                style={styles.inputIcon}
              />
              <TextInput
                style={styles.input}
                value={form.confirmPassword}
                onChangeText={(v) => {
                  setForm((p) => ({ ...p, confirmPassword: v }));
                  setErrors({});
                }}
                placeholder="Repeat password"
                placeholderTextColor="#9CA3AF"
                secureTextEntry={!showConfirm}
                autoCapitalize="none"
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
              />
              <TouchableOpacity
                onPress={() => setShowConfirm((p) => !p)}
                style={styles.eye}
              >
                <Ionicons
                  name={showConfirm ? "eye-off-outline" : "eye-outline"}
                  size={18}
                  color={MUTED}
                />
              </TouchableOpacity>
            </View>
            {errors.confirmPassword ? (
              <Text style={styles.fieldError}>{errors.confirmPassword}</Text>
            ) : null}
          </View>

          {/* General Error */}
          {errors.general ? (
            <View style={styles.errBox}>
              <Ionicons name="alert-circle-outline" size={15} color={ERR} />
              <Text style={styles.errTxt}>{errors.general}</Text>
            </View>
          ) : null}

          {/* Submit */}
          <TouchableOpacity
            style={[styles.btn, mutation.isPending && styles.btnDim]}
            onPress={handleSubmit}
            disabled={mutation.isPending}
            activeOpacity={0.85}
          >
            {mutation.isPending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.btnTxt}>Set New Password</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: GREEN },
  container: { flex: 1, backgroundColor: GREEN },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
    paddingTop: 120,
  },
  emoji: { fontSize: 56, marginBottom: 20 },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#fff",
    textAlign: "center",
    marginBottom: 12,
  },
  sub: {
    fontSize: 15,
    color: "rgba(255,255,255,0.72)",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 32,
  },
  btn: {
    backgroundColor: GREEN,
    borderRadius: 14,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "700" },

  hero: {
    width: "100%",
    height: 280,
    justifyContent: "flex-end",
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    marginBottom: 16,
    overflow: "hidden",
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
  },

  scroll: {
    paddingTop: 28,
    paddingBottom: 36,
    backgroundColor: "#fff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: TEXT,
    marginBottom: 12,
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
  eye: { paddingVertical: 13, paddingLeft: 8 },
  inputError: { borderColor: ERR },
  fieldError: { fontSize: 12, color: ERR, marginTop: 4 },

  btnDim: { opacity: 0.6 },
  btnTxt: { color: "#fff", fontSize: 16, fontWeight: "700" },

  errBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#FEF2F2",
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#FECACA",
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  errTxt: { flex: 1, color: "#DC2626", fontSize: 13, lineHeight: 18 },
});
