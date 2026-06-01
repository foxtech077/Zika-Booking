import { useEffect, useRef } from "react";
import { View, Text, Animated, Image, StyleSheet, Dimensions } from "react-native";
import { Redirect } from "expo-router";
import { useAuthStore } from "../store/auth";
import { K } from "../constants/theme";

const { width } = Dimensions.get("window");

export default function SplashScreen() {
  const { user, isHydrated } = useAuthStore();
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.85)).current;
  const barWidth = useRef(new Animated.Value(0)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(logoOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.spring(logoScale, { toValue: 1, tension: 80, friction: 8, useNativeDriver: true }),
      ]),
      Animated.timing(taglineOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(barWidth, { toValue: width * 0.55, duration: 1200, useNativeDriver: false }),
    ]).start();
  }, []);

  if (isHydrated) {
    if (user) {
      if (user.userType === "guest") {
        return <Redirect href="/(tabs)" />;
      } else if (user.userType === "provider") {
        if (user.status === "pending_verification") {
          return <Redirect href="/pending-approval" />;
        } else if (user.status === "suspended" || user.status === "banned") {
          return <Redirect href="/suspended" />;
        } else {
          return <Redirect href={"/(provider)" as any} />;
        }
      }
    }
    
    const onboardingCompleted = useAuthStore.getState().hasCompletedOnboarding;
    if (onboardingCompleted) {
      return <Redirect href="/(auth)/login" />;
    }
    return <Redirect href="/(auth)/onboarding" />;
  }

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.logoBlock, { opacity: logoOpacity, transform: [{ scale: logoScale }] }]}>
        <View style={styles.logoContainer}>
          <Image
            source={require("../assets/logo.png")}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </View>
      </Animated.View>

      <Animated.Text style={[styles.tagline, { opacity: taglineOpacity }]}>
        Travel. Discover. Experience.
      </Animated.Text>

      <View style={styles.barTrack}>
        <Animated.View style={[styles.barFill, { width: barWidth }]} />
      </View>

      <Text style={styles.version}>v2.4.0</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: K.colors.darkGreen,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
  },
  logoBlock: {
    alignItems: "center",
    marginBottom: 12,
  },
  logoContainer: {
    width: 200,
    height: 200,
    borderRadius: 28,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 10,
  },
  logoImage: {
    width: 185,
    height: 185,
  },
  tagline: {
    fontSize: 13,
    color: K.colors.textLightMuted,
    letterSpacing: 3,
    textTransform: "uppercase",
    marginBottom: 48,
  },
  barTrack: {
    width: width * 0.55,
    height: 3,
    backgroundColor: K.colors.glassBg,
    borderRadius: K.radius.full,
    overflow: "hidden",
  },
  barFill: {
    height: 3,
    backgroundColor: K.colors.accent,
    borderRadius: K.radius.full,
  },
  version: {
    position: "absolute",
    bottom: 40,
    fontSize: 12,
    color: K.colors.textLightDim,
    letterSpacing: 1,
  },
});
