import { useState } from "react";
import { View, Text, KeyboardAvoidingView, Platform } from "react-native";
import { Link } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { FormField } from "../../components/ui/FormField";
import { Button } from "../../components/ui/Button";

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const mutation = useMutation({
    mutationFn: () => api.post("/auth/forgot-password", { email }),
    onSuccess: () => setSent(true),
    onError: () => setSent(true), // Always show success (BR: enumeration prevention)
  });

  if (sent) {
    return (
      <View className="flex-1 bg-white items-center justify-center px-6">
        <Text className="text-5xl mb-4">📧</Text>
        <Text className="text-2xl font-bold text-gray-900 text-center mb-2">Check your email</Text>
        <Text className="text-base text-gray-500 text-center mb-8">
          If an account with that email exists, we've sent a password reset link.
        </Text>
        <Link href="/(auth)/login" className="text-primary font-semibold text-base">
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
      <View className="flex-1 px-6 pt-20">
        <Text className="text-3xl font-bold text-gray-900 mb-1">Reset password</Text>
        <Text className="text-base text-gray-500 mb-8">
          Enter your email and we'll send you a reset link.
        </Text>

        <FormField
          label="Email address"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          keyboardType="email-address"
          autoComplete="email"
          returnKeyType="done"
          onSubmitEditing={() => mutation.mutate()}
        />

        <Button
          title="Send reset link"
          onPress={() => mutation.mutate()}
          loading={mutation.isPending}
          disabled={!email.includes("@")}
        />

        <Link href="/(auth)/login" className="text-primary font-semibold text-base text-center mt-6">
          Back to Sign In
        </Link>
      </View>
    </KeyboardAvoidingView>
  );
}
