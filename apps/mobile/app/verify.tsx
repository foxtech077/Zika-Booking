import { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from "react-native";
import { useLocalSearchParams, Link, router } from "expo-router";
import { api } from "../lib/api";
import { K } from "../constants/theme";

type State = "loading" | "success" | "expired" | "used" | "invalid" | "error";

function openDeepLink(path: string, token: string) {
  // Only runs on web — navigates to the custom URL scheme to open the native app
  if (typeof window !== "undefined") {
    (window as any).location.href = `zikabooking://${path}?token=${encodeURIComponent(token)}`;
  }
}

export default function VerifyEmailScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const [state, setState] = useState<State>(token ? "loading" : "invalid");

  useEffect(() => {
    if (!token) return;

    // On web: the email link opens localhost:3000/verify?token=...
    // Redirect straight to the native app deep link — no API call needed here
    if (Platform.OS === "web") {
      openDeepLink("verify", token);
      return;
    }

    api
      .get("/auth/verify", { params: { token } })
      .then(() => setState("success"))
      .catch((err: unknown) => {
        const code: string =
          (err as any)?.response?.data?.error?.code ?? "";
        if (code === "TOKEN_EXPIRED") setState("expired");
        else if (code === "TOKEN_USED" || code === "ALREADY_VERIFIED")
          setState("used");
        else if (code === "INVALID_TOKEN") setState("invalid");
        else setState("error");
      });
  }, [token]);

  // Web UI: shows while the browser hands off to the native app
  if (Platform.OS === "web") {
    return (
      <View style={styles.container}>
        <View style={styles.box}>
          {token ? (
            <>
              <ActivityIndicator size="large" color={K.colors.accent} style={styles.icon} />
              <Text style={styles.title}>Opening ZikaBooking…</Text>
              <Text style={styles.sub}>
                The app should open automatically.{"\n"}
                If it doesn't, tap the button below.
              </Text>
              <TouchableOpacity
                style={styles.btn}
                onPress={() => openDeepLink("verify", token)}
              >
                <Text style={styles.btnText}>Open in App</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.emoji}>❌</Text>
              <Text style={styles.title}>Invalid link</Text>
              <Text style={styles.sub}>
                This verification link is invalid.
              </Text>
            </>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.box}>
        {state === "loading" && (
          <>
            <ActivityIndicator size="large" color={K.colors.accent} style={styles.icon} />
            <Text style={styles.title}>Verifying your email…</Text>
            <Text style={styles.sub}>Please wait a moment.</Text>
          </>
        )}

        {state === "success" && (
          <>
            <Text style={styles.emoji}>✅</Text>
            <Text style={styles.title}>Email verified!</Text>
            <Text style={styles.sub}>
              Your account is now active. Sign in to get started.
            </Text>
            <TouchableOpacity
              style={styles.btn}
              onPress={() => router.replace("/(auth)/login")}
            >
              <Text style={styles.btnText}>Sign In</Text>
            </TouchableOpacity>
          </>
        )}

        {state === "expired" && (
          <>
            <Text style={styles.emoji}>⏱️</Text>
            <Text style={styles.title}>Link expired</Text>
            <Text style={styles.sub}>
              This verification link has expired. Request a new one from the
              login screen.
            </Text>
            <Link href="/(auth)/login" asChild>
              <TouchableOpacity style={styles.btn}>
                <Text style={styles.btnText}>Back to Sign In</Text>
              </TouchableOpacity>
            </Link>
          </>
        )}

        {state === "used" && (
          <>
            <Text style={styles.emoji}>✅</Text>
            <Text style={styles.title}>Already verified</Text>
            <Text style={styles.sub}>
              Your email is already verified. Sign in to continue.
            </Text>
            <Link href="/(auth)/login" asChild>
              <TouchableOpacity style={styles.btn}>
                <Text style={styles.btnText}>Sign In</Text>
              </TouchableOpacity>
            </Link>
          </>
        )}

        {(state === "invalid" || state === "error") && (
          <>
            <Text style={styles.emoji}>❌</Text>
            <Text style={styles.title}>
              {state === "invalid" ? "Invalid link" : "Something went wrong"}
            </Text>
            <Text style={styles.sub}>
              {state === "invalid"
                ? "This verification link is invalid. Please check your email or request a new link."
                : "We couldn't verify your email right now. Please try again later."}
            </Text>
            <Link href="/(auth)/login" asChild>
              <TouchableOpacity style={styles.btn}>
                <Text style={styles.btnText}>Back to Sign In</Text>
              </TouchableOpacity>
            </Link>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: K.colors.darkGreen,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  box: {
    width: "100%",
    alignItems: "center",
  },
  icon: { marginBottom: 24 },
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
    paddingHorizontal: 40,
  },
  btnText: {
    color: "#fff",
    fontSize: K.font.base,
    fontWeight: "700",
  },
});
