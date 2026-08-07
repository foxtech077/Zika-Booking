import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

export default function BookingSubmittedScreen() {
  const router = useRouter();

  const preparationItems = [
    { label: "Booking Reference", icon: "key-outline" as const },
    { label: "PDF Voucher", icon: "document-text-outline" as const },
    { label: "QR Code", icon: "qr-code-outline" as const },
    { label: "Receipt", icon: "receipt-outline" as const },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Success Icon */}
        <View style={styles.iconContainer}>
          <Ionicons name="checkmark-circle" size={80} color="#16a34a" />
        </View>

        {/* Title & Description */}
        <Text style={styles.title}>Booking Submitted</Text>
        <Text style={styles.description}>
          Your payment was received successfully. We are confirming your booking and generating your travel documents.
        </Text>

        {/* Preparation List */}
        <View style={styles.preparationBox}>
          <Text style={styles.preparationTitle}>Please wait while we prepare:</Text>
          {preparationItems.map((item) => (
            <View key={item.label} style={styles.prepItem}>
              <Ionicons name={item.icon} size={20} color="#16a34a" style={styles.prepIcon} />
              <Text style={styles.prepText}>{item.label}</Text>
              <Ionicons name="ellipsis-horizontal" size={16} color="#9ca3af" style={styles.dots} />
            </View>
          ))}
        </View>

        {/* AfriPoints teaser */}
        <View style={styles.afriPointsBox}>
          <Ionicons name="star" size={20} color="#16a34a" style={{ marginRight: 10 }} />
          <Text style={styles.afriPointsText}>
            AfriPoints will be credited to your account once your booking is confirmed.
          </Text>
        </View>

        {/* Informative Footer */}
        <Text style={styles.footerNote}>
          You will be able to view your booking details shortly.
        </Text>

        {/* Back to Home CTA */}
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => router.replace("/(tabs)")}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryBtnText}>Back to Home</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingTop: 40,
  },
  iconContainer: {
    marginBottom: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 12,
    textAlign: "center",
  },
  description: {
    fontSize: 15,
    color: "#4b5563",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 32,
  },
  preparationBox: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  preparationTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 14,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  prepItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f3f4f6",
  },
  prepIcon: {
    marginRight: 12,
  },
  prepText: {
    fontSize: 15,
    color: "#1f2937",
    fontWeight: "500",
    flex: 1,
  },
  dots: {
    marginLeft: 8,
  },
  afriPointsBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0fdf4",
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#bbf7d0",
    width: "100%",
  },
  afriPointsText: {
    flex: 1,
    fontSize: 13,
    color: "#166534",
    fontWeight: "500",
    lineHeight: 18,
  },
  footerNote: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 32,
    fontStyle: "italic",
  },
  primaryBtn: {
    backgroundColor: "#16a34a",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    width: "100%",
    shadowColor: "#16a34a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  primaryBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 16,
  },
});
