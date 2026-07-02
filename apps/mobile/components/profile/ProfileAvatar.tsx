import { useEffect, useRef, useState } from "react";
import { View, Text, Animated, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { LoyaltyTier } from "@zika/types";
import { TierProfileRing } from "./TierProfileRing";
import { UploadProgressOverlay } from "./UploadProgressOverlay";
import { TIER_COLORS } from "../../constants/loyaltyTiers";
import { K } from "../../constants/theme";
import type { PhotoUploadState } from "../../hooks/useProfilePhotoUpload";
import { refreshProfilePhoto } from "../../hooks/profile";

interface Props {
  photoUrl?: string | null;
  firstName?: string;
  lastName?: string;
  tier: LoyaltyTier;
  size?: number;
  onPress?: () => void;
  uploadState?: PhotoUploadState;
  uploadProgress?: number;
}

function initialsOf(firstName?: string, lastName?: string): string {
  const a = firstName?.[0] ?? "";
  const b = lastName?.[0] ?? "";
  return (a + b).toUpperCase() || "?";
}

export function ProfileAvatar({
  photoUrl,
  firstName,
  lastName,
  tier,
  size = 96,
  onPress,
  uploadState = "idle",
  uploadProgress = 0,
}: Props) {
  const imageOpacity = useRef(new Animated.Value(0)).current;
  const successScale = useRef(new Animated.Value(1)).current;
  const [prevUploadState, setPrevUploadState] = useState(uploadState);
  const [imageFailed, setImageFailed] = useState(false);
  // The URI actually rendered — kept separate from the `photoUrl` prop so a
  // failed load can be silently swapped for a freshly-refreshed presigned URL
  // (see handleImageError) without ever dropping to the initials fallback for
  // a photo we know exists.
  const [displayUri, setDisplayUri] = useState(photoUrl ?? null);
  const refreshAttemptedRef = useRef(false);
  // Tracks the last URL we've already accounted for, as a ref (not state) so
  // it updates synchronously the instant a refresh resolves — this closes a
  // race where refreshProfilePhoto()'s own store update echoes a new photoUrl
  // prop back down before local state has re-rendered, which made the effect
  // below think it was seeing a brand-new photo and reset the retry guard,
  // causing it to refresh forever when a "fresh" URL fails for a persistent
  // (non-expiry) reason.
  const baselineUrlRef = useRef(photoUrl ?? null);

  // A new photoUrl arrived (initial load, or after edit-profile/upload) — show
  // it and clear any previous failure/retry state.
  useEffect(() => {
    const incoming = photoUrl ?? null;
    if (incoming !== baselineUrlRef.current) {
      baselineUrlRef.current = incoming;
      setDisplayUri(incoming);
      setImageFailed(false);
      refreshAttemptedRef.current = false;
      imageOpacity.setValue(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photoUrl]);

  async function handleImageError() {
    console.warn("[ProfileAvatar] Failed to load photo (likely an expired presigned URL):", displayUri);
    if (refreshAttemptedRef.current) {
      // Already tried refreshing once for this photo and the fresh URL still
      // failed — stop here and fall back to initials instead of looping.
      setImageFailed(true);
      return;
    }
    refreshAttemptedRef.current = true;
    const freshUrl = await refreshProfilePhoto();
    if (freshUrl) {
      // Mark this as the known-current URL *before* the store update this
      // triggers can echo back down as a `photoUrl` prop change — see the
      // baselineUrlRef comment above.
      baselineUrlRef.current = freshUrl;
    }
    if (freshUrl && freshUrl !== displayUri) {
      // Swap in the new URL. Opacity is left untouched (already 1 from the
      // last successful render) so the avatar never flashes to blank while
      // the new URI loads in the background.
      setDisplayUri(freshUrl);
    } else {
      setImageFailed(true);
    }
  }

  useEffect(() => {
    if (uploadState === "success" && prevUploadState !== "success") {
      Animated.sequence([
        Animated.spring(successScale, { toValue: 1.08, useNativeDriver: true, speed: 20, bounciness: 10 }),
        Animated.spring(successScale, { toValue: 1, useNativeDriver: true, speed: 20, bounciness: 6 }),
      ]).start();
    }
    setPrevUploadState(uploadState);
  }, [uploadState, prevUploadState, successScale]);

  const isUploading = uploadState !== "idle" && uploadState !== "success" && uploadState !== "error";
  const showRingProgress = uploadState === "uploading";
  const overlayLabel = uploadState === "compressing" ? "Preparing…"
    : uploadState === "presigning" ? "Preparing…"
    : uploadState === "uploading" ? `${Math.round(uploadProgress * 100)}%`
    : uploadState === "saving" ? "Saving…"
    : undefined;

  const Wrapper = onPress ? TouchableOpacity : View;

  return (
    <Animated.View style={{ transform: [{ scale: successScale }] }}>
      <Wrapper onPress={onPress} activeOpacity={0.85} disabled={isUploading}>
        <TierProfileRing tier={tier} size={size}>
          {displayUri && !imageFailed ? (
            <Animated.Image
              source={{ uri: displayUri }}
              style={{ width: size, height: size, opacity: imageOpacity }}
              onLoad={() => Animated.timing(imageOpacity, { toValue: 1, duration: 260, useNativeDriver: true }).start()}
              onError={() => void handleImageError()}
            />
          ) : (
            <View style={[s.initialsWrap, { width: size, height: size, backgroundColor: TIER_COLORS[tier] }]}>
              <Text style={[s.initialsText, { fontSize: size * 0.36 }]}>{initialsOf(firstName, lastName)}</Text>
            </View>
          )}

          {isUploading && (
            <UploadProgressOverlay
              size={size}
              progress={uploadProgress}
              label={overlayLabel}
              indeterminate={!showRingProgress}
            />
          )}
        </TierProfileRing>

        {onPress && !isUploading && (
          <View style={s.cameraBadge}>
            <Ionicons name="camera" size={14} color="#fff" />
          </View>
        )}
      </Wrapper>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  initialsWrap: { alignItems: "center", justifyContent: "center" },
  initialsText: { color: "#fff", fontWeight: "800" },
  cameraBadge: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: K.colors.darkGreen,
    borderWidth: 2,
    borderColor: K.colors.bgCard,
    alignItems: "center",
    justifyContent: "center",
  },
});
