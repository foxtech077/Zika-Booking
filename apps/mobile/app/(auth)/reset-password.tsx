import { useState } from "react";
import { View, Text, KeyboardAvoidingView, Platform, ScrollView, Alert } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/auth";
import { FormField } from "../../components/ui/FormField";
import { Button } from "../../components/ui/Button";
import { handleRoleAndStatusRedirect } from "./login";
import type { ApiResponse, AuthResponse } from "@zika/types";

export default function ResetPasswordScreen() {
  // Token comes from deep link: zikabooking://reset-password?token=...
  const { token } = useLocalSearchParams<{ token?: string }>();
  const [form, setForm] = useState({ password: "", confirmPassword: "" });
  const [errors, setErrors] = useState<{ password?: string; confirmPassword?: string; general?: string }>({});
  const setAuth = useAuthStore((s) => s.setAuth);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!token) throw new Error("Missing token");
      const res = await api.post<ApiResponse<AuthResponse & { message: string }>>("/auth/reset-password", {
        token, password: form.password, confirmPassword: form.confirmPassword,
      });
      if (!res.data.success) throw res.data;
      return res.data.data;
    },
    onSuccess: async (data) => {
      await setAuth(data.user, data.tokens.accessToken);
      Alert.alert("Success", "Your password has been updated. You're now signed in.");
      handleRoleAndStatusRedirect(data.user);
    },
    onError: (err: unknown) => {
      const data = (err as { error?: { code?: string; message?: string; fields?: Record<string, string> } }).error;
      if (data?.code === "TOKEN_EXPIRED") {
        setErrors({ general: "This password reset link has expired. Please request a new one." });
      } else if (data?.code === "TOKEN_USED") {
        setErrors({ general: "This reset link has already been used. Please request a new one." });
      } else if (data?.fields) {
        setErrors(data.fields as typeof errors);
      } else {
        setErrors({ general: data?.message ?? "Something went wrong. Please try again." });
      }
    },
  });

  function handleSubmit() {
    if (form.password.length < 8) { setErrors({ password: "Password must be at least 8 characters." }); return; }
    if (form.password !== form.confirmPassword) { setErrors({ confirmPassword: "Passwords do not match." }); return; }
    setErrors({});
    mutation.mutate();
  }

  if (!token) {
    return (
      <View className="flex-1 bg-white items-center justify-center px-6">
        <Text className="text-xl font-bold text-gray-900 mb-2">Invalid link</Text>
        <Text className="text-gray-500 text-center">This password reset link is invalid. Please request a new one.</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView className="flex-1 bg-white" behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 80 }} keyboardShouldPersistTaps="handled">
        <Text className="text-3xl font-bold text-gray-900 mb-1">Set new password</Text>
        <Text className="text-base text-gray-500 mb-8">Choose a strong password for your account.</Text>

        <FormField label="New password" value={form.password}
          onChangeText={(v) => { setForm((p) => ({ ...p, password: v })); setErrors({}); }}
          error={errors.password} placeholder="Min. 8 characters" secureTextEntry />

        <FormField label="Confirm new password" value={form.confirmPassword}
          onChangeText={(v) => { setForm((p) => ({ ...p, confirmPassword: v })); setErrors({}); }}
          error={errors.confirmPassword} placeholder="Repeat password" secureTextEntry
          returnKeyType="done" onSubmitEditing={handleSubmit} />

        {errors.general ? (
          <View className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4">
            <Text className="text-red-600 text-sm">{errors.general}</Text>
          </View>
        ) : null}

        <Button title="Set new password" onPress={handleSubmit} loading={mutation.isPending} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
