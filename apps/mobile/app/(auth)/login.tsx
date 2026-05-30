import { useState } from "react";
import {
  View,
  Text,
  Image,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from "react-native";
import { Link, router } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/auth";
import { K } from "../../constants/theme";
import type { ApiResponse, AuthResponse, PublicUser } from "@zika/types";

interface FieldErrors {
  email?: string;
  password?: string;
  general?: string;
}

export function handleRoleAndStatusRedirect(user: PublicUser) {
  if (user.userType === "guest") {
    router.replace("/(tabs)");
  } else if (user.userType === "provider") {
    if (user.status === "pending_verification") {
      router.replace("/pending-approval");
    } else if (user.status === "suspended" || user.status === "banned") {
      router.replace("/suspended");
    } else {
      router.replace("/(provider)" as any);
    }
  }
}

export default function LoginScreen() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [showPassword, setShowPassword] = useState(false);
  const setAuth = useAuthStore((s) => s.setAuth);

  const set = (key: keyof typeof form) => (val: string) => {
    setForm((prev) => ({ ...prev, [key]: val }));
    setErrors({});
  };

  const loginMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post<ApiResponse<AuthResponse>>("/auth/login", form);
      if (!res.data.success) throw res.data;
      return res.data.data;
    },
    onSuccess: async (data) => {
      await setAuth(data.user, data.tokens.accessToken);
      handleRoleAndStatusRedirect(data.user);
    },
    onError: (err: unknown) => {
      const axiosErr = err as {
        response?: { data?: ApiResponse<unknown> };
        config?: { url?: string; baseURL?: string };
        message?: string;
        code?: string;
      };
      const data = axiosErr.response?.data;
      if (data && !data.success) {
        if (data.error.code === "EMAIL_NOT_VERIFIED") {
          router.push({ pathname: "/(auth)/verify-pending", params: { email: form.email } });
          return;
        }
        setErrors({ general: data.error.message });
      } else {
        const details = __DEV__
          ? `\n\n[Debug] URL: ${axiosErr.config?.baseURL}${axiosErr.config?.url}\nError: ${axiosErr.message}`
          : "";
        setErrors({ general: `Unable to connect. Please check your network.${details}` });
      }
    },
  });

  function handleSubmit() {
    if (!form.email || !form.password) {
      setErrors({ general: "Please enter your email and password." });
      return;
    }
    setErrors({});
    loginMutation.mutate();
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Brand */}
        <View style={styles.brandRow}>
          <View style={styles.logoContainer}>
            <Image
              source={require("../../assets/logo.png")}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
        </View>

        {/* Headline */}
        <Text style={styles.headline}>Welcome{"\n"}Back</Text>
        <Text style={styles.subheadline}>Sign in to manage your listings</Text>

        {/* Glass card */}
        <View style={styles.card}>
          {/* Email */}
          <View style={styles.fieldWrapper}>
            <Text style={styles.fieldLabel}>Email Address</Text>
            <TextInput
              style={[styles.input, errors.email ? styles.inputError : null]}
              value={form.email}
              onChangeText={set("email")}
              placeholder="you@example.com"
              placeholderTextColor={K.colors.textLightDim}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              returnKeyType="next"
            />
          </View>

          {/* Password */}
          <View style={styles.fieldWrapper}>
            <Text style={styles.fieldLabel}>Password</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={[styles.input, styles.inputFlex, errors.password ? styles.inputError : null]}
                value={form.password}
                onChangeText={set("password")}
                placeholder="Your password"
                placeholderTextColor={K.colors.textLightDim}
                secureTextEntry={!showPassword}
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
              />
              <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPassword((v) => !v)}>
                <Text style={styles.eyeIcon}>{showPassword ? "🙈" : "👁️"}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Forgot */}
          <Link href="/(auth)/forgot-password" asChild>
            <TouchableOpacity style={styles.forgotRow}>
              <Text style={styles.forgotText}>Forgot password?</Text>
            </TouchableOpacity>
          </Link>

          {/* Error */}
          {errors.general ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errors.general}</Text>
            </View>
          ) : null}

          {/* Sign In */}
          <TouchableOpacity
            style={[styles.primaryBtn, loginMutation.isPending && styles.btnDisabled]}
            onPress={handleSubmit}
            disabled={loginMutation.isPending}
            activeOpacity={0.85}
          >
            {loginMutation.isPending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.primaryBtnText}>Sign In</Text>
            )}
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Google */}
          <GoogleSignInButton />

          {Platform.OS === "ios" && <AppleSignInButton />}
        </View>

        {/* Register link */}
        <View style={styles.registerRow}>
          <Text style={styles.registerText}>New to Kainook? </Text>
          <Link href="/(auth)/register" asChild>
            <TouchableOpacity>
              <Text style={styles.registerLink}>Create Account</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

let _GoogleSignin: typeof import("@react-native-google-signin/google-signin")["GoogleSignin"] | null = null;
try { _GoogleSignin = require("@react-native-google-signin/google-signin").GoogleSignin; } catch { /* not in Expo Go */ }

function GoogleSignInButton() {
  const setAuth = useAuthStore((s) => s.setAuth);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!_GoogleSignin) {
        const res = await api.post<ApiResponse<AuthResponse>>("/auth/login", {
          email: "test@kainook.com",
          password: "KainookTest123!",
        });
        if (!res.data.success) throw res.data;
        return res.data.data;
      }
      await _GoogleSignin.hasPlayServices();
      const result = await _GoogleSignin.signIn();
      const idToken = (result as any).data?.idToken ?? (result as any).idToken;
      if (!idToken) throw new Error("No ID token");
      const res = await api.post("/auth/oauth/google", { idToken });
      return (res.data as { data: AuthResponse }).data;
    },
    onSuccess: async (data) => {
      await setAuth(data.user, data.tokens.accessToken);
      handleRoleAndStatusRedirect(data.user);
    },
    onError: () => Alert.alert("Error", "Google sign-in failed. Please try again."),
  });

  return (
    <TouchableOpacity
      style={styles.socialBtn}
      onPress={() => mutation.mutate()}
      disabled={mutation.isPending}
      activeOpacity={0.85}
    >
      {mutation.isPending ? (
        <ActivityIndicator color={K.colors.textLight} size="small" />
      ) : (
        <>
          <Text style={styles.socialIcon}>G</Text>
          <Text style={styles.socialBtnText}>Continue with Google</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

function AppleSignInButton() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const AppleAuth = require("expo-apple-authentication") as typeof import("expo-apple-authentication");

  const mutation = useMutation({
    mutationFn: async () => {
      const cred = await AppleAuth.signInAsync({
        requestedScopes: [AppleAuth.AppleAuthenticationScope.FULL_NAME, AppleAuth.AppleAuthenticationScope.EMAIL],
      });
      const res = await api.post("/auth/oauth/apple", {
        authorizationCode: cred.authorizationCode,
        identityToken: cred.identityToken,
      });
      return (res.data as { data: AuthResponse }).data;
    },
    onSuccess: async (data) => {
      await setAuth(data.user, data.tokens.accessToken);
      handleRoleAndStatusRedirect(data.user);
    },
    onError: () => Alert.alert("Error", "Apple sign-in failed. Please try again."),
  });

  return (
    <TouchableOpacity
      style={[styles.socialBtn, { marginTop: 10 }]}
      onPress={() => mutation.mutate()}
      disabled={mutation.isPending}
      activeOpacity={0.85}
    >
      {mutation.isPending ? (
        <ActivityIndicator color={K.colors.textLight} size="small" />
      ) : (
        <>
          <Text style={styles.socialIcon}></Text>
          <Text style={styles.socialBtnText}>Continue with Apple</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: K.colors.darkGreen },
  scroll: { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 40 },

  brandRow: { alignItems: "flex-start", marginBottom: 36 },
  logoContainer: {
    width: 130,
    height: 130,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  logoImage: { width: 118, height: 118 },
  logoMark: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: K.colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  logoMarkText: { fontSize: 24, fontWeight: "900", color: "#fff" },
  wordmark: { fontSize: 18, fontWeight: "900", color: "#fff", letterSpacing: 3 },
  tagline: { fontSize: 11, color: K.colors.textLightMuted, letterSpacing: 1.5 },

  headline: { fontSize: K.font.display, fontWeight: "800", color: "#fff", lineHeight: 42, letterSpacing: -0.5 },
  subheadline: { fontSize: K.font.base, color: K.colors.textLightMuted, marginTop: 8, marginBottom: 28 },

  card: {
    backgroundColor: K.colors.glassBg,
    borderRadius: K.radius.xxl,
    borderWidth: 1,
    borderColor: K.colors.glassBorder,
    padding: 24,
  },

  fieldWrapper: { marginBottom: 16 },
  fieldLabel: { fontSize: K.font.sm, fontWeight: "600", color: K.colors.textLightMuted, marginBottom: 8, letterSpacing: 0.3 },
  input: {
    backgroundColor: K.colors.glassInput,
    borderWidth: 1,
    borderColor: K.colors.glassInputBorder,
    borderRadius: K.radius.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: K.font.base,
    color: K.colors.textLight,
    flex: 1,
  },
  inputFlex: { flex: 1 },
  inputError: { borderColor: K.colors.error },
  passwordRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  eyeBtn: {
    backgroundColor: K.colors.glassInput,
    borderWidth: 1,
    borderColor: K.colors.glassInputBorder,
    borderRadius: K.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  eyeIcon: { fontSize: 16 },

  forgotRow: { alignItems: "flex-end", marginBottom: 20, marginTop: -4 },
  forgotText: { fontSize: K.font.sm, color: K.colors.accentLight, fontWeight: "600" },

  errorBox: {
    backgroundColor: "rgba(239,68,68,0.15)",
    borderRadius: K.radius.md,
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.30)",
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  errorText: { color: "#FCA5A5", fontSize: K.font.sm, lineHeight: 20 },

  primaryBtn: {
    backgroundColor: K.colors.accent,
    borderRadius: K.radius.md,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    height: 54,
  },
  btnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: "#fff", fontSize: K.font.lg, fontWeight: "700", letterSpacing: 0.3 },

  divider: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 20 },
  dividerLine: { flex: 1, height: 1, backgroundColor: K.colors.glassBorder },
  dividerText: { color: K.colors.textLightDim, fontSize: K.font.sm },

  socialBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: K.colors.glassInput,
    borderWidth: 1,
    borderColor: K.colors.glassInputBorder,
    borderRadius: K.radius.md,
    paddingVertical: 14,
    height: 52,
  },
  socialIcon: { fontSize: 18, fontWeight: "700", color: "#fff" },
  socialBtnText: { color: K.colors.textLight, fontSize: K.font.base, fontWeight: "600" },

  registerRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: 24 },
  registerText: { color: K.colors.textLightMuted, fontSize: K.font.sm },
  registerLink: { color: K.colors.accentLight, fontSize: K.font.sm, fontWeight: "700" },
});
