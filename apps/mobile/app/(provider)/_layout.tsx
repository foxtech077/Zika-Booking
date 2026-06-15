import { Tabs, Redirect } from "expo-router";
import { View, StyleSheet } from "react-native";
import { useAuthStore } from "../../store/auth";
import { K } from "../../constants/theme";

// SVG-less icon set using Unicode for NativeWind compatibility
function HomeIcon({ active }: { active: boolean }) {
  return (
    <View style={[styles.iconWrap, active && styles.iconWrapActive]}>
      <View style={[styles.houseBase, { borderColor: active ? K.colors.accent : K.colors.tabInactive }]}>
        <View style={[styles.houseDoor, { backgroundColor: active ? K.colors.accent : K.colors.tabInactive }]} />
      </View>
    </View>
  );
}

function ListingsIcon({ active }: { active: boolean }) {
  const c = active ? K.colors.accent : K.colors.tabInactive;
  return (
    <View style={styles.iconWrap}>
      <View style={[styles.listLine, { backgroundColor: c, width: 18 }]} />
      <View style={[styles.listLine, { backgroundColor: c, width: 14, marginTop: 4 }]} />
      <View style={[styles.listLine, { backgroundColor: c, width: 18, marginTop: 4 }]} />
    </View>
  );
}

function BookingsIcon({ active }: { active: boolean }) {
  const c = active ? K.colors.accent : K.colors.tabInactive;
  return (
    <View style={[styles.calWrap, { borderColor: c }]}>
      <View style={[styles.calDot, { backgroundColor: c }]} />
      <View style={[styles.calDot, { backgroundColor: c }]} />
      <View style={[styles.calDot, { backgroundColor: c }]} />
    </View>
  );
}

function AnalyticsIcon({ active }: { active: boolean }) {
  const c = active ? K.colors.accent : K.colors.tabInactive;
  return (
    <View style={styles.barWrap}>
      <View style={[styles.bar, { height: 8, backgroundColor: c }]} />
      <View style={[styles.bar, { height: 14, backgroundColor: c }]} />
      <View style={[styles.bar, { height: 10, backgroundColor: c }]} />
      <View style={[styles.bar, { height: 18, backgroundColor: c }]} />
    </View>
  );
}

function ProfileIcon({ active }: { active: boolean }) {
  const c = active ? K.colors.accent : K.colors.tabInactive;
  return (
    <View style={styles.iconWrap}>
      <View style={[styles.profileHead, { borderColor: c }]} />
      <View style={[styles.profileShoulders, { borderColor: c }]} />
    </View>
  );
}

function ChannelsIcon({ active }: { active: boolean }) {
  const c = active ? K.colors.accent : K.colors.tabInactive;
  return (
    <View style={{ width: 28, height: 28, alignItems: "center", justifyContent: "center" }}>
      {/* Chain-link shape: two rounded rectangles joined by a bar */}
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View style={{ width: 11, height: 7, borderRadius: 3.5, borderWidth: 2, borderColor: c }} />
        <View style={{ width: 4, height: 2, backgroundColor: c }} />
        <View style={{ width: 11, height: 7, borderRadius: 3.5, borderWidth: 2, borderColor: c }} />
      </View>
    </View>
  );
}

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
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: K.colors.tabActive,
        tabBarInactiveTintColor: K.colors.tabInactive,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ focused }) => <HomeIcon active={focused} />,
        }}
      />
      <Tabs.Screen
        name="listings"
        options={{
          title: "Listings",
          tabBarIcon: ({ focused }) => <ListingsIcon active={focused} />,
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: "Bookings",
          tabBarIcon: ({ focused }) => <BookingsIcon active={focused} />,
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          title: "Analytics",
          tabBarIcon: ({ focused }) => <AnalyticsIcon active={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ focused }) => <ProfileIcon active={focused} />,
        }}
      />
      <Tabs.Screen
        name="channels"
        options={{
          title: "Channels",
          tabBarIcon: ({ focused }) => <ChannelsIcon active={focused} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: K.colors.tabBarBg,
    borderTopWidth: 1,
    borderTopColor: K.colors.tabBarBorder,
    height: 80,
    paddingBottom: 16,
    paddingTop: 10,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.3,
  },

  // Icon shapes
  iconWrap: { alignItems: "center", justifyContent: "center", width: 28, height: 28 },
  iconWrapActive: {},
  houseBase: { width: 20, height: 14, borderWidth: 2, borderRadius: 2, alignItems: "center", justifyContent: "flex-end" },
  houseDoor: { width: 6, height: 8, borderRadius: 1, marginBottom: -1 },
  listLine: { height: 2.5, borderRadius: 2 },
  calWrap: { width: 20, height: 18, borderWidth: 2, borderRadius: 3, flexDirection: "row", alignItems: "center", justifyContent: "space-around", paddingHorizontal: 2 },
  calDot: { width: 3, height: 3, borderRadius: 1.5 },
  barWrap: { flexDirection: "row", alignItems: "flex-end", gap: 3, height: 22 },
  bar: { width: 5, borderRadius: 2 },
  profileHead: { width: 14, height: 14, borderRadius: 7, borderWidth: 2, marginBottom: 2 },
  profileShoulders: { width: 22, height: 10, borderRadius: 11, borderWidth: 2, borderBottomWidth: 0 },
});
