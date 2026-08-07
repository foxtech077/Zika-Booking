import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Animated,
  StyleSheet,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { listingApi } from "../../lib/listing-api";
import { useSubmitReview, extractReviewErrorMessage } from "../../hooks/reviews";
import { ReviewForm } from "../../components/reviews/ReviewForm";
import { K } from "../../constants/theme";

// ── Types ─────────────────────────────────────────────────────────────────────

interface BookingMeta {
  reference: string;
  listing: { id: string; title: string };
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

  const submitMutation = useSubmitReview(bookingMeta?.listing.id);

  const successScale = useRef(new Animated.Value(0.6)).current;
  useEffect(() => {
    if (submitted) {
      Animated.spring(successScale, { toValue: 1, useNativeDriver: true, speed: 14, bounciness: 10 }).start();
    }
  }, [submitted, successScale]);

  function handleSubmit() {
    if (rating === 0) {
      Alert.alert("Rating required", "Please select a star rating before submitting.");
      return;
    }
    submitMutation.mutate(
      {
        bookingId: bookingId as string,
        rating,
        ...(title.trim() ? { title: title.trim() } : {}),
        ...(body.trim() ? { body: body.trim() } : {}),
      },
      {
        onSuccess: () => setSubmitted(true),
        onError: (err) => {
          Alert.alert("Submission Failed", extractReviewErrorMessage(err, "Could not submit your review. Please try again."));
        },
      },
    );
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
          <Ionicons name="alert-circle-outline" size={56} color={K.colors.error} />
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
          <Animated.View style={{ transform: [{ scale: successScale }] }}>
            <Ionicons name="checkmark-circle" size={80} color={K.colors.success} />
          </Animated.View>
          <Text style={styles.successTitle}>Review Submitted!</Text>
          <Text style={styles.successSubtitle}>Thank you for sharing your experience.</Text>
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
        {bookingMeta && (
          <View style={styles.metaCard}>
            <Text style={styles.metaListing} numberOfLines={2}>
              {bookingMeta.listing?.title ?? "Your stay"}
            </Text>
            <Text style={styles.metaRef}>{bookingMeta.reference}</Text>
          </View>
        )}

        <ReviewForm
          rating={rating}
          onRatingChange={setRating}
          title={title}
          onTitleChange={setTitle}
          body={body}
          onBodyChange={setBody}
        />

        <TouchableOpacity
          style={[styles.primaryBtn, styles.submitBtn, (rating === 0 || submitMutation.isPending) && styles.primaryBtnDisabled]}
          onPress={handleSubmit}
          disabled={rating === 0 || submitMutation.isPending}
        >
          {submitMutation.isPending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.primaryBtnText}>Submit Review</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.back()} disabled={submitMutation.isPending}>
          <Text style={styles.secondaryBtnText}>Cancel</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: K.colors.bgApp },
  scroll: { padding: 20, paddingBottom: 40 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 16 },
  errorTitle: { fontSize: 18, fontWeight: "700", color: K.colors.textDark, textAlign: "center" },

  metaCard: {
    backgroundColor: K.colors.bgCard,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: K.colors.border,
    marginBottom: 24,
  },
  metaListing: { fontSize: 17, fontWeight: "700", color: K.colors.textDark, marginBottom: 4 },
  metaRef: { fontSize: 12, color: K.colors.textMuted, fontFamily: "monospace" },

  submitBtn: { marginTop: 24 },
  primaryBtn: {
    backgroundColor: K.colors.darkGreen,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 12,
  },
  primaryBtnDisabled: { opacity: 0.45 },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: K.colors.border,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  secondaryBtnText: { color: K.colors.textMid, fontWeight: "600", fontSize: 15 },

  successContainer: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 16 },
  successTitle: { fontSize: 24, fontWeight: "800", color: K.colors.textDark, textAlign: "center" },
  successSubtitle: { fontSize: 15, color: K.colors.textMuted, textAlign: "center", lineHeight: 22 },
});
