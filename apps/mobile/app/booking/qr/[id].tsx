import { useState } from "react";
import {
  View,
  Text,
  Image,
  Share,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Linking } from "react-native";
import { useQRCode } from "../../../hooks/booking";

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function QRCodeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [imgLoadError, setImgLoadError] = useState(false);

  const {
    data: qrCode,
    isLoading,
    isError,
    refetch,
  } = useQRCode(id);

  async function handleShare() {
    if (!qrCode) return;
    try {
      // Share the URL directly; recipient can open/save it
      await Share.share({
        message: `Kainook Booking QR Code\nReference: ${qrCode.bookingReference}\n${qrCode.qrCodeUrl}`,
        title: `QR Code – ${qrCode.bookingReference}`,
      });
    } catch {
      // User dismissed
    }
  }

  async function handleOpenInBrowser() {
    if (!qrCode?.qrCodeUrl) return;
    const canOpen = await Linking.canOpenURL(qrCode.qrCodeUrl);
    if (canOpen) {
      await Linking.openURL(qrCode.qrCodeUrl);
    } else {
      Alert.alert("Error", "Could not open QR code image.");
    }
  }

  if (isLoading) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.centered}>
          <ActivityIndicator size="large" color="#1a73e8" />
          <Text style={s.loadingText}>Generating QR code...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isError || !qrCode) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.centered}>
          <Ionicons name="qr-code-outline" size={64} color="#d1d5db" />
          <Text style={s.errorTitle}>QR code unavailable</Text>
          <Text style={s.errorBody}>
            The QR code for this booking could not be loaded. It may still be
            generating — try again shortly.
          </Text>
          <TouchableOpacity style={s.primaryBtn} onPress={() => void refetch()}>
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
        {/* Header */}
        <Text style={s.title}>Booking QR Code</Text>
        <Text style={s.reference}>{qrCode.bookingReference}</Text>
        {qrCode.expiresAt && (
          <Text style={s.expiryNote}>
            Valid until{" "}
            {new Date(qrCode.expiresAt).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </Text>
        )}

        {/* QR Code image */}
        <View style={s.qrContainer}>
          {!imgLoadError ? (
            <Image
              source={{ uri: qrCode.qrCodeUrl }}
              style={s.qrImage}
              resizeMode="contain"
              onError={() => {
                console.warn("[QR_SCREEN] Image load failed for URL:", qrCode.qrCodeUrl);
                setImgLoadError(true);
              }}
            />
          ) : (
            <View style={s.qrFallback}>
              <Ionicons name="qr-code-outline" size={64} color="#9ca3af" />
              <Text style={s.qrFallbackText}>
                Could not render QR image.{"\n"}Tap "Open in Browser" below.
              </Text>
            </View>
          )}
        </View>

        <Text style={s.hint}>
          Present this QR code at check-in / pickup.
        </Text>

        {/* Action buttons */}
        <View style={s.actions}>
          <TouchableOpacity
            style={s.primaryBtn}
            onPress={() => void handleShare()}
            activeOpacity={0.85}
          >
            <Ionicons
              name="share-outline"
              size={18}
              color="#fff"
              style={{ marginRight: 8 }}
            />
            <Text style={s.primaryBtnText}>Share QR Code</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.secondaryBtn}
            onPress={() => void handleOpenInBrowser()}
            activeOpacity={0.85}
          >
            <Ionicons
              name="open-outline"
              size={16}
              color="#374151"
              style={{ marginRight: 8 }}
            />
            <Text style={s.secondaryBtnText}>Open in Browser</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  centered:  { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32 },
  content:   { flex: 1, alignItems: "center", paddingHorizontal: 24, paddingTop: 32, paddingBottom: 40 },

  loadingText: { fontSize: 14, color: "#6b7280", marginTop: 12 },
  errorTitle:  { fontSize: 20, fontWeight: "700", color: "#111827", marginTop: 16, textAlign: "center" },
  errorBody:   { fontSize: 14, color: "#6b7280", textAlign: "center", lineHeight: 20, marginBottom: 24 },

  title:       { fontSize: 22, fontWeight: "800", color: "#111827", marginBottom: 4 },
  reference:   { fontSize: 14, fontWeight: "700", color: "#1a73e8", letterSpacing: 0.5, marginBottom: 4 },
  expiryNote:  { fontSize: 12, color: "#6b7280", marginBottom: 24 },
  hint:        { fontSize: 13, color: "#6b7280", textAlign: "center", marginBottom: 28, lineHeight: 18 },

  qrContainer: {
    width: 260,
    height: 260,
    backgroundColor: "#fff",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
    padding: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  qrImage: {
    width: 220,
    height: 220,
    borderRadius: 8,
  },
  qrFallback: {
    alignItems: "center",
    gap: 12,
    padding: 12,
  },
  qrFallbackText: {
    fontSize: 13,
    color: "#9ca3af",
    textAlign: "center",
    lineHeight: 18,
  },

  actions: { width: "100%", gap: 12 },

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
});
