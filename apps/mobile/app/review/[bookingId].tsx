import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { listingApi } from "../../lib/listing-api";
import { K } from "../../constants/theme";

// ── Types ─────────────────────────────────────────────────────────────────────

interface BookingMeta {
  reference: string;
  listing: { title: string };
}

// ── Star Selector ─────────────────────────────────────────────────────────────

function StarSelector({ rating, onChange }: { rating: number; onChange: (r: number) => void }) {
  return (
    <View style={styles.starsRow}>
      {[1, 2, 3, 4, 5].map((star) => (
        <TouchableOpacity key={star} onPress={() => onChange(star)} activeOpacity={0.7}>
          <Ionicons
            name={star <= rating ? "star" : "star-outline"}
            size={38}
            color={star <= rating ? "#fbbf24" : "#d1d5db"}
            style={styles.starIcon}
          />
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function ReviewScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const router = useRouter();

  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitted, setSubmitted] = useState(false);

  // Fetch booking meta for listing name + reference
  const { data: bookingMeta, isLoading: metaLoading, isError: metaError } = useQuery<BookingMeta>({
    queryKey: ["bookingMeta", bookingId],
    queryFn: async () => {
      const res = await listingApi.get<{ data: BookingMeta }>(`/guests/me/bookings/${bookingId}`);
      return res.data.data;
    },
    enabled: !!bookingId,
    retry: 1,
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      await listingApi.post("/reviews", {
        bookingId,
        rating,
        ...(title.trim() ? { title: title.trim() } : {}),
        ...(body.trim() ? { body: body.trim() } : {}),
      });
    },
    onSuccess: () => {
      setSubmitted(true);
    },
    onError: (err: any) => {
      const message =
        err?.response?.data?.message ?? err?.message ?? "Could not submit review.";
      Alert.alert("Submission failed", message);
    },
  });

  function handleSubmit() {
    if (rating === 0) {
      Alert.alert("Rating required", "Please select a star rating before submitting.");
      return;
    }
    submitMutation.mutate();
  }

  // ── Loading / error states ────────────────────────────────────────────────
  if (metaLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={K.colors.accent} />
        </View>
      </SafeAreaView>
    );
  }

  if (metaError) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={56} color="#dc2626" />
          <Text style={styles.errorTitle}>Could not load booking</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => router.back()}>
            <Text style={styles.primaryBtnText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ── Success state ──────────────────────────────────────────────────────────
  if (submitted) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.successContainer}>
          <Ionicons name="checkmark-circle" size={72} color="#16a34a" />
          <Text style={styles.successTitle}>Review Submitted!</Text>
          <Text style={styles.successSubtitle}>
            Thank you for sharing your experience.
          </Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => router.back()}>
            <Text style={styles.primaryBtnText}>Back to Booking</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* Listing / reference info */}
        {bookingMeta && (
          <View style={styles.metaCard}>
            <Text style={styles.metaListing} numberOfLines={2}>
              {bookingMeta.listing?.title ?? "Your stay"}
            </Text>
            <Text style={styles.metaRef}>{bookingMeta.reference}</Text>
          </View>
        )}

        {/* Rating */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Your rating *</Text>
          <StarSelector rating={rating} onChange={setRating} />
          {rating > 0 && (
            <Text style={styles.ratingHint}>
              {["", "Poor", "Fair", "Good", "Very Good", "Excellent"][rating]}
            </Text>
          )}
        </View>

        {/* Title */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Title (optional, {title.length}/100)</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={(t) => setTitle(t.slice(0, 100))}
            placeholder="Summarise your experience"
            maxLength={100}
          />
        </View>

        {/* Body */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Review (optional, {body.length}/500)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={body}
            onChangeText={(t) => setBody(t.slice(0, 500))}
            placeholder="Tell others about your stay..."
            multiline
            numberOfLines={5}
            maxLength={500}
            textAlignVertical="top"
          />
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[styles.primaryBtn, (rating === 0 || submitMutation.isPending) && styles.primaryBtnDisabled]}
          onPress={handleSubmit}
          disabled={rating === 0 || submitMutation.isPending}
        >
          {submitMutation.isPending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.primaryBtnText}>Submit Review</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => router.back()}
          disabled={submitMutation.isPending}
        >
          <Text style={styles.secondaryBtnText}>Cancel</Text>
        </TouchableOpacity>

      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  scroll: { padding: 20, paddingBottom: 40 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 16 },
  errorTitle: { fontSize: 18, fontWeight: "700", color: "#111827", textAlign: "center" },

  // Meta card
  metaCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: 20,
  },
  metaListing: { fontSize: 17, fontWeight: "700", color: "#111827", marginBottom: 4 },
  metaRef: { fontSize: 12, color: "#6b7280", fontFamily: "monospace" },

  // Section
  section: { marginBottom: 20 },
  sectionLabel: { fontSize: 14, fontWeight: "600", color: "#374151", marginBottom: 10 },

  // Stars
  starsRow: { flexDirection: "row", alignItems: "center" },
  starIcon: { marginRight: 4 },
  ratingHint: { fontSize: 14, color: "#6b7280", marginTop: 8, fontWeight: "500" },

  // Inputs
  input: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    backgroundColor: "#fff",
    color: "#111827",
  },
  textArea: { minHeight: 120 },

  // Buttons
  primaryBtn: {
    backgroundColor: K.colors.accent,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 12,
  },
  primaryBtnDisabled: { opacity: 0.45 },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  secondaryBtnText: { color: "#374151", fontWeight: "600", fontSize: 15 },

  // Success
  successContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 16,
  },
  successTitle: { fontSize: 24, fontWeight: "800", color: "#111827", textAlign: "center" },
  successSubtitle: { fontSize: 15, color: "#6b7280", textAlign: "center", lineHeight: 22 },
});
