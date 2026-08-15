import { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  AppState,
  AppStateStatus,
  Alert,
  Modal,
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Linking from "expo-linking";
import { TARA_COUNTRIES_LIST } from "@zika/types";
import { ALL_COUNTRIES } from "../../constants/countries";
import { paymentApi } from "../../lib/payment-api";
import { K } from "../../constants/theme";

// ── Types ─────────────────────────────────────────────────────────────────────

type PayoutMethod = "stripe_connect" | "mobile_money" | "bank_transfer" | "manual";

interface MerchantProfile {
  id: string;
  businessName?: string | null;
  payoutMethod?: PayoutMethod | null;
  stripeConnectAccountId?: string | null;
  mobileMoneyNumber?: string | null;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  bankAccountName?: string | null;
  country?: string | null;
  isVerified?: boolean;
}

interface StripeConnectInitResponse {
  onboardingUrl: string;
  accountId?: string;
}


interface StripeConnectStatusResponse {
  stripeAccountId?: string;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  onboardingComplete: boolean;
  payoutMethod?: string;
}


// Merchant.country feeds assertResourceCountryScope on the admin merchant
// routes, which compares it exactly against an ISO-3166-1 alpha-2 country
// scope. Free text like "Ghana" can never match "GH", so a country-scoped
// admin gets denied on that merchant. Legacy rows hold free text: map them to
// a code where possible, otherwise clear it so the provider picks a real one.
function toCountryCode(raw?: string | null): string {
  const value = (raw ?? "").trim();
  if (!value) return "";
  const upper = value.toUpperCase();
  if (ALL_COUNTRIES.some((c) => c.code === upper)) return upper;
  return ALL_COUNTRIES.find((c) => c.name.toLowerCase() === value.toLowerCase())?.code ?? "";
}

function validateMobileMoneyNumber(raw: string): { value: string } | { error: string } {
  const compact = raw.replace(/[\s\-()]/g, "");
  if (!/^\+[1-9]\d{6,14}$/.test(compact)) {
    return { error: "Enter the number in international format, including the country code — e.g. +237670000000." };
  }
  // Longest dial code first, so a country whose code prefixes another can't win.
  const match = TARA_COUNTRIES_LIST
    .filter((c) => compact.startsWith(c.dialCode))
    .sort((a, b) => b.dialCode.length - a.dialCode.length)[0];
  if (match) {
    // Length band for the national part. Not as exact as the libphonenumber
    // check the web form runs — mobile doesn't carry that dependency — but it
    // rejects obviously-short numbers like +2371234 that the dial-code match
    // alone would wave through, leaving the failure until disbursement.
    const national = compact.slice(match.dialCode.length);
    if (national.length < 7 || national.length > 10) {
      return {
        error: `That doesn't look like a complete ${match.name} number. Check the digits after ${match.dialCode}.`,
      };
    }
  }
  if (!match) {
    return {
      error:
        "Mobile money payouts aren't supported for that country yet. Supported: "
        + TARA_COUNTRIES_LIST.map((c) => c.name).join(", ")
        + ".",
    };
  }
  return { value: compact };
}

// ── Query Keys ────────────────────────────────────────────────────────────────

const MERCHANT_QK = {
  profile: ["merchant", "profile"] as const,
  stripeStatus: ["merchant", "stripe", "status"] as const,
};

// ── API calls ─────────────────────────────────────────────────────────────────

async function fetchMerchantProfile(): Promise<MerchantProfile> {
  const { data } = await paymentApi.get("/merchant/me");
  return data?.data ?? data;
}

function extractOnboardingUrl(raw: any): string | undefined {
  return (
    raw?.onboardingUrl ??
    raw?.data?.onboardingUrl ??
    raw?.url ??
    raw?.data?.url ??
    raw?.accountLinkUrl ??
    raw?.data?.accountLinkUrl ??
    raw?.link ??
    raw?.data?.link ??
    raw?.onboarding_url ??
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
  const payload = data?.data ?? data;
  return {
    stripeAccountId: payload?.stripeAccountId,
    chargesEnabled: payload?.chargesEnabled ?? false,
    payoutsEnabled: payload?.payoutsEnabled ?? false,
    detailsSubmitted: payload?.detailsSubmitted ?? false,
    onboardingComplete: payload?.onboardingComplete ?? false,
    payoutMethod: payload?.payoutMethod,
  };
}

function describeIncompleteOnboarding(status: StripeConnectStatusResponse): string {
  if (!status.detailsSubmitted) {
    return "Stripe still needs your account details. Reopen the Stripe form and complete every required step.";
  }
  if (!status.payoutsEnabled) {
    return "Stripe has your details but hasn't enabled payouts yet. This can take a few minutes — check again shortly.";
  }
  if (!status.chargesEnabled) {
    return "Stripe is still finishing verification on your account. Check again shortly.";
  }
  return "Your Stripe setup is still in progress. Please complete all required steps in the Stripe form.";
}

async function updateMerchantProfile(payload: {
  payoutMethod?: PayoutMethod;
  businessName?: string;
  country?: string;
  mobileMoneyNumber?: string;
  bankName?: string;
  bankAccountNumber?: string;
  bankAccountName?: string;
}): Promise<MerchantProfile> {
  const { data } = await paymentApi.patch("/merchant/me", payload);
  return data?.data ?? data;
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function StripeConnectScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const urlOpenedRef = useRef(false);

  const [selectedMethod, setSelectedMethod] = useState<PayoutMethod>("manual");
  const [bankName, setBankName] = useState("");
  const [bankAccountName, setBankAccountName] = useState("");
  const [bankAccountNumber, setBankAccountNumber] = useState("");
  const [mobileMoneyNumber, setMobileMoneyNumber] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [country, setCountry] = useState("");
  const [statusChecking, setStatusChecking] = useState(false);
  const [countryPickerOpen, setCountryPickerOpen] = useState(false);
  const [countryQuery, setCountryQuery] = useState("");

  const {
    data: profile,
    isLoading: profileLoading,
    isError: profileError,
    refetch: refetchProfile,
  } = useQuery({
    queryKey: MERCHANT_QK.profile,
    queryFn: fetchMerchantProfile,
  });

  const hydrateForm = useCallback((next: MerchantProfile) => {
    setSelectedMethod(next.payoutMethod ?? "manual");
    setBankName(next.bankName ?? "");
    setBankAccountName(next.bankAccountName ?? "");
    setBankAccountNumber(next.bankAccountNumber ?? "");
    setMobileMoneyNumber(next.mobileMoneyNumber ?? "");
    setBusinessName(next.businessName ?? "");
    setCountry(toCountryCode(next.country));
  }, []);

  // Seed the form from the profile exactly once, and afterwards only from a
  // save response. Re-running on every `profile` change wiped whatever the
  // provider had typed: connectMutation refetches, checkStatus invalidates,
  // and react-query refetches on app focus — which this screen guarantees by
  // sending the provider out to Stripe and back.
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (!profile || hydratedRef.current) return;
    hydratedRef.current = true;
    hydrateForm(profile);
  }, [profile, hydrateForm]);

  const saveMutation = useMutation({
    mutationFn: updateMerchantProfile,
    onSuccess: async (updated) => {
      // The form no longer re-seeds from query refetches, so take the saved
      // record as the new baseline here.
      if (updated) hydrateForm(updated);
      await queryClient.invalidateQueries({ queryKey: MERCHANT_QK.profile });
      Alert.alert("Success", "Payout settings updated successfully.");
    },
    onError: (err: any) => {
      const msg =
        err?.response?.data?.error?.message ??
        err?.response?.data?.message ??
        err?.message ??
        "Failed to update payout settings.";
      Alert.alert("Error", msg);
    },
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
      if (status.onboardingComplete) {
        await queryClient.invalidateQueries({ queryKey: MERCHANT_QK.profile });
        await queryClient.invalidateQueries({ queryKey: MERCHANT_QK.stripeStatus });
        await refetchProfile();
        Alert.alert("Stripe Connected", "Your Stripe account is connected and ready for payouts.");
      } else {
        Alert.alert("Not Yet Connected", describeIncompleteOnboarding(status), [{ text: "OK" }]);
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

  // Selecting Stripe is not the same as being able to receive money. PATCH
  // /merchant/me stores payoutMethod unchecked, and the payout job would then
  // attempt a transfer to an account Stripe has not enabled payouts on, which
  // fails at disbursement — long after the provider thinks they are set up.
  async function assertStripeReady(): Promise<boolean> {
    if (!profile?.stripeConnectAccountId) {
      Alert.alert(
        "Connect Stripe first",
        "Start Stripe onboarding before selecting Stripe Connect as your payout method.",
      );
      return false;
    }
    try {
      const status = await fetchStripeStatus();
      if (!status.onboardingComplete) {
        Alert.alert("Stripe setup incomplete", describeIncompleteOnboarding(status));
        return false;
      }
      return true;
    } catch {
      Alert.alert(
        "Could not verify Stripe",
        "We couldn't confirm your Stripe account is ready for payouts. Please check your connection and try again.",
      );
      return false;
    }
  }

  async function handleSave() {
    const payload: Parameters<typeof updateMerchantProfile>[0] = {
      payoutMethod: selectedMethod,
      ...(businessName.trim() ? { businessName: businessName.trim() } : {}),
      // Always sent, never omitted-when-empty: a legacy free-text value that
      // toCountryCode() could not map is blanked in the UI, and skipping the
      // field here would leave that unusable value in the database forever —
      // keeping country-scoped admin access broken for this merchant.
      country: country.trim(),
    };

    if (selectedMethod === "bank_transfer") {
      if (!bankName.trim() || !bankAccountName.trim() || !bankAccountNumber.trim()) {
        Alert.alert("Validation Error", "Please fill in Bank Name, Account Holder Name, and Account Number.");
        return;
      }
      payload.bankName = bankName.trim();
      payload.bankAccountName = bankAccountName.trim();
      payload.bankAccountNumber = bankAccountNumber.trim();
    } else if (selectedMethod === "mobile_money") {
      if (!mobileMoneyNumber.trim()) {
        Alert.alert("Validation Error", "Please enter your Mobile Money Phone Number.");
        return;
      }
      const checked = validateMobileMoneyNumber(mobileMoneyNumber);
      if ("error" in checked) {
        Alert.alert("Validation Error", checked.error);
        return;
      }
      // Save the normalised E.164 form, not whatever spacing was typed.
      payload.mobileMoneyNumber = checked.value;
    }

    if (selectedMethod === "stripe_connect" && !(await assertStripeReady())) return;

    saveMutation.mutate(payload);
  }

  const anyLoading =
    connectMutation.isPending || refreshMutation.isPending || saveMutation.isPending || statusChecking;

  if (profileLoading) {
    return (
      <SafeAreaView style={s.container}>
        <Header onBack={() => router.back()} />
        <View style={s.centered}>
          <ActivityIndicator size="large" color={K.colors.darkGreen} />
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

  const hasStripeAccount = Boolean(profile?.stripeConnectAccountId);

  return (
    <SafeAreaView style={s.container}>
      <Header onBack={() => router.back()} />
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        {/* Verification & Method Status Card */}
        <View style={s.statusCard}>
          <View style={s.statusHeaderRow}>
            <Ionicons
              name={profile?.isVerified ? "shield-checkmark" : "time-outline"}
              size={20}
              color={profile?.isVerified ? K.colors.success : K.colors.warning}
            />
            <Text style={s.statusTitle}>
              {profile?.isVerified ? "Merchant Verified" : "Verification Pending"}
            </Text>
          </View>
          <Text style={s.statusSub}>
            Current Active Method:{" "}
            <Text style={{ fontWeight: "700", color: K.colors.textDark }}>
              {profile?.payoutMethod ? profile.payoutMethod.toUpperCase().replace("_", " ") : "MANUAL"}
            </Text>
          </Text>
        </View>

        {/* Payout Method Selection */}
        <Text style={s.sectionHeader}>SELECT PAYOUT METHOD</Text>
        <View style={s.methodGrid}>
          {([
            { id: "stripe_connect", label: "Stripe Connect", icon: "card-outline" },
            { id: "bank_transfer", label: "Bank Transfer", icon: "business-outline" },
            { id: "mobile_money", label: "Mobile Money", icon: "call-outline" },
            { id: "manual", label: "Manual", icon: "wallet-outline" },
          ] as const).map(({ id, label, icon }) => {
            const active = selectedMethod === id;
            return (
              <TouchableOpacity
                key={id}
                style={[s.methodTile, active && s.methodTileActive]}
                onPress={() => setSelectedMethod(id)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={icon as any}
                  size={20}
                  color={active ? K.colors.darkGreen : K.colors.textMuted}
                />
                <Text style={[s.methodTileLabel, active && s.methodTileLabelActive]}>
                  {label}
                </Text>
                {active && (
                  <Ionicons
                    name="checkmark-circle"
                    size={16}
                    color={K.colors.darkGreen}
                    style={s.checkIcon}
                  />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Dynamic Details Form */}
        <View style={s.card}>
          <Text style={s.cardTitle}>
            {selectedMethod === "stripe_connect"
              ? "Stripe Connect Onboarding"
              : selectedMethod === "bank_transfer"
                ? "Bank Account Information"
                : selectedMethod === "mobile_money"
                  ? "Mobile Money Phone Number"
                  : "Manual Payout Configuration"}
          </Text>

          {/* Business & Country Fields */}
          <View style={s.fieldGroup}>
            <Text style={s.fieldLabel}>Business / Trading Name (Optional)</Text>
            <TextInput
              style={s.textInput}
              placeholder="e.g. Acme Rentals"
              placeholderTextColor="#9ca3af"
              value={businessName}
              onChangeText={setBusinessName}
            />
          </View>

          <View style={s.fieldGroup}>
            <Text style={s.fieldLabel}>Country (Optional)</Text>
            <TouchableOpacity
              style={[s.textInput, s.selectRow]}
              onPress={() => { setCountryQuery(""); setCountryPickerOpen(true); }}
              activeOpacity={0.7}
            >
              <Text style={country ? s.selectValue : s.selectPlaceholder}>
                {country
                  ? `${ALL_COUNTRIES.find((c) => c.code === country)?.flag ?? ""} ${ALL_COUNTRIES.find((c) => c.code === country)?.name ?? country}`
                  : "Select a country"}
              </Text>
              <View style={s.selectRowRight}>
                {country ? (
                  <TouchableOpacity onPress={() => setCountry("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close-circle" size={16} color={K.colors.textMuted} />
                  </TouchableOpacity>
                ) : null}
                <Ionicons name="chevron-down" size={16} color={K.colors.textMuted} />
              </View>
            </TouchableOpacity>
          </View>

          {/* STRIPE CONNECT CONTENT */}
          {selectedMethod === "stripe_connect" && (
            <View style={s.subSection}>
              <Text style={s.cardBody}>
                Connect your Stripe account to receive direct payouts automatically when stays are completed.
              </Text>
              {hasStripeAccount && (
                <View style={s.connectedInfoRow}>
                  <Ionicons name="checkmark-circle" size={18} color={K.colors.success} />
                  <Text style={s.connectedInfoText}>
                    Stripe Account ID: {profile?.stripeConnectAccountId}
                  </Text>
                </View>
              )}

              <TouchableOpacity
                style={[s.primaryBtn, anyLoading && s.btnDisabled]}
                onPress={() => (hasStripeAccount ? refreshMutation.mutate() : connectMutation.mutate())}
                disabled={anyLoading}
                activeOpacity={0.85}
              >
                {connectMutation.isPending || refreshMutation.isPending ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons name="link-outline" size={18} color="#fff" style={s.btnIcon} />
                    <Text style={s.primaryBtnText}>
                      {hasStripeAccount ? "Resume / Refresh Stripe Setup" : "Connect with Stripe"}
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              {hasStripeAccount && (
                <TouchableOpacity
                  style={[s.outlineBtn, { marginTop: 10 }, anyLoading && s.btnDisabled]}
                  onPress={() => void checkStatus()}
                  disabled={anyLoading}
                  activeOpacity={0.8}
                >
                  {statusChecking ? (
                    <ActivityIndicator color={K.colors.darkGreen} size="small" />
                  ) : (
                    <>
                      <Ionicons name="refresh-outline" size={16} color={K.colors.darkGreen} />
                      <Text style={s.outlineBtnText}>Check Connection Status</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* BANK TRANSFER CONTENT */}
          {selectedMethod === "bank_transfer" && (
            <View style={s.subSection}>
              <View style={s.fieldGroup}>
                <Text style={s.fieldLabel}>Account Holder Name *</Text>
                <TextInput
                  style={s.textInput}
                  placeholder="Full name on bank account"
                  placeholderTextColor="#9ca3af"
                  value={bankAccountName}
                  onChangeText={setBankAccountName}
                />
              </View>
              <View style={s.fieldGroup}>
                <Text style={s.fieldLabel}>Bank Name *</Text>
                <TextInput
                  style={s.textInput}
                  placeholder="e.g. Barclays / Standard Chartered"
                  placeholderTextColor="#9ca3af"
                  value={bankName}
                  onChangeText={setBankName}
                />
              </View>
              <View style={s.fieldGroup}>
                <Text style={s.fieldLabel}>Account Number / IBAN *</Text>
                <TextInput
                  style={s.textInput}
                  placeholder="Enter your account number"
                  placeholderTextColor="#9ca3af"
                  secureTextEntry
                  value={bankAccountNumber}
                  onChangeText={setBankAccountNumber}
                />
              </View>
            </View>
          )}

          {/* MOBILE MONEY CONTENT */}
          {selectedMethod === "mobile_money" && (
            <View style={s.subSection}>
              <View style={s.fieldGroup}>
                <Text style={s.fieldLabel}>Mobile Money Phone Number *</Text>
                <TextInput
                  style={s.textInput}
                  placeholder="e.g. +237670000000"
                  placeholderTextColor="#9ca3af"
                  keyboardType="phone-pad"
                  value={mobileMoneyNumber}
                  onChangeText={setMobileMoneyNumber}
                />
                <Text style={s.fieldHint}>
                  Include the country code — e.g. +237, +233, +254. Supported:{" "}
                  {TARA_COUNTRIES_LIST.map((c) => c.code).join(", ")}
                </Text>
              </View>
            </View>
          )}

          {/* MANUAL CONTENT */}
          {selectedMethod === "manual" && (
            <View style={s.subSection}>
              <Text style={s.cardBody}>
                No extra account details are required for manual payout settlement.
              </Text>
            </View>
          )}

          {/* Save Button */}
          <TouchableOpacity
            style={[s.primaryBtn, { marginTop: 16 }, saveMutation.isPending && s.btnDisabled]}
            onPress={() => void handleSave()}
            disabled={saveMutation.isPending}
            activeOpacity={0.85}
          >
            {saveMutation.isPending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="save-outline" size={18} color="#fff" style={s.btnIcon} />
                <Text style={s.primaryBtnText}>Save Payout Settings</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Info Box */}
        <View style={s.infoCard}>
          <Text style={s.infoHeading}>How Payouts Work</Text>
          <InfoRow
            icon="calendar-outline"
            title="Post Check-in Release"
            body="Payouts are generated after guest check-in is verified."
          />
          <InfoRow
            icon="shield-checkmark-outline"
            title="Encrypted Settlement"
            body="Bank and mobile money accounts are transmitted securely to payment-service."
          />
        </View>
      </ScrollView>

      <Modal
        visible={countryPickerOpen}
        animationType="slide"
        onRequestClose={() => setCountryPickerOpen(false)}
      >
        <SafeAreaView style={s.container}>
          <View style={s.pickerHeader}>
            <Text style={s.pickerTitle}>Select Country</Text>
            <TouchableOpacity onPress={() => setCountryPickerOpen(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={22} color={K.colors.textDark} />
            </TouchableOpacity>
          </View>
          <View style={s.pickerSearchWrap}>
            <Ionicons name="search" size={16} color={K.colors.textMuted} />
            <TextInput
              style={s.pickerSearchInput}
              placeholder="Search countries"
              placeholderTextColor="#9ca3af"
              value={countryQuery}
              onChangeText={setCountryQuery}
              autoCorrect={false}
            />
          </View>
          <FlatList
            data={ALL_COUNTRIES.filter((c) => {
              const q = countryQuery.trim().toLowerCase();
              if (!q) return true;
              return c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q);
            })}
            keyExtractor={(item, index) => `${item.code}-${index}`}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity
                style={s.pickerRow}
                onPress={() => { setCountry(item.code); setCountryPickerOpen(false); }}
                activeOpacity={0.7}
              >
                <Text style={s.pickerFlag}>{item.flag}</Text>
                <Text style={s.pickerName}>{item.name}</Text>
                <Text style={s.pickerCode}>{item.code}</Text>
                {country === item.code && (
                  <Ionicons name="checkmark" size={18} color={K.colors.darkGreen} />
                )}
              </TouchableOpacity>
            )}
          />
        </SafeAreaView>
      </Modal>
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
      <Text style={s.headerTitle}>Payout & Payment Settings</Text>
      <View style={{ width: 40 }} />
    </View>
  );
}

function InfoRow({ icon, title, body }: { icon: string; title: string; body: string }) {
  return (
    <View style={s.infoRow}>
      <View style={s.infoIconWrap}>
        <Ionicons name={icon as any} size={18} color={K.colors.darkGreen} />
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
  container: { flex: 1, backgroundColor: K.colors.bgApp },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 },
  scroll: { padding: 16, paddingBottom: 48 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: K.colors.darkGreen,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontWeight: "700", color: "#fff" },

  statusCard: {
    backgroundColor: "#fff",
    borderRadius: K.radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: K.colors.border,
    marginBottom: 16,
  },
  statusHeaderRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  statusTitle: { fontSize: 15, fontWeight: "700", color: K.colors.textDark },
  statusSub: { fontSize: 12, color: K.colors.textMuted },

  sectionHeader: {
    fontSize: 11,
    fontWeight: "800",
    color: K.colors.textMuted,
    letterSpacing: 1.0,
    marginBottom: 10,
    marginLeft: 2,
  },

  methodGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  methodTile: {
    width: "48%",
    backgroundColor: "#fff",
    borderRadius: K.radius.md,
    padding: 12,
    borderWidth: 1.5,
    borderColor: K.colors.border,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    position: "relative",
  },
  methodTileActive: {
    borderColor: K.colors.darkGreen,
    backgroundColor: "#f0fdf4",
  },
  methodTileLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: K.colors.textMuted,
  },
  methodTileLabelActive: {
    color: K.colors.darkGreen,
    fontWeight: "700",
  },
  checkIcon: {
    position: "absolute",
    right: 8,
    top: 8,
  },

  card: {
    backgroundColor: "#fff",
    borderRadius: K.radius.xl,
    padding: 20,
    borderWidth: 1,
    borderColor: K.colors.border,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: K.colors.textDark,
    marginBottom: 14,
  },
  cardBody: {
    fontSize: 13,
    color: K.colors.textMuted,
    lineHeight: 18,
    marginBottom: 12,
  },

  fieldGroup: {
    marginBottom: 14,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: K.colors.textDark,
    marginBottom: 6,
  },
  fieldHint: {
    fontSize: 11,
    color: K.colors.textMuted,
    marginTop: 4,
  },
  textInput: {
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: K.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: K.colors.textDark,
  },

  selectRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
  },
  selectRowRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  selectValue: { fontSize: 14, color: K.colors.textDark, flexShrink: 1 },
  selectPlaceholder: { fontSize: 14, color: "#9ca3af", flexShrink: 1 },

  pickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  pickerTitle: { fontSize: 17, fontWeight: "700", color: K.colors.textDark },
  pickerSearchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 20,
    marginTop: 14,
    marginBottom: 6,
    paddingHorizontal: 12,
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: K.radius.md,
  },
  pickerSearchInput: { flex: 1, paddingVertical: 10, fontSize: 14, color: K.colors.textDark },
  pickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  pickerFlag: { fontSize: 20 },
  pickerName: { flex: 1, fontSize: 14, color: K.colors.textDark },
  pickerCode: { fontSize: 12, fontWeight: "700", color: K.colors.textMuted },

  subSection: {
    marginTop: 6,
  },
  connectedInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#f0fdf4",
    padding: 10,
    borderRadius: K.radius.md,
    marginBottom: 12,
  },
  connectedInfoText: {
    fontSize: 12,
    fontWeight: "600",
    color: K.colors.success,
  },

  primaryBtn: {
    flexDirection: "row",
    backgroundColor: K.colors.darkGreen,
    borderRadius: K.radius.button,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  btnIcon: { marginRight: 8 },
  btnDisabled: { opacity: 0.6 },

  outlineBtn: {
    flexDirection: "row",
    borderWidth: 1.5,
    borderColor: K.colors.darkGreen,
    borderRadius: K.radius.button,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  outlineBtnText: { color: K.colors.darkGreen, fontWeight: "700", fontSize: 14 },

  retryBtn: { backgroundColor: K.colors.darkGreen, borderRadius: 10, paddingHorizontal: 24, paddingVertical: 12 },
  retryBtnText: { color: "#fff", fontWeight: "700" },

  loadingText: { marginTop: 12, fontSize: 14, color: K.colors.textMuted },
  errTitle: { fontSize: 18, fontWeight: "700", color: K.colors.textDark, textAlign: "center" },
  errBody: { fontSize: 13, color: K.colors.textMuted, textAlign: "center" },

  infoCard: {
    backgroundColor: "#fff",
    borderRadius: K.radius.xl,
    padding: 18,
    borderWidth: 1,
    borderColor: K.colors.border,
  },
  infoHeading: { fontSize: 14, fontWeight: "700", color: K.colors.textDark, marginBottom: 12 },
  infoRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 12 },
  infoIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#f0fdf4",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  infoRowText: { flex: 1 },
  infoRowTitle: { fontSize: 13, fontWeight: "600", color: K.colors.textDark, marginBottom: 2 },
  infoRowBody: { fontSize: 11, color: K.colors.textMuted, lineHeight: 16 },
});
