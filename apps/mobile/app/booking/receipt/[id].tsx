import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Share,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useReceipt } from "../../../hooks/booking";
import type { Receipt } from "../../../lib/types/booking";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(isoStr: string): string {
  return new Date(isoStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatDateTime(isoStr: string): string {
  return new Date(isoStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatCurrency(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString()}`;
}

async function shareReceipt(receipt: Receipt) {
  const lines = [
    "══════════════════════════════",
    "         KAINOOK RECEIPT",
    "══════════════════════════════",
    `Receipt #:  ${receipt.id}`,
    `Booking:    ${receipt.bookingReference}`,
    `Issued:     ${formatDate(receipt.issuedAt)}`,
    "",
    "── Property ──────────────────",
    receipt.listingTitle,
    receipt.listingAddress ?? "",
    "",
    "── Guest ─────────────────────",
    receipt.guestName,
    receipt.guestEmail,
    "",
    "── Pricing ───────────────────",
    `Subtotal:   ${formatCurrency(receipt.subtotal, receipt.currency)}`,
    receipt.discountAmount && receipt.discountAmount > 0
      ? `Discount:   -${formatCurrency(receipt.discountAmount, receipt.currency)}`
      : "",
    receipt.serviceFee && receipt.serviceFee > 0
      ? `Service:    +${formatCurrency(receipt.serviceFee, receipt.currency)}`
      : "",
    receipt.taxAmount && receipt.taxAmount > 0
      ? `Taxes:      +${formatCurrency(receipt.taxAmount, receipt.currency)}`
      : "",
    receipt.deliveryFee && receipt.deliveryFee > 0
      ? `Delivery:   +${formatCurrency(receipt.deliveryFee, receipt.currency)}`
      : "",
    `TOTAL:      ${formatCurrency(receipt.totalAmount, receipt.currency)}`,
    "",
    receipt.paymentMethod ? `Paid via:   ${receipt.paymentMethod}` : "",
    receipt.paymentDate ? `Paid on:    ${formatDate(receipt.paymentDate)}` : "",
    receipt.transactionId ? `Txn ID:     ${receipt.transactionId}` : "",
    "══════════════════════════════",
    "Powered by Kainook",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    await Share.share({ message: lines, title: `Receipt ${receipt.bookingReference}` });
  } catch {
    // User dismissed share sheet
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ReceiptRow({
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
    <View style={[s.row, highlight && s.rowHighlight]}>
      <Text style={[s.rowLabel, highlight && s.rowLabelHighlight]}>{label}</Text>
      <Text
        style={[
          s.rowValue,
          highlight && s.rowValueHighlight,
          credit && s.rowValueCredit,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function ReceiptScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: receipt, isLoading, isError, refetch } = useReceipt(id);

  if (isLoading) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.centered}>
          <ActivityIndicator size="large" color="#1a73e8" />
          <Text style={s.loadingText}>Loading receipt...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isError || !receipt) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.centered}>
          <Ionicons name="receipt-outline" size={56} color="#d1d5db" />
          <Text style={s.errorTitle}>Receipt unavailable</Text>
          <Text style={s.errorBody}>
            The receipt for this booking could not be loaded. It may still be
            generating — try again shortly.
          </Text>
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

  return (
    <SafeAreaView style={s.container} edges={["bottom"]}>
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={s.header}>
          <View style={s.headerIconWrap}>
            <Ionicons name="receipt-outline" size={36} color="#1a73e8" />
          </View>
          <Text style={s.headerTitle}>Receipt</Text>
          <Text style={s.headerRef}>{receipt.bookingReference}</Text>
          <Text style={s.headerDate}>Issued {formatDate(receipt.issuedAt)}</Text>
        </View>

        {/* Property */}
        <View style={s.card}>
          <Text style={s.cardLabel}>Property</Text>
          <Text style={s.cardTitle}>{receipt.listingTitle}</Text>
          <Text style={s.cardSubtitle}>
            {[receipt.listingAddress, receipt.listingTown, receipt.listingCountry]
              .filter(Boolean)
              .join(", ")}
          </Text>
          {receipt.checkIn && receipt.checkOut && (
            <Text style={s.cardSubtitle}>
              {formatDate(receipt.checkIn)} – {formatDate(receipt.checkOut)}
            </Text>
          )}
          {receipt.pickupDatetime && receipt.returnDatetime && (
            <Text style={s.cardSubtitle}>
              Pickup: {formatDateTime(receipt.pickupDatetime)} → Return:{" "}
              {formatDateTime(receipt.returnDatetime)}
            </Text>
          )}
        </View>

        {/* Guest */}
        <View style={s.card}>
          <Text style={s.cardLabel}>Guest</Text>
          <Text style={s.cardTitle}>{receipt.guestName}</Text>
          <Text style={s.cardSubtitle}>{receipt.guestEmail}</Text>
        </View>

        {/* Pricing */}
        <View style={s.card}>
          <Text style={s.cardLabel}>Pricing</Text>

          <ReceiptRow
            label="Subtotal"
            value={formatCurrency(receipt.subtotal, receipt.currency)}
          />

          {receipt.discountAmount != null && receipt.discountAmount > 0 && (
            <ReceiptRow
              label="Discount"
              value={`– ${formatCurrency(receipt.discountAmount, receipt.currency)}`}
              credit
            />
          )}

          {receipt.serviceFee != null && receipt.serviceFee > 0 && (
            <ReceiptRow
              label="Service fee"
              value={`+ ${formatCurrency(receipt.serviceFee, receipt.currency)}`}
            />
          )}

          {receipt.taxAmount != null && receipt.taxAmount > 0 && (
            <ReceiptRow
              label="Taxes"
              value={`+ ${formatCurrency(receipt.taxAmount, receipt.currency)}`}
            />
          )}

          {receipt.deliveryFee != null && receipt.deliveryFee > 0 && (
            <ReceiptRow
              label="Delivery fee"
              value={`+ ${formatCurrency(receipt.deliveryFee, receipt.currency)}`}
            />
          )}

          {/* Custom line items from backend if provided */}
          {receipt.lineItems?.map((item, i) =>
            item.type !== "total" && item.type !== "subtotal" ? (
              <ReceiptRow
                key={i}
                label={item.label}
                value={formatCurrency(item.amount, receipt.currency)}
                credit={item.type === "credit"}
              />
            ) : null
          )}

          <View style={s.divider} />
          <ReceiptRow
            label="Total Paid"
            value={formatCurrency(receipt.totalAmount, receipt.currency)}
            highlight
          />
        </View>

        {/* Payment info */}
        {(receipt.paymentMethod ||
          receipt.paymentDate ||
          receipt.transactionId ||
          receipt.paymentStatus) && (
          <View style={s.card}>
            <Text style={s.cardLabel}>Payment</Text>
            {receipt.paymentMethod && (
              <ReceiptRow label="Method" value={receipt.paymentMethod} />
            )}
            {receipt.paymentDate && (
              <ReceiptRow
                label="Date"
                value={formatDate(receipt.paymentDate)}
              />
            )}
            {receipt.paymentStatus && (
              <ReceiptRow
                label="Status"
                value={receipt.paymentStatus
                  .replace(/_/g, " ")
                  .replace(/\b\w/g, (c) => c.toUpperCase())}
              />
            )}
            {receipt.transactionId && (
              <ReceiptRow
                label="Transaction ID"
                value={receipt.transactionId}
              />
            )}
          </View>
        )}

        {/* Powered by */}
        <View style={s.footer}>
          <Text style={s.footerText}>Powered by Kainook</Text>
        </View>

        {/* Share button */}
        <TouchableOpacity
          style={s.shareBtn}
          onPress={() => void shareReceipt(receipt)}
          activeOpacity={0.85}
        >
          <Ionicons name="share-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
          <Text style={s.shareBtnText}>Share Receipt</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container:    { flex: 1, backgroundColor: "#f9fafb" },
  centered:     { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  scroll:       { padding: 16, paddingBottom: 40 },

  // Loading / error
  loadingText:  { fontSize: 14, color: "#6b7280", marginTop: 12 },
  errorTitle:   { fontSize: 20, fontWeight: "700", color: "#111827", marginTop: 16, textAlign: "center" },
  errorBody:    { fontSize: 14, color: "#6b7280", textAlign: "center", lineHeight: 20, marginBottom: 24 },

  // Header
  header: {
    alignItems: "center",
    paddingVertical: 28,
    backgroundColor: "#fff",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  headerIconWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  headerTitle:  { fontSize: 22, fontWeight: "800", color: "#111827", marginBottom: 4 },
  headerRef:    { fontSize: 14, fontWeight: "700", color: "#1a73e8", letterSpacing: 0.5, marginBottom: 4 },
  headerDate:   { fontSize: 12, color: "#6b7280" },

  // Card
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    gap: 4,
  },
  cardLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  cardTitle:    { fontSize: 16, fontWeight: "700", color: "#111827" },
  cardSubtitle: { fontSize: 13, color: "#6b7280", marginTop: 2 },

  // Row
  row:                { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6 },
  rowHighlight:       { paddingTop: 4 },
  rowLabel:           { fontSize: 14, color: "#374151", flex: 1 },
  rowLabelHighlight:  { fontSize: 15, fontWeight: "700", color: "#111827" },
  rowValue:           { fontSize: 14, color: "#111827", fontWeight: "500" },
  rowValueHighlight:  { fontSize: 16, fontWeight: "800", color: "#111827" },
  rowValueCredit:     { color: "#16a34a" },

  divider:      { height: 1, backgroundColor: "#e5e7eb", marginVertical: 8 },

  // Footer
  footer:       { alignItems: "center", marginVertical: 16 },
  footerText:   { fontSize: 12, color: "#9ca3af" },

  // Share button
  shareBtn: {
    flexDirection: "row",
    backgroundColor: "#1a73e8",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  shareBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },

  // Buttons
  primaryBtn: {
    backgroundColor: "#1a73e8",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    width: "100%",
    marginBottom: 12,
  },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    width: "100%",
  },
  secondaryBtnText: { color: "#374151", fontWeight: "600", fontSize: 15 },
});
