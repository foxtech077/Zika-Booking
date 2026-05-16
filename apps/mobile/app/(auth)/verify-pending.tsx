import { useState, useEffect } from "react";
import { View, Text, Alert } from "react-native";
import { useLocalSearchParams, Link } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { Button } from "../../components/ui/Button";

export default function VerifyPendingScreen() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const resendMutation = useMutation({
    mutationFn: async () => {
      await api.post("/auth/resend-verification", { email });
    },
    onSuccess: () => {
      setCooldown(60);
      Alert.alert("Sent!", "A new verification email has been sent. Please check your inbox.");
    },
    onError: (err: unknown) => {
      const data = (err as { response?: { data?: { error?: { code?: string } } } }).response?.data;
      if (data?.error?.code === "COOLDOWN") {
        setCooldown(60);
      } else if (data?.error?.code === "RATE_LIMITED") {
        Alert.alert("Limit reached", "You've requested the maximum number of verification emails. Please try again later or contact support.");
      } else {
        Alert.alert("Error", "Something went wrong. Please try again.");
      }
    },
  });

  return (
    <View className="flex-1 bg-white items-center justify-center px-6">
      <Text className="text-5xl mb-4">✉️</Text>
      <Text className="text-2xl font-bold text-gray-900 text-center mb-2">Verify your email</Text>
      <Text className="text-base text-gray-500 text-center mb-2">
        We sent a verification link to
      </Text>
      <Text className="text-base font-semibold text-gray-800 text-center mb-6">{email}</Text>
      <Text className="text-sm text-gray-400 text-center mb-8">
        Click the link in the email to activate your account. Check your spam folder if you don't see it.
      </Text>

      <Button
        title={cooldown > 0 ? `Resend in ${cooldown}s` : "Resend verification email"}
        variant="secondary"
        onPress={() => resendMutation.mutate()}
        loading={resendMutation.isPending}
        disabled={cooldown > 0}
      />

      <Link href="/(auth)/login" className="mt-6 text-primary font-semibold text-base text-center">
        Back to Sign In
      </Link>
    </View>
  );
}
