import { Worker } from "bullmq";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { FastifyAdapter } from "@bull-board/fastify";
import { cancelStalePendingPayments } from "./lib/pendingPaymentCanceller.js";
import { completeEligibleBookings } from "./lib/bookingCompletionScheduler.js";
import { checkVoucherExpiryWarnings } from "./lib/voucherExpiryWarner.js";
import { getDueIcalFeedIds, syncFeed } from "./routes/ical.js";
import { promotePendingRates } from "./lib/commissionScheduler.js";
import { expireStaleGeoVerifications } from "./lib/geoVerificationExpirer.js";
import { refreshExchangeRates } from "./services/exchangeRate.services.js";
import { sendReservationTimerWarning } from "./lib/reservationTimerWarning.js";
import { cleanDeviceTokenBatch, enqueueDeviceTokenCleanupBatches } from "./lib/deviceTokenCleanup.js";
import {
  deliverNotificationPushBatch,
} from "./lib/notifications.js";
import { generatePhotoDerivatives } from "./lib/photoDerivatives.js";
import {
  listingJobOptions as defaultJobOptions,
  listingQueue as queue,
  mediaQueue,
  listingQueueConnection as connection,
} from "./lib/listingQueue.js";
import { QueueName, ListingJob } from "@zika/types";

const worker = new Worker(
  QueueName.Listing,
  async (job) => {
    switch (job.name as ListingJob) {
      case ListingJob.PendingPaymentCanceller:
        await cancelStalePendingPayments();
        break;
      case ListingJob.BookingCompletion:
        await completeEligibleBookings();
        break;
      case ListingJob.VoucherExpiryWarner:
        await checkVoucherExpiryWarnings();
        break;
      case ListingJob.IcalPoller:
        for (const feedId of await getDueIcalFeedIds()) {
          await queue.add(
            ListingJob.IcalFeedSync,
            { feedId },
            {
              ...defaultJobOptions,
              removeOnComplete: true,
              jobId: `ical-feed-${feedId}-${Math.floor(Date.now() / (15 * 60_000))}`,
            },
          );
        }
        break;
      case ListingJob.IcalFeedSync: {
        const { feedId } = job.data as { feedId: string };
        const result = await syncFeed(feedId);
        if (result.error)
          console.warn(
            `[iCal Poller] Feed ${feedId} sync error: ${result.error}`,
          );
        break;
      }
      case ListingJob.CommissionScheduler:
        await promotePendingRates();
        break;
      case ListingJob.GeoVerificationExpirer:
        await expireStaleGeoVerifications();
        break;
      case ListingJob.ExchangeRateRefresher:
        await refreshExchangeRates();
        break;
      case ListingJob.ReservationTimerWarning:
        await sendReservationTimerWarning(
          (job.data as { lockToken: string }).lockToken,
        );
        break;
      case ListingJob.DeviceTokenCleanup:
        await enqueueDeviceTokenCleanupBatches(
          (jobs) => queue.addBulk(jobs as any),
          ListingJob.DeviceTokenCleanupBatch,
          defaultJobOptions,
        );
        break;
      case ListingJob.DeviceTokenCleanupBatch:
        await cleanDeviceTokenBatch((job.data as { tokenIds: string[] }).tokenIds);
        break;
      case ListingJob.NotificationPushBatch:
        await deliverNotificationPushBatch(
          job.data as Parameters<typeof deliverNotificationPushBatch>[0],
        );
        break;
    }
  },
  { connection },
);

worker.on("failed", (job, err) => {
  console.error(`[Job] ${job?.name} (id: ${job?.id}) failed:`, err.message);
});

/**
 * Image encoding only, on its own queue so a bulk backfill cannot delay the
 * business jobs above. Concurrency stays small: each job holds a full-resolution
 * photo in memory, and the API shares the box.
 */
const MEDIA_CONCURRENCY = Number(process.env["MEDIA_WORKER_CONCURRENCY"] ?? 3);

const mediaWorker = new Worker(
  QueueName.ListingMedia,
  async (job) => {
    switch (job.name as ListingJob) {
      case ListingJob.PhotoDerivatives:
        await generatePhotoDerivatives((job.data as { photoId: string }).photoId);
        break;
    }
  },
  { connection, concurrency: MEDIA_CONCURRENCY },
);

mediaWorker.on("failed", (job, err) => {
  console.error(`[MediaJob] ${job?.name} (id: ${job?.id}) failed:`, err.message);
});

export function registerBullBoard(app: any) {
  const serverAdapter = new FastifyAdapter();
  createBullBoard({
    queues: [new BullMQAdapter(queue), new BullMQAdapter(mediaQueue)],
    serverAdapter,
  });
  serverAdapter.setBasePath("/admin/queues");
  app.register(serverAdapter.registerPlugin.bind(serverAdapter), {
    prefix: "/admin/queues",
  });
}

const FX_REFRESH_JOB_ID = "exchange-rate-refresh-next";
const FX_STARTUP_JOB_ID = "exchange-rate-refresh-startup";

/**
 * Enqueue an immediate ExchangeRateRefresher job (deduplicated), used on-demand
 * by the /internal/fx/refresh endpoint when a stale-rate failure occurs.
 */
export async function enqueueExchangeRateRefresh(): Promise<void> {
  await enqueueExchangeRateJob(FX_REFRESH_JOB_ID);
}

/**
 * Enqueue the one-off startup warm-up refresh. The remove-then-add pattern is
 * required (rather than just a static jobId): with `removeOnComplete` age
 * retention BullMQ deduplicates against completed jobs, so a plain re-add
 * after a restart would be silently dropped until retention expires.
 */
async function enqueueStartupExchangeRateRefresh(): Promise<void> {
  await enqueueExchangeRateJob(FX_STARTUP_JOB_ID);
}

async function enqueueExchangeRateJob(jobId: string): Promise<void> {
  const existing = await queue.getJob(jobId);
  if (existing) {
    const state = await existing.getState();
    if (!(["completed", "failed"] as string[]).includes(state)) return;

    // Only terminal jobs may be replaced. A concurrent replica may claim the
    // job between getState() and remove(), so preserve it if removal loses the
    // race rather than failing service startup.
    try {
      await existing.remove();
    } catch {
      return;
    }
  }
  await queue.add(
    ListingJob.ExchangeRateRefresher,
    {},
    { ...defaultJobOptions, jobId },
  );

}

export async function enqueueReservationTimerWarning(
  lockToken: string,
): Promise<void> {
  await queue.add(
    ListingJob.ReservationTimerWarning,
    { lockToken },
    {
      ...defaultJobOptions,
      jobId: `reservation-warning-${lockToken}`,
      delay: 240_000,
    },
  );
}

export async function startJobs() {
  await queue.add(
    ListingJob.PendingPaymentCanceller,
    {},
    { ...defaultJobOptions, repeat: { every: 60_000 } },
  );
  await queue.add(
    ListingJob.BookingCompletion,
    {},
    { ...defaultJobOptions, repeat: { every: 300_000 } },
  );
  await queue.add(
    ListingJob.VoucherExpiryWarner,
    {},
    { ...defaultJobOptions, repeat: { every: 4 * 60 * 60 * 1000 } },
  );
  await queue.add(
    ListingJob.IcalPoller,
    {},
    { ...defaultJobOptions, repeat: { every: 15 * 60 * 1000 } },
  );
  await queue.add(
    ListingJob.CommissionScheduler,
    {},
    { ...defaultJobOptions, repeat: { every: 60 * 60 * 1000 } },
  );
  await queue.add(
    ListingJob.GeoVerificationExpirer,
    {},
    { ...defaultJobOptions, repeat: { every: 2 * 60 * 60 * 1000 } },
  );

  // Exchange rates: repeatable 2-hour job. Repeatable jobs are re-scheduled by
  // the queue manager, and the one-off startup job warms the table immediately.
  await queue.add(
    ListingJob.ExchangeRateRefresher,
    {},
    { ...defaultJobOptions, repeat: { every: 2 * 60 * 60 * 1000 } },
  );

  // Validate FCM/APNs registration tokens once per month without delivering
  // a notification. The parent job fans out work in batches of 100.
  await queue.add(
    ListingJob.DeviceTokenCleanup,
    {},
    { ...defaultJobOptions, repeat: { every: 30 * 24 * 60 * 60 * 1000 } },
  );

  // Refresh rates at least once at boot. Failure is retryable and does not
  // prevent the service from starting.
  await enqueueStartupExchangeRateRefresh();
}

export async function stopJobs() {
  await worker.close();
  await queue.close();
  connection.disconnect();
}
