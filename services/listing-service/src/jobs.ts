import { Queue, Worker } from "bullmq";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { FastifyAdapter } from "@bull-board/fastify";
import Redis from "ioredis";
import { cancelStalePendingPayments } from "./lib/pendingPaymentCanceller.js";
import { completeEligibleBookings } from "./lib/bookingCompletionScheduler.js";
import { checkVoucherExpiryWarnings } from "./lib/voucherExpiryWarner.js";
import { pollIcalFeeds } from "./routes/ical.js";
import { promotePendingRates } from "./lib/commissionScheduler.js";
import { expireStaleGeoVerifications } from "./lib/geoVerificationExpirer.js";
import { QueueName, ListingJob } from "@zika/types";

// Dedicated connection for BullMQ — must use maxRetriesPerRequest: null
// (Worker's blocking commands conflict with non-null retry settings).
const connection = new Redis(process.env["REDIS_URL"] ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  lazyConnect: false,
});

const queue = new Queue(QueueName.Listing, { connection });

const worker = new Worker(
  QueueName.Listing,
  async (job) => {
    switch (job.name as ListingJob) {
      case ListingJob.PendingPaymentCanceller:
        // TODO: Can be precision-delayed — schedule at booking creation time instead
        await cancelStalePendingPayments();
        break;
      case ListingJob.BookingCompletion:
        // TODO: Can be precision-delayed — schedule at checkout time instead
        await completeEligibleBookings();
        break;
      case ListingJob.VoucherExpiryWarner:
        await checkVoucherExpiryWarnings();
        break;
      case ListingJob.IcalPoller:
        await pollIcalFeeds();
        break;
      case ListingJob.CommissionScheduler:
        await promotePendingRates();
        break;
      case ListingJob.GeoVerificationExpirer:
        await expireStaleGeoVerifications();
        break;
    }
  },
  { connection },
);

worker.on("failed", (job, err) => {
  console.error(`[Job] ${job?.name} (id: ${job?.id}) failed:`, err.message);
});

export function registerBullBoard(app: any) {
  const serverAdapter = new FastifyAdapter();
  createBullBoard({
    queues: [new BullMQAdapter(queue)],
    serverAdapter,
  });
  serverAdapter.setBasePath("/admin/queues");
  app.register(serverAdapter.registerPlugin.bind(serverAdapter), {
    prefix: "/admin/queues",
  });
}

export async function startJobs() {
  await queue.add(ListingJob.PendingPaymentCanceller, {}, { repeat: { every: 60_000 } });
  await queue.add(ListingJob.BookingCompletion, {}, { repeat: { every: 300_000 } });
  await queue.add(ListingJob.VoucherExpiryWarner, {}, { repeat: { every: 4 * 60 * 60 * 1000 } });
  await queue.add(ListingJob.IcalPoller, {}, { repeat: { every: 15 * 60 * 1000 } });
  await queue.add(ListingJob.CommissionScheduler, {}, { repeat: { every: 60 * 60 * 1000 } });
  await queue.add(ListingJob.GeoVerificationExpirer, {}, { repeat: { every: 2 * 60 * 60 * 1000 } });
}

export async function stopJobs() {
  await worker.close();
  await queue.close();
  connection.disconnect();
}
