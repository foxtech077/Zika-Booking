import { View, Animated, StyleSheet } from "react-native";
import { useRef } from "react";
import { useAuthStore } from "../store/auth";
import { useSignedPhoto } from "../lib/s3-client";

export function ListingImage({
  uri,
  style,
  resizeMode = "cover",
  onError,
}: {
  uri: string | null | undefined;
  style: any;
  resizeMode?: "cover" | "contain" | "stretch" | "center";
  onError?: () => void;
}) {
  const token = useAuthStore((s) => s.accessToken);
  const { signedUrl } = useSignedPhoto(uri);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  function handleLoad() {
    Animated.timing(fadeAnim, { toValue: 1, duration: 280, useNativeDriver: true }).start();
  }

  if (!signedUrl) {
    return <View style={[style, imgStyles.placeholder]} />;
  }

  const isApiUrl =
    signedUrl.includes("api.kainook.com") && !signedUrl.includes("amazonaws.com");

  const source = isApiUrl && token
    ? { uri: signedUrl, headers: { Authorization: `Bearer ${token}` } }
    : { uri: signedUrl };

  return (
    <View style={style}>
      <View style={[StyleSheet.absoluteFill, imgStyles.placeholder]} />
      <Animated.Image
        source={source}
        style={[StyleSheet.absoluteFill, { opacity: fadeAnim }]}
        resizeMode={resizeMode}
        onLoad={handleLoad}
        onError={onError}
      />
    </View>
  );
}

const imgStyles = StyleSheet.create({
  placeholder: { backgroundColor: "#e5e7eb" },
});
