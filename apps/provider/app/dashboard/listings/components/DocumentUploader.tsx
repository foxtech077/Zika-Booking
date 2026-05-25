"use client";

import { useState, useRef, type ChangeEvent } from "react";
import { FileText, Upload, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { listingsService } from "@/services/listings";

// ── Constants ─────────────────────────────────────────────────────────────────

const ACCEPTED_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

const DOC_DEFINITIONS = [
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

type DocType = (typeof DOC_DEFINITIONS)[number]["type"];

// ── Types ──────────────────────────────────────────────────────────────────────

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
}

// ── Component ─────────────────────────────────────────────────────────────────

export function DocumentUploader({
  listingId,
  existingDocuments,
  onRefresh,
  disabled = false,
}: DocumentUploaderProps) {
  const [loading, setLoading] = useState<Partial<Record<DocType, boolean>>>({});
  const [errors, setErrors] = useState<Partial<Record<DocType, string>>>({});
  const inputRefs = useRef<Partial<Record<DocType, HTMLInputElement | null>>>({});

  const getExisting = (type: string) =>
    existingDocuments.find((d) => d.documentType === type);

  const handleFileChange = async (
    e: ChangeEvent<HTMLInputElement>,
    docType: DocType,
  ) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    // Validate type
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setErrors((prev) => ({
        ...prev,
        [docType]: "Invalid file type. Use PDF, JPEG, PNG, or WEBP.",
      }));
      return;
    }

    // Validate size
    if (file.size > MAX_SIZE_BYTES) {
      setErrors((prev) => ({
        ...prev,
        [docType]: `File too large (max 20 MB).`,
      }));
      return;
    }

    setLoading((prev) => ({ ...prev, [docType]: true }));
    setErrors((prev) => ({ ...prev, [docType]: undefined }));

    try {
      // 1. Get presigned URL
      const { uploadUrl, s3Key } = await listingsService.presignDocument(
        listingId,
        file.type,
        docType,
      );

      // 2. Upload to S3
      const res = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      if (!res.ok) throw new Error(`S3 upload error ${res.status}`);

      // 3. Confirm with backend
      await listingsService.confirmDocument(listingId, s3Key, docType, file.type);

      onRefresh();
    } catch {
      setErrors((prev) => ({
        ...prev,
        [docType]: "Upload failed. Please try again.",
      }));
    } finally {
      setLoading((prev) => ({ ...prev, [docType]: false }));
    }
  };

  return (
    <div className="space-y-3">
      <div className="mb-2">
        <h3 className="text-base font-bold text-slate-900">Verification Documents</h3>
        <p className="text-xs text-slate-500 mt-0.5">
          All three documents are required before submitting for admin review.
          PDF, JPEG, PNG, or WEBP · Max 20 MB each.
        </p>
      </div>

      {DOC_DEFINITIONS.map((entry) => {
        const existing = getExisting(entry.type);
        const isLoading = loading[entry.type] ?? false;
        const error = errors[entry.type];

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
            {/* Left: icon + info */}
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-10 h-10 rounded-xl bg-primary-50 flex items-center justify-center text-primary shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h4 className="text-sm font-semibold text-slate-800">
                  {entry.label}
                </h4>
                <p className="text-xs text-slate-400 truncate">
                  {entry.description}
                </p>
                {error && (
                  <p className="text-xs text-danger mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3 shrink-0" />
                    {error}
                  </p>
                )}
              </div>
            </div>

            {/* Right: badge + upload button */}
            <div className="flex items-center gap-2 shrink-0">
              {existing ? (
                <Badge label="Uploaded" status="active" />
              ) : (
                <Badge label="Required" status="pending_review" />
              )}

              <input
                ref={(el) => {
                  inputRefs.current[entry.type] = el;
                }}
                type="file"
                accept={ACCEPTED_TYPES.join(",")}
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
            </div>
          </div>
        );
      })}
    </div>
  );
}
