import { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
  Modal,
  StyleSheet,
  Animated,
  AppState,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import { listingApi } from "../../lib/listing-api";
import { useAuthStore } from "../../store/auth";
import { useReleaseLock } from "../../hooks/booking";
import { VoucherSelector } from "../../components/checkout/VoucherSelector";
import type { ActivityScope } from "../../lib/types/voucher";
import { useActivePromotion, applyPromotion } from "../../lib/promotions";

// ── Types ─────────────────────────────────────────────────────────────────────

interface PricingPreview {
  ratePerUnit: number;
  units: number;
  unitLabel: string; // "nights" | "days"
  subtotal: number;
  discountAmount?: number;
  serviceFee?: number;
  taxAmount?: number;
  deliveryFee?: number;
  total: number;
  currency: string;
  cancellationPolicyName?: string;
}

interface LockState {
  lockToken: string;
  expiresAt: string; // ISO
  pricingPreview: PricingPreview;
}

interface PendingBooking {
  id: string;
  reference: string;
  status: string;
  listingTitle: string;
  totalAmount: number;
  currency: string;
  checkIn?: string;
  checkOut?: string;
  pickupDatetime?: string;
  returnDatetime?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatCurrency(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString()}`;
}

function msToCountdown(ms: number): string {
  if (ms <= 0) return "0:00";
  const totalSec = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSec / 60);
  const seconds = totalSec % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function parseExpiresAt(expiresAt: string): number {
  return new Date(expiresAt).getTime();
}

// ── Step Indicator ────────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: number }) {
  const labels = ["Guest Details", "Review & Price", "Payment"];
  return (
    <View style={styles.stepIndicatorRow}>
      {labels.map((label, i) => (
        <View key={label} style={styles.stepIndicatorItem}>
          <View
            style={[
              styles.stepDot,
              i < current && styles.stepDotDone,
              i === current && styles.stepDotActive,
            ]}
          />
          <Text
            style={[
              styles.stepLabel,
              i === current && styles.stepLabelActive,
              i < current && styles.stepLabelDone,
            ]}
          >
            {label}
          </Text>
        </View>
      ))}
    </View>
  );
}

// ── Countdown Timer Hook ──────────────────────────────────────────────────────

function useCountdown(expiresAt: string | null) {
  // -1 = not yet calculated (prevents false "expired" on first render)
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

// ── Main Component ────────────────────────────────────────────────────────────

export default function BookingFlowScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const params = useLocalSearchParams<{
    listingId: string;
    roomTypeId?: string;
    checkIn?: string;
    checkOut?: string;
    pickupDatetime?: string;
    returnDatetime?: string;
    guests?: string;
    listingTitle?: string;
    listingCategory?: string;
  }>();

  const {
    listingId,
    roomTypeId,
    checkIn,
    checkOut,
    pickupDatetime,
    returnDatetime,
    guests,
    listingTitle,
    listingCategory,
  } = params;

  const checkoutPromo = useActivePromotion(listingCategory ?? null);

  const isCar = !!pickupDatetime;
  const isHotelOrApartment = !isCar;

  // ── Step state ────────────────────────────────────────────────────────────
  const [step, setStep] = useState(0);

  // ── Lock state ────────────────────────────────────────────────────────────
  const [lockState, setLockState] = useState<LockState | null>(null);
  const [lockError, setLockError] = useState<string | null>(null);
  const [lockErrorMessage, setLockErrorMessage] = useState<string | null>(null);
  const [lockLoading, setLockLoading] = useState(true);
  const [expiredModal, setExpiredModal] = useState(false);
  const [lockRetryKey, setLockRetryKey] = useState(0);
  const [reBookingLoading, setReBookingLoading] = useState(false);
  // Records the timestamp when the current lock was first established (for progress bar)
  const lockStartMsRef = useRef<number | null>(null);
  // Animated value for red-state pulse
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Lock release on unmount
  const releaseLockMutation = useReleaseLock();
  const lockStateRef = useRef<LockState | null>(null);
  const bookingCreatedRef = useRef(false);

  // ── Pending-payment bookings (shown when 429 occurs) ──────────────────────
  const [pendingBookings, setPendingBookings] = useState<PendingBooking[]>([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [discardingId, setDiscardingId] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  // ── Guest Details form ────────────────────────────────────────────────────
  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [lastName, setLastName] = useState(user?.lastName ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState("");
  // Hotels/apartments
  const [adults, setAdults] = useState(parseInt(guests ?? "1", 10) || 1);
  const [children, setChildren] = useState(0);
  const [specialRequests, setSpecialRequests] = useState("");
  // Cars
  const [driverFirstName, setDriverFirstName] = useState(user?.firstName ?? "");
  const [driverLastName, setDriverLastName] = useState(user?.lastName ?? "");
  const [driverAge, setDriverAge] = useState("");
  const [deliveryRequested, setDeliveryRequested] = useState(false);
  const [deliveryAddress, setDeliveryAddress] = useState("");

  // ── Review step ───────────────────────────────────────────────────────────
  const [termsChecked, setTermsChecked] = useState(false);

  // ── Voucher / promo code ──────────────────────────────────────────────────
  const [voucherCode, setVoucherCode] = useState("");
  const [voucherDiscount, setVoucherDiscount] = useState<number | null>(null);

  // ── Countdown ─────────────────────────────────────────────────────────────
  const msLeft = useCountdown(lockState?.expiresAt ?? null);
  // msLeft === -1 means "not yet calculated" — only treat as expired when it genuinely hits 0
  const isExpired = lockState !== null && msLeft === 0;

  // Derive timer state label
  const timerState: "green" | "amber" | "red" | null =
    msLeft < 0 || !lockState ? null
      : msLeft > 120_000 ? "green"
        : msLeft > 30_000 ? "amber"
          : msLeft > 0 ? "red"
            : null;

  // Record the lock start time once the lock is first set
  useEffect(() => {
    if (lockState && lockStartMsRef.current === null) {
      lockStartMsRef.current = Date.now();
    }
  }, [lockState]);

  // Keep lockStateRef in sync so the unmount cleanup can read the latest token
  useEffect(() => {
    lockStateRef.current = lockState;
  }, [lockState]);

  // Release the lock if user leaves without completing a booking
  useEffect(() => {
    return () => {
      if (!bookingCreatedRef.current && lockStateRef.current?.lockToken) {
        releaseLockMutation.mutate(lockStateRef.current.lockToken);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pulse animation — only active during red state
  useEffect(() => {
    if (timerState === "red") {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.55, duration: 500, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [timerState, pulseAnim]);

  useEffect(() => {
    if (isExpired && step < 2) {
      setExpiredModal(true);
    }
  }, [isExpired, step]);

  // Progress bar: fraction of time remaining vs. total lock duration (5 min)
  const LOCK_TOTAL_MS = 300_000;
  const progressFraction =
    msLeft < 0 ? 1
      : Math.max(0, Math.min(1, msLeft / LOCK_TOTAL_MS));

  // ── Try to Rebook handler ─────────────────────────────────────────────────
  async function handleTryRebook() {
    setReBookingLoading(true);
    try {
      const body: Record<string, unknown> = { listingId, deliveryRequested: false };
      if (roomTypeId) body.roomTypeId = roomTypeId;
      if (checkIn) body.checkIn = checkIn;
      if (checkOut) body.checkOut = checkOut;
      if (pickupDatetime) body.pickupDatetime = pickupDatetime;
      if (returnDatetime) body.returnDatetime = returnDatetime;
      if (guests) body.guests = parseInt(guests, 10);

      const res = await listingApi.post<{ data: { lockToken: string; expiresAt: string; pricingPreview: any } }>(
        "/bookings/initiate", body,
      );
      // Backend (/bookings/initiate) returns { units, baseAmount, promotionDiscount,
      // voucherDiscount, serviceFee, taxAmount, deliveryFee, totalAmount, currency } —
      // there is no nightlyRate/dailyRate/days/nights/subtotal/discountAmount field,
      // so those must be derived rather than read directly.
      const raw = res.data.data.pricingPreview ?? {};
      const rebookUnits = raw.units ?? 0;
      const rebookBaseAmount = raw.baseAmount ?? 0;
      const mapped: PricingPreview = {
        ratePerUnit: rebookUnits > 0 ? rebookBaseAmount / rebookUnits : 0,
        units: rebookUnits,
        unitLabel: isCar ? "days" : "nights",
        subtotal: rebookBaseAmount,
        discountAmount: raw.promotionDiscount || undefined,
        serviceFee: raw.serviceFee ?? undefined,
        taxAmount: raw.taxAmount ?? undefined,
        deliveryFee: raw.deliveryFee ?? undefined,
        total: raw.totalAmount ?? 0,
        currency: raw.currency ?? "",
      };

      const lockStateObj = {
        lockToken: res.data.data.lockToken,
        expiresAt: res.data.data.expiresAt,
        pricingPreview: mapped,
      };
      const startMs = Date.now();
      lockStartMsRef.current = startMs;
      setLockState(lockStateObj);

      // Persist new lock
      const cacheData = {
        listingId,
        checkIn,
        checkOut,
        pickupDatetime,
        returnDatetime,
        guests,
        expiresAt: res.data.data.expiresAt,
        lockStartMs: startMs,
        lockState: lockStateObj,
      };
      await SecureStore.setItemAsync("ZIKA_ACTIVE_LOCK", JSON.stringify(cacheData));

      setStep(0);
      setExpiredModal(false);
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

  // ── Fetch pending-payment bookings from backend ───────────────────────────
  const fetchPendingBookings = useCallback(async () => {
    setPendingLoading(true);
    try {
      const res = await listingApi.get<{ data: { bookings: any[] } }>(
        "/guests/me/bookings?status=upcoming&cursor=0"
      );
      const all: any[] = res.data.data.bookings ?? [];
      setPendingBookings(
        all
          .filter((b) => b.status === "pending_payment")
          .map((b) => ({
            id: b.id,
            reference: b.reference,
            status: b.status,
            listingTitle: b.listingTitle,
            totalAmount: b.totalAmount,
            currency: b.currency,
            checkIn: b.checkIn,
            checkOut: b.checkOut,
            pickupDatetime: b.pickupDatetime,
            returnDatetime: b.returnDatetime,
          }))
      );
    } catch {
      // silent — user can still use "View My Bookings" fallback
    } finally {
      setPendingLoading(false);
    }
  }, []);

  // ── Discard a single pending-payment booking ──────────────────────────────
  async function handleDiscardPending(bookingId: string) {
    setDiscardingId(bookingId);
    try {
      await listingApi.patch(`/bookings/${bookingId}/fail`, { failureReason: "Cancelled by guest" });
      setPendingBookings((prev) => prev.filter((b) => b.id !== bookingId));
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.message ?? "Could not discard booking. Please try again.");
    } finally {
      setDiscardingId(null);
    }
  }

  // ── Initiate lock — runs on mount and on retry ────────────────────────────
  useEffect(() => {
    async function initiateLock() {
      setLockLoading(true);
      setLockError(null);
      setLockErrorMessage(null);

      // Try active lock recovery first
      try {
        const cachedLockRaw = await SecureStore.getItemAsync("ZIKA_ACTIVE_LOCK");
        if (cachedLockRaw) {
          const cached = JSON.parse(cachedLockRaw);
          const isMatch =
            cached.listingId === listingId &&
            cached.checkIn === checkIn &&
            cached.checkOut === checkOut &&
            cached.pickupDatetime === pickupDatetime &&
            cached.returnDatetime === returnDatetime &&
            (guests ? cached.guests === guests : !cached.guests);

          const expiresAtMs = new Date(cached.expiresAt).getTime();
          if (isMatch && expiresAtMs > Date.now()) {
            lockStartMsRef.current = cached.lockStartMs ?? Date.now();
            setLockState(cached.lockState);
            setLockLoading(false);
            return;
          }
        }
      } catch (e) {
        console.warn("Failed to retrieve active lock from SecureStore:", e);
      }

      try {
        const body: Record<string, unknown> = {
          listingId,
          deliveryRequested: false,
        };
        if (roomTypeId) body.roomTypeId = roomTypeId;
        if (checkIn) body.checkIn = checkIn;
        if (checkOut) body.checkOut = checkOut;
        if (pickupDatetime) body.pickupDatetime = pickupDatetime;
        if (returnDatetime) body.returnDatetime = returnDatetime;
        if (guests) body.guests = parseInt(guests, 10);

        const res = await listingApi.post<{ data: { lockToken: string; expiresAt: string; pricingPreview: any } }>(
          "/bookings/initiate", body,
        );

        // Backend (/bookings/initiate) returns { units, baseAmount, promotionDiscount,
        // voucherDiscount, serviceFee, taxAmount, deliveryFee, totalAmount, currency } —
        // there is no nightlyRate/dailyRate/days/nights/subtotal/discountAmount field,
        // so those must be derived rather than read directly.
        const raw = res.data.data.pricingPreview ?? {};
        const units = raw.units ?? 0;
        const baseAmount = raw.baseAmount ?? 0;
        const mapped: PricingPreview = {
          ratePerUnit: units > 0 ? baseAmount / units : 0,
          units,
          unitLabel: isCar ? "days" : "nights",
          subtotal: baseAmount,
          discountAmount: raw.promotionDiscount || undefined,
          serviceFee: raw.serviceFee ?? undefined,
          taxAmount: raw.taxAmount ?? undefined,
          deliveryFee: raw.deliveryFee ?? undefined,
          total: raw.totalAmount ?? 0,
          currency: raw.currency ?? "",
        };

        const lockStateObj = {
          lockToken: res.data.data.lockToken,
          expiresAt: res.data.data.expiresAt,
          pricingPreview: mapped,
        };
        const startMs = Date.now();
        lockStartMsRef.current = startMs;
        setLockState(lockStateObj);

        // Persist lock
        const cacheData = {
          listingId,
          checkIn,
          checkOut,
          pickupDatetime,
          returnDatetime,
          guests,
          expiresAt: res.data.data.expiresAt,
          lockStartMs: startMs,
          lockState: lockStateObj,
        };
        await SecureStore.setItemAsync("ZIKA_ACTIVE_LOCK", JSON.stringify(cacheData));
      } catch (err: any) {
        console.warn("LOCK INITIATION ERROR:", JSON.stringify(err?.response?.data), "status:", err?.response?.status, "msg:", err?.message);
        const status = err?.response?.status;
        const code = err?.response?.data?.error?.code ?? err?.response?.data?.code ?? err?.response?.data?.errors?.[0]?.code;
        const errMsg =
          err?.response?.data?.error?.message ??
          err?.response?.data?.message ??
          err?.response?.data?.errors?.[0]?.message ??
          err?.message;
        if (code === "LISTING_UNAVAILABLE" || code === "LISTING_NOT_AVAILABLE") {
          setLockError("unavailable");
        } else if (status === 401 || code === "NO_TOKEN" || code === "INVALID_TOKEN" || code === "UNAUTHORIZED") {
          setLockError("auth");
        } else if (status === 404) {
          setLockError("unavailable");
        } else if (status === 429) {
          setLockError("pending_limit");
          void fetchPendingBookings();
        } else {
          setLockError("generic");
          const statusHint = status ? ` (HTTP ${status})` : "";
          setLockErrorMessage(errMsg ? `${errMsg}${statusHint}` : `Unable to secure this reservation${statusHint}. The listing may not be available for booking yet. Please go back and try again.`);
        }
      } finally {
        setLockLoading(false);
        setRetrying(false);
      }
    }
    void initiateLock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lockRetryKey]);

  // ── Renew lock mutation ───────────────────────────────────────────────────
  const renewMutation = useMutation({
    mutationFn: async () => {
      const res = await listingApi.post<{ data: { expiresAt: string } }>(
        "/bookings/lock/renew",
        { lockToken: lockState!.lockToken }
      );
      return res.data.data.expiresAt;
    },
    onSuccess: (newExpiresAt) => {
      setLockState((prev) => {
        if (!prev) return prev;
        const updated = { ...prev, expiresAt: newExpiresAt };

        // Update persisted lock
        SecureStore.getItemAsync("ZIKA_ACTIVE_LOCK").then((cachedLockRaw) => {
          if (cachedLockRaw) {
            const cached = JSON.parse(cachedLockRaw);
            cached.expiresAt = newExpiresAt;
            cached.lockState.expiresAt = newExpiresAt;
            SecureStore.setItemAsync("ZIKA_ACTIVE_LOCK", JSON.stringify(cached));
          }
        }).catch(() => { });

        return updated;
      });
    },
    onError: () => {
      Alert.alert("Renewal failed", "Could not extend your reservation. Please try again.");
    },
  });

  // ── Create booking mutation ───────────────────────────────────────────────
  const createBookingMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        lockToken: lockState!.lockToken,
        listingId,
        guestFirstName: firstName,
        guestLastName: lastName,
        guestEmail: email,
      };
      if (voucherCode) body.voucherCode = voucherCode;
      if (phone) body.guestPhone = phone;
      if (checkIn) body.checkIn = checkIn;
      if (checkOut) body.checkOut = checkOut;
      if (pickupDatetime) body.pickupDatetime = pickupDatetime;
      if (returnDatetime) body.returnDatetime = returnDatetime;
      if (isHotelOrApartment) {
        body.adults = adults;
        body.children = children;
        if (specialRequests.trim()) body.specialRequests = specialRequests.trim();
      }
      if (isCar) {
        body.driverFirstName = driverFirstName;
        body.driverLastName = driverLastName;
        body.driverAge = parseInt(driverAge, 10);
        body.deliveryRequested = deliveryRequested;
        if (deliveryRequested && deliveryAddress.trim()) {
          body.deliveryAddress = deliveryAddress.trim();
        }
      }
      const res = await listingApi.post<{
        data: {
          bookingId: string;
          bookingReference: string;
          totalAmount: number;
          currency: string;
          status: string;
        };
      }>("/bookings", body);
      return res.data.data;
    },
    onSuccess: (data) => {
      bookingCreatedRef.current = true;
      SecureStore.deleteItemAsync("ZIKA_ACTIVE_LOCK").catch(() => { });
      router.push({
        pathname: "/pay/[bookingId]",
        params: {
          bookingId: data.bookingId,
          lockExpiresAt: lockState?.expiresAt ?? "",
        },
      });
    },
    onError: (err: any) => {
      const code = err?.response?.data?.error?.code ?? err?.response?.data?.code;
      if (code === "LOCK_EXPIRED") {
        setExpiredModal(true);
      } else {
        const message =
          err?.response?.data?.message ??
          err?.message ??
          "Something went wrong. Please try again.";
        Alert.alert("Booking Failed", message);
      }
    },
  });

  // ── Validation ────────────────────────────────────────────────────────────
  function validateStep0(): string | null {
    if (!firstName.trim()) return "First name is required.";
    if (!lastName.trim()) return "Last name is required.";
    if (!email.trim()) return "Email is required.";
    if (isCar) {
      if (!driverFirstName.trim()) return "Driver first name is required.";
      if (!driverLastName.trim()) return "Driver last name is required.";
      const parsedAge = parseInt(driverAge, 10);
      if (!driverAge.trim() || isNaN(parsedAge)) return "Driver age is required.";
      if (parsedAge < 18) return "Driver must be at least 18 years old.";
      if (parsedAge > 120) return "Please enter a valid driver age.";
      if (deliveryRequested && !deliveryAddress.trim()) return "Delivery address is required.";
    }
    return null;
  }

  function handleContinue() {
    const err = validateStep0();
    if (err) {
      Alert.alert("Missing information", err);
      return;
    }
    setStep(1);
  }

  // ── Date formatting helpers ───────────────────────────────────────────────
  function formatDateRange(): string {
    if (isCar && pickupDatetime && returnDatetime) {
      const p = new Date(pickupDatetime);
      const r = new Date(returnDatetime);
      const days = lockState?.pricingPreview?.units ?? 1;
      return `Car · ${formatDateTime(p)} → ${formatDateTime(r)} (${days} ${days === 1 ? "day" : "days"})`;
    }
    if (checkIn && checkOut) {
      const ci = new Date(checkIn);
      const co = new Date(checkOut);
      const nights = lockState?.pricingPreview?.units ?? 1;
      return `Hotel · ${formatShortDate(ci)} – ${formatShortDate(co)} (${nights} ${nights === 1 ? "night" : "nights"})`;
    }
    return "";
  }

  function formatShortDate(d: Date): string {
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  }

  function formatDateTime(d: Date): string {
    return `${formatShortDate(d)} ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
  }

  // ── Render: Loading ───────────────────────────────────────────────────────
  if (lockLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: listingTitle || "Book", headerBackTitle: "Back" }} />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#16a34a" />
          <Text style={styles.loadingText}>Securing your reservation...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Render: Lock unavailable error ────────────────────────────────────────
  if (lockError === "unavailable") {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: listingTitle || "Book", headerBackTitle: "Back" }} />
        <View style={styles.centered}>
          <Ionicons name="close-circle" size={64} color="#dc2626" />
          <Text style={styles.errorTitle}>Listing Unavailable</Text>
          <Text style={styles.errorBody}>
            This listing is no longer available for your selected dates.
          </Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => router.back()}>
            <Text style={styles.primaryBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (lockError === "auth") {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: listingTitle || "Book", headerBackTitle: "Back" }} />
        <View style={styles.centered}>
          <Ionicons name="lock-closed" size={64} color="#16a34a" />
          <Text style={styles.errorTitle}>Sign in to book</Text>
          <Text style={styles.errorBody}>
            You need to be signed in to make a reservation.
          </Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => router.replace("/(auth)/login")}>
            <Text style={styles.primaryBtnText}>Sign In</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.secondaryBtn, { marginTop: 8 }]} onPress={() => router.back()}>
            <Text style={styles.secondaryBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (lockError === "pending_limit") {
    const allCleared = !pendingLoading && pendingBookings.length === 0;
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: listingTitle || "Book", headerBackTitle: "Back" }} />
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {/* Header */}
          <View style={styles.pendingHeader}>
            <Ionicons name="time-outline" size={52} color="#f59e0b" />
            <Text style={styles.errorTitle}>Bookings Awaiting Payment</Text>
            <Text style={styles.errorBody}>
              You have one or more bookings waiting for payment. Complete payment or discard them below to create a new booking.
            </Text>
          </View>

          {/* Pending bookings list from backend */}
          {pendingLoading ? (
            <ActivityIndicator color="#16a34a" style={{ marginVertical: 24 }} />
          ) : pendingBookings.length > 0 ? (
            <View style={styles.pendingList}>
              {pendingBookings.map((b) => {
                const dateStr = b.checkIn && b.checkOut
                  ? `${b.checkIn} – ${b.checkOut}`
                  : b.pickupDatetime
                    ? new Date(b.pickupDatetime).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
                    : "";
                return (
                  <View key={b.id} style={styles.pendingCard}>
                    <View style={{ flex: 1, marginRight: 12 }}>
                      <Text style={styles.pendingCardTitle} numberOfLines={1}>{b.listingTitle}</Text>
                      <Text style={styles.pendingCardRef}>{b.reference}</Text>
                      {dateStr ? <Text style={styles.pendingCardDate}>{dateStr}</Text> : null}
                      <Text style={styles.pendingCardAmount}>
                        {b.currency} {b.totalAmount?.toLocaleString()}
                      </Text>
                    </View>
                    <View style={styles.pendingCardBtns}>
                      <TouchableOpacity
                        style={styles.pendingPayBtn}
                        onPress={() => router.push({ pathname: "/pay/[bookingId]", params: { bookingId: b.id } })}
                      >
                        <Text style={styles.pendingPayBtnText}>Pay</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.pendingDiscardBtn}
                        onPress={() => void handleDiscardPending(b.id)}
                        disabled={discardingId === b.id}
                      >
                        {discardingId === b.id
                          ? <ActivityIndicator size="small" color="#dc2626" />
                          : <Text style={styles.pendingDiscardBtnText}>Discard</Text>
                        }
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : null}

          {/* After all discarded — retry lock */}
          {allCleared && (
            <View style={styles.pendingRetryBox}>
              <Ionicons name="checkmark-circle-outline" size={28} color="#16a34a" />
              <Text style={styles.pendingRetryText}>All cleared! You can now create your booking.</Text>
              <TouchableOpacity
                style={[styles.primaryBtn, retrying && styles.primaryBtnDisabled, { marginTop: 8 }]}
                onPress={() => { setRetrying(true); setLockRetryKey((k) => k + 1); }}
                disabled={retrying}
              >
                {retrying
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={styles.primaryBtnText}>Try Booking Again</Text>
                }
              </TouchableOpacity>
            </View>
          )}

          {/* Fallback navigation */}
          {!allCleared && (
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => router.replace("/(tabs)/bookings" as any)}
            >
              <Text style={styles.primaryBtnText}>View My Bookings</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={[styles.secondaryBtn, { marginTop: 8 }]} onPress={() => router.back()}>
            <Text style={styles.secondaryBtnText}>Go Back</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (lockError === "generic") {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: listingTitle || "Book", headerBackTitle: "Back" }} />
        <View style={styles.centered}>
          <Ionicons name="warning" size={64} color="#f59e0b" />
          <Text style={styles.errorTitle}>Could not secure reservation</Text>
          <Text style={styles.errorBody}>
            {lockErrorMessage}
          </Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => router.back()}>
            <Text style={styles.primaryBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const pricing = lockState?.pricingPreview;

  // The backend's /bookings/initiate never actually computes a real promotion
  // discount (it's hardcoded to a stubbed 0 — see "STEP 2: promotion logic" in
  // routes/bookings.ts), so the same active-promotion lookup used on listing
  // cards is reused here and applied client-side to the per-unit rate, then
  // scaled by the number of nights/days — this is a frontend-only fix.
  const promo = applyPromotion(pricing?.ratePerUnit ?? null, checkoutPromo);
  const promoDiscountTotal = promo.hasPromotion
    ? Math.round((promo.savings ?? 0) * (pricing?.units ?? 0) * 100) / 100
    : 0;
  const promoBadgeLabel =
    promo.hasPromotion && checkoutPromo
      ? checkoutPromo.discountType === "percentage"
        ? `${parseFloat(checkoutPromo.discountValue) || 0}% OFF`
        : `${formatCurrency(parseFloat(checkoutPromo.discountValue) || 0, pricing?.currency ?? "")} OFF`
      : null;

  return (
    <View style={styles.container}>
      {/* Dynamic header title */}
      <Stack.Screen options={{ title: listingTitle ? listingTitle : "Book", headerBackTitle: "Back" }} />

      {/* Step indicator */}
      <StepIndicator current={step} />

      {/* ── Timer section (steps 0 and 1) ────────────────────────────── */}
      {step < 2 && lockState && msLeft >= 0 && timerState !== null && (
        <View>
          {/* Colour-coded banner */}
          {timerState === "green" && (
            <View style={styles.timerBannerGreen}>
              <Ionicons name="checkmark-circle-outline" size={15} color="#15803d" />
              <Text style={styles.timerTextGreen}>Booking held — complete payment</Text>
            </View>
          )}
          {timerState === "amber" && (
            <View style={styles.timerBannerAmber}>
              <Ionicons name="warning-outline" size={15} color="#92400e" />
              <Text style={styles.timerTextAmber}>
                Hurry — only{" "}
                <Text style={{ fontWeight: "800" }}>{msToCountdown(msLeft)}</Text>
                {" "}remaining!
              </Text>
              <TouchableOpacity
                style={styles.renewBtn}
                onPress={() => renewMutation.mutate()}
                disabled={renewMutation.isPending}
              >
                {renewMutation.isPending
                  ? <ActivityIndicator size="small" color="#92400e" />
                  : <Text style={styles.renewBtnText}>Extend</Text>}
              </TouchableOpacity>
            </View>
          )}
          {timerState === "red" && (
            <Animated.View style={[styles.timerBannerRed, { opacity: pulseAnim }]}>
              <Ionicons name="alert-circle" size={15} color="#fff" />
              <Text style={styles.timerTextRed}>Less than 30 seconds — pay now!</Text>
            </Animated.View>
          )}

          {/* Progress bar */}
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${Math.round(progressFraction * 100)}%` as any,
                  backgroundColor:
                    timerState === "green" ? "#16a34a"
                      : timerState === "amber" ? "#d97706"
                        : "#dc2626",
                },
              ]}
            />
          </View>
        </View>
      )}

      {/* Expired Modal */}
      <Modal visible={expiredModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Ionicons name="time" size={48} color="#dc2626" />
            <Text style={styles.modalTitle}>Booking Expired</Text>
            <Text style={styles.modalBody}>
              Your reservation lock has expired and the selected dates are no longer guaranteed.
            </Text>
            {/* Primary: Try to Rebook */}
            <TouchableOpacity
              style={[styles.primaryBtn, reBookingLoading && styles.primaryBtnDisabled]}
              onPress={() => void handleTryRebook()}
              disabled={reBookingLoading}
            >
              {reBookingLoading
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={styles.primaryBtnText}>Try to Rebook</Text>}
            </TouchableOpacity>
            {/* Secondary: Search Again */}
            <TouchableOpacity
              style={styles.modalSecondaryBtn}
              onPress={() => { setExpiredModal(false); router.replace("/(tabs)"); }}
              disabled={reBookingLoading}
            >
              <Text style={styles.modalSecondaryBtnText}>Search Again</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* ── STEP 0: Guest Details ──────────────────────────────────────── */}
        {step === 0 && (
          <View>
            <Text style={styles.sectionTitle}>Guest Details</Text>

            <FieldGroup label="First name *">
              <TextInput
                style={styles.input}
                value={firstName}
                onChangeText={setFirstName}
                placeholder="First name"
                autoCapitalize="words"
              />
            </FieldGroup>

            <FieldGroup label="Last name *">
              <TextInput
                style={styles.input}
                value={lastName}
                onChangeText={setLastName}
                placeholder="Last name"
                autoCapitalize="words"
              />
            </FieldGroup>

            <FieldGroup label="Email *">
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="Email address"
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </FieldGroup>

            <FieldGroup label="Phone (optional)">
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="+254 700 000 000"
                keyboardType="phone-pad"
              />
            </FieldGroup>

            {/* Hotel / Apartment fields */}
            {isHotelOrApartment && (
              <View>
                <StepperField
                  label="Adults"
                  value={adults}
                  min={1}
                  max={10}
                  onChange={setAdults}
                />
                <StepperField
                  label="Children"
                  value={children}
                  min={0}
                  max={10}
                  onChange={setChildren}
                />
                <FieldGroup label={`Special requests (optional, ${specialRequests.length}/500)`}>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    value={specialRequests}
                    onChangeText={(t) => setSpecialRequests(t.slice(0, 500))}
                    placeholder="Any special requests or preferences..."
                    multiline
                    numberOfLines={4}
                    maxLength={500}
                  />
                </FieldGroup>
              </View>
            )}

            {/* Car fields */}
            {isCar && (
              <View>
                <Text style={styles.subSectionTitle}>Driver Details</Text>

                <FieldGroup label="Driver first name *">
                  <TextInput
                    style={styles.input}
                    value={driverFirstName}
                    onChangeText={setDriverFirstName}
                    placeholder="First name"
                    autoCapitalize="words"
                  />
                </FieldGroup>

                <FieldGroup label="Driver last name *">
                  <TextInput
                    style={styles.input}
                    value={driverLastName}
                    onChangeText={setDriverLastName}
                    placeholder="Last name"
                    autoCapitalize="words"
                  />
                </FieldGroup>

                <FieldGroup label="Driver age *">
                  <TextInput
                    style={styles.input}
                    value={driverAge}
                    onChangeText={(t) => setDriverAge(t.replace(/\D/g, ""))}
                    placeholder="e.g. 25"
                    keyboardType="numeric"
                  />
                </FieldGroup>

                <View style={styles.toggleRow}>
                  <Text style={styles.fieldLabel}>Delivery requested</Text>
                  <Switch
                    value={deliveryRequested}
                    onValueChange={setDeliveryRequested}
                    trackColor={{ true: "#16a34a" }}
                  />
                </View>

                {deliveryRequested && (
                  <FieldGroup label="Delivery address *">
                    <TextInput
                      style={styles.input}
                      value={deliveryAddress}
                      onChangeText={setDeliveryAddress}
                      placeholder="Full delivery address"
                    />
                  </FieldGroup>
                )}
              </View>
            )}

            <TouchableOpacity style={styles.primaryBtn} onPress={handleContinue}>
              <Text style={styles.primaryBtnText}>Continue</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── STEP 1: Review & Price ─────────────────────────────────────── */}
        {step === 1 && pricing && (
          <View>
            <Text style={styles.sectionTitle}>Review & Price</Text>

            {/* Summary card */}
            <View style={styles.summaryCard}>
              <Text style={styles.summaryDateRange}>{formatDateRange()}</Text>

              {/* Promotion banner */}
              {promo.hasPromotion && checkoutPromo && (
                <View style={styles.promoBanner}>
                  <Text style={styles.promoBannerTitle}>🔥 {checkoutPromo.bannerTitle}</Text>
                  <Text style={styles.promoBannerLabel}>{checkoutPromo.labelText} applied</Text>
                </View>
              )}

              {/* Pricing breakdown */}
              <View style={styles.pricingSection}>
                <Text style={styles.pricingTitle}>Pricing</Text>

                <View style={styles.priceRow}>
                  <Text style={styles.priceLabel}>
                    Rate: {pricing.currency} {(pricing.ratePerUnit ?? 0).toLocaleString()} × {pricing.units ?? 0}{" "}
                    {pricing.unitLabel}
                  </Text>
                  <Text style={[styles.priceValue, promo.hasPromotion && styles.originalPriceStrike]}>
                    {formatCurrency(pricing.subtotal, pricing.currency)}
                  </Text>
                </View>

                {promo.hasPromotion && promoBadgeLabel && (
                  <View style={styles.promoBadge}>
                    <Text style={styles.promoBadgeText}>🏷 {promoBadgeLabel}</Text>
                  </View>
                )}

                {/* Best discount selection logic — promotion vs voucher, best discount wins */}
                {(() => {
                  const promoAmt = pricing.discountAmount ?? promoDiscountTotal;
                  const voucherAmt = voucherDiscount ?? 0;
                  if (promoAmt > 0 || voucherAmt > 0) {
                    const bestIsVoucher = voucherAmt > 0 && voucherAmt >= promoAmt;
                    const bestAmt = bestIsVoucher ? voucherAmt : promoAmt;
                    const bothExist = promoAmt > 0 && voucherAmt > 0;
                    return (
                      <View>
                        <View style={styles.priceRow}>
                          <Text style={styles.priceLabel}>
                            {bestIsVoucher
                              ? `Voucher (${voucherCode})`
                              : promoBadgeLabel
                                ? `Promotion (${promoBadgeLabel})`
                                : "Promotion discount"}
                            {bothExist ? " ✓ Best deal" : ""}
                          </Text>
                          <Text style={[styles.priceValue, styles.discountValue]}>
                            – {formatCurrency(bestAmt, pricing.currency)}
                          </Text>
                        </View>
                        {bothExist && (
                          <Text style={styles.bestDealNote}>
                            {bestIsVoucher
                              ? `Voucher saves more than promo (${formatCurrency(promoAmt, pricing.currency)})`
                              : `Promo saves more than voucher (${formatCurrency(voucherAmt, pricing.currency)})`}
                          </Text>
                        )}
                        <View style={styles.priceRow}>
                          <Text style={styles.subtotalLabel}>Subtotal</Text>
                          <Text style={styles.subtotalValue}>
                            {formatCurrency(Math.max(0, pricing.subtotal - bestAmt), pricing.currency)}
                          </Text>
                        </View>
                      </View>
                    );
                  }
                  return null;
                })()}

                {pricing.serviceFee != null && pricing.serviceFee > 0 && (
                  <View style={styles.priceRow}>
                    <Text style={styles.priceLabel}>
                      Service fee ({Math.round((pricing.serviceFee / Math.max(1, pricing.subtotal - (pricing.discountAmount ?? promoDiscountTotal))) * 100)}%)
                    </Text>
                    <Text style={styles.priceValue}>
                      + {formatCurrency(pricing.serviceFee, pricing.currency)}
                    </Text>
                  </View>
                )}

                {pricing.taxAmount != null && pricing.taxAmount > 0 && (
                  <View style={styles.priceRow}>
                    <Text style={styles.priceLabel}>Taxes</Text>
                    <Text style={styles.priceValue}>
                      + {formatCurrency(pricing.taxAmount, pricing.currency)}
                    </Text>
                  </View>
                )}

                {pricing.deliveryFee != null && pricing.deliveryFee > 0 && (
                  <View style={styles.priceRow}>
                    <Text style={styles.priceLabel}>Delivery</Text>
                    <Text style={styles.priceValue}>
                      + {formatCurrency(pricing.deliveryFee, pricing.currency)}
                    </Text>
                  </View>
                )}

                {(() => {
                  const promoAmt = pricing.discountAmount ?? promoDiscountTotal;
                  const voucherAmt = voucherDiscount ?? 0;
                  const bestAmt = Math.max(promoAmt, voucherAmt);
                  const subAfterDiscount = Math.max(0, pricing.subtotal - bestAmt);
                  const sFee = pricing.serviceFee ?? 0;
                  const tFee = pricing.taxAmount ?? 0;
                  const dFee = pricing.deliveryFee ?? 0;

                  // Total = Subtotal after discount + Service fee + Taxes + Delivery fee
                  const displayTotal = subAfterDiscount + sFee + tFee + dFee;
                  return (
                    <View style={[styles.priceRow, styles.totalRow]}>
                      <Text style={styles.totalLabel}>Total</Text>
                      <Text style={styles.totalValue}>
                        {formatCurrency(displayTotal, pricing.currency)}
                      </Text>
                    </View>
                  );
                })()}
              </View>

              {/* Guest summary */}
              <View style={styles.guestSummarySection}>
                <Text style={styles.pricingTitle}>Guests</Text>
                {isHotelOrApartment ? (
                  <Text style={styles.guestSummaryText}>
                    {adults} {adults === 1 ? "adult" : "adults"}
                    {children > 0 ? ` · ${children} ${children === 1 ? "child" : "children"}` : ""}
                  </Text>
                ) : (
                  <Text style={styles.guestSummaryText}>
                    Driver: {driverFirstName} {driverLastName}, age {driverAge}
                  </Text>
                )}
              </View>

              {/* Cancellation policy */}
              {pricing.cancellationPolicyName && (
                <View style={styles.policySection}>
                  <Text style={styles.pricingTitle}>Cancellation Policy</Text>
                  <Text style={styles.policyText}>{pricing.cancellationPolicyName}</Text>
                </View>
              )}
            </View>

            {/* Voucher selector */}
            {pricing && (
              <View style={styles.promoSection}>
                <VoucherSelector
                  totalAmount={pricing.total}
                  currency={pricing.currency}
                  activity={(isCar ? "cars" : "hotels") as ActivityScope}
                  guestId={user?.id ?? ""}
                  guestTier={user?.currentTier ?? null}
                  guestCountry={user?.country ?? null}
                  onApplied={(discountAmount, code) => {
                    setVoucherDiscount(discountAmount);
                    setVoucherCode(code);
                  }}
                  onCleared={() => {
                    setVoucherDiscount(null);
                    setVoucherCode("");
                  }}
                />
              </View>
            )}


            {/* Terms and Privacy Policy acceptance */}
            <TouchableOpacity
              style={styles.termsRow}
              onPress={() => setTermsChecked((prev) => !prev)}
              activeOpacity={0.8}
            >
              <View style={[styles.checkbox, termsChecked && styles.checkboxChecked]}>
                {termsChecked && <Ionicons name="checkmark" size={13} color="#fff" />}
              </View>
              <Text style={styles.termsText}>
                I have read and agree to the{" "}
                <Text
                  style={styles.termsLink}
                  onPress={() => router.push({ pathname: "/legal/[doc]", params: { doc: "terms" } } as any)}
                >
                  Terms of Use
                </Text>{" "}
                and{" "}
                <Text
                  style={styles.termsLink}
                  onPress={() => router.push({ pathname: "/legal/[doc]", params: { doc: "privacy" } } as any)}
                >
                  Privacy Policy
                </Text>
                .
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.primaryBtn,
                (!termsChecked || isExpired) && styles.primaryBtnDisabled,
              ]}
              onPress={() => {
                if (!termsChecked) return;
                if (isExpired) {
                  setExpiredModal(true);
                  return;
                }
                createBookingMutation.mutate();
              }}
              disabled={!termsChecked || createBookingMutation.isPending || isExpired}
            >
              {createBookingMutation.isPending ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.primaryBtnText}>Proceed to Payment</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => setStep(0)}
              disabled={createBookingMutation.isPending}
            >
              <Text style={styles.secondaryBtnText}>Back</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function StepperField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <View style={styles.stepperGroup}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.stepperRow}>
        <TouchableOpacity
          style={[styles.stepperBtn, value <= min && styles.stepperBtnDisabled]}
          onPress={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
        >
          <Text style={styles.stepperBtnText}>−</Text>
        </TouchableOpacity>
        <Text style={styles.stepperValue}>{value}</Text>
        <TouchableOpacity
          style={[styles.stepperBtn, value >= max && styles.stepperBtnDisabled]}
          onPress={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
        >
          <Text style={styles.stepperBtnText}>+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  scroll: { padding: 16, paddingBottom: 40 },

  // Step indicator
  stepIndicatorRow: {
    flexDirection: "row",
    backgroundColor: "#fff",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    justifyContent: "space-around",
  },
  stepIndicatorItem: { alignItems: "center", flex: 1 },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#e5e7eb",
    marginBottom: 4,
    borderWidth: 2,
    borderColor: "#e5e7eb",
  },
  stepDotActive: {
    backgroundColor: "#16a34a",
    borderColor: "#16a34a",
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  stepDotDone: { backgroundColor: "#16a34a", borderColor: "#16a34a" },
  stepLabel: { fontSize: 10, color: "#9ca3af", textAlign: "center" },
  stepLabelActive: { color: "#16a34a", fontWeight: "600" },
  stepLabelDone: { color: "#16a34a" },

  // ── Timer banners ───────────────────────────────────────────────────────────
  timerBannerGreen: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0fdf4",
    paddingHorizontal: 14,
    paddingVertical: 9,
    gap: 7,
    borderBottomWidth: 1,
    borderBottomColor: "#bbf7d0",
  },
  timerTextGreen: { fontSize: 13, color: "#15803d", fontWeight: "600", flex: 1 },

  timerBannerAmber: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fffbeb",
    paddingHorizontal: 14,
    paddingVertical: 9,
    gap: 7,
    borderBottomWidth: 1,
    borderBottomColor: "#fde68a",
  },
  timerTextAmber: { fontSize: 13, color: "#92400e", fontWeight: "600", flex: 1 },

  timerBannerRed: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#dc2626",
    paddingHorizontal: 14,
    paddingVertical: 9,
    gap: 7,
    borderBottomWidth: 1,
    borderBottomColor: "#b91c1c",
  },
  timerTextRed: { fontSize: 13, color: "#fff", fontWeight: "700", flex: 1 },

  renewBtn: {
    backgroundColor: "#fef3c7",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "#fcd34d",
  },
  renewBtnText: { fontSize: 12, color: "#92400e", fontWeight: "600" },

  // Progress bar
  progressTrack: {
    height: 3,
    backgroundColor: "#e5e7eb",
    width: "100%",
  },
  progressFill: {
    height: 3,
    borderRadius: 2,
  },

  // Modal
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
  modalBody: { fontSize: 14, color: "#6b7280", textAlign: "center", lineHeight: 20 },
  modalSecondaryBtn: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    width: "100%",
  },
  modalSecondaryBtnText: { color: "#374151", fontWeight: "600", fontSize: 15 },

  // Loading / error
  loadingText: { fontSize: 15, color: "#6b7280", marginTop: 16, textAlign: "center" },
  errorTitle: { fontSize: 22, fontWeight: "700", color: "#111827", marginTop: 16, textAlign: "center" },
  errorBody: { fontSize: 14, color: "#6b7280", textAlign: "center", lineHeight: 20, marginBottom: 24 },

  // Form
  sectionTitle: { fontSize: 20, fontWeight: "700", color: "#111827", marginBottom: 20 },
  subSectionTitle: { fontSize: 16, fontWeight: "600", color: "#374151", marginTop: 8, marginBottom: 12 },
  fieldGroup: { marginBottom: 16 },
  fieldLabel: { fontSize: 14, fontWeight: "500", color: "#374151", marginBottom: 6 },
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
  textArea: { height: 100, textAlignVertical: "top" },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
    marginBottom: 16,
  },

  // Stepper
  stepperGroup: { marginBottom: 18 },
  stepperRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  stepperBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#16a34a",
    alignItems: "center",
    justifyContent: "center",
  },
  stepperBtnDisabled: { backgroundColor: "#d1d5db" },
  stepperBtnText: { color: "#fff", fontSize: 20, fontWeight: "700", lineHeight: 24 },
  stepperValue: { fontSize: 20, fontWeight: "700", color: "#111827", minWidth: 36, textAlign: "center" },

  // Summary card (step 1)
  summaryCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: 20,
    gap: 16,
  },
  summaryDateRange: { fontSize: 16, fontWeight: "600", color: "#111827" },
  promoBanner: { backgroundColor: "#FEF2F2", borderRadius: 10, padding: 12, borderWidth: 1, borderColor: "#FECACA", marginBottom: 12 },
  promoBannerTitle: { fontSize: 14, fontWeight: "800", color: "#DC2626", marginBottom: 2 },
  promoBannerLabel: { fontSize: 12, fontWeight: "600", color: "#991B1B" },
  pricingSection: { borderTopWidth: 1, borderTopColor: "#f3f4f6", paddingTop: 14, gap: 8 },
  pricingTitle: { fontSize: 13, fontWeight: "600", color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  priceRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  priceLabel: { fontSize: 14, color: "#374151", flex: 1 },
  priceValue: { fontSize: 14, color: "#111827", fontWeight: "500" },
  originalPriceStrike: { textDecorationLine: "line-through", color: "#9ca3af", fontWeight: "400" },
  discountValue: { color: "#16a34a" },
  promoBadge: { alignSelf: "flex-start", backgroundColor: "#FEF2F2", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  promoBadgeText: { fontSize: 12, fontWeight: "700", color: "#DC2626" },
  subtotalLabel: { fontSize: 14, fontWeight: "600", color: "#111827", flex: 1 },
  subtotalValue: { fontSize: 14, fontWeight: "600", color: "#111827" },
  totalRow: { borderTopWidth: 1, borderTopColor: "#e5e7eb", marginTop: 4, paddingTop: 8 },
  totalLabel: { fontSize: 16, fontWeight: "700", color: "#111827", flex: 1 },
  totalValue: { fontSize: 16, fontWeight: "700", color: "#16a34a" },
  guestSummarySection: { borderTopWidth: 1, borderTopColor: "#f3f4f6", paddingTop: 14 },
  guestSummaryText: { fontSize: 14, color: "#374151" },
  policySection: { borderTopWidth: 1, borderTopColor: "#f3f4f6", paddingTop: 14 },
  policyText: { fontSize: 14, color: "#374151", textTransform: "capitalize" },

  // Voucher selector wrapper
  promoSection: { marginBottom: 20 },
  bestDealNote: { fontSize: 11, color: "#6b7280", marginTop: 2, marginBottom: 2, fontStyle: "italic" },

  // Terms
  termsRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 20 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#d1d5db",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
    flexShrink: 0,
  },
  checkboxChecked: { backgroundColor: "#16a34a", borderColor: "#16a34a" },
  termsText: { fontSize: 13, color: "#374151", lineHeight: 20, flex: 1 },
  termsLink: { fontWeight: "700", color: "#16a34a", textDecorationLine: "underline" },

  // Buttons
  primaryBtn: {
    backgroundColor: "#16a34a",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    marginBottom: 12,
  },
  primaryBtnDisabled: { opacity: 0.5 },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },

  // ── Pending-limit screen ──────────────────────────────────────────────────
  pendingHeader: { alignItems: "center", paddingTop: 24, paddingBottom: 16, gap: 10 },
  pendingList: { gap: 12, marginBottom: 20 },
  pendingCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 14,
  },
  pendingCardTitle: { fontSize: 14, fontWeight: "700", color: "#111827", marginBottom: 2 },
  pendingCardRef: { fontSize: 11, color: "#6b7280", fontFamily: "monospace", marginBottom: 2 },
  pendingCardDate: { fontSize: 12, color: "#374151", marginBottom: 2 },
  pendingCardAmount: { fontSize: 13, fontWeight: "700", color: "#16a34a" },
  pendingCardBtns: { gap: 8 },
  pendingPayBtn: {
    backgroundColor: "#16a34a",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: "center",
  },
  pendingPayBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  pendingDiscardBtn: {
    borderWidth: 1.5,
    borderColor: "#dc2626",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: "center",
    minWidth: 72,
  },
  pendingDiscardBtnText: { color: "#dc2626", fontWeight: "700", fontSize: 13 },
  pendingRetryBox: {
    alignItems: "center",
    backgroundColor: "#f0fdf4",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#bbf7d0",
    padding: 20,
    marginBottom: 16,
    gap: 6,
  },
  pendingRetryText: { fontSize: 14, color: "#15803d", fontWeight: "600", textAlign: "center" },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  secondaryBtnText: { color: "#374151", fontWeight: "600", fontSize: 15 },

});
