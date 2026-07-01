import { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  AppState,
  AppStateStatus,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Linking from "expo-linking";
import { paymentApi } from "../../lib/payment-api";

// ── Types ─────────────────────────────────────────────────────────────────────

interface MerchantProfile {
  id: string;
  businessName?: string;
  payoutMethod?: "stripe_connect" | "mobile_money" | "bank_transfer" | null;
  stripeConnectAccountId?: string | null;
  country?: string;
}

interface StripeConnectInitResponse {
  onboardingUrl: string;
  accountId?: string;
}

interface StripeConnectStatusResponse {
  connected: boolean;
  payoutMethod?: string;
  stripeConnectAccountId?: string;
}

// ── Query Keys ────────────────────────────────────────────────────────────────

const MERCHANT_QK = {
  profile: ["merchant", "profile"] as const,
  stripeStatus: ["merchant", "stripe", "status"] as const,
};

// ── API calls ─────────────────────────────────────────────────────────────────

async function fetchMerchantProfile(): Promise<MerchantProfile> {
  const { data } = await paymentApi.get("/merchant/me");
  // Handle both { ...profile } and { data: { ...profile } }
  return data?.data ?? data;
}

function extractOnboardingUrl(raw: any): string | undefined {
  // Try every field name / nesting the backend might use
  return (
    raw?.onboardingUrl     ??
    raw?.data?.onboardingUrl ??
    raw?.url               ??
    raw?.data?.url         ??
    raw?.accountLinkUrl    ??
    raw?.data?.accountLinkUrl ??
    raw?.link              ??
    raw?.data?.link        ??
    raw?.onboarding_url    ??
    raw?.data?.onboarding_url
  );
}

async function initiateStripeConnect(): Promise<StripeConnectInitResponse> {
  const { data } = await paymentApi.post("/merchant/me/stripe/connect");
  const url = extractOnboardingUrl(data);
  if (!url) {
    console.warn("[STRIPE-CONNECT] POST response shape:", JSON.stringify(data, null, 2));
    throw new Error("Onboarding URL not found in server response.");
  }
  return { onboardingUrl: url, accountId: data?.accountId ?? data?.data?.accountId };
}

async function refreshStripeLink(): Promise<StripeConnectInitResponse> {
  const { data } = await paymentApi.get("/merchant/me/stripe/connect/refresh");
  const url = extractOnboardingUrl(data);
  if (!url) {
    console.warn("[STRIPE-CONNECT] REFRESH response shape:", JSON.stringify(data, null, 2));
    throw new Error("Refresh URL not found in server response.");
  }
  return { onboardingUrl: url, accountId: data?.accountId ?? data?.data?.accountId };
}

async function fetchStripeStatus(): Promise<StripeConnectStatusResponse> {
  const { data } = await paymentApi.get("/merchant/me/stripe/connect/status");
  // Handle both flat and nested response
  const payload = data?.data ?? data;
  return {
    connected:              payload?.connected              ?? false,
    payoutMethod:           payload?.payoutMethod           ?? payload?.payout_method,
    stripeConnectAccountId: payload?.stripeConnectAccountId ?? payload?.stripe_connect_account_id,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

type ConnectState = "idle" | "not_started" | "in_progress" | "connected";

function deriveState(profile: MerchantProfile | undefined): ConnectState {
  if (!profile) return "idle";
  if (profile.payoutMethod === "stripe_connect") return "connected";
  if (profile.stripeConnectAccountId) return "in_progress";
  return "not_started";
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function StripeConnectScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const urlOpenedRef = useRef(false);
  const [statusChecking, setStatusChecking] = useState(false);

  const {
    data: profile,
    isLoading: profileLoading,
    isError: profileError,
    refetch: refetchProfile,
  } = useQuery({
    queryKey: MERCHANT_QK.profile,
    queryFn: fetchMerchantProfile,
  });

  const connectMutation = useMutation({
    mutationFn: initiateStripeConnect,
    onSuccess: (res) => {
      urlOpenedRef.current = true;
      void Linking.openURL(res.onboardingUrl);
      void refetchProfile();
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.message ??
        err?.message ??
        "Could not start Stripe onboarding. Please try again.";
      Alert.alert("Error", msg);
    },
  });

  const refreshMutation = useMutation({
    mutationFn: refreshStripeLink,
    onSuccess: (res) => {
      urlOpenedRef.current = true;
      void Linking.openURL(res.onboardingUrl);
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.message ??
        err?.message ??
        "Could not refresh the onboarding link. Please try again.";
      Alert.alert("Error", msg);
    },
  });

  const checkStatus = useCallback(async () => {
    setStatusChecking(true);
    try {
      const status = await fetchStripeStatus();
      if (status.connected) {
        await queryClient.invalidateQueries({ queryKey: MERCHANT_QK.profile });
        await queryClient.invalidateQueries({ queryKey: MERCHANT_QK.stripeStatus });
        await refetchProfile();
      } else {
        Alert.alert(
          "Not Yet Connected",
          "Your Stripe account setup appears to still be in progress. Please complete all steps in the onboarding form.",
          [{ text: "OK" }]
        );
      }
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ??
        err?.message ??
        "Could not check connection status. Please try again.";
      Alert.alert("Error", msg);
    } finally {
      setStatusChecking(false);
    }
  }, [queryClient, refetchProfile]);

  // Auto-check status when user returns to app after opening Stripe URL
  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState: AppStateStatus) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextState === "active" &&
        urlOpenedRef.current
      ) {
        urlOpenedRef.current = false;
        void checkStatus();
      }
      appStateRef.current = nextState;
    });
    return () => sub.remove();
  }, [checkStatus]);

  const connectState = deriveState(profile);
  const anyLoading =
    connectMutation.isPending || refreshMutation.isPending || statusChecking;

  // ── Render states ─────────────────────────────────────────────────────────

  if (profileLoading) {
    return (
      <SafeAreaView style={s.container}>
        <Header onBack={() => router.back()} />
        <View style={s.centered}>
          <ActivityIndicator size="large" color="#024622" />
          <Text style={s.loadingText}>Loading payout details…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (profileError) {
    return (
      <SafeAreaView style={s.container}>
        <Header onBack={() => router.back()} />
        <View style={s.centered}>
          <Ionicons name="cloud-offline-outline" size={56} color="#d1d5db" />
          <Text style={s.errTitle}>Could not load payout details</Text>
          <Text style={s.errBody}>Check your connection and try again.</Text>
          <TouchableOpacity style={s.retryBtn} onPress={() => void refetchProfile()}>
            <Text style={s.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      <Header onBack={() => router.back()} />
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Status Banner */}
        <StatusBanner state={connectState} />

        {/* Stripe Connect Card */}
        <View style={s.card}>
          <View style={s.stripeLogoRow}>
            <View style={s.stripePill}>
              <Text style={s.stripePillText}>stripe</Text>
            </View>
            <Text style={s.stripeCardTitle}>Stripe Connect</Text>
          </View>

          {connectState === "connected" && (
            <>
              <View style={s.connectedRow}>
                <Ionicons name="checkmark-circle" size={22} color="#16a34a" />
                <Text style={s.connectedText}>Your Stripe account is connected</Text>
              </View>
              <Text style={s.connectedSub}>
                Payouts from your bookings will be sent directly to your Stripe
                account on a rolling basis after each completed stay.
              </Text>
              <TouchableOpacity
                style={[s.outlineBtn, anyLoading && s.btnDisabled]}
                onPress={() => void checkStatus()}
                disabled={anyLoading}
                activeOpacity={0.8}
              >
                {statusChecking ? (
                  <ActivityIndicator size="small" color="#024622" />
                ) : (
                  <>
                    <Ionicons name="refresh-outline" size={16} color="#024622" />
                    <Text style={s.outlineBtnText}>Refresh Status</Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          )}

          {connectState === "not_started" && (
            <>
              <Text style={s.cardBody}>
                Connect your Stripe account to receive automatic payouts when
                guests complete their stays. Setup takes about 5 minutes.
              </Text>
              <BulletPoint icon="flash-outline" text="Instant setup via Stripe's secure onboarding" />
              <BulletPoint icon="shield-checkmark-outline" text="Bank-level security for your payout details" />
              <BulletPoint icon="cash-outline" text="Automatic payouts after each completed booking" />
              <TouchableOpacity
                style={[s.primaryBtn, anyLoading && s.btnDisabled]}
                onPress={() => connectMutation.mutate()}
                disabled={anyLoading}
                activeOpacity={0.85}
              >
                {connectMutation.isPending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="link-outline" size={18} color="#fff" style={s.btnIcon} />
                    <Text style={s.primaryBtnText}>Connect with Stripe</Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          )}

          {connectState === "in_progress" && (
            <>
              <View style={s.inProgressBanner}>
                <Ionicons name="time-outline" size={18} color="#b45309" />
                <Text style={s.inProgressText}>
                  Onboarding started but not yet complete
                </Text>
              </View>
              <Text style={s.cardBody}>
                You've started the Stripe onboarding process but haven't finished
                all the required steps. Resume setup to activate your payouts.
              </Text>
              <TouchableOpacity
                style={[s.primaryBtn, anyLoading && s.btnDisabled]}
                onPress={() => refreshMutation.mutate()}
                disabled={anyLoading}
                activeOpacity={0.85}
              >
                {refreshMutation.isPending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="arrow-forward-circle-outline" size={18} color="#fff" style={s.btnIcon} />
                    <Text style={s.primaryBtnText}>Resume Setup</Text>
                  </>
                )}
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.outlineBtn, { marginTop: 10 }, anyLoading && s.btnDisabled]}
                onPress={() => void checkStatus()}
                disabled={anyLoading}
                activeOpacity={0.8}
              >
                {statusChecking ? (
                  <ActivityIndicator size="small" color="#024622" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={16} color="#024622" />
                    <Text style={s.outlineBtnText}>I've finished — Check Status</Text>
                  </>
                )}
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Info Section */}
        <View style={s.infoCard}>
          <Text style={s.infoHeading}>How payouts work</Text>
          <InfoRow
            icon="calendar-outline"
            title="After each booking"
            body="Funds are released once the guest checks out and the stay is confirmed."
          />
          <InfoRow
            icon="time-outline"
            title="Processing time"
            body="Stripe typically transfers funds within 2–7 business days, depending on your country."
          />
          <InfoRow
            icon="shield-outline"
            title="Secure & encrypted"
            body="All payout data is handled by Stripe — we never store your bank details."
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Header({ onBack }: { onBack: () => void }) {
  return (
    <View style={s.header}>
      <TouchableOpacity style={s.backBtn} onPress={onBack} activeOpacity={0.7}>
        <Ionicons name="chevron-back" size={24} color="#fff" />
      </TouchableOpacity>
      <Text style={s.headerTitle}>Payout Setup</Text>
      <View style={{ width: 40 }} />
    </View>
  );
}

function StatusBanner({ state }: { state: ConnectState }) {
  if (state === "idle") return null;

  const config = {
    not_started: {
      bg: "#fffbeb",
      border: "#fde68a",
      icon: "warning-outline" as const,
      iconColor: "#d97706",
      text: "No payout method set up. Connect Stripe to receive payments.",
    },
    in_progress: {
      bg: "#fffbeb",
      border: "#fde68a",
      icon: "time-outline" as const,
      iconColor: "#d97706",
      text: "Stripe onboarding in progress. Complete setup to activate payouts.",
    },
    connected: {
      bg: "#f0fdf4",
      border: "#86efac",
      icon: "checkmark-circle-outline" as const,
      iconColor: "#16a34a",
      text: "Stripe Connect is active. You are set up to receive payouts.",
    },
  }[state];

  return (
    <View style={[s.statusBanner, { backgroundColor: config.bg, borderColor: config.border }]}>
      <Ionicons name={config.icon} size={18} color={config.iconColor} />
      <Text style={[s.statusBannerText, { color: config.iconColor }]}>{config.text}</Text>
    </View>
  );
}

function BulletPoint({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={s.bullet}>
      <Ionicons name={icon as any} size={16} color="#024622" />
      <Text style={s.bulletText}>{text}</Text>
    </View>
  );
}

function InfoRow({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <View style={s.infoRow}>
      <View style={s.infoIconWrap}>
        <Ionicons name={icon as any} size={18} color="#024622" />
      </View>
      <View style={s.infoRowText}>
        <Text style={s.infoRowTitle}>{title}</Text>
        <Text style={s.infoRowBody}>{body}</Text>
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f3f4f6" },
  centered:  { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 },
  scroll:    { padding: 16, paddingBottom: 48 },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#024622",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backBtn:     { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontWeight: "700", color: "#fff" },

  // Status banner
  statusBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
  },
  statusBannerText: { flex: 1, fontSize: 13, fontWeight: "500", lineHeight: 18 },

  // Card
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: 16,
  },
  stripeLogoRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  stripePill: {
    backgroundColor: "#635bff",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  stripePillText:  { color: "#fff", fontWeight: "800", fontSize: 14, letterSpacing: -0.5 },
  stripeCardTitle: { fontSize: 17, fontWeight: "700", color: "#111827" },

  cardBody: {
    fontSize: 14,
    color: "#6b7280",
    lineHeight: 20,
    marginBottom: 16,
  },

  // Connected state
  connectedRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  connectedText: { fontSize: 15, fontWeight: "700", color: "#111827" },
  connectedSub:  { fontSize: 13, color: "#6b7280", lineHeight: 18, marginBottom: 16 },

  // In-progress banner
  inProgressBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fffbeb",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#fde68a",
  },
  inProgressText: { fontSize: 13, fontWeight: "600", color: "#b45309" },

  // Bullets
  bullet:     { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 10 },
  bulletText: { flex: 1, fontSize: 13, color: "#374151", lineHeight: 18 },

  // Buttons
  primaryBtn: {
    flexDirection: "row",
    backgroundColor: "#024622",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  btnIcon: { marginRight: 8 },
  btnDisabled: { opacity: 0.6 },

  outlineBtn: {
    flexDirection: "row",
    borderWidth: 1.5,
    borderColor: "#024622",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  outlineBtnText: { color: "#024622", fontWeight: "700", fontSize: 14 },

  retryBtn:     { backgroundColor: "#024622", borderRadius: 10, paddingHorizontal: 24, paddingVertical: 12 },
  retryBtnText: { color: "#fff", fontWeight: "700" },

  // Loading / Error
  loadingText: { marginTop: 12, fontSize: 14, color: "#6b7280" },
  errTitle:    { fontSize: 18, fontWeight: "700", color: "#374151", textAlign: "center" },
  errBody:     { fontSize: 13, color: "#9ca3af", textAlign: "center" },

  // Info card
  infoCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  infoHeading: { fontSize: 15, fontWeight: "700", color: "#111827", marginBottom: 14 },
  infoRow:     { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 14 },
  infoIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#f0fdf4",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  infoRowText:  { flex: 1 },
  infoRowTitle: { fontSize: 14, fontWeight: "600", color: "#111827", marginBottom: 2 },
  infoRowBody:  { fontSize: 12, color: "#6b7280", lineHeight: 17 },
});
