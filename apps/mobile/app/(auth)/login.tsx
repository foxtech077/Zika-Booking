import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Image,
  ActivityIndicator,
} from "react-native";
import { Link, router } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/auth";
import type { ApiResponse, AuthResponse } from "@zika/types";

// ── Colors ────────────────────────────────────────────────────────────────────
const GREEN = "#1B5E20";
const GREEN_MED = "#2E7D32";
const GREEN_LIGHT = "#F0FFF4";
const GREEN_BORDER = "#BBF7D0";
const MUTED = "#4B7860";

// ── Google Sign-In (native — not available in Expo Go) ────────────────────────
let _GoogleSignin: typeof import("@react-native-google-signin/google-signin")["GoogleSignin"] | null = null;
try {
  _GoogleSignin = require("@react-native-google-signin/google-signin").GoogleSignin;
} catch { /* not available in Expo Go */ }

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [generalError, setGeneralError] = useState<string | null>(null);
  const setAuth = useAuthStore((s) => s.setAuth);

  const loginMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post<ApiResponse<AuthResponse>>("/auth/login", { email, password });
      if (!res.data.success) throw res.data;
      return res.data.data;
    },
    onSuccess: async (data) => {
      await setAuth(data.user, data.tokens.accessToken);
      router.replace("/(tabs)");
    },
    onError: (err: unknown) => {
      const axiosErr = err as {
        message?: string;
        code?: string;
        config?: { url?: string; baseURL?: string };
        response?: { data?: ApiResponse<unknown> };
      };
      const data = axiosErr.response?.data;
      const structuredError = data && !data.success && data.error && typeof data.error === "object";
      if (structuredError) {
        const apiErr = (data as { success: false; error: { code: string; message: string } }).error;
        if (apiErr.code === "EMAIL_NOT_VERIFIED") {
          router.push({ pathname: "/(auth)/verify-pending", params: { email } });
          return;
        }
        setGeneralError(apiErr.message);
      } else {
        const details = __DEV__
          ? `\n\n[Debug] ${axiosErr.config?.baseURL ?? api.defaults.baseURL}${axiosErr.config?.url ?? ""} — ${axiosErr.message ?? "Unknown"}`
          : "";
        setGeneralError(`Unable to connect to server. Please try again.${details}`);
      }
    },
  });

  function handleSubmit() {
    if (!email.trim() || !password) {
      setGeneralError("Please enter your email and password.");
      return;
    }
    setGeneralError(null);
    loginMutation.mutate();
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "android" ? 0 : 0}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="interactive"
      >
        {/* Logo */}
        <View style={styles.logoWrap}>
          <Image
            source={require("../../assets/kainook_logo.png")}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <Text style={styles.heading}>Welcome back</Text>
        <Text style={styles.subheading}>Sign in to your Kainook account</Text>

        {/* Google Sign-In — top position, prominent */}
        <GoogleSignInButton onError={setGeneralError} />

        {/* Divider */}
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or continue with email</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Email */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Email address</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="mail-outline" size={18} color={MUTED} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={(v) => { setEmail(v); setGeneralError(null); }}
              placeholder="you@example.com"
              placeholderTextColor="#A7C4B5"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
          </View>
        </View>

        {/* Password */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Password</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="lock-closed-outline" size={18} color={MUTED} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={password}
              onChangeText={(v) => { setPassword(v); setGeneralError(null); }}
              placeholder="Your password"
              placeholderTextColor="#A7C4B5"
              secureTextEntry={!showPassword}
              onSubmitEditing={handleSubmit}
              returnKeyType="done"
            />
            <TouchableOpacity onPress={() => setShowPassword((v) => !v)} style={styles.eyeBtn}>
              <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={18} color={MUTED} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Forgot password */}
        <Link href="/(auth)/forgot-password" asChild>
          <TouchableOpacity style={styles.forgotWrap}>
            <Text style={styles.forgotText}>Forgot password?</Text>
          </TouchableOpacity>
        </Link>

        {/* Error */}
        {generalError ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={16} color="#dc2626" />
            <Text style={styles.errorText}>{generalError}</Text>
          </View>
        ) : null}

        {/* Sign In button */}
        <TouchableOpacity
          style={[styles.primaryBtn, loginMutation.isPending && styles.primaryBtnDisabled]}
          onPress={handleSubmit}
          disabled={loginMutation.isPending}
          activeOpacity={0.85}
        >
          {loginMutation.isPending ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name="log-in-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.primaryBtnText}>Sign In</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Register link */}
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

// ── Google Sign-In Button ─────────────────────────────────────────────────────

function GoogleSignInButton({ onError }: { onError: (msg: string) => void }) {
  const setAuth = useAuthStore((s) => s.setAuth);
  const GoogleSignin = _GoogleSignin;

  const mutation = useMutation({
    mutationFn: async () => {
      if (!GoogleSignin) {
        // Expo Go fallback — simulated for dev/testing
        const res = await api.post<ApiResponse<AuthResponse>>("/auth/login", {
          email: "test@zika.com",
          password: "ZikaTest123!",
        });
        if (!res.data.success) throw res.data;
        return res.data.data;
      }
      await GoogleSignin.hasPlayServices();
      const result = await GoogleSignin.signIn();
      const idToken = (result as any).data?.idToken ?? (result as any).idToken;
      if (!idToken) throw new Error("No ID token returned from Google.");
      const res = await api.post<{ data: AuthResponse }>("/auth/oauth/google", { idToken });
      return res.data.data;
    },
    onSuccess: async (data) => {
      if (!GoogleSignin) {
        Alert.alert("Dev Mode", "Signed in as test@zika.com (Expo Go simulation).");
      }
      await setAuth(data.user, data.tokens.accessToken);
      router.replace("/(tabs)");
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error?.message ?? err?.message ?? "Google sign-in failed.";
      onError(msg);
    },
  });

  return (
    <TouchableOpacity
      style={styles.googleBtn}
      onPress={() => mutation.mutate()}
      disabled={mutation.isPending}
      activeOpacity={0.85}
    >
      {mutation.isPending ? (
        <ActivityIndicator color={GREEN} size="small" />
      ) : (
        <>
          <View style={styles.googleIconWrap}>
            <Text style={styles.googleG}>G</Text>
          </View>
          <Text style={styles.googleBtnText}>Continue with Google</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: GREEN_LIGHT },
  scroll: { paddingHorizontal: 24, paddingTop: 60, paddingBottom: 48 },

  logoWrap: { alignItems: "center", marginBottom: 20 },
  logo: { width: 160, height: 80 },

  heading: { fontSize: 28, fontWeight: "800", color: GREEN, textAlign: "center", marginBottom: 6 },
  subheading: { fontSize: 15, color: MUTED, textAlign: "center", marginBottom: 28 },

  // Google button
  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: GREEN_BORDER,
    borderRadius: 14,
    paddingVertical: 14,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  googleIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  googleG: { fontSize: 15, fontWeight: "800", color: "#4285F4" },
  googleBtnText: { fontSize: 15, fontWeight: "600", color: "#1f2937" },

  // Divider
  dividerRow: { flexDirection: "row", alignItems: "center", marginBottom: 20, gap: 10 },
  dividerLine: { flex: 1, height: 1, backgroundColor: GREEN_BORDER },
  dividerText: { fontSize: 12, color: MUTED, fontWeight: "500" },

  // Fields
  fieldGroup: { marginBottom: 16 },
  fieldLabel: { fontSize: 13, fontWeight: "600", color: GREEN_MED, marginBottom: 7 },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: GREEN_BORDER,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 15, color: "#1f2937" },
  eyeBtn: { padding: 4 },

  // Forgot
  forgotWrap: { alignSelf: "flex-end", marginBottom: 20 },
  forgotText: { fontSize: 13, color: GREEN_MED, fontWeight: "600" },

  // Error
  errorBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#fef2f2",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#fecaca",
    gap: 8,
    marginBottom: 16,
  },
  errorText: { fontSize: 13, color: "#dc2626", flex: 1, lineHeight: 18 },

  // Primary button
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: GREEN,
    borderRadius: 14,
    paddingVertical: 16,
    marginBottom: 20,
    shadowColor: GREEN,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  primaryBtnDisabled: { opacity: 0.65 },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },

  // Register link
  registerRow: { flexDirection: "row", justifyContent: "center", alignItems: "center" },
  registerText: { fontSize: 14, color: MUTED },
  registerLink: { fontSize: 14, color: GREEN, fontWeight: "700" },
});
