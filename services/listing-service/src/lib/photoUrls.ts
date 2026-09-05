interface PhotoUrlSource {
  cdnUrl: string;
  thumbUrl?: string | null;
}

/**
 * Primary-photo fields for list responses. `thumbUrl` falls back to the full
 * image, so a client can read `primaryPhotoThumbUrl` unconditionally whether or
 * not the photo was uploaded with a preview.
 */
export function primaryPhotoFields(photo: PhotoUrlSource | undefined | null) {
  return {
    primaryPhotoUrl: photo?.cdnUrl ?? null,
    primaryPhotoThumbUrl: photo?.thumbUrl ?? photo?.cdnUrl ?? null,
  };
}
