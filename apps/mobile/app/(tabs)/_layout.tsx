import { View, Text, StyleSheet, Dimensions } from "react-native";
import { Tabs, Redirect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthStore } from "../../store/auth";
import { useUnreadCount } from "../../hooks/messaging";
import { K } from "../../constants/theme";

function MessagesTabIcon({ color, focused }: { color: string; focused: boolean }) {
  const { data } = useUnreadCount();
  const count = data?.unreadCount ?? 0;
  return (
    <View style={tl.iconWrap}>
      <Ionicons
        name={focused ? "chatbubble" : "chatbubble-outline"}
        size={24}
        color={color}
      />
      {count > 0 && (
        <View style={tl.badge}>
          <Text style={tl.badgeText}>{count > 99 ? "99+" : count}</Text>
        </View>
      )}
    </View>
  );
}

const tl = StyleSheet.create({
  iconWrap: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
  badge: {
    position: "absolute",
    top: -4,
    right: -8,
    backgroundColor: K.colors.error,
    borderRadius: K.radius.full,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: "#fff", fontSize: 9, fontWeight: "800" },
});

const { width: SCREEN_W } = Dimensions.get("window");

export default function TabLayout() {
  const user = useAuthStore((s) => s.user);
  const insets = useSafeAreaInsets();

  if (!user) return <Redirect href="/(auth)/login" />;

  if (user.userType === "provider") {
    if (user.status === "pending_verification") return <Redirect href="/pending-approval" />;
    if (user.status === "suspended" || user.status === "banned") return <Redirect href="/suspended" />;
    return <Redirect href="/(provider)" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: K.colors.tabActive,
        tabBarInactiveTintColor: K.colors.tabInactive,
        tabBarStyle: {
          backgroundColor: K.colors.tabBarBg,
          borderTopWidth: 1,
          borderTopColor: K.colors.tabBarBorder,
          height: 58 + insets.bottom,
          paddingBottom: insets.bottom > 0 ? insets.bottom - 4 : 8,
          paddingTop: 8,
          ...K.shadow.xs,
        },
        tabBarLabelStyle: {
          fontSize: SCREEN_W < 375 ? 9 : SCREEN_W < 415 ? 10 : 11,
          fontWeight: "700",
          marginTop: 2,
          letterSpacing: 0.02,
        },
        tabBarItemStyle: {
          paddingVertical: 2,
          paddingHorizontal: 1,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Discover",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "compass" : "compass-outline"} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: "Trips",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "airplane" : "airplane-outline"} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: "Messages",
          tabBarIcon: ({ color, focused }) => (
            <MessagesTabIcon color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{
          title: "Saved",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "bookmark" : "bookmark-outline"} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="loyalty"
        options={{
          title: "Rewards",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "star" : "star-outline"} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "You",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "person-circle" : "person-circle-outline"} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen name="dashboard" options={{ href: null }} />
    </Tabs>
  );
}
