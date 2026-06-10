"use client";

import {
  useState,
  useRef,
  useCallback,
  type DragEvent,
  type ChangeEvent,
} from "react";
import {
  Upload,
  X,
  Loader2,
  RotateCcw,
  ImageIcon,
  Star,
  CheckCircle,
  ArrowLeft,
  ArrowRight,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Modal from "@/components/ui/Modal";
import { listingsService } from "@/services/listings";
import { uploadToS3 } from "@/lib/listing-api";
import { useAuthStore } from "@/stores/auth";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ACCEPTED_EXTENSIONS = ".jpg,.jpeg,.png,.webp";
const MAX_SIZE_MB = 5;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;
const TOKEN_KEY = "zika:access_token";

let refreshPromise: Promise<string> | null = null;

const refreshAccessToken = async () => {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const res = await fetch("/api/auth/refresh", {
        method: "POST",
        credentials: "include",
      });
      const body = await res.json().catch(() => null);
      if (!res.ok)
        throw new Error(body?.error?.message ?? "Session expired. Please sign in again.");
      const accessToken =
        body?.data?.tokens?.accessToken ??
        body?.tokens?.accessToken ??
        body?.data?.accessToken ??
        body?.accessToken;
      if (!accessToken)
        throw new Error("Refresh succeeded, but no access token was returned.");
      if (typeof window !== "undefined") sessionStorage.setItem(TOKEN_KEY, accessToken);
      const { user, setSession } = useAuthStore.getState();
      if (user) setSession(accessToken, user);
      return accessToken as string;
    })().finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
};

const withTokenRefresh = async <T,>(request: () => Promise<T>) => {
  try {
    return await request();
  } catch (err: any) {
    if (err?.response?.status !== 401) throw err;
    await refreshAccessToken();
    return request();
  }
};

interface UploadItem {
  uid: string;
  file: File;
  preview: string;
  status: "uploading" | "done" | "error";
  progress: number;
  error?: string;
}

export interface ExistingPhoto {
  id: string;
  cdnUrl: string;
  position: number;
}

interface MediaUploaderProps {
  listingId: string;
  existingPhotos: ExistingPhoto[];
  onDelete: (photoId: string) => Promise<void>;
  onRefresh: () => void;
  maxPhotos?: number;
  disabled?: boolean;
}

export function MediaUploader({
  listingId,
  existingPhotos,
  onDelete,
  onRefresh,
  maxPhotos = 30,
  disabled = false,
}: MediaUploaderProps) {
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isReordering, setIsReordering] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [limitModalOpen, setLimitModalOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const canUpload =
    !disabled &&
    existingPhotos.length + uploads.filter((u) => u.status !== "error").length < maxPhotos;

  const processFiles = useCallback(
    async (files: File[]) => {
      setValidationError(null);

      const invalidType = files.find((f) => !ACCEPTED_TYPES.includes(f.type));
      const tooLarge    = files.find((f) => f.size > MAX_SIZE_BYTES);

      // Check total count against maxPhotos
      const totalCount = existingPhotos.length + uploads.filter(u => u.status !== "error").length + files.length;
      if (totalCount > maxPhotos) {
        setLimitModalOpen(true);
        return;
      }

      if (invalidType) {
        setValidationError(
          `"${invalidType.name}" is not a supported format. Use JPEG, PNG, or WEBP.`,
        );
      } else if (tooLarge) {
        setValidationError(
          `"${tooLarge.name}" exceeds the ${MAX_SIZE_MB} MB size limit.`,
        );
      }

      const valid = files.filter(
        (f) => ACCEPTED_TYPES.includes(f.type) && f.size <= MAX_SIZE_BYTES,
      );
      if (valid.length === 0) return;

      const items: UploadItem[] = valid.map((file) => ({
        uid: `u-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        preview: URL.createObjectURL(file),
        status: "uploading" as const,
        progress: 0,
      }));

      setUploads((prev) => [...prev, ...items]);

      await Promise.allSettled(
        items.map(async (item) => {
          try {
            // Presign the photo with the listing service
            const { uploadUrl, s3Key } = await withTokenRefresh(() =>
              listingsService.presignPhoto(listingId, item.file.type, item.file.name)
            );

            setUploads((prev) =>
              prev.map((u) => (u.uid === item.uid ? { ...u, progress: 50 } : u)),
            );

            // Upload to S3 directly
            await uploadToS3(uploadUrl, item.file);

            setUploads((prev) =>
              prev.map((u) => (u.uid === item.uid ? { ...u, progress: 90 } : u)),
            );

            // Confirm the upload with the listing service
            await withTokenRefresh(() =>
              listingsService.confirmPhoto(listingId, s3Key)
            );

            setUploads((prev) =>
              prev.map((u) =>
                u.uid === item.uid ? { ...u, status: "done", progress: 100 } : u,
              ),
            );

            onRefresh();

            setTimeout(
              () => setUploads((prev) => prev.filter((u) => u.uid !== item.uid)),
              1500,
            );
          } catch (err: any) {
            const message = err?.message ?? "Upload failed. Retry?";
            setUploads((prev) =>
              prev.map((u) =>
                u.uid === item.uid ? { ...u, status: "error", error: message } : u,
              ),
            );
          }
        }),
      );
    },
    [listingId, onRefresh],
  );

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      if (!canUpload) return;
      void processFiles(Array.from(e.dataTransfer.files));
    },
    [canUpload, processFiles],
  );

  const handleFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    void processFiles(Array.from(e.target.files ?? []));
    e.target.value = "";
  };

  const handleDelete = async (photoId: string) => {
    setDeletingId(photoId);
    try {
      await onDelete(photoId);
      onRefresh();
    } finally {
      setDeletingId(null);
    }
  };

  const retryItem = (item: UploadItem) => {
    setUploads((prev) => prev.filter((u) => u.uid !== item.uid));
    void processFiles([item.file]);
  };

  const movePhoto = async (photoId: string, direction: -1 | 1) => {
    const ordered = [...existingPhotos].sort((a, b) => a.position - b.position);
    const currentIndex = ordered.findIndex((p) => p.id === photoId);
    const nextIndex = currentIndex + direction;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= ordered.length) return;

    const cur  = ordered[currentIndex]!;
    const next = ordered[nextIndex]!;
    ordered[currentIndex] = next;
    ordered[nextIndex]    = cur;

    setIsReordering(true);
    try {
      await withTokenRefresh(() =>
        listingsService.reorderPhotos(
          listingId,
          ordered.map((p) => p.id),
        ),
      );
      onRefresh();
    } finally {
      setIsReordering(false);
    }
  };

  return (
    <div className="space-y-4">
      {canUpload && (
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
          }}
          className={cn(
            "border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-200 select-none",
            isDragging
              ? "border-primary bg-primary-50 scale-[1.01] shadow-glow-primary"
              : "border-slate-200 bg-slate-50 hover:border-primary-300 hover:bg-primary-50/40",
          )}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPTED_EXTENSIONS}
            onChange={handleFileInput}
            className="hidden"
          />
          <div className="w-12 h-12 bg-white rounded-2xl shadow-card flex items-center justify-center mx-auto mb-3 border border-border">
            <Upload className="w-5 h-5 text-primary" />
          </div>
          <p className="text-sm font-semibold text-slate-700">
            {isDragging ? "Drop photos here" : "Drag & drop or click to browse"}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            JPEG · PNG · WEBP &nbsp;·&nbsp; Max {MAX_SIZE_MB} MB per file
            &nbsp;·&nbsp; {existingPhotos.length} / {maxPhotos} uploaded
          </p>
        </div>
      )}

      {/* Validation error modal */}
      {validationError && (
        <Modal
          open={!!validationError}
          title="Error"
          description={validationError}
          onClose={() => setValidationError(null)}
          onConfirm={() => setValidationError(null)}
        />
      )}
      {limitModalOpen && (
        <Modal
          open={limitModalOpen}
          title="Limit Exceeded"
          description={`You can upload a maximum of ${maxPhotos} photos.`}
          onClose={() => setLimitModalOpen(false)}
          onConfirm={() => setLimitModalOpen(false)}
        />
      )}

      {(existingPhotos.length > 0 || uploads.length > 0) && (
        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {[...existingPhotos]
            .sort((a, b) => a.position - b.position)
            .map((photo, index, photos) => (
              <div
                key={photo.id}
                className="group relative aspect-video rounded-xl bg-slate-100 border border-slate-200 overflow-hidden shadow-card"
              >
                <img
                  src={photo.cdnUrl}
                  alt={`Photo ${photo.position}`}
                  className="w-full h-full object-cover"
                />
                {photo.position === 1 && (
                  <div className="absolute top-1.5 left-1.5 bg-primary/90 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-1">
                    <Star className="w-2.5 h-2.5" />
                    Cover
                  </div>
                )}
                {!disabled && (
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1.5 transition-all duration-200">
                    <button
                      type="button"
                      onClick={() => void movePhoto(photo.id, -1)}
                      disabled={isReordering || index === 0}
                      className="w-8 h-8 rounded-lg bg-white/90 hover:bg-white text-slate-700 disabled:opacity-40 flex items-center justify-center"
                      title="Move left"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(photo.id)}
                      disabled={deletingId === photo.id}
                      className="w-8 h-8 rounded-lg bg-danger/90 hover:bg-danger text-white flex items-center justify-center"
                    >
                      {deletingId === photo.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <X className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => void movePhoto(photo.id, 1)}
                      disabled={isReordering || index === photos.length - 1}
                      className="w-8 h-8 rounded-lg bg-white/90 hover:bg-white text-slate-700 disabled:opacity-40 flex items-center justify-center"
                      title="Move right"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
                <span className="absolute bottom-1.5 right-1.5 bg-black/50 text-white text-[10px] font-medium px-1.5 py-0.5 rounded">
                  #{photo.position}
                </span>
              </div>
            ))}

          {uploads.map((item) => (
            <div
              key={item.uid}
              className={cn(
                "relative aspect-video rounded-xl bg-slate-100 border-2 overflow-hidden",
                item.status === "error"
                  ? "border-danger/60"
                  : item.status === "done"
                    ? "border-success/60"
                    : "border-primary/40",
              )}
            >
              <img
                src={item.preview}
                alt="Uploading"
                className={cn(
                  "w-full h-full object-cover",
                  item.status !== "done" && "opacity-50",
                )}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                {item.status === "uploading" && (
                  <div className="flex flex-col items-center gap-1">
                    <div className="bg-black/40 rounded-full p-2">
                      <Loader2 className="w-5 h-5 text-white animate-spin" />
                    </div>
                    <span className="text-[11px] text-white font-bold bg-black/50 px-1.5 py-0.5 rounded">
                      {item.progress}%
                    </span>
                  </div>
                )}
                {item.status === "done" && (
                  <div className="bg-success/90 rounded-full p-1.5">
                    <CheckCircle className="w-5 h-5 text-white" />
                  </div>
                )}
                {item.status === "error" && (
                  <button
                    type="button"
                    onClick={() => retryItem(item)}
                    className="flex flex-col items-center gap-1"
                  >
                    <div className="bg-danger/90 rounded-full p-2">
                      <RotateCcw className="w-4 h-4 text-white" />
                    </div>
                    <span className="text-[10px] text-white font-semibold bg-black/50 px-1.5 py-0.5 rounded">
                      Retry
                    </span>
                  </button>
                )}
              </div>
              {item.status === "uploading" && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/20">
                  <div
                    className="h-full bg-primary transition-all duration-200"
                    style={{ width: `${item.progress}%` }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {existingPhotos.length === 0 && uploads.length === 0 && (
        <div className="border-2 border-dashed border-slate-200 rounded-2xl py-12 text-center">
          <ImageIcon className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-500">No photos yet</p>
          <p className="text-xs text-slate-400 mt-1">
            Upload high-quality photos to attract guests
          </p>
        </div>
      )}

      {!canUpload && !disabled && existingPhotos.length >= maxPhotos && (
        <p className="text-xs text-slate-400 text-center">
          Maximum of {maxPhotos} photos reached.
        </p>
      )}
    </div>
  );
}
