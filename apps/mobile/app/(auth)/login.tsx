import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  StyleSheet,
  Image,
  TextInput,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { Link, router } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/auth";
import { K } from "../../constants/theme";
import type { PublicUser, ApiResponse, AuthResponse } from "@zika/types";

interface FieldErrors {
  email?: string;
  password?: string;
  general?: string;
}

export function handleRoleAndStatusRedirect(user: PublicUser) {
  if (user.userType === "provider") {
    if (user.status === "pending_verification") {
      router.replace("/pending-approval");
    } else if (user.status === "suspended" || user.status === "banned") {
      router.replace("/suspended");
    } else {
      router.replace("/(provider)");
    }
  } else {
    router.replace("/(tabs)");
  }
}

export default function LoginScreen() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [showPass, setShowPass] = useState(false);
  const setAuth = useAuthStore((s) => s.setAuth);

  const set = (key: keyof typeof form) => (val: string) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  const setGeneralError = (msg: string | null) =>
    setErrors((prev) => ({ ...prev, general: msg ?? undefined }));

  const loginMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post<ApiResponse<AuthResponse>>("/auth/login", { email: form.email, password: form.password });
      if (!res.data.success) throw res.data;
      return res.data.data;
    },
    onSuccess: async (data) => {
      await setAuth(data.user, data.tokens.accessToken);
      handleRoleAndStatusRedirect(data.user);
    },
    onError: (err: unknown) => {
      const axiosErr = err as { message?: string; code?: string; config?: { url?: string; baseURL?: string }; response?: { data?: ApiResponse<unknown> } };
      const data = axiosErr.response?.data;
      const structuredError = data && !data.success && data.error && typeof data.error === "object";
      if (structuredError) {
        const apiErr = (data as { success: false; error: { code: string; message: string } }).error;
        if (apiErr.code === "EMAIL_NOT_VERIFIED") {
          router.push({ pathname: "/(auth)/verify-pending", params: { email: form.email } });
          return;
        }
        setGeneralError(apiErr.message);
      } else {
        const details = __DEV__
          ? `\n\n[Dev Details]\nURL: ${axiosErr.config?.baseURL ?? api.defaults.baseURL}${axiosErr.config?.url ?? ""}\nError: ${axiosErr.message ?? "Unknown Network Error"}\nCode: ${axiosErr.code ?? "Unknown Code"}`
          : "";
        setErrors({ general: `Unable to connect. Please check your network and try again.${details}` });
      }
    },
  });

  function handleSubmit() {
    if (!form.email.trim() || !form.password) {
      setGeneralError("Please enter your email and password.");
      return;
    }
    setGeneralError(null);
    loginMutation.mutate();
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
        {/* Brand Header */}
        <View style={styles.brandRow}>
          <View style={styles.logoContainer}>
            <Image
              source={require("../../assets/logo.png")}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>
        </View>

        <Text style={styles.headline}>Welcome{"\n"}Back</Text>
        <Text style={styles.subheadline}>Sign in to your premium account</Text>

        {/* Card containing login inputs */}
        <View style={styles.card}>
          {/* Email field */}
          <View style={styles.field}>
            <Text style={styles.label}>Email Address</Text>
            <TextInput
              style={[styles.input, errors.email ? styles.inputError : null]}
              value={form.email}
              onChangeText={(v) => { set("email")(v); setErrors({}); }}
              placeholder="you@example.com"
              placeholderTextColor={K.colors.textLightDim}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
            {errors.email ? <Text style={styles.fieldError}>{errors.email}</Text> : null}
          </View>

          {/* Password field */}
          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <View style={styles.passRow}>
              <TextInput
                style={[styles.input, styles.inputFlex, errors.password ? styles.inputError : null]}
                value={form.password}
                onChangeText={(v) => { set("password")(v); setErrors({}); }}
                placeholder="Your password"
                placeholderTextColor={K.colors.textLightDim}
                secureTextEntry={!showPass}
              />
              <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPass((v) => !v)}>
                <Text style={styles.eyeIcon}>{showPass ? "🙈" : "👁️"}</Text>
              </TouchableOpacity>
            </View>
            {errors.password ? <Text style={styles.fieldError}>{errors.password}</Text> : null}
          </View>

          {/* Forgot password link */}
          <Link href="/(auth)/forgot-password" asChild>
            <TouchableOpacity>
              <Text style={styles.forgotLink}>Forgot password?</Text>
            </TouchableOpacity>
          </Link>

          {errors.general ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errors.general}</Text>
            </View>
          ) : null}

          {/* Submit button */}
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
        </View>

        {/* Divider */}
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* OAuth third party buttons */}
        <GoogleSignInButton onError={(msg) => setErrors({ general: msg })} />
        {Platform.OS === "ios" && <View style={{ marginTop: 12 }}><AppleSignInButton /></View>}

        <View style={styles.registerRow}>
          <Text style={styles.registerText}>Don't have an account? </Text>
          <Link href="/(auth)/register" asChild>
            <TouchableOpacity>
              <Text style={styles.registerLink}>Create one</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

let _GoogleSignin: typeof import("@react-native-google-signin/google-signin")["GoogleSignin"] | null = null;
try { _GoogleSignin = require("@react-native-google-signin/google-signin").GoogleSignin; } catch { /* not available in Expo Go */ }

function GoogleSignInButton({ onError }: { onError: (msg: string) => void }) {
  const setAuth = useAuthStore((s) => s.setAuth);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!_GoogleSignin) {
        // Simulated login for testing purposes in Expo Go / Development
        const res = await api.post<ApiResponse<AuthResponse>>("/auth/login", {
          email: "test@kainook.com",
          password: "KainookTest123!",
        });
        if (!res.data.success) throw res.data;
        return res.data.data;
      }
      await _GoogleSignin.hasPlayServices();
      const signInResult = await _GoogleSignin.signIn();
      const idToken = (signInResult as any).data?.idToken ?? (signInResult as any).idToken;
      if (!idToken) throw new Error("No ID token");
      const res = await api.post("/auth/oauth/google", { idToken });
      return (res.data as { data: AuthResponse }).data;
    },
    onSuccess: async (data) => {
      if (!_GoogleSignin) {
        Alert.alert("Google Sign-In", "Google Sign-In is simulated in Expo Go. Signed in successfully as test@kainook.com.");
      }
      await setAuth(data.user, data.tokens.accessToken);
      handleRoleAndStatusRedirect(data.user);
    },
    onError: () => Alert.alert("Error", "Sign in with Google failed. Please try again."),
  });

  return (
    <TouchableOpacity
      style={[styles.oauthBtn, mutation.isPending && { opacity: 0.6 }]}
      onPress={() => mutation.mutate()}
      disabled={mutation.isPending}
      activeOpacity={0.85}
    >
      <Ionicons name="logo-google" size={18} color="#fff" />
      <Text style={styles.oauthBtnTxt}>Continue with Google</Text>
    </TouchableOpacity>
  );
}

function AppleSignInButton() {
  const AppleAuthentication = require("expo-apple-authentication") as typeof import("expo-apple-authentication");
  const setAuth = useAuthStore((s) => s.setAuth);

  const mutation = useMutation({
    mutationFn: async () => {
      const cred = await AppleAuthentication.signInAsync({
        requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
      });
      const res = await api.post("/auth/oauth/apple", { authorizationCode: cred.authorizationCode, identityToken: cred.identityToken });
      return (res.data as { data: AuthResponse }).data;
    },
    onSuccess: async (data) => {
      await setAuth(data.user, data.tokens.accessToken);
      router.replace("/(tabs)");
    },
    onError: () => Alert.alert("Error", "Sign in with Apple failed. Please try again."),
  });

  return (
    <AppleAuthentication.AppleAuthenticationButton
      buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
      buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
      cornerRadius={10}
      style={{ height: 52 }}
      onPress={() => mutation.mutate()}
    />
  );
}

const { height } = Dimensions.get("window");

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: K.colors.darkGreen },
  scroll: { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 40 },

  brandRow: { alignItems: "flex-start", marginBottom: 32 },
  logoContainer: {
    width: 130, height: 130, borderRadius: 20,
    backgroundColor: "#FFFFFF",
    alignItems: "center", justifyContent: "center",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 12, elevation: 6,
  },
  logoImage: { width: 118, height: 118 },

  headline: { fontSize: K.font.xxxl, fontWeight: "800", color: "#fff", lineHeight: 38, letterSpacing: -0.5 },
  subheadline: { fontSize: K.font.base, color: K.colors.textLightMuted, marginTop: 8, marginBottom: 28 },

  card: {
    backgroundColor: K.colors.glassBg,
    borderRadius: K.radius.xxl,
    borderWidth: 1,
    borderColor: K.colors.glassBorder,
    padding: 24,
  },
  field: { marginBottom: 16 },
  label: {
    fontSize: K.font.sm,
    fontWeight: "600",
    color: K.colors.textLightMuted,
    marginBottom: 8,
    letterSpacing: 0.3,
  },
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
  passRow: { flexDirection: "row", gap: 8, alignItems: "center" },
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
    marginTop: 8,
  },
  btnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: "#fff", fontSize: K.font.lg, fontWeight: "700", letterSpacing: 0.3 },

  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  dividerText: {
    marginHorizontal: 16,
    color: K.colors.textLightMuted,
    fontSize: K.font.sm,
  },

  oauthBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    borderRadius: K.radius.md,
    paddingVertical: 14,
    height: 52,
  },
  oauthBtnTxt: {
    color: "#fff",
    fontSize: K.font.base,
    fontWeight: "600",
  },

  registerRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: 28 },
  registerText: { color: K.colors.textLightMuted, fontSize: K.font.sm },
  registerLink: { color: K.colors.accentLight, fontSize: K.font.sm, fontWeight: "700" },

  forgotLink: {
    alignSelf: "flex-end",
    color: K.colors.accentLight,
    fontSize: K.font.sm,
    fontWeight: "600",
    marginBottom: 20,
    marginTop: -8,
  },
});
