import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Image,
  ActivityIndicator,
} from "react-native";
import { Link, router } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { registerSchema } from "@zika/validators";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/auth";
import type { ApiResponse, PublicUser } from "@zika/types";

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

type UserType = "guest" | "provider";

interface FieldErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
  businessName?: string;
  country?: string;
  general?: string;
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function RegisterScreen() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const [userType, setUserType] = useState<UserType>("guest");
  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "",
    password: "", confirmPassword: "",
    businessName: "", country: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitted, setSubmitted] = useState(false);

  const set = (key: keyof typeof form) => (val: string) =>
    setForm((prev) => ({ ...prev, [key]: val }));
  const clearError = (key: keyof FieldErrors) =>
    setErrors((prev) => ({ ...prev, [key]: undefined }));

  const registerMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        userType,
        businessName: userType === "provider" ? (form.businessName || undefined) : undefined,
        country: userType === "provider" ? (form.country || undefined) : undefined,
      };
      const res = await api.post<ApiResponse<{ message?: string; user?: PublicUser; tokens?: { accessToken: string } }>>(
        "/auth/register",
        payload
      );
      return res.data;
    },
    onSuccess: async (data) => {
      if (data.success && data.data?.user && data.data?.tokens) {
        await setAuth(data.data.user, data.data.tokens.accessToken);
        router.replace("/(tabs)");
      } else {
        setSubmitted(true);
      }
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
        const apiErr = (data as { success: false; error: { code: string; message: string; fields?: Record<string, string> } }).error;
        const fields = apiErr.fields ?? {};
        setErrors({ ...fields, general: apiErr.fields ? undefined : apiErr.message });
      } else {
        const details = __DEV__
          ? `\n\n[Debug] ${axiosErr.config?.baseURL ?? api.defaults.baseURL}${axiosErr.config?.url ?? ""} — ${axiosErr.message ?? "Unknown"}`
          : "";
        setErrors({ general: `Unable to connect to server. Please try again.${details}` });
      }
    },
  });

  function validate(): boolean {
    const dataToValidate = {
      ...form,
      userType,
      businessName: userType === "provider" ? (form.businessName || undefined) : undefined,
      country: userType === "provider" ? (form.country || undefined) : undefined,
    };
    const result = registerSchema.safeParse(dataToValidate);
    if (!result.success) {
      const fieldErrors: FieldErrors = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof FieldErrors;
        if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      return false;
    }
    setErrors({});
    return true;
  }

  function handleSubmit() {
    if (validate()) registerMutation.mutate();
  }

  // ── Email verification pending screen ────────────────────────────────────
  if (submitted) {
    return (
      <View style={styles.verifyScreen}>
        <View style={styles.verifyCard}>
          <View style={styles.verifyIconWrap}>
            <Ionicons name="mail" size={36} color={GREEN} />
          </View>
          <Text style={styles.verifyTitle}>Verify your email</Text>
          <Text style={styles.verifyBody}>
            We sent a verification link to{"\n"}
            <Text style={styles.verifyEmail}>{form.email}</Text>
          </Text>
          <Text style={styles.verifyHint}>
            Click the link in the email to activate your account. Check your spam folder if you don't see it.
          </Text>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => router.push({ pathname: "/(auth)/verify-pending" as any, params: { email: form.email } })}
          >
            <Text style={styles.primaryBtnText}>Resend verification email</Text>
          </TouchableOpacity>
          <Link href="/(auth)/login" asChild>
            <TouchableOpacity style={styles.backLink}>
              <Text style={styles.backLinkText}>Back to Sign In</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Logo */}
        <View style={styles.logoWrap}>
          <Image
            source={require("../../assets/kainook_logo.png")}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <Text style={styles.heading}>Create account</Text>
        <Text style={styles.subheading}>Join Kainook and start exploring.</Text>

        {/* Google Sign-In — top position, prominent */}
        <GoogleSignInButton onError={(msg) => setErrors({ general: msg })} />

        {/* Divider */}
        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or sign up with email</Text>
          <View style={styles.dividerLine} />
        </View>

        {/* Account type selector */}
        <View style={styles.typeSelector}>
          {(["guest", "provider"] as UserType[]).map((type) => (
            <TouchableOpacity
              key={type}
              style={[styles.typeOption, userType === type && styles.typeOptionActive]}
              onPress={() => { setUserType(type); setErrors({}); }}
              activeOpacity={0.8}
            >
              <Ionicons
                name={type === "guest" ? "person-outline" : "briefcase-outline"}
                size={16}
                color={userType === type ? "#fff" : MUTED}
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.typeOptionText, userType === type && styles.typeOptionTextActive]}>
                {type === "guest" ? "Traveller" : "Provider / Host"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Name row */}
        <View style={styles.rowFields}>
          <View style={[styles.fieldGroup, { flex: 1, marginRight: 8 }]}>
            <Text style={styles.fieldLabel}>First name *</Text>
            <View style={[styles.inputWrap, errors.firstName && styles.inputWrapError]}>
              <TextInput
                style={styles.input}
                value={form.firstName}
                onChangeText={(v) => { set("firstName")(v); clearError("firstName"); }}
                placeholder="Ada"
                placeholderTextColor="#A7C4B5"
                autoCapitalize="words"
              />
            </View>
            {errors.firstName ? <Text style={styles.fieldError}>{errors.firstName}</Text> : null}
          </View>
          <View style={[styles.fieldGroup, { flex: 1 }]}>
            <Text style={styles.fieldLabel}>Last name *</Text>
            <View style={[styles.inputWrap, errors.lastName && styles.inputWrapError]}>
              <TextInput
                style={styles.input}
                value={form.lastName}
                onChangeText={(v) => { set("lastName")(v); clearError("lastName"); }}
                placeholder="Okafor"
                placeholderTextColor="#A7C4B5"
                autoCapitalize="words"
              />
            </View>
            {errors.lastName ? <Text style={styles.fieldError}>{errors.lastName}</Text> : null}
          </View>
        </View>

        {/* Email */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Email address *</Text>
          <View style={[styles.inputWrap, errors.email && styles.inputWrapError]}>
            <Ionicons name="mail-outline" size={17} color={MUTED} style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={form.email}
              onChangeText={(v) => { set("email")(v); clearError("email"); }}
              placeholder="you@example.com"
              placeholderTextColor="#A7C4B5"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />
          </View>
          {errors.email ? <Text style={styles.fieldError}>{errors.email}</Text> : null}
        </View>

        {/* Provider-only fields */}
        {userType === "provider" && (
          <>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Business name *</Text>
              <View style={[styles.inputWrap, errors.businessName && styles.inputWrapError]}>
                <Ionicons name="business-outline" size={17} color={MUTED} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={form.businessName}
                  onChangeText={(v) => { set("businessName")(v); clearError("businessName"); }}
                  placeholder="Serena Hotels Ltd."
                  placeholderTextColor="#A7C4B5"
                />
              </View>
              {errors.businessName ? <Text style={styles.fieldError}>{errors.businessName}</Text> : null}
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Country (ISO code) *</Text>
              <View style={[styles.inputWrap, errors.country && styles.inputWrapError]}>
                <Ionicons name="flag-outline" size={17} color={MUTED} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={form.country}
                  onChangeText={(v) => { set("country")(v.toUpperCase()); clearError("country"); }}
                  placeholder="KE"
                  placeholderTextColor="#A7C4B5"
                  maxLength={2}
                  autoCapitalize="characters"
                />
              </View>
              {errors.country ? <Text style={styles.fieldError}>{errors.country}</Text> : null}
            </View>
          </>
        )}

        {/* Password */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Password *</Text>
          <View style={[styles.inputWrap, errors.password && styles.inputWrapError]}>
            <Ionicons name="lock-closed-outline" size={17} color={MUTED} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={form.password}
              onChangeText={(v) => { set("password")(v); clearError("password"); }}
              placeholder="Min. 8 characters"
              placeholderTextColor="#A7C4B5"
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword((v) => !v)} style={styles.eyeBtn}>
              <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={17} color={MUTED} />
            </TouchableOpacity>
          </View>
          {errors.password ? <Text style={styles.fieldError}>{errors.password}</Text> : null}
        </View>

        {/* Confirm password */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabel}>Confirm password *</Text>
          <View style={[styles.inputWrap, errors.confirmPassword && styles.inputWrapError]}>
            <Ionicons name="lock-closed-outline" size={17} color={MUTED} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={form.confirmPassword}
              onChangeText={(v) => { set("confirmPassword")(v); clearError("confirmPassword"); }}
              placeholder="Repeat password"
              placeholderTextColor="#A7C4B5"
              secureTextEntry={!showConfirm}
            />
            <TouchableOpacity onPress={() => setShowConfirm((v) => !v)} style={styles.eyeBtn}>
              <Ionicons name={showConfirm ? "eye-off-outline" : "eye-outline"} size={17} color={MUTED} />
            </TouchableOpacity>
          </View>
          {errors.confirmPassword ? <Text style={styles.fieldError}>{errors.confirmPassword}</Text> : null}
        </View>

        {/* General error */}
        {errors.general ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={16} color="#dc2626" />
            <Text style={styles.errorText}>{errors.general}</Text>
          </View>
        ) : null}

        {/* Submit */}
        <TouchableOpacity
          style={[styles.primaryBtn, registerMutation.isPending && styles.primaryBtnDisabled]}
          onPress={handleSubmit}
          disabled={registerMutation.isPending}
          activeOpacity={0.85}
        >
          {registerMutation.isPending ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name="person-add-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
              <Text style={styles.primaryBtnText}>Create Account</Text>
            </>
          )}
        </TouchableOpacity>

        {/* Login link */}
        <View style={styles.loginRow}>
          <Text style={styles.loginText}>Already have an account? </Text>
          <Link href="/(auth)/login" asChild>
            <TouchableOpacity>
              <Text style={styles.loginLink}>Sign In</Text>
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
      if (!GoogleSignin) throw new Error("Google Sign-In is not available in Expo Go.");
      await GoogleSignin.hasPlayServices();
      const result = await GoogleSignin.signIn();
      const idToken = (result as any).data?.idToken ?? (result as any).idToken;
      if (!idToken) throw new Error("No ID token returned from Google.");
      const res = await api.post<{ data: { user: PublicUser; tokens: { accessToken: string } } }>(
        "/auth/oauth/google",
        { idToken }
      );
      return res.data.data;
    },
    onSuccess: async (data) => {
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
  scroll: { paddingHorizontal: 24, paddingTop: 56, paddingBottom: 48 },

  logoWrap: { alignItems: "center", marginBottom: 16 },
  logo: { width: 140, height: 70 },

  heading: { fontSize: 26, fontWeight: "800", color: GREEN, textAlign: "center", marginBottom: 6 },
  subheading: { fontSize: 14, color: MUTED, textAlign: "center", marginBottom: 24 },

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
  dividerRow: { flexDirection: "row", alignItems: "center", marginBottom: 18, gap: 10 },
  dividerLine: { flex: 1, height: 1, backgroundColor: GREEN_BORDER },
  dividerText: { fontSize: 12, color: MUTED, fontWeight: "500" },

  // Type selector
  typeSelector: {
    flexDirection: "row",
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1.5,
    borderColor: GREEN_BORDER,
    marginBottom: 18,
  },
  typeOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 11,
    backgroundColor: "#fff",
  },
  typeOptionActive: { backgroundColor: GREEN },
  typeOptionText: { fontSize: 13, fontWeight: "600", color: MUTED },
  typeOptionTextActive: { color: "#fff" },

  // Fields
  rowFields: { flexDirection: "row", marginBottom: 0 },
  fieldGroup: { marginBottom: 14 },
  fieldLabel: { fontSize: 13, fontWeight: "600", color: GREEN_MED, marginBottom: 6 },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderWidth: 1.5,
    borderColor: GREEN_BORDER,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  inputWrapError: { borderColor: "#fca5a5" },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, fontSize: 14, color: "#1f2937" },
  eyeBtn: { padding: 4 },
  fieldError: { fontSize: 12, color: "#dc2626", marginTop: 4 },

  // Error box
  errorBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#fef2f2",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#fecaca",
    gap: 8,
    marginBottom: 14,
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
    marginBottom: 18,
    shadowColor: GREEN,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5,
  },
  primaryBtnDisabled: { opacity: 0.65 },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },

  // Login link
  loginRow: { flexDirection: "row", justifyContent: "center", alignItems: "center" },
  loginText: { fontSize: 14, color: MUTED },
  loginLink: { fontSize: 14, color: GREEN, fontWeight: "700" },

  // Verify screen
  verifyScreen: { flex: 1, backgroundColor: GREEN_LIGHT, alignItems: "center", justifyContent: "center", padding: 24 },
  verifyCard: { backgroundColor: "#fff", borderRadius: 24, padding: 28, alignItems: "center", width: "100%", shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 16, elevation: 6 },
  verifyIconWrap: { width: 72, height: 72, borderRadius: 36, backgroundColor: GREEN_LIGHT, alignItems: "center", justifyContent: "center", marginBottom: 16, borderWidth: 2, borderColor: GREEN_BORDER },
  verifyTitle: { fontSize: 22, fontWeight: "800", color: GREEN, marginBottom: 10, textAlign: "center" },
  verifyBody: { fontSize: 15, color: MUTED, textAlign: "center", lineHeight: 22, marginBottom: 8 },
  verifyEmail: { fontWeight: "700", color: "#1f2937" },
  verifyHint: { fontSize: 13, color: "#9ca3af", textAlign: "center", lineHeight: 19, marginBottom: 24 },
  backLink: { marginTop: 12 },
  backLinkText: { fontSize: 14, color: GREEN, fontWeight: "700", textAlign: "center" },
});
