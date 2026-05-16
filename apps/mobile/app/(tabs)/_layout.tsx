import { Tabs, Redirect } from "expo-router";
import { useAuthStore } from "../../store/auth";

export default function TabLayout() {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Redirect href="/(auth)/login" />;

  const isProvider = user.userType === "provider";

  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: "#1a73e8" }}>
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="bookings" options={{ title: "Bookings" }} />
      <Tabs.Screen
        name="dashboard"
        options={{ title: "Dashboard", href: isProvider ? undefined : null }}
      />
      <Tabs.Screen name="saved" options={{ title: "Saved" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}
