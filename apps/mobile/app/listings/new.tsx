import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useMutation } from "@tanstack/react-query";
import { listingApi } from "../../lib/listing-api";

const CATEGORIES = [
  {
    key: "hotel",
    title: "Hotel",
    description: "Rooms and suites in a hotel property",
    icon: "🏨",
  },
  {
    key: "apartment",
    title: "Apartment",
    description: "Self-contained units, studios, and apartments",
    icon: "🏠",
  },
  {
    key: "car",
    title: "Car Rental",
    description: "Vehicles available for daily or weekly hire",
    icon: "🚗",
  },
];

export default function NewListingScreen() {
  const router = useRouter();

  const createMutation = useMutation({
    mutationFn: async (category: string) => {
      const res = await listingApi.post<{ data: { id: string } }>("/listings", { category });
      return res.data.data;
    },
    onSuccess: (data) => {
      router.replace(`/listings/${data.id}`);
    },
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>What type of listing?</Text>
        <Text style={styles.subtitle}>Choose the category that best describes your property or vehicle.</Text>

        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat.key}
            style={styles.card}
            onPress={() => createMutation.mutate(cat.key)}
            disabled={createMutation.isPending}
          >
            <Text style={styles.icon}>{cat.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{cat.title}</Text>
              <Text style={styles.cardDescription}>{cat.description}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        ))}

        {createMutation.isError && (
          <Text style={styles.error}>Failed to create listing. Please try again.</Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f9fafb" },
  content: { flex: 1, padding: 20 },
  title: { fontSize: 22, fontWeight: "700", color: "#111827", marginBottom: 8 },
  subtitle: { fontSize: 14, color: "#6b7280", marginBottom: 24, lineHeight: 20 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    flexDirection: "row",
    alignItems: "center",
  },
  icon: { fontSize: 28, marginRight: 14 },
  cardTitle: { fontSize: 16, fontWeight: "600", color: "#111827", marginBottom: 2 },
  cardDescription: { fontSize: 13, color: "#6b7280" },
  chevron: { fontSize: 22, color: "#9ca3af", marginLeft: 8 },
  error: { color: "#dc2626", fontSize: 14, textAlign: "center", marginTop: 12 },
});
