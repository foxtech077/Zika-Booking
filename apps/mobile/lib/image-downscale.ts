import { Platform } from "react-native";
import * as ImageManipulator from "expo-image-manipulator";

/**
 * Listing photos are downscaled on-device before upload. A camera shot is
 * ~4000px and several MB, far more than any surface paints, and is why listing
 * images were slow to load.
 *
 * Two renditions per photo: a full-size one for the detail carousel and a small
 * preview for list cards.
 */

/**
 * 1600px is the floor, not a round number. A 3:4 portrait capped at 1400 is only
 * 1050px wide — narrower than the 1179px a 3x phone paints full-bleed — so the
 * device upscales it and the carousel visibly softens. At 1600 the same photo is
 * 1200px wide and renders at native resolution.
 */
export const FULL_MAX_DIMENSION = 1600;
export const THUMB_MAX_DIMENSION = 800;

/**
 * Quality ladders, tried in order until the result fits its budget. The first
 * entry is what almost every photo uses; lower steps engage only for unusually
 * detailed images, to stay under the cap the upload endpoint enforces.
 */
const FULL_QUALITY = [0.75, 0.66, 0.58];
const THUMB_QUALITY = [0.72, 0.62];

/** Kept under the server's 500 KB cap with margin. */
const FULL_BUDGET = 480 * 1024;
const THUMB_BUDGET = 120 * 1024;

// WebP encodes natively on both platforms (iOS via SDWebImageWebPCoder, Android
// via Bitmap.CompressFormat.WEBP) and is ~25-30% smaller than JPEG here.
//
// Under react-native-web the manipulator hands the format straight to
// canvas.toBlob, which silently returns PNG when WebP encoding is missing
// (Safari < 14). That would mislabel the upload and balloon its size, so probe
// the canvas before committing to WebP.
let cachedOutput: { format: ImageManipulator.SaveFormat; contentType: string } | null = null;

function output(): { format: ImageManipulator.SaveFormat; contentType: string } {
  if (cachedOutput === null) {
    const webpUnsupported =
      Platform.OS === "web" &&
      typeof document !== "undefined" &&
      !document.createElement("canvas").toDataURL("image/webp").startsWith("data:image/webp");
    cachedOutput = webpUnsupported
      ? { format: ImageManipulator.SaveFormat.JPEG, contentType: "image/jpeg" }
      : { format: ImageManipulator.SaveFormat.WEBP, contentType: "image/webp" };
  }
  return cachedOutput;
}

/** File extension matching the format actually being written. */
export function outputExtension(): string {
  return output().contentType === "image/webp" ? "webp" : "jpg";
}

export interface DownscaledImage {
  uri: string;
  contentType: string;
  /** Byte size, so the upload can be size-checked server-side. */
  size?: number;
}

/** expo-image-manipulator does not report output size, so read it back. */
async function byteSize(uri: string): Promise<number | undefined> {
  try {
    return (await (await fetch(uri)).blob()).size;
  } catch {
    return undefined;
  }
}

/**
 * Resize on the longer edge so portrait shots are bounded by their height —
 * resizing width only would leave a 3000px-tall portrait photo untouched.
 * The manipulator derives the other edge, preserving aspect ratio, and
 * normalises EXIF orientation as part of writing the output.
 */
async function resize(
  uri: string,
  width: number | undefined,
  height: number | undefined,
  maxDimension: number,
  qualities: readonly number[],
  budget: number,
): Promise<DownscaledImage> {
  const longest = Math.max(width ?? 0, height ?? 0);
  // Never upscale: a source already smaller than the target is only re-encoded.
  const actions: ImageManipulator.Action[] =
    longest > maxDimension
      ? [(width ?? 0) >= (height ?? 0)
          ? { resize: { width: maxDimension } }
          : { resize: { height: maxDimension } }]
      : [];

  const { format, contentType } = output();
  let last: { uri: string; size?: number } | null = null;
  for (const compress of qualities) {
    const result = await ImageManipulator.manipulateAsync(uri, actions, { compress, format });
    const size = await byteSize(result.uri);
    last = { uri: result.uri, size };
    // Good enough — stop before spending quality we do not need to.
    if (size === undefined || size <= budget) break;
  }
  return { uri: last!.uri, contentType, size: last!.size };
}

/** Above this, re-encoding earns its keep even when no resize is needed. */
const SKIP_REENCODE_BYTES = 400 * 1024;

/**
 * A WebP already within the target box and already small gains nothing from a
 * re-encode. JPEG and HEIC still go through the manipulator so the uploaded
 * type stays predictable.
 */
export async function downscaleFull(
  uri: string,
  width?: number,
  height?: number,
  mimeType?: string | null,
  fileSize?: number | null,
): Promise<DownscaledImage> {
  const { contentType } = output();
  const alreadyOptimal =
    mimeType === contentType &&
    Math.max(width ?? 0, height ?? 0) <= FULL_MAX_DIMENSION &&
    (fileSize ?? Infinity) <= SKIP_REENCODE_BYTES;

  if (alreadyOptimal) return { uri, contentType, size: fileSize ?? undefined };
  return resize(uri, width, height, FULL_MAX_DIMENSION, FULL_QUALITY, FULL_BUDGET);
}

export function downscaleThumb(
  uri: string,
  width?: number,
  height?: number,
): Promise<DownscaledImage> {
  return resize(uri, width, height, THUMB_MAX_DIMENSION, THUMB_QUALITY, THUMB_BUDGET);
}
