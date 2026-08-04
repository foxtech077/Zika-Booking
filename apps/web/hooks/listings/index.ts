import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listingsService } from "@/services/listings";

// ── Query keys ─────────────────────────────────────────────────────────────────

export const LISTING_QK = {
  all: ["provider-listings"] as const,
  list: (params: Record<string, string>) =>
    ["provider-listings", "list", params] as const,
  detail: (id: string) => ["provider-listings", "detail", id] as const,
  summary: () => ["provider-listings", "summary"] as const,
  availability: (id: string, from?: string, to?: string) =>
    ["provider-listings", "availability", id, from, to] as const,
} as const;

// ── Data hooks ─────────────────────────────────────────────────────────────────

export function useListings(params: Record<string, string>) {
  return useQuery({
    queryKey: LISTING_QK.list(params),
    queryFn: () => listingsService.list(params),
    staleTime: 30_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

export function useListing(id: string | null) {
  return useQuery({
    queryKey: LISTING_QK.detail(id ?? ""),
    queryFn: () => listingsService.get(id!),
    staleTime: 30_000,
    enabled: !!id,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

export function useListingSummary(enabled = true) {
  return useQuery({
    queryKey: LISTING_QK.summary(),
    queryFn: () => listingsService.getSummary(),
    staleTime: 60_000,
    enabled,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

export function useListingAvailability(
  listingId: string | null,
  from?: string,
  to?: string,
) {
  return useQuery({
    queryKey: LISTING_QK.availability(listingId ?? "", from, to),
    queryFn: () => listingsService.getAvailability(listingId!, from, to),
    enabled: !!listingId,
    staleTime: 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}

// ── Listing action mutations ───────────────────────────────────────────────────

export function useListingActions(listingId: string) {
  const qc = useQueryClient();

  function invalidate() {
    void qc.invalidateQueries({ queryKey: LISTING_QK.all });
    void qc.invalidateQueries({ queryKey: ["provider-dashboard"] });
  }

  const update = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      listingsService.update(listingId, payload),
    onSuccess: invalidate,
  });

  const submit = useMutation({
    mutationFn: () => listingsService.submit(listingId),
    onSuccess: invalidate,
  });

  const activate = useMutation({
    mutationFn: () => listingsService.activate(listingId),
    onSuccess: invalidate,
  });

  const deactivate = useMutation({
    mutationFn: () => listingsService.deactivate(listingId),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: () => listingsService.remove(listingId),
    onSuccess: () => void qc.invalidateQueries({ queryKey: LISTING_QK.all }),
  });

  return { update, submit, activate, deactivate, remove };
}

// ── Photo mutations ───────────────────────────────────────────────────────────

export function usePhotoActions(listingId: string) {
  const qc = useQueryClient();

  function invalidate() {
    void qc.invalidateQueries({ queryKey: LISTING_QK.detail(listingId) });
  }

  async function upload(
    file: File,
    onProgress?: (pct: number) => void,
  ): Promise<{ id: string; cdnUrl: string; position: number }> {
    onProgress?.(10);
    const { uploadUrl, s3Key } = await listingsService.presignPhoto(
      listingId,
      file.type,
      file.name,
    );
    onProgress?.(40);
    const res = await fetch(uploadUrl, {
      method: "PUT",
      body: file,
      headers: { "Content-Type": file.type },
    });
    if (!res.ok) throw new Error("S3 upload failed");
    onProgress?.(80);
    const photo = await listingsService.confirmPhoto(listingId, s3Key);
    onProgress?.(100);
    invalidate();
    return photo;
  }

  const remove = useMutation({
    mutationFn: (photoId: string) =>
      listingsService.deletePhoto(listingId, photoId),
    onSuccess: invalidate,
  });

  const reorder = useMutation({
    mutationFn: (order: string[]) =>
      listingsService.reorderPhotos(listingId, order),
    onSuccess: invalidate,
  });

  return { upload, remove, reorder };
}

// ── Document mutations ────────────────────────────────────────────────────────

export function useDocumentActions(listingId: string) {
  const qc = useQueryClient();

  function invalidate() {
    void qc.invalidateQueries({ queryKey: LISTING_QK.detail(listingId) });
  }

  async function upload(file: File, documentType: string) {
    const { uploadUrl, s3Key } = await listingsService.presignDocument(
      listingId,
      file.type,
      documentType,
    );
    const res = await fetch(uploadUrl, {
      method: "PUT",
      body: file,
      headers: { "Content-Type": file.type },
    });
    if (!res.ok) throw new Error("S3 upload failed");
    const result = await listingsService.confirmDocument(
      listingId,
      s3Key,
      documentType,
      file.type,
    );
    invalidate();
    return result;
  }

  return { upload };
}
