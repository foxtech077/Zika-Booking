import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { K } from "../../constants/theme";

const { width: SCREEN_W } = Dimensions.get("window");
const DRAWER_W = Math.min(SCREEN_W * 0.88, 360);

interface Props {
  open: boolean;
  onClose: () => void;
}

interface DashboardCache {
  unreadMessages?: number;
  pendingReviews?: number;
}

function comingSoon(feature: string) {
  Alert.alert(feature, "This feature is coming soon!", [{ text: "Got it" }]);
}

function DrawerRow({
  icon,
  label,
  sub,
  badge,
  onPress,
}: {
  icon: string;
  label: string;
  sub?: string;
  badge?: number;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={d.row} onPress={onPress} activeOpacity={0.75}>
      <View style={d.rowIcon}>
        <Ionicons name={icon as any} size={18} color={K.colors.darkGreen} />
      </View>
      <View style={d.rowBody}>
        <Text style={d.rowLabel}>{label}</Text>
        {sub ? <Text style={d.rowSub}>{sub}</Text> : null}
      </View>
      {badge != null && badge > 0 ? (
        <View style={d.badgeWrap}>
          <Text style={d.badgeText}>{badge > 99 ? "99+" : badge}</Text>
        </View>
      ) : (
        <Ionicons name="chevron-forward" size={15} color="#C8CCC9" />
      )}
    </TouchableOpacity>
  );
}

function SectionLabel({ title }: { title: string }) {
  return <Text style={d.sectionLabel}>{title}</Text>;
}

function SectionDivider() {
  return <View style={d.divider} />;
}

export function BurgerDrawer({ open, onClose }: Props) {
  const qc     = useQueryClient();
  const slide  = useRef(new Animated.Value(DRAWER_W)).current;
  const fade   = useRef(new Animated.Value(0)).current;
  const [visible, setVisible] = useState(false);

  const dash    = qc.getQueryData<DashboardCache>(["providerDashboard"]);
  const unread  = dash?.unreadMessages ?? 0;
  const reviews = dash?.pendingReviews ?? 0;

  function navigate(path: string) {
    onClose();
    setTimeout(() => router.push(path as any), 240);
  }

  useEffect(() => {
    if (open) {
      setVisible(true);
      Animated.parallel([
        Animated.timing(slide, { toValue: 0,         duration: 280, easing: Easing.poly(4), useNativeDriver: true }),
        Animated.timing(fade,  { toValue: 1,         duration: 280, easing: Easing.poly(4), useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slide, { toValue: DRAWER_W,  duration: 240, easing: Easing.poly(4), useNativeDriver: true }),
        Animated.timing(fade,  { toValue: 0,         duration: 240, easing: Easing.poly(4), useNativeDriver: true }),
      ]).start(() => setVisible(false));
    }
  }, [open]);

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {/* Backdrop */}
      <Animated.View style={[d.backdrop, { opacity: fade }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />
      </Animated.View>

      {/* Drawer panel */}
      <Animated.View style={[d.panel, { transform: [{ translateX: slide }] }]}>
        <SafeAreaView edges={["top", "bottom"]} style={d.inner}>
          {/* Header */}
          <View style={d.header}>
            <Text style={d.headerTitle}>Menu</Text>
            <TouchableOpacity style={d.closeBtn} onPress={onClose} activeOpacity={0.75}>
              <Ionicons name="close" size={20} color={K.colors.darkGreen} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={d.scroll}>
            {/* Business */}
            <SectionLabel title="BUSINESS" />
            <View style={d.card}>
              <DrawerRow
                icon="list-outline"
                label="My Listings"
                sub="Manage your properties & vehicles"
                onPress={() => navigate("/(provider)/listings")}
              />
              <SectionDivider />
              <DrawerRow
                icon="sync-outline"
                label="Calendar Sync"
                sub="iCal feeds & availability"
                onPress={() => navigate("/(provider)/channels")}
              />
            </View>

            {/* Communication */}
            <SectionLabel title="COMMUNICATION" />
            <View style={d.card}>
              <DrawerRow
                icon="chatbubbles-outline"
                label="Messages"
                sub="Guest conversations"
                badge={unread}
                onPress={() => comingSoon("Messages")}
              />
              <SectionDivider />
              <DrawerRow
                icon="star-outline"
                label="Reviews"
                sub="Ratings & responses"
                badge={reviews}
                onPress={() => navigate("/(provider)/reviews")}
              />
            </View>

            {/* Finance */}
            <SectionLabel title="FINANCE" />
            <View style={d.card}>
              <DrawerRow
                icon="card-outline"
                label="Payout Setup"
                sub="Connect Stripe for payouts"
                onPress={() => navigate("/(provider)/stripe-connect")}
              />
              <SectionDivider />
              <DrawerRow
                icon="wallet-outline"
                label="Payout History"
                sub="Scheduled & processed payouts"
                onPress={() => navigate("/(provider)/payouts")}
              />
              <SectionDivider />
              <DrawerRow
                icon="receipt-outline"
                label="Tax Information"
                sub="Tax ID & certificates"
                onPress={() => comingSoon("Tax Information")}
              />
            </View>

            {/* Tools */}
            <SectionLabel title="TOOLS" />
            <View style={d.card}>
              <DrawerRow
                icon="document-text-outline"
                label="Verification Docs"
                sub="Upload required documents"
                onPress={() => comingSoon("Verification Documents")}
              />
              <SectionDivider />
              <DrawerRow
                icon="help-circle-outline"
                label="Help & Support"
                sub="FAQs, contact us"
                onPress={() => navigate("/help")}
              />
              <SectionDivider />
              <DrawerRow
                icon="shield-checkmark-outline"
                label="Privacy Policy"
                onPress={() => {
                  onClose();
                  setTimeout(() => router.push({ pathname: "/legal/[doc]", params: { doc: "privacy" } } as any), 240);
                }}
              />
              <SectionDivider />
              <DrawerRow
                icon="document-text-outline"
                label="Terms & Conditions"
                onPress={() => {
                  onClose();
                  setTimeout(() => router.push({ pathname: "/legal/[doc]", params: { doc: "terms" } } as any), 240);
                }}
              />
            </View>

            <View style={{ height: 24 }} />
          </ScrollView>
        </SafeAreaView>
      </Animated.View>
    </Modal>
  );
}

const d = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  panel: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: DRAWER_W,
    backgroundColor: "#F5F4F1",
  },
  inner: { flex: 1 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: K.colors.border,
    backgroundColor: "#fff",
  },
  headerTitle: { fontSize: 18, fontWeight: "800", color: K.colors.darkGreen },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: K.colors.bgSubtle,
    alignItems: "center",
    justifyContent: "center",
  },

  scroll: { paddingBottom: 8 },

  sectionLabel: {
    fontSize: 10,
    fontWeight: "800",
    color: K.colors.textMuted,
    letterSpacing: 1.2,
    marginHorizontal: 16,
    marginTop: 20,
    marginBottom: 8,
  },

  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: K.colors.border,
    marginHorizontal: 12,
    overflow: "hidden",
    ...K.shadow.sm,
  },

  row:      { flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 16, gap: 12 },
  rowIcon:  { width: 36, height: 36, borderRadius: 10, backgroundColor: K.colors.bgSubtle, alignItems: "center", justifyContent: "center" },
  rowBody:  { flex: 1 },
  rowLabel: { fontSize: 14, fontWeight: "600", color: K.colors.textDark },
  rowSub:   { fontSize: 11, color: K.colors.textMuted, marginTop: 2 },

  badgeWrap: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: K.colors.accent,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 5,
  },
  badgeText: { fontSize: 11, fontWeight: "800", color: "#fff" },

  divider: { height: 1, backgroundColor: K.colors.border, marginHorizontal: 16 },
});
