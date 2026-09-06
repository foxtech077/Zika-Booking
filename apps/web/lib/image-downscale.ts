/**
 * Listing photos are downscaled in the browser before upload. Providers upload
 * straight off a camera (~4000px, 2-6 MB), which is far more than any surface
 * paints and is why listing images were slow to load.
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
/** Card/grid tiles are ~400 CSS px; 800 covers them at 2x. */
export const THUMB_MAX_DIMENSION = 800;

/**
 * Quality ladders, tried in order until the result fits its budget. The first
 * entry is what almost every photo uses; the lower steps only engage for
 * unusually detailed images, trading a little quality to stay under the cap the
 * upload endpoint enforces. WebP starts lower than JPEG because it needs less
 * quality to look the same.
 */
const QUALITY = {
  "image/webp": { full: [0.75, 0.66, 0.58], thumb: [0.72, 0.62] },
  "image/jpeg": { full: [0.82, 0.72, 0.62], thumb: [0.78, 0.68] },
} as const;

/** Kept under the server's 500 KB cap with margin. */
const BUDGET = { full: 480 * 1024, thumb: 120 * 1024 } as const;

type OutputType = keyof typeof QUALITY;

let cachedOutputType: OutputType | null = null;

/**
 * Canvas WebP encoding is missing on Safari below 14, and `toBlob` there falls
 * back to PNG *silently* — which would upload something far larger than the
 * original. Probe once and encode JPEG when WebP is unavailable.
 */
function outputType(): OutputType {
  if (cachedOutputType === null) {
    const probe = document.createElement("canvas");
    probe.width = probe.height = 1;
    cachedOutputType = probe.toDataURL("image/webp").startsWith("data:image/webp")
      ? "image/webp"
      : "image/jpeg";
  }
  return cachedOutputType;
}

function extensionFor(type: OutputType): string {
  return type === "image/webp" ? "webp" : "jpg";
}

/**
 * Decode with EXIF orientation applied. Canvas draws raw pixels, so without this
 * a portrait phone photo is re-encoded sideways — the orientation tag that kept
 * it upright does not survive the round trip.
 */
async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  try {
    return await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    // Older Safari lacks the options argument. <img> applies EXIF itself
    // (image-orientation: from-image is the default) and drawImage honours it.
    const url = URL.createObjectURL(file);
    try {
      return await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("Could not decode image"));
        img.src = url;
      });
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

function dimensions(source: ImageBitmap | HTMLImageElement) {
  return source instanceof HTMLImageElement
    ? { width: source.naturalWidth, height: source.naturalHeight }
    : { width: source.width, height: source.height };
}

async function render(
  source: ImageBitmap | HTMLImageElement,
  maxDimension: number,
  kind: "full" | "thumb",
  baseName: string,
): Promise<File> {
  const type = outputType();
  const { width, height } = dimensions(source);
  // Never upscale — a source smaller than the target is only re-encoded.
  const scale = Math.min(1, maxDimension / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable");
  ctx.imageSmoothingQuality = "high";
  // JPEG has no alpha, so flatten onto white rather than letting transparent
  // pixels encode as black. Harmless for WebP, which keeps the alpha it has.
  if (type === "image/jpeg") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);

  const ladder = QUALITY[type][kind];
  let blob: Blob | null = null;
  for (const quality of ladder) {
    blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, type, quality),
    );
    if (!blob) throw new Error("Could not encode image");
    // Good enough — stop before spending quality we do not need to.
    if (blob.size <= BUDGET[kind]) break;
  }
  if (!blob) throw new Error("Could not encode image");
  // toBlob ignores an unsupported type rather than failing, so trust the blob's
  // own type over what we asked for when naming and declaring the upload.
  const actualType = (blob.type || type) as OutputType;
  const suffix = kind === "thumb" ? "-thumb" : "";
  return new File([blob], `${baseName}${suffix}.${extensionFor(actualType)}`, {
    type: actualType,
  });
}

export interface DownscaledPair {
  full: File;
  thumb: File;
}

/** Above this, re-encoding earns its keep even when no resize is needed. Also
 *  keeps a reused original inside the upload budget. */
const SKIP_REENCODE_BYTES = 400 * 1024;

/**
 * A photo already within the target box and already small gains nothing from a
 * re-encode — it only loses a generation of quality. Restricted to JPEG/WebP
 * because PNG sources shrink dramatically when converted.
 */
function alreadyOptimal(file: File, width: number, height: number): boolean {
  return (
    (file.type === "image/jpeg" || file.type === "image/webp") &&
    Math.max(width, height) <= FULL_MAX_DIMENSION &&
    file.size <= SKIP_REENCODE_BYTES
  );
}

/** Decodes once, then renders both renditions from that single decode. */
export async function downscaleForUpload(file: File): Promise<DownscaledPair> {
  const source = await decode(file);
  try {
    const base = file.name.replace(/\.[^.]+$/, "").trim() || "photo";
    const { width, height } = dimensions(source);
    const [full, thumb] = await Promise.all([
      alreadyOptimal(file, width, height)
        ? Promise.resolve(file)
        : render(source, FULL_MAX_DIMENSION, "full", base),
      render(source, THUMB_MAX_DIMENSION, "thumb", base),
    ]);
    return { full, thumb };
  } finally {
    if (!(source instanceof HTMLImageElement)) source.close();
  }
}
