import { Stack, Redirect } from "expo-router";
import { useAuthStore } from "../../store/auth";

export default function AuthLayout() {
  const user = useAuthStore((s) => s.user);
  if (user) {
    if (user.userType === "guest") {
      return <Redirect href="/(tabs)" />;
    } else if (user.userType === "provider") {
      if (user.status === "pending_verification") {
        return <Redirect href="/pending-approval" />;
      } else if (user.status === "suspended" || user.status === "banned") {
        return <Redirect href="/suspended" />;
      } else {
        return <Redirect href={"/(provider)" as any} />;
      }
    }
  }
  return <Stack screenOptions={{ headerShown: false }} />;
}
