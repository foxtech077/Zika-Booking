import { View, Text, ScrollView, TouchableOpacity, RefreshControl, Alert, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listingApi } from "../../lib/listing-api";
import { useAuthStore } from "../../store/auth";

interface Listing {
  id: string;
  name: string | null;
  category: string;
  status: string;
  starRating: number | null;
  town: string | null;
  country: string | null;
  pricePerNight: number | null;
  currency: string | null;
  photos: { cdnUrl: string }[];
}

function normalizeListingsResponse(responseData: any): Listing[] {
  const candidates = [
    responseData,
    responseData?.data,
    responseData?.data?.listings,
    responseData?.listings,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }

  return [];
}

const STATUS_COLOR: Record<string, string> = {
  draft: "#6b7280",
  pending_review: "#d97706",
  approved: "#16a34a",
  rejected: "#dc2626",
  deactivated: "#9ca3af",
  suspended: "#b45309",
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  pending_review: "Under Review",
  approved: "Live",
  rejected: "Rejected",
  deactivated: "Deactivated",
  suspended: "Suspended",
};

export default function MyListingsScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);

  // All hooks must be called unconditionally before any early return
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["myListings"],
    queryFn: async () => {
      const res = await listingApi.get("/listings");
      return normalizeListingsResponse(res.data);
    },
    enabled: user?.userType === "provider",
  });

  const listings = Array.isArray(data) ? data : [];

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await listingApi.delete(`/listings/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["myListings"] }),
  });

  const deactivateMutation = useMutation({
    mutationFn: async (id: string) => {
      await listingApi.post(`/listings/${id}/deactivate`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["myListings"] }),
  });

  if (user?.userType !== "provider") {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.emptyTitle}>Provider account required</Text>
        <Text style={styles.emptySubtitle}>Listing management is only available to provider accounts.</Text>
      </SafeAreaView>
    );
  }

  function handleDelete(id: string) {
    Alert.alert("Delete Draft", "Delete this draft? This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteMutation.mutate(id) },
    ]);
  }

  function handleDeactivate(id: string) {
    Alert.alert("Deactivate Listing", "This will remove it from search immediately. Existing bookings are unaffected.", [
      { text: "Cancel", style: "cancel" },
      { text: "Deactivate", style: "destructive", onPress: () => deactivateMutation.mutate(id) },
    ]);
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
      >
        <TouchableOpacity style={styles.addButton} onPress={() => router.push("/listings/new")}>
          <Text style={styles.addButtonText}>+ Add new listing</Text>
        </TouchableOpacity>

        {listings.length === 0 && !isLoading && (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>No listings yet</Text>
            <Text style={styles.emptySubtitle}>Add your first hotel, apartment, or car rental listing.</Text>
          </View>
        )}

        {listings.map((listing) => (
          <View key={listing.id} style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.listingName}>{listing.name || "Untitled listing"}</Text>
                <Text style={styles.listingMeta}>
                  {listing.category.charAt(0).toUpperCase() + listing.category.slice(1)}
                  {listing.town ? ` · ${listing.town}` : ""}
                  {listing.country ? `, ${listing.country}` : ""}
                </Text>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: `${STATUS_COLOR[listing.status]}20` }]}>
                <Text style={[styles.statusText, { color: STATUS_COLOR[listing.status] }]}>
                  {STATUS_LABEL[listing.status] ?? listing.status}
                </Text>
              </View>
            </View>

            {listing.status === "rejected" && (
              <Text style={styles.rejectedNote}>Review feedback and resubmit to get listed.</Text>
            )}

            <View style={styles.cardActions}>
              {listing.status !== "pending_review" && (
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => router.push(`/listings/${listing.id}`)}
                >
                  <Text style={styles.actionBtnText}>
                    {listing.status === "rejected" ? "View Feedback & Edit" : "Edit"}
                  </Text>
                </TouchableOpacity>
              )}

              {listing.status === "draft" && (
                <TouchableOpacity style={[styles.actionBtn, styles.dangerBtn]} onPress={() => handleDelete(listing.id)}>
                  <Text style={[styles.actionBtnText, { color: "#dc2626" }]}>Delete</Text>
                </TouchableOpacity>
              )}

              {listing.status === "approved" && (
                <TouchableOpacity style={[styles.actionBtn, styles.dangerBtn]} onPress={() => handleDeactivate(listing.id)}>
                  <Text style={[styles.actionBtnText, { color: "#dc2626" }]}>Deactivate</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  scroll: { padding: 16 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  addButton: {
    backgroundColor: "#16a34a",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginBottom: 16,
  },
  addButtonText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  emptyContainer: { alignItems: "center", paddingVertical: 40 },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: "#111827", marginBottom: 8 },
  emptySubtitle: { fontSize: 14, color: "#6b7280", textAlign: "center" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  cardHeader: { flexDirection: "row", alignItems: "flex-start", marginBottom: 8 },
  listingName: { fontSize: 16, fontWeight: "600", color: "#111827", marginBottom: 2 },
  listingMeta: { fontSize: 13, color: "#6b7280" },
  statusBadge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3, marginLeft: 8 },
  statusText: { fontSize: 12, fontWeight: "600" },
  rejectedNote: { fontSize: 13, color: "#dc2626", marginBottom: 8 },
  cardActions: { flexDirection: "row", gap: 8, marginTop: 4 },
  actionBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: "center",
  },
  dangerBtn: { borderColor: "#fca5a5" },
  actionBtnText: { fontSize: 14, fontWeight: "500", color: "#374151" },
});
