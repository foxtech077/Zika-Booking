import { S3Client, DeleteObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { PutObjectCommand } from "@aws-sdk/client-s3";

const REGION = process.env["AWS_REGION"] ?? "af-south-1";
const BUCKET = process.env["S3_BUCKET_NAME"] ?? "zika-storage";
const CDN_BASE = process.env["S3_CDN_BASE_URL"] ?? "https://zika-storage.s3.af-south-1.amazonaws.com";

const s3 = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: process.env["AWS_ACCESS_KEY_ID"] ?? "",
    secretAccessKey: process.env["AWS_SECRET_ACCESS_KEY"] ?? "",
  },
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
});

export function cdnUrl(s3Key: string): string {
  return `${CDN_BASE}/${s3Key}`;
}

export async function createPresignedUploadUrl(
  s3Key: string,
  contentType: string,
  expiresIn = 300,
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: s3Key,
    ContentType: contentType,
  });
  return getSignedUrl(s3, command, { expiresIn });
}

export async function createPresignedDownloadUrl(s3Key: string, expiresIn = 900): Promise<string> {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: s3Key });
  return getSignedUrl(s3, command, { expiresIn });
}

export async function withSignedPhotos<T extends { s3Key: string }>(
  photos: T[],
): Promise<(T & { cdnUrl: string })[]> {
  return Promise.all(
    photos.map(async (p) => ({ ...p, cdnUrl: await createPresignedDownloadUrl(p.s3Key) })),
  );
}

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

export async function deleteObject(s3Key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: s3Key }));
}

export function photoS3Key(listingId: string, filename: string): string {
  return `listings/${listingId}/photos/${Date.now()}-${filename}`;
}

export function documentS3Key(listingId: string, docType: string, filename: string): string {
  return `listings/${listingId}/documents/${docType}-${Date.now()}-${filename}`;
}

const PHOTO_CONTENT_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const DOC_CONTENT_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

export function isValidPhotoType(contentType: string): boolean {
  return PHOTO_CONTENT_TYPES.has(contentType);
}

export function isValidDocumentType(contentType: string): boolean {
  return DOC_CONTENT_TYPES.has(contentType);
}

export function fileExtFromContentType(contentType: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "application/pdf": "pdf",
  };
  return map[contentType] ?? "bin";
}
