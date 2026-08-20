import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { api } from "../lib/api";
import { useAuthStore } from "../store/auth";
import { queryClient as globalQueryClient } from "../lib/query-client";
import type { ApiResponse, LoyaltyTier, UserStatus, UserType } from "@zika/types";

export const PROFILE_QK = {
  me: ["auth", "me"] as const,
  photo: ["auth", "profile-photo"] as const,
};

// ── GET /auth/me — canonical name/email/tier/verification data ────────────────

interface AuthMeUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: UserStatus;
  userType: UserType;
  businessName: string | null;
  country: string | null;
  emailVerified: boolean;
  currentTier: LoyaltyTier;
  loyaltyPoints: number;
}

interface AuthMeResponse {
  user: AuthMeUser;
  nextTier: LoyaltyTier | null;
  pointsToNextTier: number | null;
}

export function useAuthMe() {
  return useQuery<AuthMeResponse>({
    queryKey: PROFILE_QK.me,
    queryFn: async () => {
      const res = await api.get<ApiResponse<AuthMeResponse>>("/auth/me");
      if (!res.data.success) throw res.data;
      return res.data.data;
    },
    staleTime: 30_000,
  });
}

// ── GET /auth/profile — the only source for photoUrl ───────────────────────────
// The backend's /auth/profile response has a naming bug: it returns lowercase
// `firstname`/`lastname` instead of the camelCase fields every other endpoint
// uses. We only read `photoUrl` from it and take everything else from /auth/me.

interface AuthProfileResponse {
  profile: {
    id: string;
    firstname: string;
    lastname: string;
    email: string;
    userType: string;
    photoUrl: string | null;
    loyaltyPoints: number;
    currentTier: string;
    businessName: string | null;
    country: string | null;
  };
}

async function fetchProfilePhoto(): Promise<string | null> {
  const res = await api.get<ApiResponse<AuthProfileResponse>>("/auth/profile");
  if (!res.data.success) throw res.data;
  return res.data.data.profile.photoUrl ?? null;
}

// photoUrl is a presigned S3 URL valid for ~15 minutes. staleTime is kept well
// under that so a screen re-opened after a few minutes gets a fresh link
// automatically, without polling or refetching on every render.
const PHOTO_STALE_TIME = 5 * 60_000;

export function useProfilePhoto() {
  return useQuery<string | null>({
    queryKey: PROFILE_QK.photo,
    queryFn: fetchProfilePhoto,
    staleTime: PHOTO_STALE_TIME,
  });
}

// Imperative (non-hook) recovery path for when an <Image> fails to load
// because its presigned URL has expired — called from ProfileAvatar's onError.
// Dedupes concurrent callers (e.g. multiple avatars on screen erroring at
// once) behind a single in-flight request, and pushes the fresh URL into both
// the query cache and the auth store so every consumer updates immediately.
let inFlightPhotoRefresh: Promise<string | null> | null = null;
let lastPhotoRefreshAt = 0;
// Defense-in-depth against any caller retry-looping (e.g. if the backend
// keeps handing back a URL that fails to load for a non-expiry reason) — caps
// actual network refreshes to once every 10s regardless of how often this is called.
const MIN_REFRESH_INTERVAL_MS = 10_000;

export function refreshProfilePhoto(): Promise<string | null> {
  if (!inFlightPhotoRefresh && Date.now() - lastPhotoRefreshAt < MIN_REFRESH_INTERVAL_MS) {
    return Promise.resolve(globalQueryClient.getQueryData<string | null>(PROFILE_QK.photo) ?? null);
  }
  if (!inFlightPhotoRefresh) {
    inFlightPhotoRefresh = (async () => {
      try {
        const photoUrl = await fetchProfilePhoto();
        lastPhotoRefreshAt = Date.now();
        globalQueryClient.setQueryData(PROFILE_QK.photo, photoUrl);
        await useAuthStore.getState().updateUser({ photoUrl });
        return photoUrl;
      } catch (err) {
        console.warn("[refreshProfilePhoto] Failed to refresh expired photo URL:", err);
        return null;
      } finally {
        inFlightPhotoRefresh = null;
      }
    })();
  }
  return inFlightPhotoRefresh;
}

// ── Combined view used by the Profile screens ──────────────────────────────────

export interface ProfileScreenData {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  status: UserStatus;
  userType: UserType;
  businessName: string | null;
  country: string | null;
  emailVerified: boolean;
  currentTier: LoyaltyTier;
  loyaltyPoints: number;
  nextTier: LoyaltyTier | null;
  pointsToNextTier: number | null;
  photoUrl: string | null;
}

export function useProfileScreenData() {
  const me = useAuthMe();
  const photo = useProfilePhoto();
  const updateUser = useAuthStore((s) => s.updateUser);

  const data: ProfileScreenData | undefined = me.data
    ? {
        ...me.data.user,
        nextTier: me.data.nextTier,
        pointsToNextTier: me.data.pointsToNextTier,
        photoUrl: photo.data ?? null,
      }
    : undefined;

  // Keep the global auth store (read by every other screen) in sync the
  // moment fresh data arrives, so avatars/names elsewhere update instantly.
  useEffect(() => {
    if (!data) return;
    void updateUser({
      id: data.id,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      status: data.status,
      userType: data.userType,
      businessName: data.businessName,
      country: data.country,
      emailVerified: data.emailVerified,
      currentTier: data.currentTier,
      loyaltyPoints: data.loyaltyPoints,
      photoUrl: data.photoUrl,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.photoUrl, data?.firstName, data?.lastName, data?.currentTier, data?.loyaltyPoints, data?.businessName]);

  return {
    data,
    isLoading: me.isLoading || photo.isLoading,
    isError: me.isError && photo.isError,
    isFetching: me.isFetching || photo.isFetching,
    refetch: () => Promise.all([me.refetch(), photo.refetch()]),
  };
}

// ── PATCH /auth/profile/:id ─────────────────────────────────────────────────────

export interface UpdateProfilePayload {
  firstName?: string;
  lastName?: string;
  photoUrl?: string | null;
  businessName?: string | null;
}

interface UpdateProfileResult {
  id: string;
  name: string;
  photoUrl: string | null;
  businessName: string | null;
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const updateUser = useAuthStore((s) => s.updateUser);
  const userId = useAuthStore((s) => s.user?.id);

  return useMutation({
    mutationFn: async (patch: UpdateProfilePayload) => {
      if (!userId) throw new Error("Not authenticated");
      const res = await api.patch<ApiResponse<{ message: string; profile: UpdateProfileResult }>>(
        `/auth/profile/${userId}`,
        patch,
      );
      if (!res.data.success) throw res.data;
      return res.data.data.profile;
    },
    onSuccess: async (result, patch) => {
      // `result.photoUrl` is the authoritative value (a fresh presigned URL
      // right after upload/removal) — prefer it over echoing back whatever
      // was sent, since the two can now legitimately differ. firstName/lastName
      // aren't returned separately by this endpoint (only a concatenated
      // `name`), so those still come from the request payload.
      await updateUser({
        ...(patch.firstName !== undefined ? { firstName: patch.firstName } : {}),
        ...(patch.lastName !== undefined ? { lastName: patch.lastName } : {}),
        photoUrl: result.photoUrl,
        businessName: result.businessName,
      });
      queryClient.setQueryData(PROFILE_QK.photo, result.photoUrl);
      await queryClient.invalidateQueries({ queryKey: PROFILE_QK.me });
    },
  });
}

// ── DELETE /auth/delete-account ──────────────────────────────────────────────

export function useDeleteAccount() {
  const clearAuth = useAuthStore((s) => s.clearAuth);

  return useMutation({
    mutationFn: async () => {
      const res = await api.delete<ApiResponse<{ message: string }>>("/auth/delete-account");
      if (!res.data.success) throw res.data;
      return res.data;
    },
    onSuccess: async () => {
      await clearAuth();
      globalQueryClient.clear();
    },
  });
}
