import sharp from "sharp";
import { prisma } from "./prisma.js";
import { ListingJob } from "@zika/types";
import { mediaQueue, listingJobOptions } from "./listingQueue.js";
import {
  cdnUrl,
  derivativeS3Key,
  getObjectBuffer,
  uploadBuffer,
  IMMUTABLE_CACHE_CONTROL,
} from "./s3.js";

/**
 * Widths are the largest CSS box each variant is shown in, at 2x DPR, so a
 * client is never handed fewer pixels than it paints.
 *
 *   thumb (400w)  lightbox filmstrip, small row thumbnails
 *   card  (800w)  search and grid cards, mosaic side tiles
 *   full (1600w)  detail hero, mobile carousel, lightbox main
 *
 * Anything bigger (pinch-zoom) still has the untouched original at `cdnUrl`.
 */
export const PHOTO_VARIANTS = [
  { name: "thumb", width: 400, quality: 78 },
  { name: "card", width: 800, quality: 82 },
  { name: "full", width: 1600, quality: 84 },
] as const;

type VariantName = (typeof PHOTO_VARIANTS)[number]["name"];

// The worker already encodes several photos at once; letting libvips also fan
// each one across every core just thrashes the scheduler.
sharp.concurrency(1);
sharp.cache(false);

const MAX_SOURCE_PIXELS = 100_000_000;

export interface DerivativeResult {
  urls: Record<VariantName, string>;
  width: number | null;
  height: number | null;
}

export async function buildDerivatives(
  originalKey: string,
  source: Buffer,
): Promise<DerivativeResult> {
  const image = sharp(source, { limitInputPixels: MAX_SOURCE_PIXELS, failOn: "none" });
  const meta = await image.metadata();

  // Apply EXIF orientation before resizing: resizing drops the tag that was the
  // only thing keeping a phone photo upright.
  const upright = image.rotate();

  // Orientations 5-8 swap the axes, so raw metadata is transposed vs. what ships.
  const swapped = (meta.orientation ?? 1) >= 5;
  const width = swapped ? meta.height ?? null : meta.width ?? null;
  const height = swapped ? meta.width ?? null : meta.height ?? null;

  const urls = {} as Record<VariantName, string>;

  for (const variant of PHOTO_VARIANTS) {
    const buffer = await upright
      .clone()
      .resize({
        width: variant.width,
        fit: "inside",
        // A source smaller than the target passes through at its own size
        // rather than being upscaled into a blurrier, larger file.
        withoutEnlargement: true,
        kernel: "lanczos3",
      })
      .webp({ quality: variant.quality, effort: 4, smartSubsample: true })
      .toBuffer();

    const key = derivativeS3Key(originalKey, variant.name);
    await uploadBuffer(key, buffer, "image/webp", IMMUTABLE_CACHE_CONTROL);
    urls[variant.name] = cdnUrl(key);
  }

  return { urls, width, height };
}

/**
 * A photo with no derivatives still renders from its original everywhere, so a
 * permanent failure here costs speed, never correctness.
 */
export async function generatePhotoDerivatives(photoId: string): Promise<void> {
  const photo = await prisma.listingPhoto.findUnique({
    where: { id: photoId },
    select: { s3Key: true, deletedAt: true },
  });

  if (!photo) {
    console.warn(`[PhotoDerivatives] Photo ${photoId} no longer exists — skipping.`);
    return;
  }
  if (photo.deletedAt) return;

  const source = await getObjectBuffer(photo.s3Key);
  const { urls, width, height } = await buildDerivatives(photo.s3Key, source);

  // Conditional on deletedAt so a photo removed while encoding is not marked derived.
  await prisma.listingPhoto.updateMany({
    where: { id: photoId, deletedAt: null },
    data: {
      thumbUrl: urls.thumb,
      cardUrl: urls.card,
      fullUrl: urls.full,
      width,
      height,
      derivedAt: new Date(),
    },
  });
}

/**
 * Deduplicated by photo id, so retries, re-confirms and an overlapping backfill
 * collapse onto one job. Never throws — a Redis blip must not fail the upload
 * the provider just completed.
 */
export async function enqueuePhotoDerivatives(
  photoId: string,
  opts: { force?: boolean } = {},
): Promise<void> {
  const jobId = `photo-derivatives-${photoId}`;
  try {
    // BullMQ ignores add() for a jobId that still exists, and completed jobs
    // linger for a day — that dedup is right for retries, but would make a
    // deliberate re-encode do nothing, so drop the old record first.
    if (opts.force) await mediaQueue.remove(jobId).catch(() => {});

    await mediaQueue.add(
      ListingJob.PhotoDerivatives,
      { photoId },
      { ...listingJobOptions, jobId },
    );
  } catch (err) {
    console.error(
      `[PhotoDerivatives] Failed to enqueue for photo ${photoId}:`,
      (err as Error).message,
    );
  }
}
