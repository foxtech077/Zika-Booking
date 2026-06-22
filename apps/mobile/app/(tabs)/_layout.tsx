import { Tabs, Redirect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../../store/auth";
import { K } from "../../constants/theme";

export default function TabLayout() {
  const user = useAuthStore((s) => s.user);
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
          height: 68,
          paddingBottom: 10,
          paddingTop: 8,
          ...K.shadow.xs,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "700",
          marginTop: 2,
          letterSpacing: 0.1,
        },
        tabBarItemStyle: {
          paddingVertical: 2,
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
