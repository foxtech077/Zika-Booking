import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { WebView } from "react-native-webview";
import * as Linking from "expo-linking";
import { K } from "../../constants/theme";
import { LEGAL_URLS } from "../../constants/legalContent";

function resolveTarget(doc: string): { title: string; url: string } | null {
  if (doc === "terms") {
    return { title: "Terms of Use", url: LEGAL_URLS.terms };
  }
  if (doc === "privacy") {
    return { title: "Privacy Policy", url: LEGAL_URLS.privacy };
  }
  return null;
}

export default function LegalDocumentScreen() {
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const target = resolveTarget(doc ?? "");
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  if (!target) {
    return (
      <SafeAreaView style={s.container} edges={["top", "bottom"]}>
        <View style={s.errorState}>
          <Ionicons name="document-outline" size={52} color={K.colors.textMuted} />
          <Text style={s.errorTitle}>Document not found</Text>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()} activeOpacity={0.8}>
            <Text style={s.backBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const handleOpenExternal = () => {
    void Linking.openURL(target.url);
  };

  return (
    <SafeAreaView style={s.container} edges={["top", "bottom"]}>
      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity style={s.headerBack} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color={K.colors.darkGreen} />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle} numberOfLines={1}>{target.title}</Text>
          <Text style={s.headerSubtitle} numberOfLines={1}>kainook.com</Text>
        </View>
        <TouchableOpacity
          style={s.headerAction}
          onPress={handleOpenExternal}
          activeOpacity={0.7}
          accessibilityLabel="Open in Browser"
        >
          <Ionicons name="open-outline" size={20} color={K.colors.darkGreen} />
        </TouchableOpacity>
      </View>

      {/* ── Content Container ── */}
      <View style={s.contentContainer}>
        {isLoading && !hasError && (
          <View style={s.loadingOverlay}>
            <ActivityIndicator size="large" color={K.colors.darkGreen} />
            <Text style={s.loadingText}>Loading {target.title}…</Text>
          </View>
        )}

        {hasError ? (
          <View style={s.errorState}>
            <Ionicons name="cloud-offline-outline" size={48} color={K.colors.textMuted} />
            <Text style={s.errorTitle}>Unable to load webpage</Text>
            <Text style={s.errorSub}>Please check your connection or open in browser.</Text>
            <TouchableOpacity style={s.backBtn} onPress={handleOpenExternal} activeOpacity={0.8}>
              <Text style={s.backBtnText}>Open in Browser</Text>
            </TouchableOpacity>
          </View>
        ) : Platform.OS === "web" ? (
          <iframe
            src={target.url}
            style={{ width: "100%", height: "100%", border: "none" }}
            onLoad={() => setIsLoading(false)}
          />
        ) : (
          <WebView
            source={{ uri: target.url }}
            style={{ flex: 1 }}
            onLoadStart={() => setIsLoading(true)}
            onLoadEnd={() => setIsLoading(false)}
            onError={() => {
              setIsLoading(false);
              setHasError(true);
            }}
            startInLoadingState={false}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: K.colors.bgApp },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: K.colors.border,
  },
  headerBack: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: K.colors.bgSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: K.colors.textDark,
    letterSpacing: -0.2,
  },
  headerSubtitle: {
    fontSize: 11,
    fontWeight: "500",
    color: K.colors.textMuted,
    marginTop: 1,
  },
  headerAction: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: K.colors.bgSubtle,
    alignItems: "center",
    justifyContent: "center",
  },

  // Content
  contentContainer: {
    flex: 1,
    position: "relative",
    backgroundColor: "#fff",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    zIndex: 10,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: "600",
    color: K.colors.textDark,
  },

  // Error state
  errorState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 32,
    backgroundColor: "#fff",
  },
  errorTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: K.colors.textDark,
  },
  errorSub: {
    fontSize: 13,
    color: K.colors.textMuted,
    textAlign: "center",
    lineHeight: 18,
  },
  backBtn: {
    backgroundColor: K.colors.darkGreen,
    borderRadius: K.radius.button,
    paddingHorizontal: 28,
    paddingVertical: 13,
    marginTop: 8,
  },
  backBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
