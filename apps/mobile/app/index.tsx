import { Redirect } from "expo-router";
import { useAuthStore } from "../store/auth";
import { View, ActivityIndicator } from "react-native";

export default function Index() {
  const { user, isHydrated } = useAuthStore();

  if (!isHydrated) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#1a73e8" />
      </View>
    );
  }

  return user ? <Redirect href="/(tabs)" /> : <Redirect href="/(auth)/login" />;
}
