import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const REGION   = process.env["AWS_REGION"]       ?? "af-south-1";
const BUCKET   = process.env["S3_BUCKET_NAME"]   ?? "zika-storage";
const CDN_BASE = (process.env["S3_CDN_BASE_URL"] ?? "https://zika-storage.s3.af-south-1.amazonaws.com").replace(/\/$/, "");

const s3 = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId:     process.env["AWS_ACCESS_KEY_ID"]     ?? "",
    secretAccessKey: process.env["AWS_SECRET_ACCESS_KEY"] ?? "",
  },
  requestChecksumCalculation:  "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});

/**
 * Given a stored photoUrl, returns a presigned GET URL (15 min) if the URL
 * points to our private S3 bucket. External URLs (e.g. Google avatars) are
 * returned unchanged. Null is passed through.
 */
export async function signPhotoUrl(photoUrl: string | null): Promise<string | null> {
  if (!photoUrl) return null;
  if (!photoUrl.startsWith(CDN_BASE + "/")) return photoUrl; // external URL — return as-is

  const s3Key = photoUrl.slice(CDN_BASE.length + 1);
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: s3Key });
  return getSignedUrl(s3, command, { expiresIn: 900 }); // 15 minutes
}
