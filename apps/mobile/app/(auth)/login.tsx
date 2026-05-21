import { useState } from "react";
import { View, Text, ScrollView, KeyboardAvoidingView, Platform, Alert } from "react-native";
import { Link, router } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/auth";
import { FormField } from "../../components/ui/FormField";
import { Button } from "../../components/ui/Button";
import type { PublicUser, ApiResponse, AuthResponse } from "@zika/types";

interface FieldErrors {
  email?: string;
  password?: string;
  general?: string;
}

export default function LoginScreen() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [errors, setErrors] = useState<FieldErrors>({});
  const setAuth = useAuthStore((s) => s.setAuth);

  const set = (key: keyof typeof form) => (val: string) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  const loginMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post<ApiResponse<AuthResponse>>("/auth/login", form);
      if (!res.data.success) throw res.data;
      return res.data.data;
    },
    onSuccess: async (data) => {
      await setAuth(data.user, data.tokens.accessToken);
      router.replace("/(tabs)");
    },
    onError: (err: unknown) => {
      const data = (err as { response?: { data?: ApiResponse<unknown> } }).response?.data;
      if (data && !data.success) {
        if (data.error.code === "EMAIL_NOT_VERIFIED") {
          router.push({ pathname: "/(auth)/verify-pending", params: { email: form.email } });
          return;
        }
        setErrors({ general: data.error.message });
      } else {
        setErrors({ general: "Unable to connect. Please check your network and try again." });
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
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 24, paddingTop: 80 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo / brand */}
        <Text className="text-4xl font-bold text-primary mb-1">ZikaBooking</Text>
        <Text className="text-base text-gray-500 mb-8">Sign in to your account</Text>

        <FormField
          label="Email address"
          value={form.email}
          onChangeText={(v) => { set("email")(v); setErrors({}); }}
          error={errors.email}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoComplete="email"
          returnKeyType="next"
        />

        <FormField
          label="Password"
          value={form.password}
          onChangeText={(v) => { set("password")(v); setErrors({}); }}
          error={errors.password}
          placeholder="Your password"
          secureTextEntry
          returnKeyType="done"
          onSubmitEditing={handleSubmit}
        />

        {/* Forgot password */}
        <Link href="/(auth)/forgot-password" className="text-primary text-sm mb-6 text-right">
          Forgot password?
        </Link>

        {errors.general ? (
          <View className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4">
            <Text className="text-red-600 text-sm">{errors.general}</Text>
          </View>
        ) : null}

        <Button title="Sign In" onPress={handleSubmit} loading={loginMutation.isPending} />

        {/* Divider */}
        <View className="flex-row items-center my-6">
          <View className="flex-1 h-px bg-gray-200" />
          <Text className="mx-4 text-gray-400 text-sm">or</Text>
          <View className="flex-1 h-px bg-gray-200" />
        </View>

        {/* OAuth */}
        <GoogleSignInButton />
        {Platform.OS === "ios" && <View className="mt-3"><AppleSignInButton /></View>}

        <View className="flex-row justify-center mt-8 mb-8">
          <Text className="text-gray-500">Don't have an account? </Text>
          <Link href="/(auth)/register" className="text-primary font-semibold">Create one</Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

let _GoogleSignin: typeof import("@react-native-google-signin/google-signin")["GoogleSignin"] | null = null;
try { _GoogleSignin = require("@react-native-google-signin/google-signin").GoogleSignin; } catch { /* not available in Expo Go */ }

function GoogleSignInButton() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const GoogleSignin = _GoogleSignin;

  const mutation = useMutation({
    mutationFn: async () => {
      if (!GoogleSignin) {
        // Simulated login for testing purposes in Expo Go / Development
        const res = await api.post<ApiResponse<AuthResponse>>("/auth/login", {
          email: "test@zika.com",
          password: "ZikaTest123!",
        });
        if (!res.data.success) throw res.data;
        return res.data.data;
      }
      await GoogleSignin.hasPlayServices();
      const signInResult = await GoogleSignin.signIn();
      const idToken = (signInResult as any).data?.idToken ?? (signInResult as any).idToken;
      if (!idToken) throw new Error("No ID token");
      const res = await api.post("/auth/oauth/google", { idToken });
      return (res.data as { data: AuthResponse }).data;
    },
    onSuccess: async (data) => {
      if (!GoogleSignin) {
        Alert.alert("Google Sign-In", "Google Sign-In is simulated in Expo Go. Signed in successfully as test@zika.com.");
      }
      await setAuth(data.user, data.tokens.accessToken);
      router.replace("/(tabs)");
    },
    onError: () => Alert.alert("Error", "Sign in with Google failed. Please try again."),
  });

  return <Button title="Continue with Google" variant="secondary" onPress={() => mutation.mutate()} loading={mutation.isPending} />;
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
      buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
      cornerRadius={10}
      style={{ height: 52 }}
      onPress={() => mutation.mutate()}
    />
  );
}
