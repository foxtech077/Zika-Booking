import { Redirect } from "expo-router";
import { useAuthStore } from "../store/auth";
import { View, ActivityIndicator, StyleSheet } from "react-native";

export default function Index() {
  const { user, isHydrated } = useAuthStore();

  if (!isHydrated) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#1a73e8" />
      </View>
    );
  }

  return user ? <Redirect href="/(tabs)" /> : <Redirect href="/(auth)/login" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },
});
