/**
 * One-time consent gate.
 *
 * Collects the Privacy Policy acceptance the client requires at registration,
 * for accounts that never saw a consent checkbox — principally Google sign-in,
 * whose button appears on both the login and register screens, so a brand-new
 * user can be created from either. Also shown after a policy version bump.
 *
 * The Terms & Conditions are NOT collected here — per the client's spec they
 * are accepted at payment, on the pay screen.
 *
 * Offers no way past it other than accepting or signing out.
 */

import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useMutation } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { useAuthStore } from "../../store/auth";
import { K } from "../../constants/theme";
import type { ApiResponse, PublicUser } from "@zika/types";
import { handleRoleAndStatusRedirect } from "./login";

export default function AcceptTermsScreen() {
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const clearAuth = useAuthStore((s) => s.clearAuth);

  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await api.post<ApiResponse<{ user: PublicUser; acceptedAt: string }>>(
        "auth/accept-terms",
        { acceptedPrivacy: true }
      );
      if (!res.data.success) throw res.data;
      return (res.data as { success: true; data: { user: PublicUser; acceptedAt: string } }).data;
    },
    onSuccess: async (data) => {
      await updateUser({ ...(data.user as Partial<PublicUser>) });
      // Re-run the normal post-auth routing now that the gate is satisfied.
      handleRoleAndStatusRedirect({ ...(user as PublicUser), ...(data.user as PublicUser) });
    },
    onError: (err: any) => {
      setError(
        err?.response?.data?.error?.message ??
          "Could not save your acceptance. Please check your connection and try again."
      );
    },
  });

  function handleContinue() {
    if (!agreedToPrivacy) {
      setError("Please accept the Privacy Policy to continue.");
      return;
    }
    setError(null);
    mutation.mutate();
  }

  async function handleSignOut() {
    await clearAuth();
    router.replace("/(auth)/login");
  }

  const canContinue = agreedToPrivacy && !mutation.isPending;

  return (
    <SafeAreaView style={s.container} edges={["top", "bottom"]}>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: false }} />
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.iconWrap}>
          <Ionicons name="shield-checkmark-outline" size={30} color={K.colors.accent} />
        </View>

        <Text style={s.title}>Before you continue</Text>
        <Text style={s.subtitle}>
          {user?.firstName ? `${user.firstName}, please` : "Please"} review and accept our Privacy
          Policy to continue. We only need this once.
        </Text>

        <View style={s.block}>
          <TouchableOpacity
            style={s.row}
            onPress={() => {
              setAgreedToPrivacy((p) => !p);
              setError(null);
            }}
            activeOpacity={0.8}
          >
            <View style={[s.checkbox, agreedToPrivacy && s.checkboxChecked]}>
              {agreedToPrivacy && <Ionicons name="checkmark" size={13} color="#fff" />}
            </View>
            <Text style={s.rowText}>
              I have read and agree to the{" "}
              <Text
                style={s.link}
                onPress={() => router.push({ pathname: "/legal/[doc]", params: { doc: "privacy" } } as any)}
              >
                Privacy Policy
              </Text>
              .
            </Text>
          </TouchableOpacity>
        </View>

        {error && (
          <View style={s.errBox}>
            <Ionicons name="alert-circle-outline" size={15} color="#DC2626" />
            <Text style={s.errText}>{error}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[s.primaryBtn, !canContinue && s.primaryBtnDim]}
          onPress={handleContinue}
          disabled={!canContinue}
          activeOpacity={0.85}
        >
          {mutation.isPending ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={s.primaryBtnText}>Accept and continue</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={s.secondaryBtn} onPress={handleSignOut} activeOpacity={0.85}>
          <Text style={s.secondaryBtnText}>Sign out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  scroll: { padding: 24, paddingTop: 40 },
  iconWrap: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: K.colors.accentDim,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  title: { fontSize: 22, fontWeight: "800", color: K.colors.textDark },
  subtitle: { marginTop: 8, fontSize: 14, color: K.colors.textMuted, lineHeight: 21 },
  block: { marginTop: 28, gap: 16 },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  checkboxChecked: { backgroundColor: K.colors.accent, borderColor: K.colors.accent },
  rowText: { flex: 1, fontSize: 14, color: K.colors.textMid, lineHeight: 20 },
  link: { fontWeight: "700", color: K.colors.accent, textDecorationLine: "underline" },
  errBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEF2F2",
    borderWidth: 1.5,
    borderColor: "#FECACA",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 20,
  },
  errText: { flex: 1, color: "#DC2626", fontSize: 13, lineHeight: 18 },
  primaryBtn: {
    marginTop: 28,
    height: 52,
    borderRadius: 14,
    backgroundColor: K.colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnDim: { opacity: 0.5 },
  primaryBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  secondaryBtn: {
    marginTop: 12,
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtnText: { color: K.colors.textMuted, fontSize: 15, fontWeight: "700" },
});
