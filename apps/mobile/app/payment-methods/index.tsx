import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  StyleSheet,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  useSavedPaymentMethods,
  useDeletePaymentMethod,
  useSetDefaultPaymentMethod,
} from "../../hooks/paymentMethods";
import type { SavedPaymentMethod } from "../../lib/types/booking";

// ── Helpers ───────────────────────────────────────────────────────────────────

function cardIcon(provider: "stripe" | "tara"): keyof typeof Ionicons.glyphMap {
  return provider === "tara" ? "phone-portrait-outline" : "card-outline";
}

function cardLabel(method: SavedPaymentMethod): string {
  if (method.paymentProvider === "tara") {
    return method.mobileNumberMasked
      ? `Mobile Money •••• ${method.mobileNumberMasked}`
      : "Mobile Money";
  }
  const brand = method.cardBrand
    ? method.cardBrand.charAt(0).toUpperCase() + method.cardBrand.slice(1)
    : "Card";
  return `${brand} •••• ${method.cardLast4 ?? "????"}`;
}

function expiryLabel(method: SavedPaymentMethod): string | null {
  if (method.paymentProvider !== "stripe" || !method.cardExpMonth || !method.cardExpYear) return null;
  const month = String(method.cardExpMonth).padStart(2, "0");
  const year  = String(method.cardExpYear).slice(-2);
  const expired = new Date() > new Date(method.cardExpYear, method.cardExpMonth, 1);
  return `${expired ? "Expired " : "Expires "}${month}/${year}`;
}

// ── Payment method card ───────────────────────────────────────────────────────

function MethodCard({
  method,
  onSetDefault,
  onDelete,
  settingDefault,
  deleting,
}: {
  method: SavedPaymentMethod;
  onSetDefault: (id: string) => void;
  onDelete: (id: string) => void;
  settingDefault: boolean;
  deleting: boolean;
}) {
  const expiry = expiryLabel(method);
  const isExpired =
    expiry !== null && expiry.startsWith("Expired");

  return (
    <View style={s.methodCard}>
      {/* Left: icon + labels */}
      <View style={s.methodLeft}>
        <View
          style={[
            s.methodIconWrap,
            method.paymentProvider === "tara" ? s.methodIconTara : s.methodIconStripe,
          ]}
        >
          <Ionicons
            name={cardIcon(method.paymentProvider)}
            size={22}
            color={method.paymentProvider === "tara" ? "#0D7377" : "#16a34a"}
          />
        </View>

        <View style={s.methodInfo}>
          <Text style={s.methodLabel} numberOfLines={1}>
            {cardLabel(method)}
          </Text>
          {expiry && (
            <Text style={[s.methodExpiry, isExpired && s.methodExpiryExpired]}>
              {expiry}
            </Text>
          )}
          {method.isDefault && (
            <View style={s.defaultBadge}>
              <Ionicons name="checkmark-circle" size={12} color="#16a34a" />
              <Text style={s.defaultBadgeText}>Default</Text>
            </View>
          )}
        </View>
      </View>

      {/* Right: actions */}
      <View style={s.methodActions}>
        {!method.isDefault && (
          <TouchableOpacity
            style={s.actionBtn}
            onPress={() => onSetDefault(method.id)}
            disabled={settingDefault || deleting}
          >
            {settingDefault ? (
              <ActivityIndicator size="small" color="#16a34a" />
            ) : (
              <Text style={s.actionBtnText}>Set default</Text>
            )}
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[s.actionBtn, s.actionBtnDelete]}
          onPress={() => onDelete(method.id)}
          disabled={settingDefault || deleting}
        >
          {deleting ? (
            <ActivityIndicator size="small" color="#dc2626" />
          ) : (
            <Ionicons name="trash-outline" size={16} color="#dc2626" />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function PaymentMethodsScreen() {
  const router = useRouter();

  const {
    data: methods,
    isLoading,
    isError,
    refetch,
    isRefetching,
  } = useSavedPaymentMethods();

  const deleteMutation     = useDeletePaymentMethod();
  const setDefaultMutation = useSetDefaultPaymentMethod();

  function handleSetDefault(methodId: string) {
    setDefaultMutation.mutate(methodId, {
      onError: (err: any) => {
        Alert.alert(
          "Error",
          err?.response?.data?.message ?? "Could not set as default. Please try again."
        );
      },
    });
  }

  function handleDelete(methodId: string) {
    const method = methods?.find((m) => m.id === methodId);
    Alert.alert(
      "Remove Payment Method",
      method
        ? `Remove ${cardLabel(method)}?`
        : "Remove this payment method?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () =>
            deleteMutation.mutate(methodId, {
              onError: (err: any) => {
                Alert.alert(
                  "Error",
                  err?.response?.data?.message ??
                    "Could not remove payment method. Please try again."
                );
              },
            }),
        },
      ]
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.centered}>
          <ActivityIndicator size="large" color="#16a34a" />
          <Text style={s.loadingText}>Loading payment methods...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isError) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.centered}>
          <Ionicons name="card-outline" size={56} color="#d1d5db" />
          <Text style={s.errorTitle}>Could not load payment methods</Text>
          <Text style={s.errorBody}>
            Check your connection and try again.
          </Text>
          <TouchableOpacity style={s.primaryBtn} onPress={() => void refetch()}>
            <Text style={s.primaryBtnText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const cards  = methods?.filter((m) => m.paymentProvider === "stripe") ?? [];
  const mobile = methods?.filter((m) => m.paymentProvider === "tara")   ?? [];
  const isEmpty = (methods?.length ?? 0) === 0;

  return (
    <SafeAreaView style={s.container} edges={["bottom"]}>
      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={() => void refetch()}
            tintColor="#16a34a"
          />
        }
      >
        {isEmpty ? (
          <View style={s.emptyState}>
            <Ionicons name="card-outline" size={56} color="#d1d5db" />
            <Text style={s.emptyTitle}>No saved payment methods</Text>
            <Text style={s.emptyBody}>
              Add a card or mobile money account to pay faster at checkout.
            </Text>
          </View>
        ) : (
          <>
            {/* Cards section */}
            {cards.length > 0 && (
              <View style={s.section}>
                <Text style={s.sectionTitle}>Cards</Text>
                {cards.map((method) => (
                  <MethodCard
                    key={method.id}
                    method={method}
                    onSetDefault={handleSetDefault}
                    onDelete={handleDelete}
                    settingDefault={
                      setDefaultMutation.isPending &&
                      setDefaultMutation.variables === method.id
                    }
                    deleting={
                      deleteMutation.isPending &&
                      deleteMutation.variables === method.id
                    }
                  />
                ))}
              </View>
            )}

            {/* Mobile money section */}
            {mobile.length > 0 && (
              <View style={s.section}>
                <Text style={s.sectionTitle}>Mobile Money</Text>
                {mobile.map((method) => (
                  <MethodCard
                    key={method.id}
                    method={method}
                    onSetDefault={handleSetDefault}
                    onDelete={handleDelete}
                    settingDefault={
                      setDefaultMutation.isPending &&
                      setDefaultMutation.variables === method.id
                    }
                    deleting={
                      deleteMutation.isPending &&
                      deleteMutation.variables === method.id
                    }
                  />
                ))}
              </View>
            )}
          </>
        )}

        {/* Add buttons */}
        <View style={s.addSection}>
          <Text style={s.addSectionTitle}>Add Payment Method</Text>

          <TouchableOpacity
            style={s.addBtn}
            onPress={() => router.push("/payment-methods/add-card" as any)}
            activeOpacity={0.8}
          >
            <View style={s.addBtnIcon}>
              <Ionicons name="card-outline" size={22} color="#16a34a" />
            </View>
            <View style={s.addBtnText}>
              <Text style={s.addBtnTitle}>Add New Card</Text>
              <Text style={s.addBtnSub}>Visa, Mastercard, Amex</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
          </TouchableOpacity>

          <TouchableOpacity
            style={s.addBtn}
            onPress={() => router.push("/payment-methods/add-tara" as any)}
            activeOpacity={0.8}
          >
            <View style={[s.addBtnIcon, { backgroundColor: "#f0fdf4" }]}>
              <Ionicons name="phone-portrait-outline" size={22} color="#0D7377" />
            </View>
            <View style={s.addBtnText}>
              <Text style={s.addBtnTitle}>Add Mobile Money</Text>
              <Text style={s.addBtnSub}>M-Pesa, MTN, Airtel Money</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: "#f9fafb" },
  centered:    { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  scroll:      { padding: 16, paddingBottom: 40 },

  loadingText: { fontSize: 14, color: "#6b7280", marginTop: 12 },
  errorTitle:  { fontSize: 20, fontWeight: "700", color: "#111827", marginTop: 16, textAlign: "center" },
  errorBody:   { fontSize: 14, color: "#6b7280", textAlign: "center", lineHeight: 20, marginBottom: 24 },

  emptyState:  { alignItems: "center", paddingVertical: 60, gap: 10 },
  emptyTitle:  { fontSize: 18, fontWeight: "700", color: "#374151", marginTop: 8 },
  emptyBody:   { fontSize: 14, color: "#6b7280", textAlign: "center", lineHeight: 20, maxWidth: 260 },

  section:      { marginBottom: 8 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 10,
    paddingLeft: 2,
  },

  methodCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 14,
    marginBottom: 10,
  },
  methodLeft:   { flex: 1, flexDirection: "row", alignItems: "center", gap: 12, marginRight: 8 },
  methodIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  methodIconStripe: { backgroundColor: "#f0fdf4" },
  methodIconTara:   { backgroundColor: "#f0fdf4" },
  methodInfo:       { flex: 1 },
  methodLabel:      { fontSize: 14, fontWeight: "600", color: "#111827" },
  methodExpiry:     { fontSize: 12, color: "#6b7280", marginTop: 2 },
  methodExpiryExpired: { color: "#dc2626" },
  defaultBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  defaultBadgeText: { fontSize: 11, fontWeight: "600", color: "#16a34a" },

  methodActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  actionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    backgroundColor: "#f9fafb",
    minWidth: 32,
    alignItems: "center",
  },
  actionBtnText:   { fontSize: 12, fontWeight: "600", color: "#16a34a" },
  actionBtnDelete: { borderColor: "#fee2e2", backgroundColor: "#fff5f5" },

  addSection: { marginTop: 8 },
  addSectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 10,
    paddingLeft: 2,
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    padding: 14,
    marginBottom: 10,
    gap: 12,
  },
  addBtnIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "#f0fdf4",
    alignItems: "center",
    justifyContent: "center",
  },
  addBtnText:  { flex: 1 },
  addBtnTitle: { fontSize: 14, fontWeight: "600", color: "#111827" },
  addBtnSub:   { fontSize: 12, color: "#6b7280", marginTop: 2 },

  primaryBtn: {
    backgroundColor: "#16a34a",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    width: "100%",
  },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
