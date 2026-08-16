import { Tabs, Redirect } from "expo-router";
import { useAuthStore } from "../../store/auth";

export default function ProviderLayout() {
  const user = useAuthStore((s) => s.user);

  if (!user) return <Redirect href="/(auth)/login" />;
  if (user.status === "pending_verification") return <Redirect href="/pending-approval" />;
  if (user.status === "suspended" || user.status === "banned") return <Redirect href="/suspended" />;

  return (
    <Tabs screenOptions={{ headerShown: false, tabBarStyle: { display: "none" } }}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="listings" />
      <Tabs.Screen name="bookings" />
      <Tabs.Screen name="messages" />
      <Tabs.Screen name="analytics" />
      <Tabs.Screen name="profile" />
      <Tabs.Screen name="channels"       options={{ href: null }} />
      <Tabs.Screen name="reviews"        options={{ href: null }} />
      <Tabs.Screen name="payouts"        options={{ href: null }} />
      <Tabs.Screen name="stripe-connect" options={{ href: null }} />
    </Tabs>
  );
}
