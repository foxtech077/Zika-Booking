import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export interface RoomType {
  id: string;
  name: string;
  roomType: string;
  description?: string | null;
  pricePerNight: number | string;
  localizedPricePerNight?: number | string | null;
  unitCount?: number | null;
  maxGuests?: number | null;
  isActive?: boolean;
  sortOrder?: number;
}

interface RoomTypeCardProps {
  roomType: RoomType;
  selected: boolean;
  onSelect: () => void;
  currency?: string;
  discountPercent?: number | null;
}

const GREEN = "#15803D";
const GREEN_BG = "#F0FDF4";
const GREEN_BORDER = "#86EFAC";
const TEXT = "#111827";
const MUTED = "#6B7280";
const BORDER = "#E5E7EB";

function formatRoomTypeCategory(rt: string): string {
  if (!rt) return "Standard";
  return rt.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function RoomTypeCard({
  roomType,
  selected,
  onSelect,
  currency = "XAF",
  discountPercent,
}: RoomTypeCardProps) {
  const basePrice = typeof roomType.pricePerNight === "number"
    ? roomType.pricePerNight
    : parseFloat(roomType.pricePerNight || "0");

  const hasDiscount = discountPercent != null && discountPercent > 0;
  const discountedPrice = hasDiscount ? basePrice * (1 - discountPercent / 100) : basePrice;

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onSelect}
      style={[
        styles.card,
        selected ? styles.cardSelected : styles.cardUnselected,
      ]}
    >
      {/* Selection radio indicator */}
      <View style={styles.topRow}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <View style={styles.titleBadgeRow}>
            <Text style={styles.name}>{roomType.name || formatRoomTypeCategory(roomType.roomType)}</Text>
            <View style={[styles.catBadge, selected && styles.catBadgeSelected]}>
              <Text style={[styles.catBadgeText, selected && styles.catBadgeTextSelected]}>
                {formatRoomTypeCategory(roomType.roomType)}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.radioWrap}>
          <Ionicons
            name={selected ? "checkmark-circle" : "ellipse-outline"}
            size={22}
            color={selected ? GREEN : "#9CA3AF"}
          />
        </View>
      </View>

      {/* Description if available */}
      {!!roomType.description && (
        <Text style={styles.description} numberOfLines={2}>
          {roomType.description}
        </Text>
      )}

      {/* Spec Pills & Price footer */}
      <View style={styles.footerRow}>
        <View style={styles.specsContainer}>
          {roomType.maxGuests != null && roomType.maxGuests > 0 && (
            <View style={styles.specPill}>
              <Ionicons name="people-outline" size={13} color={MUTED} />
              <Text style={styles.specPillText}>Up to {roomType.maxGuests}</Text>
            </View>
          )}

        </View>

        <View style={styles.priceContainer}>
          {hasDiscount && (
            <Text style={styles.originalPrice}>
              {currency} {Math.round(basePrice).toLocaleString()}
            </Text>
          )}
          <View style={styles.priceRow}>
            <Text style={styles.priceAmount}>
              {currency} {Math.round(discountedPrice).toLocaleString()}
            </Text>
            <Text style={styles.priceUnit}>/ night</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1.5,
  },
  cardUnselected: {
    backgroundColor: "#FFFFFF",
    borderColor: BORDER,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  cardSelected: {
    backgroundColor: GREEN_BG,
    borderColor: GREEN,
    shadowColor: GREEN,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  titleBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  name: {
    fontSize: 16,
    fontWeight: "700",
    color: TEXT,
    letterSpacing: -0.2,
  },
  catBadge: {
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  catBadgeSelected: {
    backgroundColor: "#DCFCE7",
  },
  catBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: MUTED,
  },
  catBadgeTextSelected: {
    color: GREEN,
  },
  radioWrap: {
    marginLeft: 4,
  },
  description: {
    fontSize: 13,
    color: "#4B5563",
    marginTop: 6,
    lineHeight: 18,
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    flexWrap: "wrap",
    gap: 8,
  },
  specsContainer: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    flexShrink: 1,
  },
  specPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F9FAFB",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  specPillText: {
    fontSize: 11,
    fontWeight: "500",
    color: MUTED,
  },
  priceContainer: {
    alignItems: "flex-end",
    justifyContent: "center",
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 3,
  },
  originalPrice: {
    fontSize: 11,
    color: MUTED,
    textDecorationLine: "line-through",
    marginBottom: 1,
  },
  priceAmount: {
    fontSize: 17,
    fontWeight: "800",
    color: GREEN,
  },
  priceUnit: {
    fontSize: 11,
    fontWeight: "500",
    color: MUTED,
  },
});
