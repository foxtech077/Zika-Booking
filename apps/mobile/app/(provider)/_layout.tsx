import { Tabs, Redirect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../../store/auth";

const GREEN = "#024622";
const INACTIVE = "#9CA3AF";

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
          backgroundColor: "#fff",
          borderTopWidth: 1,
          borderTopColor: "#E5E7EB",
          height: 60,
          paddingBottom: 6,
          paddingTop: 4,
          paddingHorizontal: 0,
        },
        tabBarActiveTintColor: GREEN,
        tabBarInactiveTintColor: INACTIVE,
        tabBarLabelStyle: { fontSize: 10, fontWeight: "600", marginTop: 2 },
        tabBarIconStyle: { marginBottom: 0 },
        tabBarItemStyle: { paddingVertical: 0 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "bar-chart" : "bar-chart-outline"} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: "Bookings",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "calendar" : "calendar-outline"} size={24} color={color} />
          ),
        }}
      />
      {/* analytics.tsx is the Earnings & Analytics screen — was mislabeled "Calendar" */}
      <Tabs.Screen
        name="analytics"
        options={{
          title: "Analytics",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "stats-chart" : "stats-chart-outline"} size={24} color={color} />
          ),
        }}
      />
      {/* channels.tsx is the iCal Calendar Sync screen — was mislabeled "Messages" */}
      <Tabs.Screen
        name="channels"
        options={{
          title: "Cal Sync",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "sync-circle" : "sync-circle-outline"} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Menu",
          tabBarIcon: ({ color }) => (
            <Ionicons name="menu" size={26} color={color} />
          ),
        }}
      />
      <Tabs.Screen name="listings" options={{ href: null }} />
      <Tabs.Screen name="reviews" options={{ href: null }} />
    </Tabs>
  );
}
