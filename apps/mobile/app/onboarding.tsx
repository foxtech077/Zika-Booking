import { useRef, useState } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  FlatList,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

const { width: W, height: H } = Dimensions.get("window");
const GREEN = "#1B5E20";

const SLIDES = [
  {
    id: "1",
    badge: "Curated Stays",
    image: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80",
    title: "Discover hotels\nworldwide",
    subtitle:
      "Explore a curated selection of premium stays across the globe, tailored for the sophisticated traveler.",
  },
  {
    id: "2",
    badge: "Car Rentals",
    image: "https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=800&q=80",
    title: "Drive in style,\nyour way",
    subtitle:
      "Choose from a fleet of premium vehicles — from city compacts to 4×4 safari SUVs — delivered to your door.",
  },
  {
    id: "3",
    badge: "Long Stays",
    image: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&q=80",
    title: "Your home\naway from home",
    subtitle:
      "Find fully furnished apartments with long-stay discounts. Comfort, privacy, and value — all in one place.",
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList<typeof SLIDES[0]>>(null);

  function handleSkip() {
    router.replace("/(auth)/login");
  }

  function handleNext() {
    if (currentIndex < SLIDES.length - 1) {
      const next = currentIndex + 1;
      flatListRef.current?.scrollToIndex({ index: next, animated: true });
      setCurrentIndex(next);
    } else {
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
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          const index = Math.round(e.nativeEvent.contentOffset.x / W);
          setCurrentIndex(index);
        }}
        renderItem={({ item }) => (
          <View style={styles.slide}>
            <View style={styles.imageCard}>
              <Image
                source={{ uri: item.image }}
                style={styles.image}
                resizeMode="cover"
              />
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{item.badge}</Text>
              </View>
            </View>
          </View>
        )}
      />

      {/* Bottom sheet */}
      <View style={styles.bottomSheet}>
        <Text style={styles.title}>{SLIDES[currentIndex]!.title}</Text>
        <Text style={styles.subtitle}>{SLIDES[currentIndex]!.subtitle}</Text>

        {/* Dot indicators */}
        <View style={styles.dotsRow}>
          {SLIDES.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === currentIndex ? styles.dotActive : styles.dotInactive]}
            />
          ))}
        </View>

        {/* Next button */}
        <TouchableOpacity style={styles.nextBtn} onPress={handleNext} activeOpacity={0.85}>
          <Text style={styles.nextBtnText}>{isLast ? "Get Started" : "Next"}</Text>
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
  container: { flex: 1, backgroundColor: "#F0FFF4" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 16,
  },
  headerLogo: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerLogoCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: GREEN,
    alignItems: "center",
    justifyContent: "center",
  },
  headerBrand: { fontSize: 16, fontWeight: "800", color: GREEN, letterSpacing: 1.5 },
  skipText: { fontSize: 15, color: "#4B7860", fontWeight: "500" },

  slide: { width: W, paddingHorizontal: 24, alignItems: "center" },
  imageCard: {
    width: "100%",
    height: H * 0.42,
    borderRadius: 28,
    overflow: "hidden",
    position: "relative",
    backgroundColor: "#D1FAE5",
  },
  image: { width: "100%", height: "100%" },
  badge: {
    position: "absolute",
    top: 16,
    right: 16,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  badgeText: { fontSize: 13, fontWeight: "700", color: GREEN },

  bottomSheet: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    paddingHorizontal: 28,
    paddingTop: 28,
    paddingBottom: 36,
    alignItems: "center",
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: GREEN,
    textAlign: "center",
    lineHeight: 34,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    color: "#4B7860",
    textAlign: "center",
    lineHeight: 21,
    marginBottom: 22,
  },

  dotsRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 24 },
  dot: { height: 8, borderRadius: 4 },
  dotActive: { width: 28, backgroundColor: GREEN },
  dotInactive: { width: 8, backgroundColor: "#D1FAE5" },

  nextBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: GREEN,
    borderRadius: 16,
    paddingVertical: 16,
    width: "100%",
  },
  nextBtnText: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
});
