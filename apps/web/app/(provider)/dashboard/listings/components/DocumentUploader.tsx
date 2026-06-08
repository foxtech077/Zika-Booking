"use client";

import { useState, useRef, type ChangeEvent } from "react";
import { FileText, Upload, AlertCircle, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { listingsService } from "@/services/listings";
import { listingApi, uploadToS3 } from "@/lib/listing-api";
import { useAuthStore } from "@/stores/auth";

const ACCEPTED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const ACCEPTED_EXTENSIONS = ".pdf,.jpg,.jpeg,.png,.webp";
const MAX_SIZE_BYTES = 20 * 1024 * 1024;
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

const HOTEL_DOC_DEFINITIONS = [
  {
    type: "business_licence",
    label: "Business License",
    description: "Corporate registration or business license document",
  },
  {
    type: "operating_permit",
    label: "Operating Permit",
    description: "Local council health & safety operating permit",
  },
  {
    type: "tourism_certificate",
    label: "Tourism Certificate",
    description: "Regional tourism authority certification",
  },
] as const;

const CAR_DOC_DEFINITIONS = [
  {
    type: "vehicle_registration",
    label: "Vehicle Registration",
    description: "Official registration certificate for the vehicle",
  },
  {
    type: "insurance_certificate",
    label: "Insurance Certificate",
    description: "Valid insurance certificate for the listed vehicle",
  },
] as const;

type DocDefinition = { type: string; label: string; description: string };

export interface ExistingDocument {
  id: string;
  documentType: string;
  fileType?: string;
}

interface DocumentUploaderProps {
  listingId: string;
  existingDocuments: ExistingDocument[];
  onRefresh: () => void;
  disabled?: boolean;
  category?: "hotel" | "car";
}

export function DocumentUploader({
  listingId,
  existingDocuments,
  onRefresh,
  disabled = false,
  category = "hotel",
}: DocumentUploaderProps) {
  const definitions: readonly DocDefinition[] =
    category === "car" ? CAR_DOC_DEFINITIONS : HOTEL_DOC_DEFINITIONS;

  const [loading, setLoading]   = useState<Record<string, boolean>>({});
  const [errors, setErrors]     = useState<Record<string, string | undefined>>({});
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const getExisting = (type: string) =>
    existingDocuments.find((d) => d.documentType === type);

  const handleFileChange = async (
    e: ChangeEvent<HTMLInputElement>,
    docType: string,
  ) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setErrors((prev) => ({
        ...prev,
        [docType]: "Invalid file type. Use PDF, JPEG, PNG, or WEBP.",
      }));
      return;
    }

    if (file.size > MAX_SIZE_BYTES) {
      setErrors((prev) => ({ ...prev, [docType]: "File too large (max 20 MB)." }));
      return;
    }

    setLoading((prev) => ({ ...prev, [docType]: true }));
    setErrors((prev) => ({ ...prev, [docType]: undefined }));

    try {
      // ── Step 1: presign document upload ────────
      const { uploadUrl, s3Key } = await withTokenRefresh(() =>
        listingsService.presignDocument(listingId, file.type, docType)
      );

      // ── Step 2: upload to S3 directly ────────
      await uploadToS3(uploadUrl, file);

      // ── Step 3: confirm the document with the listing service ────────────────
      await withTokenRefresh(() =>
        listingsService.confirmDocument(listingId, s3Key, docType, file.type)
      );

      onRefresh();
    } catch (err: any) {
      setErrors((prev) => ({
        ...prev,
        [docType]: err?.message ?? "Upload failed. Please try again.",
      }));
    } finally {
      setLoading((prev) => ({ ...prev, [docType]: false }));
    }
  };

  const handleDelete = async (docId: string, docType: string) => {
    setDeletingId(docId);
    setErrors((prev) => ({ ...prev, [docType]: undefined }));
    try {
      await withTokenRefresh(() =>
        listingApi.delete(`/listings/${listingId}/documents/${docId}`),
      );
      onRefresh();
    } catch {
      setErrors((prev) => ({
        ...prev,
        [docType]: "Delete failed. Please try again.",
      }));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="mb-2">
        <h3 className="text-base font-bold text-slate-900">Verification Documents</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          {category === "car"
            ? "Vehicle registration and insurance documents are required before activation."
            : "All three documents are required before submitting for admin review."}
          {" "}PDF, JPEG, PNG, or WEBP · Max 20 MB each.
        </p>
      </div>

      {definitions.map((entry) => {
        const existing  = getExisting(entry.type);
        const isLoading = loading[entry.type] ?? false;
        const error     = errors[entry.type];

        return (
          <div
            key={entry.type}
            className={cn(
              "flex items-center justify-between gap-4 p-4 border rounded-2xl bg-slate-50 transition-all",
              error
                ? "border-danger/40 bg-danger-light/20"
                : "border-border hover:border-slate-300",
            )}
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center text-primary shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h4 className="text-sm font-semibold text-slate-800">{entry.label}</h4>
                <p className="text-xs text-slate-400 truncate">{entry.description}</p>
                {error && (
                  <p className="text-xs text-danger mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    {error}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {existing ? (
                <Badge label="Uploaded" status="active" />
              ) : (
                <Badge label="Required" status="pending_review" />
              )}

              <input
                ref={(el) => { inputRefs.current[entry.type] = el; }}
                type="file"
                accept={ACCEPTED_EXTENSIONS}
                className="hidden"
                onChange={(e) => void handleFileChange(e, entry.type)}
              />

              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled}
                loading={isLoading}
                icon={isLoading ? undefined : <Upload />}
                onClick={() => inputRefs.current[entry.type]?.click()}
              >
                {existing ? "Re-upload" : "Upload"}
              </Button>

              {existing && (
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  disabled={disabled}
                  loading={deletingId === existing.id}
                  icon={<Trash2 />}
                  onClick={() => void handleDelete(existing.id, entry.type)}
                >
                  Delete
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
