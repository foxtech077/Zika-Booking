import {
  View,
  Text,
  Share,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from "react-native";
import { Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useVoucherPdf } from "../../../hooks/booking";

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function VoucherScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const {
    data: voucher,
    isLoading,
    isError,
    refetch,
  } = useVoucherPdf(id);

  async function handleOpenPdf() {
    if (!voucher?.downloadUrl) return;
    console.log("[VOUCHER] Opening PDF:", voucher.downloadUrl);
    const canOpen = await Linking.canOpenURL(voucher.downloadUrl);
    if (canOpen) {
      await Linking.openURL(voucher.downloadUrl);
    } else {
      Alert.alert(
        "Cannot Open PDF",
        "No PDF viewer is installed on this device. Try sharing the link instead.",
        [{ text: "OK" }]
      );
    }
  }

  async function handleSharePdf() {
    if (!voucher?.downloadUrl) return;
    console.log("[VOUCHER] Sharing PDF URL:", voucher.downloadUrl);
    try {
      await Share.share({
        message: `Kainook Booking Voucher\n${voucher.downloadUrl}`,
        title: voucher.filename ?? "Booking Voucher",
        url: voucher.downloadUrl, // iOS native share sheet uses this for PDF
      });
    } catch {
      // User dismissed share sheet
    }
  }

  if (isLoading) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.centered}>
          <ActivityIndicator size="large" color="#1a73e8" />
          <Text style={s.loadingText}>Preparing your voucher...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isError || !voucher) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.centered}>
          <Ionicons name="document-text-outline" size={64} color="#d1d5db" />
          <Text style={s.errorTitle}>Voucher unavailable</Text>
          <Text style={s.errorBody}>
            The voucher PDF could not be loaded. It may still be generating —
            please try again in a moment.
          </Text>
          <TouchableOpacity
            style={s.primaryBtn}
            onPress={() => void refetch()}
          >
            <Text style={s.primaryBtnText}>Try Again</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={s.secondaryBtn}
            onPress={() => router.back()}
          >
            <Text style={s.secondaryBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container} edges={["bottom"]}>
      <View style={s.content}>
        {/* Icon */}
        <View style={s.iconWrap}>
          <Ionicons name="document-text" size={52} color="#1a73e8" />
        </View>

        <Text style={s.title}>Booking Voucher</Text>
        <Text style={s.subtitle}>
          Your PDF voucher is ready. Open it in a PDF viewer or share it with
          anyone who needs it.
        </Text>

        {voucher.filename && (
          <View style={s.filenameChip}>
            <Ionicons
              name="document-outline"
              size={14}
              color="#374151"
              style={{ marginRight: 6 }}
            />
            <Text style={s.filenameText} numberOfLines={1}>
              {voucher.filename}
            </Text>
          </View>
        )}

        {voucher.expiresAt && (
          <Text style={s.expiryNote}>
            Link expires{" "}
            {new Date(voucher.expiresAt).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </Text>
        )}

        {/* Actions */}
        <View style={s.actions}>
          <TouchableOpacity
            style={s.primaryBtn}
            onPress={() => void handleOpenPdf()}
            activeOpacity={0.85}
          >
            <Ionicons
              name="open-outline"
              size={18}
              color="#fff"
              style={{ marginRight: 8 }}
            />
            <Text style={s.primaryBtnText}>Open PDF</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.secondaryBtn}
            onPress={() => void handleSharePdf()}
            activeOpacity={0.85}
          >
            <Ionicons
              name="share-outline"
              size={16}
              color="#374151"
              style={{ marginRight: 8 }}
            />
            <Text style={s.secondaryBtnText}>Download / Share PDF</Text>
          </TouchableOpacity>
        </View>

        <Text style={s.hint}>
          On iOS, tap "Open PDF" to preview in Safari and use the share icon to
          save. On Android, the PDF will open in your default browser or PDF
          app.
        </Text>
      </View>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  centered:  { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  content: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 40,
  },

  loadingText: { fontSize: 14, color: "#6b7280", marginTop: 12 },
  errorTitle:  { fontSize: 20, fontWeight: "700", color: "#111827", marginTop: 16, textAlign: "center" },
  errorBody:   { fontSize: 14, color: "#6b7280", textAlign: "center", lineHeight: 20, marginBottom: 24 },

  iconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  title:     { fontSize: 24, fontWeight: "800", color: "#111827", marginBottom: 10, textAlign: "center" },
  subtitle:  { fontSize: 14, color: "#6b7280", textAlign: "center", lineHeight: 20, marginBottom: 20 },

  filenameChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginBottom: 8,
    maxWidth: "90%",
  },
  filenameText: { fontSize: 13, color: "#374151", fontWeight: "500", flex: 1 },

  expiryNote: { fontSize: 12, color: "#9ca3af", marginBottom: 32 },

  actions: { width: "100%", gap: 12, marginBottom: 28 },

  primaryBtn: {
    flexDirection: "row",
    backgroundColor: "#1a73e8",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },

  secondaryBtn: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtnText: { color: "#374151", fontWeight: "600", fontSize: 15 },

  hint: {
    fontSize: 12,
    color: "#9ca3af",
    textAlign: "center",
    lineHeight: 18,
    paddingHorizontal: 16,
  },
});
