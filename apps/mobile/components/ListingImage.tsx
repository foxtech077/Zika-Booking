import { Image } from "react-native";
import { useAuthStore } from "../store/auth";
import { useSignedPhoto } from "../lib/s3-client";

export function ListingImage({ uri, style, resizeMode = "cover", onError }: {
  uri: string | null | undefined;
  style: any;
  resizeMode?: "cover" | "contain" | "stretch" | "center";
  onError?: () => void;
}) {
  const token = useAuthStore((s) => s.accessToken);
  const { signedUrl } = useSignedPhoto(uri);

  if (!signedUrl) return null;

  // Only add Bearer token when the image URL routes through our own API gateway and is not an S3 presigned URL
  const isApiUrl = signedUrl.includes("api.kainook.com") && !signedUrl.includes("amazonaws.com");

  return (
    <Image
      source={isApiUrl && token
        ? { uri: signedUrl, headers: { Authorization: `Bearer ${token}` } }
        : { uri: signedUrl }}
      style={style}
      resizeMode={resizeMode}
      onError={onError}
    />
  );
}
