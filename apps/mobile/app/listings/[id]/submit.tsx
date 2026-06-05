import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { listingApi } from "../../../lib/listing-api";

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
          ? "Your car rental is now visible to guests on ZikaBooking."
          : "Your apartment is now visible to guests on ZikaBooking.";
        Alert.alert(
          titleMsg,
          bodyMsg,
          [{ text: "View my listings", onPress: () => router.replace("/listings") }]
        );
      } else {
        Alert.alert(
          "Submitted!",
          "Your listing has been submitted for review. We'll notify you within 48 hours.",
          [{ text: "OK", onPress: () => router.replace("/listings") }]
        );
      }
    },
    onError: (err: unknown) => {
      const errData = (err as any)?.response?.data?.error;
      const msg = errData?.message ?? (isAutoActivate ? "Activation failed." : "Submission failed.");
      const failures: string[] = errData?.details?.failures ?? [];
      Alert.alert(
        isAutoActivate ? "Cannot activate" : "Submission failed",
        failures.length > 0 ? failures.join("\n") : msg
      );
    },
  });

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#1a73e8" /></View>;
  }
  if (!listing) return null;

  const photoCount = (listing.photos ?? []).length;
  const docTypes = (listing.documents ?? []).map((d: any) => d.documentType);

  const apartmentChecklist = [
    { label: "Property name", ok: !!listing.name },
    { label: "Address (geocoded)", ok: !!listing.address && !!listing.lat && !!listing.lng },
    { label: "Price & currency", ok: !!listing.pricePerNight && !!listing.currency },
    { label: "Cancellation policy", ok: !!listing.cancellationPolicy },
    { label: "Max guests (≥ 1)", ok: !!listing.maxGuests && listing.maxGuests >= 1 },
    { label: `At least 3 photos (${photoCount} uploaded)`, ok: photoCount >= 3 },
  ];

  const hotelChecklist = [
    { label: "Property name", ok: !!listing.name },
    { label: "Room type", ok: !!listing.roomType },
    { label: "Number of units", ok: !!listing.unitCount },
    { label: "Price & currency", ok: !!listing.pricePerNight && !!listing.currency },
    { label: "Address (geocoded)", ok: !!listing.address && !!listing.lat && !!listing.lng },
    { label: "Cancellation policy", ok: !!listing.cancellationPolicy },
    { label: "At least 1 photo", ok: photoCount > 0 },
    { label: "Business licence", ok: docTypes.includes("business_licence") },
    { label: "Hotel operating permit", ok: docTypes.includes("operating_permit") },
    { label: "Tourism authority certificate", ok: docTypes.includes("tourism_certificate") },
  ];

  const carChecklist = [
    { label: "Car make and model", ok: !!listing.carMake && !!listing.carModel },
    { label: "Year of manufacture", ok: !!listing.carYear },
    { label: "Daily rate & currency", ok: !!listing.pricePerNight && !!listing.currency },
    { label: "Minimum driver age", ok: !!listing.minDriverAge },
    { label: "Address (geocoded)", ok: !!listing.address && !!listing.lat && !!listing.lng },
    { label: "Cancellation policy", ok: !!listing.cancellationPolicy },
    { label: "At least 1 photo", ok: photoCount > 0 },
  ];

  const checklist = isCar ? carChecklist : isApartment ? apartmentChecklist : hotelChecklist;

  const allOk = checklist.every((c) => c.ok);

  const submitLabel = isAutoActivate
    ? "Submit & Go Live"
    : (listing.status === "rejected" ? "Resubmit for Review" : "Submit for Review");

  const confirmTitle = isAutoActivate ? "Go live?" : "Submit for Review?";
  const confirmMsg = isCar
    ? "Your vehicle will go live immediately. Guests will be able to find and book it right away."
    : isApartment
    ? "Your apartment will go live immediately. Guests will be able to find and book it right away."
    : "Once submitted, you won't be able to edit this listing until the review is complete. Submit now?";

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>

        <Text style={styles.title}>
          {isCar ? "Review & Go Live" : isApartment ? "Review & Go Live" : "Review & Submit"}
        </Text>
        <Text style={styles.subtitle}>
          {isCar
            ? "Your vehicle will activate instantly once all requirements are met."
            : isApartment
            ? "Your apartment will activate instantly once all requirements are met."
            : "Check all requirements before submitting for admin review."}
        </Text>

        {/* Listing summary */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Listing summary</Text>
          <Row label="Name" value={listing.name ?? "—"} />
          <Row label="Category" value={listing.category} />
          {isCar ? (
            <>
              <Row label="Make & model" value={[listing.carMake, listing.carModel].filter(Boolean).join(" ") || "—"} />
              <Row label="Year" value={listing.carYear?.toString() ?? "—"} />
              <Row label="Body type" value={listing.bodyType ?? "—"} />
              <Row label="Transmission" value={listing.transmission ?? "—"} />
              <Row label="Seats" value={listing.seats?.toString() ?? "—"} />
              <Row label="Min driver age" value={listing.minDriverAge ? `${listing.minDriverAge} years` : "—"} />
            </>
          ) : isApartment ? (
            <>
              <Row label="Bedrooms" value={listing.bedrooms === 0 ? "Studio" : (listing.bedrooms?.toString() ?? "—")} />
              <Row label="Bathrooms" value={listing.bathrooms?.toString() ?? "—"} />
              <Row label="Max guests" value={listing.maxGuests?.toString() ?? "—"} />
              {listing.longStayEnabled && (
                <Row
                  label="Long-stay discount"
                  value={`${listing.longStayDiscountValue}${listing.longStayDiscountType === "percentage" ? "%" : ""} on ${listing.longStayMinNights}+ nights`}
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
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            {isAutoActivate ? "Activation requirements" : "Submission requirements"}
          </Text>
          {checklist.map((item) => (
            <View key={item.label} style={styles.checkRow}>
              <Text style={item.ok ? styles.checkOk : styles.checkFail}>{item.ok ? "✓" : "✗"}</Text>
              <Text style={[styles.checkLabel, !item.ok && styles.checkLabelFail]}>{item.label}</Text>
            </View>
          ))}
        </View>

        {/* Hotel rejection history */}
        {!isAutoActivate && listing.status === "rejected" && (listing.rejectionReasons?.length > 0 || listing.rejectionNote) && (
          <View style={styles.rejectionCard}>
            <Text style={styles.rejectionTitle}>Previous rejection feedback</Text>
            {listing.rejectionReasons?.length > 0 && (
              <Text style={styles.rejectionReasons}>{(listing.rejectionReasons ?? []).join(", ")}</Text>
            )}
            {listing.rejectionNote && <Text style={styles.rejectionNote}>{listing.rejectionNote}</Text>}
          </View>
        )}

        {!allOk && (
          <Text style={styles.warningNote}>
            Complete all requirements above before {isAutoActivate ? "activating" : "submitting"}. Tap "Edit Listing" to fill in missing details.
          </Text>
        )}

        <TouchableOpacity
          style={[styles.submitBtn, (!allOk || actionMutation.isPending) && styles.submitBtnDisabled]}
          onPress={() => {
            if (!allOk) return;
            Alert.alert(confirmTitle, confirmMsg, [
              { text: "Cancel", style: "cancel" },
              { text: isAutoActivate ? "Go Live" : "Submit", onPress: () => actionMutation.mutate() },
            ]);
          }}
          disabled={!allOk || actionMutation.isPending}
        >
          {actionMutation.isPending
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={styles.submitBtnText}>{submitLabel}</Text>}
        </TouchableOpacity>

        <TouchableOpacity style={styles.editBtn} onPress={() => router.back()}>
          <Text style={styles.editBtnText}>← Edit Listing</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: "700", color: "#111827", marginBottom: 6 },
  subtitle: { fontSize: 14, color: "#6b7280", marginBottom: 20, lineHeight: 20 },
  card: { backgroundColor: "#fff", borderRadius: 12, padding: 16, borderWidth: 1, borderColor: "#e5e7eb", marginBottom: 16 },
  sectionTitle: { fontSize: 15, fontWeight: "600", color: "#111827", marginBottom: 12 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  rowLabel: { fontSize: 14, color: "#6b7280", flex: 1 },
  rowValue: { fontSize: 14, color: "#111827", fontWeight: "500", flex: 1, textAlign: "right" },
  checkRow: { flexDirection: "row", alignItems: "center", paddingVertical: 6 },
  checkOk: { fontSize: 15, color: "#16a34a", width: 24, fontWeight: "700" },
  checkFail: { fontSize: 15, color: "#dc2626", width: 24, fontWeight: "700" },
  checkLabel: { fontSize: 14, color: "#374151" },
  checkLabelFail: { color: "#dc2626" },
  rejectionCard: { backgroundColor: "#fef2f2", borderRadius: 12, padding: 16, borderWidth: 1, borderColor: "#fca5a5", marginBottom: 16 },
  rejectionTitle: { fontSize: 14, fontWeight: "600", color: "#991b1b", marginBottom: 6 },
  rejectionReasons: { fontSize: 13, color: "#7f1d1d", marginBottom: 4 },
  rejectionNote: { fontSize: 13, color: "#7f1d1d" },
  warningNote: { fontSize: 13, color: "#d97706", marginBottom: 16, lineHeight: 18 },
  submitBtn: { backgroundColor: "#1a73e8", borderRadius: 12, paddingVertical: 16, alignItems: "center", marginBottom: 12 },
  submitBtnDisabled: { backgroundColor: "#93c5fd" },
  submitBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  editBtn: { alignItems: "center", paddingVertical: 12 },
  editBtnText: { color: "#1a73e8", fontWeight: "500", fontSize: 15 },
});
