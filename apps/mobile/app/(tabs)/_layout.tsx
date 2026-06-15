import { Tabs, Redirect } from "expo-router";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../../store/auth";
import { K } from "../../constants/theme";

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

function TabIcon({
  name,
  focused,
}: {
  name: IoniconName;
  focused: boolean;
}) {
  return (
    <View
      style={{
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: focused ? K.colors.tabActive : "transparent",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Ionicons
        name={name}
        size={22}
        color={focused ? "#051008" : K.colors.tabInactive}
      />
    </View>
  );
}

export default function TabLayout() {
  const user = useAuthStore((s) => s.user);
  if (!user) return <Redirect href="/(auth)/login" />;

  if (user.userType === "provider") {
    if (user.status === "pending_verification") return <Redirect href="/pending-approval" />;
    if (user.status === "suspended" || user.status === "banned") return <Redirect href="/suspended" />;
    return <Redirect href="/(provider)" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarStyle: {
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
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? "home" : "home-outline"} focused={focused} />
          ),
        }}
      />

      <Tabs.Screen
        name="saved"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? "heart" : "heart-outline"} focused={focused} />
          ),
        }}
      />

      <Tabs.Screen
        name="bookings"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? "calendar" : "calendar-outline"} focused={focused} />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? "person" : "person-outline"} focused={focused} />
          ),
        }}
      />

      <Tabs.Screen
        name="dashboard"
        options={{
          href: null,
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? "grid" : "grid-outline"} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}
