import { useRef, useState } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  FlatList,
  Animated,
} from "react-native";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { Ionicons } from "@expo/vector-icons";

const { width: W, height: H } = Dimensions.get("window");
const ONBOARDING_DONE_KEY = "kainook_onboarding_done";

const SLIDES = [
  {
    id: "1",
    badge: "Curated Stays",
    badgeIcon: "star" as const,
    image: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80",
    title: "Discover hotels\nworldwide",
    subtitle:
      "Explore a curated selection of premium stays across the globe, tailored for the sophisticated traveler.",
  },
  {
    id: "2",
    badge: "Car Rentals",
    badgeIcon: "car-sport" as const,
    image: "https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=800&q=80",
    title: "Drive in style,\nyour way",
    subtitle:
      "Choose from a fleet of premium vehicles — from city compacts to 4×4 safari SUVs — delivered to your door.",
  },
  {
    id: "3",
    badge: "Long Stays",
    badgeIcon: "home" as const,
    image: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&q=80",
    title: "Your home\naway from home",
    subtitle:
      "Find fully furnished apartments with long-stay discounts. Comfort, privacy, and value — all in one place.",
  },
];

async function markOnboardingDone() {
  await SecureStore.setItemAsync(ONBOARDING_DONE_KEY, "1");
}

export default function OnboardingScreen() {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  const scrollX = useRef(new Animated.Value(0)).current;

  async function handleSkip() {
    await markOnboardingDone();
    router.replace("/(auth)/login");
  }

  async function handleNext() {
    if (currentIndex < SLIDES.length - 1) {
      const next = currentIndex + 1;
      flatListRef.current?.scrollToIndex({ index: next, animated: true });
      setCurrentIndex(next);
    } else {
      await markOnboardingDone();
      router.replace("/(auth)/login");
    }
  }

  const isLast = currentIndex === SLIDES.length - 1;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLogo}>
          <View style={styles.headerLogoCircle}>
            <Ionicons name="globe" size={18} color="#fff" />
          </View>
          <Text style={styles.headerBrand}>KAINOOK</Text>
        </View>
        <TouchableOpacity onPress={handleSkip} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>

      {/* Slides */}
      <FlatList
        ref={flatListRef}
        data={SLIDES}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        scrollEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false }
        )}
        onMomentumScrollEnd={(e) => {
          const index = Math.round(e.nativeEvent.contentOffset.x / W);
          setCurrentIndex(index);
        }}
        renderItem={({ item }) => (
          <View style={styles.slide}>
            {/* Image card */}
            <View style={styles.imageCard}>
              <Image source={{ uri: item.image }} style={styles.image} resizeMode="cover" />
              {/* Badge */}
              <View style={styles.badge}>
                <Ionicons name={item.badgeIcon} size={13} color="#1B5E20" />
                <Text style={styles.badgeText}>{item.badge}</Text>
              </View>
            </View>
          </View>
        )}
        scrollEventThrottle={16}
      />

      {/* Bottom sheet */}
      <View style={styles.bottomSheet}>
        <Text style={styles.title}>{SLIDES[currentIndex].title}</Text>
        <Text style={styles.subtitle}>{SLIDES[currentIndex].subtitle}</Text>

        {/* Dot indicators */}
        <View style={styles.dotsRow}>
          {SLIDES.map((_, i) => {
            const isActive = i === currentIndex;
            return (
              <View
                key={i}
                style={[
                  styles.dot,
                  isActive ? styles.dotActive : styles.dotInactive,
                ]}
              />
            );
          })}
        </View>

        {/* Next / Get Started button */}
        <TouchableOpacity style={styles.nextBtn} onPress={handleNext} activeOpacity={0.85}>
          <Text style={styles.nextBtnText}>
            {isLast ? "Get Started" : "Next"}
          </Text>
          <Ionicons
            name={isLast ? "checkmark" : "arrow-forward"}
            size={18}
            color="#fff"
            style={{ marginLeft: 8 }}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F0FFF4",
  },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 16,
  },
  headerLogo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerLogoCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#1B5E20",
    alignItems: "center",
    justifyContent: "center",
  },
  headerBrand: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1B5E20",
    letterSpacing: 1.5,
  },
  skipText: {
    fontSize: 15,
    color: "#4B7860",
    fontWeight: "500",
  },

  // Slide
  slide: {
    width: W,
    paddingHorizontal: 24,
    alignItems: "center",
  },
  imageCard: {
    width: "100%",
    height: H * 0.44,
    borderRadius: 28,
    overflow: "hidden",
    position: "relative",
    backgroundColor: "#D1FAE5",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  badge: {
    position: "absolute",
    top: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(255,255,255,0.88)",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backdropFilter: "blur(8px)",
  },
  badgeText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1B5E20",
  },

  // Bottom sheet
  bottomSheet: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    paddingHorizontal: 28,
    paddingTop: 28,
    paddingBottom: 36,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 12,
  },
  title: {
    fontSize: 30,
    fontWeight: "800",
    color: "#1B5E20",
    textAlign: "center",
    lineHeight: 36,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 15,
    color: "#4B7860",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },

  // Dots
  dotsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 28,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  dotActive: {
    width: 28,
    backgroundColor: "#1B5E20",
  },
  dotInactive: {
    width: 8,
    backgroundColor: "#D1FAE5",
  },

  // Button
  nextBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1B5E20",
    borderRadius: 16,
    paddingVertical: 17,
    width: "100%",
    shadowColor: "#1B5E20",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  nextBtnText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
});
