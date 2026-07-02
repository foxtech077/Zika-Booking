import { useEffect, useRef, useState } from "react";
import { View, Text, TouchableOpacity, Alert, Animated, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { LoyaltyTier } from "@zika/types";
import { K } from "../../constants/theme";
import { ProfileAvatar } from "./ProfileAvatar";
import { TierBadge } from "./TierBadge";
import { ProfilePhotoBottomSheet } from "./ProfilePhotoBottomSheet";
import { ProfileImageViewer } from "./ProfileImageViewer";
import { useProfilePhotoUpload } from "../../hooks/useProfilePhotoUpload";

interface Props {
  photoUrl: string | null;
  firstName: string;
  lastName: string;
  email: string;
  tier: LoyaltyTier;
  roleLabel: string;
  verified: boolean;
  businessName?: string | null;
  // Neither GET /auth/me nor GET /auth/profile currently returns a join date,
  // so this stays optional and simply doesn't render until the backend adds one.
  memberSince?: string | null;
  onEditPress: () => void;
}

export function ProfileHeader({
  photoUrl,
  firstName,
  lastName,
  email,
  tier,
  roleLabel,
  verified,
  businessName,
  memberSince,
  onEditPress,
}: Props) {
  const upload = useProfilePhotoUpload();
  const [sheetVisible, setSheetVisible] = useState(false);
  const [viewerVisible, setViewerVisible] = useState(false);

  const lastHandledError = useRef<string | null>(null);
  useEffect(() => {
    if (upload.state === "error" && upload.error && upload.error !== lastHandledError.current) {
      lastHandledError.current = upload.error;
      Alert.alert("Photo Update Failed", upload.error, [
        { text: "Cancel", style: "cancel", onPress: () => upload.reset() },
        { text: "Retry", onPress: () => void upload.retry() },
      ]);
    }
    if (upload.state === "idle" || upload.state === "success") lastHandledError.current = null;
  }, [upload.state, upload.error, upload]);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start();
  }, [fadeAnim]);

  return (
    <Animated.View style={[s.wrap, { opacity: fadeAnim }]}>
      <ProfileAvatar
        photoUrl={photoUrl}
        firstName={firstName}
        lastName={lastName}
        tier={tier}
        size={100}
        onPress={() => setSheetVisible(true)}
        uploadState={upload.state}
        uploadProgress={upload.progress}
      />

      <Text style={s.name}>
        {firstName} {lastName}
      </Text>
      <Text style={s.email}>{email}</Text>

      <View style={s.metaRow}>
        <View style={s.rolePill}>
          <Text style={s.rolePillText}>{roleLabel}</Text>
        </View>
        {verified ? (
          <View style={[s.rolePill, s.verifiedPill]}>
            <Ionicons name="checkmark-circle" size={12} color={K.colors.success} />
            <Text style={[s.rolePillText, { color: K.colors.success }]}>Verified</Text>
          </View>
        ) : (
          <View style={[s.rolePill, s.unverifiedPill]}>
            <Ionicons name="alert-circle-outline" size={12} color={K.colors.warning} />
            <Text style={[s.rolePillText, { color: K.colors.warning }]}>Unverified</Text>
          </View>
        )}
      </View>

      {businessName ? <Text style={s.businessName}>{businessName}</Text> : null}
      {memberSince ? <Text style={s.memberSince}>Member since {memberSince}</Text> : null}

      <View style={{ marginTop: 12 }}>
        <TierBadge tier={tier} />
      </View>

      <TouchableOpacity style={s.editBtn} onPress={onEditPress} activeOpacity={0.8}>
        <Ionicons name="pencil-outline" size={14} color={K.colors.darkGreen} />
        <Text style={s.editBtnText}>Edit Profile</Text>
      </TouchableOpacity>

      <ProfilePhotoBottomSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        hasPhoto={!!photoUrl}
        onViewPhoto={() => setViewerVisible(true)}
        onTakePhoto={() => void upload.takePhoto()}
        onChooseFromGallery={() => void upload.chooseFromGallery()}
        onRemovePhoto={() => void upload.removePhoto()}
      />

      <ProfileImageViewer visible={viewerVisible} photoUrl={photoUrl} onRequestClose={() => setViewerVisible(false)} />
    </Animated.View>
  );
}

const s = StyleSheet.create({
  wrap: {
    backgroundColor: K.colors.bgCard,
    alignItems: "center",
    paddingTop: 28,
    paddingBottom: 24,
    paddingHorizontal: K.spacing.screen,
    borderBottomWidth: 1,
    borderBottomColor: K.colors.border,
    marginBottom: 16,
  },
  name: { fontSize: K.font.xxl, fontWeight: "800", color: K.colors.textDark, letterSpacing: -0.3, marginTop: 14 },
  email: { fontSize: K.font.sm, color: K.colors.textMuted, marginTop: 2 },
  businessName: { fontSize: K.font.sm, color: K.colors.textMid, fontWeight: "600", marginTop: 6 },
  memberSince: { fontSize: 11, color: K.colors.textMuted, marginTop: 4 },
  metaRow: { flexDirection: "row", gap: 8, marginTop: 10 },
  rolePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: K.colors.bgSubtle,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  verifiedPill: { backgroundColor: "#dcfce7" },
  unverifiedPill: { backgroundColor: "#fffbeb" },
  rolePillText: { fontSize: 11, fontWeight: "700", color: K.colors.textMid },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1.5,
    borderColor: K.colors.darkGreen,
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 20,
    marginTop: 16,
  },
  editBtnText: { fontSize: K.font.sm, fontWeight: "700", color: K.colors.darkGreen },
});
