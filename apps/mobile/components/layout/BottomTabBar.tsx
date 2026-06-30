import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { usePathname, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { K } from "../../constants/theme";

const TABS = [
  { key: "home",      label: "Home",      path: "/(provider)",           icon: "home",       iconOut: "home-outline"       },
  { key: "listings",  label: "Listings",  path: "/(provider)/listings",  icon: "list",       iconOut: "list-outline"       },
  { key: "bookings",  label: "Bookings",  path: "/(provider)/bookings",  icon: "calendar",   iconOut: "calendar-outline"   },
  { key: "analytics", label: "Analytics", path: "/(provider)/analytics", icon: "bar-chart",  iconOut: "bar-chart-outline"  },
  { key: "settings",  label: "Settings",  path: "/(provider)/profile",   icon: "settings",   iconOut: "settings-outline"   },
] as const;

export function BottomTabBar() {
  const pathname = usePathname();

  function isActive(path: string) {
    if (path === "/(provider)") {
      return pathname === "/(provider)" || pathname === "/" || pathname === "";
    }
    return pathname.startsWith(path);
  }

  return (
    <SafeAreaView edges={["bottom"]} style={s.safe}>
      <View style={s.bar}>
        {TABS.map((tab) => {
          const active = isActive(tab.path);
          return (
            <TouchableOpacity
              key={tab.key}
              style={s.tab}
              onPress={() => router.navigate(tab.path as any)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={(active ? tab.icon : tab.iconOut) as any}
                size={22}
                color={active ? K.colors.accent : K.colors.tabInactive}
              />
              {active && <View style={s.dot} />}
              <Text style={[s.label, active && s.labelActive]}>{tab.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:        { backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: K.colors.tabBarBorder },
  bar:         { flexDirection: "row", paddingTop: 8, paddingBottom: 4 },
  tab:         { flex: 1, alignItems: "center", gap: 2, paddingVertical: 2 },
  dot:         { width: 4, height: 4, borderRadius: 2, backgroundColor: K.colors.accent },
  label:       { fontSize: 10, fontWeight: "600", color: K.colors.tabInactive, letterSpacing: 0.2 },
  labelActive: { color: K.colors.accent },
});
