/**
 * Queue derivative generation for photos uploaded before the job existed.
 *
 *   pnpm --filter @zika/listing-service backfill:photos            # queue all
 *   pnpm --filter @zika/listing-service backfill:photos -- --limit 500
 *   pnpm --filter @zika/listing-service backfill:photos -- --dry-run
 *   pnpm --filter @zika/listing-service backfill:photos -- --force  # re-encode
 *
 * Queues rather than encodes here, so the work runs through the same path as a
 * live upload, retries itself, and survives this process being killed. Jobs are
 * deduplicated by photo id, so re-running is safe.
 */
import { prisma } from "../lib/prisma.js";
import { enqueuePhotoDerivatives } from "../lib/photoDerivatives.js";
import { listingQueueConnection, mediaQueue } from "../lib/listingQueue.js";

const PAGE_SIZE = 500;

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function numericFlag(name: string): number | null {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return null;
  const raw = process.argv[i + 1];
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

async function main() {
  const dryRun = flag("dry-run");
  const force = flag("force");
  const limit = numericFlag("limit");

  // `force` re-encodes everything; the default only touches unprocessed photos.
  const where = {
    deletedAt: null,
    ...(force ? {} : { derivedAt: null }),
  };

  const total = await prisma.listingPhoto.count({ where });
  const target = limit ? Math.min(limit, total) : total;

  console.log(
    `[Backfill] ${total} photo(s) match${force ? " (--force: re-encoding all)" : " and have no derivatives"}.` +
      (limit ? ` Limiting to ${target}.` : "") +
      (dryRun ? " Dry run — nothing will be queued." : ""),
  );

  if (target === 0 || dryRun) return;

  let queued = 0;
  // Keyset pagination: `derivedAt: null` stops matching as workers drain the
  // queue, so skip/take would step over photos as the result set shifts.
  let cursor: string | undefined;

  while (queued < target) {
    const batch = await prisma.listingPhoto.findMany({
      where,
      select: { id: true },
      orderBy: { id: "asc" },
      take: Math.min(PAGE_SIZE, target - queued),
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (batch.length === 0) break;

    for (const photo of batch) {
      await enqueuePhotoDerivatives(photo.id, { force });
      queued++;
    }
    cursor = batch[batch.length - 1]!.id;
    console.log(`[Backfill] Queued ${queued}/${target}…`);
  }

  const counts = await mediaQueue.getJobCounts("waiting", "active", "failed");
  console.log(
    `[Backfill] Done. Queued ${queued} job(s). ` +
      `Media queue: ${counts["waiting"]} waiting, ${counts["active"]} active, ${counts["failed"]} failed.`,
  );
  console.log("[Backfill] Workers process these in the background — watch /admin/queues.");
}

main()
  .catch((err) => {
    console.error("[Backfill] Failed:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await mediaQueue.close();
    listingQueueConnection.disconnect();
  });
