import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";
import { listingApi } from "../../../lib/listing-api";
import { K } from "../../../constants/theme";

export default function SubmitListingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const { data: listing, isLoading } = useQuery({
    queryKey: ["listing-submit", id],
    queryFn: async () => {
      const res = await listingApi.get<{ data: any }>(`/listings/${id}`);
      return res.data.data;
    },
    enabled: !!id,
  });

  const category: "hotel" | "apartment" | "car" = listing?.category ?? "hotel";
  const isApartment = category === "apartment";
  const isCar = category === "car";
  const isAutoActivate = isApartment || isCar;

  const actionMutation = useMutation({
    mutationFn: async () => {
      const endpoint = isAutoActivate ? `/listings/${id}/activate` : `/listings/${id}/submit`;
      await listingApi.post(endpoint);
    },
    onSuccess: () => {
      if (isAutoActivate) {
        const titleMsg = isCar ? "Your vehicle is live!" : "You're live!";
        const bodyMsg = isCar
          ? "Your car rental is now visible to guests."
          : "Your apartment is now visible to guests.";
        Alert.alert(titleMsg, bodyMsg, [
          { text: "View my listings", onPress: () => router.replace("/listings" as any) },
        ]);
      } else {
        Alert.alert(
          "Submitted!",
          "Your listing has been submitted for review. We'll notify you within 48 hours.",
          [{ text: "OK", onPress: () => router.replace("/listings" as any) }]
        );
      }
    },
    onError: (err: unknown) => {
      const errData = (err as any)?.response?.data?.error;
      const msg = errData?.message ?? (isAutoActivate ? "Activation failed. Please check all required fields." : "Submission failed. Please try again.");
      const failures: string[] = errData?.details?.failures ?? [];
      Alert.alert(
        isAutoActivate ? "Cannot activate" : "Submission failed",
        failures.length > 0 ? failures.join("\n") : msg
      );
    },
  });

  if (isLoading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={K.colors.accent} />
      </View>
    );
  }
  if (!listing) return null;

  const photoCount = (listing.photos ?? []).length;
  const docTypes = (listing.documents ?? []).map((d: any) => d.documentType);

  // Location is stored as plain text (address + town + country). No geocoding.
  const apartmentChecklist = [
    { label: "Apartment name", ok: !!listing.name },
    { label: "Address & town", ok: !!listing.address && !!listing.town },
    { label: "Country", ok: !!listing.country },
    { label: "Price & currency", ok: !!listing.pricePerNight && !!listing.currency },
    { label: "Cancellation policy", ok: !!listing.cancellationPolicy },
    { label: "Max guests (≥ 1)", ok: !!listing.maxGuests && listing.maxGuests >= 1 },
    { label: `At least 3 photos (${photoCount} uploaded)`, ok: photoCount >= 3 },
  ];

  const hotelChecklist = [
    { label: "Hotel name", ok: !!listing.name },
    { label: "Room type", ok: !!listing.roomType },
    { label: "Number of units (≥ 1)", ok: !!listing.unitCount && listing.unitCount >= 1 },
    { label: "Price & currency", ok: !!listing.pricePerNight && !!listing.currency },
    { label: "Address & town", ok: !!listing.address && !!listing.town },
    { label: "Country", ok: !!listing.country },
    { label: "Cancellation policy", ok: !!listing.cancellationPolicy },
    { label: "At least 1 photo", ok: photoCount > 0 },
    { label: "Business licence", ok: docTypes.includes("business_licence") },
    { label: "Hotel operating permit", ok: docTypes.includes("operating_permit") },
    { label: "Tourism authority certificate", ok: docTypes.includes("tourism_certificate") },
  ];

  const carChecklist = [
    { label: "Listing title", ok: !!listing.name },
    { label: "Car make and model", ok: !!listing.carMake && !!listing.carModel },
    { label: "Year of manufacture", ok: !!listing.carYear },
    { label: "Vehicle category", ok: !!listing.carCategory },
    { label: "Daily rate & currency", ok: !!listing.pricePerDay && !!listing.currency },
    { label: "Minimum driver age", ok: !!listing.minimumDriverAge },
    { label: "Insurance type", ok: !!listing.insuranceType },
    { label: "Address & town", ok: !!listing.address && !!listing.town },
    { label: "Country", ok: !!listing.country },
    { label: "Cancellation policy", ok: !!listing.cancellationPolicy },
    { label: "Vehicle registration doc", ok: docTypes.includes("vehicle_registration") },
    { label: "Insurance certificate", ok: docTypes.includes("insurance_certificate") },
    { label: "At least 1 photo", ok: photoCount > 0 },
  ];

  const checklist = isCar ? carChecklist : isApartment ? apartmentChecklist : hotelChecklist;
  const allOk = checklist.every((c) => c.ok);

  const submitLabel = isAutoActivate
    ? "Submit & Go Live"
    : listing.status === "rejected"
    ? "Resubmit for Review"
    : "Submit for Review";

  const confirmTitle = isAutoActivate ? "Go live?" : "Submit for Review?";
  const confirmMsg = isCar
    ? "Your vehicle will go live immediately. Guests will be able to find and book it right away."
    : isApartment
    ? "Your apartment will go live immediately. Guests will be able to find and book it right away."
    : "Once submitted, you won't be able to edit this listing until the review is complete. Submit now?";

  return (
    <SafeAreaView style={s.container}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>

        <Text style={s.title}>
          {isCar || isApartment ? "Review & Go Live" : "Review & Submit"}
        </Text>
        <Text style={s.subtitle}>
          {isCar || isApartment
            ? "Your listing will activate instantly once all requirements are met."
            : "Check all requirements before submitting for admin review."}
        </Text>

        {/* Listing summary */}
        <View style={s.card}>
          <Text style={s.sectionTitle}>Listing summary</Text>
          <Row label="Name" value={listing.name ?? "—"} />
          <Row label="Category" value={listing.category} />
          {isCar ? (
            <>
              <Row label="Make & model" value={[listing.carMake, listing.carModel].filter(Boolean).join(" ") || "—"} />
              <Row label="Year" value={listing.carYear?.toString() ?? "—"} />
              <Row label="Body type" value={listing.bodyType ?? "—"} />
              <Row label="Transmission" value={listing.transmission ?? "—"} />
              <Row label="Seats" value={listing.seats?.toString() ?? "—"} />
              <Row label="Min driver age" value={listing.minimumDriverAge ? `${listing.minimumDriverAge} years` : "—"} />
            </>
          ) : isApartment ? (
            <>
              <Row label="Bedrooms" value={listing.bedrooms === 0 ? "Studio" : (listing.bedrooms?.toString() ?? "—")} />
              <Row label="Bathrooms" value={listing.bathrooms?.toString() ?? "—"} />
              <Row label="Max guests" value={listing.maxGuests?.toString() ?? "—"} />
              {listing.longStayEnabled && (
                <Row
                  label="Long-stay discount"
                  value={`${listing.longStayDiscountValue}${listing.longStayDiscountType === "percentage" ? "%" : ""} on ${listing.longStayMinNights ?? "?"}+ nights`}
                />
              )}
            </>
          ) : (
            <>
              <Row label="Room type" value={listing.roomType ?? "—"} />
              <Row label="Units" value={listing.unitCount?.toString() ?? "—"} />
            </>
          )}
          <Row
            label={isCar ? "Daily rate" : "Price / night"}
            value={listing.pricePerNight ? `${listing.currency} ${listing.pricePerNight}` : "—"}
          />
          <Row label="Location" value={[listing.town, listing.country].filter(Boolean).join(", ") || "—"} />
          <Row label="Photos" value={`${photoCount} uploaded`} />
        </View>

        {/* Requirements checklist */}
        <View style={s.card}>
          <Text style={s.sectionTitle}>
            {isAutoActivate ? "Activation requirements" : "Submission requirements"}
          </Text>
          {checklist.map((item) => (
            <View key={item.label} style={s.checkRow}>
              <Feather
                name={item.ok ? "check-circle" : "x-circle"}
                size={16}
                color={item.ok ? K.colors.accent : K.colors.error}
              />
              <Text style={[s.checkLabel, !item.ok && s.checkLabelFail]}>{item.label}</Text>
            </View>
          ))}
        </View>

        {/* Hotel rejection history */}
        {!isAutoActivate &&
          listing.status === "rejected" &&
          (listing.rejectionReasons?.length > 0 || listing.rejectionNote) && (
            <View style={s.rejectionCard}>
              <Feather name="alert-triangle" size={16} color={K.colors.error} />
              <View style={{ flex: 1 }}>
                <Text style={s.rejectionTitle}>Previous rejection feedback</Text>
                {listing.rejectionReasons?.length > 0 && (
                  <Text style={s.rejectionBody}>{(listing.rejectionReasons ?? []).join(", ")}</Text>
                )}
                {listing.rejectionNote && <Text style={s.rejectionBody}>{listing.rejectionNote}</Text>}
              </View>
            </View>
          )}

        {!allOk && (
          <View style={s.warningBanner}>
            <Feather name="alert-circle" size={15} color="#92400E" />
            <Text style={s.warningText}>
              Complete all requirements above before {isAutoActivate ? "activating" : "submitting"}.
              Tap "Edit Listing" below to fill in any missing details.
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={[s.submitBtn, (!allOk || actionMutation.isPending) && s.submitBtnDisabled]}
          onPress={() => {
            if (!allOk) return;
            Alert.alert(confirmTitle, confirmMsg, [
              { text: "Cancel", style: "cancel" },
              { text: isAutoActivate ? "Go Live" : "Submit", onPress: () => actionMutation.mutate() },
            ]);
          }}
          disabled={!allOk || actionMutation.isPending}
          activeOpacity={0.85}
        >
          {actionMutation.isPending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <View style={s.submitBtnInner}>
              <Text style={s.submitBtnText}>{submitLabel}</Text>
              <Feather name={isAutoActivate ? "zap" : "send"} size={17} color="#fff" />
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={s.editBtn} onPress={() => router.back()} activeOpacity={0.8}>
          <Feather name="edit-2" size={15} color={K.colors.accent} />
          <Text style={s.editBtnText}>Edit Listing</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={s.rowValue}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: K.colors.bgLight },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: K.colors.bgLight },
  scroll: { padding: 20, paddingBottom: 40 },

  title: { fontSize: K.font.xxl, fontWeight: "800", color: K.colors.textDark, marginBottom: 6, letterSpacing: -0.3 },
  subtitle: { fontSize: K.font.sm, color: K.colors.textMuted, marginBottom: 22, lineHeight: 20 },

  card: {
    backgroundColor: K.colors.bgCard,
    borderRadius: K.radius.xl,
    padding: 18,
    borderWidth: 1.5,
    borderColor: K.colors.border,
    marginBottom: 16,
    ...K.shadow.sm,
  },
  sectionTitle: { fontSize: 10, fontWeight: "800", color: K.colors.textMuted, letterSpacing: 1, textTransform: "uppercase", marginBottom: 14 },

  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: K.colors.border },
  rowLabel: { fontSize: K.font.sm, color: K.colors.textMuted, flex: 1 },
  rowValue: { fontSize: K.font.sm, color: K.colors.textDark, fontWeight: "600", flex: 1, textAlign: "right" },

  checkRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: K.colors.border },
  checkLabel: { fontSize: K.font.sm, color: K.colors.textMid, flex: 1, fontWeight: "500" },
  checkLabelFail: { color: K.colors.error },

  rejectionCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#FEF2F2",
    borderRadius: K.radius.lg,
    padding: 14,
    borderWidth: 1,
    borderColor: "#FECACA",
    marginBottom: 16,
  },
  rejectionTitle: { fontSize: K.font.sm, fontWeight: "700", color: K.colors.error, marginBottom: 4 },
  rejectionBody: { fontSize: K.font.xs, color: "#7f1d1d", lineHeight: 18 },

  warningBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#FFFBEB",
    borderRadius: K.radius.md,
    padding: 12,
    borderWidth: 1,
    borderColor: "#FDE68A",
    marginBottom: 18,
  },
  warningText: { flex: 1, fontSize: K.font.xs, color: "#92400E", fontWeight: "600", lineHeight: 18 },

  submitBtn: {
    backgroundColor: K.colors.darkGreen,
    borderRadius: K.radius.lg,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 12,
    ...K.shadow.md,
  },
  submitBtnDisabled: { opacity: 0.45 },
  submitBtnInner: { flexDirection: "row", alignItems: "center", gap: 8 },
  submitBtnText: { color: "#fff", fontWeight: "700", fontSize: K.font.base },

  editBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12 },
  editBtnText: { color: K.colors.accent, fontWeight: "600", fontSize: K.font.sm },
});
