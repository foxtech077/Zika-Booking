/** The subset of a ListingPhoto row the URL helpers need. */
export interface PhotoUrlSource {
  cdnUrl: string;
  thumbUrl?: string | null;
  cardUrl?: string | null;
  fullUrl?: string | null;
  width?: number | null;
  height?: number | null;
}

/**
 * Flattens a listing's primary photo into the `primaryPhoto*` response fields.
 * Every variant falls back to the original, so a client can read
 * `primaryPhotoCardUrl` unconditionally and always get a usable image.
 */
export function primaryPhotoFields(photo: PhotoUrlSource | undefined | null) {
  return {
    primaryPhotoUrl: photo?.cdnUrl ?? null,
    primaryPhotoCardUrl: photo?.cardUrl ?? photo?.cdnUrl ?? null,
    primaryPhotoThumbUrl: photo?.thumbUrl ?? photo?.cdnUrl ?? null,
  };
}

/** Same fallback chain for a full photo list, resolved server-side. */
export function withPhotoVariants<T extends PhotoUrlSource>(photos: T[]) {
  return photos.map((p) => ({
    ...p,
    thumbUrl: p.thumbUrl ?? p.cdnUrl,
    cardUrl: p.cardUrl ?? p.cdnUrl,
    fullUrl: p.fullUrl ?? p.cdnUrl,
  }));
}
