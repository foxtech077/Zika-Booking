import { useRef, useState } from "react";
import type * as ImagePicker from "expo-image-picker";
import {
  pickFromCamera,
  pickFromGallery,
  validateAsset,
  compressAsset,
  presignProfilePhoto,
  uploadToS3WithProgress,
  ProfilePhotoUploadError,
  type UploadStage,
} from "../services/profile-photo-upload";
import { useUpdateProfile } from "./profile";

// Handles three shapes: our own ProfilePhotoUploadError, an axios error with a
// backend { error: { message } } envelope, and the raw { success:false, error }
// object thrown directly by hooks/profile.ts's mutationFn when the API returns
// success:false without an HTTP error status.
function extractPipelineErrorMessage(err: unknown): string {
  if (err instanceof ProfilePhotoUploadError || err instanceof Error) return err.message;
  const anyErr = err as any;
  return (
    anyErr?.response?.data?.error?.message ??
    anyErr?.error?.message ??
    "Something went wrong. Please try again."
  );
}

export type PhotoUploadState =
  | "idle"
  | "compressing"
  | "presigning"
  | "uploading"
  | "saving"
  | "success"
  | "error";

// Reusable across Traveller and Provider: pick → validate → compress → presign
// → upload to S3 → PATCH /auth/profile/:id → done. Keeps the picked asset and
// (once obtained) the cdnUrl in refs so `retry()` resumes from the failed step
// instead of restarting the whole flow.
export function useProfilePhotoUpload() {
  const updateProfile = useUpdateProfile();

  const [state, setState] = useState<PhotoUploadState>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [errorStage, setErrorStage] = useState<UploadStage | null>(null);

  const assetRef = useRef<ImagePicker.ImagePickerAsset | null>(null);
  const cdnUrlRef = useRef<string | null>(null);

  const reset = () => {
    setState("idle");
    setProgress(0);
    setError(null);
    setErrorStage(null);
    assetRef.current = null;
    cdnUrlRef.current = null;
  };

  async function runPipeline() {
    setError(null);
    setErrorStage(null);
    try {
      if (!cdnUrlRef.current) {
        const asset = assetRef.current;
        if (!asset) return;
        validateAsset(asset);

        setState("compressing");
        console.log("[PHOTO-UPLOAD] compressing…", { uri: asset.uri, width: asset.width, height: asset.height, mimeType: asset.mimeType });
        const { uri, contentType } = await compressAsset(asset);
        console.log("[PHOTO-UPLOAD] compressed →", { uri, contentType });

        setState("presigning");
        const presign = await presignProfilePhoto(contentType);
        console.log("[PHOTO-UPLOAD] presign received →", presign);

        setState("uploading");
        setProgress(0);
        await uploadToS3WithProgress(presign.uploadUrl, uri, contentType, setProgress);
        console.log("[PHOTO-UPLOAD] S3 upload complete");

        cdnUrlRef.current = presign.cdnUrl;
      }

      setState("saving");
      console.log("[PHOTO-UPLOAD] saving photoUrl via PATCH /auth/profile/:id →", cdnUrlRef.current);
      await updateProfile.mutateAsync({ photoUrl: cdnUrlRef.current });
      console.log("[PHOTO-UPLOAD] ✅ profile saved");

      setState("success");
      assetRef.current = null;
      cdnUrlRef.current = null;
    } catch (err) {
      const stage = err instanceof ProfilePhotoUploadError ? err.stage : "save";
      const message = extractPipelineErrorMessage(err);
      console.log(`[PHOTO-UPLOAD] ❌ failed at stage "${stage}":`, message, err);
      setErrorStage(stage);
      setError(message);
      setState("error");
    }
  }

  async function takePhoto() {
    try {
      const asset = await pickFromCamera();
      if (!asset) return;
      assetRef.current = asset;
      cdnUrlRef.current = null;
      await runPipeline();
    } catch (err) {
      setErrorStage("pick");
      setError(err instanceof Error ? err.message : "Could not open the camera.");
      setState("error");
    }
  }

  async function chooseFromGallery() {
    try {
      const asset = await pickFromGallery();
      if (!asset) return;
      assetRef.current = asset;
      cdnUrlRef.current = null;
      await runPipeline();
    } catch (err) {
      setErrorStage("pick");
      setError(err instanceof Error ? err.message : "Could not open your photo library.");
      setState("error");
    }
  }

  // Removing a photo doesn't need the upload pipeline at all — just clears it
  // via the same PATCH endpoint used to save a new one.
  async function removePhoto() {
    setError(null);
    setErrorStage(null);
    setState("saving");
    try {
      await updateProfile.mutateAsync({ photoUrl: null });
      setState("success");
    } catch (err) {
      console.log("[PHOTO-UPLOAD] ❌ failed to remove photo:", err);
      setErrorStage("save");
      setError(extractPipelineErrorMessage(err));
      setState("error");
    }
  }

  const isBusy = state !== "idle" && state !== "success" && state !== "error";

  return {
    state,
    progress,
    error,
    errorStage,
    isBusy,
    takePhoto,
    chooseFromGallery,
    removePhoto,
    retry: runPipeline,
    reset,
  };
}
