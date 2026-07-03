import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  StyleSheet,
  Share,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { listingApi } from "../../../lib/listing-api";
import { K } from "../../../constants/theme";
import { BookingStatusBadge, bookingStatusCfg } from "../../../components/bookings/BookingStatusBadge";
import { BookingSummaryCard } from "../../../components/bookings/BookingSummaryCard";
import { BookingDetailSection, BookingDetailRow, BookingTimeline, type TimelineEvent } from "../../../components/bookings/BookingDetailSection";
import { BookingActionRow } from "../../../components/bookings/BookingActionRow";
import { BookingDetailSkeleton } from "../../../components/bookings/BookingLoadingSkeleton";

// ── Types — mirrors the GET /provider/bookings list response ──────────────────

interface ProviderBooking {
  id: string;
  reference: string;
  listingTitle: string;
  listingCategory: "hotel" | "apartment" | "car";
  guestFirstName: string;
  guestLastName: string;
  guestEmail?: string;
  guestPhone?: string;
  adults?: number;
  children?: number;
  checkIn?: string;
  checkOut?: string;
  pickupDatetime?: string;
  returnDatetime?: string;
  nightsOrDays: number;
  totalAmount: number;
  providerPayout: number;
  commissionAmount: number;
  currency: string;
  status: string;
  cancellationPolicy?: string;
  specialRequests?: string;
  confirmedAt?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  createdAt: string;
}

interface BookingListResponse {
  total: number;
  bookings: ProviderBooking[];
}

const TABS_ALL = ["all", "upcoming", "completed", "cancelled"];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return `${d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} ${d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
}

function fmtFull(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function guestDisplay(first: string, last: string) {
  const init = last?.[0]?.toUpperCase();
  return init ? `${first} ${init}.` : first;
}

function isCancelled(status: string) {
  return status === "cancelled_by_guest" || status === "cancelled_by_provider" ||
    status === "cancelled_by_system" || status === "refunded";
}

function commissionRatePct(b: ProviderBooking): number {
  if (!b.totalAmount) return 5;
  return Math.round((b.commissionAmount / b.totalAmount) * 100);
}

function buildTimelineEvents(b: ProviderBooking): TimelineEvent[] {
  return [
    { label: "Booking Created",   date: b.createdAt,   done: true },
    { label: "Payment Confirmed", date: b.confirmedAt, done: !!b.confirmedAt },
    {
      label: b.listingCategory === "car" ? "Vehicle Picked Up" : "Guest Checked In",
      date: undefined,
      done: b.status === "completed",
    },
    { label: "Stay Completed", date: undefined, done: b.status === "completed" },
  ];
}

function showMessageStub() {
  Alert.alert(
    "Messaging Coming Soon",
    "In-app guest messaging is not yet available. Please use the contact details provided at check-in to communicate with your guest.",
    [{ text: "OK" }]
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function ProviderBookingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  // Look up from any cached list result first
  function findInCache(): ProviderBooking | null {
    for (const tab of TABS_ALL) {
      const data = qc.getQueryData<BookingListResponse>(["providerBookings", tab]);
      if (data?.bookings) {
        const found = data.bookings.find((b) => b.id === id);
        if (found) return found;
      }
    }
    return null;
  }

  const { data: booking, isLoading, isError, refetch } = useQuery<ProviderBooking>({
    queryKey: ["providerBookingDetail", id],
    queryFn: async () => {
      // Cache hit — no extra API call needed
      const cached = findInCache();
      if (cached) return cached;

      // Cache miss — load the full list and find the booking
      const res = await listingApi.get<{ data: BookingListResponse }>("/provider/bookings", {
        params: { limit: 50, offset: 0 },
      });
      const found = res.data.data.bookings.find((b) => b.id === id);
      if (!found) throw new Error("Booking not found in your reservations.");
      return found;
    },
    staleTime: 60_000,
  });

  // Provider cancel — uses the correct provider endpoint
  const cancelMutation = useMutation({
    mutationFn: async ({ reasonCode, reasonText }: { reasonCode: string; reasonText?: string }) => {
      await listingApi.post(`/provider/bookings/${id}/cancel`, { reasonCode, reasonText });
    },
    onSuccess: () => {
      const now = new Date().toISOString();
      // Immediately reflect cancellation in the detail cache
      qc.setQueryData<ProviderBooking>(["providerBookingDetail", id], (old) =>
        old ? { ...old, status: "cancelled_by_provider", cancelledAt: now } : old
      );
      // Patch every list-tab cache so the booking list also shows Cancelled instantly
      for (const tab of TABS_ALL) {
        qc.setQueryData<BookingListResponse>(["providerBookings", tab], (old) => {
          if (!old) return old;
          return {
            ...old,
            bookings: old.bookings.map((b) =>
              b.id === id ? { ...b, status: "cancelled_by_provider" } : b
            ),
          };
        });
      }
      // Background revalidation for authoritative server data + dashboard counters
      void qc.invalidateQueries({ queryKey: ["providerBookings"] });
      void qc.invalidateQueries({ queryKey: ["providerDashboard"] });
      Alert.alert("Booking Cancelled", "The booking has been cancelled. A full refund will be issued to the guest.");
    },
    onError: (err: any) => {
      const httpStatus = err?.response?.status;
      const errCode: string = err?.response?.data?.error?.code ?? "";
      if (httpStatus === 409 || errCode === "INVALID_STATUS") {
        // Server says it's already cancelled — sync local caches immediately
        const now = new Date().toISOString();
        qc.setQueryData<ProviderBooking>(["providerBookingDetail", id], (old) =>
          old ? { ...old, status: "cancelled_by_provider", cancelledAt: now } : old
        );
        for (const tab of TABS_ALL) {
          qc.setQueryData<BookingListResponse>(["providerBookings", tab], (old) => {
            if (!old) return old;
            return {
              ...old,
              bookings: old.bookings.map((b) =>
                b.id === id ? { ...b, status: "cancelled_by_provider" } : b
              ),
            };
          });
        }
        void qc.invalidateQueries({ queryKey: ["providerBookings"] });
        Alert.alert("Already Cancelled", "This booking has already been cancelled.");
        return;
      }
      const msg = err?.response?.data?.error?.message ?? "Could not cancel this booking. Please try again.";
      Alert.alert("Cancellation Failed", msg);
    },
  });

  function handleCancel() {
    if (!booking) return;
    Alert.alert(
      "Cancel Booking?",
      `Cancel ${booking.reference}?\n\nThis will issue a full refund to the guest and cannot be undone.`,
      [
        { text: "Keep Booking", style: "cancel" },
        {
          text: "Yes, Cancel",
          style: "destructive",
          onPress: () =>
            cancelMutation.mutate({ reasonCode: "provider_cancelled", reasonText: "Cancelled by provider" }),
        },
      ]
    );
  }

  async function handleShare() {
    if (!booking) return;
    const isCar = booking.listingCategory === "car";
    const dateStr = isCar && booking.pickupDatetime && booking.returnDatetime
      ? `Pickup: ${fmtDateTime(booking.pickupDatetime)}\nReturn: ${fmtDateTime(booking.returnDatetime)}`
      : booking.checkIn && booking.checkOut
        ? `Check-in: ${booking.checkIn}\nCheck-out: ${booking.checkOut}`
        : "";

    const lines = [
      "══════════════════════════",
      "  KAINOOK RESERVATION",
      "══════════════════════════",
      `Ref:    ${booking.reference}`,
      `Status: ${bookingStatusCfg(booking.status).label}`,
      "",
      `Listing: ${booking.listingTitle}`,
      "",
      dateStr,
      "",
      `Guest:  ${guestDisplay(booking.guestFirstName, booking.guestLastName)}`,
      "",
      "─── Your Net Payout ───────",
      `${booking.currency} ${booking.providerPayout.toLocaleString()}`,
      `(after ${commissionRatePct(booking)}% Kainook fee)`,
      "══════════════════════════",
    ].filter(Boolean).join("\n");

    try {
      await Share.share({ message: lines, title: `Booking ${booking.reference}` });
    } catch { /* dismissed */ }
  }

  // ── Loading / error ────────────────────────────────────────────────────────

  if (isLoading) return <BookingDetailSkeleton />;

  if (isError || !booking) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.center}>
          <Feather name="alert-circle" size={48} color={K.colors.error} />
          <Text style={s.centerTitle}>Booking not found</Text>
          <Text style={s.centerSub}>Could not load this reservation.{"\n"}Please go back and try again.</Text>
          <TouchableOpacity style={s.retryBtn} onPress={() => refetch()}>
            <Text style={s.retryText}>Retry</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.backLink} onPress={() => router.back()}>
            <Text style={s.backLinkText}>← Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isCar = booking.listingCategory === "car";
  const cancelled = isCancelled(booking.status);
  const canCancel = booking.status === "confirmed";
  const commPct = commissionRatePct(booking);
  const isConfirmed = booking.status === "confirmed";
  const initial = booking.guestFirstName[0]?.toUpperCase() ?? "?";

  return (
    <View style={s.container}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <SafeAreaView edges={["top"]} style={s.header}>
        <View style={s.headerRow}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
            <Feather name="arrow-left" size={20} color="#fff" />
          </TouchableOpacity>
          <View style={s.headerCenter}>
            <Text style={s.headerTitle}>Reservation</Text>
            <Text style={s.headerRef}>{booking.reference}</Text>
          </View>
          <TouchableOpacity style={s.shareHdrBtn} onPress={handleShare}>
            <Feather name="share-2" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Confirmation status banner ───────────────────────────────── */}
        {isConfirmed && (
          <View style={s.statusBanner}>
            <Feather name="check-circle" size={18} color="#059669" />
            <View style={{ flex: 1 }}>
              <Text style={s.statusBannerTitle}>Booking Confirmed ✓</Text>
              <Text style={s.statusBannerSub}>Guest payment has been processed successfully.</Text>
            </View>
          </View>
        )}

        {/* ── Guest header strip ────────────────────────────────────────── */}
        <View style={s.guestHeaderRow}>
          <View style={s.guestHeaderAvatar}>
            <Text style={s.guestHeaderAvatarText}>{initial}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.guestHeaderName}>{guestDisplay(booking.guestFirstName, booking.guestLastName)}</Text>
            <View style={s.guestHeaderBadgeRow}>
              <BookingStatusBadge status={booking.status} size="sm" />
              <Text style={s.guestHeaderIdText}>ID: {booking.reference}</Text>
            </View>
          </View>
        </View>

        {/* ── Commission banner ───────────────────────────────────────── */}
        <View style={s.commPill}>
          <Feather name="info" size={11} color={K.colors.accent} />
          <Text style={s.commPillText}>Net earnings shown (after {commPct}% fee)</Text>
        </View>

        {/* ── Property + Stay/Rental summary ──────────────────────────── */}
        <View style={s.summaryWrap}>
          <BookingSummaryCard
            booking={{
              listingTitle: booking.listingTitle,
              listingCategory: booking.listingCategory,
              checkIn: booking.checkIn,
              checkOut: booking.checkOut,
              pickupDatetime: booking.pickupDatetime,
              returnDatetime: booking.returnDatetime,
              nightsOrDays: booking.nightsOrDays,
              adults: booking.adults,
              children: booking.children,
              specialRequests: booking.specialRequests,
            }}
          />
        </View>

        {/* ── Guest (privacy) ─────────────────────────────────────────── */}
        <BookingDetailSection title="Guest" icon="user">
          <View style={s.guestRow}>
            <View style={s.guestAvatar}>
              <Text style={s.guestAvatarText}>{initial}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.guestName}>{guestDisplay(booking.guestFirstName, booking.guestLastName)}</Text>
              <Text style={s.guestPrivacy}>Contact is protected — use in-app messaging only.</Text>
            </View>
          </View>
        </BookingDetailSection>

        {/* ── Payout breakdown ────────────────────────────────────────── */}
        <BookingDetailSection title="Payout Breakdown" icon="dollar-sign">
          <BookingDetailRow label="Guest total paid" value={`${booking.currency} ${booking.totalAmount.toLocaleString()}`} />
          <BookingDetailRow label={`Kainook fee (${commPct}%)`} value={`− ${booking.currency} ${booking.commissionAmount.toLocaleString()}`} />
          <View style={s.payoutDivider} />
          <View style={s.payoutRow}>
            <View style={s.payoutLeft}>
              <Feather name="trending-up" size={15} color={K.colors.accent} />
              <Text style={s.payoutLabel}>Your Net Payout</Text>
            </View>
            <Text style={s.payoutValue}>{booking.currency} {booking.providerPayout.toLocaleString()}</Text>
          </View>
          <Text style={s.payoutNote}>Disbursed to your account T+24h after guest check-in.</Text>
        </BookingDetailSection>

        {/* ── Cancellation policy ─────────────────────────────────────── */}
        {booking.cancellationPolicy && (
          <BookingDetailSection title="Cancellation Policy" icon="shield">
            <Text style={s.policyText}>{booking.cancellationPolicy}</Text>
          </BookingDetailSection>
        )}

        {/* ── Timeline ────────────────────────────────────────────────── */}
        <BookingDetailSection title="Booking Timeline" icon="clock">
          <BookingTimeline events={buildTimelineEvents(booking)} />
        </BookingDetailSection>

        {/* ── Cancellation details ─────────────────────────────────────── */}
        {cancelled && (
          <BookingDetailSection title="Cancellation Details" icon="x-circle">
            <View style={s.cancelBox}>
              <Text style={s.cancelTitle}>
                {booking.status === "cancelled_by_guest"    ? "Cancelled by guest"
                  : booking.status === "cancelled_by_provider" ? "Cancelled by you"
                  : booking.status === "refunded"               ? "Refund issued"
                  : "Cancelled by system"}
              </Text>
              {booking.cancelledAt && (
                <Text style={s.cancelDate}>{fmtFull(booking.cancelledAt)}</Text>
              )}
              {booking.cancellationReason ? (
                <Text style={s.cancelReason}>{booking.cancellationReason}</Text>
              ) : null}
            </View>
          </BookingDetailSection>
        )}

        {/* ── Actions ─────────────────────────────────────────────────── */}
        <View style={s.actionsWrap}>
          <BookingActionRow
            onMessage={showMessageStub}
            canCancel={canCancel}
            cancelled={cancelled}
            isCancelling={cancelMutation.isPending}
            onCancel={handleCancel}
            onShare={handleShare}
          />
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: K.colors.bgLight },
  scroll: { paddingBottom: 20 },

  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 32 },
  centerTitle: { fontSize: K.font.xl, fontWeight: "800", color: K.colors.textDark, textAlign: "center" },
  centerSub: { fontSize: K.font.sm, color: K.colors.textMuted, textAlign: "center", lineHeight: 20 },
  retryBtn: { backgroundColor: K.colors.accent, borderRadius: K.radius.md, paddingHorizontal: 28, paddingVertical: 12 },
  retryText: { color: "#fff", fontWeight: "700", fontSize: K.font.base },
  backLink: { paddingVertical: 8 },
  backLinkText: { color: K.colors.accent, fontWeight: "600", fontSize: K.font.sm },

  // Header
  header: { backgroundColor: K.colors.darkGreen, paddingHorizontal: 16, paddingBottom: 14 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: K.colors.glassBg, borderWidth: 1, borderColor: K.colors.glassBorder,
    alignItems: "center", justifyContent: "center",
  },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: { fontSize: K.font.lg, fontWeight: "800", color: "#fff" },
  headerRef: { fontSize: K.font.xs, color: K.colors.textLightMuted, marginTop: 2, letterSpacing: 0.5 },
  shareHdrBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: K.colors.glassBg, borderWidth: 1, borderColor: K.colors.glassBorder,
    alignItems: "center", justifyContent: "center",
  },

  // Status banner
  statusBanner: {
    flexDirection: "row", alignItems: "flex-start", gap: 12,
    backgroundColor: "#F0FDF4", borderRadius: K.radius.lg,
    borderWidth: 1.5, borderColor: "#6EE7B7",
    padding: 14, marginHorizontal: 16, marginTop: 16, marginBottom: 4,
  },
  statusBannerTitle: { fontSize: K.font.base, fontWeight: "800", color: "#059669", marginBottom: 2 },
  statusBannerSub: { fontSize: K.font.xs, color: K.colors.textMuted },

  // Guest header strip (mockup-style: name + status + id, right under the top banner)
  guestHeaderRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, marginTop: 16,
  },
  guestHeaderAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: K.colors.darkGreen, alignItems: "center", justifyContent: "center",
  },
  guestHeaderAvatarText: { fontSize: K.font.lg, fontWeight: "800", color: "#fff" },
  guestHeaderName: { fontSize: K.font.xl, fontWeight: "900", color: K.colors.textDark, marginBottom: 4 },
  guestHeaderBadgeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  guestHeaderIdText: { fontSize: 11, color: K.colors.textMuted, fontWeight: "600" },

  commPill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: K.colors.accentDim, borderRadius: K.radius.full,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: K.colors.accent + "40",
    marginHorizontal: 16, marginTop: 12,
    alignSelf: "flex-start",
  },
  commPillText: { fontSize: 10, color: K.colors.accent, fontWeight: "600" },

  summaryWrap: { paddingHorizontal: 16, marginTop: 12 },

  // Guest section
  guestRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  guestAvatar: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: K.colors.darkGreen, alignItems: "center", justifyContent: "center",
  },
  guestAvatarText: { fontSize: K.font.xl, fontWeight: "800", color: "#fff" },
  guestName: { fontSize: K.font.lg, fontWeight: "800", color: K.colors.textDark },
  guestPrivacy: { fontSize: 11, color: K.colors.textMuted, marginTop: 3, lineHeight: 15 },

  // Payout
  payoutDivider: { height: 1, backgroundColor: K.colors.border, marginVertical: 8 },
  payoutRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: K.colors.accentDim, borderRadius: K.radius.md,
    paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: K.colors.accent + "30",
  },
  payoutLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  payoutLabel: { fontSize: K.font.base, fontWeight: "800", color: K.colors.darkGreen },
  payoutValue: { fontSize: K.font.xl, fontWeight: "900", color: K.colors.darkGreen },
  payoutNote: { fontSize: 11, color: K.colors.textMuted, marginTop: 8, lineHeight: 15 },

  // Policy
  policyText: { fontSize: K.font.sm, color: K.colors.textMid, textTransform: "capitalize", lineHeight: 20 },

  // Cancellation
  cancelBox: {
    backgroundColor: "#FEF2F2", borderRadius: K.radius.md,
    padding: 12, gap: 4, borderWidth: 1, borderColor: "#FECACA",
  },
  cancelTitle: { fontSize: K.font.sm, fontWeight: "700", color: K.colors.error },
  cancelDate: { fontSize: 12, color: K.colors.error },
  cancelReason: { fontSize: 12, color: "#7F1D1D" },

  // Actions
  actionsWrap: { paddingHorizontal: 16, marginTop: 16 },
});
