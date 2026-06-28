import { useState, useCallback } from "react";
import {
  View,
  Text,
  Share,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useVoucherPdf } from "../../../hooks/booking";

// ── Helpers ───────────────────────────────────────────────────────────────────

async function openUrl(url: string): Promise<boolean> {
  // Skip canOpenURL for https:// — it is unreliable on Android 11+ without
  // intent-query declarations in the manifest. All modern devices handle https.
  if (url.startsWith("https://") || url.startsWith("http://")) {
    await Linking.openURL(url);
    return true;
  }
  const canOpen = await Linking.canOpenURL(url);
  if (canOpen) {
    await Linking.openURL(url);
    return true;
  }
  return false;
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function VoucherScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [isOpening, setIsOpening] = useState(false);
  const [isSharing, setIsSharing] = useState(false);

  const { data: voucher, isLoading, isError, refetch, isFetching } = useVoucherPdf(id);

  const isExpired = voucher?.expiresAt
    ? new Date(voucher.expiresAt) < new Date()
    : false;

  const handleOpenPdf = useCallback(async () => {
    const url = voucher?.voucherPdfUrl;
    if (!url) {
      Alert.alert("Not Available", "Voucher PDF URL is not available yet.");
      return;
    }
    if (isExpired) {
      Alert.alert(
        "Link Expired",
        "This voucher link has expired. Tap Refresh to generate a new one.",
        [
          { text: "Refresh", onPress: () => void refetch() },
          { text: "Cancel", style: "cancel" },
        ]
      );
      return;
    }

    setIsOpening(true);
    try {
      console.log("[VOUCHER] Opening PDF URL:", url);
      const opened = await openUrl(url);
      if (!opened) {
        Alert.alert(
          "Cannot Open PDF",
          "No app is available to open this file. Try using the Share option to copy the link.",
          [{ text: "OK" }]
        );
      }
    } catch (err) {
      console.warn("[VOUCHER] openURL error:", err);
      Alert.alert("Error", "Could not open the voucher PDF. Please try again.");
    } finally {
      setIsOpening(false);
    }
  }, [voucher, isExpired, refetch]);

  const handleSharePdf = useCallback(async () => {
    const url = voucher?.voucherPdfUrl;
    if (!url) return;

    setIsSharing(true);
    try {
      console.log("[VOUCHER] Sharing PDF URL:", url);
      await Share.share({
        message: `Kainook Booking Voucher PDF\n${url}`,
        title: "Booking Voucher",
        url,            // iOS native share sheet uses this for the PDF preview
      });
    } catch { /* dismissed */ } finally {
      setIsSharing(false);
    }
  }, [voucher]);

  // ── Loading ──────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <SafeAreaView style={s.container} edges={["bottom"]}>
        <Stack.Screen options={{ title: "Voucher", headerShown: true, headerBackTitle: "Back" }} />
        <View style={s.centered}>
          <ActivityIndicator size="large" color="#16a34a" />
          <Text style={s.loadingText}>Preparing your voucher…</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────

  if (isError || !voucher) {
    return (
      <SafeAreaView style={s.container} edges={["bottom"]}>
        <Stack.Screen options={{ title: "Voucher", headerShown: true, headerBackTitle: "Back" }} />
        <View style={s.centered}>
          <Ionicons name="document-text-outline" size={64} color="#d1d5db" />
          <Text style={s.errTitle}>Voucher unavailable</Text>
          <Text style={s.errBody}>
            The voucher PDF could not be loaded. It may still be generating — please try again in a moment.
          </Text>
          <TouchableOpacity
            style={s.primaryBtn}
            onPress={() => void refetch()}
            disabled={isFetching}
          >
            {isFetching
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.primaryBtnText}>Try Again</Text>}
          </TouchableOpacity>
          <TouchableOpacity style={s.secondaryBtn} onPress={() => router.back()}>
            <Text style={s.secondaryBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Success ──────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={s.container} edges={["bottom"]}>
      <Stack.Screen options={{ title: "Voucher", headerShown: true, headerBackTitle: "Back" }} />

      <View style={s.content}>
        {/* Icon */}
        <View style={s.iconWrap}>
          <Ionicons name="document-text" size={52} color="#16a34a" />
        </View>

        <Text style={s.title}>Booking Voucher</Text>
        <Text style={s.subtitle}>
          Your PDF voucher is ready. Open it in a browser or PDF viewer, or share
          the link with anyone who needs it.
        </Text>

        {/* Expiry */}
        {voucher.expiresAt ? (
          <View style={[s.expiryChip, isExpired && s.expiryChipExpired]}>
            <Ionicons
              name={isExpired ? "warning-outline" : "time-outline"}
              size={14}
              color={isExpired ? "#dc2626" : "#6b7280"}
              style={{ marginRight: 6 }}
            />
            <Text style={[s.expiryText, isExpired && s.expiryTextExpired]}>
              {isExpired
                ? "Link expired — tap Refresh to generate a new one"
                : `Link valid until ${new Date(voucher.expiresAt).toLocaleTimeString("en-GB", {
                    hour: "2-digit", minute: "2-digit",
                  })} · ${new Date(voucher.expiresAt).toLocaleDateString("en-GB", {
                    day: "numeric", month: "short",
                  })}`}
            </Text>
          </View>
        ) : null}

        {/* Actions */}
        <View style={s.actions}>
          {isExpired ? (
            <TouchableOpacity
              style={s.primaryBtn}
              onPress={() => void refetch()}
              disabled={isFetching}
              activeOpacity={0.85}
            >
              {isFetching
                ? <ActivityIndicator color="#fff" />
                : <>
                    <Ionicons name="refresh-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={s.primaryBtnText}>Refresh Voucher</Text>
                  </>}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[s.primaryBtn, isOpening && s.btnBusy]}
              onPress={() => void handleOpenPdf()}
              disabled={isOpening}
              activeOpacity={0.85}
            >
              {isOpening
                ? <ActivityIndicator color="#fff" />
                : <>
                    <Ionicons name="open-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={s.primaryBtnText}>Open PDF</Text>
                  </>}
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[s.secondaryBtn, isSharing && s.btnBusy]}
            onPress={() => void handleSharePdf()}
            disabled={isSharing}
            activeOpacity={0.85}
          >
            {isSharing
              ? <ActivityIndicator color="#374151" />
              : <>
                  <Ionicons name="share-outline" size={16} color="#374151" style={{ marginRight: 8 }} />
                  <Text style={s.secondaryBtnText}>Download / Share PDF</Text>
                </>}
          </TouchableOpacity>
        </View>

        <Text style={s.hint}>
          On iOS: tap "Open PDF" to preview in Safari, then use the share icon to save to Files.{"\n"}
          On Android: the PDF opens in your browser or default PDF app.
        </Text>
      </View>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f3f4f6" },
  centered:  { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  content: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 48,
    paddingBottom: 40,
  },

  loadingText: { fontSize: 14, color: "#6b7280", marginTop: 12 },
  errTitle:    { fontSize: 20, fontWeight: "700", color: "#111827", marginTop: 16, textAlign: "center" },
  errBody:     { fontSize: 14, color: "#6b7280", textAlign: "center", lineHeight: 20, marginBottom: 24 },

  iconWrap: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: "#f0fdf4",
    alignItems: "center", justifyContent: "center",
    marginBottom: 20,
  },
  title:    { fontSize: 24, fontWeight: "800", color: "#111827", marginBottom: 10, textAlign: "center" },
  subtitle: { fontSize: 14, color: "#6b7280", textAlign: "center", lineHeight: 20, marginBottom: 16 },

  expiryChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9fafb",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginBottom: 28,
    maxWidth: "92%",
  },
  expiryChipExpired: { backgroundColor: "#fef2f2", borderColor: "#fca5a5" },
  expiryText:        { fontSize: 12, color: "#6b7280", flex: 1, lineHeight: 17 },
  expiryTextExpired: { color: "#dc2626", fontWeight: "600" },

  actions: { width: "100%", gap: 12, marginBottom: 24 },

  primaryBtn: {
    flexDirection: "row",
    backgroundColor: "#16a34a",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },

  secondaryBtn: {
    flexDirection: "row",
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  secondaryBtnText: { color: "#374151", fontWeight: "600", fontSize: 15 },

  btnBusy: { opacity: 0.65 },

  hint: {
    fontSize: 12,
    color: "#9ca3af",
    textAlign: "center",
    lineHeight: 18,
    paddingHorizontal: 8,
  },
});
