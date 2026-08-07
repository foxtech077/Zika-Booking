import { Stack, Redirect } from "expo-router";
import { useAuthStore } from "../../store/auth";

export default function AuthLayout() {
  const user = useAuthStore((s) => s.user);
  // Anyone already signed in has no business on an auth screen. This mirrored
  // the splash screen's userType branching and shared its fall-through bug:
  // with no matching arm it dropped through to the auth stack, so a logged-in
  // user was shown the login form and could not get past it.
  if (user) {
    if (user.status === "pending_verification") {
      return <Redirect href="/pending-approval" />;
    }
    if (user.status === "suspended" || user.status === "banned") {
      return <Redirect href="/suspended" />;
    }
    return <Redirect href="/(tabs)" />;
  }
  return <Stack screenOptions={{ headerShown: false }} />;
}
