import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StyleSheet,
  Share,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { listingApi } from "../../../lib/listing-api";
import { K } from "../../../constants/theme";

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

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { label: string; bg: string; text: string; dot: string; icon: React.ComponentProps<typeof Feather>["name"] }> = {
  confirmed:             { label: "Confirmed",  bg: "#D1FAE5", text: "#065F46", dot: "#059669", icon: "check-circle" },
  active:                { label: "Active",     bg: "#DBEAFE", text: "#1D4ED8", dot: "#3B82F6", icon: "radio" },
  pending_payment:       { label: "Pending",    bg: "#FEF3C7", text: "#92400E", dot: "#F59E0B", icon: "clock" },
  completed:             { label: "Completed",  bg: "#F1F5F9", text: "#475569", dot: "#94A3B8", icon: "check-square" },
  cancelled_by_guest:    { label: "Cancelled",  bg: "#FEE2E2", text: "#DC2626", dot: "#EF4444", icon: "x-circle" },
  cancelled_by_provider: { label: "Cancelled",  bg: "#FEE2E2", text: "#DC2626", dot: "#EF4444", icon: "x-circle" },
  cancelled_by_system:   { label: "Cancelled",  bg: "#FEE2E2", text: "#DC2626", dot: "#EF4444", icon: "x-circle" },
  refunded:              { label: "Refunded",   bg: "#D1FAE5", text: "#065F46", dot: "#059669", icon: "rotate-ccw" },
};

const TABS_ALL = ["all", "upcoming", "active", "completed", "cancelled"];

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

// ── Sub-components ─────────────────────────────────────────────────────────────

function SectionCard({ title, icon, children }: {
  title: string;
  icon: React.ComponentProps<typeof Feather>["name"];
  children: React.ReactNode;
}) {
  return (
    <View style={s.card}>
      <View style={s.cardHeader}>
        <View style={s.cardIcon}>
          <Feather name={icon} size={13} color={K.colors.accent} />
        </View>
        <Text style={s.cardTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function Row({ label, value, green }: { label: string; value: string; green?: boolean }) {
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={[s.rowValue, green && s.rowValueGreen]}>{value}</Text>
    </View>
  );
}

function Timeline({ b }: { b: ProviderBooking }) {
  const events = [
    { label: "Booking Created",   date: b.createdAt,   done: true },
    { label: "Payment Confirmed", date: b.confirmedAt, done: !!b.confirmedAt },
    {
      label: b.listingCategory === "car" ? "Vehicle Picked Up" : "Guest Checked In",
      date: undefined,
      done: b.status === "active" || b.status === "completed",
    },
    { label: "Stay Completed", date: undefined, done: b.status === "completed" },
  ];

  return (
    <View>
      {events.map((ev, i) => (
        <View key={ev.label} style={s.tlItem}>
          <View style={s.tlLeft}>
            <View style={[s.tlDot, ev.done && s.tlDotDone]} />
            {i < events.length - 1 && <View style={[s.tlLine, ev.done && s.tlLineDone]} />}
          </View>
          <View style={s.tlRight}>
            <Text style={[s.tlLabel, ev.done && s.tlLabelDone]}>{ev.label}</Text>
            <Text style={s.tlDate}>{ev.date ? fmtFull(ev.date) : "Pending"}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

// ── Skeleton ───────────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <View style={{ flex: 1, backgroundColor: K.colors.bgLight, padding: 20 }}>
      <View style={{ height: 24, width: "60%", backgroundColor: K.colors.border, borderRadius: 6, marginBottom: 16 }} />
      {[80, 60, 100, 50, 90, 70].map((w, i) => (
        <View key={i} style={{ height: 14, width: `${w}%`, backgroundColor: K.colors.border, borderRadius: 6, marginBottom: 12 }} />
      ))}
    </View>
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
      void qc.invalidateQueries({ queryKey: ["providerBookingDetail", id] });
      void qc.invalidateQueries({ queryKey: ["providerBookings"] });
      Alert.alert("Booking Cancelled", "The booking has been cancelled. A full refund will be issued to the guest.");
    },
    onError: (err: any) => {
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
      "  ZIKABOOKING RESERVATION",
      "══════════════════════════",
      `Ref:    ${booking.reference}`,
      `Status: ${STATUS_CFG[booking.status]?.label ?? booking.status}`,
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

  if (isLoading) return <Skeleton />;

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

  const sc = STATUS_CFG[booking.status] ?? STATUS_CFG.completed!;
  const isCar = booking.listingCategory === "car";
  const cancelled = isCancelled(booking.status);
  const canCancel = booking.status === "confirmed";
  const commPct = commissionRatePct(booking);
  const isConfirmedOrActive = booking.status === "confirmed" || booking.status === "active";

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
        {/* ── Confirmation / status banner ─────────────────────────────── */}
        {isConfirmedOrActive && (
          <View style={[s.statusBanner, booking.status === "active" && s.statusBannerActive]}>
            <Feather
              name={booking.status === "active" ? "radio" : "check-circle"}
              size={18}
              color={booking.status === "active" ? "#1D4ED8" : "#059669"}
            />
            <View style={{ flex: 1 }}>
              <Text style={[s.statusBannerTitle, booking.status === "active" && { color: "#1D4ED8" }]}>
                {booking.status === "active" ? "Booking is Active" : "Booking Confirmed ✓"}
              </Text>
              <Text style={s.statusBannerSub}>
                {booking.status === "active"
                  ? "Guest is currently checked in."
                  : "Guest payment has been processed successfully."}
              </Text>
            </View>
          </View>
        )}

        {/* ── Status pill + commission banner ─────────────────────────── */}
        <View style={s.pillRow}>
          <View style={[s.statusPill, { backgroundColor: sc.bg }]}>
            <Feather name={sc.icon} size={12} color={sc.text} />
            <Text style={[s.statusPillText, { color: sc.text }]}>{sc.label}</Text>
          </View>
          <View style={s.commPill}>
            <Feather name="info" size={11} color={K.colors.accent} />
            <Text style={s.commPillText}>Net earnings shown (after {commPct}% fee)</Text>
          </View>
        </View>

        {/* ── Listing ─────────────────────────────────────────────────── */}
        <SectionCard title="Listing" icon="home">
          <Text style={s.listingName}>{booking.listingTitle}</Text>
          <View style={s.catPill}>
            <Text style={s.catPillText}>
              {isCar ? "Car Rental" : booking.listingCategory === "hotel" ? "Hotel" : "Apartment"}
            </Text>
          </View>
        </SectionCard>

        {/* ── Booking dates ────────────────────────────────────────────── */}
        <SectionCard title={isCar ? "Rental Period" : "Stay Details"} icon="calendar">
          {isCar && booking.pickupDatetime && booking.returnDatetime ? (
            <>
              <Row label="Pickup"   value={fmtDateTime(booking.pickupDatetime)} />
              <Row label="Return"   value={fmtDateTime(booking.returnDatetime)} />
              <Row label="Duration" value={`${booking.nightsOrDays} ${booking.nightsOrDays === 1 ? "day" : "days"}`} />
            </>
          ) : booking.checkIn && booking.checkOut ? (
            <>
              <Row label="Check-in"  value={fmtDate(booking.checkIn)} />
              <Row label="Check-out" value={fmtDate(booking.checkOut)} />
              <Row label="Duration"  value={`${booking.nightsOrDays} ${booking.nightsOrDays === 1 ? "night" : "nights"}`} />
              {booking.adults != null && (
                <Row
                  label="Guests"
                  value={`${booking.adults} adult${booking.adults !== 1 ? "s" : ""}${booking.children ? `, ${booking.children} child${booking.children !== 1 ? "ren" : ""}` : ""}`}
                />
              )}
            </>
          ) : null}
          {booking.specialRequests ? (
            <View style={s.specialBox}>
              <Text style={s.specialLabel}>Special Requests</Text>
              <Text style={s.specialText}>{booking.specialRequests}</Text>
            </View>
          ) : null}
        </SectionCard>

        {/* ── Guest (privacy) ─────────────────────────────────────────── */}
        <SectionCard title="Guest" icon="user">
          <View style={s.guestRow}>
            <View style={s.guestAvatar}>
              <Text style={s.guestAvatarText}>{booking.guestFirstName[0]?.toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.guestName}>{guestDisplay(booking.guestFirstName, booking.guestLastName)}</Text>
              <Text style={s.guestPrivacy}>Contact is protected — use in-app messaging only.</Text>
            </View>
          </View>
        </SectionCard>

        {/* ── Payout breakdown ────────────────────────────────────────── */}
        <SectionCard title="Payout Breakdown" icon="dollar-sign">
          <Row label="Guest total paid"          value={`${booking.currency} ${booking.totalAmount.toLocaleString()}`} />
          <Row label={`Kainook fee (${commPct}%)`} value={`− ${booking.currency} ${booking.commissionAmount.toLocaleString()}`} />
          <View style={s.payoutDivider} />
          <View style={s.payoutRow}>
            <View style={s.payoutLeft}>
              <Feather name="trending-up" size={15} color={K.colors.accent} />
              <Text style={s.payoutLabel}>Your Net Payout</Text>
            </View>
            <Text style={s.payoutValue}>{booking.currency} {booking.providerPayout.toLocaleString()}</Text>
          </View>
          <Text style={s.payoutNote}>Disbursed to your account T+24h after guest check-in.</Text>
        </SectionCard>

        {/* ── Cancellation policy ─────────────────────────────────────── */}
        {booking.cancellationPolicy && (
          <SectionCard title="Cancellation Policy" icon="shield">
            <Text style={s.policyText}>{booking.cancellationPolicy}</Text>
          </SectionCard>
        )}

        {/* ── Timeline ────────────────────────────────────────────────── */}
        <SectionCard title="Timeline" icon="clock">
          <Timeline b={booking} />
        </SectionCard>

        {/* ── Cancellation details ─────────────────────────────────────── */}
        {cancelled && (
          <SectionCard title="Cancellation Details" icon="x-circle">
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
          </SectionCard>
        )}

        {/* ── Actions ─────────────────────────────────────────────────── */}
        <View style={s.actions}>
          {/* Message Guest */}
          <TouchableOpacity
            style={s.msgBtn}
            activeOpacity={0.85}
            onPress={() =>
              Alert.alert(
                "Messaging",
                "Open the Messages tab to communicate with your guest through in-app messaging.",
                [
                  { text: "Go to Messages", onPress: () => router.replace("/(provider)/messages" as any) },
                  { text: "Stay Here", style: "cancel" },
                ]
              )
            }
          >
            <Feather name="message-circle" size={18} color="#fff" />
            <Text style={s.msgBtnText}>Message Guest</Text>
          </TouchableOpacity>

          {/* Cancel — provider endpoint */}
          {canCancel && !cancelled && (
            <TouchableOpacity
              style={s.cancelBtn}
              onPress={handleCancel}
              disabled={cancelMutation.isPending}
              activeOpacity={0.85}
            >
              {cancelMutation.isPending ? (
                <ActivityIndicator size="small" color={K.colors.error} />
              ) : (
                <>
                  <Feather name="x-circle" size={16} color={K.colors.error} />
                  <Text style={s.cancelBtnText}>Cancel Booking</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {/* Share */}
          <TouchableOpacity style={s.shareBtn} onPress={handleShare} activeOpacity={0.85}>
            <Feather name="share-2" size={15} color={K.colors.textMuted} />
            <Text style={s.shareBtnText}>Share Reservation Details</Text>
          </TouchableOpacity>
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

  // Status / commission row
  statusBanner: {
    flexDirection: "row", alignItems: "flex-start", gap: 12,
    backgroundColor: "#F0FDF4", borderRadius: K.radius.lg,
    borderWidth: 1.5, borderColor: "#6EE7B7",
    padding: 14, marginHorizontal: 16, marginTop: 16, marginBottom: 4,
  },
  statusBannerActive: { backgroundColor: "#EFF6FF", borderColor: "#BFDBFE" },
  statusBannerTitle: { fontSize: K.font.base, fontWeight: "800", color: "#059669", marginBottom: 2 },
  statusBannerSub: { fontSize: K.font.xs, color: K.colors.textMuted },

  pillRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, marginTop: 12, marginBottom: 4, flexWrap: "wrap" },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: K.radius.full, paddingHorizontal: 12, paddingVertical: 6 },
  statusPillText: { fontSize: 12, fontWeight: "700" },
  commPill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: K.colors.accentDim, borderRadius: K.radius.full,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: K.colors.accent + "40",
    flex: 1,
  },
  commPillText: { fontSize: 10, color: K.colors.accent, fontWeight: "600", flex: 1 },

  // Section card
  card: {
    backgroundColor: K.colors.bgCard, borderRadius: K.radius.xl,
    borderWidth: 1, borderColor: K.colors.border,
    padding: 16, marginHorizontal: 16, marginTop: 12,
    ...K.shadow.sm,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  cardIcon: {
    width: 26, height: 26, borderRadius: K.radius.sm,
    backgroundColor: K.colors.accentDim, alignItems: "center", justifyContent: "center",
  },
  cardTitle: { fontSize: 10, fontWeight: "800", color: K.colors.textMuted, textTransform: "uppercase", letterSpacing: 0.8 },

  // Row
  row: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: K.colors.border,
  },
  rowLabel: { fontSize: K.font.sm, color: K.colors.textMuted, flex: 1 },
  rowValue: { fontSize: K.font.sm, fontWeight: "600", color: K.colors.textDark, textAlign: "right" },
  rowValueGreen: { color: K.colors.darkGreen, fontWeight: "800" },

  // Listing
  listingName: { fontSize: K.font.lg, fontWeight: "800", color: K.colors.textDark, marginBottom: 8 },
  catPill: {
    alignSelf: "flex-start", backgroundColor: K.colors.accentDim,
    borderRadius: K.radius.full, paddingHorizontal: 10, paddingVertical: 4,
  },
  catPillText: { fontSize: 11, fontWeight: "700", color: K.colors.accent },

  // Special requests
  specialBox: {
    backgroundColor: K.colors.bgLight, borderRadius: K.radius.md,
    padding: 10, marginTop: 10, borderWidth: 1, borderColor: K.colors.border,
  },
  specialLabel: { fontSize: 11, fontWeight: "700", color: K.colors.textMuted, marginBottom: 4 },
  specialText: { fontSize: K.font.sm, color: K.colors.textDark, lineHeight: 18 },

  // Guest
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

  // Timeline
  tlItem: { flexDirection: "row", gap: 12, minHeight: 52 },
  tlLeft: { alignItems: "center", width: 16 },
  tlDot: {
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: K.colors.border, borderWidth: 2, borderColor: K.colors.border, marginTop: 2,
  },
  tlDotDone: { backgroundColor: K.colors.accent, borderColor: K.colors.accent },
  tlLine: { flex: 1, width: 2, backgroundColor: K.colors.border, marginVertical: 2 },
  tlLineDone: { backgroundColor: K.colors.accent },
  tlRight: { flex: 1, paddingBottom: 12 },
  tlLabel: { fontSize: K.font.sm, fontWeight: "600", color: K.colors.textMuted },
  tlLabelDone: { color: K.colors.textDark },
  tlDate: { fontSize: 11, color: K.colors.textMuted, marginTop: 2 },

  // Cancellation
  cancelBox: {
    backgroundColor: "#FEF2F2", borderRadius: K.radius.md,
    padding: 12, gap: 4, borderWidth: 1, borderColor: "#FECACA",
  },
  cancelTitle: { fontSize: K.font.sm, fontWeight: "700", color: K.colors.error },
  cancelDate: { fontSize: 12, color: K.colors.error },
  cancelReason: { fontSize: 12, color: "#7F1D1D" },

  // Actions
  actions: { paddingHorizontal: 16, gap: 12, marginTop: 16 },
  msgBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: K.colors.darkGreen, borderRadius: K.radius.lg,
    paddingVertical: 16, ...K.shadow.md,
  },
  msgBtnText: { fontSize: K.font.base, fontWeight: "700", color: "#fff" },
  cancelBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    borderWidth: 1.5, borderColor: "#FECACA", borderRadius: K.radius.lg,
    paddingVertical: 14, backgroundColor: "#FEF2F2",
  },
  cancelBtnText: { fontSize: K.font.base, fontWeight: "700", color: K.colors.error },
  shareBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    borderWidth: 1, borderColor: K.colors.border, borderRadius: K.radius.lg,
    paddingVertical: 13, backgroundColor: K.colors.bgCard,
  },
  shareBtnText: { fontSize: K.font.sm, fontWeight: "600", color: K.colors.textMuted },
});
