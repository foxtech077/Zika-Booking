import { Tabs, Redirect } from "expo-router";
import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../../store/auth";

const GREEN = "#024622";
const INACTIVE = "#9CA3AF";

function BadgeDot({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <View style={{
      position: "absolute", top: -4, right: -6,
      backgroundColor: "#EF4444", borderRadius: 8,
      minWidth: 16, height: 16, paddingHorizontal: 3,
      alignItems: "center", justifyContent: "center",
    }}>
      <Text style={{ color: "#fff", fontSize: 9, fontWeight: "700" }}>{count > 9 ? "9+" : count}</Text>
    </View>
  );
}

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
      <Tabs.Screen
        name="analytics"
        options={{
          title: "Calendar",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "calendar-clear" : "calendar-clear-outline"} size={24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="channels"
        options={{
          title: "Messages",
          tabBarIcon: ({ color, focused }) => (
            <View>
              <Ionicons name={focused ? "chatbubble" : "chatbubble-outline"} size={24} color={color} />
              <BadgeDot count={5} />
            </View>
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
    </Tabs>
  );
}
