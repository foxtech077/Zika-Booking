import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { RoomTypeCard, RoomType } from "./RoomTypeCard";
import { Ionicons } from "@expo/vector-icons";

interface RoomTypeSelectorProps {
  roomTypes: RoomType[];
  selectedRoomTypeId: string | null;
  onSelectRoomType: (roomTypeId: string) => void;
  currency?: string;
}

const TEXT = "#111827";
const MUTED = "#6B7280";
const GREEN = "#15803D";

export function RoomTypeSelector({
  roomTypes,
  selectedRoomTypeId,
  onSelectRoomType,
  currency = "XAF",
}: RoomTypeSelectorProps) {
  if (!roomTypes || roomTypes.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionTitle}>Select Room Type</Text>
          <Text style={styles.sectionSubtitle}>
            Choose your preferred accommodation style
          </Text>
        </View>
        <View style={styles.countBadge}>
          <Ionicons name="bed-outline" size={14} color={GREEN} />
          <Text style={styles.countText}>
            {roomTypes.length} Option{roomTypes.length !== 1 ? "s" : ""}
          </Text>
        </View>
      </View>

      <View style={styles.list}>
        {roomTypes.map((rt) => (
          <RoomTypeCard
            key={rt.id}
            roomType={rt}
            selected={selectedRoomTypeId === rt.id}
            onSelect={() => onSelectRoomType(rt.id)}
            currency={currency}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: TEXT,
    letterSpacing: -0.3,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: MUTED,
    marginTop: 2,
    fontWeight: "500",
  },
  countBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#BBF7D0",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  countText: {
    fontSize: 12,
    fontWeight: "700",
    color: GREEN,
  },
  list: {
    marginTop: 2,
  },
});
