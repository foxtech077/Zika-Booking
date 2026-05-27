import { Tabs, Redirect } from "expo-router";
import { useAuthStore } from "../../store/auth";

const tabConfig: Record<string, { title: string }> = {
  index:     { title: "Home" },
  bookings:  { title: "Bookings" },
  dashboard: { title: "Dashboard" },
  saved:     { title: "Saved" },
  profile:   { title: "Profile" },
};

export default function TabLayout() {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Redirect href="/(auth)/login" />;

  const isProvider = user.userType === "provider";

  return (
    <Tabs
      screenOptions={({ route }) => ({
        tabBarActiveTintColor: "#1a73e8",
        title: tabConfig[route.name]?.title ?? route.name,
        // Hide dashboard tab for non-providers
        ...(route.name === "dashboard" && !isProvider
          ? { href: null }
          : {}),
      })}
    />
  );
}
