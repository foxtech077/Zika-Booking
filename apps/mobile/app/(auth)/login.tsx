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
import { SafeAreaView } from "react-native-safe-area-context";
import { Link, router } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../lib/api";
import { listingApi } from "../../lib/listing-api";
import { useAuthStore } from "../../store/auth";
import type { PublicUser, ApiResponse, AuthResponse } from "@zika/types";
import { useKeyboard } from "@/hooks/useKeyboard";

const { height: SCREEN_H } = Dimensions.get("window");
const HERO_H = Math.round(SCREEN_H * 0.43);

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
  } catch { }
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
let _statusCodes: any = null;

try {
  const GoogleModule = require("@react-native-google-signin/google-signin");
  _GoogleSignin = GoogleModule.GoogleSignin;
  _statusCodes = GoogleModule.statusCodes;

  // Configure once at module load — client IDs are public, not secrets
  _GoogleSignin?.configure({
    webClientId:
      "1022728776661-50ctighki9jm25ig10b39matcr0ihslr.apps.googleusercontent.com",
    iosClientId:
      "1022728776661-6aucvg2l0r7suuogj2m9lgcjodetb2rn.apps.googleusercontent.com",
    offlineAccess: false,
  });
} catch {
  /* Expo Go or module not available */
}

// Android GMS mints an ID token only if the certificate the running APK is signed with has a
// matching Android OAuth client for the package name. Each distribution channel signs with a
// different cert, so all three fingerprints must be registered against com.kainook.app.
const DEVELOPER_ERROR_HELP =
  "[GOOGLE-AUTH] DEVELOPER_ERROR — the running app's signing certificate has no matching\n" +
  "Android OAuth client for com.kainook.app. Each channel signs with a different cert:\n" +
  "  expo run:android -> 5E:8F:16:06:...  (android/app/debug.keystore, committed)\n" +
  "  EAS, sideloaded  -> 76:D2:10:0F:...  (EAS managed upload keystore)\n" +
  "  Google Play      -> 09:EC:08:B5:...  (Play App Signing re-signs the AAB)\n" +
  "Register missing ones in Firebase > kainook-cd1d2 > Android app, re-download\n" +
  "google-services.json, then verify with ./scripts/verify-google-signin.sh";

export function GoogleSignInButton({
  onError,
}: {
  onError: (m: string) => void;
}) {
  const setAuth = useAuthStore((s) => s.setAuth);
  const mutation = useMutation({
    mutationFn: async () => {
      if (!_GoogleSignin) {
        throw Object.assign(new Error("Expo Go"), { code: "EXPO_GO" });
      }

      await _GoogleSignin.hasPlayServices({
        showPlayServicesUpdateDialog: true,
      });

      const result = await _GoogleSignin.signIn();

      // v13 resolves (rather than throws) on cancellation. On Android this is frequently a
      // disguised DEVELOPER_ERROR: the native ErrorDto rewrites any ApiException whose
      // Status.isCanceled is true to SIGN_IN_CANCELLED, discarding the real code 10, which the
      // JS layer then converts into { type: "cancelled" }. The two are indistinguishable here,
      // so log the checklist and let onError stay silent as it would for a real cancellation.
      if ((result as any)?.type === "cancelled") {
        if (Platform.OS === "android") {
          console.warn(
            "[GOOGLE-AUTH] signIn() returned `cancelled`. If the picker was not dismissed by the\n" +
            "user, this is a masked DEVELOPER_ERROR — https://issuetracker.google.com/issues/424210681",
          );
          console.warn(DEVELOPER_ERROR_HELP);
        }
        throw Object.assign(new Error("Google sign-in cancelled"), {
          code: "SIGN_IN_CANCELLED",
        });
      }

      const idToken = (result as any).data?.idToken ?? (result as any).idToken;
      if (!idToken) {
        throw Object.assign(new Error("No ID token returned from Google"), {
          code: "NO_ID_TOKEN",
        });
      }

      const res = await api.post("auth/oauth/google", { idToken });
      return (res.data as { data: AuthResponse }).data;
    },
    onSuccess: async (data) => {
      await setAuth(data.user, data.tokens.accessToken);
      void importAnonViews();
      handleRoleAndStatusRedirect(data.user);
    },
    onError: (err: unknown) => {
      const errObj = err as any;
      const code = String(errObj?.code ?? "");
      const message = String(errObj?.message ?? errObj ?? "");
      console.error("[GOOGLE-AUTH] Google Sign-In Error Captured:", {
        code,
        message,
        errorRaw: errObj,
        statusCodes: _statusCodes,
      });

      // User cancelled — silent
      if (
        code === "SIGN_IN_CANCELLED" ||
        code === "12501" ||
        (_statusCodes && code === String(_statusCodes.SIGN_IN_CANCELLED))
      ) {
        console.log("[GOOGLE-AUTH] User cancelled the Google sign-in dialog.");
        return;
      }

      // Sign-in already in progress — silent
      if (
        code === "IN_PROGRESS" ||
        code === "12502" ||
        code === "ASYNC_OP_IN_PROGRESS" ||
        (_statusCodes && code === String(_statusCodes.IN_PROGRESS))
      ) {
        console.log("[GOOGLE-AUTH] Google sign-in is already in progress.");
        return;
      }

      // Code 10 is DEVELOPER_ERROR on Android (SHA-1 / Package Name / Client ID mismatch)
      if (
        code === "10" ||
        code === "DEVELOPER_ERROR" ||
        (_statusCodes && code === String(_statusCodes.DEVELOPER_ERROR))
      ) {
        console.error("[GOOGLE-AUTH] DEVELOPER_ERROR (Code 10) encountered!");
        console.error(
          "[GOOGLE-AUTH] Android Developer Error (Code 10) Troubleshooting Checklist:\n" +
          " 1. SHA-1 Fingerprint: Verify your debug keystore SHA-1 is added under Android Client ID in Google Cloud Console.\n" +
          " 2. Package Name: Verify package name in Google Cloud Console matches 'com.kainook.app'.\n" +
          " 3. Web Client ID: Verify webClientId in configure() matches the Web Application Client ID in Google Cloud Console."
        );
        onError("Google Sign-In configuration error (Code 10). See console logs.");
        return;
      }

      // Play Services unavailable
      if (
        code === "PLAY_SERVICES_NOT_AVAILABLE" ||
        code === "2" ||
        (_statusCodes && code === String(_statusCodes.PLAY_SERVICES_NOT_AVAILABLE))
      ) {
        console.error("[GOOGLE-AUTH] Google Play Services is missing or outdated.");
        onError("Google Play Services is not available on this device.");
        return;
      }

      // No ID token — usually misconfiguration
      if (code === "NO_ID_TOKEN") {
        console.error("[GOOGLE-AUTH] No ID token returned.");
        onError(
          "Google Sign-In configuration error (No ID token). Please try again or use email & password.",
        );
        return;
      }

      console.error("[GOOGLE-AUTH] Unhandled error:", message);
      Alert.alert(
        "Google Sign-In Failed",
        `Error: ${message || code || "Unknown error"}`,
      );
      onError(
        `Google Sign-In failed (${code || "Error"}). Please try again or use email & password.`,
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
    <SafeAreaView
      style={ss.root}
      edges={Platform.OS === "android" ? ["top", "bottom"] : ["top"]}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
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
            resizeMode="contain"
          >
            <View style={ss.heroOverlay} />
          </ImageBackground>
          <View
            style={{
              paddingHorizontal: 24,
              marginTop: -30,
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
    </SafeAreaView>
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
    justifyContent: "flex-end",
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    overflow: "hidden",
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
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
