import { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Share,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useReceipt, usePaymentDisplayId } from "../../../hooks/booking";
import type { Receipt, ReceiptLineItem } from "../../../lib/types/booking";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "numeric", month: "long", year: "numeric",
    });
  } catch { return iso; }
}

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-GB", {
      day: "numeric", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return iso; }
}

function fmtMoney(amount: number | null | undefined, currency: string): string {
  if (amount == null) return `${currency} —`;
  return `${currency} ${Math.abs(amount).toLocaleString()}`;
}

function statusLabel(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function listingTypeLabel(t: string): string {
  if (t === "car") return "Car Rental";
  if (t === "apartment") return "Apartment";
  return "Hotel";
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function SkeletonLoader() {
  const opacity = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 750, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.35, duration: 750, useNativeDriver: true }),
      ])
    ).start();
  }, [opacity]);

  const B = ({ w, h = 13 }: { w: number | `${number}%`; h?: number }) => (
    <Animated.View style={{ width: w as any, height: h, backgroundColor: "#e5e7eb", borderRadius: 6, opacity }} />
  );

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} showsVerticalScrollIndicator={false}>
      <View style={s.card}>
        <B w={90} h={11} /><B w="65%" h={22} /><B w="45%" h={13} /><B w={130} h={13} />
      </View>
      <View style={s.card}>
        <B w={70} h={11} /><B w="80%" h={18} /><B w={80} h={20} />
        <B w="60%" h={13} /><B w="50%" h={13} />
      </View>
      <View style={s.card}>
        <B w={55} h={11} /><B w="70%" h={17} /><B w="55%" h={13} />
      </View>
      <View style={s.card}>
        <B w={65} h={11} />
        {[1, 2, 3].map((i) => (
          <View key={i} style={s.skRow}>
            <B w="55%" /><B w="25%" />
          </View>
        ))}
        <View style={{ height: 1, backgroundColor: "#e5e7eb", marginVertical: 4 }} />
        <View style={s.skRow}><B w="40%" h={17} /><B w="28%" h={17} /></View>
      </View>
      <View style={s.card}>
        <B w={65} h={11} />
        {[1, 2, 3].map((i) => (
          <View key={i} style={s.skRow}>
            <B w="45%" /><B w="40%" />
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

// ── Row ───────────────────────────────────────────────────────────────────────

function Row({
  label,
  value,
  highlight = false,
  credit = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  credit?: boolean;
}) {
  return (
    <View style={[s.row, highlight && s.rowHL]}>
      <Text style={[s.rowLabel, highlight && s.rowLabelHL]} numberOfLines={2}>{label}</Text>
      <Text style={[s.rowValue, highlight && s.rowValueHL, credit && s.rowValueCredit]}>
        {value}
      </Text>
    </View>
  );
}

// ── Share helper ──────────────────────────────────────────────────────────────

async function buildShareText(r: Receipt, paymentRef: string | null): Promise<void> {
  const cur = r.totals.currency;
  const lines = [
    "══════════════════════════════",
    "         KAINOOK RECEIPT",
    "══════════════════════════════",
    `Receipt:    ${r.receiptNumber}`,
    `Booking:    ${r.bookingReference}`,
    `Status:     ${statusLabel(r.status)}`,
    `Issued:     ${fmtDate(r.issuedAt)}`,
    "",
    "── Property ──────────────────",
    r.listing.title ?? "—",
    `Type:  ${listingTypeLabel(r.listing.type)}`,
    [r.listing.address, r.listing.town, r.listing.country].filter(Boolean).join(", "),
    "",
    r.period.checkIn
      ? `Check-in:  ${fmtDate(r.period.checkIn)}`
      : r.period.pickupDatetime
      ? `Pick-up:   ${fmtDateTime(r.period.pickupDatetime)}`
      : "",
    r.period.checkOut
      ? `Check-out: ${fmtDate(r.period.checkOut)}`
      : r.period.returnDatetime
      ? `Return:    ${fmtDateTime(r.period.returnDatetime)}`
      : "",
    "",
    "── Guest ─────────────────────",
    r.guest.name,
    r.guest.email,
    "",
    "── Pricing ───────────────────",
    ...r.lineItems.map((li) =>
      `${li.label}${" ".repeat(Math.max(1, 24 - li.label.length))}${
        li.amount < 0 ? "– " : ""
      }${fmtMoney(Math.abs(li.amount), cur)}`
    ),
    `${"TOTAL".padEnd(24)}${fmtMoney(r.totals.total, cur)}`,
    "",
    (paymentRef ?? r.payment.paymentId) ? `Payment ID: ${paymentRef ?? r.payment.paymentId}` : "",
    r.payment.confirmedAt ? `Paid on:    ${fmtDateTime(r.payment.confirmedAt)}` : "",
    "══════════════════════════════",
    "Powered by Kainook",
  ].filter((l) => l !== undefined);

  await Share.share({
    message: lines.join("\n"),
    title: `Receipt ${r.bookingReference}`,
  });
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function ReceiptScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);

  const { data: receipt, isLoading, isError, error, refetch } = useReceipt(id);
  // Human-readable PAYXXXXX-CC reference; null until resolved, or if the
  // lookup fails — in both cases the raw payment UUID is shown instead.
  const { data: paymentDisplayId } = usePaymentDisplayId(receipt?.payment.paymentId);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  // ── Loading ──────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <SafeAreaView style={s.container} edges={["bottom"]}>
        <Stack.Screen options={{ title: "Receipt", headerShown: true, headerBackTitle: "Back" }} />
        <SkeletonLoader />
      </SafeAreaView>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────

  if (isError || !receipt) {
    const errMsg = (error as any)?.error?.message ?? "The receipt could not be loaded.";
    return (
      <SafeAreaView style={s.container} edges={["bottom"]}>
        <Stack.Screen options={{ title: "Receipt", headerShown: true, headerBackTitle: "Back" }} />
        <View style={s.centered}>
          <Ionicons name="receipt-outline" size={56} color="#d1d5db" />
          <Text style={s.errTitle}>Receipt unavailable</Text>
          <Text style={s.errBody}>{errMsg}</Text>
          <TouchableOpacity style={s.primaryBtn} onPress={() => void refetch()}>
            <Text style={s.primaryBtnText}>Try Again</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.secondaryBtn} onPress={() => router.back()}>
            <Text style={s.secondaryBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const cur = receipt.totals.currency;
  const isCar = receipt.listing.type === "car";
  const address = [receipt.listing.address, receipt.listing.town, receipt.listing.country]
    .filter(Boolean)
    .join(", ");

  // ── Success ──────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={s.container} edges={["bottom"]}>
      <Stack.Screen options={{ title: "Receipt", headerShown: true, headerBackTitle: "Back" }} />

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#16a34a" />
        }
      >
        {/* ── Header card ───────────────────────────────────────────── */}
        <View style={s.headerCard}>
          <View style={s.headerIconWrap}>
            <Ionicons name="receipt-outline" size={34} color="#16a34a" />
          </View>
          <Text style={s.receiptNum}>{receipt.receiptNumber}</Text>
          <Text style={s.bookingRef}>{receipt.bookingReference}</Text>

          <View style={[s.statusBadge, statusStyle(receipt.status)]}>
            <Text style={[s.statusText, statusTextStyle(receipt.status)]}>
              {statusLabel(receipt.status)}
            </Text>
          </View>

          <Text style={s.issuedAt}>Issued {fmtDate(receipt.issuedAt)}</Text>
        </View>

        {/* ── Property card ─────────────────────────────────────────── */}
        <View style={s.card}>
          <Text style={s.cardLabel}>Property</Text>

          <View style={s.propRow}>
            <Text style={s.propTitle} numberOfLines={2}>
              {receipt.listing.title ?? "—"}
            </Text>
            <View style={s.typeBadge}>
              <Text style={s.typeBadgeText}>{listingTypeLabel(receipt.listing.type)}</Text>
            </View>
          </View>

          {address ? <Text style={s.propAddr}>{address}</Text> : null}

          {isCar ? (
            <>
              {receipt.period.pickupDatetime ? (
                <Text style={s.propDate}>
                  Pick-up: {fmtDateTime(receipt.period.pickupDatetime)}
                </Text>
              ) : null}
              {receipt.period.returnDatetime ? (
                <Text style={s.propDate}>
                  Return: {fmtDateTime(receipt.period.returnDatetime)}
                </Text>
              ) : null}
            </>
          ) : (
            <>
              {receipt.period.checkIn ? (
                <Text style={s.propDate}>
                  Check-in: {fmtDate(receipt.period.checkIn)}
                </Text>
              ) : null}
              {receipt.period.checkOut ? (
                <Text style={s.propDate}>
                  Check-out: {fmtDate(receipt.period.checkOut)}
                </Text>
              ) : null}
            </>
          )}

          <Text style={s.propDuration}>
            {receipt.period.nightsOrDays} {isCar ? "day" : "night"}
            {receipt.period.nightsOrDays !== 1 ? "s" : ""}
          </Text>
        </View>

        {/* ── Guest card ────────────────────────────────────────────── */}
        <View style={s.card}>
          <Text style={s.cardLabel}>Guest</Text>
          <Text style={s.guestName}>{receipt.guest.name}</Text>
          <Text style={s.guestEmail}>{receipt.guest.email}</Text>
          {receipt.guest.phone ? (
            <Text style={s.guestEmail}>{receipt.guest.phone}</Text>
          ) : null}
        </View>

        {/* ── Pricing card ──────────────────────────────────────────── */}
        <View style={s.card}>
          <Text style={s.cardLabel}>Pricing</Text>

          {receipt.lineItems.map((item: ReceiptLineItem, i: number) => (
            <Row
              key={i}
              label={item.label}
              value={
                item.amount < 0
                  ? `– ${fmtMoney(item.amount, cur)}`
                  : fmtMoney(item.amount, cur)
              }
              credit={item.amount < 0}
            />
          ))}

          <View style={s.divider} />

          <Row
            label="Total Paid"
            value={fmtMoney(receipt.totals.total, cur)}
            highlight
          />
        </View>

        {/* ── Payment card ──────────────────────────────────────────── */}
        {(receipt.payment.paymentId || receipt.payment.confirmedAt) ? (
          <View style={s.card}>
            <Text style={s.cardLabel}>Payment</Text>
            {receipt.payment.paymentId ? (
              <Row label="Payment ID" value={paymentDisplayId ?? receipt.payment.paymentId} />
            ) : null}
            {receipt.payment.confirmedAt ? (
              <Row label="Confirmed" value={fmtDateTime(receipt.payment.confirmedAt)} />
            ) : null}
          </View>
        ) : null}

        {/* ── Footer ───────────────────────────────────────────────── */}
        <View style={s.footer}>
          <Text style={s.footerText}>Powered by Kainook</Text>
        </View>

        {/* ── Share button ──────────────────────────────────────────── */}
        <TouchableOpacity
          style={s.shareBtn}
          onPress={() => void buildShareText(receipt, paymentDisplayId ?? null)}
          activeOpacity={0.85}
        >
          <Ionicons name="share-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
          <Text style={s.shareBtnText}>Share Receipt</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Status badge helpers ───────────────────────────────────────────────────────

function statusStyle(status: string) {
  if (status === "confirmed" || status === "completed")
    return { backgroundColor: "#dcfce7", borderColor: "#86efac" };
  if (status === "cancelled_by_guest" || status === "cancelled_by_provider" || status === "cancelled_by_system")
    return { backgroundColor: "#fee2e2", borderColor: "#fca5a5" };
  if (status === "pending" || status === "pending_payment")
    return { backgroundColor: "#fef9c3", borderColor: "#fde047" };
  return { backgroundColor: "#f3f4f6", borderColor: "#d1d5db" };
}

function statusTextStyle(status: string) {
  if (status === "confirmed" || status === "completed") return { color: "#15803d" };
  if (status.startsWith("cancelled")) return { color: "#dc2626" };
  if (status === "pending" || status === "pending_payment") return { color: "#92400e" };
  return { color: "#374151" };
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: "#f3f4f6" },
  centered:   { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  scroll:     { padding: 16, paddingBottom: 40, gap: 12 },

  skRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },

  // Error
  errTitle: { fontSize: 20, fontWeight: "700", color: "#111827", marginTop: 16, textAlign: "center" },
  errBody:  { fontSize: 14, color: "#6b7280", textAlign: "center", lineHeight: 20, marginBottom: 24 },

  // Header card
  headerCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    gap: 6,
  },
  headerIconWrap: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: "#f0fdf4",
    alignItems: "center", justifyContent: "center",
    marginBottom: 8,
  },
  receiptNum:  { fontSize: 13, fontWeight: "700", color: "#16a34a", letterSpacing: 0.4 },
  bookingRef:  { fontSize: 18, fontWeight: "800", color: "#111827" },
  statusBadge: {
    borderRadius: 20, borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 4, marginTop: 2,
  },
  statusText:  { fontSize: 12, fontWeight: "700" },
  issuedAt:    { fontSize: 12, color: "#6b7280", marginTop: 4 },

  // Shared card
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    gap: 6,
  },
  cardLabel: {
    fontSize: 11, fontWeight: "700", color: "#6b7280",
    textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6,
  },

  // Property
  propRow:    { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  propTitle:  { fontSize: 16, fontWeight: "700", color: "#111827", flex: 1 },
  typeBadge:  {
    backgroundColor: "#f0fdf4", borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  typeBadgeText: { fontSize: 11, fontWeight: "600", color: "#16a34a" },
  propAddr:   { fontSize: 13, color: "#6b7280" },
  propDate:   { fontSize: 13, color: "#374151", fontWeight: "500" },
  propDuration: { fontSize: 12, color: "#9ca3af", marginTop: 2 },

  // Guest
  guestName:  { fontSize: 15, fontWeight: "700", color: "#111827" },
  guestEmail: { fontSize: 13, color: "#6b7280" },

  // Pricing rows
  row:         { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingVertical: 5 },
  rowHL:       { paddingTop: 6 },
  rowLabel:    { fontSize: 14, color: "#374151", flex: 1, marginRight: 12 },
  rowLabelHL:  { fontSize: 15, fontWeight: "700", color: "#111827" },
  rowValue:    { fontSize: 14, color: "#111827", fontWeight: "500" },
  rowValueHL:  { fontSize: 16, fontWeight: "800" },
  rowValueCredit: { color: "#16a34a" },

  divider:     { height: 1, backgroundColor: "#e5e7eb", marginVertical: 6 },

  // Footer & share
  footer:      { alignItems: "center", paddingVertical: 12 },
  footerText:  { fontSize: 12, color: "#9ca3af" },
  shareBtn: {
    flexDirection: "row",
    backgroundColor: "#16a34a",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  shareBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },

  primaryBtn: {
    backgroundColor: "#16a34a", borderRadius: 12,
    paddingVertical: 14, alignItems: "center",
    width: "100%", marginBottom: 12,
  },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  secondaryBtn: {
    borderWidth: 1, borderColor: "#d1d5db", borderRadius: 12,
    paddingVertical: 14, alignItems: "center", width: "100%",
  },
  secondaryBtnText: { color: "#374151", fontWeight: "600", fontSize: 15 },
});
