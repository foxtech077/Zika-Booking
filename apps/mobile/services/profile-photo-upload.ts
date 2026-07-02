import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { listingApi } from "../lib/listing-api";
import type { ApiResponse } from "@zika/types";

const MAX_RAW_BYTES = 10 * 1024 * 1024; // 10MB, before compression
const MAX_DIMENSION = 1600;
const COMPRESS_QUALITY = 0.82;
const ACCEPTED_MIME = ["image/jpeg", "image/jpg", "image/png", "image/heic", "image/heif"];

export type UploadStage = "pick" | "validate" | "compress" | "presign" | "upload" | "save";

export class ProfilePhotoUploadError extends Error {
  stage: UploadStage;
  constructor(stage: UploadStage, message: string) {
    super(message);
    this.stage = stage;
  }
}

function extractErrorMessage(err: unknown, fallback: string): string {
  const anyErr = err as any;
  return anyErr?.response?.data?.error?.message ?? anyErr?.message ?? fallback;
}

// ── Step 1: pick image ──────────────────────────────────────────────────────

export async function pickFromCamera(): Promise<ImagePicker.ImagePickerAsset | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) {
    throw new ProfilePhotoUploadError("pick", "Camera access is disabled. Enable it in Settings to take a photo.");
  }
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ["images"],
    quality: 0.9,
    allowsEditing: true,
    aspect: [1, 1],
  });
  if (result.canceled || result.assets.length === 0) return null;
  return result.assets[0];
}

export async function pickFromGallery(): Promise<ImagePicker.ImagePickerAsset | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    throw new ProfilePhotoUploadError("pick", "Photo library access is disabled. Enable it in Settings to choose a photo.");
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 0.9,
    allowsEditing: true,
    aspect: [1, 1],
  });
  if (result.canceled || result.assets.length === 0) return null;
  return result.assets[0];
}

// ── Step 2: validate + compress ──────────────────────────────────────────────

export function validateAsset(asset: ImagePicker.ImagePickerAsset): void {
  const mime = (asset.mimeType ?? "").toLowerCase();
  if (mime && !ACCEPTED_MIME.includes(mime)) {
    throw new ProfilePhotoUploadError("validate", "Please choose a JPG, PNG, or HEIC image.");
  }
  if (asset.fileSize && asset.fileSize > MAX_RAW_BYTES) {
    throw new ProfilePhotoUploadError("validate", "That image is too large. Please choose a photo under 10 MB.");
  }
}

// HEIC/HEIF and oversized photos are always transcoded to JPEG here, so the
// content type sent to the presign endpoint is predictable and universally
// supported regardless of what the camera/gallery originally produced.
export async function compressAsset(
  asset: ImagePicker.ImagePickerAsset,
): Promise<{ uri: string; contentType: string }> {
  try {
    const actions: ImageManipulator.Action[] =
      asset.width && asset.width > MAX_DIMENSION ? [{ resize: { width: MAX_DIMENSION } }] : [];
    const manipulated = await ImageManipulator.manipulateAsync(asset.uri, actions, {
      compress: COMPRESS_QUALITY,
      format: ImageManipulator.SaveFormat.JPEG,
    });
    return { uri: manipulated.uri, contentType: "image/jpeg" };
  } catch {
    throw new ProfilePhotoUploadError("compress", "Could not process this image. Please try a different photo.");
  }
}

// ── Step 3: presigned upload URL ─────────────────────────────────────────────

export interface PresignResult {
  uploadUrl: string;
  cdnUrl: string;
}

export async function presignProfilePhoto(contentType: string): Promise<PresignResult> {
  try {
    const res = await listingApi.post<ApiResponse<PresignResult>>("/profile/photos/presign", { contentType });
    if (!res.data.success) throw new Error(res.data.error.message);
    return res.data.data;
  } catch (err) {
    throw new ProfilePhotoUploadError(
      "presign",
      extractErrorMessage(err, "Could not prepare the photo upload. Please try again."),
    );
  }
}

// ── Step 4: raw PUT to S3 with progress ──────────────────────────────────────
// Uses XMLHttpRequest (not fetch/axios) so we get real upload progress events.
// No Authorization header is sent — the presigned URL itself is the credential.

export function uploadToS3WithProgress(
  uploadUrl: string,
  fileUri: string,
  contentType: string,
  onProgress?: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    (async () => {
      try {
        console.log(`[PHOTO-UPLOAD] ▶ Reading local file: ${fileUri}`);
        const fileRes = await fetch(fileUri);
        const blob = await fileRes.blob();
        console.log(`[PHOTO-UPLOAD] Blob ready, size=${(blob as any).size ?? "unknown"} bytes, contentType=${contentType}`);

        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader("Content-Type", contentType);
        xhr.upload.onprogress = (evt) => {
          if (evt.lengthComputable && onProgress) onProgress(evt.loaded / evt.total);
        };
        xhr.onload = () => {
          console.log(`[PHOTO-UPLOAD] PUT ${uploadUrl} → status ${xhr.status}`);
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            console.log("[PHOTO-UPLOAD] S3 response body:", xhr.responseText?.slice(0, 500));
            reject(new ProfilePhotoUploadError("upload", `Upload failed (status ${xhr.status}). Please try again.`));
          }
        };
        xhr.onerror = () => {
          console.log("[PHOTO-UPLOAD] ❌ XHR network error during S3 PUT");
          reject(new ProfilePhotoUploadError("upload", "Upload failed. Check your connection and try again."));
        };
        xhr.send(blob);
      } catch (err) {
        console.log("[PHOTO-UPLOAD] ❌ Failed to read local file before upload:", err);
        reject(new ProfilePhotoUploadError("upload", "Could not read the selected image."));
      }
    })();
  });
}
