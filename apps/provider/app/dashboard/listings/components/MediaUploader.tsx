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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { listingsService } from "@/services/listings";

// ── Constants ─────────────────────────────────────────────────────────────────

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_SIZE_MB = 10;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

// ── Types ──────────────────────────────────────────────────────────────────────

interface UploadItem {
  uid: string;
  file: File;
  preview: string;
  status: "uploading" | "done" | "error";
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

// ── Component ─────────────────────────────────────────────────────────────────

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
  const inputRef = useRef<HTMLInputElement>(null);

  const canUpload =
    !disabled &&
    existingPhotos.length + uploads.filter((u) => u.status !== "error").length <
      maxPhotos;

  // ── Upload flow ─────────────────────────────────────────────────────────────

  const processFiles = useCallback(
    async (files: File[]) => {
      const valid = files.filter(
        (f) => ACCEPTED_TYPES.includes(f.type) && f.size <= MAX_SIZE_BYTES,
      );

      if (valid.length === 0) return;

      const items: UploadItem[] = valid.map((file) => ({
        uid: `u-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        preview: URL.createObjectURL(file),
        status: "uploading" as const,
      }));

      setUploads((prev) => [...prev, ...items]);

      await Promise.allSettled(
        items.map(async (item) => {
          try {
            // 1. Get presigned URL
            const { uploadUrl, s3Key } = await listingsService.presignPhoto(
              listingId,
              item.file.type,
              item.file.name,
            );

            // 2. Upload directly to S3
            const res = await fetch(uploadUrl, {
              method: "PUT",
              body: item.file,
              headers: { "Content-Type": item.file.type },
            });
            if (!res.ok) throw new Error(`S3 error ${res.status}`);

            // 3. Confirm with backend
            await listingsService.confirmPhoto(listingId, s3Key);

            setUploads((prev) =>
              prev.map((u) =>
                u.uid === item.uid ? { ...u, status: "done" } : u,
              ),
            );

            onRefresh();

            // Remove done item after brief success display
            setTimeout(
              () =>
                setUploads((prev) => prev.filter((u) => u.uid !== item.uid)),
              1500,
            );
          } catch {
            setUploads((prev) =>
              prev.map((u) =>
                u.uid === item.uid
                  ? { ...u, status: "error", error: "Upload failed. Retry?" }
                  : u,
              ),
            );
          }
        }),
      );
    },
    [listingId, onRefresh],
  );

  // ── Drag & drop ─────────────────────────────────────────────────────────────

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

  // ── Delete ──────────────────────────────────────────────────────────────────

  const handleDelete = async (photoId: string) => {
    setDeletingId(photoId);
    try {
      await onDelete(photoId);
      onRefresh();
    } finally {
      setDeletingId(null);
    }
  };

  // ── Retry ───────────────────────────────────────────────────────────────────

  const retryItem = (item: UploadItem) => {
    setUploads((prev) => prev.filter((u) => u.uid !== item.uid));
    void processFiles([item.file]);
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      {canUpload && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
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
            accept={ACCEPTED_TYPES.join(",")}
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

      {/* Photo grid */}
      {(existingPhotos.length > 0 || uploads.length > 0) && (
        <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {/* Existing photos */}
          {existingPhotos.map((photo) => (
            <div
              key={photo.id}
              className="group relative aspect-video rounded-xl bg-slate-100 border border-slate-200 overflow-hidden shadow-card"
            >
              <img
                src={photo.cdnUrl}
                alt={`Photo at position ${photo.position}`}
                className="w-full h-full object-cover"
              />

              {photo.position === 1 && (
                <div className="absolute top-1.5 left-1.5 bg-primary/90 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-1">
                  <Star className="w-2.5 h-2.5" />
                  Cover
                </div>
              )}

              {!disabled && (
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all duration-200">
                  <button
                    type="button"
                    onClick={() => void handleDelete(photo.id)}
                    disabled={deletingId === photo.id}
                    className="w-8 h-8 rounded-lg bg-danger/90 hover:bg-danger text-white flex items-center justify-center transition-all"
                    title="Remove photo"
                  >
                    {deletingId === photo.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <X className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              )}

              <span className="absolute bottom-1.5 right-1.5 bg-black/50 text-white text-[10px] font-medium px-1.5 py-0.5 rounded">
                #{photo.position}
              </span>
            </div>
          ))}

          {/* In-progress / error uploads */}
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
                  <div className="bg-black/40 rounded-full p-2">
                    <Loader2 className="w-5 h-5 text-white animate-spin" />
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
                    title="Retry upload"
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
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {existingPhotos.length === 0 && uploads.length === 0 && (
        <div className="border-2 border-dashed border-slate-200 rounded-2xl py-12 text-center">
          <ImageIcon className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-500">No photos yet</p>
          <p className="text-xs text-slate-400 mt-1">
            Upload high-quality photos to attract guests
          </p>
        </div>
      )}

      {/* Max reached notice */}
      {!canUpload && !disabled && existingPhotos.length >= maxPhotos && (
        <p className="text-xs text-slate-400 text-center">
          Maximum of {maxPhotos} photos reached.
        </p>
      )}
    </div>
  );
}
