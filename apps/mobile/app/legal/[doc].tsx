import { useEffect, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { K } from "../../constants/theme";
import { TERMS_OF_USE, PRIVACY_POLICY, type LegalDocument } from "../../constants/legalContent";

// ── Document resolver ─────────────────────────────────────────────────────────

function resolveDocument(doc: string): LegalDocument | null {
  if (doc === "terms")   return TERMS_OF_USE;
  if (doc === "privacy") return PRIVACY_POLICY;
  return null;
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function LegalDocumentScreen() {
  const { doc } = useLocalSearchParams<{ doc: string }>();
  const document = resolveDocument(doc ?? "");

  const fadeIn = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeIn, {
      toValue: 1,
      duration: 260,
      useNativeDriver: true,
    }).start();
  }, []);

  if (!document) {
    return (
      <SafeAreaView style={s.container} edges={["top", "bottom"]}>
        <View style={s.errorState}>
          <Ionicons name="document-outline" size={52} color={K.colors.textMuted} />
          <Text style={s.errorTitle}>Document not found</Text>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
            <Text style={s.backBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container} edges={["top", "bottom"]}>
      {/* ── Header ── */}
      <View style={s.header}>
        <TouchableOpacity style={s.headerBack} onPress={() => router.back()} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={20} color={K.colors.darkGreen} />
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle} numberOfLines={1}>{document.title}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* ── Content ── */}
      <Animated.ScrollView
        style={[s.scroll, { opacity: fadeIn }]}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Title card */}
        <View style={s.titleCard}>
          <View style={s.titleIconWrap}>
            <Ionicons
              name={doc === "privacy" ? "shield-checkmark-outline" : "document-text-outline"}
              size={28}
              color="#fff"
            />
          </View>
          <Text style={s.titleCardHeading}>{document.title}</Text>
          <Text style={s.titleCardUpdated}>Last updated: {document.lastUpdated}</Text>
        </View>

        {/* Introduction */}
        <View style={s.introBox}>
          <Ionicons name="information-circle-outline" size={16} color={K.colors.accent} style={{ marginTop: 2 }} />
          <Text style={s.introText}>{document.intro}</Text>
        </View>

        {/* Sections */}
        {document.sections.map((section, index) => (
          <View key={index} style={s.section}>
            <View style={s.sectionHeadingRow}>
              <View style={s.sectionNumber}>
                <Text style={s.sectionNumberText}>{index + 1}</Text>
              </View>
              <Text style={s.sectionHeading}>{section.heading.replace(/^\d+\.\s*/, "")}</Text>
            </View>
            <Text style={s.sectionBody}>{section.body}</Text>
          </View>
        ))}

        {/* Footer */}
        <View style={s.footer}>
          <Ionicons name="lock-closed-outline" size={14} color={K.colors.textMuted} />
          <Text style={s.footerText}>
            This document is part of your agreement with Kainook Ltd.
          </Text>
        </View>

        <View style={{ height: 32 }} />
      </Animated.ScrollView>
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
    paddingVertical: 13,
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

  // Scroll
  scroll:        { flex: 1 },
  scrollContent: { padding: 16, gap: 12 },

  // Title card
  titleCard: {
    backgroundColor: K.colors.darkGreen,
    borderRadius: K.radius.xl,
    padding: 24,
    alignItems: "center",
    gap: 10,
    ...K.shadow.brand,
  },
  titleIconWrap: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.25)",
    marginBottom: 4,
  },
  titleCardHeading: {
    fontSize: 22,
    fontWeight: "800",
    color: "#fff",
    textAlign: "center",
    letterSpacing: -0.4,
  },
  titleCardUpdated: {
    fontSize: 12,
    color: "rgba(255,255,255,0.6)",
    fontWeight: "500",
  },

  // Intro box
  introBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: K.colors.accentDim,
    borderRadius: K.radius.lg,
    padding: 16,
    borderWidth: 1,
    borderColor: K.colors.accent + "30",
  },
  introText: {
    flex: 1,
    fontSize: 14,
    color: K.colors.textMid,
    lineHeight: 22,
    fontStyle: "italic",
  },

  // Section
  section: {
    backgroundColor: "#fff",
    borderRadius: K.radius.lg,
    padding: 18,
    borderWidth: 1,
    borderColor: K.colors.border,
    ...K.shadow.xs,
  },
  sectionHeadingRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 12,
  },
  sectionNumber: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: K.colors.darkGreen,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 1,
  },
  sectionNumberText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#fff",
  },
  sectionHeading: {
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    color: K.colors.textDark,
    lineHeight: 22,
    letterSpacing: -0.2,
  },
  sectionBody: {
    fontSize: 14,
    color: K.colors.textMid,
    lineHeight: 23,
    paddingLeft: 38,
  },

  // Footer
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderTopWidth: 1,
    borderTopColor: K.colors.border,
    marginTop: 4,
  },
  footerText: {
    flex: 1,
    fontSize: 12,
    color: K.colors.textMuted,
    lineHeight: 18,
  },

  // Error state
  errorState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    padding: 32,
  },
  errorTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: K.colors.textDark,
  },
  backBtn: {
    backgroundColor: K.colors.darkGreen,
    borderRadius: K.radius.button,
    paddingHorizontal: 28,
    paddingVertical: 13,
  },
  backBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
