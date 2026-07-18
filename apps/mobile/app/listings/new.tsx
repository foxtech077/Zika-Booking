import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { listingApi } from "../../lib/listing-api";
import { K } from "../../constants/theme";

type Category = "hotel" | "apartment" | "car";

const CATEGORIES: Array<{
  key: Category;
  emoji: string;
  title: string;
  subtitle: string;
  flow: string;
  flowColor: string;
}> = [
  {
    key: "hotel",
    emoji: "🏨",
    title: "Hotel / Resort",
    subtitle: "Managed accommodation with services. Requires admin approval before going live.",
    flow: "Admin Review → Approved",
    flowColor: "#8B5CF6",
  },
  {
    key: "apartment",
    emoji: "🏠",
    title: "Home / Villa",
    subtitle: "Self-contained residential unit. Auto-activates once all required fields are complete.",
    flow: "Auto-activates",
    flowColor: K.colors.accent,
  },
  {
    key: "car",
    emoji: "🚗",
    title: "Car / Vehicle Rental",
    subtitle: "Car, van, or specialty vehicle. Auto-activates once all required fields are complete.",
    flow: "Auto-activates",
    flowColor: K.colors.accent,
  },
];

export default function NewListingScreen() {
  const [selected, setSelected] = useState<Category | null>(null);

  const createMut = useMutation({
    mutationFn: async (category: Category) => {
      const res = await listingApi.post<{ data: { id: string; category: string } }>(
        "/listings",
        { category }
      );
      return res.data.data;
    },
    onSuccess: (data) => {
      router.replace(`/listings/${data.category}?id=${data.id}` as any);
    },
    onError: () => {
      Alert.alert("Error", "Could not create listing. Please try again.");
    },
  });

  return (
    <View style={s.container}>
      <SafeAreaView edges={["top"]} style={s.header}>
        <View style={s.headerRow}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
            <Text style={s.backTxt}>‹</Text>
          </TouchableOpacity>
          <Text style={s.headerTitle}>New Listing</Text>
          <View style={{ width: 40 }} />
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        <Text style={s.title}>What type of{"\n"}property is it?</Text>
        <Text style={s.subtitle}>
          Select the category that best describes your listing.
        </Text>

        <View style={s.cards}>
          {CATEGORIES.map((c) => {
            const active = selected === c.key;
            return (
              <TouchableOpacity
                key={c.key}
                style={[s.optCard, active && s.optCardActive]}
                onPress={() => setSelected(c.key)}
                activeOpacity={0.85}
              >
                <View style={[s.optIcon, active && s.optIconActive]}>
                  <Text style={s.optEmoji}>{c.emoji}</Text>
                </View>
                <View style={s.optText}>
                  <Text style={[s.optTitle, active && s.optTitleActive]}>{c.title}</Text>
                  <Text style={s.optSub}>{c.subtitle}</Text>
                  <View style={[s.flowPill, { borderColor: c.flowColor + "40", backgroundColor: c.flowColor + "15" }]}>
                    <Text style={[s.flowText, { color: c.flowColor }]}>🔄 {c.flow}</Text>
                  </View>
                </View>
                <View style={[s.radio, active && s.radioActive]}>
                  {active && <View style={s.radioDot} />}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <SafeAreaView edges={["bottom"]} style={s.footer}>
        <TouchableOpacity
          style={[s.createBtn, (!selected || createMut.isPending) && s.createBtnDisabled]}
          onPress={() => selected && createMut.mutate(selected)}
          disabled={!selected || createMut.isPending}
          activeOpacity={0.85}
        >
          {createMut.isPending ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={s.createBtnText}>
              {selected
                ? `Continue with ${CATEGORIES.find((c) => c.key === selected)!.title.split(" / ")[0]}`
                : "Select a category to continue"}
            </Text>
          )}
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: K.colors.bgLight },

  header: { backgroundColor: K.colors.darkGreen },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  backTxt: { fontSize: 28, color: "#fff", fontWeight: "300" },
  headerTitle: { fontSize: K.font.lg, fontWeight: "800", color: "#fff" },

  body: { padding: 24, paddingBottom: 32 },
  title: {
    fontSize: K.font.xxl,
    fontWeight: "800",
    color: K.colors.textDark,
    lineHeight: 34,
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: K.font.sm,
    color: K.colors.textMuted,
    marginBottom: 28,
    lineHeight: 20,
  },
  cards: { gap: 14 },

  optCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    backgroundColor: K.colors.bgCard,
    borderRadius: K.radius.xl,
    padding: 16,
    borderWidth: 2,
    borderColor: K.colors.border,
    ...K.shadow.sm,
  },
  optCardActive: { borderColor: K.colors.accent, backgroundColor: "#F0FFF8" },
  optIcon: {
    width: 54,
    height: 54,
    borderRadius: K.radius.lg,
    backgroundColor: K.colors.bgLight,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  optIconActive: { backgroundColor: K.colors.accentDim },
  optEmoji: { fontSize: 28 },

  optText: { flex: 1 },
  optTitle: { fontSize: K.font.base, fontWeight: "700", color: K.colors.textDark, marginBottom: 4 },
  optTitleActive: { color: K.colors.darkGreen },
  optSub: { fontSize: K.font.xs, color: K.colors.textMuted, lineHeight: 16, marginBottom: 8 },

  flowPill: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: K.radius.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  flowText: { fontSize: 10, fontWeight: "700" },

  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: K.colors.border,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 4,
  },
  radioActive: { borderColor: K.colors.accent },
  radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: K.colors.accent },

  footer: {
    paddingHorizontal: 24,
    paddingTop: 12,
    backgroundColor: K.colors.bgCard,
    borderTopWidth: 1,
    borderTopColor: K.colors.border,
  },
  createBtn: {
    backgroundColor: K.colors.accent,
    borderRadius: K.radius.lg,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  createBtnDisabled: { opacity: 0.45 },
  createBtnText: { color: "#fff", fontSize: K.font.base, fontWeight: "700", letterSpacing: 0.3 },
});
