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

  if (user.userType === "provider") {
    if (user.status === "pending_verification") return <Redirect href="/pending-approval" />;
    if (user.status === "suspended" || user.status === "banned") return <Redirect href="/suspended" />;
    return <Redirect href="/(provider)" />;
  }

  const isProvider = false;

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
