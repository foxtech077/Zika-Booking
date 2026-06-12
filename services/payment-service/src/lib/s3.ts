import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

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

export function cdnUrl(s3Key: string): string {
  return `${CDN_BASE}/${s3Key}`;
}