import { View, Text, ScrollView, TouchableOpacity, Image, ActivityIndicator, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { listingApi } from "../../../lib/listing-api";
import { K } from "../../../constants/theme";

export default function ListingSuccessScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const { data: listing, isLoading } = useQuery({
    queryKey: ["listing-success", id],
    queryFn: async () => {
      const res = await listingApi.get<{ data: any }>(`/listings/${id}`);
      return res.data.data;
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={K.colors.accent} />
      </View>
    );
  }
  if (!listing) return null;

  const category: "hotel" | "apartment" | "car" = listing.category ?? "hotel";
  const isHotel = category === "hotel";
  const coverUrl = listing.photos?.[0]?.cdnUrl ?? null;
  const shortId = typeof listing.id === "string" ? listing.id.slice(0, 8).toUpperCase() : "";

  return (
    <SafeAreaView style={s.container}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.checkWrap}>
          <Feather name="check" size={40} color="#fff" />
        </View>

        <Text style={s.title}>Property submitted successfully.</Text>
        <Text style={s.subtitle}>
          Your listing has been processed and is now being managed by our system.
        </Text>

        {/* Hotels path */}
        <View style={[s.pathCard, isHotel && s.pathCardActive]}>
          <View style={s.pathHeader}>
            <View style={[s.pathIconWrap, { backgroundColor: K.colors.bgTint }]}>
              <Feather name="home" size={16} color={K.colors.darkGreen} />
            </View>
            <Text style={s.pathHeaderText}>Hotels</Text>
          </View>
          <Text style={s.pathTitle}>Pending Review</Text>
          <Text style={s.pathBody}>
            Waiting for Admin Approval. This usually takes 2-4 business hours.
          </Text>
        </View>

        {/* Apartments & Cars path */}
        <View style={[s.pathCard, !isHotel && s.pathCardActive]}>
          <View style={s.pathHeader}>
            <View style={[s.pathIconWrap, { backgroundColor: K.colors.bgTint }]}>
              <Feather name="home" size={16} color={K.colors.darkGreen} />
            </View>
            <Text style={s.pathHeaderText}>Apartments &amp; Cars</Text>
          </View>
          <Text style={s.pathTitle}>Live Now</Text>
          <Text style={s.pathBody}>
            Published Immediately. Your property is visible to all potential clients.
          </Text>
        </View>

        {/* Listing summary */}
        <View style={s.summaryCard}>
          {coverUrl ? (
            <Image source={{ uri: coverUrl }} style={s.summaryThumb} resizeMode="cover" />
          ) : (
            <View style={[s.summaryThumb, s.summaryThumbFallback]}>
              <Feather name={category === "car" ? "truck" : "home"} size={20} color="#C7D9D1" />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <View style={s.summaryTag}>
              <Text style={s.summaryTagText}>New Listing</Text>
            </View>
            <Text style={s.summaryName} numberOfLines={1}>{listing.name ?? "Untitled listing"}</Text>
            {!!shortId && <Text style={s.summaryRef}>ID: {shortId}</Text>}
          </View>
        </View>

        <TouchableOpacity
          style={s.primaryBtn}
          onPress={() => router.replace("/listings/new" as any)}
          activeOpacity={0.85}
        >
          <Feather name="plus-circle" size={18} color="#fff" />
          <Text style={s.primaryBtnText}>Create Another Listing</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={s.secondaryBtn}
          onPress={() => router.replace("/(provider)/listings" as any)}
          activeOpacity={0.8}
        >
          <Text style={s.secondaryBtnText}>Back to Listings</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: K.colors.bgLight },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: K.colors.bgLight },
  scroll: { padding: 24, paddingTop: 40, alignItems: "center" },

  checkWrap: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: K.colors.darkGreen,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
    ...K.shadow.brand,
  },

  title: { fontSize: K.font.xxl, fontWeight: "800", color: K.colors.textDark, textAlign: "center", marginBottom: 10, letterSpacing: -0.3 },
  subtitle: { fontSize: K.font.sm, color: K.colors.textMuted, textAlign: "center", lineHeight: 20, marginBottom: 28 },

  pathCard: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: K.radius.xl,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1.5,
    borderColor: K.colors.border,
  },
  pathCardActive: {
    borderColor: K.colors.accent,
    backgroundColor: K.colors.bgTint,
  },
  pathHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  pathIconWrap: { width: 28, height: 28, borderRadius: K.radius.sm, alignItems: "center", justifyContent: "center" },
  pathHeaderText: { fontSize: K.font.sm, fontWeight: "700", color: K.colors.textMuted },
  pathTitle: { fontSize: K.font.lg, fontWeight: "800", color: K.colors.darkGreen, marginBottom: 4 },
  pathBody: { fontSize: K.font.sm, color: K.colors.textMuted, lineHeight: 19 },

  summaryCard: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#fff",
    borderRadius: K.radius.xl,
    padding: 12,
    marginTop: 6,
    marginBottom: 28,
    borderWidth: 1.5,
    borderColor: K.colors.border,
    ...K.shadow.sm,
  },
  summaryThumb: { width: 56, height: 56, borderRadius: K.radius.md },
  summaryThumbFallback: { backgroundColor: K.colors.bgSubtle, alignItems: "center", justifyContent: "center" },
  summaryTag: {
    alignSelf: "flex-start",
    backgroundColor: K.colors.bgTint,
    borderRadius: K.radius.full,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginBottom: 4,
  },
  summaryTagText: { fontSize: 10, fontWeight: "700", color: K.colors.darkGreen },
  summaryName: { fontSize: K.font.base, fontWeight: "700", color: K.colors.textDark },
  summaryRef: { fontSize: K.font.xs, color: K.colors.textMuted, marginTop: 2 },

  primaryBtn: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: K.colors.darkGreen,
    borderRadius: K.radius.lg,
    paddingVertical: 16,
    marginBottom: 12,
    ...K.shadow.md,
  },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: K.font.base },

  secondaryBtn: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: K.radius.lg,
    paddingVertical: 16,
    borderWidth: 1.5,
    borderColor: K.colors.border,
  },
  secondaryBtnText: { color: K.colors.darkGreen, fontWeight: "700", fontSize: K.font.base },
});
