import { useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, TouchableWithoutFeedback, Modal, Animated, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { K } from "../../constants/theme";

interface Action {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  danger?: boolean;
  onPress: () => void;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  hasPhoto: boolean;
  onViewPhoto: () => void;
  onTakePhoto: () => void;
  onChooseFromGallery: () => void;
  onRemovePhoto: () => void;
}

export function ProfilePhotoBottomSheet({
  visible,
  onClose,
  hasPhoto,
  onViewPhoto,
  onTakePhoto,
  onChooseFromGallery,
  onRemovePhoto,
}: Props) {
  const translateY = useRef(new Animated.Value(300)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(backdropOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, speed: 18, bounciness: 4 }),
      ]).start();
    }
  }, [visible, translateY, backdropOpacity]);

  function handleClose() {
    Animated.parallel([
      Animated.timing(backdropOpacity, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 300, duration: 180, useNativeDriver: true }),
    ]).start(() => onClose());
  }

  function runAndClose(action: () => void) {
    Animated.parallel([
      Animated.timing(backdropOpacity, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 300, duration: 180, useNativeDriver: true }),
    ]).start(() => {
      onClose();
      action();
    });
  }

  const actions: Action[] = [
    ...(hasPhoto ? [{ key: "view", label: "View Photo", icon: "eye-outline" as const, onPress: onViewPhoto }] : []),
    { key: "camera", label: "Take Photo", icon: "camera-outline", onPress: onTakePhoto },
    { key: "gallery", label: "Choose from Gallery", icon: "images-outline", onPress: onChooseFromGallery },
    ...(hasPhoto ? [{ key: "remove", label: "Remove Photo", icon: "trash-outline" as const, danger: true, onPress: onRemovePhoto }] : []),
  ];

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose}>
      <TouchableWithoutFeedback onPress={handleClose}>
        <Animated.View style={[StyleSheet.absoluteFillObject, s.backdrop, { opacity: backdropOpacity }]} />
      </TouchableWithoutFeedback>

      <Animated.View style={[s.sheet, { transform: [{ translateY }] }]}>
        <View style={s.grabber} />
        <Text style={s.title}>Profile Photo</Text>

        {actions.map((a) => (
          <TouchableOpacity
            key={a.key}
            style={s.row}
            activeOpacity={0.7}
            onPress={() => runAndClose(a.onPress)}
          >
            <View style={[s.iconWrap, a.danger && s.iconWrapDanger]}>
              <Ionicons name={a.icon} size={19} color={a.danger ? K.colors.error : K.colors.darkGreen} />
            </View>
            <Text style={[s.rowLabel, a.danger && s.rowLabelDanger]}>{a.label}</Text>
          </TouchableOpacity>
        ))}

        <TouchableOpacity style={s.cancelBtn} activeOpacity={0.75} onPress={handleClose}>
          <Text style={s.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: K.colors.bgCard,
    borderTopLeftRadius: K.radius.modal,
    borderTopRightRadius: K.radius.modal,
    paddingHorizontal: K.spacing.screen,
    paddingTop: 10,
    paddingBottom: 34,
    ...K.shadow.lg,
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: K.colors.border,
    alignSelf: "center",
    marginBottom: 14,
  },
  title: {
    fontSize: K.font.base,
    fontWeight: "700",
    color: K.colors.textMuted,
    textAlign: "center",
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 13,
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: K.colors.bgSubtle,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: K.radius.full,
    backgroundColor: K.colors.bgTint,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapDanger: { backgroundColor: "#FEE2E2" },
  rowLabel: { fontSize: K.font.base, fontWeight: "600", color: K.colors.textDark },
  rowLabelDanger: { color: K.colors.error },
  cancelBtn: {
    marginTop: 14,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: K.colors.bgSubtle,
    borderRadius: K.radius.button,
  },
  cancelText: { fontSize: K.font.base, fontWeight: "700", color: K.colors.textDark },
});
