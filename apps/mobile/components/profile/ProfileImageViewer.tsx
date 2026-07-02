import ImageView from "react-native-image-viewing";

interface Props {
  visible: boolean;
  photoUrl: string | null | undefined;
  onRequestClose: () => void;
}

// Full-screen viewer for the profile photo — pinch to zoom, double tap to
// zoom, and swipe down to dismiss are all built into react-native-image-viewing.
export function ProfileImageViewer({ visible, photoUrl, onRequestClose }: Props) {
  if (!photoUrl) return null;
  return (
    <ImageView
      images={[{ uri: photoUrl }]}
      imageIndex={0}
      visible={visible}
      onRequestClose={onRequestClose}
      swipeToCloseEnabled
      doubleTapToZoomEnabled
      backgroundColor="#000"
    />
  );
}
