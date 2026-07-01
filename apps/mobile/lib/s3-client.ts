import { useState, useEffect } from "react";

/**
 * Extract S3 key from S3 URL or return relative path.
 */
export function getS3Key(url: string | null | undefined): string | null {
  if (!url) return null;
  if (!url.startsWith("http")) {
    // Already relative path (which is the key)
    return url.startsWith("/") ? url.slice(1) : url;
  }

  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname;
    return pathname.startsWith("/") ? pathname.slice(1) : pathname;
  } catch (e) {
    console.error("[getS3Key] Failed to parse URL:", url, e);
    return null;
  }
}

/**
 * Simplified to directly return the provided URL since the backend handles S3 signing.
 */
export async function resolveSignedPhoto(url: string | null | undefined, _expiresIn = 3600): Promise<string | null> {
  return url || null;
}

/**
 * Simplified hook that returns the URL directly since the backend handles S3 signing.
 */
export function useSignedPhoto(url: string | null | undefined) {
  const [signedUrl, setSignedUrl] = useState<string | null>(url || null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setSignedUrl(url || null);
  }, [url]);

  return { signedUrl, loading };
}

