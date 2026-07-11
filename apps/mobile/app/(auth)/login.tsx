import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ImageBackground,
  Image,
  Dimensions,
} from "react-native";
import { Link, router } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../lib/api";
import { listingApi } from "../../lib/listing-api";
import { useAuthStore } from "../../store/auth";
import type { PublicUser, ApiResponse, AuthResponse } from "@zika/types";
import { useKeyboard } from "@/hooks/useKeyboard";

const { height: SCREEN_H } = Dimensions.get("window");
const HERO_H = Math.round(SCREEN_H * 0.44);

const GREEN = "#024622";
const ACCENT = "#1D8D2B";
const TEXT = "#111827";
const MUTED = "#6B7280";
const BORDER = "#E5E7EB";
const INPUT_BG = "#F3F4F6";
const ERR = "#EF4444";

// ─── import anonymous recently-viewed listings after login ────────────────────
async function importAnonViews() {
  try {
    const SecureStore = await import("expo-secure-store");
    const raw = await SecureStore.getItemAsync("zika:anon_views");
    if (!raw) return;
    const ids: string[] = JSON.parse(raw);
    if (!ids.length) return;
    await listingApi.post("/guests/me/recently-viewed/import", {
      listingIds: ids,
    });
    await SecureStore.deleteItemAsync("zika:anon_views");
  } catch {}
}

// ─── redirect helper ─────────────────────────────────────────────────────────
export function handleRoleAndStatusRedirect(user: PublicUser) {
  if (user.userType === "provider") {
    if (user.status === "pending_verification")
      router.replace("/pending-approval");
    else if (user.status === "suspended" || user.status === "banned")
      router.replace("/suspended");
    else router.replace("/(provider)");
  } else {
    router.replace("/(tabs)");
  }
}

// ─── Google Sign-In ───────────────────────────────────────────────────────────
// Load the native Google Sign-In module (unavailable in Expo Go — caught silently)
let _GoogleSignin:
  | (typeof import("@react-native-google-signin/google-signin"))["GoogleSignin"]
  | null = null;
try {
  _GoogleSignin =
    require("@react-native-google-signin/google-signin").GoogleSignin;
  // Configure once at module load — client IDs are public, not secrets
  _GoogleSignin.configure({
    webClientId:
      "397191986681-clt35826mp608u6ptq9udm8m7c7dk80u.apps.googleusercontent.com",
    iosClientId:
      "397191986681-40j0eqotdon89ogv4cgvfsfpb48ehc7h.apps.googleusercontent.com",
    offlineAccess: false,
  });
} catch {
  /* Expo Go or module not available */
}

export function GoogleSignInButton({
  onError,
}: {
  onError: (m: string) => void;
}) {
  const setAuth = useAuthStore((s) => s.setAuth);
  const mutation = useMutation({
    mutationFn: async () => {
      if (!_GoogleSignin)
        throw Object.assign(new Error("Expo Go"), { code: "EXPO_GO" });

      await _GoogleSignin.hasPlayServices({
        showPlayServicesUpdateDialog: true,
      });

      const result = await _GoogleSignin.signIn();
      const idToken = (result as any).data?.idToken ?? (result as any).idToken;
      if (!idToken)
        throw Object.assign(new Error("No ID token returned from Google"), {
          code: "NO_ID_TOKEN",
        });

      const res = await api.post("auth/oauth/google", { idToken });
      return (res.data as { data: AuthResponse }).data;
    },
    onSuccess: async (data) => {
      await setAuth(data.user, data.tokens.accessToken);
      void importAnonViews();
      handleRoleAndStatusRedirect(data.user);
    },
    onError: (err: unknown) => {
      const code = String((err as any)?.code ?? "");
      // User cancelled — silent
      if (code === "SIGN_IN_CANCELLED" || code === "12501") return;
      // Sign-in already in progress — silent
      if (code === "IN_PROGRESS" || code === "10") return;
      // Expo Go — not supported
      if (code === "EXPO_GO") {
        Alert.alert(
          "Not Supported",
          "Google Sign-In requires a development build, not Expo Go.",
        );
        return;
      }
      // Play Services unavailable
      if (code === "PLAY_SERVICES_NOT_AVAILABLE" || code === "2") {
        onError("Google Play Services is not available on this device.");
        return;
      }
      // No ID token — usually misconfiguration
      if (code === "NO_ID_TOKEN") {
        onError(
          "Google Sign-In configuration error. Please try again or use email & password.",
        );
        return;
      }
      onError(
        "Google Sign-In failed. Please try again or use email & password.",
      );
    },
  });

  return (
    <TouchableOpacity
      style={[ss.socialBtn, mutation.isPending && { opacity: 0.6 }]}
      onPress={() => mutation.mutate()}
      disabled={mutation.isPending}
      activeOpacity={0.8}
    >
      {mutation.isPending ? (
        <ActivityIndicator color={TEXT} size="small" />
      ) : (
        <Ionicons name="logo-google" size={18} color={TEXT} />
      )}
      <Text style={ss.socialBtnTxt}>Google</Text>
    </TouchableOpacity>
  );
}

// ─── Login Screen ─────────────────────────────────────────────────────────────
export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setAuth = useAuthStore((s) => s.setAuth);
  const isKeyboardOpen = useKeyboard();

  const loginMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post<ApiResponse<AuthResponse>>("auth/login", {
        email: email.trim().toLowerCase(),
        password,
      });
      if (!res.data.success) throw res.data;
      return res.data.data;
    },
    onSuccess: async (data) => {
      await setAuth(data.user, data.tokens.accessToken);
      void importAnonViews();
      handleRoleAndStatusRedirect(data.user);
    },
    onError: (err: unknown) => {
      const data = (err as any)?.response?.data ?? err;
      if (data?.error?.code === "EMAIL_NOT_VERIFIED") {
        router.push({ pathname: "/(auth)/verify-pending", params: { email } });
        return;
      }
      setError(
        data?.error?.message ??
          (err as any)?.message ??
          "Unable to sign in. Please try again.",
      );
    },
  });

  function submit() {
    setError(null);
    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }
    loginMutation.mutate();
  }

  return (
    <KeyboardAvoidingView
      style={ss.root}
      behavior={
        Platform.OS === "ios"
          ? "padding"
          : isKeyboardOpen
            ? "height"
            : undefined
      }
    >
      {/* ── Form card ── */}
      <ScrollView
        style={{
          flex: 1,
          backgroundColor: "#fff",
          marginTop: -24,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
        }}
        contentContainerStyle={ss.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero section ── */}
        <ImageBackground
          source={require("../../assets/splash.png")}
          style={[ss.hero, { height: HERO_H }]}
          resizeMode="cover"
        >
          <View style={ss.heroOverlay} />
        </ImageBackground>
        <View
          style={{
            paddingHorizontal: 24,
          }}
        >
          <Text style={ss.cardTitle}>Sign In</Text>

          {/* Email */}
          <View style={ss.field}>
            <Text style={ss.label}>Email Address</Text>
            <View style={ss.inputRow}>
              <Ionicons
                name="mail-outline"
                size={18}
                color={MUTED}
                style={ss.inputIcon}
              />
              <TextInput
                style={ss.input}
                value={email}
                onChangeText={(v) => {
                  setEmail(v);
                  setError(null);
                }}
                placeholder="you@example.com"
                placeholderTextColor="#9CA3AF"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
            </View>
          </View>

          {/* Password */}
          <View style={ss.field}>
            <Text style={ss.label}>Password</Text>
            <View style={ss.inputRow}>
              <Ionicons
                name="lock-closed-outline"
                size={18}
                color={MUTED}
                style={ss.inputIcon}
              />
              <TextInput
                style={ss.input}
                value={password}
                onChangeText={(v) => {
                  setPassword(v);
                  setError(null);
                }}
                placeholder="Your password"
                placeholderTextColor="#9CA3AF"
                secureTextEntry={!showPass}
              />
              <TouchableOpacity
                onPress={() => setShowPass((p) => !p)}
                style={ss.eye}
              >
                <Ionicons
                  name={showPass ? "eye-off-outline" : "eye-outline"}
                  size={18}
                  color={MUTED}
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Forgot password */}
          <Link href="/(auth)/forgot-password" asChild>
            <TouchableOpacity style={ss.forgotWrap}>
              <Text style={ss.forgotTxt}>Forgot Password?</Text>
            </TouchableOpacity>
          </Link>

          {/* Error */}
          {error ? (
            <View style={ss.errBox}>
              <Ionicons name="alert-circle-outline" size={15} color={ERR} />
              <Text style={ss.errTxt}>{error}</Text>
            </View>
          ) : null}

          {/* Submit */}
          <TouchableOpacity
            style={[ss.btn, loginMutation.isPending && ss.btnDim]}
            onPress={submit}
            disabled={loginMutation.isPending}
            activeOpacity={0.85}
          >
            {loginMutation.isPending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={ss.btnTxt}>Sign In</Text>
            )}
          </TouchableOpacity>

          {/* Divider */}
          <View style={ss.divRow}>
            <View style={ss.divLine} />
            <Text style={ss.divTxt}>or continue with</Text>
            <View style={ss.divLine} />
          </View>

          {/* Social buttons */}
          <View style={ss.socialRow}>
            <GoogleSignInButton onError={(m) => setError(m)} />
            {Platform.OS === "ios" && (
              <AppleButton onError={(m) => setError(m)} />
            )}
          </View>

          {/* Register link */}
          <View style={ss.linkRow}>
            <Text style={ss.linkTxt}>Don't have an account? </Text>
            <Link href="/(auth)/register" asChild>
              <TouchableOpacity>
                <Text style={ss.link}>Sign Up</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Apple button ─────────────────────────────────────────────────────────────
function AppleButton({ onError }: { onError: (m: string) => void }) {
  const AppleAuth =
    require("expo-apple-authentication") as typeof import("expo-apple-authentication");
  const setAuth = useAuthStore((s) => s.setAuth);
  const mutation = useMutation({
    mutationFn: async () => {
      const cred = await AppleAuth.signInAsync({
        requestedScopes: [
          AppleAuth.AppleAuthenticationScope.FULL_NAME,
          AppleAuth.AppleAuthenticationScope.EMAIL,
        ],
      });
      const res = await api.post("auth/oauth/apple", {
        authorizationCode: cred.authorizationCode,
        identityToken: cred.identityToken,
      });
      return (res.data as { data: AuthResponse }).data;
    },
    onSuccess: async (data) => {
      await setAuth(data.user, data.tokens.accessToken);
      handleRoleAndStatusRedirect(data.user);
    },
    onError: () => onError("Apple Sign-In failed. Please try again."),
  });
  return (
    <TouchableOpacity
      style={[ss.socialBtn, mutation.isPending && { opacity: 0.6 }]}
      onPress={() => mutation.mutate()}
      disabled={mutation.isPending}
      activeOpacity={0.8}
    >
      {mutation.isPending ? (
        <ActivityIndicator color={TEXT} size="small" />
      ) : (
        <Ionicons name="logo-apple" size={18} color={TEXT} />
      )}
      <Text style={ss.socialBtnTxt}>Apple</Text>
    </TouchableOpacity>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const ss = StyleSheet.create({
  root: { flex: 1, backgroundColor: GREEN },

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
    backgroundColor: "rgba(1,26,12,0.62)",
  },
  heroContent: { paddingHorizontal: 28, paddingBottom: 44 },
  logoWrap: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 6,
  },
  logo: { width: 50, height: 50 },
  heroTitle: {
    fontSize: 32,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -0.5,
  },
  heroSub: { fontSize: 15, color: "rgba(255,255,255,0.72)", marginTop: 6 },

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
    marginBottom: 24,
    letterSpacing: -0.3,
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

  forgotWrap: { alignItems: "flex-end", marginBottom: 20, marginTop: -4 },
  forgotTxt: { fontSize: 13, color: ACCENT, fontWeight: "600" },

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

  btn: {
    backgroundColor: GREEN,
    borderRadius: 14,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  btnDim: { opacity: 0.6 },
  btnTxt: { color: "#fff", fontSize: 16, fontWeight: "700" },

  divRow: { flexDirection: "row", alignItems: "center", marginVertical: 22 },
  divLine: { flex: 1, height: 1, backgroundColor: BORDER },
  divTxt: { marginHorizontal: 12, color: MUTED, fontSize: 12 },

  socialRow: { flexDirection: "row", gap: 12 },
  socialBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#F9FAFB",
    borderWidth: 1.5,
    borderColor: BORDER,
    borderRadius: 12,
    paddingVertical: 13,
  },
  socialBtnTxt: { fontSize: 14, fontWeight: "600", color: TEXT },

  linkRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 24,
  },
  linkTxt: { color: MUTED, fontSize: 14 },
  link: { color: ACCENT, fontSize: 14, fontWeight: "700" },
});
