import { useEffect, useRef } from "react";
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { listingApi } from "../../../lib/listing-api";
import { K } from "../../../constants/theme";

// Editing reuses the category wizards (hotel / apartment / car) — the same
// screens that create a listing, exactly like the web app, where create and
// edit are one form. This route only exists so older `/listings/{id}` links
// (provider list, listing view) keep working: it looks up the category and
// forwards to the right wizard.

export default function EditListingRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const redirected = useRef(false);

  const { data: listing, isError, refetch } = useQuery({
    queryKey: ["listing", id],
    queryFn: async () => {
      const res = await listingApi.get<{ data: any }>(`/listings/${id}`);
      return res.data.data;
    },
    enabled: !!id,
  });

  useEffect(() => {
    if (!listing?.category || redirected.current) return;
    redirected.current = true;
    router.replace(`/listings/${listing.category}?id=${id}` as any);
  }, [listing, id]);

  if (isError) {
    return (
      <View style={s.center}>
        <Text style={s.errorText}>Could not load this listing.</Text>
        <TouchableOpacity style={s.retryBtn} onPress={() => refetch()} activeOpacity={0.8}>
          <Text style={s.retryText}>Try Again</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.8}>
          <Text style={s.backText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={s.center}>
      <ActivityIndicator size="large" color={K.colors.accent} />
    </View>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: K.colors.bgLight, gap: 14 },
  errorText: { fontSize: 15, color: K.colors.textDark },
  retryBtn: {
    backgroundColor: K.colors.darkGreen,
    borderRadius: K.radius.md,
    paddingVertical: 10,
    paddingHorizontal: 24,
  },
  retryText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  backText: { color: K.colors.textMid, fontSize: 14 },
});
