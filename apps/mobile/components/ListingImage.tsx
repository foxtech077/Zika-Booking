import { useState, useRef, useEffect, memo } from "react";
import { View, Animated, StyleSheet } from "react-native";
import { Image, type ImageContentFit } from "expo-image";
import { useAuthStore } from "../store/auth";
import { useSignedPhoto } from "../lib/s3-client";
import { K } from "../constants/theme";

const CONTENT_FIT: Record<string, ImageContentFit> = {
  cover: "cover",
  contain: "contain",
  stretch: "fill",
  center: "contain",
};

// Same shimmer technique used by components/ui/SkeletonPulse.tsx, but sized to
// absolute-fill an arbitrary (often flex-based) container instead of a fixed
// width/height — SkeletonPulse's API doesn't fit that shape, so this is a
// dedicated instance of the same pattern rather than a prop-incompatible reuse.
function ShimmerPlaceholder() {
  const anim = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [anim]);
  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, imgStyles.placeholder, { opacity: anim }]}
    />
  );
}

function ListingImageInner({
  uri,
  style,
  resizeMode = "cover",
  onError,
  priority = "normal",
  recyclingKey,
}: {
  uri: string | null | undefined;
  style: any;
  resizeMode?: "cover" | "contain" | "stretch" | "center";
  onError?: () => void;
  priority?: "low" | "normal" | "high";
  /** Stable per-photo id inside recycled lists — without it a reused view keeps
   *  painting the previous row's photo until the new one decodes. */
  recyclingKey?: string;
}) {
  const token = useAuthStore((s) => s.accessToken);
  const { signedUrl } = useSignedPhoto(uri);
  const [loaded, setLoaded] = useState(false);

  // A recycled view gets a new `uri` without unmounting, so this has to reset
  // explicitly or the shimmer is skipped and the previous photo shows through.
  useEffect(() => {
    setLoaded(false);
  }, [signedUrl]);

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
      {/* Never a blank white box: a shimmering placeholder shows until the
          (opaque) photo has loaded and native-transitions in on top of it. */}
      {!loaded && <ShimmerPlaceholder />}
      <Image
        source={source}
        style={StyleSheet.absoluteFill}
        contentFit={CONTENT_FIT[resizeMode] ?? "cover"}
        cachePolicy="memory-disk"
        priority={priority}
        recyclingKey={recyclingKey ?? signedUrl}
        transition={300}
        onLoad={() => setLoaded(true)}
        onError={() => {
          setLoaded(true);
          onError?.();
        }}
      />
    </View>
  );
}

export const ListingImage = memo(ListingImageInner);

const imgStyles = StyleSheet.create({
  placeholder: { backgroundColor: K.colors.bgSubtle },
});
