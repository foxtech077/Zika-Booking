import { useState } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform, Alert,
} from "react-native";
import { Link, router } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { registerSchema } from "@zika/validators";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/auth";
import { FormField } from "../../components/ui/FormField";
import { Button } from "../../components/ui/Button";
import type { ApiResponse, PublicUser } from "@zika/types";

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

export default function RegisterScreen() {
  const setAuth = useAuthStore((s) => s.setAuth);
  const [userType, setUserType] = useState<UserType>("guest");
  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "",
    password: "", confirmPassword: "",
    businessName: "", country: "",
  });
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
        businessName: userType === "provider" ? form.businessName : undefined,
        country: userType === "provider" ? form.country || undefined : undefined,
      };
      const res = await api.post<ApiResponse<{ message?: string; user?: PublicUser; tokens?: { accessToken: string } }>>("/auth/register", payload);
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
      const data = (err as { response?: { data?: ApiResponse<unknown> } }).response?.data;
      if (data && !data.success) {
        const fields = data.error.fields ?? {};
        setErrors({ ...fields, general: data.error.fields ? undefined : data.error.message });
      } else {
        setErrors({ general: "Something went wrong. Please check your connection and try again." });
      }
    },
  });

  function validate(): boolean {
    const payload = {
      ...form,
      userType,
      businessName: userType === "provider" ? form.businessName : undefined,
      country: userType === "provider" ? form.country || undefined : undefined,
    };
    const result = registerSchema.safeParse(payload);
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

  if (submitted) {
    return (
      <View className="flex-1 bg-white items-center justify-center px-6">
        <Text className="text-3xl mb-4">✉️</Text>
        <Text className="text-2xl font-bold text-gray-900 text-center mb-2">Check your email</Text>
        <Text className="text-base text-gray-500 text-center mb-6">
          We've sent a verification link to{"\n"}
          <Text className="font-semibold text-gray-800">{form.email}</Text>
        </Text>
        <Button
          title="Resend email"
          variant="ghost"
          onPress={() => router.push({ pathname: "/(auth)/resend-verification" as any, params: { email: form.email } })}
        />
        <Link href="/(auth)/login" className="mt-4 text-primary font-semibold text-base text-center">
          Back to Sign In
        </Link>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 24, paddingTop: 60 }} keyboardShouldPersistTaps="handled">
        {/* Header */}
        <Text className="text-3xl font-bold text-gray-900 mb-1">Create account</Text>
        <Text className="text-base text-gray-500 mb-6">Join ZikaBooking and start exploring.</Text>

        {/* Account type selector */}
        <View className="flex-row mb-6 rounded-xl overflow-hidden border border-gray-200">
          {(["guest", "provider"] as UserType[]).map((type) => (
            <TouchableOpacity
              key={type}
              className={`flex-1 py-3 items-center ${userType === type ? "bg-primary" : "bg-white"}`}
              onPress={() => { setUserType(type); setErrors({}); }}
            >
              <Text className={`font-semibold ${userType === type ? "text-white" : "text-gray-600"}`}>
                {type === "guest" ? "Traveller" : "Provider / Host"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Fields */}
        <View className="flex-row gap-3">
          <View className="flex-1">
            <FormField label="First name" value={form.firstName} onChangeText={(v) => { set("firstName")(v); clearError("firstName"); }}
              error={errors.firstName} placeholder="Ada" />
          </View>
          <View className="flex-1">
            <FormField label="Last name" value={form.lastName} onChangeText={(v) => { set("lastName")(v); clearError("lastName"); }}
              error={errors.lastName} placeholder="Okafor" />
          </View>
        </View>

        <FormField label="Email address" value={form.email} onChangeText={(v) => { set("email")(v); clearError("email"); }}
          error={errors.email} placeholder="you@example.com" keyboardType="email-address" autoComplete="email" />

        {userType === "provider" && (
          <>
            <FormField label="Business name" value={form.businessName} onChangeText={(v) => { set("businessName")(v); clearError("businessName"); }}
              error={errors.businessName} placeholder="Serena Hotels Ltd." />
            <FormField label="Country (ISO code, e.g. KE)" value={form.country} onChangeText={(v) => { set("country")(v.toUpperCase()); clearError("country"); }}
              error={errors.country} placeholder="KE" maxLength={2} autoCapitalize="characters" />
          </>
        )}

        <FormField label="Password" value={form.password} onChangeText={(v) => { set("password")(v); clearError("password"); }}
          error={errors.password} placeholder="Min. 8 characters" secureTextEntry />

        <FormField label="Confirm password" value={form.confirmPassword}
          onChangeText={(v) => { set("confirmPassword")(v); clearError("confirmPassword"); }}
          error={errors.confirmPassword} placeholder="Repeat password" secureTextEntry />

        {errors.general ? (
          <View className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4">
            <Text className="text-red-600 text-sm">{errors.general}</Text>
          </View>
        ) : null}

        <Button title="Create Account" onPress={handleSubmit} loading={registerMutation.isPending} />

        {/* Divider + OAuth */}
        <View className="flex-row items-center my-6">
          <View className="flex-1 h-px bg-gray-200" />
          <Text className="mx-4 text-gray-400 text-sm">or continue with</Text>
          <View className="flex-1 h-px bg-gray-200" />
        </View>

        <OAuthButtons />

        <View className="flex-row justify-center mt-6 mb-8">
          <Text className="text-gray-500">Already have an account? </Text>
          <Link href="/(auth)/login" className="text-primary font-semibold">Sign In</Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function OAuthButtons() {
  return (
    <View className="gap-3">
      <GoogleSignInButton />
      {Platform.OS === "ios" && <AppleSignInButton />}
    </View>
  );
}

let _GoogleSignin: typeof import("@react-native-google-signin/google-signin")["GoogleSignin"] | null = null;
try { _GoogleSignin = require("@react-native-google-signin/google-signin").GoogleSignin; } catch { /* not available in Expo Go */ }

function GoogleSignInButton() {
  const { useAuthStore } = require("../../store/auth") as typeof import("../../store/auth");
  const setAuth = useAuthStore((s) => s.setAuth);
  const GoogleSignin = _GoogleSignin;

  const mutation = useMutation({
    mutationFn: async () => {
      if (!GoogleSignin) throw new Error("Google Sign-In not available.");
      await GoogleSignin.hasPlayServices();
      const signInResult = await GoogleSignin.signIn();
      const idToken = (signInResult as any).data?.idToken ?? (signInResult as any).idToken;
      if (!idToken) throw new Error("No ID token");
      const res = await api.post("/auth/oauth/google", { idToken });
      return (res.data as { data: { user: Parameters<typeof setAuth>[0]; tokens: { accessToken: string } } }).data;
    },
    onSuccess: async (data) => {
      await setAuth(data.user, data.tokens.accessToken);
      router.replace("/(tabs)");
    },
    onError: () => Alert.alert("Error", "Sign in with Google failed. Please try again."),
  });

  if (!GoogleSignin) return null;
  return (
    <Button title="Continue with Google" variant="secondary"
      onPress={() => mutation.mutate()} loading={mutation.isPending} />
  );
}

function AppleSignInButton() {
  const AppleAuthentication = require("expo-apple-authentication") as typeof import("expo-apple-authentication");
  const { useAuthStore } = require("../../store/auth") as typeof import("../../store/auth");
  const setAuth = useAuthStore((s) => s.setAuth);

  const mutation = useMutation({
    mutationFn: async () => {
      const cred = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });
      const res = await api.post("/auth/oauth/apple", {
        authorizationCode: cred.authorizationCode,
        identityToken: cred.identityToken,
      });
      return (res.data as { data: { user: Parameters<typeof setAuth>[0]; tokens: { accessToken: string } } }).data;
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
