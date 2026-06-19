import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAddTaraAccount } from "../../hooks/paymentMethods";
import type { SavedPaymentMethod } from "../../lib/types/booking";

// ── Country prefixes (same as pay screen) ─────────────────────────────────────

const COUNTRY_PREFIXES = [
  { prefix: "+254", country: "Kenya",        flag: "🇰🇪" },
  { prefix: "+234", country: "Nigeria",      flag: "🇳🇬" },
  { prefix: "+233", country: "Ghana",        flag: "🇬🇭" },
  { prefix: "+27",  country: "South Africa", flag: "🇿🇦" },
  { prefix: "+256", country: "Uganda",       flag: "🇺🇬" },
  { prefix: "+255", country: "Tanzania",     flag: "🇹🇿" },
];

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function AddTaraAccountScreen() {
  const router = useRouter();

  const [countryPrefix,      setCountryPrefix]      = useState("+254");
  const [mobileNumber,       setMobileNumber]       = useState("");
  const [showPrefixPicker,   setShowPrefixPicker]   = useState(false);
  const [savedMethod,        setSavedMethod]         = useState<SavedPaymentMethod | null>(null);

  const mutation = useAddTaraAccount();

  const selectedCountry = COUNTRY_PREFIXES.find((c) => c.prefix === countryPrefix);

  function validate(): string | null {
    const digits = mobileNumber.replace(/\D/g, "");
    if (digits.length < 6) return "Please enter a valid mobile number.";
    if (digits.length > 15) return "Mobile number is too long.";
    return null;
  }

  function handleSubmit() {
    const err = validate();
    if (err) {
      Alert.alert("Invalid number", err);
      return;
    }
    const fullNumber = `${countryPrefix}${mobileNumber}`;
    console.log("[ADD_TARA] Adding Tara account:", fullNumber);

    mutation.mutate(
      { mobileNumber: fullNumber },
      {
        onSuccess: (data) => {
          setSavedMethod(data);
        },
        onError: (err: any) => {
          const message =
            err?.response?.data?.message ??
            err?.message ??
            "Could not add this mobile number. Please try again.";
          Alert.alert("Error", message);
        },
      }
    );
  }

  // ── Success state ─────────────────────────────────────────────────────────

  if (savedMethod) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.centered}>
          <View style={s.successIcon}>
            <Ionicons name="checkmark-circle" size={64} color="#16a34a" />
          </View>
          <Text style={s.successTitle}>Mobile Money Added</Text>
          <Text style={s.successBody}>
            {savedMethod.mobileNumber ?? `${countryPrefix}${mobileNumber}`} has
            been saved. You can now pay with mobile money at checkout.
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
      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Icon + intro */}
        <View style={s.header}>
          <View style={s.iconWrap}>
            <Ionicons name="phone-portrait" size={44} color="#0D7377" />
          </View>
          <Text style={s.title}>Add Mobile Money</Text>
          <Text style={s.subtitle}>
            Save your mobile money number to pay faster without re-entering it
            each time.
          </Text>
        </View>

        {/* Phone number input */}
        <View style={s.card}>
          <Text style={s.fieldLabel}>Mobile Number</Text>
          <Text style={s.fieldHint}>
            This should be the number registered with your mobile money account
            (e.g. M-Pesa, MTN, Airtel).
          </Text>

          <View style={s.phoneRow}>
            {/* Country prefix selector */}
            <TouchableOpacity
              style={s.prefixButton}
              onPress={() => setShowPrefixPicker(true)}
              activeOpacity={0.8}
            >
              <Text style={s.prefixFlag}>{selectedCountry?.flag ?? "🌍"}</Text>
              <Text style={s.prefixText}>{countryPrefix}</Text>
              <Ionicons name="chevron-down" size={14} color="#374151" />
            </TouchableOpacity>

            <TextInput
              style={s.phoneInput}
              value={mobileNumber}
              onChangeText={(t) => setMobileNumber(t.replace(/\D/g, ""))}
              placeholder="712 345 678"
              placeholderTextColor="#9ca3af"
              keyboardType="phone-pad"
              autoFocus
              returnKeyType="done"
              onSubmitEditing={handleSubmit}
            />
          </View>

          {/* Preview of full number */}
          {mobileNumber.length > 0 && (
            <Text style={s.fullNumberPreview}>
              Full number: {countryPrefix}{mobileNumber}
            </Text>
          )}
        </View>

        {/* Info box */}
        <View style={s.infoBox}>
          <Ionicons
            name="information-circle-outline"
            size={16}
            color="#6b7280"
            style={{ flexShrink: 0 }}
          />
          <Text style={s.infoText}>
            When you pay with this number, you will receive a prompt on your
            phone to enter your mobile money PIN to authorize the payment.
          </Text>
        </View>

        {/* Submit button */}
        <TouchableOpacity
          style={[s.primaryBtn, mutation.isPending && s.primaryBtnDisabled]}
          onPress={handleSubmit}
          disabled={mutation.isPending}
          activeOpacity={0.85}
        >
          {mutation.isPending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons
                name="add-circle-outline"
                size={18}
                color="#fff"
                style={{ marginRight: 8 }}
              />
              <Text style={s.primaryBtnText}>Save Mobile Number</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Country prefix picker modal */}
      <Modal
        animationType="slide"
        transparent
        visible={showPrefixPicker}
        onRequestClose={() => setShowPrefixPicker(false)}
      >
        <View style={s.modalBack}>
          <View style={s.modalSheet}>
            {/* Handle bar */}
            <View style={s.modalHandle} />
            <Text style={s.modalTitle}>Select Country</Text>

            {COUNTRY_PREFIXES.map((c) => (
              <TouchableOpacity
                key={c.prefix}
                style={[
                  s.prefixRow,
                  c.prefix === countryPrefix && s.prefixRowSelected,
                ]}
                onPress={() => {
                  setCountryPrefix(c.prefix);
                  setShowPrefixPicker(false);
                }}
                activeOpacity={0.75}
              >
                <Text style={s.prefixRowFlag}>{c.flag}</Text>
                <View style={s.prefixRowInfo}>
                  <Text style={s.prefixRowCountry}>{c.country}</Text>
                  <Text style={s.prefixRowCode}>{c.prefix}</Text>
                </View>
                {c.prefix === countryPrefix && (
                  <Ionicons name="checkmark-circle" size={20} color="#0D7377" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container:  { flex: 1, backgroundColor: "#f9fafb" },
  centered:   { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  scroll:     { padding: 16, paddingBottom: 40 },

  header: {
    alignItems: "center",
    marginBottom: 24,
    paddingTop: 12,
  },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "#f0fdf4",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title:    { fontSize: 22, fontWeight: "800", color: "#111827", marginBottom: 8, textAlign: "center" },
  subtitle: { fontSize: 14, color: "#6b7280", textAlign: "center", lineHeight: 20 },

  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: 16,
  },
  fieldLabel: { fontSize: 14, fontWeight: "600", color: "#374151", marginBottom: 4 },
  fieldHint:  { fontSize: 12, color: "#9ca3af", lineHeight: 16, marginBottom: 14 },

  phoneRow:   { flexDirection: "row", alignItems: "center", gap: 10 },
  prefixButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "#f3f4f6",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  prefixFlag: { fontSize: 18 },
  prefixText: { fontSize: 14, fontWeight: "600", color: "#111827" },

  phoneInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#111827",
    backgroundColor: "#fff",
  },

  fullNumberPreview: { fontSize: 12, color: "#9ca3af", marginTop: 10 },

  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 24,
  },
  infoText: { flex: 1, fontSize: 13, color: "#6b7280", lineHeight: 18 },

  primaryBtn: {
    flexDirection: "row",
    backgroundColor: "#0D7377",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  primaryBtnDisabled: { opacity: 0.6 },
  primaryBtnText:     { color: "#fff", fontWeight: "700", fontSize: 15 },

  // Success state
  successIcon:  { marginBottom: 16 },
  successTitle: { fontSize: 24, fontWeight: "800", color: "#111827", marginBottom: 10, textAlign: "center" },
  successBody:  { fontSize: 14, color: "#6b7280", textAlign: "center", lineHeight: 20, marginBottom: 32 },

  // Modal
  modalBack:  { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingBottom: 40,
  },
  modalHandle: {
    width: 36,
    height: 4,
    backgroundColor: "#d1d5db",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
    paddingHorizontal: 20,
    marginBottom: 12,
  },

  prefixRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
    gap: 14,
  },
  prefixRowSelected: { backgroundColor: "#f0fdf4" },
  prefixRowFlag:     { fontSize: 24 },
  prefixRowInfo:     { flex: 1 },
  prefixRowCountry:  { fontSize: 15, fontWeight: "600", color: "#111827" },
  prefixRowCode:     { fontSize: 13, color: "#6b7280", marginTop: 2 },
});
