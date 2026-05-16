import { Stack, Redirect } from "expo-router";
import { useAuthStore } from "../../store/auth";

export default function AuthLayout() {
  const user = useAuthStore((s) => s.user);
  if (user) return <Redirect href="/(tabs)" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
