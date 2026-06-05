import { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { useStripe } from "@stripe/stripe-react-native";
import { listingApi } from "../../lib/listing-api";
import { paymentApi } from "../../lib/payment-api";

// ── Types ─────────────────────────────────────────────────────────────────────

type PaymentProvider = "stripe" | "tara";

interface BookingDetail {
  totalAmount: number;
  currency: string;
  reference: string;
  listingType: string;
  listingTitle: string;
  status: string;
}

interface SavedPaymentMethod {
  id: string;
  provider: "stripe" | "tara";
  last4: string;
  label: string; // e.g. "Visa", "M-Pesa"
}

interface InitiateResponse {
  data: {
    paymentId: string;
    clientSecret?: string;
    taraReference?: string;
    message?: string;
  };
}

interface PaymentStatusResponse {
  data: {
    status: string;
  };
}

// ── Country prefixes for Tara mobile money ────────────────────────────────────

const COUNTRY_PREFIXES = ["+254", "+234", "+233", "+27", "+256", "+255"];

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCurrency(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString()}`;
}

function maskLast4(last4: string, provider: "stripe" | "tara"): string {
  if (provider === "stripe") return `•••• ${last4}`;
  return `•••• ${last4}`;
}

function msToCountdown(ms: number): string {
  if (ms <= 0) return "00:00";
  const totalSec = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

// ── View states ───────────────────────────────────────────────────────────────

type ScreenView =
  | "select"        // method selection + input form
  | "stripe_polling" // polling Stripe status
  | "tara_waiting"  // waiting for Tara mobile confirmation
  | "success"       // navigating away
  | "failure";      // payment failed

// ── Main Component ────────────────────────────────────────────────────────────

export default function PaymentScreen() {
  const router = useRouter();
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();

  // ── Stripe Payment Sheet ──────────────────────────────────────────────────
  const { initPaymentSheet, presentPaymentSheet } = useStripe();

  // ── UI state ──────────────────────────────────────────────────────────────
  const [provider, setProvider] = useState<PaymentProvider>("stripe");
  const [selectedSavedMethodId, setSelectedSavedMethodId] = useState<string | null>(null);
  const [view, setView] = useState<ScreenView>("select");
  const [attemptCount, setAttemptCount] = useState(0);
  const [failureReason, setFailureReason] = useState<string>("");
  const [isInitiating, setIsInitiating] = useState(false);
  const queryClient = useQueryClient();

  // ── Tara mobile money form ────────────────────────────────────────────────
  const [countryPrefix, setCountryPrefix] = useState("+254");
  const [mobileNumber, setMobileNumber] = useState("");
  const [saveMobileNumber, setSaveMobileNumber] = useState(false);
  const [showPrefixPicker, setShowPrefixPicker] = useState(false);

  // ── Tara countdown ────────────────────────────────────────────────────────
  const [taraCountdownMs, setTaraCountdownMs] = useState(90_000);
  const taraIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const taraDeadlineRef = useRef<number>(0);

  // ── Polling refs ──────────────────────────────────────────────────────────
  const stripePollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const taraPollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stripeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Fetch booking detail ──────────────────────────────────────────────────
  const { data: booking, isLoading: bookingLoading, error: bookingError } = useQuery<BookingDetail>({
    queryKey: ["booking-for-payment", bookingId],
    queryFn: async () => {
      const res = await listingApi.get<{ data: BookingDetail }>(`/guests/me/bookings/${bookingId}`);
      return res.data.data;
    },
    enabled: !!bookingId,
    retry: 1,
  });

  // ── Fetch saved payment methods ───────────────────────────────────────────
  const { data: savedMethods } = useQuery<SavedPaymentMethod[]>({
    queryKey: ["saved-payment-methods"],
    queryFn: async () => {
      const res = await paymentApi.get<{ data: SavedPaymentMethod[] }>("/guests/me/payment-methods");
      return res.data.data;
    },
    retry: 1,
  });

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (stripePollingRef.current) clearInterval(stripePollingRef.current);
      if (taraPollingRef.current) clearInterval(taraPollingRef.current);
      if (stripeTimeoutRef.current) clearTimeout(stripeTimeoutRef.current);
      if (taraIntervalRef.current) clearInterval(taraIntervalRef.current);
    };
  }, []);

  // ── Validation ────────────────────────────────────────────────────────────
  function validateTara(): string | null {
    const digits = mobileNumber.replace(/\D/g, "");
    if (digits.length < 6) return "Please enter a valid mobile number.";
    return null;
  }

  // ── Stripe polling ────────────────────────────────────────────────────────
  function startStripePolling(paymentId: string) {
    let elapsed = 0;
    const MAX_DURATION = 60_000;
    const INTERVAL = 3_000;

    stripePollingRef.current = setInterval(async () => {
      elapsed += INTERVAL;
      try {
        // Poll payment status
        const statusRes = await paymentApi.get<PaymentStatusResponse>(`/payments/${paymentId}/status`);
        const status = statusRes.data.data.status;

        if (status === "captured") {
          clearPolling();
          navigateToSuccess();
          return;
        }
        if (status === "failed" || status === "timed_out") {
          clearPolling();
          setFailureReason("Payment failed. Please try again.");
          setView("failure");
          return;
        }

        // Also check booking status
        const bookingRes = await listingApi.get<{ data: { status: string } }>(`/guests/me/bookings/${bookingId}`);
        if (bookingRes.data.data.status === "confirmed") {
          clearPolling();
          navigateToSuccess();
          return;
        }
      } catch {
        // Silently ignore transient errors during polling
      }

      if (elapsed >= MAX_DURATION) {
        clearPolling();
        setFailureReason("Payment confirmation timed out after 60 seconds. Please try again.");
        setView("failure");
      }
    }, INTERVAL);
  }

  // ── Tara polling ──────────────────────────────────────────────────────────
  function startTaraPolling(paymentId: string) {
    const INTERVAL = 5_000;
    const MAX_DURATION = 90_000; // matches the 90s user-facing countdown
    let elapsed = 0;

    taraPollingRef.current = setInterval(async () => {
      elapsed += INTERVAL;
      try {
        const statusRes = await paymentApi.get<PaymentStatusResponse>(`/payments/${paymentId}/status`);
        const status = statusRes.data.data.status;

        if (status === "captured") {
          clearPolling();
          navigateToSuccess();
          return;
        }
        if (status === "failed" || status === "timed_out") {
          clearPolling();
          if (taraIntervalRef.current) clearInterval(taraIntervalRef.current);
          setFailureReason(
            status === "timed_out"
              ? "Mobile money request timed out. The number did not confirm in time."
              : "Mobile money payment failed. Please try again."
          );
          setView("failure");
          return;
        }
      } catch {
        // Silently ignore transient errors during polling
      }

      if (elapsed >= MAX_DURATION) {
        clearPolling();
        if (taraIntervalRef.current) clearInterval(taraIntervalRef.current);
        setFailureReason("Mobile money confirmation timed out. Please try again.");
        setView("failure");
      }
    }, INTERVAL);
  }

  // ── Tara countdown ────────────────────────────────────────────────────────
  function startTaraCountdown() {
    taraDeadlineRef.current = Date.now() + 90_000;
    setTaraCountdownMs(90_000);

    taraIntervalRef.current = setInterval(() => {
      const remaining = taraDeadlineRef.current - Date.now();
      if (remaining <= 0) {
        if (taraIntervalRef.current) clearInterval(taraIntervalRef.current);
        setTaraCountdownMs(0);
      } else {
        setTaraCountdownMs(remaining);
      }
    }, 500);
  }

  // ── Clear polling ─────────────────────────────────────────────────────────
  function clearPolling() {
    if (stripePollingRef.current) clearInterval(stripePollingRef.current);
    if (taraPollingRef.current) clearInterval(taraPollingRef.current);
    if (stripeTimeoutRef.current) clearTimeout(stripeTimeoutRef.current);
    if (taraIntervalRef.current) clearInterval(taraIntervalRef.current);
  }

  // ── Navigate to success ───────────────────────────────────────────────────
  function navigateToSuccess() {
    setView("success");
    void queryClient.invalidateQueries({ queryKey: ["booking", bookingId] });
    void queryClient.invalidateQueries({ queryKey: ["myBookings"] });
    router.replace({
      pathname: "/booking/[id]",
      params: { id: bookingId, fromPayment: "true" },
    });
  }

  // ── Pay button handler ────────────────────────────────────────────────────
  async function handlePay() {
    // ── Stripe Payment Sheet flow ─────────────────────────────────────────
    if (provider === "stripe") {
      setIsInitiating(true);
      try {
        const res = await paymentApi.post<InitiateResponse>("/payments/initiate", {
          bookingId,
          paymentProvider: "stripe",
          ...(selectedSavedMethodId ? { savedPaymentMethodId: selectedSavedMethodId } : {}),
        });

        const { paymentId, clientSecret } = res.data.data;
        setAttemptCount((c) => c + 1);

        if (!clientSecret) {
          Alert.alert("Payment Error", "Could not initialise payment. Please try again.");
          return;
        }

        const isTestKey = (process.env["EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY"] ?? "").startsWith("pk_test");
        const { error: initError } = await initPaymentSheet({
          paymentIntentClientSecret: clientSecret,
          merchantDisplayName: "Kainook",
          style: "automatic",
          allowsDelayedPaymentMethods: false,
          googlePay: {
            merchantCountryCode: "KE",
            testEnv: isTestKey,
          },
          applePay: {
            merchantCountryCode: "KE",
          },
        });

        if (initError) {
          Alert.alert("Payment Error", initError.message);
          return;
        }

        setIsInitiating(false);

        const { error: presentError } = await presentPaymentSheet();

        if (presentError) {
          if (presentError.code === "Canceled") return;
          setFailureReason(presentError.message || "Card payment failed. Please try again.");
          setView("failure");
          return;
        }

        // Payment confirmed by Stripe — poll backend for booking confirmation
        setView("stripe_polling");
        startStripePolling(paymentId);
      } catch (err: any) {
        const status = err?.response?.status;
        const code = err?.response?.data?.error?.code ?? err?.response?.data?.code;
        if (status === 429 || code === "PAYMENT_ATTEMPTS_EXCEEDED") {
          setFailureReason("Too many payment attempts. Your reservation has been released.");
          setAttemptCount(3);
          setView("failure");
        } else if (status === 409) {
          setFailureReason("This booking is no longer available for payment.");
          setAttemptCount(3);
          setView("failure");
        } else {
          const message = err?.response?.data?.message ?? err?.message ?? "An unexpected error occurred.";
          Alert.alert("Payment Error", message);
        }
      } finally {
        setIsInitiating(false);
      }
      return;
    }

    // ── Tara (mobile money) flow ──────────────────────────────────────────
    if (!selectedSavedMethodId) {
      const err = validateTara();
      if (err) {
        Alert.alert("Invalid input", err);
        return;
      }
    }

    setIsInitiating(true);

    try {
      const fullMobileNumber = `${countryPrefix}${mobileNumber}`;

      const res = await paymentApi.post<InitiateResponse>("/payments/initiate", {
        bookingId,
        paymentProvider: "tara",
        mobileNumber: fullMobileNumber,
        ...(selectedSavedMethodId ? { savedPaymentMethodId: selectedSavedMethodId } : {}),
      });

      const { paymentId } = res.data.data;
      setCurrentPaymentId(paymentId);
      setAttemptCount((c) => c + 1);

      setView("tara_waiting");
      startTaraCountdown();
      startTaraPolling(paymentId);
    } catch (err: any) {
      const status = err?.response?.status;
      const code = err?.response?.data?.error?.code ?? err?.response?.data?.code;

      if (status === 429 || code === "PAYMENT_ATTEMPTS_EXCEEDED") {
        setFailureReason("Too many payment attempts. Your reservation has been released.");
        setAttemptCount(3);
        setView("failure");
      } else if (status === 409) {
        setFailureReason("This booking is no longer available for payment.");
        setAttemptCount(3);
        setView("failure");
      } else {
        const message = err?.response?.data?.message ?? err?.message ?? "An unexpected error occurred.";
        Alert.alert("Payment Error", message);
      }
    } finally {
      setIsInitiating(false);
    }
  }

  // ── Handle retry ──────────────────────────────────────────────────────────
  function handleRetry() {
    setFailureReason("");
    setView("select");
  }

  function handleChooseDifferentMethod() {
    setSelectedSavedMethodId(null);
    setFailureReason("");
    setView("select");
  }

  function handleCancel() {
    clearPolling();
    router.back();
  }

  // ── Render: Loading booking ───────────────────────────────────────────────
  if (bookingLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#1a73e8" />
          <Text style={styles.loadingText}>Loading booking details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (bookingError || !booking) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Ionicons name="warning" size={64} color="#dc2626" />
          <Text style={styles.errorTitle}>Could not load booking</Text>
          <Text style={styles.errorBody}>
            We couldn't retrieve your booking details. Please go back and try again.
          </Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => router.back()}>
            <Text style={styles.primaryBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Render: Stripe polling ────────────────────────────────────────────────
  if (view === "stripe_polling") {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#1a73e8" />
          <Text style={styles.pollingTitle}>Card payment is being processed...</Text>
          <Text style={styles.pollingSubtitle}>Awaiting payment confirmation...</Text>
          <Text style={styles.pollingHint}>Please do not close this screen.</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Render: Tara waiting ──────────────────────────────────────────────────
  if (view === "tara_waiting") {
    const maskedNumber =
      `${countryPrefix} •••• ${mobileNumber.slice(-4)}`;
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Ionicons name="phone-portrait" size={64} color="#1a73e8" />
          <Text style={styles.pollingTitle}>
            Payment request sent to {maskedNumber}
          </Text>
          <Text style={styles.pollingSubtitle}>
            Open the prompt on your phone and enter your Tara PIN to confirm.
          </Text>
          <View style={styles.countdownBox}>
            <Text style={styles.countdownLabel}>Time remaining</Text>
            <Text style={styles.countdownValue}>{msToCountdown(taraCountdownMs)}</Text>
          </View>
          <ActivityIndicator size="small" color="#1a73e8" style={{ marginTop: 8 }} />
          <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Render: Failure ───────────────────────────────────────────────────────
  if (view === "failure") {
    const maxAttemptsReached = attemptCount >= 3;
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.failureContainer}>
            <Ionicons name="close-circle" size={72} color="#dc2626" />
            <Text style={styles.failureTitle}>Payment Failed</Text>
            <View style={styles.failureReasonBox}>
              <Text style={styles.failureReason}>{failureReason}</Text>
            </View>

            {maxAttemptsReached ? (
              <View style={styles.maxAttemptsBox}>
                <Ionicons name="information-circle-outline" size={20} color="#6b7280" />
                <Text style={styles.maxAttemptsText}>
                  You've reached the maximum number of payment attempts. Your reservation has been released.
                </Text>
                <TouchableOpacity
                  style={[styles.primaryBtn, { marginTop: 20, width: "100%" }]}
                  onPress={() => router.push("/(tabs)" as any)}
                >
                  <Text style={styles.primaryBtnText}>Back to Home</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.failureActions}>
                <TouchableOpacity style={styles.primaryBtn} onPress={handleRetry}>
                  <Text style={styles.primaryBtnText}>Retry Payment</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.secondaryBtn} onPress={handleChooseDifferentMethod}>
                  <Text style={styles.secondaryBtnText}>Choose Different Payment Method</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Render: Select + form (main view) ─────────────────────────────────────
  const hasSavedMethods = savedMethods && savedMethods.length > 0;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* ── Booking summary card ──────────────────────────────────────── */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>{booking.listingTitle}</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Reference</Text>
            <Text style={styles.summaryReference}>{booking.reference}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryRow}>
            <Text style={styles.summaryTotalLabel}>Total Due</Text>
            <Text style={styles.summaryTotalAmount}>
              {formatCurrency(booking.totalAmount, booking.currency)}
            </Text>
          </View>
        </View>

        {/* ── Payment method selector ───────────────────────────────────── */}
        <Text style={styles.sectionLabel}>Select Payment Method</Text>
        <View style={styles.methodTilesRow}>
          <TouchableOpacity
            style={[styles.methodTile, provider === "stripe" && styles.methodTileSelected]}
            onPress={() => {
              setProvider("stripe");
              setSelectedSavedMethodId(null);
            }}
            activeOpacity={0.8}
          >
            <Ionicons
              name="card-outline"
              size={28}
              color={provider === "stripe" ? "#1a73e8" : "#6b7280"}
            />
            <Text style={[styles.methodTileTitle, provider === "stripe" && styles.methodTileTitleSelected]}>
              Pay by Card
            </Text>
            <Text style={styles.methodTileSubtitle}>Visa / Mastercard / Amex</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.methodTile, provider === "tara" && styles.methodTileSelected]}
            onPress={() => {
              setProvider("tara");
              setSelectedSavedMethodId(null);
            }}
            activeOpacity={0.8}
          >
            <Ionicons
              name="phone-portrait-outline"
              size={28}
              color={provider === "tara" ? "#1a73e8" : "#6b7280"}
            />
            <Text style={[styles.methodTileTitle, provider === "tara" && styles.methodTileTitleSelected]}>
              Mobile Money
            </Text>
            <Text style={styles.methodTileSubtitle}>M-Pesa, MTN, Airtel Money</Text>
          </TouchableOpacity>
        </View>

        {/* ── Saved payment methods ─────────────────────────────────────── */}
        {hasSavedMethods && (
          <View style={styles.savedMethodsSection}>
            <Text style={styles.sectionLabel}>Saved Methods</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.savedMethodsScroll}
            >
              {savedMethods
                .filter((m) => m.provider === provider)
                .map((method) => (
                  <TouchableOpacity
                    key={method.id}
                    style={[
                      styles.savedMethodChip,
                      selectedSavedMethodId === method.id && styles.savedMethodChipSelected,
                    ]}
                    onPress={() =>
                      setSelectedSavedMethodId(
                        selectedSavedMethodId === method.id ? null : method.id
                      )
                    }
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name={method.provider === "stripe" ? "card-outline" : "phone-portrait-outline"}
                      size={16}
                      color={selectedSavedMethodId === method.id ? "#1a73e8" : "#6b7280"}
                    />
                    <Text
                      style={[
                        styles.savedMethodChipText,
                        selectedSavedMethodId === method.id && styles.savedMethodChipTextSelected,
                      ]}
                    >
                      {maskLast4(method.last4, method.provider)}
                    </Text>
                  </TouchableOpacity>
                ))}
            </ScrollView>
          </View>
        )}

        {/* ── Provider-specific input area ──────────────────────────────── */}
        {!selectedSavedMethodId && (
          <View style={styles.inputSection}>
            {provider === "stripe" ? (
              <View style={styles.stripeNote}>
                <Ionicons name="lock-closed-outline" size={18} color="#16a34a" />
                <Text style={styles.stripeNoteText}>
                  Your card details are collected securely by Stripe. Tap "Pay" to open the secure payment screen.
                </Text>
              </View>
            ) : (
              <TaraForm
                countryPrefix={countryPrefix}
                setCountryPrefix={setCountryPrefix}
                mobileNumber={mobileNumber}
                setMobileNumber={setMobileNumber}
                saveMobileNumber={saveMobileNumber}
                setSaveMobileNumber={setSaveMobileNumber}
                showPrefixPicker={showPrefixPicker}
                setShowPrefixPicker={setShowPrefixPicker}
              />
            )}
          </View>
        )}

        {/* ── Pay button ────────────────────────────────────────────────── */}
        <TouchableOpacity
          style={[styles.primaryBtn, isInitiating && styles.primaryBtnDisabled]}
          onPress={() => void handlePay()}
          disabled={isInitiating}
        >
          {isInitiating ? (
            <View style={styles.btnLoadingRow}>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={[styles.primaryBtnText, { marginLeft: 8 }]}>Processing your payment...</Text>
            </View>
          ) : (
            <Text style={styles.primaryBtnText}>
              Pay {formatCurrency(booking.totalAmount, booking.currency)}
            </Text>
          )}
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

// ── Stripe Form Sub-component ─────────────────────────────────────────────────

// ── Tara Form Sub-component ───────────────────────────────────────────────────

interface TaraFormProps {
  countryPrefix: string;
  setCountryPrefix: (v: string) => void;
  mobileNumber: string;
  setMobileNumber: (v: string) => void;
  saveMobileNumber: boolean;
  setSaveMobileNumber: (v: boolean) => void;
  showPrefixPicker: boolean;
  setShowPrefixPicker: (v: boolean) => void;
}

function TaraForm({
  countryPrefix,
  setCountryPrefix,
  mobileNumber,
  setMobileNumber,
  saveMobileNumber,
  setSaveMobileNumber,
  showPrefixPicker,
  setShowPrefixPicker,
}: TaraFormProps) {
  return (
    <View>
      <Text style={styles.inputSectionTitle}>Mobile Number</Text>

      <View style={styles.fieldGroup}>
        <Text style={styles.fieldLabel}>Phone Number (E.164 format)</Text>
        <View style={styles.phoneRow}>
          <TouchableOpacity
            style={styles.prefixButton}
            onPress={() => setShowPrefixPicker(!showPrefixPicker)}
            activeOpacity={0.8}
          >
            <Text style={styles.prefixButtonText}>{countryPrefix}</Text>
            <Ionicons name="chevron-down" size={14} color="#374151" />
          </TouchableOpacity>
          <TextInput
            style={[styles.input, styles.phoneInput]}
            value={mobileNumber}
            onChangeText={(t) => setMobileNumber(t.replace(/\D/g, ""))}
            placeholder="712 345 678"
            keyboardType="phone-pad"
          />
        </View>

        {showPrefixPicker && (
          <View style={styles.prefixDropdown}>
            {COUNTRY_PREFIXES.map((prefix) => (
              <TouchableOpacity
                key={prefix}
                style={[
                  styles.prefixDropdownItem,
                  prefix === countryPrefix && styles.prefixDropdownItemSelected,
                ]}
                onPress={() => {
                  setCountryPrefix(prefix);
                  setShowPrefixPicker(false);
                }}
              >
                <Text
                  style={[
                    styles.prefixDropdownText,
                    prefix === countryPrefix && styles.prefixDropdownTextSelected,
                  ]}
                >
                  {prefix}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      <View style={styles.taraNote}>
        <Ionicons name="information-circle-outline" size={14} color="#6b7280" />
        <Text style={styles.taraNoteText}>
          A payment prompt will be sent to this number. Enter your PIN to confirm.
        </Text>
      </View>

      <TouchableOpacity
        style={styles.checkboxRow}
        onPress={() => setSaveMobileNumber(!saveMobileNumber)}
        activeOpacity={0.7}
      >
        <View style={[styles.checkbox, saveMobileNumber && styles.checkboxChecked]}>
          {saveMobileNumber && <Ionicons name="checkmark" size={12} color="#fff" />}
        </View>
        <Text style={styles.checkboxLabel}>Save this number for future payments</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  scroll: { padding: 16, paddingBottom: 48 },

  // Loading / error
  loadingText: { fontSize: 15, color: "#6b7280", marginTop: 16, textAlign: "center" },
  errorTitle: { fontSize: 22, fontWeight: "700", color: "#111827", marginTop: 16, textAlign: "center" },
  errorBody: { fontSize: 14, color: "#6b7280", textAlign: "center", lineHeight: 20, marginBottom: 24 },

  // Summary card
  summaryCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: 24,
  },
  summaryTitle: { fontSize: 18, fontWeight: "700", color: "#111827", marginBottom: 12 },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  summaryLabel: { fontSize: 13, color: "#6b7280" },
  summaryReference: { fontSize: 13, fontWeight: "600", color: "#374151", letterSpacing: 0.5 },
  summaryDivider: { height: 1, backgroundColor: "#e5e7eb", marginVertical: 12 },
  summaryTotalLabel: { fontSize: 16, fontWeight: "600", color: "#111827" },
  summaryTotalAmount: { fontSize: 22, fontWeight: "800", color: "#1a73e8" },

  // Section label
  sectionLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
  },

  // Method tiles
  methodTilesRow: { flexDirection: "row", gap: 12, marginBottom: 24 },
  methodTile: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#e5e7eb",
    padding: 16,
    alignItems: "center",
    gap: 6,
  },
  methodTileSelected: { borderColor: "#1a73e8", backgroundColor: "#eff6ff" },
  methodTileTitle: { fontSize: 14, fontWeight: "700", color: "#374151", textAlign: "center" },
  methodTileTitleSelected: { color: "#1a73e8" },
  methodTileSubtitle: { fontSize: 11, color: "#6b7280", textAlign: "center" },

  // Saved methods
  savedMethodsSection: { marginBottom: 20 },
  savedMethodsScroll: { gap: 10, paddingVertical: 4 },
  savedMethodChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#e5e7eb",
    backgroundColor: "#fff",
  },
  savedMethodChipSelected: { borderColor: "#1a73e8", backgroundColor: "#eff6ff" },
  savedMethodChipText: { fontSize: 13, fontWeight: "500", color: "#374151" },
  savedMethodChipTextSelected: { color: "#1a73e8" },

  // Input section
  inputSection: { marginBottom: 20 },
  inputSectionTitle: { fontSize: 15, fontWeight: "600", color: "#111827", marginBottom: 14 },

  // Form fields
  fieldGroup: { marginBottom: 16 },
  fieldLabel: { fontSize: 13, fontWeight: "500", color: "#374151", marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    backgroundColor: "#fff",
    color: "#111827",
  },
  rowFields: { flexDirection: "row" },

  // Stripe Payment Sheet note
  stripeNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#f0fdf4",
    borderRadius: 10,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: "#bbf7d0",
    marginBottom: 8,
  },
  stripeNoteText: {
    fontSize: 14,
    color: "#15803d",
    lineHeight: 20,
    flex: 1,
    fontWeight: "500",
  },

  // Security note (Stripe)
  securityNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#f0fdf4",
    borderRadius: 8,
    padding: 10,
    gap: 6,
    marginBottom: 8,
  },
  securityNoteText: { fontSize: 12, color: "#6b7280", lineHeight: 17, flex: 1 },

  // Tara phone row
  phoneRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  prefixButton: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: "#fff",
    gap: 4,
  },
  prefixButtonText: { fontSize: 14, color: "#374151", fontWeight: "600" },
  phoneInput: { flex: 1 },
  prefixDropdown: {
    marginTop: 4,
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    overflow: "hidden",
  },
  prefixDropdownItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  prefixDropdownItemSelected: { backgroundColor: "#eff6ff" },
  prefixDropdownText: { fontSize: 14, color: "#374151" },
  prefixDropdownTextSelected: { color: "#1a73e8", fontWeight: "600" },

  // Tara note
  taraNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#fafafa",
    borderRadius: 8,
    padding: 10,
    gap: 6,
    marginBottom: 14,
  },
  taraNoteText: { fontSize: 12, color: "#6b7280", lineHeight: 17, flex: 1 },

  // Checkbox row
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: "#d1d5db",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  checkboxChecked: { backgroundColor: "#1a73e8", borderColor: "#1a73e8" },
  checkboxLabel: { fontSize: 13, color: "#374151", flex: 1 },

  // Buttons
  primaryBtn: {
    backgroundColor: "#1a73e8",
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
    marginBottom: 12,
  },
  primaryBtnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 12,
  },
  secondaryBtnText: { color: "#374151", fontWeight: "600", fontSize: 15 },
  btnLoadingRow: { flexDirection: "row", alignItems: "center" },
  cancelBtn: {
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
  },
  cancelBtnText: { fontSize: 15, color: "#374151", fontWeight: "600" },

  // Polling views
  pollingTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
    marginTop: 20,
    marginBottom: 10,
    paddingHorizontal: 16,
  },
  pollingSubtitle: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  pollingHint: {
    fontSize: 12,
    color: "#9ca3af",
    textAlign: "center",
  },

  // Tara countdown
  countdownBox: {
    marginTop: 24,
    alignItems: "center",
    backgroundColor: "#eff6ff",
    borderRadius: 14,
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  countdownLabel: { fontSize: 12, color: "#6b7280", marginBottom: 4 },
  countdownValue: { fontSize: 36, fontWeight: "800", color: "#1a73e8", letterSpacing: 2 },

  // Failure view
  failureContainer: { alignItems: "center", paddingTop: 24, paddingBottom: 16 },
  failureTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#dc2626",
    marginTop: 16,
    marginBottom: 16,
  },
  failureReasonBox: {
    backgroundColor: "#fef2f2",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#fecaca",
    width: "100%",
    marginBottom: 24,
  },
  failureReason: { fontSize: 14, color: "#374151", textAlign: "center", lineHeight: 20 },
  failureActions: { width: "100%" },
  maxAttemptsBox: {
    alignItems: "center",
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    width: "100%",
    gap: 8,
  },
  maxAttemptsText: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    lineHeight: 20,
  },
});
