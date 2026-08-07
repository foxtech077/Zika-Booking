import { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  Image,
  Share,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
  Linking,
  ScrollView,
  Platform,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQRCode } from "../../../hooks/booking";

// ── Skeleton ──────────────────────────────────────────────────────────────────

function QRSkeleton() {
  const opacity = useRef(new Animated.Value(0.35)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 750, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.35, duration: 750, useNativeDriver: true }),
      ])
    ).start();
  }, [opacity]);

  return (
    <View style={s.centered}>
      <Animated.View style={{ width: 260, height: 260, backgroundColor: "#e5e7eb", borderRadius: 20, opacity, marginBottom: 24 }} />
      <Animated.View style={{ width: 160, height: 14, backgroundColor: "#e5e7eb", borderRadius: 6, opacity, marginBottom: 10 }} />
      <Animated.View style={{ width: 110, height: 12, backgroundColor: "#e5e7eb", borderRadius: 6, opacity, marginBottom: 32 }} />
      <Animated.View style={{ width: "100%", height: 50, backgroundColor: "#e5e7eb", borderRadius: 14, opacity, marginBottom: 12 }} />
      <Animated.View style={{ width: "100%", height: 50, backgroundColor: "#e5e7eb", borderRadius: 14, opacity }} />
    </View>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function QRCodeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  // API state
  const { data: qrCode, isLoading, isError, refetch, isFetching } = useQRCode(id);

  // Image-specific state (independent of API loading)
  const [imgLoading, setImgLoading] = useState(true);
  const [imgError, setImgError] = useState(false);
  const [imgKey, setImgKey] = useState(0);

  // Reset image state when the QR URL changes (e.g. after API refetch)
  const prevUrl = useRef<string | undefined>(undefined);
  if (qrCode?.qrCodeUrl && qrCode.qrCodeUrl !== prevUrl.current) {
    prevUrl.current = qrCode.qrCodeUrl;
    setImgLoading(true);
    setImgError(false);
  }

  const handleImgRetry = useCallback(() => {
    setImgError(false);
    setImgLoading(true);
    setImgKey((k) => k + 1);
  }, []);

  async function handleShare() {
    if (!qrCode) return;
    try {
      await Share.share({
        message: `Kainook Booking QR Code\nReference: ${qrCode.bookingReference}\n${qrCode.qrCodeUrl}`,
        title: `QR Code – ${qrCode.bookingReference}`,
      });
    } catch { /* dismissed */ }
  }

  async function handleOpenInBrowser() {
    const url = qrCode?.qrCodeUrl;
    if (!url) return;
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert("Error", "Could not open the QR code image.");
    }
  }

  // ── API loading ──────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <SafeAreaView style={s.container} edges={["bottom"]}>
        <Stack.Screen options={{ title: "QR Code", headerShown: true, headerBackTitle: "Back" }} />
        <View style={[s.centered, { paddingHorizontal: 24, paddingTop: 32 }]}>
          <QRSkeleton />
        </View>
      </SafeAreaView>
    );
  }

  // ── API error ────────────────────────────────────────────────────────────

  if (isError || !qrCode) {
    return (
      <SafeAreaView style={s.container} edges={["bottom"]}>
        <Stack.Screen options={{ title: "QR Code", headerShown: true, headerBackTitle: "Back" }} />
        <View style={s.centered}>
          <Ionicons name="qr-code-outline" size={64} color="#d1d5db" />
          <Text style={s.errTitle}>QR code unavailable</Text>
          <Text style={s.errBody}>
            The QR code for this booking could not be loaded. It may still be generating — try again shortly.
          </Text>
          <TouchableOpacity style={s.primaryBtn} onPress={() => void refetch()} disabled={isFetching}>
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

  const isExpired = qrCode.expiresAt ? new Date(qrCode.expiresAt) < new Date() : false;

  return (
    <SafeAreaView style={s.container} edges={["bottom"]}>
      <Stack.Screen options={{ title: "QR Code", headerShown: true, headerBackTitle: "Back" }} />

      <ScrollView
        contentContainerStyle={s.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Text style={s.title}>Booking QR Code</Text>
        <Text style={s.reference}>{qrCode.bookingReference}</Text>
        {qrCode.expiresAt && (
          <Text style={[s.expiryNote, isExpired && s.expiryExpired]}>
            {isExpired
              ? "QR code expired — tap Refresh to generate a new one"
              : `Valid until ${new Date(qrCode.expiresAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })} · ${new Date(qrCode.expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`}
          </Text>
        )}

        {/* QR image card */}
        <View style={s.qrCard}>
          {imgError ? (
            <View style={s.qrFallback}>
              <Ionicons name="image-outline" size={52} color="#9ca3af" />
              <Text style={s.qrFallbackTitle}>Image failed to load</Text>
              <Text style={s.qrFallbackBody}>
                The QR code image could not be displayed.
              </Text>
              <TouchableOpacity style={s.retryBtn} onPress={handleImgRetry}>
                <Ionicons name="refresh-outline" size={15} color="#16a34a" style={{ marginRight: 6 }} />
                <Text style={s.retryBtnText}>Retry Image</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.retryBtn, { marginTop: 8, borderColor: "#d1d5db" }]}
                onPress={() => void refetch()}
                disabled={isFetching}
              >
                <Ionicons name="cloud-download-outline" size={15} color="#374151" style={{ marginRight: 6 }} />
                <Text style={[s.retryBtnText, { color: "#374151" }]}>Refresh from Server</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* Image loading overlay */}
              {imgLoading && (
                <View style={s.imgLoadingOverlay}>
                  <ActivityIndicator size="large" color="#16a34a" />
                  <Text style={s.imgLoadingText}>Loading QR code…</Text>
                </View>
              )}

              {/*
                On iOS, wrap in a ScrollView with maximumZoomScale to enable
                pinch-to-zoom. On Android, display directly (no gesture-handler
                installed in this project).
              */}
              {Platform.OS === "ios" ? (
                <ScrollView
                  style={s.zoomScroll}
                  contentContainerStyle={s.zoomContent}
                  maximumZoomScale={4}
                  minimumZoomScale={1}
                  centerContent
                  bounces={false}
                  showsVerticalScrollIndicator={false}
                  showsHorizontalScrollIndicator={false}
                >
                  <Image
                    key={imgKey}
                    source={{ uri: qrCode.qrCodeUrl, cache: "force-cache" }}
                    style={s.qrImage}
                    resizeMode="contain"
                    onLoadStart={() => setImgLoading(true)}
                    onLoad={() => {
                      console.log("[QR_SCREEN] Image loaded successfully");
                      setImgLoading(false);
                    }}
                    onError={(e) => {
                      console.warn("[QR_SCREEN] Image failed:", e.nativeEvent.error);
                      setImgLoading(false);
                      setImgError(true);
                    }}
                  />
                </ScrollView>
              ) : (
                <Image
                  key={imgKey}
                  source={{ uri: qrCode.qrCodeUrl }}
                  style={s.qrImage}
                  resizeMode="contain"
                  onLoadStart={() => setImgLoading(true)}
                  onLoad={() => {
                    console.log("[QR_SCREEN] Image loaded successfully");
                    setImgLoading(false);
                  }}
                  onError={(e) => {
                    console.warn("[QR_SCREEN] Image failed:", e.nativeEvent.error);
                    setImgLoading(false);
                    setImgError(true);
                  }}
                />
              )}
            </>
          )}
        </View>

        {Platform.OS === "ios" && !imgError && (
          <Text style={s.zoomHint}>Pinch to zoom</Text>
        )}

        <Text style={s.hint}>
          Present this QR code at check-in or vehicle pick-up.
        </Text>

        {/* Actions */}
        <View style={s.actions}>
          {isExpired ? (
            <TouchableOpacity
              style={s.primaryBtn}
              onPress={() => { handleImgRetry(); void refetch(); }}
              disabled={isFetching}
              activeOpacity={0.85}
            >
              {isFetching
                ? <ActivityIndicator color="#fff" />
                : <>
                    <Ionicons name="refresh-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={s.primaryBtnText}>Refresh QR Code</Text>
                  </>}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={s.primaryBtn}
              onPress={() => void handleShare()}
              activeOpacity={0.85}
            >
              <Ionicons name="share-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
              <Text style={s.primaryBtnText}>Share QR Code</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={s.secondaryBtn}
            onPress={() => void handleOpenInBrowser()}
            activeOpacity={0.85}
          >
            <Ionicons name="open-outline" size={16} color="#374151" style={{ marginRight: 8 }} />
            <Text style={s.secondaryBtnText}>Open in Browser</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const QR_SIZE = 240;

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f3f4f6" },
  centered:  { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  scroll:    { alignItems: "center", paddingHorizontal: 24, paddingTop: 28, paddingBottom: 40 },

  title:      { fontSize: 22, fontWeight: "800", color: "#111827", marginBottom: 4 },
  reference:  { fontSize: 14, fontWeight: "700", color: "#16a34a", letterSpacing: 0.5, marginBottom: 4 },
  expiryNote: { fontSize: 12, color: "#6b7280", marginBottom: 20, textAlign: "center" },
  expiryExpired: { color: "#dc2626", fontWeight: "600" },
  hint:       { fontSize: 13, color: "#6b7280", textAlign: "center", lineHeight: 18, marginBottom: 28 },
  zoomHint:   { fontSize: 11, color: "#9ca3af", marginBottom: 12, marginTop: -8 },

  // QR card
  qrCard: {
    width: QR_SIZE + 40,
    minHeight: QR_SIZE + 40,
    backgroundColor: "#fff",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 4,
    overflow: "hidden",
  },

  // Zoom scroll (iOS)
  zoomScroll: { width: QR_SIZE, height: QR_SIZE },
  zoomContent: { alignItems: "center", justifyContent: "center" },

  qrImage: { width: QR_SIZE, height: QR_SIZE },

  // Image loading overlay
  imgLoadingOverlay: {
    position: "absolute",
    width: QR_SIZE,
    height: QR_SIZE,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f9fafb",
    zIndex: 10,
  },
  imgLoadingText: { fontSize: 12, color: "#6b7280", marginTop: 10 },

  // Fallback
  qrFallback: { alignItems: "center", gap: 10, padding: 12 },
  qrFallbackTitle: { fontSize: 15, fontWeight: "700", color: "#374151", textAlign: "center" },
  qrFallbackBody:  { fontSize: 13, color: "#9ca3af", textAlign: "center", lineHeight: 18 },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#bbf7d0",
    backgroundColor: "#f0fdf4",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginTop: 4,
  },
  retryBtnText: { fontSize: 13, fontWeight: "600", color: "#16a34a" },

  // Error state
  errTitle: { fontSize: 20, fontWeight: "700", color: "#111827", marginTop: 16, textAlign: "center" },
  errBody:  { fontSize: 14, color: "#6b7280", textAlign: "center", lineHeight: 20, marginBottom: 24 },

  actions: { width: "100%", gap: 12 },

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
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    backgroundColor: "#fff",
  },
  secondaryBtnText: { color: "#374151", fontWeight: "600", fontSize: 15 },
});
