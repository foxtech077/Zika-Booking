import { useState } from "react";
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { K } from "../../constants/theme";
import { listingApi } from "../../lib/listing-api";
import { FormField, SectionHeader, SelectField } from "./_components";
import { ROOM_TYPES, apiErrorMessage } from "./_web-parity";

/**
 * Room-type manager — mirror of the web wizard's "Room Setup" step.
 *
 * Room types are their own resource (`/listings/:id/room-types`), saved as
 * they are edited rather than with the wizard's step PATCH. A hotel cannot be
 * submitted without at least one active room type.
 */

export interface HotelRoomType {
  id: string;
  name: string;
  roomType: string;
  description?: string | null;
  pricePerNight: number;
  unitCount: number;
  maxGuests?: number | null;
  isActive?: boolean;
}

const labelFor = (value: string) =>
  ROOM_TYPES.find((o) => o.value === value)?.label ?? value;

export function useRoomTypes(listingId: string) {
  return useQuery<HotelRoomType[]>({
    queryKey: ["room-types", listingId],
    queryFn: async () => {
      const res = await listingApi.get(`/listings/${listingId}/room-types`);
      return res.data?.data ?? [];
    },
    enabled: !!listingId,
  });
}

interface Props {
  listingId: string;
  currency: string;
  error?: string | undefined;
}

export function RoomTypesSection({ listingId, currency, error }: Props) {
  const qc = useQueryClient();
  const { data: roomTypes = [], isLoading, refetch } = useRoomTypes(listingId);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<HotelRoomType | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Field labels below mirror the web form's Room Setup step exactly.
  const [name, setName] = useState("");
  const [roomType, setRoomType] = useState<string>("standard");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [units, setUnits] = useState("1");
  const [maxGuests, setMaxGuests] = useState("2");

  const resetForm = () => {
    setName("");
    setRoomType("standard");
    setDescription("");
    setPrice("");
    setUnits("1");
    setMaxGuests("2");
    setFormError("");
    setEditing(null);
    setShowForm(false);
  };

  const openEdit = (rt: HotelRoomType) => {
    setEditing(rt);
    setName(rt.name);
    setRoomType(rt.roomType);
    setDescription(rt.description ?? "");
    setPrice(String(rt.pricePerNight));
    setUnits(String(rt.unitCount));
    setMaxGuests(String(rt.maxGuests ?? 2));
    setFormError("");
    setShowForm(true);
  };

  const save = async () => {
    setFormError("");
    // Same rules the web form enforces, so neither client can create a row
    // the other would reject.
    if (!name.trim()) return setFormError("Room type name is required.");
    if (!(Number(price) > 0)) return setFormError("Price must be greater than 0.");
    if (!(Number(units) >= 1)) return setFormError("Unit count must be at least 1.");

    const payload = {
      name: name.trim(),
      roomType,
      description: description.trim() || undefined,
      pricePerNight: Number(price),
      unitCount: Math.trunc(Number(units)),
      maxGuests: maxGuests ? Math.trunc(Number(maxGuests)) : undefined,
    };

    setSaving(true);
    try {
      if (editing) {
        await listingApi.patch(`/listings/${listingId}/room-types/${editing.id}`, payload);
      } else {
        await listingApi.post(`/listings/${listingId}/room-types`, payload);
      }
      await refetch();
      qc.invalidateQueries({ queryKey: ["listing", listingId] });
      resetForm();
    } catch (e) {
      setFormError(apiErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (rt: HotelRoomType) => {
    Alert.alert("Delete room type", `Remove "${rt.name}"? This cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await listingApi.delete(`/listings/${listingId}/room-types/${rt.id}`);
            await refetch();
          } catch (e) {
            Alert.alert("Delete failed", apiErrorMessage(e));
          }
        },
      },
    ]);
  };

  return (
    <View>
      <SectionHeader
        title="Room Types"
        subtitle="Add every room you sell, with its own nightly rate and inventory."
        icon="grid"
      />

      {isLoading ? (
        <View style={s.loading}>
          <ActivityIndicator color={K.colors.accent} />
        </View>
      ) : roomTypes.length === 0 ? (
        <View style={s.empty}>
          <Ionicons name="bed-outline" size={30} color={K.colors.textMuted} />
          <Text style={s.emptyTitle}>No room types yet</Text>
          <Text style={s.emptyHint}>
            At least one room type is required before this hotel can be submitted.
          </Text>
        </View>
      ) : (
        roomTypes.map((rt) => (
          <View key={rt.id} style={s.card}>
            <View style={s.cardMain}>
              <Text style={s.cardName} numberOfLines={1}>
                {rt.name}
              </Text>
              <Text style={s.cardMeta}>
                {labelFor(rt.roomType)} · {rt.unitCount} {rt.unitCount === 1 ? "unit" : "units"}
                {rt.maxGuests ? ` · up to ${rt.maxGuests} guests` : ""}
              </Text>
              <Text style={s.cardPrice}>
                {currency} {rt.pricePerNight.toLocaleString()}{" "}
                <Text style={s.cardPriceUnit}>/night</Text>
              </Text>
            </View>
            <View style={s.cardActions}>
              <TouchableOpacity onPress={() => openEdit(rt)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="create-outline" size={20} color={K.colors.darkGreen} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => confirmDelete(rt)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="trash-outline" size={20} color="#DC2626" />
              </TouchableOpacity>
            </View>
          </View>
        ))
      )}

      {error ? <Text style={s.error}>{error}</Text> : null}

      <TouchableOpacity
        style={s.addBtn}
        onPress={() => {
          resetForm();
          setShowForm(true);
        }}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={18} color="#fff" />
        <Text style={s.addBtnText}>Add Room Type</Text>
      </TouchableOpacity>

      <Modal visible={showForm} transparent animationType="slide" onRequestClose={resetForm}>
        <View style={s.overlay}>
          <View style={s.sheet}>
            <View style={s.sheetHeader}>
              <Text style={s.sheetTitle}>{editing ? "Edit Room Type" : "Add Room Type"}</Text>
              <TouchableOpacity onPress={resetForm} hitSlop={{ top: 10, bottom: 10, left: 12, right: 12 }}>
                <Ionicons name="close" size={22} color={K.colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={s.sheetBody}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <FormField
                label="Display Name (e.g. Deluxe Ocean View)"
                required
                value={name}
                onChangeText={setName}
                placeholder="e.g. Deluxe Ocean View"
                maxLength={100}
              />

              <SelectField
                label="Room Classification"
                required
                options={ROOM_TYPES}
                selected={roomType}
                onSelect={setRoomType}
              />

              <FormField
                label={`Price per Night (${currency})`}
                required
                value={price}
                onChangeText={setPrice}
                placeholder="0.00"
                keyboardType="decimal-pad"
              />

              <FormField
                label="Units Available (Inventory)"
                required
                value={units}
                onChangeText={(t) => setUnits(t.replace(/\D/g, ""))}
                placeholder="1"
                keyboardType="number-pad"
              />

              <FormField
                label="Max Guests"
                value={maxGuests}
                onChangeText={(t) => setMaxGuests(t.replace(/\D/g, ""))}
                placeholder="2"
                keyboardType="number-pad"
              />

              <FormField
                label="Room Description (Optional)"
                value={description}
                onChangeText={setDescription}
                placeholder="What makes this room different"
                multiline
                numberOfLines={3}
                maxLength={2000}
              />

              {formError ? <Text style={s.error}>{formError}</Text> : null}
            </ScrollView>

            <View style={s.sheetFooter}>
              <TouchableOpacity style={s.cancelBtn} onPress={resetForm} disabled={saving}>
                <Text style={s.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.saveBtn, saving && s.saveBtnDisabled]}
                onPress={() => void save()}
                disabled={saving}
                activeOpacity={0.85}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={s.saveBtnText}>{editing ? "Save Changes" : "Add Room Type"}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  loading: { paddingVertical: 24, alignItems: "center" },
  empty: {
    alignItems: "center",
    gap: 6,
    paddingVertical: 26,
    paddingHorizontal: 20,
    backgroundColor: K.colors.bgSubtle,
    borderRadius: 14,
    marginBottom: 12,
  },
  emptyTitle: { fontSize: 14, fontWeight: "700", color: K.colors.textDark },
  emptyHint: { fontSize: 12, color: K.colors.textMuted, textAlign: "center", lineHeight: 17 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: K.colors.border,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  cardMain: { flex: 1, gap: 2 },
  cardName: { fontSize: 15, fontWeight: "800", color: K.colors.textDark },
  cardMeta: { fontSize: 12, color: K.colors.textMuted },
  cardPrice: { fontSize: 14, fontWeight: "800", color: K.colors.darkGreen, marginTop: 2 },
  cardPriceUnit: { fontSize: 11, fontWeight: "600", color: K.colors.textMuted },
  cardActions: { flexDirection: "row", gap: 16 },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: K.colors.darkGreen,
    borderRadius: 12,
    paddingVertical: 13,
    marginTop: 4,
  },
  addBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  error: { fontSize: 12, color: "#DC2626", marginTop: 8, fontWeight: "600" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: K.colors.bgApp,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    maxHeight: "88%",
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: K.colors.border,
  },
  sheetTitle: { fontSize: 17, fontWeight: "800", color: K.colors.textDark },
  sheetBody: { paddingHorizontal: 18, paddingTop: 16 },
  sheetFooter: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 26,
    borderTopWidth: 1,
    borderTopColor: K.colors.border,
  },
  cancelBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: K.colors.border,
    backgroundColor: "#fff",
  },
  cancelBtnText: { fontSize: 14, fontWeight: "700", color: K.colors.textDark },
  saveBtn: {
    flex: 2,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: K.colors.darkGreen,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { fontSize: 14, fontWeight: "700", color: "#fff" },
});
