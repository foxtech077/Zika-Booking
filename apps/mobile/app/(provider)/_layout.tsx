import { Tabs, Redirect } from "expo-router";
import { useAuthStore } from "../../store/auth";

export default function ProviderLayout() {
  const user = useAuthStore((s) => s.user);

  if (!user) return <Redirect href="/(auth)/login" />;
  if (user.status === "pending_verification") return <Redirect href="/pending-approval" />;
  if (user.status === "suspended" || user.status === "banned") return <Redirect href="/suspended" />;

  // This whole group is the hosting side — unlike web, which gates individual
  // dashboard routes while leaving the bare dashboard and the host-application
  // page open, mobile's application screen already lives outside this group
  // entirely (app/host.tsx), so one gate on approved status covers it.
  // Normal navigation never gets here unapproved — the Profile row that leads
  // here checks the same status first — but a stale deep link or nav state
  // could, and every screen underneath calls endpoints that require an
  // approved host anyway.
  if (user.hostStatus !== "approved") return <Redirect href="/host" />;

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
