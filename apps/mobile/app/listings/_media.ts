import { useState, useCallback } from "react";
import { Alert } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { listingApi, uploadToS3 } from "../../lib/listing-api";
import { downscaleFull, downscaleThumb, outputExtension } from "../../lib/image-downscale";

/**
 * Photo + compliance-document uploads for a listing, shared by all three
 * wizards. Implements the platform's 3-step flow (presign → PUT to S3 →
 * confirm) exactly as the web MediaUploader/DocumentUploader do, so a photo
 * uploaded from either client is indistinguishable server-side.
 */

export interface ListingPhoto {
  id: string;
  cdnUrl: string;
  thumbUrl?: string | null;
  position: number;
}

export interface ListingDocument {
  id: string;
  documentType: string;
}

const MAX_PHOTOS = 30;

export function useListingMedia(listingId: string) {
  const [photos, setPhotos] = useState<ListingPhoto[]>([]);
  const [documents, setDocuments] = useState<ListingDocument[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] =
    useState<{ current: number; total: number } | null>(null);

  /** Seed from the loaded listing (called from the hydration effect). */
  const seed = useCallback((p: ListingPhoto[], d: ListingDocument[]) => {
    setPhotos(p);
    setDocuments(d);
  }, []);

  const pickAndUploadPhoto = useCallback(
    async (source: "library" | "camera" = "library") => {
      if (photos.length >= MAX_PHOTOS) {
        Alert.alert("Limit Reached", `Maximum ${MAX_PHOTOS} photos allowed.`);
        return;
      }
      setUploadingPhoto(true);
      try {
        let result: ImagePicker.ImagePickerResult;
        if (source === "camera") {
          const perm = await ImagePicker.requestCameraPermissionsAsync();
          if (!perm.granted) {
            Alert.alert("Camera Permission Needed", "Please allow camera access to take a photo.");
            return;
          }
          result = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"] as any, quality: 1 });
        } else {
          result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"] as any,
            // Take the picker's output uncompressed: downscaleFull/Thumb
            // compress once, so compressing here too stacks generational loss.
            quality: 1,
            allowsMultipleSelection: true,
            selectionLimit: MAX_PHOTOS - photos.length,
          });
        }
        if (result.canceled) return;

        const total = result.assets.length;
        for (let i = 0; i < total; i++) {
          const asset = result.assets[i]!;
          setUploadProgress({ current: i + 1, total });

          // Downscale on-device first: a camera original is ~4000px and several
          // MB, which no surface displays at full size. Sequential, because each
          // manipulateAsync decodes the source independently and running both at
          // once doubles peak bitmap memory.
          const full = await downscaleFull(
            asset.uri, asset.width, asset.height, asset.mimeType, asset.fileSize,
          );
          const thumb = await downscaleThumb(asset.uri, asset.width, asset.height);

          const base = (asset.fileName ?? "photo").replace(/\.[^.]+$/, "");
          const ext = outputExtension();
          const [fullPresign, thumbPresign] = await Promise.all([
            listingApi.post<{ data: { uploadUrl: string; s3Key: string } }>(
              `/listings/${listingId}/photos/presign`,
              { contentType: full.contentType, filename: `${base}.${ext}`, fileSize: full.size }
            ),
            listingApi.post<{ data: { uploadUrl: string; s3Key: string } }>(
              `/listings/${listingId}/photos/presign`,
              { contentType: thumb.contentType, filename: `${base}-thumb.${ext}`, variant: "thumbnail", fileSize: thumb.size }
            ),
          ]);

          await Promise.all([
            uploadToS3(fullPresign.data.data.uploadUrl, full.uri, full.contentType),
            uploadToS3(thumbPresign.data.data.uploadUrl, thumb.uri, thumb.contentType),
          ]);

          const confirmRes = await listingApi.post<{ data: ListingPhoto }>(
            `/listings/${listingId}/photos/confirm`,
            { s3Key: fullPresign.data.data.s3Key, thumbS3Key: thumbPresign.data.data.s3Key }
          );
          setPhotos((p) => [...p, confirmRes.data.data]);
        }
      } catch {
        Alert.alert("Upload Failed", "Some photos could not be uploaded. Already uploaded photos have been saved.");
      } finally {
        setUploadingPhoto(false);
        setUploadProgress(null);
      }
    },
    [listingId, photos.length]
  );

  const deletePhoto = useCallback(
    async (photoId: string) => {
      try {
        await listingApi.delete(`/listings/${listingId}/photos/${photoId}`);
        setPhotos((p) => p.filter((ph) => ph.id !== photoId));
      } catch {
        Alert.alert("Error", "Could not delete this photo. Please try again.");
      }
    },
    [listingId]
  );

  const reorderPhoto = useCallback(
    async (photoId: string, direction: "up" | "down") => {
      const idx = photos.findIndex((p) => p.id === photoId);
      if (idx === -1) return;
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= photos.length) return;
      const reordered = [...photos];
      [reordered[idx], reordered[swapIdx]] = [reordered[swapIdx]!, reordered[idx]!];
      setPhotos(reordered);
      try {
        await listingApi.patch(`/listings/${listingId}/photos/reorder`, {
          orderedIds: reordered.map((p) => p.id),
        });
      } catch {
        setPhotos(photos); // roll back the optimistic swap
        Alert.alert("Error", "Could not reorder photos. Please try again.");
      }
    },
    [listingId, photos]
  );

  const pickAndUploadDocument = useCallback(
    async (docType: string, docLabel: string) => {
      setUploadingDoc(docType);
      try {
        const result = await DocumentPicker.getDocumentAsync({
          type: ["application/pdf", "image/jpeg", "image/png"],
          copyToCacheDirectory: true,
        });
        if (result.canceled) return;
        const asset = result.assets[0]!;
        const contentType = asset.mimeType ?? "application/pdf";
        const presignRes = await listingApi.post<{ data: { uploadUrl: string; s3Key: string } }>(
          `/listings/${listingId}/documents/presign`,
          { contentType, documentType: docType }
        );
        const { uploadUrl, s3Key } = presignRes.data.data;
        await uploadToS3(uploadUrl, asset.uri, contentType);
        const confirmRes = await listingApi.post<{ data: ListingDocument }>(
          `/listings/${listingId}/documents/confirm`,
          { s3Key, documentType: docType, contentType }
        );
        setDocuments((d) => [
          ...d.filter((doc) => doc.documentType !== docType),
          confirmRes.data.data,
        ]);
      } catch {
        Alert.alert("Upload Failed", `Could not upload ${docLabel}. Please try again.`);
      } finally {
        setUploadingDoc(null);
      }
    },
    [listingId]
  );

  const deleteDocument = useCallback(
    async (docId: string, docLabel: string) => {
      try {
        await listingApi.delete(`/listings/${listingId}/documents/${docId}`);
        setDocuments((d) => d.filter((doc) => doc.id !== docId));
      } catch {
        Alert.alert("Error", `Could not delete ${docLabel}. Please try again.`);
      }
    },
    [listingId]
  );

  return {
    photos,
    documents,
    uploadingPhoto,
    uploadingDoc,
    uploadProgress,
    seed,
    pickAndUploadPhoto,
    deletePhoto,
    reorderPhoto,
    pickAndUploadDocument,
    deleteDocument,
  };
}
