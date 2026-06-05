import { useEffect, useState } from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Button } from "../components/ui/Button";

export default function VerifyScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");

  const verifyMutation = useMutation({
    mutationFn: async (verifyToken: string) => {
      const res = await api.get(`/auth/verify?token=${verifyToken}`);
      return res.data;
    },
    onSuccess: () => {
      setStatus("success");
    },
    onError: (err: any) => {
      setStatus("error");
      const msg = err.response?.data?.error?.message ?? "Invalid or expired verification link.";
      setErrorMessage(msg);
    },
  });

  useEffect(() => {
    if (token) {
      verifyMutation.mutate(token);
    } else {
      setStatus("error");
      setErrorMessage("No token provided in the URL.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <View className="flex-1 bg-white items-center justify-center px-6">
      {status === "loading" && (
        <>
          <ActivityIndicator size="large" color="#1a73e8" className="mb-4" />
          <Text className="text-xl font-semibold text-gray-900">Verifying your email...</Text>
        </>
      )}

      {status === "success" && (
        <>
          <Text className="text-5xl mb-4">✅</Text>
          <Text className="text-2xl font-bold text-green-600 mb-2 text-center">Email Verified!</Text>
          <Text className="text-base text-gray-500 mb-8 text-center">
            Your account has been successfully verified.
          </Text>
          <Button
            title="Continue to Login"
            onPress={() => router.replace("/(auth)/login")}
          />
        </>
      )}

      {status === "error" && (
        <>
          <Text className="text-5xl mb-4">❌</Text>
          <Text className="text-2xl font-bold text-red-600 mb-2 text-center">Verification Failed</Text>
          <Text className="text-base text-gray-500 mb-8 text-center">{errorMessage}</Text>
          <Button
            title="Go to Login"
            onPress={() => router.replace("/(auth)/login")}
          />
        </>
      )}
    </View>
  );
}
