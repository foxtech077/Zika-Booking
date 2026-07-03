import { View, Text, TouchableOpacity, Image, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useAuthStore } from "../../store/auth";
import { useUnreadNotificationCount } from "../../hooks/notifications";
import { K } from "../../constants/theme";

interface Props {
  onBurgerPress: () => void;
}

function timeGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning,";
  if (h < 17) return "Good afternoon,";
  return "Good evening,";
}

export function AppHeader({ onBurgerPress }: Props) {
  const user = useAuthStore((s) => s.user);
  const { data: notifData } = useUnreadNotificationCount();
  const unreadCount = notifData?.count ?? 0;

  return (
    <SafeAreaView edges={["top"]} style={s.safe}>
      <View style={s.row}>
        <View style={s.logoWrap}>
          {/*
            The source PNG is the full lockup (icon + "KAINOOK" wordmark + tagline)
            on a solid white background — there's no icon-only crop available.
            Showing it "contain"-fit at badge size made the wordmark illegible and,
            worse, its white background clashed against a colored box. Instead we
            zoom/crop into just the icon mark (top portion of the image) and let it
            sit directly on the header's own white background so there's no seam.
          */}
          <Image
            source={require("../../assets/kainook_logo.png")}
            style={s.logo}
            resizeMode="cover"
          />
        </View>

        <View style={s.mid}>
          <Text style={s.greet}>{timeGreeting()}</Text>
          <Text style={s.name} numberOfLines={1}>
            {user?.firstName ?? "Partner"}
          </Text>
        </View>

        <View style={s.actions}>
          <TouchableOpacity
            style={s.iconBtn}
            onPress={() => router.push("/notifications" as any)}
            activeOpacity={0.75}
          >
            <Ionicons name="notifications-outline" size={21} color={K.colors.textMid} />
            {unreadCount > 0 && (
              <View style={s.badge}>
                <Text style={s.badgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={s.burgerBtn} onPress={onBurgerPress} activeOpacity={0.75}>
            <Ionicons name="menu" size={22} color={K.colors.darkGreen} />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: {
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: K.colors.border,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  logoWrap: {
    width: 44,
    height: 44,
    overflow: "hidden",
    alignItems: "flex-start",
    justifyContent: "flex-start",
  },
  // The icon mark (the "K" + globe) only occupies roughly the top ~55% of the
  // source image; everything below that is the wordmark + tagline. Rendering
  // the image oversized and shifted up/left crops into just that icon region
  // instead of shrinking the whole lockup down to an illegible thumbnail.
  logo: { width: 80, height: 80, marginTop: -4, marginLeft: -18 },
  mid:   { flex: 1 },
  greet: { fontSize: 11, color: K.colors.textMuted, fontWeight: "500" },
  name:  { fontSize: 16, fontWeight: "800", color: K.colors.darkGreen, letterSpacing: -0.3 },
  actions: { flexDirection: "row", alignItems: "center", gap: 6 },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#ef4444",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { fontSize: 9, fontWeight: "800", color: "#fff" },
  burgerBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: K.colors.bgSubtle,
    alignItems: "center",
    justifyContent: "center",
  },
});
