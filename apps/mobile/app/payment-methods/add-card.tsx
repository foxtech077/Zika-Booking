import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useStripe } from "@stripe/stripe-react-native";
import { Ionicons } from "@expo/vector-icons";
import { useStripeSetupIntent, useStripeSetupConfirm } from "../../hooks/paymentMethods";
import { initializeStripe, resolveStripePublishableKey } from "../../lib/stripe-config";

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function AddCardScreen() {
  const router = useRouter();
  const { initPaymentSheet, presentPaymentSheet, retrieveSetupIntent } = useStripe();

  const [step, setStep]         = useState<"idle" | "loading" | "sheet" | "confirming" | "done">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const setupIntentMutation  = useStripeSetupIntent();
  const confirmCardMutation  = useStripeSetupConfirm();

  async function handleAddCard() {
    setErrorMsg(null);
    setStep("loading");

    try {
      // 1. Create setup intent on backend
      console.log("[ADD_CARD] Creating Stripe setup intent");
      const { clientSecret, publishableKey } = await setupIntentMutation.mutateAsync();

      // 2. Initialize Stripe with the publishable key from API (or env fallback)
      const initError = await initializeStripe(publishableKey);
      if (initError) {
        setErrorMsg(initError);
        setStep("idle");
        return;
      }

      // 3. Initialize Payment Sheet with setupIntentClientSecret
      const resolvedKey = resolveStripePublishableKey(publishableKey);
      const isTestKey   = resolvedKey.startsWith("pk_test");

      const { error: initError2 } = await initPaymentSheet({
        setupIntentClientSecret: clientSecret,
        merchantDisplayName: "Kainook",
        style: "automatic",
        googlePay: {
          merchantCountryCode: "KE",
          testEnv: isTestKey,
        },
        applePay: {
          merchantCountryCode: "KE",
        },
      });

      if (initError2) {
        console.log("[ADD_CARD] initPaymentSheet error:", initError2.message);
        setErrorMsg(initError2.message ?? "Could not initialize card form. Please try again.");
        setStep("idle");
        return;
      }

      setStep("sheet");

      // 4. Present the Payment Sheet for card entry
      const { error: presentError } = await presentPaymentSheet();

      if (presentError) {
        if (presentError.code === "Canceled") {
          // User dismissed — just go back to idle
          setStep("idle");
          return;
        }
        console.log("[ADD_CARD] presentPaymentSheet error:", presentError.message);
        setErrorMsg(presentError.message ?? "Card setup failed. Please try again.");
        setStep("idle");
        return;
      }

      // 5. Stripe sheet succeeded — retrieve SetupIntent to get the pm_xxx
      setStep("confirming");
      const { setupIntent, error: retrieveError } = await retrieveSetupIntent(clientSecret);
      if (retrieveError || !setupIntent?.paymentMethod?.id) {
        console.log("[ADD_CARD] retrieveSetupIntent error:", retrieveError?.message);
        setErrorMsg("Card saved with Stripe but could not verify. Please check Payment Methods.");
        setStep("done"); // treat as done since Stripe has the card
        return;
      }

      const paymentMethodId = setupIntent.paymentMethod.id;
      console.log("[ADD_CARD] Confirming card with paymentMethodId:", paymentMethodId);
      await confirmCardMutation.mutateAsync({ paymentMethodId });

      setStep("done");
    } catch (err: any) {
      console.log("[ADD_CARD] Error:", err?.response?.data ?? err?.message);
      const message =
        err?.response?.data?.message ??
        err?.message ??
        "Could not add card. Please try again.";
      setErrorMsg(message);
      setStep("idle");
    }
  }

  const isProcessing = step === "loading" || step === "sheet" || step === "confirming";

  if (step === "done") {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.centered}>
          <View style={s.successIcon}>
            <Ionicons name="checkmark-circle" size={64} color="#16a34a" />
          </View>
          <Text style={s.successTitle}>Card Added</Text>
          <Text style={s.successBody}>
            Your card has been saved securely. You can now use it for faster
            checkout.
          </Text>
          <TouchableOpacity
            style={s.primaryBtn}
            onPress={() => router.replace("/payment-methods" as any)}
          >
            <Text style={s.primaryBtnText}>View Payment Methods</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container} edges={["bottom"]}>
      <View style={s.content}>
        {/* Illustration */}
        <View style={s.iconWrap}>
          <Ionicons name="card" size={52} color="#16a34a" />
        </View>

        <Text style={s.title}>Add a New Card</Text>
        <Text style={s.subtitle}>
          Your card details are collected securely by Stripe and never stored on
          our servers.
        </Text>

        {/* Security badges */}
        <View style={s.badges}>
          <View style={s.badge}>
            <Ionicons name="lock-closed-outline" size={14} color="#16a34a" />
            <Text style={s.badgeText}>256-bit SSL</Text>
          </View>
          <View style={s.badge}>
            <Ionicons name="shield-checkmark-outline" size={14} color="#16a34a" />
            <Text style={s.badgeText}>PCI DSS compliant</Text>
          </View>
        </View>

        {/* Accepted cards */}
        <View style={s.accepted}>
          <Text style={s.acceptedLabel}>Accepted cards</Text>
          <View style={s.acceptedRow}>
            {["Visa", "Mastercard", "Amex"].map((brand) => (
              <View key={brand} style={s.brandChip}>
                <Ionicons name="card-outline" size={14} color="#374151" />
                <Text style={s.brandChipText}>{brand}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Error */}
        {errorMsg && (
          <View style={s.errorBox}>
            <Ionicons name="alert-circle-outline" size={16} color="#dc2626" />
            <Text style={s.errorText}>{errorMsg}</Text>
          </View>
        )}

        {/* Processing state feedback */}
        {isProcessing && (
          <View style={s.processingBox}>
            <ActivityIndicator size="small" color="#16a34a" />
            <Text style={s.processingText}>
              {step === "loading"     && "Preparing secure form..."}
              {step === "sheet"      && "Complete the form in the sheet above..."}
              {step === "confirming" && "Saving your card..."}
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[s.primaryBtn, isProcessing && s.primaryBtnDisabled]}
          onPress={() => void handleAddCard()}
          disabled={isProcessing}
          activeOpacity={0.85}
        >
          {isProcessing ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons
                name="add-circle-outline"
                size={18}
                color="#fff"
                style={{ marginRight: 8 }}
              />
              <Text style={s.primaryBtnText}>
                {errorMsg ? "Try Again" : "Add Card"}
              </Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={s.hint}>
          Tapping "Add Card" opens a secure Stripe form where you can enter your
          card details.
        </Text>
      </View>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: "#f9fafb" },
  centered:   { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  content: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 40,
  },

  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  title:    { fontSize: 24, fontWeight: "800", color: "#111827", marginBottom: 10, textAlign: "center" },
  subtitle: { fontSize: 14, color: "#6b7280", textAlign: "center", lineHeight: 20, marginBottom: 24 },

  badges: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#f0fdf4",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },
  badgeText: { fontSize: 12, fontWeight: "600", color: "#16a34a" },

  accepted:      { alignItems: "center", marginBottom: 32 },
  acceptedLabel: { fontSize: 12, color: "#9ca3af", marginBottom: 8 },
  acceptedRow:   { flexDirection: "row", gap: 8 },
  brandChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  brandChipText: { fontSize: 12, color: "#374151", fontWeight: "600" },

  errorBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#fef2f2",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#fecaca",
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
    width: "100%",
  },
  errorText: { flex: 1, color: "#dc2626", fontSize: 13, lineHeight: 18 },

  processingBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#eff6ff",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
    width: "100%",
  },
  processingText: { fontSize: 13, color: "#16a34a", flex: 1 },

  primaryBtn: {
    flexDirection: "row",
    backgroundColor: "#16a34a",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    marginBottom: 12,
  },
  primaryBtnDisabled: { opacity: 0.6 },
  primaryBtnText:     { color: "#fff", fontWeight: "700", fontSize: 15 },

  hint: {
    fontSize: 12,
    color: "#9ca3af",
    textAlign: "center",
    lineHeight: 18,
    paddingHorizontal: 16,
  },

  // Success state
  successIcon:  { marginBottom: 16 },
  successTitle: { fontSize: 24, fontWeight: "800", color: "#111827", marginBottom: 10, textAlign: "center" },
  successBody:  { fontSize: 14, color: "#6b7280", textAlign: "center", lineHeight: 20, marginBottom: 32 },
});
