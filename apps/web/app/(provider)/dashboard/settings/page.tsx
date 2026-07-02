"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  Camera,
  CheckCircle2,
  Loader2,
  Upload,
  User,
  XCircle,
} from "lucide-react";
import { api } from "@/lib/api";
import { listingApi, uploadToS3 } from "@/lib/listing-api";
import { useAuthStore } from "@/stores/auth";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, SectionHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/utils";

interface SectionFeedback {
  type: "success" | "error";
  text: string;
}

function FeedbackBanner({ feedback }: { feedback: SectionFeedback | null | undefined }) {
  if (!feedback) return null;
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-xl border px-4 py-3 text-sm",
        feedback.type === "success"
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-red-200 bg-red-50 text-red-800"
      )}
    >
      {feedback.type === "success" ? (
        <CheckCircle2 className="h-4 w-4 shrink-0" />
      ) : (
        <XCircle className="h-4 w-4 shrink-0" />
      )}
      {feedback.text}
    </div>
  );
}

export default function SettingsPage() {
  const { user, updateUser } = useAuthStore();
  const queryClient = useQueryClient();

  const [profileForm, setProfileForm] = useState({
    firstName: "",
    lastName: "",
    businessName: "",
  });
  const [profileFeedback, setProfileFeedback] = useState<SectionFeedback | null>(null);
  const [photoFeedback, setPhotoFeedback]     = useState<SectionFeedback | null>(null);
  const [photoUploading, setPhotoUploading]   = useState(false);
  const [previewUrl, setPreviewUrl]           = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── GET /auth/profile ──────────────────────────────────────────────────────
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["provider-settings-profile"],
    queryFn: async () => {
      const res = await api.get("/auth/profile");
      return res.data?.data?.profile ?? res.data?.profile ?? null;
    },
    staleTime: 60_000,
  });

  // Populate form once profile loads
  useEffect(() => {
    const source = profile ?? user;
    if (!source) return;
    setProfileForm({
      firstName:    (source.firstname ?? source.firstName)  || "",
      lastName:     (source.lastname  ?? source.lastName)   || "",
      businessName: source.businessName                     || "",
    });
    if (source.photoUrl) setPreviewUrl(source.photoUrl);
  }, [profile?.id ?? user?.id]);

  const displayName =
    `${(profile?.firstname ?? profile?.firstName ?? user?.firstName ?? "")} ${(profile?.lastname ?? profile?.lastName ?? user?.lastName ?? "")}`.trim() ||
    "Provider";
  const email       = profile?.email        ?? user?.email        ?? "";
  const currentTier = profile?.currentTier  ?? user?.currentTier  ?? "bronze";
  const loyaltyPts  = profile?.loyaltyPoints ?? user?.loyaltyPoints ?? 0;
  const userId      = profile?.id            ?? user?.id            ?? "";

  // ── PATCH /auth/profile/:id ────────────────────────────────────────────────
  const profileMutation = useMutation({
    mutationFn: () =>
      api.patch(`/auth/profile/${userId}`, {
        firstName:    profileForm.firstName.trim()    || undefined,
        lastName:     profileForm.lastName.trim()     || undefined,
        businessName: profileForm.businessName.trim() || undefined,
      }),
    onSuccess: (res) => {
      const updated = res.data?.data?.profile ?? res.data?.profile;
      if (updated) {
        updateUser({
          firstName:    updated.firstName    ?? user?.firstName,
          lastName:     updated.lastName     ?? user?.lastName,
          businessName: updated.businessName ?? user?.businessName,
          photoUrl: updated.photoUrl ?? user?.photoUrl,
        });
      // Invalidate profile query to refetch latest data
      queryClient.invalidateQueries(["provider-settings-profile"]);

      }
      setProfileFeedback({ type: "success", text: "Profile saved successfully." });
    },
    onError: () => {
      setProfileFeedback({ type: "error", text: "Profile update failed. Please try again." });
    },
  });

  // ── Avatar: presign → S3 PUT → POST /auth/profile ─────────────────────────
  const handleAvatarFile = async (file: File) => {
    if (!["image/jpeg","image/png","image/webp"].includes(file.type)) {
        setPhotoFeedback({ type: "error", text: "Please select a JPEG, PNG, or WEBP image." });
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setPhotoFeedback({ type: "error", text: "Image must be under 5 MB." });
        return;
      }

    setPhotoUploading(true);
    setPhotoFeedback(null);
    setPreviewUrl(URL.createObjectURL(file)); // optimistic preview

    try {
      const presignRes = await listingApi.post("/profile/photos/presign", { contentType: file.type });
      const { uploadUrl, cdnUrl } = presignRes.data?.data ?? presignRes.data;

      await uploadToS3(uploadUrl, file);
      await api.post("/auth/profile", { photoUrl: cdnUrl });
        // Update global auth store so top bar avatar reflects new photo
        updateUser({ photoUrl: cdnUrl });
        // Invalidate profile query to refresh data
        queryClient.invalidateQueries(["provider-settings-profile"]);

      setPreviewUrl(cdnUrl);
      setPhotoFeedback({ type: "success", text: "Profile photo updated." });
    } catch {
      setPhotoFeedback({ type: "error", text: "Photo upload failed. Please try again." });
      setPreviewUrl(profile?.photoUrl ?? null);
    } finally {
      setPhotoUploading(false);
    }
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <SectionHeader
        title="Settings"
        subtitle="Manage your provider profile and photo."
      />

      <Card>
        {/* Card header */}
        <div className="mb-5 flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary [&>svg]:h-5 [&>svg]:w-5">
            <User />
          </div>
          <div>
            <h3 className="font-semibold text-slate-950">Profile Settings</h3>
            <p className="mt-0.5 text-sm text-slate-500">
              Update your name, business name, and profile photo.
            </p>
          </div>
        </div>

        {/* Avatar + identity row */}
        <div className="mb-6 flex flex-col gap-4 border-b border-border pb-6 sm:flex-row sm:items-center">
          <div className="relative shrink-0">
            {photoUploading ? (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <Avatar name={displayName} src={previewUrl} size="xl" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            {profileLoading ? (
              <div className="space-y-2">
                <div className="h-5 w-40 animate-pulse rounded bg-slate-100" />
                <div className="h-4 w-32 animate-pulse rounded bg-slate-100" />
              </div>
            ) : (
              <>
                <p className="text-lg font-bold text-slate-950 truncate">{displayName}</p>
                <p className="text-sm text-slate-500 truncate">{email}</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <Badge label="Provider Account" status="confirmed" />
                  <span className="text-xs text-slate-500 capitalize">
                    {currentTier} Tier · {loyaltyPts.toLocaleString()} pts
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Change photo button */}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleAvatarFile(file);
                e.target.value = "";
              }}
            />
            <Button
              variant="outline"
              icon={photoUploading ? <Loader2 className="animate-spin" /> : <Camera />}
              onClick={() => fileInputRef.current?.click()}
              disabled={photoUploading}
            >
              {photoUploading ? "Uploading…" : "Change Photo"}
            </Button>
          </div>
        </div>

        {/* Photo feedback */}
        {photoFeedback && (
          <div className="mb-4">
            <FeedbackBanner feedback={photoFeedback} />
          </div>
        )}

        {/* Profile form feedback */}
        {profileFeedback && (
          <div className="mb-4">
            <FeedbackBanner feedback={profileFeedback} />
          </div>
        )}

        {/* Editable fields */}
        <div className="grid gap-4 md:grid-cols-2">
          <Input
            label="First name"
            value={profileForm.firstName}
            onChange={(e) => setProfileForm((f) => ({ ...f, firstName: e.target.value }))}
            leftIcon={<User />}
            disabled={profileLoading}
          />
          <Input
            label="Last name"
            value={profileForm.lastName}
            onChange={(e) => setProfileForm((f) => ({ ...f, lastName: e.target.value }))}
            disabled={profileLoading}
          />
          <Input
            label="Business / provider name"
            value={profileForm.businessName}
            onChange={(e) => setProfileForm((f) => ({ ...f, businessName: e.target.value }))}
            leftIcon={<Building2 />}
            className="md:col-span-2"
            disabled={profileLoading}
            hint="Optional — visible to guests on your listings."
          />
        </div>

        <p className="mt-3 text-xs text-slate-400">
          Email address cannot be changed. Contact support if you need to update it.
        </p>

        {/* Footer actions */}
        <div className="mt-5 flex flex-wrap gap-3 border-t border-border pt-4">
          <Button
            loading={profileMutation.isPending}
            onClick={() => {
              setProfileFeedback(null);
              profileMutation.mutate();
            }}
            disabled={profileLoading}
            icon={<Upload />}
          >
            Save Changes
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              const source = profile ?? user;
              setProfileForm({
                firstName:    (source?.firstname ?? source?.firstName) || "",
                lastName:     (source?.lastname  ?? source?.lastName)  || "",
                businessName: source?.businessName                     || "",
              });
              setProfileFeedback(null);
            }}
          >
            Cancel
          </Button>
        </div>
      </Card>
    </div>
  );
}
