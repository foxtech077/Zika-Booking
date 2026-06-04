import { useState, useEffect, useRef } from "react";
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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { listingApi } from "../../lib/listing-api";
import { useAuthStore } from "../../store/auth";

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
    intervalRef.current = setInterval(tick, 500);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
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
    checkIn?: string;
    checkOut?: string;
    pickupDatetime?: string;
    returnDatetime?: string;
    guests?: string;
  }>();

  const {
    listingId,
    checkIn,
    checkOut,
    pickupDatetime,
    returnDatetime,
    guests,
  } = params;

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
  const [voucherInput, setVoucherInput] = useState("");
  const [voucherDiscount, setVoucherDiscount] = useState<number | null>(null);
  const [voucherMessage, setVoucherMessage] = useState<string | null>(null);
  const [voucherError, setVoucherError] = useState<string | null>(null);
  const [voucherLoading, setVoucherLoading] = useState(false);

  // ── Countdown ─────────────────────────────────────────────────────────────
  const msLeft = useCountdown(lockState?.expiresAt ?? null);
  const showExpiringWarning = msLeft > 0 && msLeft <= 120_000; // 2-minute grace period
  // msLeft === -1 means "not yet calculated" — only treat as expired when it genuinely hits 0
  const isExpired = lockState !== null && msLeft === 0;

  useEffect(() => {
    if (isExpired && step < 2) {
      setExpiredModal(true);
    }
  }, [isExpired, step]);

  // ── Initiate lock on mount ────────────────────────────────────────────────
  useEffect(() => {
    async function initiateLock() {
      setLockLoading(true);
      try {
        const body: Record<string, unknown> = {
          listingId,
          deliveryRequested: false,
        };
        if (checkIn) body.checkIn = checkIn;
        if (checkOut) body.checkOut = checkOut;
        if (pickupDatetime) body.pickupDatetime = pickupDatetime;
        if (returnDatetime) body.returnDatetime = returnDatetime;
        if (guests) body.guests = parseInt(guests, 10);

        const res = await listingApi.post<{ data: { lockToken: string; expiresAt: string; pricingPreview: any } }>(
          "/bookings/initiate", body,
        );

        // Map backend field names → component's PricingPreview shape
        const raw = res.data.data.pricingPreview;
        const isCar = !!raw.days;
        const mapped: PricingPreview = {
          ratePerUnit: isCar ? raw.dailyRate : raw.nightlyRate,
          units: isCar ? raw.days : raw.nights,
          unitLabel: isCar ? "days" : "nights",
          subtotal: raw.subtotal,
          discountAmount: raw.discountAmount ?? undefined,
          serviceFee: raw.serviceFee ?? undefined,
          taxAmount: raw.taxAmount ?? undefined,
          deliveryFee: raw.deliveryFee ?? undefined,
          total: raw.totalAmount,
          currency: raw.currency,
        };

        setLockState({
          lockToken: res.data.data.lockToken,
          expiresAt: res.data.data.expiresAt,
          pricingPreview: mapped,
        });
      } catch (err: any) {
        console.warn("LOCK INITIATION ERROR:", err?.response?.data || err?.message || err);
        const status = err?.response?.status;
        const code = err?.response?.data?.error?.code ?? err?.response?.data?.code;
        const errMsg = err?.response?.data?.error?.message ?? err?.response?.data?.message ?? err?.message;
        if (code === "LISTING_UNAVAILABLE") {
          setLockError("unavailable");
        } else if (status === 401 || code === "NO_TOKEN" || code === "INVALID_TOKEN") {
          setLockError("auth");
        } else {
          setLockError("generic");
          setLockErrorMessage(errMsg || "An error occurred while trying to reserve this listing. Please go back and try again.");
        }
      } finally {
        setLockLoading(false);
      }
    }
    void initiateLock();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      setLockState((prev) => prev ? { ...prev, expiresAt: newExpiresAt } : prev);
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
      router.push({ pathname: "/pay/[bookingId]", params: { bookingId: data.bookingId } });
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
      if (!driverAge.trim() || isNaN(parseInt(driverAge, 10))) return "Driver age is required.";
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

  // ── Voucher apply ─────────────────────────────────────────────────────────
  async function handleApplyVoucher() {
    const code = voucherInput.trim();
    if (!code) return;
    if (!pricing) return;
    setVoucherLoading(true);
    setVoucherError(null);
    setVoucherMessage(null);
    setVoucherDiscount(null);
    setVoucherCode("");
    try {
      const res = await listingApi.post<{
        data: { valid: boolean; discountAmount: number; message: string };
      }>("/vouchers/validate", {
        code,
        totalAmount: pricing.total,
        currency: pricing.currency,
      });
      const { valid, discountAmount, message } = res.data.data;
      if (valid) {
        setVoucherCode(code);
        setVoucherDiscount(discountAmount);
        setVoucherMessage(message);
      } else {
        setVoucherError(message ?? "Invalid promo code.");
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? "Could not validate promo code.";
      setVoucherError(msg);
    } finally {
      setVoucherLoading(false);
    }
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
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#1a73e8" />
          <Text style={styles.loadingText}>Securing your reservation...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Render: Lock unavailable error ────────────────────────────────────────
  if (lockError === "unavailable") {
    return (
      <SafeAreaView style={styles.container}>
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
        <View style={styles.centered}>
          <Ionicons name="lock-closed" size={64} color="#1a73e8" />
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

  if (lockError === "generic") {
    return (
      <SafeAreaView style={styles.container}>
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

  return (
    <SafeAreaView style={styles.container}>
      {/* Step indicator */}
      <StepIndicator current={step} />

      {/* Timer bar (steps 0 and 1) */}
      {step < 2 && lockState && msLeft >= 0 && (
        <View style={styles.timerBar}>
          <Ionicons name="time-outline" size={14} color={showExpiringWarning ? "#92400e" : "#374151"} />
          <Text style={[styles.timerText, showExpiringWarning && styles.timerTextWarning]}>
            {"Reservation held for "}
            <Text style={styles.timerCountdown}>{msToCountdown(msLeft)}</Text>
          </Text>
          {showExpiringWarning && (
            <TouchableOpacity
              style={styles.renewBtn}
              onPress={() => renewMutation.mutate()}
              disabled={renewMutation.isPending}
            >
              {renewMutation.isPending ? (
                <ActivityIndicator size="small" color="#92400e" />
              ) : (
                <Text style={styles.renewBtnText}>Renew (30s)</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Expiring soon banner */}
      {step < 2 && showExpiringWarning && !expiredModal && (
        <View style={styles.expiringBanner}>
          <Ionicons name="warning-outline" size={16} color="#92400e" />
          <Text style={styles.expiringBannerText}>Expiring soon!</Text>
        </View>
      )}

      {/* Expired Modal */}
      <Modal visible={expiredModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Ionicons name="time" size={48} color="#dc2626" />
            <Text style={styles.modalTitle}>Reservation Expired</Text>
            <Text style={styles.modalBody}>
              The listing has been released. Please search again to find available options.
            </Text>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => router.push("/(tabs)")}
            >
              <Text style={styles.primaryBtnText}>Search Again</Text>
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
                    trackColor={{ true: "#1a73e8" }}
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

              {/* Pricing breakdown */}
              <View style={styles.pricingSection}>
                <Text style={styles.pricingTitle}>Pricing</Text>

                <View style={styles.priceRow}>
                  <Text style={styles.priceLabel}>
                    Rate: {pricing.currency} {pricing.ratePerUnit.toLocaleString()} × {pricing.units}{" "}
                    {pricing.unitLabel}
                  </Text>
                  <Text style={styles.priceValue}>
                    {formatCurrency(pricing.subtotal, pricing.currency)}
                  </Text>
                </View>

                {/* Best discount selection logic */}
                {(() => {
                  const promoDiscount = pricing.discountAmount ?? 0;
                  const voucherAmt = voucherDiscount ?? 0;
                  if (promoDiscount > 0 || voucherAmt > 0) {
                    const bestIsVoucher = voucherAmt > 0 && voucherAmt >= promoDiscount;
                    const bestAmt = bestIsVoucher ? voucherAmt : promoDiscount;
                    const bothExist = promoDiscount > 0 && voucherAmt > 0;
                    return (
                      <View>
                        <View style={styles.priceRow}>
                          <Text style={styles.priceLabel}>
                            {bestIsVoucher ? `Voucher (${voucherCode})` : "Promotion discount"}
                            {bothExist ? " ✓ Best deal" : ""}
                          </Text>
                          <Text style={[styles.priceValue, styles.discountValue]}>
                            – {formatCurrency(bestAmt, pricing.currency)}
                          </Text>
                        </View>
                        {bothExist && (
                          <Text style={styles.bestDealNote}>
                            {bestIsVoucher
                              ? `Voucher saves more than promo (${formatCurrency(promoDiscount, pricing.currency)})`
                              : `Promo saves more than voucher (${formatCurrency(voucherAmt, pricing.currency)})`}
                          </Text>
                        )}
                      </View>
                    );
                  }
                  return null;
                })()}

                {pricing.serviceFee != null && pricing.serviceFee > 0 && (
                  <View style={styles.priceRow}>
                    <Text style={styles.priceLabel}>Service fee</Text>
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

                <View style={[styles.priceRow, styles.totalRow]}>
                  <Text style={styles.totalLabel}>Total</Text>
                  <Text style={styles.totalValue}>
                    {formatCurrency(pricing.total, pricing.currency)}
                  </Text>
                </View>
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

            {/* Promo Code */}
            <View style={styles.promoSection}>
              <Text style={styles.promoLabel}>Promo code (optional)</Text>
              <View style={styles.promoRow}>
                <TextInput
                  style={[styles.input, styles.promoInput]}
                  value={voucherInput}
                  onChangeText={setVoucherInput}
                  placeholder="Enter promo code"
                  autoCapitalize="characters"
                  editable={!voucherCode}
                />
                <TouchableOpacity
                  style={[styles.promoBtn, (!!voucherCode || voucherLoading) && styles.promoBtnDisabled]}
                  onPress={handleApplyVoucher}
                  disabled={!!voucherCode || voucherLoading}
                >
                  {voucherLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.promoBtnText}>{voucherCode ? "Applied" : "Apply"}</Text>
                  )}
                </TouchableOpacity>
              </View>
              {voucherMessage && voucherDiscount != null && (
                <Text style={styles.promoSuccess}>
                  {voucherMessage}
                </Text>
              )}
              {voucherError && (
                <Text style={styles.promoError}>{voucherError}</Text>
              )}
            </View>

            {/* Terms checkbox */}
            <TouchableOpacity
              style={styles.termsRow}
              onPress={() => setTermsChecked((v) => !v)}
              activeOpacity={0.7}
            >
              <View style={[styles.checkbox, termsChecked && styles.checkboxChecked]}>
                {termsChecked && <Ionicons name="checkmark" size={14} color="#fff" />}
              </View>
              <Text style={styles.termsText}>
                I agree to ZikaBooking's Terms of Service and the cancellation policy above.
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.primaryBtn, !termsChecked && styles.primaryBtnDisabled]}
              onPress={() => {
                if (!termsChecked) return;
                createBookingMutation.mutate();
              }}
              disabled={!termsChecked || createBookingMutation.isPending}
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
    </SafeAreaView>
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
    backgroundColor: "#1a73e8",
    borderColor: "#1a73e8",
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  stepDotDone: { backgroundColor: "#16a34a", borderColor: "#16a34a" },
  stepLabel: { fontSize: 10, color: "#9ca3af", textAlign: "center" },
  stepLabelActive: { color: "#1a73e8", fontWeight: "600" },
  stepLabelDone: { color: "#16a34a" },

  // Timer bar
  timerBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    gap: 6,
  },
  timerText: { fontSize: 13, color: "#374151", flex: 1 },
  timerTextWarning: { color: "#92400e" },
  timerCountdown: { fontWeight: "700" },
  renewBtn: {
    backgroundColor: "#fef3c7",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "#fcd34d",
  },
  renewBtnText: { fontSize: 12, color: "#92400e", fontWeight: "600" },

  // Expiring banner
  expiringBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fef3c7",
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#fde68a",
  },
  expiringBannerText: { fontSize: 13, color: "#92400e", fontWeight: "600" },

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
    backgroundColor: "#1a73e8",
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
  pricingSection: { borderTopWidth: 1, borderTopColor: "#f3f4f6", paddingTop: 14, gap: 8 },
  pricingTitle: { fontSize: 13, fontWeight: "600", color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  priceRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  priceLabel: { fontSize: 14, color: "#374151", flex: 1 },
  priceValue: { fontSize: 14, color: "#111827", fontWeight: "500" },
  discountValue: { color: "#16a34a" },
  totalRow: { borderTopWidth: 1, borderTopColor: "#e5e7eb", marginTop: 4, paddingTop: 8 },
  totalLabel: { fontSize: 16, fontWeight: "700", color: "#111827", flex: 1 },
  totalValue: { fontSize: 16, fontWeight: "700", color: "#1a73e8" },
  guestSummarySection: { borderTopWidth: 1, borderTopColor: "#f3f4f6", paddingTop: 14 },
  guestSummaryText: { fontSize: 14, color: "#374151" },
  policySection: { borderTopWidth: 1, borderTopColor: "#f3f4f6", paddingTop: 14 },
  policyText: { fontSize: 14, color: "#374151", textTransform: "capitalize" },

  // Promo code
  promoSection: { marginBottom: 20 },
  promoLabel: { fontSize: 14, fontWeight: "500", color: "#374151", marginBottom: 8 },
  promoRow: { flexDirection: "row", gap: 10, alignItems: "center" },
  promoInput: { flex: 1, letterSpacing: 1 },
  promoBtn: {
    backgroundColor: "#1a73e8",
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 11,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 72,
  },
  promoBtnDisabled: { backgroundColor: "#9ca3af" },
  promoBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  promoSuccess: { fontSize: 13, color: "#16a34a", fontWeight: "600", marginTop: 8 },
  promoError: { fontSize: 13, color: "#dc2626", marginTop: 8 },
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
  checkboxChecked: { backgroundColor: "#1a73e8", borderColor: "#1a73e8" },
  termsText: { fontSize: 13, color: "#374151", lineHeight: 20, flex: 1 },

  // Buttons
  primaryBtn: {
    backgroundColor: "#1a73e8",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 12,
  },
  primaryBtnDisabled: { opacity: 0.5 },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  secondaryBtnText: { color: "#374151", fontWeight: "600", fontSize: 15 },

});
