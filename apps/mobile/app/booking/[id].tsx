import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listingApi } from "../../lib/listing-api";
import { K } from "../../constants/theme";

type BookingStatus =
  | "confirmed" | "pending_payment" | "completed"
  | "cancelled_by_guest" | "cancelled_by_provider" | "cancelled_by_system";

interface BookingDetail {
  id: string;
  reference: string;
  status: BookingStatus;
  listingType: "hotel" | "apartment" | "car";
  listing: { id: string; title: string; address: string; town: string; country: string; primaryPhotoUrl: string | null };
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
  deliveryFee?: number;
  totalAmount: number;
  currency: string;
  cancellationPolicy?: string;
  refundAmount?: number;
  cancelledAt?: string;
  confirmedAt?: string;
  completedAt?: string;
  createdAt: string;
  canCancel: boolean;
  hasReview?: boolean;
  reviewId?: string;
}

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  confirmed: { label: "Confirmed", bg: "#D1FAE5", text: "#065F46", dot: "#00A86B" },
  pending_payment: { label: "Pending Payment", bg: "#FEF3C7", text: "#92400E", dot: "#F59E0B" },
  completed: { label: "Completed", bg: "#F3F4F6", text: "#6B7280", dot: "#9CA3AF" },
  cancelled_by_guest: { label: "Cancelled", bg: "#FEE2E2", text: "#DC2626", dot: "#EF4444" },
  cancelled_by_provider: { label: "Cancelled", bg: "#FEE2E2", text: "#DC2626", dot: "#EF4444" },
  cancelled_by_system: { label: "Cancelled", bg: "#FEE2E2", text: "#DC2626", dot: "#EF4444" },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en", { weekday: "short", day: "numeric", month: "short" });
}
function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString("en", { day: "numeric", month: "short" })} ${d.toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" })}`;
}
function fmtFull(iso: string) {
  return new Date(iso).toLocaleDateString("en", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function fmt(n: number, cur: string) { return `${cur} ${n.toLocaleString()}`; }
function isCancelled(s: BookingStatus) { return s.startsWith("cancelled"); }

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function Timeline({ booking }: { booking: BookingDetail }) {
  const events = [
    { label: "Booking Created", date: booking.createdAt, done: true },
    { label: "Confirmed", date: booking.confirmedAt, done: !!booking.confirmedAt },
    { label: "Completed", date: booking.completedAt, done: !!booking.completedAt },
  ];
  return (
    <View>
      {events.map((ev, i) => (
        <View key={ev.label} style={styles.tlItem}>
          <View style={styles.tlLeft}>
            <View style={[styles.tlDot, ev.done && styles.tlDotDone]} />
            {i < events.length - 1 && <View style={[styles.tlLine, ev.done && styles.tlLineDone]} />}
          </View>
          <View style={styles.tlRight}>
            <Text style={[styles.tlLabel, ev.done && styles.tlLabelDone]}>{ev.label}</Text>
            {ev.date
              ? <Text style={styles.tlDate}>{fmtFull(ev.date)}</Text>
              : <Text style={styles.tlPending}>Pending</Text>}
          </View>
        </View>
      ))}
    </View>
  );
}

export default function BookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();

  const { data: booking, isLoading, isError } = useQuery<BookingDetail>({
    queryKey: ["booking", id],
    queryFn: async () => {
      const res = await listingApi.get<{ data: BookingDetail }>(`/guests/me/bookings/${id}`);
      return res.data.data;
    },
    enabled: !!id,
  });

  const cancelMutation = useMutation({
    mutationFn: async () => { await listingApi.post(`/bookings/${id}/cancel`, {}); },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["booking", id] });
      qc.invalidateQueries({ queryKey: ["providerBookings"] });
    },
    onError: (err: any) => Alert.alert("Error", err?.response?.data?.message ?? "Could not cancel booking."),
  });

  function handleCancel() {
    if (!booking) return;
    const refundLine = (booking.refundAmount ?? 0) > 0
      ? `\n\nEstimated refund: ${fmt(booking.refundAmount!, booking.currency)}`
      : "";
    Alert.alert("Cancel Booking?", `Are you sure?${booking.cancellationPolicy ? `\nPolicy: ${booking.cancellationPolicy}` : ""}${refundLine}`, [
      { text: "Keep Booking", style: "cancel" },
      { text: "Cancel Booking", style: "destructive", onPress: () => cancelMutation.mutate() },
    ]);
  }

  if (isLoading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={K.colors.accent} size="large" />
      </View>
    );
  }

  if (isError || !booking) {
    return (
      <View style={[styles.container, styles.center]}>
        <Text style={styles.errorEmoji}>⚠️</Text>
        <Text style={styles.errorTitle}>Booking not found</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={() => router.back()}>
          <Text style={styles.retryText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const st = STATUS_CONFIG[booking.status] ?? STATUS_CONFIG.completed!;
  const isCar = booking.listingType === "car";
  const cancelled = isCancelled(booking.status);

  function stayString(b: BookingDetail) {
    if (isCar && b.pickupDatetime && b.returnDatetime) {
      return `Pickup: ${fmtDateTime(b.pickupDatetime)} · Return: ${fmtDateTime(b.returnDatetime)} · ${b.nightsOrDays} day${b.nightsOrDays !== 1 ? "s" : ""}`;
    }
    if (b.checkIn && b.checkOut) {
      const g = `${b.adults ?? 0} adult${b.adults !== 1 ? "s" : ""}${(b.children ?? 0) > 0 ? `, ${b.children} child${b.children !== 1 ? "ren" : ""}` : ""}`;
      return `${fmtDate(b.checkIn)} → ${fmtDate(b.checkOut)} · ${b.nightsOrDays} night${b.nightsOrDays !== 1 ? "s" : ""} · ${g}`;
    }
    return "";
  }

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Booking Details</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Cover photo */}
        {booking.listing.primaryPhotoUrl ? (
          <Image source={{ uri: booking.listing.primaryPhotoUrl }} style={styles.photo} resizeMode="cover" />
        ) : (
          <View style={styles.photoPlaceholder}>
            <Text style={styles.photoPlaceholderText}>🏠</Text>
          </View>
        )}

        <View style={styles.content}>
          {/* Reference + status */}
          <View style={styles.refRow}>
            <View style={styles.refBox}>
              <Text style={styles.refValue}>{booking.reference}</Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
              <View style={[styles.statusDot, { backgroundColor: st.dot }]} />
              <Text style={[styles.statusText, { color: st.text }]}>{st.label}</Text>
            </View>
          </View>

          {/* Listing */}
          <SectionCard title="Property">
            <Text style={styles.listingTitle}>{booking.listing.title}</Text>
            <Text style={styles.listingAddr}>{booking.listing.address}</Text>
            <Text style={styles.listingAddr}>{booking.listing.town}, {booking.listing.country}</Text>
          </SectionCard>

          {/* Stay details */}
          <SectionCard title={isCar ? "Rental Details" : "Stay Details"}>
            <Text style={styles.stayText}>{stayString(booking)}</Text>
            {booking.specialRequests ? (
              <View style={styles.specialBox}>
                <Text style={styles.specialLabel}>Special Requests</Text>
                <Text style={styles.specialText}>{booking.specialRequests}</Text>
              </View>
            ) : null}
          </SectionCard>

          {/* Guest */}
          <SectionCard title="Guest">
            <Row label="Name" value={`${booking.guestFirstName} ${booking.guestLastName}`} />
            <Row label="Email" value={booking.guestEmail} />
            {isCar && booking.driverFirstName && (
              <>
                <Row label="Driver" value={`${booking.driverFirstName} ${booking.driverLastName ?? ""}`} />
                {booking.driverAge != null && <Row label="Driver Age" value={String(booking.driverAge)} />}
              </>
            )}
          </SectionCard>

          {/* Pricing */}
          <SectionCard title="Payment">
            <View style={styles.priceTable}>
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Subtotal</Text>
                <Text style={styles.priceValue}>{fmt(booking.subtotal, booking.currency)}</Text>
              </View>
              {(booking.discountAmount ?? 0) > 0 && (
                <View style={styles.priceRow}>
                  <Text style={styles.priceLabel}>Discount</Text>
                  <Text style={[styles.priceValue, { color: K.colors.success }]}>
                    − {fmt(booking.discountAmount!, booking.currency)}
                  </Text>
                </View>
              )}
              {(booking.deliveryFee ?? 0) > 0 && (
                <View style={styles.priceRow}>
                  <Text style={styles.priceLabel}>Delivery Fee</Text>
                  <Text style={styles.priceValue}>+ {fmt(booking.deliveryFee!, booking.currency)}</Text>
                </View>
              )}
              <View style={styles.priceTotalRow}>
                <Text style={styles.priceTotalLabel}>Total</Text>
                <Text style={styles.priceTotalValue}>{fmt(booking.totalAmount, booking.currency)}</Text>
              </View>
            </View>
          </SectionCard>

          {/* Cancellation policy */}
          {booking.cancellationPolicy && (
            <SectionCard title="Cancellation Policy">
              <Text style={styles.policyText}>{booking.cancellationPolicy}</Text>
            </SectionCard>
          )}

          {/* Timeline */}
          <SectionCard title="Timeline">
            <Timeline booking={booking} />
          </SectionCard>

          {/* Cancelled info */}
          {cancelled && (
            <SectionCard title="Cancellation">
              <View style={styles.cancelledBox}>
                <Text style={styles.cancelledLabel}>
                  {booking.status === "cancelled_by_guest" ? "Cancelled by guest" : booking.status === "cancelled_by_provider" ? "Cancelled by you" : "Cancelled by system"}
                </Text>
                {booking.cancelledAt && <Text style={styles.cancelledDate}>{fmtFull(booking.cancelledAt)}</Text>}
                {(booking.refundAmount ?? 0) > 0 && (
                  <Text style={styles.cancelledRefund}>Refund: {fmt(booking.refundAmount!, booking.currency)}</Text>
                )}
              </View>
            </SectionCard>
          )}

          {/* Actions */}
          <View style={styles.actions}>
            {booking.canCancel && !cancelled && (
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={handleCancel}
                disabled={cancelMutation.isPending}
                activeOpacity={0.85}
              >
                {cancelMutation.isPending
                  ? <ActivityIndicator color={K.colors.error} size="small" />
                  : <Text style={styles.cancelBtnText}>Cancel Booking</Text>}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: K.colors.bgLight },
  center: { alignItems: "center", justifyContent: "center" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: K.colors.darkGreen,
    paddingTop: 56,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  backBtnText: { fontSize: 28, color: "#fff", fontWeight: "300" },
  headerTitle: { fontSize: K.font.lg, fontWeight: "800", color: "#fff" },

  scroll: { paddingBottom: 40 },
  photo: { width: "100%", height: 220 },
  photoPlaceholder: { height: 180, backgroundColor: K.colors.darkGreenMid, alignItems: "center", justifyContent: "center" },
  photoPlaceholderText: { fontSize: 56 },

  content: { padding: 16, gap: 12 },

  refRow: { flexDirection: "row", alignItems: "center", gap: 10, flexWrap: "wrap" },
  refBox: {
    backgroundColor: K.colors.accentDim,
    borderRadius: K.radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  refValue: { fontSize: K.font.base, fontWeight: "800", color: K.colors.darkGreen, letterSpacing: 0.5 },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: K.radius.full, paddingHorizontal: 10, paddingVertical: 5 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 12, fontWeight: "700" },

  section: {
    backgroundColor: K.colors.bgCard,
    borderRadius: K.radius.xl,
    padding: 16,
    borderWidth: 1,
    borderColor: K.colors.border,
    ...K.shadow.sm,
  },
  sectionTitle: { fontSize: 11, fontWeight: "700", color: K.colors.textMuted, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 12 },

  listingTitle: { fontSize: K.font.lg, fontWeight: "800", color: K.colors.textDark, marginBottom: 4 },
  listingAddr: { fontSize: K.font.sm, color: K.colors.textMuted, lineHeight: 20 },

  stayText: { fontSize: K.font.sm, color: K.colors.textMid, lineHeight: 22 },
  specialBox: { backgroundColor: K.colors.bgLight, borderRadius: K.radius.sm, padding: 10, marginTop: 10, borderWidth: 1, borderColor: K.colors.border },
  specialLabel: { fontSize: 11, fontWeight: "600", color: K.colors.textMuted, marginBottom: 4 },
  specialText: { fontSize: K.font.sm, color: K.colors.textMid, lineHeight: 20 },

  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: K.colors.border },
  rowLabel: { fontSize: K.font.sm, color: K.colors.textMuted },
  rowValue: { fontSize: K.font.sm, color: K.colors.textDark, fontWeight: "600", flex: 1, textAlign: "right" },

  priceTable: { gap: 8 },
  priceRow: { flexDirection: "row", justifyContent: "space-between" },
  priceLabel: { fontSize: K.font.sm, color: K.colors.textMid },
  priceValue: { fontSize: K.font.sm, color: K.colors.textDark, fontWeight: "600" },
  priceTotalRow: { flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: K.colors.border, paddingTop: 10, marginTop: 4 },
  priceTotalLabel: { fontSize: K.font.base, fontWeight: "800", color: K.colors.textDark },
  priceTotalValue: { fontSize: K.font.base, fontWeight: "900", color: K.colors.darkGreen },

  policyText: { fontSize: K.font.sm, color: K.colors.textMid, lineHeight: 20, textTransform: "capitalize" },

  tlItem: { flexDirection: "row", gap: 12, minHeight: 56 },
  tlLeft: { alignItems: "center", width: 20 },
  tlDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: K.colors.border, borderWidth: 2, borderColor: K.colors.border, marginTop: 3 },
  tlDotDone: { backgroundColor: K.colors.success, borderColor: K.colors.success },
  tlLine: { flex: 1, width: 2, backgroundColor: K.colors.border, marginVertical: 4 },
  tlLineDone: { backgroundColor: K.colors.success },
  tlRight: { flex: 1, paddingBottom: 16 },
  tlLabel: { fontSize: K.font.sm, fontWeight: "600", color: K.colors.textMuted },
  tlLabelDone: { color: K.colors.textDark },
  tlDate: { fontSize: 12, color: K.colors.textMuted, marginTop: 2 },
  tlPending: { fontSize: 12, color: K.colors.textMuted, marginTop: 2, fontStyle: "italic" },

  cancelledBox: { backgroundColor: "#FEE2E2", borderRadius: K.radius.md, padding: 12, gap: 4 },
  cancelledLabel: { fontSize: K.font.sm, fontWeight: "700", color: K.colors.error },
  cancelledDate: { fontSize: K.font.sm, color: "#B91C1C" },
  cancelledRefund: { fontSize: K.font.sm, fontWeight: "600", color: K.colors.success },

  actions: { gap: 12, marginTop: 4 },
  cancelBtn: {
    borderWidth: 2,
    borderColor: K.colors.error,
    borderRadius: K.radius.lg,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelBtnText: { fontSize: K.font.base, fontWeight: "700", color: K.colors.error },

  errorEmoji: { fontSize: 56, marginBottom: 16 },
  errorTitle: { fontSize: K.font.xl, fontWeight: "800", color: K.colors.textDark, marginBottom: 20 },
  retryBtn: { backgroundColor: K.colors.accent, borderRadius: K.radius.md, paddingHorizontal: 24, paddingVertical: 12 },
  retryText: { color: "#fff", fontWeight: "700" },
});
