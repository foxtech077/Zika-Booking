import { FlatList, TouchableOpacity, Text, StyleSheet } from "react-native";
import { K } from "../../constants/theme";

export interface FilterTab {
  key: string;
  label: string;
  statusParam: string | undefined;
}

/** Presentational-only — same tab data / active-key contract as before, restyled as a segmented pill row. */
export function BookingFilterBar({
  tabs,
  activeKey,
  onSelect,
}: {
  tabs: FilterTab[];
  activeKey: string;
  onSelect: (key: string) => void;
}) {
  return (
    <FlatList
      data={tabs}
      horizontal
      showsHorizontalScrollIndicator={false}
      keyExtractor={(t) => t.key}
      contentContainerStyle={f.row}
      renderItem={({ item: tab }) => {
        const active = activeKey === tab.key;
        return (
          <TouchableOpacity
            style={[f.tab, active && f.tabActive]}
            onPress={() => onSelect(tab.key)}
            activeOpacity={0.75}
          >
            <Text style={[f.tabText, active && f.tabTextActive]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      }}
    />
  );
}

const f = StyleSheet.create({
  row: { gap: 8 },
  tab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: K.radius.full,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  tabActive: { backgroundColor: "#fff" },
  tabText: { fontSize: 12, color: "rgba(255,255,255,0.75)", fontWeight: "700" },
  tabTextActive: { color: K.colors.darkGreen },
});
