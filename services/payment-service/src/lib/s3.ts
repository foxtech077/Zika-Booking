import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const REGION = process.env["AWS_REGION"] ?? "af-south-1";
const BUCKET = process.env["S3_BUCKET_NAME"] ?? "zika-storage";
const CDN_BASE = process.env["S3_CDN_BASE_URL"] ?? "";

const s3 = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: process.env["AWS_ACCESS_KEY_ID"] ?? "",
    secretAccessKey: process.env["AWS_SECRET_ACCESS_KEY"] ?? "",
  },
});

export async function uploadBuffer(
  s3Key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: s3Key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

export async function downloadBuffer(s3Key: string): Promise<Buffer> {
  const res = await s3.send(
    new GetObjectCommand({
      Bucket: BUCKET,
      Key: s3Key,
    }),
  );
  if (!res.Body) {
    throw new Error(`S3 GetObject returned empty body for key: ${s3Key}`);
  }
  const bytes = await res.Body.transformToByteArray();
  return Buffer.from(bytes);
}

/**
 * Returns a pre-signed URL for an S3 object with a 7-day expiry.
 * Pre-signed URLs work without bucket public-access ACLs.
 */
export async function getPublicUrl(s3Key: string): Promise<string> {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: s3Key });
  return getSignedUrl(s3, command, { expiresIn: 604800 }); // 7 days
}

/** @deprecated Use getPublicUrl instead — generates pre-signed URLs */
export function cdnUrl(s3Key: string): string {
  return `${CDN_BASE}/${s3Key}`;
}