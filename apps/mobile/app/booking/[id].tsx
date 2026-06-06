import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  StyleSheet,
  Share,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { listingApi } from "../../lib/listing-api";
import { useAuthStore } from "../../store/auth";
import { ListingImage } from "../../components/ListingImage";


// ── Types ─────────────────────────────────────────────────────────────────────

type BookingStatus =
  | "pending"
  | "confirmed"
  | "pending_payment"
  | "active"
  | "completed"
  | "cancelled_by_guest"
  | "cancelled_by_provider"
  | "cancelled_by_system"
  | "refunded";

interface BookingListing {
  id: string;
  title: string;
  address: string;
  town: string;
  country: string;
  primaryPhotoUrl: string | null;
}

interface BookingDetail {
  id: string;
  reference: string;
  status: BookingStatus;
  listingType: "hotel" | "apartment" | "car";
  listing: BookingListing;
  checkIn?: string;
  checkOut?: string;
  pickupDatetime?: string;
  returnDatetime?: string;
  nightsOrDays: number;
  adults?: number;
  children?: number;
  specialRequests?: string;
  guestFirstName: string;
  guestLastName: string;
  guestEmail: string;
  driverFirstName?: string;
  driverLastName?: string;
  driverAge?: number;
  subtotal: number;
  discountAmount?: number;
  serviceFee?: number;
  taxAmount?: number;
  deliveryFee?: number;
  totalAmount: number;
  currency: string;
  cancellationPolicy?: string;
  refundAmount?: number;
  cancelledAt?: string;
  confirmedAt?: string;
  completedAt?: string;
  checkedInAt?: string;
  createdAt: string;
  canCancel: boolean;
  hasReview?: boolean;
  reviewId?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function formatDateTime(isoStr: string): string {
  const d = new Date(isoStr);
  return `${d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
}

function formatFullDate(isoStr: string): string {
  return new Date(isoStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCurrency(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString()}`;
}

function isCancelled(status: BookingStatus): boolean {
  return (
    status === "cancelled_by_guest" ||
    status === "cancelled_by_provider" ||
    status === "cancelled_by_system" ||
    status === "refunded"
  );
}

function statusInfo(status: BookingStatus): { label: string; bg: string; textColor: string } {
  switch (status) {
    case "pending":
      return { label: "Pending", bg: "#fef3c7", textColor: "#92400e" };
    case "confirmed":
      return { label: "Confirmed", bg: "#dcfce7", textColor: "#16a34a" };
    case "pending_payment":
      return { label: "Pending Payment", bg: "#fef3c7", textColor: "#92400e" };
    case "active":
      return { label: "Active", bg: "#dbeafe", textColor: "#1d4ed8" };
    case "completed":
      return { label: "Completed", bg: "#f3f4f6", textColor: "#6b7280" };
    case "refunded":
      return { label: "Refunded", bg: "#f0fdf4", textColor: "#15803d" };
    case "cancelled_by_guest":
    case "cancelled_by_provider":
    case "cancelled_by_system":
      return { label: "Cancelled", bg: "#fee2e2", textColor: "#dc2626" };
    default:
      return { label: status, bg: "#f3f4f6", textColor: "#6b7280" };
  }
}

function cancelledByLabel(status: BookingStatus): string {
  if (status === "cancelled_by_guest") return "Cancelled by you";
  if (status === "cancelled_by_provider") return "Cancelled by provider";
  if (status === "cancelled_by_system") return "Cancelled by system";
  if (status === "refunded") return "Cancelled with refund";
  return "Cancelled";
}

// ── Share voucher ─────────────────────────────────────────────────────────────

async function shareVoucher(booking: BookingDetail) {
  const isCar = booking.listingType === "car";
  const dateInfo = isCar && booking.pickupDatetime && booking.returnDatetime
    ? `Pickup: ${formatDateTime(booking.pickupDatetime)}\nReturn: ${formatDateTime(booking.returnDatetime)}`
    : booking.checkIn && booking.checkOut
      ? `Check-in: ${formatShortDate(booking.checkIn)}\nCheck-out: ${formatShortDate(booking.checkOut)}`
      : "";

  const lines = [
    "═══════════════════════════",
    "   ZIKABOOKING VOUCHER",
    "═══════════════════════════",
    `Booking: ${booking.reference}`,
    `Status:  ${statusInfo(booking.status).label}`,
    "",
    `Property: ${booking.listing.title}`,
    `Address:  ${booking.listing.address}, ${booking.listing.town}`,
    "",
    dateInfo,
    "",
    `Guest: ${booking.guestFirstName} ${booking.guestLastName}`,
    `Email:  ${booking.guestEmail}`,
    "",
    "─── Pricing ────────────────",
    `Subtotal: ${formatCurrency(booking.subtotal, booking.currency)}`,
    booking.discountAmount && booking.discountAmount > 0
      ? `Discount: -${formatCurrency(booking.discountAmount, booking.currency)}`
      : "",
    booking.serviceFee && booking.serviceFee > 0
      ? `Service fee: +${formatCurrency(booking.serviceFee, booking.currency)}`
      : "",
    booking.taxAmount && booking.taxAmount > 0
      ? `Taxes: +${formatCurrency(booking.taxAmount, booking.currency)}`
      : "",
    `TOTAL: ${formatCurrency(booking.totalAmount, booking.currency)}`,
    "",
    "═══════════════════════════",
    "Powered by ZikaBooking",
  ].filter(Boolean).join("\n");

  try {
    await Share.share({ message: lines, title: `Booking ${booking.reference}` });
  } catch {
    // User dismissed share sheet — no action needed
  }
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.photoBg} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={[styles.skeletonLine, { width: "60%", height: 18, marginBottom: 12 }]} />
        <View style={[styles.skeletonLine, { width: "80%", height: 14, marginBottom: 8 }]} />
        <View style={[styles.skeletonLine, { width: "50%", height: 14, marginBottom: 8 }]} />
        <View style={[styles.skeletonLine, { width: "70%", height: 14, marginBottom: 8 }]} />
        <View style={[styles.skeletonLine, { width: "40%", height: 14, marginBottom: 8 }]} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

// ── Timeline ──────────────────────────────────────────────────────────────────

function Timeline({ booking }: { booking: BookingDetail }) {
  const events: { label: string; date: string | undefined; done: boolean }[] = [
    { label: "Booking Created", date: booking.createdAt, done: true },
    { label: "Confirmed", date: booking.confirmedAt, done: !!booking.confirmedAt },
    {
      label: "Active",
      date: booking.checkedInAt,
      done: booking.status === "active" || booking.status === "completed",
    },
    { label: "Completed", date: booking.completedAt, done: !!booking.completedAt },
  ];

  return (
    <View style={styles.timeline}>
      {events.map((ev, i) => (
        <View key={ev.label} style={styles.timelineItem}>
          <View style={styles.timelineLeft}>
            <View style={[styles.timelineDot, ev.done && styles.timelineDotDone]} />
            {i < events.length - 1 && (
              <View style={[styles.timelineLine, ev.done && styles.timelineLineDone]} />
            )}
          </View>
          <View style={styles.timelineRight}>
            <Text style={[styles.timelineLabel, ev.done && styles.timelineLabelDone]}>
              {ev.label}
            </Text>
            {ev.date ? (
              <Text style={styles.timelineDate}>{formatFullDate(ev.date)}</Text>
            ) : (
              <Text style={styles.timelinePending}>Pending</Text>
            )}
          </View>
        </View>
      ))}
    </View>
  );
}


// ── Main screen ───────────────────────────────────────────────────────────────

export default function BookingDetailScreen() {
  const { id, fromPayment } = useLocalSearchParams<{ id: string; fromPayment?: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [imgError, setImgError] = useState(false);

  const { data: booking, isLoading, isError } = useQuery<BookingDetail>({
    queryKey: ["booking", id],
    queryFn: async () => {
      const res = await listingApi.get<{ data: BookingDetail }>(`/guests/me/bookings/${id}`);
      return res.data.data;
    },
    enabled: !!id,
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      await listingApi.post(`/bookings/${id}/cancel`);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["booking", id] });
      void qc.invalidateQueries({ queryKey: ["myBookings"] });
    },
    onError: (err: any) => {
      const message =
        err?.response?.data?.message ?? err?.message ?? "Could not cancel booking.";
      Alert.alert("Cancellation failed", message);
    },
  });

  function handleCancelPress() {
    if (!booking) return;
    const refundLine =
      booking.refundAmount != null && booking.refundAmount > 0
        ? `\n\nEstimated refund: ${formatCurrency(booking.refundAmount, booking.currency)}`
        : "";
    const policyLine = booking.cancellationPolicy
      ? `\nPolicy: ${booking.cancellationPolicy}`
      : "";

    Alert.alert(
      "Cancel Booking?",
      `Are you sure you want to cancel this booking?${policyLine}${refundLine}`,
      [
        { text: "Keep Booking", style: "cancel" },
        {
          text: "Cancel Booking",
          style: "destructive",
          onPress: () => cancelMutation.mutate(),
        },
      ]
    );
  }

  if (isLoading) return <Skeleton />;

  if (isError || !booking) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={56} color="#dc2626" />
          <Text style={styles.errorTitle}>Booking not found.</Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const { label: statusLabel, bg: statusBg, textColor: statusTextColor } = statusInfo(booking.status);
  const isCar = booking.listingType === "car";
  const cancelled = isCancelled(booking.status);
  const justPaid = fromPayment === "true";

  function stayDetails(): string {
    if (!booking) return "";
    if (isCar && booking.pickupDatetime && booking.returnDatetime) {
      const days = booking.nightsOrDays;
      return `Pickup: ${formatDateTime(booking.pickupDatetime)} · Return: ${formatDateTime(booking.returnDatetime)} · ${days} ${days === 1 ? "day" : "days"}`;
    }
    if (booking.checkIn && booking.checkOut) {
      const nights = booking.nightsOrDays;
      const adults = booking.adults ?? 0;
      const children = booking.children ?? 0;
      const guestStr = `${adults} ${adults === 1 ? "adult" : "adults"}${children > 0 ? `, ${children} ${children === 1 ? "child" : "children"}` : ""}`;
      return `Check-in: ${formatShortDate(booking.checkIn)} · Check-out: ${formatShortDate(booking.checkOut)} · ${nights} ${nights === 1 ? "night" : "nights"} · ${guestStr}`;
    }
    return "";
  }

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.scroll} stickyHeaderIndices={[0]}>
        {/* Cover photo + back button */}
        <View style={styles.photoContainer}>
          {!imgError && booking.listing.primaryPhotoUrl ? (
            <ListingImage
              uri={booking.listing.primaryPhotoUrl}
              style={styles.coverPhoto}
              resizeMode="cover"
              onError={() => setImgError(true)}
            />
          ) : (
            <View style={[styles.coverPhoto, styles.coverPhotoPlaceholder]} />
          )}
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.shareBtn}
            onPress={() => void shareVoucher(booking)}
          >
            <Ionicons name="share-outline" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.contentPad}>
          {/* Payment success banner */}
          {justPaid && (
            <View style={styles.successBanner}>
              <Ionicons name="checkmark-circle" size={22} color="#15803d" />
              <Text style={styles.successBannerText}>
                Payment successful! Your booking is confirmed.
              </Text>
            </View>
          )}

          {/* Active booking banner */}
          {booking.status === "active" && (
            <View style={styles.activeBanner}>
              <Ionicons name="radio-button-on" size={16} color="#1d4ed8" />
              <Text style={styles.activeBannerText}>This booking is currently active</Text>
            </View>
          )}

          {/* Reference + status */}
          <View style={styles.referenceRow}>
            <View style={styles.referenceBox}>
              <Text style={styles.referenceValue}>{booking.reference}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: statusBg }]}>
              <Text style={[styles.statusBadgeText, { color: statusTextColor }]}>{statusLabel}</Text>
            </View>
          </View>

          {/* Listing */}
          <Section title="Listing">
            <Text style={styles.listingTitle}>{booking.listing.title}</Text>
            <Text style={styles.listingAddress}>{booking.listing.address}</Text>
            <Text style={styles.listingAddress}>{booking.listing.town}, {booking.listing.country}</Text>
          </Section>

          {/* Stay / rental details */}
          <Section title={isCar ? "Rental Details" : "Stay Details"}>
            <Text style={styles.stayDetails}>{stayDetails()}</Text>
            {booking.specialRequests ? (
              <View style={styles.specialRequestsBox}>
                <Text style={styles.specialRequestsLabel}>Special requests</Text>
                <Text style={styles.specialRequestsText}>{booking.specialRequests}</Text>
              </View>
            ) : null}
          </Section>

          {/* Guest details */}
          <Section title="Guest Details">
            <DetailRow label="Name" value={`${booking.guestFirstName} ${booking.guestLastName}`} />
            <DetailRow label="Email" value={booking.guestEmail} />
            {isCar && booking.driverFirstName && (
              <>
                <DetailRow
                  label="Driver"
                  value={`${booking.driverFirstName} ${booking.driverLastName ?? ""}`}
                />
                {booking.driverAge != null && (
                  <DetailRow label="Driver age" value={String(booking.driverAge)} />
                )}
              </>
            )}
          </Section>

          {/* Pricing breakdown */}
          <Section title="Pricing">
            <View style={styles.priceTable}>
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Subtotal</Text>
                <Text style={styles.priceValue}>{formatCurrency(booking.subtotal, booking.currency)}</Text>
              </View>
              {booking.discountAmount != null && booking.discountAmount > 0 && (
                <View style={styles.priceRow}>
                  <Text style={styles.priceLabel}>Discount</Text>
                  <Text style={[styles.priceValue, styles.discountValue]}>
                    – {formatCurrency(booking.discountAmount, booking.currency)}
                  </Text>
                </View>
              )}
              {booking.serviceFee != null && booking.serviceFee > 0 && (
                <View style={styles.priceRow}>
                  <Text style={styles.priceLabel}>Service fee</Text>
                  <Text style={styles.priceValue}>+ {formatCurrency(booking.serviceFee, booking.currency)}</Text>
                </View>
              )}
              {booking.taxAmount != null && booking.taxAmount > 0 && (
                <View style={styles.priceRow}>
                  <Text style={styles.priceLabel}>Taxes</Text>
                  <Text style={styles.priceValue}>+ {formatCurrency(booking.taxAmount, booking.currency)}</Text>
                </View>
              )}
              {booking.deliveryFee != null && booking.deliveryFee > 0 && (
                <View style={styles.priceRow}>
                  <Text style={styles.priceLabel}>Delivery fee</Text>
                  <Text style={styles.priceValue}>+ {formatCurrency(booking.deliveryFee, booking.currency)}</Text>
                </View>
              )}
              <View style={[styles.priceRow, styles.totalRow]}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>{formatCurrency(booking.totalAmount, booking.currency)}</Text>
              </View>
            </View>
          </Section>

          {/* Cancellation policy */}
          {booking.cancellationPolicy && (
            <Section title="Cancellation Policy">
              <Text style={styles.policyText}>{booking.cancellationPolicy}</Text>
            </Section>
          )}

          {/* Timeline */}
          <Section title="Timeline">
            <Timeline booking={booking} />
          </Section>

          {/* Cancellation / refund details */}
          {cancelled && (
            <Section title={booking.status === "refunded" ? "Refund Details" : "Cancellation Details"}>
              <View style={[styles.cancellationBox, booking.status === "refunded" && styles.refundBox]}>
                <Text style={[styles.cancellationReason, booking.status === "refunded" && styles.refundReason]}>
                  {cancelledByLabel(booking.status)}
                </Text>
                {booking.cancelledAt && (
                  <Text style={styles.cancellationDate}>On {formatFullDate(booking.cancelledAt)}</Text>
                )}
                {booking.refundAmount != null && booking.refundAmount > 0 && (
                  <Text style={styles.cancellationRefund}>
                    Refund: {formatCurrency(booking.refundAmount, booking.currency)}
                  </Text>
                )}
              </View>
            </Section>
          )}

          {/* Actions */}
          <View style={styles.actionsSection}>
            {/* Complete Payment — for pending_payment status */}
            {booking.status === "pending_payment" && (
              <TouchableOpacity
                style={styles.payBtn}
                onPress={() =>
                  router.push({ pathname: "/pay/[bookingId]", params: { bookingId: booking.id } })
                }
              >
                <Ionicons name="card-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.payBtnText}>Complete Payment</Text>
              </TouchableOpacity>
            )}

            {/* Cancel — only when canCancel and not already cancelled */}
            {booking.canCancel && !cancelled && (
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={handleCancelPress}
                disabled={cancelMutation.isPending}
              >
                {cancelMutation.isPending ? (
                  <ActivityIndicator size="small" color="#dc2626" />
                ) : (
                  <Text style={styles.cancelBtnText}>Cancel Booking</Text>
                )}
              </TouchableOpacity>
            )}

            {/* Review — only for completed bookings */}
            {booking.status === "completed" && (
              (booking.hasReview || booking.reviewId) ? (
                <View style={styles.reviewSubmittedBox}>
                  <Ionicons name="star" size={16} color="#9ca3af" style={{ marginRight: 6 }} />
                  <Text style={styles.reviewSubmittedText}>Review Submitted</Text>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.reviewBtn}
                  onPress={() => router.push(`/review/${booking.id}` as any)}
                >
                  <Ionicons name="star-outline" size={16} color="#1a73e8" style={{ marginRight: 6 }} />
                  <Text style={styles.reviewBtnText}>Leave a Review</Text>
                </TouchableOpacity>
              )
            )}

            {/* Share voucher button */}
            <TouchableOpacity
              style={styles.shareVoucherBtn}
              onPress={() => void shareVoucher(booking)}
            >
              <Ionicons name="document-text-outline" size={16} color="#374151" style={{ marginRight: 6 }} />
              <Text style={styles.shareVoucherBtnText}>Share Voucher</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  scroll: { paddingBottom: 40 },

  // Photo
  photoContainer: { position: "relative" },
  coverPhoto: { width: "100%", height: 250, backgroundColor: "#e5e7eb" },
  coverPhotoPlaceholder: { backgroundColor: "#d1d5db" },
  backBtn: {
    position: "absolute",
    top: 12,
    left: 12,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: 20,
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },
  shareBtn: {
    position: "absolute",
    top: 12,
    right: 12,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderRadius: 20,
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
  },

  // Banners
  successBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0fdf4",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#bbf7d0",
    marginBottom: 16,
    gap: 10,
  },
  successBannerText: { fontSize: 14, fontWeight: "600", color: "#15803d", flex: 1 },
  activeBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#eff6ff",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    marginBottom: 16,
    gap: 8,
  },
  activeBannerText: { fontSize: 13, fontWeight: "600", color: "#1d4ed8" },

  // Content
  contentPad: { paddingHorizontal: 16, paddingTop: 16 },

  // Reference + status
  referenceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 20,
    flexWrap: "wrap",
  },
  referenceBox: {
    backgroundColor: "#eff6ff",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "#bfdbfe",
  },
  referenceValue: { fontSize: 15, fontWeight: "800", color: "#1a73e8", letterSpacing: 0.5 },
  statusBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  statusBadgeText: { fontSize: 12, fontWeight: "700" },

  // Section
  section: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 10,
  },

  // Listing
  listingTitle: { fontSize: 18, fontWeight: "700", color: "#111827", marginBottom: 4 },
  listingAddress: { fontSize: 13, color: "#6b7280", lineHeight: 18 },

  // Stay details
  stayDetails: { fontSize: 14, color: "#374151", lineHeight: 20 },
  specialRequestsBox: {
    backgroundColor: "#f9fafb",
    borderRadius: 8,
    padding: 10,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  specialRequestsLabel: { fontSize: 11, fontWeight: "600", color: "#6b7280", marginBottom: 4 },
  specialRequestsText: { fontSize: 13, color: "#374151", lineHeight: 18 },

  // Detail rows
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  detailLabel: { fontSize: 13, color: "#6b7280" },
  detailValue: { fontSize: 13, color: "#111827", fontWeight: "500", flex: 1, textAlign: "right" },

  // Pricing
  priceTable: { gap: 6 },
  priceRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  priceLabel: { fontSize: 14, color: "#374151", flex: 1 },
  priceValue: { fontSize: 14, color: "#111827", fontWeight: "500" },
  discountValue: { color: "#16a34a" },
  totalRow: { borderTopWidth: 1, borderTopColor: "#e5e7eb", marginTop: 4, paddingTop: 8 },
  totalLabel: { fontSize: 16, fontWeight: "800", color: "#111827", flex: 1 },
  totalValue: { fontSize: 16, fontWeight: "800", color: "#111827" },

  // Policy
  policyText: { fontSize: 14, color: "#374151", textTransform: "capitalize" },

  // Timeline
  timeline: { gap: 0 },
  timelineItem: { flexDirection: "row", gap: 12, minHeight: 56 },
  timelineLeft: { alignItems: "center", width: 20 },
  timelineDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#e5e7eb",
    borderWidth: 2,
    borderColor: "#d1d5db",
    marginTop: 3,
  },
  timelineDotDone: { backgroundColor: "#16a34a", borderColor: "#16a34a" },
  timelineLine: { flex: 1, width: 2, backgroundColor: "#e5e7eb", marginVertical: 4 },
  timelineLineDone: { backgroundColor: "#16a34a" },
  timelineRight: { flex: 1, paddingBottom: 16 },
  timelineLabel: { fontSize: 14, fontWeight: "600", color: "#9ca3af" },
  timelineLabelDone: { color: "#111827" },
  timelineDate: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  timelinePending: { fontSize: 12, color: "#9ca3af", marginTop: 2, fontStyle: "italic" },

  // Cancellation / refund
  cancellationBox: {
    backgroundColor: "#fee2e2",
    borderRadius: 10,
    padding: 12,
    gap: 4,
  },
  refundBox: { backgroundColor: "#f0fdf4", borderWidth: 1, borderColor: "#bbf7d0" },
  cancellationReason: { fontSize: 14, fontWeight: "700", color: "#dc2626" },
  refundReason: { color: "#15803d" },
  cancellationDate: { fontSize: 13, color: "#b91c1c" },
  cancellationRefund: { fontSize: 13, color: "#16a34a", fontWeight: "600" },

  // Actions
  actionsSection: { gap: 12, marginTop: 4, marginBottom: 20 },

  payBtn: {
    backgroundColor: "#1a73e8",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
  },
  payBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },

  cancelBtn: {
    borderWidth: 2,
    borderColor: "#dc2626",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
  },
  cancelBtnText: { fontSize: 15, fontWeight: "700", color: "#dc2626" },

  reviewBtn: {
    borderWidth: 2,
    borderColor: "#1a73e8",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    backgroundColor: "#eff6ff",
  },
  reviewBtnText: { fontSize: 15, fontWeight: "700", color: "#1a73e8" },

  reviewSubmittedBox: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    backgroundColor: "#f9fafb",
  },
  reviewSubmittedText: { fontSize: 14, color: "#9ca3af" },

  shareVoucherBtn: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  shareVoucherBtnText: { fontSize: 14, fontWeight: "600", color: "#374151" },

  // Error / skeleton
  errorTitle: { fontSize: 18, fontWeight: "700", color: "#111827", marginTop: 16, marginBottom: 20, textAlign: "center" },
  backButton: {
    backgroundColor: "#1a73e8",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  backButtonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  photoBg: { height: 250, backgroundColor: "#e5e7eb" },
  skeletonLine: { borderRadius: 6, backgroundColor: "#e5e7eb", marginBottom: 8 },
});
