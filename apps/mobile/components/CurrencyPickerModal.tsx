import { useMemo, useState } from "react";
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ALL_CURRENCIES } from "../lib/currency";
import { K } from "../constants/theme";

const SCREEN_H = Dimensions.get("window").height;

interface Props {
  visible: boolean;
  selected: string;
  onSelect: (code: string) => void;
  onClose: () => void;
}

// Reuses the search-modal pattern from (auth)/register.tsx's country picker,
// against the currency list instead of the country list — same interaction,
// different data source.
export function CurrencyPickerModal({ visible, selected, onSelect, onClose }: Props) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return ALL_CURRENCIES;
    return ALL_CURRENCIES.filter((c) => c.code.toLowerCase().includes(term));
  }, [search]);

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <View style={s.modalBack}>
        <View style={s.modalSheet}>
          <View style={s.modalHandle} />

          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Choose Currency</Text>
            <TouchableOpacity onPress={onClose} style={s.modalClose}>
              <Ionicons name="close" size={20} color={K.colors.textDark} />
            </TouchableOpacity>
          </View>

          <View style={s.searchBox}>
            <Ionicons name="search-outline" size={16} color={K.colors.textMuted} />
            <TextInput
              style={s.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Search currency code…"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="characters"
              autoFocus
            />
          </View>

          <FlatList
            data={filtered}
            keyExtractor={(c) => c.code}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[s.row, selected === item.code && s.rowActive]}
                onPress={() => onSelect(item.code)}
              >
                <Text style={s.symbol}>{item.symbol}</Text>
                <Text style={s.code}>{item.code}</Text>
                {selected === item.code && (
                  <Ionicons name="checkmark-circle" size={18} color={K.colors.accent} style={{ marginLeft: "auto" }} />
                )}
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={{ alignItems: "center", paddingVertical: 40 }}>
                <Text style={{ color: K.colors.textMuted }}>No currencies found</Text>
              </View>
            }
          />
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  modalBack: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  modalSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: SCREEN_H * 0.78,
    paddingTop: 12,
  },
  modalHandle: { width: 36, height: 4, backgroundColor: K.colors.border, borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: "800", color: K.colors.textDark },
  modalClose: { width: 32, height: 32, borderRadius: 16, backgroundColor: K.colors.bgSubtle, alignItems: "center", justifyContent: "center" },

  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 20,
    backgroundColor: K.colors.bgSubtle,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: K.colors.border,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginBottom: 16,
  },
  searchInput: { flex: 1, fontSize: 15, color: K.colors.textDark },

  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    gap: 12,
  },
  rowActive: { backgroundColor: "#F0FDF4" },
  symbol: { fontSize: 15, color: K.colors.textMuted, fontWeight: "600", width: 32 },
  code: { flex: 1, fontSize: 15, color: K.colors.textDark, fontWeight: "500" },
});
