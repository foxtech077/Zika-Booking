import { Tabs, Redirect } from "expo-router";
import { View, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../../store/auth";
import { K } from "../../constants/theme";

export default function ProviderLayout() {
  const user = useAuthStore((s) => s.user);

  if (!user) return <Redirect href="/(auth)/login" />;
  if (user.userType !== "provider") return <Redirect href="/(tabs)" />;
  if (user.status === "pending_verification") return <Redirect href="/pending-approval" />;
  if (user.status === "suspended" || user.status === "banned") return <Redirect href="/suspended" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: styles.tabBar,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={[styles.iconCircle, focused && styles.iconCircleActive]}>
              <Ionicons name={focused ? "home" : "home-outline"} size={22} color={focused ? "#051008" : K.colors.tabInactive} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="listings"
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={[styles.iconCircle, focused && styles.iconCircleActive]}>
              <Ionicons name={focused ? "list" : "list-outline"} size={22} color={focused ? "#051008" : K.colors.tabInactive} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={[styles.iconCircle, focused && styles.iconCircleActive]}>
              <Ionicons name={focused ? "calendar" : "calendar-outline"} size={22} color={focused ? "#051008" : K.colors.tabInactive} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={[styles.iconCircle, focused && styles.iconCircleActive]}>
              <Ionicons name={focused ? "bar-chart" : "bar-chart-outline"} size={22} color={focused ? "#051008" : K.colors.tabInactive} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={[styles.iconCircle, focused && styles.iconCircleActive]}>
              <Ionicons name={focused ? "person" : "person-outline"} size={22} color={focused ? "#051008" : K.colors.tabInactive} />
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="channels"
        options={{
          tabBarIcon: ({ focused }) => (
            <View style={[styles.iconCircle, focused && styles.iconCircleActive]}>
              <Ionicons name={focused ? "chatbubbles" : "chatbubbles-outline"} size={22} color={focused ? "#051008" : K.colors.tabInactive} />
            </View>
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: "absolute",
    bottom: 16,
    left: 20,
    right: 20,
    height: 68,
    borderRadius: K.radius.xxxl,
    backgroundColor: K.colors.tabBarBg,
    borderTopWidth: 0,
    ...K.shadow.xl,
  },
  iconCircle: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "transparent",
  },
  iconCircleActive: {
    backgroundColor: K.colors.tabActive,
  },
});
