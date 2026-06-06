import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { useState, useEffect } from "react";

const region = process.env["EXPO_PUBLIC_AWS_REGION"] || "af-south-1";
const bucket = process.env["EXPO_PUBLIC_S3_BUCKET_NAME"] || "zika-storage";
const accessKeyId = process.env["EXPO_PUBLIC_AWS_ACCESS_KEY_ID"] || "";
const secretAccessKey = process.env["EXPO_PUBLIC_AWS_SECRET_ACCESS_KEY"] || "";

let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });
  }
  return s3Client;
}

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
    // Pathname starts with "/" e.g. "/listings/b952b288-9369-478e-af85-47e5ec02cca8/photos/1780469577211-1780469577211.png"
    const pathname = parsed.pathname;
    return pathname.startsWith("/") ? pathname.slice(1) : pathname;
  } catch (e) {
    console.error("[getS3Key] Failed to parse URL:", url, e);
    return null;
  }
}

/**
 * Generates a presigned URL client-side.
 */
export async function resolveSignedPhoto(url: string | null | undefined, expiresIn = 3600): Promise<string | null> {
  if (!url) return null;

  // If URL doesn't look like an S3 URL and is an absolute URL, return as-is
  if (url.startsWith("http") && !url.includes("amazonaws.com")) {
    return url;
  }

  const key = getS3Key(url);
  if (!key) return null;

  try {
    const client = getS3Client();
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: key,
    });
    return await getSignedUrl(client, command, { expiresIn });
  } catch (err) {
    console.error("[resolveSignedPhoto] Error signing photo:", url, err);
    return url; // fallback to raw url
  }
}

/**
 * Hook to manage async client-side URL signature resolution.
 */
export function useSignedPhoto(url: string | null | undefined) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    if (!url) {
      setSignedUrl(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    resolveSignedPhoto(url)
      .then((res) => {
        if (active) {
          setSignedUrl(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("[useSignedPhoto] Error resolving URL:", err);
        if (active) {
          setSignedUrl(url); // fallback to original
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [url]);

  return { signedUrl, loading };
}
