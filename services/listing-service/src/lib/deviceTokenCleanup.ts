import { prisma } from "./prisma.js";
import { validateFcmToken } from "./notifications.js";

const CLEANUP_BATCH_SIZE = 100;
const VALIDATION_CONCURRENCY = 10;

export async function enqueueDeviceTokenCleanupBatches(
  addBulk: (jobs: { name: string; data: { tokenIds: string[] }; opts: object }[]) => Promise<unknown>,
  jobName: string,
  defaultJobOptions: object,
): Promise<number> {
  const rows = await (prisma as any).deviceToken.findMany({
    where: { platform: { in: ["fcm", "apns"] } },
    select: { id: true },
    orderBy: { id: "asc" },
  }) as { id: string }[];

  let batches = 0;
  for (let offset = 0; offset < rows.length; offset += CLEANUP_BATCH_SIZE) {
    const tokenIds = rows.slice(offset, offset + CLEANUP_BATCH_SIZE).map((row) => row.id);
    await addBulk([
      {
        name: jobName,
        data: { tokenIds },
        opts: { ...defaultJobOptions, jobId: `device-token-cleanup-${Date.now()}-${batches}` },
      },
    ]);
    batches += 1;
  }

  return batches;
}

export async function cleanDeviceTokenBatch(tokenIds: string[]): Promise<void> {
  const rows = await (prisma as any).deviceToken.findMany({
    where: { id: { in: tokenIds }, platform: { in: ["fcm", "apns"] } },
    select: { id: true, token: true },
  }) as { id: string; token: string }[];

  for (let offset = 0; offset < rows.length; offset += VALIDATION_CONCURRENCY) {
    const group = rows.slice(offset, offset + VALIDATION_CONCURRENCY);
    const results = await Promise.allSettled(
      group.map(async (row) => ({ row, result: await validateFcmToken(row.token) })),
    );

    for (const result of results) {
      if (result.status === "fulfilled" && result.value.result === "invalid") {
        await (prisma as any).deviceToken.delete({ where: { id: result.value.row.id } });
        console.log(`[DeviceTokenCleanup] Removed invalid token ${result.value.row.id}`);
      } else if (result.status === "rejected") {
        console.warn("[DeviceTokenCleanup] Token validation failed; retaining token:", result.reason?.message ?? result.reason);
      }
    }
  }
}
