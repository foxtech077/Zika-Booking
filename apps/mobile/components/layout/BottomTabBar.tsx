import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { usePathname, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { K } from "../../constants/theme";
import { useUnreadCount } from "../../hooks/messaging";

const TABS = [
  { key: "home",      label: "Home",      path: "/(provider)",           icon: "home",          iconOut: "home-outline"          },
  { key: "listings",  label: "Listings",  path: "/(provider)/listings",  icon: "list",          iconOut: "list-outline"          },
  { key: "bookings",  label: "Bookings",  path: "/(provider)/bookings",  icon: "calendar",      iconOut: "calendar-outline"      },
  { key: "messages",  label: "Messages",  path: "/(provider)/messages",  icon: "chatbubbles",   iconOut: "chatbubbles-outline"   },
  { key: "analytics", label: "Analytics", path: "/(provider)/analytics", icon: "bar-chart",     iconOut: "bar-chart-outline"     },
  { key: "settings",  label: "Settings",  path: "/(provider)/profile",   icon: "settings",      iconOut: "settings-outline"      },
] as const;

export function BottomTabBar() {
  const pathname = usePathname();
  const { data: unreadData } = useUnreadCount();
  const unreadCount = unreadData?.unreadCount ?? 0;

  function isActive(path: string) {
    // usePathname() strips route-group segments like "(provider)", so
    // "/(provider)/bookings" never matches the real pathname "/bookings".
    // Normalize by stripping the group segment before comparing.
    const normalized = path.replace("/(provider)", "") || "/";
    if (normalized === "/") {
      return pathname === "/" || pathname === "";
    }
    return pathname === normalized || pathname.startsWith(`${normalized}/`);
  }

  return (
    <SafeAreaView edges={["bottom"]} style={s.safe}>
      <View style={s.bar}>
        {TABS.map((tab) => {
          const active = isActive(tab.path);
          const showBadge = tab.key === "messages" && unreadCount > 0;

          return (
            <TouchableOpacity
              key={tab.key}
              style={s.tab}
              onPress={() => router.navigate(tab.path as any)}
              activeOpacity={0.7}
            >
              <View style={s.iconWrap}>
                <Ionicons
                  name={(active ? tab.icon : tab.iconOut) as any}
                  size={22}
                  color={active ? K.colors.accent : K.colors.tabInactive}
                />
                {showBadge && (
                  <View style={s.badgeDot}>
                    {unreadCount < 100 && (
                      <Text style={s.badgeDotText}>{unreadCount}</Text>
                    )}
                  </View>
                )}
              </View>
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
  iconWrap:    { position: "relative" },
  dot:         { width: 4, height: 4, borderRadius: 2, backgroundColor: K.colors.accent },
  label:       { fontSize: 9, fontWeight: "600", color: K.colors.tabInactive, letterSpacing: 0.1 },
  labelActive: { color: K.colors.accent },

  badgeDot: {
    position: "absolute",
    top: -4,
    right: -6,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: K.colors.error,
    borderWidth: 1.5,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeDotText: { color: "#fff", fontSize: 9, fontWeight: "800" },
});
