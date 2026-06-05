const CDN_BASE =
  process.env.NEXT_PUBLIC_S3_CDN_BASE_URL ??
  "https://zika-storage.s3.af-south-1.amazonaws.com";

function isS3Url(src: string): boolean {
  return (
    src.includes("zika-storage.s3.") ||
    src.includes("zika-listings.s3.") ||
    src.startsWith(CDN_BASE)
  );
}

/**
 * Resolves a photo URL for browser display.
 *
 * - Already-presigned S3 URLs (contain X-Amz-Signature) are returned as-is.
 * - Raw/unsigned S3 URLs from any Zika bucket are proxied through /api/image.
 * - Non-S3 URLs (Unsplash, etc.) are returned unchanged.
 */
export function imgUrl(src: string | null | undefined): string | undefined {
  if (!src) return undefined;
  // Presigned URL — already has auth, use directly
  if (src.includes("X-Amz-Signature")) return src;
  // Raw private S3 URL — proxy through Next.js image route
  if (isS3Url(src)) {
    return `/api/image?url=${encodeURIComponent(src)}`;
  }
  return src;
}
