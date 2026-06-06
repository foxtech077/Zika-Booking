import { useRef, useState } from "react";
import {
  View,
  Text,
  Dimensions,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  type ViewToken,
} from "react-native";
import { router } from "expo-router";
import { K } from "../../constants/theme";
import { useAuthStore } from "../../store/auth";

const { width } = Dimensions.get("window");

const SLIDES = [
  {
    id: "1",
    icon: "🌍",
    title: "Reach Global\nTravelers",
    subtitle:
      "List your hotel, apartment, or rental vehicle and connect with travelers from over 180 countries. Your property — worldwide visibility.",
    accent: K.colors.accent,
  },
  {
    id: "2",
    icon: "📈",
    title: "Elevate Your\nEarning Potential",
    subtitle:
      "Smart pricing tools, real-time analytics, and automated booking management. Turn every vacancy into revenue with Kainook's intelligent platform.",
    accent: "#00C07B",
  },
  {
    id: "3",
    icon: "🛡️",
    title: "Built on\nTrust",
    subtitle:
      "Verified guests, secure payments, and 24/7 host protection. We handle the security so you can focus on delivering exceptional experiences.",
    accent: "#00D68F",
  },
] as const;

export default function OnboardingScreen() {
  const [activeIndex, setActiveIndex] = useState(0);
  const flatRef = useRef<FlatList>(null);
  const setCompletedOnboarding = useAuthStore((s) => s.setCompletedOnboarding);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems[0]?.index != null) {
      setActiveIndex(viewableItems[0].index);
    }
  }).current;

  async function goNext() {
    if (activeIndex < SLIDES.length - 1) {
      flatRef.current?.scrollToIndex({ index: activeIndex + 1, animated: true });
    } else {
      await setCompletedOnboarding(true);
      router.replace("/(auth)/login");
    }
  }

  async function skip() {
    await setCompletedOnboarding(true);
    router.replace("/(auth)/login");
  }

  return (
    <View style={styles.container}>
      {/* Skip */}
      <TouchableOpacity style={styles.skipBtn} onPress={skip}>
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>

      {/* Slides */}
      <FlatList
        ref={flatRef}
        data={SLIDES}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width }]}>
            <View style={[styles.iconRing, { backgroundColor: item.accent + "26" }]}>
              <View style={[styles.iconInner, { backgroundColor: item.accent + "40" }]}>
                <Text style={styles.iconText}>{item.icon}</Text>
              </View>
            </View>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.subtitle}>{item.subtitle}</Text>
          </View>
        )}
      />

      {/* Dots */}
      <View style={styles.dots}>
        {SLIDES.map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i === activeIndex ? styles.dotActive : styles.dotInactive,
            ]}
          />
        ))}
      </View>

      {/* CTA */}
      <TouchableOpacity style={styles.cta} onPress={goNext} activeOpacity={0.85}>
        <Text style={styles.ctaText}>
          {activeIndex === SLIDES.length - 1 ? "Get Started" : "Continue"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.signInLink} onPress={skip}>
        <Text style={styles.signInLinkText}>
          Already a partner?{" "}
          <Text style={styles.signInLinkBold}>Sign In</Text>
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: K.colors.darkGreen,
    alignItems: "center",
  },
  skipBtn: {
    position: "absolute",
    top: 56,
    right: 24,
    zIndex: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: K.colors.glassBg,
    borderRadius: K.radius.full,
    borderWidth: 1,
    borderColor: K.colors.glassBorder,
  },
  skipText: {
    color: K.colors.textLightMuted,
    fontSize: K.font.sm,
    fontWeight: "600",
  },
  slide: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 36,
    paddingTop: 80,
    paddingBottom: 40,
  },
  iconRing: {
    width: 180,
    height: 180,
    borderRadius: 90,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 44,
  },
  iconInner: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: {
    fontSize: 52,
  },
  title: {
    fontSize: K.font.xxxl,
    fontWeight: "800",
    color: K.colors.textLight,
    textAlign: "center",
    lineHeight: 38,
    marginBottom: 20,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: K.font.base,
    color: K.colors.textLightMuted,
    textAlign: "center",
    lineHeight: 24,
    fontWeight: "400",
  },
  dots: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 28,
  },
  dot: {
    height: 6,
    borderRadius: K.radius.full,
  },
  dotActive: {
    width: 24,
    backgroundColor: K.colors.accent,
  },
  dotInactive: {
    width: 6,
    backgroundColor: K.colors.glassBorder,
  },
  cta: {
    width: width - 48,
    height: 54,
    backgroundColor: K.colors.accent,
    borderRadius: K.radius.lg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  ctaText: {
    color: "#FFFFFF",
    fontSize: K.font.lg,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  signInLink: {
    marginBottom: 48,
  },
  signInLinkText: {
    color: K.colors.textLightMuted,
    fontSize: K.font.sm,
  },
  signInLinkBold: {
    color: K.colors.accentLight,
    fontWeight: "700",
  },
});
