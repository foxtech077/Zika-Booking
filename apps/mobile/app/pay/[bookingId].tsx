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
  Modal,
  AppState,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, Stack, useNavigation } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { useStripe } from "@stripe/stripe-react-native";
import * as SecureStore from "expo-secure-store";
import { listingApi } from "../../lib/listing-api";
import { paymentApi } from "../../lib/payment-api";
import { initializeStripe, resolveStripePublishableKey } from "../../lib/stripe-config";

// ── Types ─────────────────────────────────────────────────────────────────────

type PaymentProvider = "stripe" | "tara";

interface BookingDetail {
  id: string;
  totalAmount: number;
  currency: string;
  reference: string;
  listingType: string;
  listingTitle: string;
  status: string;
  createdAt: string;
  listingId: string;
  checkIn?: string;
  checkOut?: string;
  pickupDatetime?: string;
  returnDatetime?: string;
  adults?: number;
  children?: number;
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
    publishableKey?: string;
    requiresAction?: boolean;
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

function parseExpiresAt(expiresAt: string): number {
  return new Date(expiresAt).getTime();
}

function useCountdown(expiresAt: string | null) {
  const [msLeft, setMsLeft] = useState<number>(-1);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => {
      const remaining = parseExpiresAt(expiresAt) - Date.now();
      setMsLeft(Math.max(0, remaining));
    };
    tick();

    const appStateSub = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        tick();
      }
    });

    intervalRef.current = setInterval(tick, 500);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      appStateSub.remove();
    };
  }, [expiresAt]);

  return msLeft;
}

// ── View states ───────────────────────────────────────────────────────────────

type ScreenView =
  | "select"        // method selection + input form
  | "stripe_polling" // polling Stripe status
  | "tara_waiting"  // waiting for Tara mobile confirmation
  | "success"       // navigating away
  | "failure";      // payment failed

interface StripePaymentSession {
  paymentId: string;
  clientSecret: string;
  publishableKey?: string;
}

function getPaymentErrorMessage(err: unknown): string {
  const res = (err as { response?: { data?: { message?: string } } })?.response;
  const message = res?.data?.message ?? (err as Error)?.message ?? "";
  if (message.includes("idempotencyKey") || message.includes("Unique constraint")) {
    return "A payment session is already open for this booking. Tap Pay Now again to continue.";
  }
  if (message.includes("Invalid API Key")) {
    return "Card payment could not start. Check your connection and try again, or use Mobile Money.";
  }
  if (
    message.includes("findUnique") ||
    message.includes("findFirst") ||
    message.includes("Cannot read properties") ||
    message.toLowerCase().includes("prisma") ||
    message.toLowerCase().includes("database")
  ) {
    return "Payment could not be processed. Please try again or contact support if the issue persists.";
  }
  return message || "An unexpected error occurred.";
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function PaymentScreen() {
  const router = useRouter();
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const navigation = useNavigation();

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

  // ── Expiry modal & rebooking state ────────────────────────────────────────
  const [expiredModal, setExpiredModal] = useState(false);
  const [reBookingLoading, setReBookingLoading] = useState(false);

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
  const stripeSessionRef = useRef<StripePaymentSession | null>(null);

  // ── Fetch booking detail ──────────────────────────────────────────────────
  const { data: booking, isLoading: bookingLoading, error: bookingError } = useQuery<BookingDetail>({
    queryKey: ["booking-for-payment", bookingId],
    queryFn: async () => {
      console.log("[PAY] Fetching booking detail for bookingId:", bookingId);
      try {
        const res = await listingApi.get<{ data: BookingDetail }>(`/guests/me/bookings/${bookingId}`);
        console.log("[PAY] Booking fetch SUCCESS — status:", res.status);
        console.log("[PAY] Booking data:", JSON.stringify(res.data.data, null, 2));
        return res.data.data;
      } catch (err: any) {
        console.log("[PAY] Booking fetch FAILED");
        console.log("[PAY] HTTP status:", err?.response?.status);
        console.log("[PAY] Response body:", JSON.stringify(err?.response?.data, null, 2));
        console.log("[PAY] Raw error message:", err?.message);
        throw err;
      }
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

  // ── Reset cached Stripe session when booking changes ──────────────────────
  useEffect(() => {
    stripeSessionRef.current = null;
  }, [bookingId]);

  // ── Cleanup on unmount ────────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (stripePollingRef.current) clearInterval(stripePollingRef.current);
      if (taraPollingRef.current) clearInterval(taraPollingRef.current);
      if (stripeTimeoutRef.current) clearTimeout(stripeTimeoutRef.current);
      if (taraIntervalRef.current) clearInterval(taraIntervalRef.current);
    };
  }, []);

  // ── Countdown & Expiry logic ──────────────────────────────────────────────
  const expiresAtIso = booking
    ? new Date(new Date(booking.createdAt).getTime() + 300_000).toISOString()
    : null;
  const msLeft = useCountdown(expiresAtIso);
  const isExpired = booking !== null && msLeft === 0;
  const isProcessing = isInitiating || view === "stripe_polling" || view === "tara_waiting";

  useEffect(() => {
    if (isExpired && !isProcessing) {
      setExpiredModal(true);
    }
  }, [isExpired, isProcessing]);

  // Block back navigation when processing
  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (e) => {
      if (isProcessing) {
        e.preventDefault();
      }
    });
    return unsubscribe;
  }, [navigation, isProcessing]);

  async function handleTryRebook() {
    if (!booking) return;
    setReBookingLoading(true);
    try {
      const guestsCount = (booking.adults ?? 0) + (booking.children ?? 0);
      const body: Record<string, unknown> = {
        listingId: booking.listingId,
        deliveryRequested: false,
      };
      if (booking.checkIn) body.checkIn = booking.checkIn.slice(0, 10);
      if (booking.checkOut) body.checkOut = booking.checkOut.slice(0, 10);
      if (booking.pickupDatetime) body.pickupDatetime = booking.pickupDatetime;
      if (booking.returnDatetime) body.returnDatetime = booking.returnDatetime;
      if (guestsCount > 0) body.guests = guestsCount;

      const res = await listingApi.post<{ data: { lockToken: string; expiresAt: string; pricingPreview: any } }>(
        "/bookings/initiate", body,
      );

      const raw = res.data.data.pricingPreview;
      const isCarRebook = !!raw.days;
      const mapped = {
        ratePerUnit: isCarRebook ? raw.dailyRate : raw.nightlyRate,
        units: isCarRebook ? raw.days : raw.nights,
        unitLabel: isCarRebook ? "days" : "nights",
        subtotal: raw.subtotal,
        discountAmount: raw.discountAmount ?? undefined,
        serviceFee: raw.serviceFee ?? undefined,
        taxAmount: raw.taxAmount ?? undefined,
        deliveryFee: raw.deliveryFee ?? undefined,
        total: raw.totalAmount,
        currency: raw.currency,
      };

      const lockStateObj = {
        lockToken: res.data.data.lockToken,
        expiresAt: res.data.data.expiresAt,
        pricingPreview: mapped,
      };
      const startMs = Date.now();

      // Persist the new active lock so checkout screen can pick it up
      const cacheData = {
        listingId: booking.listingId,
        checkIn: booking.checkIn ? booking.checkIn.slice(0, 10) : undefined,
        checkOut: booking.checkOut ? booking.checkOut.slice(0, 10) : undefined,
        pickupDatetime: booking.pickupDatetime,
        returnDatetime: booking.returnDatetime,
        guests: guestsCount,
        expiresAt: res.data.data.expiresAt,
        lockStartMs: startMs,
        lockState: lockStateObj,
      };
      await SecureStore.setItemAsync("ZIKA_ACTIVE_LOCK", JSON.stringify(cacheData));

      setExpiredModal(false);

      // Navigate back to booking flow
      router.replace({
        pathname: `/book/[listingId]` as any,
        params: {
          listingId: booking.listingId,
          ...(booking.checkIn ? { checkIn: booking.checkIn.slice(0, 10) } : {}),
          ...(booking.checkOut ? { checkOut: booking.checkOut.slice(0, 10) } : {}),
          ...(booking.pickupDatetime ? { pickupDatetime: booking.pickupDatetime } : {}),
          ...(booking.returnDatetime ? { returnDatetime: booking.returnDatetime } : {}),
          ...(guestsCount > 0 ? { guests: String(guestsCount) } : {}),
          listingTitle: booking.listingTitle,
        },
      });
    } catch (err: any) {
      const code = err?.response?.data?.error?.code ?? err?.response?.data?.code ?? err?.response?.data?.errors?.[0]?.code;
      const isUnavailable =
        code === "LISTING_UNAVAILABLE" || code === "LISTING_NOT_AVAILABLE" ||
        err?.response?.status === 404;
      if (isUnavailable) {
        Alert.alert("Unavailable", "Listing is no longer available for the selected dates.");
      } else {
        Alert.alert("Could not rebook", err?.response?.data?.message ?? "Please try again.");
      }
    } finally {
      setReBookingLoading(false);
    }
  }

  function handleSearchAgain() {
    setExpiredModal(false);
    router.replace("/(tabs)");
  }

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
        const statusRes = await paymentApi.get<PaymentStatusResponse>(`/${paymentId}/status`);
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
        const statusRes = await paymentApi.get<PaymentStatusResponse>(`/${paymentId}/status`);
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
    stripeSessionRef.current = null;
    setView("success");
    void queryClient.invalidateQueries({ queryKey: ["booking", bookingId] });
    void queryClient.invalidateQueries({ queryKey: ["myBookings"] });
    router.replace("/booking/submitted");
  }

  // ── Pay button handler ────────────────────────────────────────────────────
  async function handlePay() {
    if (msLeft === 0) {
      setExpiredModal(true);
      return;
    }
    // ── Stripe Payment Sheet flow ─────────────────────────────────────────
    if (provider === "stripe") {
      setIsInitiating(true);
      try {
        let session = stripeSessionRef.current;

        if (!session) {
          if (selectedSavedMethodId) {
            // ── Saved card: POST /payments/initiate (off-session charge) ──────
            const savedCardPayload = {
              bookingId,
              paymentProvider: "stripe",
              paymentMethodId: selectedSavedMethodId,
            };
            console.log("[PAY] Saved-card Stripe — POST /payments/initiate:", JSON.stringify(savedCardPayload, null, 2));
            try {
              const res = await paymentApi.post<InitiateResponse>("/payments/initiate", savedCardPayload);
              console.log("[PAY] /payments/initiate SUCCESS — status:", res.status);
              console.log("[PAY] /payments/initiate response:", JSON.stringify(res.data, null, 2));

              const { paymentId, clientSecret, requiresAction } = res.data.data;
              setAttemptCount((c) => c + 1);

              if (requiresAction && clientSecret) {
                // 3DS authentication needed — fall through to Payment Sheet
                session = { paymentId, clientSecret };
                stripeSessionRef.current = session;
              } else {
                // Off-session charge succeeded immediately — go straight to polling
                stripeSessionRef.current = null;
                setIsInitiating(false);
                setView("stripe_polling");
                startStripePolling(paymentId);
                return;
              }
            } catch (savedErr: any) {
              console.log("[PAY] /payments/initiate (saved card) FAILED");
              console.log("[PAY] HTTP status:", savedErr?.response?.status);
              console.log("[PAY] Response body:", JSON.stringify(savedErr?.response?.data, null, 2));
              console.log("[PAY] Raw error message:", savedErr?.message);
              throw savedErr;
            }
          } else {
            // ── New card: POST /create-intent → clientSecret → Payment Sheet ──
            const newCardPayload = { bookingId };
            console.log("[PAY] New-card Stripe — POST /create-intent:", JSON.stringify(newCardPayload, null, 2));
            try {
              const res = await paymentApi.post<InitiateResponse>("/create-intent", newCardPayload);
              console.log("[PAY] /create-intent SUCCESS — status:", res.status);
              console.log("[PAY] /create-intent response:", JSON.stringify(res.data, null, 2));

              const { paymentId, clientSecret, publishableKey } = res.data.data;
              if (!clientSecret) {
                console.log("[PAY] ERROR: clientSecret missing in /create-intent response");
                Alert.alert("Payment Error", "Could not initialise payment. Please try again.");
                return;
              }

              session = { paymentId, clientSecret, publishableKey };
              stripeSessionRef.current = session;
              setAttemptCount((c) => c + 1);
            } catch (intentErr: any) {
              console.log("[PAY] /create-intent FAILED");
              console.log("[PAY] HTTP status:", intentErr?.response?.status);
              console.log("[PAY] Response body:", JSON.stringify(intentErr?.response?.data, null, 2));
              console.log("[PAY] Raw error message:", intentErr?.message);
              throw intentErr;
            }
          }
        }

        const { paymentId, clientSecret, publishableKey } = session;

        const stripeInitError = await initializeStripe(publishableKey);
        if (stripeInitError) {
          Alert.alert("Payment Error", stripeInitError);
          return;
        }

        const resolvedKey = resolveStripePublishableKey(publishableKey);
        const isTestKey = resolvedKey.startsWith("pk_test");
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
          Alert.alert("Payment Error", getPaymentErrorMessage({ message: initError.message }));
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

        stripeSessionRef.current = null;
        setView("stripe_polling");
        startStripePolling(paymentId);
      } catch (err: any) {
        console.log("[PAY] Stripe outer catch triggered");
        console.log("[PAY] HTTP status:", err?.response?.status);
        console.log("[PAY] Response body:", JSON.stringify(err?.response?.data, null, 2));
        console.log("[PAY] Raw error message:", err?.message);
        const status = err?.response?.status;
        const code = err?.response?.data?.error?.code ?? err?.response?.data?.code;
        const rawMessage = err?.response?.data?.message ?? err?.message ?? "";
        if (status === 429 || code === "PAYMENT_ATTEMPTS_EXCEEDED") {
          setFailureReason("Too many payment attempts. Your reservation has been released.");
          setAttemptCount(3);
          setView("failure");
        } else if (status === 409) {
          setFailureReason("This booking is no longer available for payment.");
          setAttemptCount(3);
          setView("failure");
        } else if (rawMessage.includes("idempotencyKey") || rawMessage.includes("Unique constraint")) {
          Alert.alert(
            "Payment Error",
            "A payment session is already open for this booking. Tap Pay Now again to continue with the same session.",
          );
        } else {
          Alert.alert("Payment Error", getPaymentErrorMessage(err));
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
      const taraPayload = {
        bookingId,
        paymentProvider: "tara",
        mobileNumber: fullMobileNumber,
        ...(selectedSavedMethodId ? { savedPaymentMethodId: selectedSavedMethodId } : {}),
      };
      console.log("[PAY] Initiating Tara payment — request body:", JSON.stringify(taraPayload, null, 2));

      const res = await paymentApi.post<InitiateResponse>("/initiate", taraPayload);
      console.log("[PAY] Tara initiate SUCCESS — status:", res.status);
      console.log("[PAY] Tara initiate response:", JSON.stringify(res.data, null, 2));

      const { paymentId } = res.data.data;
      setAttemptCount((c) => c + 1);

      setView("tara_waiting");
      startTaraCountdown();
      startTaraPolling(paymentId);
    } catch (err: any) {
      console.log("[PAY] Tara initiate FAILED");
      console.log("[PAY] HTTP status:", err?.response?.status);
      console.log("[PAY] Response body:", JSON.stringify(err?.response?.data, null, 2));
      console.log("[PAY] Raw error message:", err?.message);
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
        Alert.alert("Payment Error", getPaymentErrorMessage(err));
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
    stripeSessionRef.current = null;
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
      <Stack.Screen
        options={{
          headerBackVisible: !isProcessing,
          headerLeft: isProcessing ? () => null : undefined,
          gestureEnabled: !isProcessing,
        }}
      />

      {/* Expired Modal */}
      <Modal visible={expiredModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Ionicons name="time" size={48} color="#dc2626" />
            <Text style={styles.modalTitle}>Reservation Expired</Text>
            <Text style={styles.modalBody}>
              Your reservation lock has expired and the selected dates are no longer guaranteed.
            </Text>
            {/* Primary: Try to Rebook */}
            <TouchableOpacity
              style={[styles.primaryBtn, reBookingLoading && styles.primaryBtnDisabled, { width: "100%" }]}
              onPress={() => void handleTryRebook()}
              disabled={reBookingLoading}
            >
              {reBookingLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.primaryBtnText}>Try to Rebook</Text>
              )}
            </TouchableOpacity>
            {/* Secondary: Search Again */}
            <TouchableOpacity
              style={[styles.modalSecondaryBtn, { width: "100%" }]}
              onPress={handleSearchAgain}
              disabled={reBookingLoading}
            >
              <Text style={styles.modalSecondaryBtnText}>Search Again</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
              stripeSessionRef.current = null;
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
              stripeSessionRef.current = null;
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
          style={[styles.primaryBtn, isProcessing && styles.primaryBtnDisabled]}
          onPress={() => void handlePay()}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <View style={styles.btnLoadingRow}>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={[styles.primaryBtnText, { marginLeft: 8 }]}>Processing Payment...</Text>
            </View>
          ) : (
            <Text style={styles.primaryBtnText}>Pay Now</Text>
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

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 28,
    alignItems: "center",
    width: "100%",
    maxWidth: 360,
    gap: 12,
  },
  modalTitle: { fontSize: 20, fontWeight: "700", color: "#111827", textAlign: "center" },
  modalBody: { fontSize: 14, color: "#6b7280", textAlign: "center", lineHeight: 20, marginBottom: 12 },
  modalSecondaryBtn: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    width: "100%",
  },
  modalSecondaryBtnText: { color: "#374151", fontWeight: "600", fontSize: 15 },

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
