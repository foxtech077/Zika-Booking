import { useEffect, useRef, useState } from "react";
import { View, Text, Image, StyleSheet, Animated } from "react-native";
import { useRouter } from "expo-router";
import { useAuthStore } from "../store/auth";

export default function SplashScreen() {
  const router = useRouter();
  const { user, isHydrated } = useAuthStore();
  const [splashDone, setSplashDone] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const taglineFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, friction: 5, tension: 40, useNativeDriver: true }),
      ]),
      Animated.timing(taglineFade, { toValue: 1, duration: 500, delay: 200, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(() => setSplashDone(true), 2200);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!splashDone || !isHydrated) return;
    if (user) {
      router.replace("/(tabs)");
    } else {
      router.replace("/onboarding");
    }
  }, [splashDone, isHydrated, user]);

  return (
    <View style={styles.container}>
      {/* Logo card */}
      <Animated.View
        style={[
          styles.logoCard,
          { opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
        ]}
      >
        <Image
          source={require("../assets/kainook_logo.png")}
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>

      {/* Dot indicators */}
      <View style={styles.dotsRow}>
        <View style={[styles.dot, styles.dotActive]} />
        <View style={styles.dot} />
        <View style={styles.dot} />
      </View>

      {/* Tagline */}
      <Animated.View style={[styles.taglineWrap, { opacity: taglineFade }]}>
        <Text style={styles.tagline}>TRAVEL. DISCOVER. EXPERIENCE.</Text>
        <Text style={styles.taglineSub}>Premium concierge at your fingertips</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F0FFF4",
    alignItems: "center",
    justifyContent: "center",
  },
  logoCard: {
    width: 280,
    height: 180,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#1B5E20",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
    padding: 20,
  },
  logo: {
    width: 220,
    height: 130,
  },
  dotsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 32,
    alignItems: "center",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#BBF7D0",
  },
  dotActive: {
    backgroundColor: "#1B5E20",
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  taglineWrap: {
    position: "absolute",
    bottom: 60,
    alignItems: "center",
    paddingHorizontal: 32,
  },
  tagline: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1B5E20",
    letterSpacing: 2,
    textAlign: "center",
    marginBottom: 6,
  },
  taglineSub: {
    fontSize: 13,
    color: "#4B7860",
    textAlign: "center",
    fontWeight: "400",
  },
});
