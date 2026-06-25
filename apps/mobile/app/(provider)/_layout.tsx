import { Tabs, Redirect } from "expo-router";
import { View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../../store/auth";

const BRAND  = "#024622";
const ACTIVE = "#1d9e62";
const GHOST  = "#B0B8B4";
const BAR_BG = "#FFFFFF";

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  return (
    <View style={t.wrap}>
      <Ionicons name={name as any} size={22} color={focused ? ACTIVE : GHOST} />
      {focused && <View style={t.dot} />}
    </View>
  );
}

const t = StyleSheet.create({
  wrap: { alignItems: "center", gap: 3 },
  dot:  { width: 4, height: 4, borderRadius: 2, backgroundColor: ACTIVE },
});

export default function ProviderLayout() {
  const user = useAuthStore((s) => s.user);

  if (!user) return <Redirect href="/(auth)/login" />;
  if (user.userType !== "provider") return <Redirect href="/(tabs)" />;
  if (user.status === "pending_verification") return <Redirect href="/pending-approval" />;
  if (user.status === "suspended" || user.status === "banned") return <Redirect href="/suspended" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: BAR_BG,
          borderTopWidth: 1,
          borderTopColor: "#ECECEC",
          height: 68,
          paddingBottom: 10,
          paddingTop: 8,
        },
        tabBarActiveTintColor:   ACTIVE,
        tabBarInactiveTintColor: GHOST,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "600",
          marginTop: 0,
          letterSpacing: 0.2,
        },
        tabBarIconStyle: { marginBottom: 0 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? "home" : "home-outline"} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: "Bookings",
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? "calendar" : "calendar-outline"} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          title: "Analytics",
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? "bar-chart" : "bar-chart-outline"} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="channels"
        options={{
          title: "Cal Sync",
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? "sync-circle" : "sync-circle-outline"} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Settings",
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? "person-circle" : "person-circle-outline"} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen name="listings"       options={{ href: null }} />
      <Tabs.Screen name="reviews"        options={{ href: null }} />
      <Tabs.Screen name="payouts"        options={{ href: null }} />
      <Tabs.Screen name="stripe-connect" options={{ href: null }} />
    </Tabs>
  );
}
